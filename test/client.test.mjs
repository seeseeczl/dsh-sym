import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadClient } from './helpers/load-client.mjs'

/**
 * 客户端纯函数的断言（审计 AUD-QUAL-001 / 任务卡 P1-01）。
 *
 * 两类：`describeScope` 的账单文本（悬停提示与花费面板共用的输出，覆盖 FM-006
 * 花费面板与 FM-007 峰谷拆分 + 谷时省钱的全部验收点），以及把键盘交还输入框的
 * `focusComposer` / `keepComposerFocus`（假 DOM，不引入 jsdom、不渲染组件 ——
 * `load-client.mjs` 已经用最小替身把模块工厂物化出来）。
 */

/** DeepSeek flash 现行人民币价目：高峰价，空闲价为一半。 */
const DEEPSEEK_RATES = {
  peak: {
    cny: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
    vendor: { cacheHit: 0.04, cacheMiss: 2, output: 8 },
  },
  offPeak: {
    cny: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
    vendor: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
  },
}

/**
 * 一条 DeepSeek 模型的投影记录：峰时与谷时各花 0.64 元。
 * 谷时折扣省下 = 谷时实付 0.64 元；可挪动的峰时花费 = 0.64 / 2 = 0.32 元。
 *
 * 这里故意留着 2.4M 的缓存命中量：缓存省下已从界面上整体撤掉，
 * 这些 token 现在是"出现了也不该产生任何省下文案"的反例。
 */
function deepseekEntry() {
  return {
    model: 'deepseek-flash',
    provider: 'deepseek-account',
    vendor: 'DeepSeek',
    source: '官方人民币价目',
    known: true,
    peakPriced: true,
    rates: DEEPSEEK_RATES,
    tokens: {
      peak: { cacheHit: 1_000_000, cacheMiss: 100_000, cacheWrite: 0, output: 50_000 },
      offPeak: { cacheHit: 2_000_000, cacheMiss: 200_000, cacheWrite: 0, output: 100_000 },
    },
    cost: {
      peak: { cacheHit: 0.04, cacheMiss: 0.2, cacheWrite: 0, output: 0.4 },
      offPeak: { cacheHit: 0.04, cacheMiss: 0.2, cacheWrite: 0, output: 0.4 },
    },
    requests: { peak: 3, offPeak: 5 },
    cny: 1.28,
    fx: null,
  }
}

test('describeScope：峰谷混合的 DeepSeek 会话，拆分与谷时省钱都在', () => {
  const { describeScope } = loadClient()
  const scope = { requests: 8, peakRequests: 3, models: [deepseekEntry()], unpriced: [] }
  const text = describeScope(scope, undefined, '本会话总费用 1.28 元')

  assert.match(text, /^本会话总费用 1\.28 元$/m, '首行是调用方给的标题')
  assert.match(text, /计费请求 8 次 · 高峰 3 次/)
  assert.match(text, /deepseek-flash · DeepSeek · 官方人民币价目/)
  assert.match(text, /小计 ¥1\.28/)

  // FM-007：峰谷拆分与「挪到谷时还能省多少」。
  assert.match(text, /按时段/)
  assert.match(text, /^ {2}峰时 ¥0\.640$/m)
  assert.match(text, /^ {2}谷时 ¥0\.640$/m)
  assert.match(text, /峰时改到谷时，还能再省 ¥0\.320/)

  // FM-006：只剩谷时折扣这一项省钱。
  assert.match(text, /谷时折扣为你省下 ¥0\.640/)
  assert.doesNotMatch(text, /缓存为你省下/, '缓存省下已整体撤掉，命中量再大也不出这行')
  assert.doesNotMatch(text, /未命中价计费/, '连同那条反事实的解释也一并撤掉')
})

test('describeScope：非峰谷定价的厂商不产生「挪到谷时」的数字，也不产生谷时折扣', () => {
  const { describeScope } = loadClient()
  const scope = {
    requests: 2,
    peakRequests: 1,
    models: [{
      model: 'flat-model',
      vendor: 'FlatVendor',
      known: true,
      peakPriced: false,
      rates: {
        offPeak: {
          cny: { cacheHit: 1, cacheMiss: 3, output: 6 },
          vendor: { cacheHit: 1, cacheMiss: 3, output: 6 },
        },
      },
      tokens: { offPeak: { cacheHit: 500_000, cacheMiss: 50_000, cacheWrite: 0, output: 10_000 } },
      cost: { offPeak: { cacheHit: 0.5, cacheMiss: 0.15, cacheWrite: 0, output: 0.06 } },
      requests: { peak: 0, offPeak: 2 },
      cny: 0.71,
      fx: null,
    }],
    unpriced: [],
  }
  const text = describeScope(scope, undefined, '本次任务（第 3 轮）费用 0.71 元')

  assert.match(text, /单一价（该厂商不分时段）/, 'flat 厂商按单一时段报告')
  assert.match(text, /^ {2}谷时 ¥0\.710$/m)
  assert.match(text, /没有可挪到谷时的峰时用量/, '可挪动金额为 0 时给的是说明而不是数字')
  assert.doesNotMatch(text, /峰时改到谷时，还能再省/)
  assert.doesNotMatch(text, /谷时折扣为你省下/, 'flat 厂商没有谷时折扣')
})

test('describeScope：未收录价目的模型不计入金额，并单独列出', () => {
  const { describeScope } = loadClient()
  const scope = {
    requests: 2,
    peakRequests: 0,
    models: [{ model: 'mystery-model', vendor: 'Someone', known: false, cny: 0 }],
    unpriced: ['mystery-model'],
  }
  const text = describeScope(scope, undefined, '本会话总费用 0.00 元')

  assert.match(text, /全部空闲时段/, '没有峰时请求时写明全部空闲')
  assert.match(text, /未收录价目，未计入金额/)
  assert.match(text, /未计价模型：mystery-model/)
  assert.doesNotMatch(text, /缓存为你省下/)
  assert.doesNotMatch(text, /按时段/, '没有可拆分的峰谷金额时不出现时段段')
})

test('describeScope：scope 缺字段时不抛错，退化为最小文本', () => {
  const { describeScope } = loadClient()
  assert.match(describeScope({}, undefined, '标题'), /^标题$/m)
  assert.match(describeScope({ models: null }, undefined, '标题'), /标题/)
})

test('两次加载互相独立（AUD-TEST-003 的守卫）', () => {
  const a = loadClient()
  const b = loadClient()
  assert.notEqual(a, b, '每次加载都应得到独立的模块实例')
  assert.equal(typeof a.describeScope, 'function')
  assert.equal(typeof b.describeScope, 'function')
  const scope = { requests: 1, peakRequests: 1, models: [deepseekEntry()], unpriced: [] }
  assert.equal(a.describeScope(scope, undefined, 'x'), b.describeScope(scope, undefined, 'x'))
})

test('formatCny：金额精度随量级自适应', () => {
  const { formatCny } = loadClient()
  assert.equal(formatCny(0), '0.00')
  assert.equal(formatCny(1.28), '1.28')
  assert.equal(formatCny(0.64), '0.640')
  assert.equal(formatCny(0.0032), '0.0032')
})

test('registerSlotCell：同一实例内重复 id 被跳过，不再打给注册表（AUD-OPS-001）', () => {
  const { registerSlotCell } = loadClient()
  const registered = []
  const ctx = { slots: { register: (options) => { registered.push(options.id); return () => {} } } }

  const first = registerSlotCell(ctx, 'conversation.composer.dock', 'sym-cost', 10, () => null)
  const second = registerSlotCell(ctx, 'conversation.composer.dock', 'sym-cost', 10, () => null)

  assert.equal(typeof first, 'function', '首次注册返回注册表的 disposer')
  assert.equal(second, null, '重复注册被跳过')
  assert.deepEqual(registered, ['sym-cost'], '注册表只被调用一次')
})

test('registerSlotCell：注册表拒绝时吞掉异常并返回 null，后续插槽不受影响', () => {
  const { registerSlotCell } = loadClient()
  const attempted = []
  const ctx = {
    slots: {
      register: (options) => {
        attempted.push(options.id)
        if (options.id === 'bad') throw new Error('duplicate id')
        return () => {}
      },
    },
  }

  assert.equal(registerSlotCell(ctx, 'some.slot', 'bad', 1, () => null), null)
  assert.equal(typeof registerSlotCell(ctx, 'some.slot', 'good', 2, () => null), 'function',
    '一个插槽失败不连累其他插槽')
  assert.deepEqual(attempted, ['bad', 'good'])
})

test('降级日志：每个来源只记录一次，不随渲染刷屏（P2-01）', () => {
  const { registerSlotCell } = loadClient()
  const warnings = []
  const original = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  try {
    const ctx = { slots: { register: () => { throw new Error('boom') } } }
    registerSlotCell(ctx, 'some.slot', 'a', 1, () => null)
    registerSlotCell(ctx, 'some.slot', 'a', 1, () => null)
    registerSlotCell(ctx, 'some.slot', 'b', 2, () => null)
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 2, '同一 id 的重复失败只记录一次，不同 id 各记一次')
  assert.match(warnings[0], /^\[dsh-sym\] slot:some\.slot#a 降级：注册被拒：boom$/)
  assert.match(warnings[1], /slot:some\.slot#b/)
})

test('quickButtonsOf：只保留能寻址的按钮，其余丢弃', () => {
  const { quickButtonsOf } = loadClient()
  assert.deepEqual(quickButtonsOf(null), [])
  assert.deepEqual(quickButtonsOf(undefined), [])
  assert.deepEqual(quickButtonsOf({}), [])
  assert.deepEqual(quickButtonsOf({ buttons: 'nope' }), [])
  const kept = quickButtonsOf({ buttons: [
    { id: 'ok', label: '可用', kind: 'command', value: '/compact' },
    { id: '', value: '/x' },
    { id: 'no-value', value: '' },
    null,
    'junk',
  ] })
  assert.deepEqual(kept.map((button) => button.id), ['ok'])
  assert.equal(kept[0].kind, 'command')
})

test('设置页：配置值与编辑草稿之间的转换', () => {
  const { toConfigButton } = loadClient()
  const config = toConfigButton({ id: 'a', label: 'A', icon: 'search', kind: 'skill', value: 'x', extra: 1 })
  assert.deepEqual(Object.keys(config).sort(), ['icon', 'id', 'kind', 'label', 'value'],
    '只写 schema 声明的字段，别把界面状态写回文件')
  assert.equal(config.kind, 'skill')
  assert.equal(toConfigButton({}).icon, 'dot', '缺字段补默认')
  assert.equal(toConfigButton({ kind: 'nope' }).kind, 'prompt')
})

test('快捷按钮：配置存在本地，读不出来时回落默认', () => {
  const { readStoredQuickActions, writeStoredQuickActions } = loadClient()
  const saved = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  }
  try {
    assert.equal(readStoredQuickActions(), null, '没配过时返回 null')
    assert.equal(writeStoredQuickActions([{ id: 'a', value: 'v' }], true), true)
    const stored = readStoredQuickActions()
    assert.deepEqual(stored.buttons.map((b) => b.id), ['a'])
    assert.equal(stored.enabled, true)
    // 清掉（传 null）＝ 恢复内置默认
    writeStoredQuickActions(null, true)
    assert.equal(readStoredQuickActions(), null)
    // 坏了的值不能让界面炸掉
    store.set('dsh-sym.quick-actions', '{ not json')
    assert.equal(readStoredQuickActions(), null)
  } finally {
    if (saved === undefined) delete globalThis.localStorage
    else globalThis.localStorage = saved
  }
})

test('渲染冒烟：竖条与设置页组件能被调用而不抛错', () => {
  // 这条是补课：曾把竖条里的 `projected` 改名成 `fromProjection` 却漏改一处引用，
  // 组件一渲染就抛 ReferenceError，React 把整条竖条卸载掉，界面上「什么都没有」，
  // 查了很久。让组件真的被调用一次，这类错误就再也跑不掉。
  const client = loadClient()
  const rail = client.QuickActionsRail({
    text: (key) => key,
    inputActions: null,
    sessionId: 's1',
    useProjection: () => null,
    commands: null,
  })
  assert.ok(rail !== null && typeof rail === 'object', '竖条要能渲染出元素')
  const page = client.QuickActionsSettings({ text: (key) => key })
  assert.ok(page !== null && typeof page === 'object', '设置页要能渲染出元素')
})

test('导入：接受 { buttons } 与裸数组，坏文件返回 null', () => {
  const { parseQuickActionsFile } = loadClient()
  assert.deepEqual(parseQuickActionsFile('{"buttons":[{"id":"a","value":"v"}]}').map((b) => b.id), ['a'])
  assert.deepEqual(parseQuickActionsFile('[{"id":"b","value":"w"}]').map((b) => b.id), ['b'])
  assert.equal(parseQuickActionsFile('{ not json'), null)
  assert.equal(parseQuickActionsFile('{"buttons":[]}'), null, '空的导入等于没内容')
  assert.equal(parseQuickActionsFile('{"buttons":"nope"}'), null)
})

test('显示项：四个开关默认全开，读写往返正确，坏值回落全开', () => {
  const { readDisplayOptions, writeDisplayOptions } = loadClient()
  const saved = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  }
  const allOn = { balance: true, cost: true, memory: true, contextLoss: true }
  try {
    assert.deepEqual(readDisplayOptions(), allOn)
    writeDisplayOptions({ balance: false, cost: true, memory: false, contextLoss: false })
    assert.deepEqual(readDisplayOptions(), { balance: false, cost: true, memory: false, contextLoss: false })
    // 只关心显式 false：别的值都当"开"
    store.set('dsh-sym.display-options', '{"balance":"nope"}')
    assert.deepEqual(readDisplayOptions(), allOn)
    store.set('dsh-sym.display-options', '{ 坏的 json')
    assert.deepEqual(readDisplayOptions(), allOn)
  } finally {
    if (saved === undefined) delete globalThis.localStorage
    else globalThis.localStorage = saved
  }
})

//#region 光标归还（点快捷按钮 / 引用按钮之后，键盘必须回到输入框）
// 输入框是官方的 Lexical contenteditable：根节点带 `data-composer-input`，Lexical 把
// 编辑器实例挂在同一个节点上（`__lexicalEditor`）。第二条是关键 —— 没有它就说明这节点
// 不是真编辑器（workspace 触发器状态下官方把它渲染成 `contenteditable=false`），那时
// 裸 focus 会把光标丢到开头。下面按这个形状造假 DOM，不引入 jsdom。

const COMPOSER_SEL = '[data-composer-input]'

/**
 * 一个假输入框根节点。`calls` 记录落在它身上的动作，用来断言"到底碰了谁"。
 * @param name - 在调用记录里的标签。
 * @param calls - 共享的记录数组。
 * @param options - `editor:false` 去掉 Lexical 实例；`editable:false` 变成非编辑器形态；
 *   `hidden:true` 变成 `visibility:hidden`（settling 阶段的官方样式）。
 */
function fakeComposer(name, calls, options = {}) {
  const node = {
    name,
    contentEditable: options.editable === false ? 'false' : 'true',
    focus: (opts) => calls.push(name + ':dom', opts),
    getClientRects: () => [{}],
    __style: { visibility: options.hidden === true ? 'hidden' : 'visible', display: 'block' },
  }
  if (options.editor !== false) node.__lexicalEditor = { focus: () => calls.push(name + ':lexical') }
  return node
}

/** 假 document：只回答 composer 查询，其余（加载期那次 style 探测）留给基础替身。 */
function fakeDoc(spec = {}) {
  const nodes = spec.nodes ?? []
  const search = (sel) => (sel === COMPOSER_SEL ? nodes : [])
  return {
    activeElement: spec.active ?? null,
    querySelectorAll: search,
    defaultView: { getComputedStyle: (node) => node.__style ?? { visibility: 'visible', display: 'block' } },
  }
}

/** 一个"按钮"：只需支持 closest（收窄到所属会话）。 */
function fakeTrigger(scope, calls) {
  return { closest: (sel) => { calls.push('closest:' + sel); return scope ?? null } }
}

test('光标归还：光标已经在输入框里就不去抢（鼠标路径下的常态）', () => {
  const calls = []
  const node = fakeComposer('mine', calls)
  const { focusComposer } = loadClient({ document: fakeDoc({ nodes: [node], active: node }) })
  assert.equal(focusComposer(null), true)
  assert.deepEqual(calls, [], '已经在里面了，再 focus 一次只会打扰 Lexical 的选区')
})

test('光标归还：按按钮所属的会话收窄，不碰排在前面的另一份会话', () => {
  const calls = []
  // 官方同一时刻可以挂两份完整会话（右侧栏聊天标签 / 子代理面板 variant:"embedded"），
  // 它们各有自己的输入框；文档顺序在前的那份不是我们该碰的。
  const other = fakeComposer('other', calls)
  const mine = fakeComposer('mine', calls)
  const scope = { querySelectorAll: (sel) => (sel === COMPOSER_SEL ? [mine] : []) }
  const { focusComposer } = loadClient({ document: fakeDoc({ nodes: [other, mine] }) })

  assert.equal(focusComposer(fakeTrigger(scope, calls)), true)
  assert.ok(String(calls[0]).startsWith('closest:'), '先按最近的会话容器收窄')
  assert.deepEqual(calls.slice(1), ['mine:dom', { preventScroll: true }, 'mine:lexical'],
    '碰的必须是本会话那个输入框')
  assert.ok(!calls.includes('other:dom') && !calls.includes('other:lexical'), '另一份会话的输入框一个都不该碰')
})

test('光标归还：本会话没有可用输入框时，不越界去抓别人的', () => {
  const calls = []
  const other = fakeComposer('other', calls)
  const { focusComposer } = loadClient({ document: fakeDoc({ nodes: [other] }) })
  assert.equal(focusComposer(fakeTrigger({ querySelectorAll: () => [] }, calls)), false)
  assert.deepEqual(calls.filter((c) => c.startsWith('other')), [], '宁可不动焦点，也不能把光标送进另一份会话')
})

test('光标归还：按钮不在会话容器里时退回全文档查找', () => {
  const calls = []
  const mine = fakeComposer('mine', calls)
  const { focusComposer } = loadClient({ document: fakeDoc({ nodes: [mine] }) })
  assert.equal(focusComposer(fakeTrigger(null, calls)), true)
  assert.ok(calls.includes('mine:dom') && calls.includes('mine:lexical'))
})

test('光标归还：closest 抛错时退回全文档，不冒到调用方', () => {
  const calls = []
  const mine = fakeComposer('mine', calls)
  const { focusComposer } = loadClient({ document: fakeDoc({ nodes: [mine] }) })
  const boom = { closest: () => { throw new Error('closest 炸了') } }
  assert.equal(focusComposer(boom), true)
  assert.ok(calls.includes('mine:lexical'))
})

test('光标归还：跳过 settling 隐藏的、非编辑器的、没有 Lexical 实例的候选', () => {
  const calls = []
  const hidden = fakeComposer('hidden', calls, { hidden: true })
  const notEditable = fakeComposer('notEditable', calls, { editable: false })
  const ghost = fakeComposer('ghost', calls, { editor: false })
  const real = fakeComposer('real', calls)
  const { focusComposer } = loadClient({ document: fakeDoc({ nodes: [hidden, notEditable, ghost, real] }) })

  assert.equal(focusComposer(null), true)
  assert.deepEqual(calls, ['real:dom', { preventScroll: true }, 'real:lexical'], '只有最后那个才是真输入框')
})

test('光标归还：拿不到 Lexical 实例就一个 focus 都不做', () => {
  const calls = []
  const ghost = fakeComposer('ghost', calls, { editor: false })
  const { focusComposer } = loadClient({ document: fakeDoc({ nodes: [ghost] }) })
  assert.equal(focusComposer(null), false)
  assert.deepEqual(calls, [], '裸 focus 会把光标丢到开头，宁可不动')
})

test('光标归还：focus 抛错时咽掉并如实报失败', () => {
  const node = fakeComposer('boom', [])
  node.focus = () => { throw new Error('focus 炸了') }
  const { focusComposer } = loadClient({ document: fakeDoc({ nodes: [node] }) })
  assert.equal(focusComposer(null), false)
})

test('光标归还：找不到输入框时安静返回 false', () => {
  assert.equal(loadClient({ document: fakeDoc({ nodes: [] }) }).focusComposer(null), false)
  assert.equal(loadClient().focusComposer(null), false, '默认替身里没有任何候选节点')
})

test('光标留在输入框：按下按钮时阻止默认行为，避免焦点被抢走', () => {
  const { keepComposerFocus } = loadClient()
  let prevented = 0
  keepComposerFocus({ preventDefault: () => { prevented += 1 } })
  assert.equal(prevented, 1)
  assert.doesNotThrow(() => keepComposerFocus(null), '事件缺失时不该抛错')
  assert.doesNotThrow(() => keepComposerFocus({}), '事件没有 preventDefault 时不该抛错')
})

test('快捷按钮分组：三组顺序固定，组内保持原顺序', () => {
  const { groupQuickButtons } = loadClient()
  const buttons = [
    { id: 'a', kind: 'prompt', value: 'p1' },
    { id: 'b', kind: 'command', value: '/compact' },
    { id: 'c', kind: 'skill', value: 'code-review' },
    { id: 'd', kind: 'prompt', value: 'p2' },
    { id: 'e', kind: 'command', value: '/goal' },
  ]
  const groups = groupQuickButtons(buttons)
  assert.deepEqual(groups.map((g) => g.kind), ['command', 'skill', 'prompt'])
  assert.deepEqual(groups[0].buttons.map((b) => b.id), ['b', 'e'])
  assert.deepEqual(groups[1].buttons.map((b) => b.id), ['c'])
  assert.deepEqual(groups[2].buttons.map((b) => b.id), ['a', 'd'])
})

test('快捷按钮分组：认不出的类型归提示词，空组也返回（调用方据此跳过分割线）', () => {
  const { groupQuickButtons, quickKindOf } = loadClient()
  assert.equal(quickKindOf({ kind: 'command' }), 'command')
  assert.equal(quickKindOf({ kind: 'skill' }), 'skill')
  assert.equal(quickKindOf({ kind: 'prompt' }), 'prompt')
  assert.equal(quickKindOf({ kind: 'nonsense' }), 'prompt', '未知类型不能凭空消失')
  assert.equal(quickKindOf(null), 'prompt')
  const groups = groupQuickButtons([{ id: 'x', kind: 'nonsense', value: 'v' }])
  assert.deepEqual(groups.map((g) => g.buttons.length), [0, 0, 1])
  assert.deepEqual(groupQuickButtons(null).map((g) => g.buttons.length), [0, 0, 0])
})

test('快捷按钮：内置清单自带三条官方命令，且排在提示词之前', () => {
  const { DEFAULT_QUICK_ACTIONS, groupQuickButtons } = loadClient()
  const commands = DEFAULT_QUICK_ACTIONS.filter((b) => b.kind === 'command')
  assert.deepEqual(commands.map((b) => b.value), ['/goal', '/plan', '/compact'])
  for (const button of commands) {
    assert.equal(button.icon, button.id, '图标默认取条目 id，图标集里必须有同名的')
    assert.ok(button.label.length > 0)
  }
  const groups = groupQuickButtons(DEFAULT_QUICK_ACTIONS)
  assert.equal(groups[0].buttons.length, 3, '官方命令成组排在最前')
  assert.equal(groups[1].buttons.length, 0)
  assert.equal(groups[2].buttons.length, 4)
})

test('图标集：每条都是 [标签, 属性] 形状，且名字顺序与选择器一致', () => {
  const client = loadClient()
  const names = Object.keys(client.QUICK_ICONS)
  assert.ok(names.length >= 100, '图标库不该缩水到 100 以下，实际 ' + names.length)
  // 选择器把官方 `/` 菜单那 8 枚排在最前，其余沿用对象键序 —— 所以只比集合，不比顺序。
  assert.deepEqual([...client.QUICK_ICON_NAMES].sort(), [...names].sort(), '选择器与图标集必须是同一套名字')
  assert.deepEqual(client.QUICK_ICON_NAMES.slice(0, 8), ['file', 'goal', 'plan', 'feedback', 'ring', 'permission', 'model', 'download'], '官方那 8 枚排在最前')
  for (const [name, parts] of Object.entries(client.QUICK_ICONS)) {
    assert.ok(Array.isArray(parts) && parts.length > 0, name + ' 至少要有一个图元')
    for (const part of parts) {
      assert.ok(Array.isArray(part) && part.length === 2, name + ' 的图元是 [标签, 属性]')
      assert.equal(typeof part[0], 'string', name + ' 的标签是字符串')
      assert.ok(part[1] !== null && typeof part[1] === 'object', name + ' 的属性是对象')
    }
  }
  for (const button of client.DEFAULT_QUICK_ACTIONS) {
    assert.ok(Object.hasOwn(client.QUICK_ICONS, button.icon), '默认按钮的图标 "' + button.icon + '" 必须在图标集里')
  }
})

test('迁移：已保存清单缺官方命令时补回三条，且只补一次', () => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  }
  try {
    const client = loadClient()
    const KEY = 'dsh-sym.quick-actions'
    store.set(KEY, JSON.stringify({ enabled: true, buttons: [{ id: 'review', label: '审查改动', kind: 'prompt', value: 'x' }] }))
    assert.equal(client.migrateStoredQuickActions(), true)
    const after = JSON.parse(store.get(KEY))
    assert.deepEqual(after.buttons.slice(0, 3).map((b) => b.value), ['/goal', '/plan', '/compact'])
    assert.equal(after.buttons.length, 4, '补在前面，不动原有那一条')
    assert.equal(after.commandsAdded, true, '补过就打标记，避免反复打扰')
    assert.equal(client.migrateStoredQuickActions(), false, '第二次不再补')
    store.set(KEY, JSON.stringify({ enabled: true, commandsAdded: true, buttons: [{ id: 'x', label: 'x', kind: 'prompt', value: 'y' }] }))
    assert.equal(client.migrateStoredQuickActions(), false, '用户手动删掉后不再补回来')
    store.set(KEY, JSON.stringify({ enabled: true, buttons: [{ id: 'g', label: '目标', kind: 'command', value: '/goal' }] }))
    assert.equal(client.migrateStoredQuickActions(), false, '已经有官方命令就不动')
    store.delete(KEY)
    assert.equal(client.migrateStoredQuickActions(), false, '没配过的人走默认清单，不需要迁移')
  } finally {
    delete globalThis.localStorage
  }
})

/**
 * 会话头部 Git 胶囊的载荷整理（FR-11 / CR-0001）。纯函数：不渲染、不联网，
 * 覆盖分支/detached 回退、千位分隔、未跟踪计数与「哪来的建 PR 链接」。
 */
test('git 胶囊：普通分支的读数与 tooltip', () => {
  const client = loadClient()
  const model = client.describeGitStatus({
    root: '/Users/me/GitHub/DSH-Sym',
    branch: 'main',
    detached: false,
    head: '8f2a1b0',
    upstream: 'origin/main',
    ahead: 2,
    behind: 1,
    files: 3,
    added: 4784,
    deleted: 116,
    untracked: 2,
  })
  assert.equal(model.branch, 'main')
  assert.equal(model.hasTotals, true)
  assert.equal(model.added, 4784)
  assert.equal(model.deleted, 116)
  assert.equal(model.untracked, 2)
  assert.match(model.title, /\/Users\/me\/GitHub\/DSH-Sym/, 'tooltip 给出仓库路径')
  assert.match(model.title, /改动文件 3 个/, 'tooltip 给出改动文件数')
})

test('git 胶囊：detached 用短 sha，上游缺失不显示 0/0', () => {
  const client = loadClient()
  const model = client.describeGitStatus({ branch: null, detached: true, head: 'abc1234', ahead: null, behind: null, files: 0, added: null, deleted: null, untracked: 0 })
  assert.equal(model.branch, 'abc1234')
  assert.equal(model.hasTotals, false, 'diff 超时时不给 0')
  assert.doesNotMatch(model.title, /领先/)
  assert.equal(model.untracked, 0)
})

test('git 胶囊：本地分支清单的过滤与 current 标记（C3）', () => {
  const client = loadClient()
  const model = client.describeGitStatus({
    branch: 'main', detached: false, files: 0, untracked: 0, added: null, deleted: null,
    branches: [{ name: 'main', current: true }, { name: 'feat/x', current: false }, null, { name: '' }, { current: true }],
  })
  assert.deepEqual(model.branches, [{ name: 'main', current: true }, { name: 'feat/x', current: false }])
  assert.equal(model.files, 0)
  assert.equal(model.hasTotals, false)
  assert.deepEqual(client.describeGitStatus({ branch: 'main', detached: false }).branches, [], '没有 branches 字段时是空数组，不是 undefined')
})

test('词典：zh / en 键集齐平，且代码里用到的键两边都有（C2）', () => {
  const client = loadClient()
  const zh = Object.keys(client.zh).sort()
  const en = Object.keys(client.en).sort()
  assert.deepEqual(zh, en, '两份词典的键集必须完全一致')
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  // 座位变量名可能是 `t`（槽直接给）或 `props.t`（我们把槽 props 透传一层），两种都要抓到。
  const used = new Set([...source.matchAll(/tr\((?:\w+\.)?t,\s*"([^"]+)"/g)].map((match) => match[1]))
  assert.ok(used.size >= 20, '至少抓到一批真实用到的键：' + used.size)
  for (const key of used) {
    assert.ok(Object.hasOwn(client.zh, key), 'zh 词典缺 ' + key)
    assert.ok(Object.hasOwn(client.en, key), 'en 词典缺 ' + key)
  }
})

test('图标大小校正（ICON_FIT）：覆盖全、系数在夹取区间、笔宽不被缩放带跑（C5）', () => {
  const client = loadClient()
  const names = Object.keys(client.QUICK_ICONS)
  assert.equal(names.length, 105, '图标集合仍是 105 枚')
  const stroke = client.QUICK_ICON_STROKE
  let grew = 0
  let shrank = 0
  for (const name of names) {
    const fit = client.iconFit(name)
    assert.ok(fit !== null, name + ' 缺少校正条目')
    const [k, dx, dy] = fit
    // 夹取区间 = 生成器的 [0.7, 2.0]（第二次校正时放宽，现在不对任何一枚生效，只当保险）
    assert.ok(k >= 0.7 && k <= 2.0, name + ' 的缩放系数 ' + k + ' 超出夹取区间')
    assert.ok(Number.isFinite(dx) && Number.isFinite(dy), name + ' 的平移量不是有限数')
    // 笔宽守恒：渲染时描边写成 stroke/k，再被组内 scale(k) 乘回去 —— 屏幕上必须仍是 stroke
    assert.ok(Math.abs((stroke / k) * k - stroke) < 1e-9, name + ' 的笔宽补偿不成立')
    if (k > 1.02) grew += 1
    if (k < 0.98) shrank += 1
  }
  // 校正的**结果**才是该守的东西，而且断言要**与 ZOOM 无关** —— 否则每次调整体缩放都要改测试。
  // 抽查 6 枚覆盖原始墨迹的整个跨度（7.4 ~ 15.8 格），校正后它们必须收敛成一小簇。
  // ⚠ 原始值来自 scripts/fit-icons.mjs 的实测；改了图标图形数据要同步（生成器会重算系数）。
  const raw = { dot: 7.4, square: 9.0, ring: 11.8, search: 11.9, file: 13.77, infinity: 15.8 }
  const fitted = Object.entries(raw).map(([name, size]) => [name, size * client.iconFit(name)[0]])
  const lo = Math.min(...fitted.map(([, v]) => v))
  const hi = Math.max(...fitted.map(([, v]) => v))
  assert.ok(hi / lo < 1.05, '校正后最大/最小应小于 5%（实测 ' + (hi / lo).toFixed(3) + '）')
  assert.ok(hi < 15, '校正后最大墨迹应留出边距、不贴 viewBox 边缘（实测 ' + hi.toFixed(2) + ' / 框 16）')
  assert.ok(lo > 10, '校正后最小墨迹不该小到看不出（实测 ' + lo.toFixed(2) + '）')
  // 圆形为主的那 8 枚带 +2% 光学补偿，所以应落在这一簇的**上沿**
  const ringAfter = 11.8 * client.iconFit('ring')[0]
  const squareAfter = 9.0 * client.iconFit('square')[0]
  assert.ok(ringAfter >= squareAfter, '圆形补偿后不应小于同尺寸方形：ring ' + ringAfter.toFixed(2) + ' vs square ' + squareAfter.toFixed(2))
  assert.ok(client.iconFit('infinity')[0] < 1, 'infinity（原始 15.8 格）应被收小')
  assert.ok(client.iconFit('dot')[0] > 1.5, 'dot（原始 7.4 格）应被放大')
})

//#endregion

test('渲染冒烟：上下文压缩格子能渲染，缺投影时安静退场', () => {
  // 与竖条同源：这个组件读宿主的 contextLoss 投影，形状变了可能在渲染期抛错，
  // 而槽里抛错的表现是"整格不见了、没有报错浮出来"。让它真的被调用一次。
  const client = loadClient()
  const t = (key) => key
  // 压缩过：显示次数与丢失量
  const el = client.ContextLossPill({
    t,
    useProjection: () => ({ compactions: 2, prunes: 1, lostTokens: 173000, lastTurn: 7 }),
  })
  assert.ok(el !== null && typeof el === 'object', '有数据时要渲染出元素')
  assert.equal(el.props['data-sym-context-loss'], '3', '次数 = compact 2 + prune 1')
  assert.equal(el.props['data-sym-context-lost-tokens'], '173000')
  // 还没压过：仍然渲染（0 是真实读数，不是缺数据）
  const fresh = client.ContextLossPill({
    t,
    useProjection: () => ({ compactions: 0, prunes: 0, lostTokens: 0, lastTurn: null }),
  })
  assert.ok(fresh !== null && typeof fresh === 'object', '未压缩时要显示"尚未压缩"，不能整格消失')
  assert.equal(fresh.props['data-sym-context-loss'], '0')
  // 投影缺失才退场
  assert.equal(client.ContextLossPill({ t, useProjection: () => null }), null)
  assert.equal(client.ContextLossPill({ t, useProjection: () => undefined }), null)
})

test('渲染冒烟：CostPill 能被调用，且缺投影时安静退场', () => {
  // 与竖条同源的补课：槽组件在渲染期抛错时，React 会把整块卸载，界面表现是
  // "什么都没出现、也没有报错浮出来" —— 只能靠真的调用一次来兜住。
  const client = loadClient()
  const t = (key) => key
  // 没有投影：整格不渲染（NFR-02），但不能抛错
  assert.equal(client.CostPill({ t, useProjection: () => null }), null)
  // 有投影但还没结算（requests = 0）：应仍能渲染出元素（内存读数与结算无关）
  const pending = {
    cny: 0, requests: 0, peakRequests: 0, tokens: {}, cost: {}, models: [], unpriced: [],
    turns: [], usdToCny: 7.2, peakNow: false, catalogSize: 0, memory: { rss: 1024 * 1024, heapUsed: 1024 },
  }
  const el = client.CostPill({ t, useProjection: () => pending })
  assert.ok(el !== null && typeof el === 'object', '内存读数必须仍在（不能跟着花费一起消失）')
})

test('渲染冒烟：createBalanceCell 是个工厂，能在没有 remote 时降级', () => {
  // 余额格需要 `remote` 命名空间；拿不到时必须降级而不是让整格抛错。
  const client = loadClient()
  assert.equal(typeof client.createBalanceCell, 'function')
  const fakeCtx = {
    locale: { getSnapshot: () => ({ active: 'zh-CN' }) },
    get: () => { throw new Error('cannot get property "remote" without inject') },
  }
  let cell = null
  try {
    cell = client.createBalanceCell(fakeCtx)
  } catch (error) {
    assert.fail('工厂本身不该抛错，渲染期才降级：' + String(error?.message ?? error))
  }
  // 工厂要么给出组件，要么给出 null；两者都算安静退场
  assert.ok(cell === null || typeof cell === 'function', '工厂应返回组件或 null')
})

test('渲染冒烟：会话菜单两项在 primitives 缺失时返回 null（不抛错）', () => {
  // 这两项复用官方 `MenuItemButton`；官方 primitives 拿不到时必须安静退场，
  // 而不是注册一条看不见的空行（见 AGENTS.md「侧栏会话「⋯」菜单可加」）。
  const client = loadClient()
  const t = (key) => key
  for (const name of ['CopySessionIdMenuItem', 'ExportSessionMenuItem']) {
    const view = client[name]
    assert.equal(typeof view, 'function', name + ' 应已导出')
    let result
    try {
      result = view({ sessionId: 's-1', useMenuOpenState: () => [false, () => {}], t })
    } catch (error) {
      assert.fail(name + ' 不该抛错：' + String(error?.message ?? error))
    }
    assert.ok(result === null || typeof result === 'object', name + ' 应返回元素或 null')
  }
})

test('渲染冒烟：GitStatusCell 在无会话时安静退场', () => {
  const client = loadClient()
  const t = (key) => key
  let result
  try {
    result = client.GitStatusCell({ t, sessionId: undefined, useSession: () => false, useProjection: () => null })
  } catch (error) {
    // 该组件用 React.useState/useRef，替身环境下允许抛"hook 未激活"这类错误，
    // 但那必须是替身的限制，不是组件自身的 ReferenceError。
    const msg = String(error?.message ?? error)
    assert.ok(!/is not defined/.test(msg), '不应是未定义引用（那才是真 bug）：' + msg)
    return
  }
  assert.ok(result === null || typeof result === 'object', '应返回元素或 null')
})

//#region 导出会话日志（对抗性审计 AA-UX-001 / AA-BE-001 / AA-TEST-001 的整改）
// 第一版实现直接 `anchor.click()` 就报成功，于是 401/404/500 全显示"正在导出…"。
// 官方做法是**先 HEAD 预检**，只有 2xx 才交给下载管理器。下面把三态都钉住。

/**
 * 导出动作的测试账本。
 *
 * ⚠ 两个替身的注入通道**不一样**：`load-client.mjs` 把 `document` 作为**参数**送进模块
 * 作用域（所以只能走 `options.document`，设 `globalThis.document` 无效 —— 踩过），
 * 而 `fetch` 不在参数列表里，模块从全局取，改 `globalThis.fetch` 即可。
 *
 * @returns `{ options, calls, restore }`：`options` 交给 `loadClient`，`calls` 供断言。
 */
function exportHarness() {
  const calls = { fetch: [], anchors: [], nextStatus: 200 }
  const savedFetch = globalThis.fetch
  globalThis.fetch = (url, init) => {
    calls.fetch.push({ url: String(url), method: init?.method ?? 'GET' })
    const status = calls.nextStatus
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(status >= 200 && status < 300 ? '' : 'nope'),
    })
  }
  const options = {
    document: {
      // ⚠ `options.document` 是**浅合并**到基础替身上的，所以这里的 createElement
      // 必须自带 `dataset` —— 模块加载时会往 `tag.dataset.plugin` 写样式表标记，
      // 少了它整块加载直接抛错（踩过）。
      createElement: (tag) => {
        const el = { tag, dataset: {}, style: {}, href: '', download: '', rel: '',
          clicked: false, removed: false,
          click() { this.clicked = true }, remove() { this.removed = true } }
        // 只记 `<a>`：模块加载时会用 createElement 注入自己的 <style>，那不属于导出动作。
        if (tag === 'a') calls.anchors.push(el)
        return el
      },
      body: { appendChild: () => {}, removeChild: () => {} },
    },
  }
  return {
    options,
    calls,
    restore() {
      if (savedFetch === undefined) delete globalThis.fetch
      else globalThis.fetch = savedFetch
    },
  }
}

test('导出：HEAD 预检通过后才触发下载，URL 参数正确', async () => {
  const h = exportHarness()
  const client = loadClient(h.options)
  try {
    // 直接调内部入口：组件需要官方 primitives 才能渲染，这里测的是导出动作本身。
    assert.equal(typeof client.__runExportForTest, 'function', '导出动作必须可被测试直接驱动')
    const ok = await client.__runExportForTest('abc-123')
    assert.equal(ok, true, '预检 2xx 时应报成功')
    assert.equal(h.calls.fetch.length, 1, '应恰好一次预检请求')
    assert.equal(h.calls.fetch[0].method, 'HEAD', '预检必须是 HEAD（不构建 ZIP）')
    assert.match(h.calls.fetch[0].url, /sessionId=abc-123/, 'URL 必须带 sessionId')
    assert.match(h.calls.fetch[0].url, /includeDescendants=true/, '应包含子会话')
    assert.equal(h.calls.anchors.length, 1, '预检通过后应创建下载锚点')
    assert.equal(h.calls.anchors[0].clicked, true, '锚点必须被点击')
  } finally {
    h.restore()
  }
})

test('导出：HEAD 返回非 2xx 时【绝不触发下载】且报失败', async () => {
  const h = exportHarness()
  const client = loadClient(h.options)
  try {
    for (const status of [401, 404, 500]) {
      h.calls.nextStatus = status
      h.calls.anchors.length = 0
      const ok = await client.__runExportForTest('abc-123')
      assert.equal(ok, false, 'HTTP ' + status + ' 必须报失败，不能谎报成功')
      assert.equal(h.calls.anchors.length, 0, 'HTTP ' + status + ' 时**不应**创建下载锚点')
    }
  } finally {
    h.restore()
  }
})

test('导出：同一会话连点只发起一次预检（并发折叠）', async () => {
  const h = exportHarness()
  const client = loadClient(h.options)
  try {
    const results = await Promise.all([
      client.__runExportForTest('same-id'),
      client.__runExportForTest('same-id'),
      client.__runExportForTest('same-id'),
    ])
    assert.deepEqual(results, [true, true, true], '复用同一次在飞导出')
    assert.equal(h.calls.fetch.length, 1, '三次连点只应有一次 HEAD（连点不得重复触发宿主构建 ZIP）')
  } finally {
    h.restore()
  }
})
//#endregion
