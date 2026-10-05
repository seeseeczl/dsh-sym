import { test } from 'node:test'
import assert from 'node:assert/strict'
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

test('显示项：三个开关默认全开，读写往返正确，坏值回落全开', () => {
  const { readDisplayOptions, writeDisplayOptions } = loadClient()
  const saved = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  }
  try {
    assert.deepEqual(readDisplayOptions(), { balance: true, cost: true, memory: true })
    writeDisplayOptions({ balance: false, cost: true, memory: false })
    assert.deepEqual(readDisplayOptions(), { balance: false, cost: true, memory: false })
    // 只关心显式 false：别的值都当"开"
    store.set('dsh-sym.display-options', '{"balance":"nope"}')
    assert.deepEqual(readDisplayOptions(), { balance: true, cost: true, memory: true })
    store.set('dsh-sym.display-options', '{ 坏的 json')
    assert.deepEqual(readDisplayOptions(), { balance: true, cost: true, memory: true })
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
