import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isPeakTime, expandQuoteMarks, rememberProse, proseOfMessage, readProcessMemory,
  DEEPSEEK_CNY, DEFAULT_USD_TO_CNY,
  QUICK_ACTIONS_KEY, DEFAULT_QUICK_ACTIONS, normalizeQuickActions,
  createQuickActionsProjection, buttonsFromConfig, Config,
  GIT_STATUS_ROUTE, parseGitStatus, parseNumstatTotals, parseBranches, createGitStatusReader, gitStatusRoute,
} from '../lib/host-v18.js'

/** Beijing wall-clock on 2026-09-30 (a Wednesday) as epoch ms. */
const bj = (y, m, d, hh, mm = 0) => Date.UTC(y, m - 1, d, hh - 8, mm)

test('isPeakTime: 峰时窗口的边界（含端点内、端点外）', () => {
  const before = new Set()
  assert.equal(isPeakTime(bj(2026, 9, 30, 8, 59), before), false, '08:59 应为谷时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 9, 0), before), true, '09:00 应为峰时（含起点）')
  assert.equal(isPeakTime(bj(2026, 9, 30, 11, 59), before), true, '11:59 仍为峰时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 12, 0), before), false, '12:00 应为谷时（峰段结束）')
  assert.equal(isPeakTime(bj(2026, 9, 30, 13, 59), before), false, '13:59 仍为谷时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 14, 0), before), true, '14:00 应为峰时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 17, 59), before), true, '17:59 仍为峰时')
  assert.equal(isPeakTime(bj(2026, 9, 30, 18, 0), before), false, '18:00 应为谷时')
})

test('isPeakTime: 周末全天谷时', () => {
  const before = new Set()
  assert.equal(isPeakTime(bj(2026, 10, 3, 10, 0), before), false, '周六上午应为谷时')
  assert.equal(isPeakTime(bj(2026, 10, 4, 15, 0), before), false, '周日下午应为谷时')
})

test('isPeakTime: 节假日表内的日期全天谷时', () => {
  const holidays = new Set(['2026-10-01'])
  assert.equal(isPeakTime(bj(2026, 10, 1, 10, 0), holidays), false, '国庆当天应为谷时')
  assert.equal(isPeakTime(bj(2026, 10, 2, 10, 0), holidays), true, '不在表内则按工作日算')
})

test('proseOfMessage：提取可见正文，忽略推理与工具块', () => {
  const message = { content: [
    { type: 'text', text: '第一段' },
    { type: 'reasoning', text: '不应出现' },
    { type: 'tool-call', name: 'x' },
    { type: 'text', text: '第二段' },
  ] }
  assert.equal(proseOfMessage(message), '第一段\n\n第二段')
  assert.equal(proseOfMessage({ content: [{ type: 'reasoning', text: 'only reasoning' }] }), null)
  assert.equal(proseOfMessage({}), null, '没有 content 数组时应为 null')
  assert.equal(proseOfMessage(null), null, 'null 入参不应抛错')
})

test('引用：标记能展开成被引用的正文', () => {
  const id = 'abcdef1234567890'
  // The client writes the hyphen-free first twelve hex characters.
  rememberProse(id, '这是被引用的那一段正文。')
  const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `请参考 @引用#${id.slice(0, 12)} 的做法` }] }])
  assert.equal(out.length, 1)
  assert.match(out[0].content[0].text, /这是被引用的那一段正文。/)
  assert.doesNotMatch(out[0].content[0].text, /@引用#/, '标记本身应被替换掉')
})

test('引用：未知 id 保留标记，且不再产生新批次（AUD-LOGIC-001）', () => {
  // A mark that cannot be resolved is written back verbatim, so nothing was
  // actually substituted and the batch must not be copied. The caller keeps its
  // original decision object.
  const input = [{ role: 'user', content: [{ type: 'text', text: '参考 @引用#ffffffffffff 的做法' }] }]
  assert.equal(expandQuoteMarks(input), null, '无成功替换 ⇒ 返回 null')
})

test('引用：同一批里未知 id 与已知 id 混合时，整批仍会展开', () => {
  const id = 'a1b2c3d4e5f60000'
  rememberProse(id, '已知的正文')
  const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `@引用#ffffffffffff 与 @引用#${id.slice(0, 12)}` }] }])
  assert.ok(out !== null, '有一个成功替换即算改动')
  assert.match(out[0].content[0].text, /@引用#ffffffffffff/, '未知 id 保持原样')
  assert.match(out[0].content[0].text, /已知的正文/, '已知 id 正常展开')
})

test('引用：无标记的消息返回 null，非数组入参也返回 null', () => {
  assert.equal(expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: '一条普通消息' }] }]), null)
  assert.equal(expandQuoteMarks(null), null)
  assert.equal(expandQuoteMarks('not an array'), null)
})

test('记忆索引有界：超过 400 条后最旧的无法再被引用', () => {
  // The lookup itself (`proseForPrefix`) is internal and matches by prefix, so ids
  // must differ inside their first twelve hex characters the way real message ids
  // do — a zero-padded counter would make every prefix identical.
  const mkId = (n) => (n.toString(16).padStart(12, '0') + 'ffff').slice(0, 16)
  for (let i = 0; i < 450; i += 1) rememberProse(mkId(i), 'prose-' + i)

  const oldest = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `@引用#${mkId(0).slice(0, 12)}` }] }])
  assert.equal(oldest, null, '最旧的应已被淘汰：标记解析不到 ⇒ 无替换 ⇒ null')

  const newest = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `@引用#${mkId(449).slice(0, 12)}` }] }])
  assert.match(newest[0].content[0].text, /prose-449/, '最新的应仍可展开')
  assert.doesNotMatch(newest[0].content[0].text, /@引用#/)
})

test('引用：展开结果以引用块呈现，且多段正文按行加 > 前缀', () => {
  const id = 'feedfacecafe0000'
  rememberProse(id, '第一行\n\n第二行')
  const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: `@引用#${id.slice(0, 12)}` }] }])
  const text = out[0].content[0].text
  assert.match(text, /【引用此前的回复】/)
  assert.match(text, /^> 第一行$/m)
  assert.match(text, /^>$/m, '空行应写成单独的 >')
  assert.match(text, /^> 第二行$/m)
})

test('价目常量：DeepSeek 现行价与汇率', () => {
  assert.equal(DEEPSEEK_CNY['deepseek-flash'].cacheHit, 0.04)
  assert.equal(DEEPSEEK_CNY['deepseek-flash'].cacheMiss, 2)
  assert.equal(DEEPSEEK_CNY['deepseek-flash'].output, 8)
  assert.equal(DEFAULT_USD_TO_CNY, 7)
})

test('readProcessMemory：返回字节数，且 rss 大于 0', () => {
  const mem = readProcessMemory()
  assert.ok(mem !== null, '在 Node 里应可用')
  assert.ok(mem.rss > 0 && mem.heapUsed > 0)
})

// ---------------------------------------------------------------------------
// 失败路径与非法入参（AUD-TEST-002 的整改）。代码里 return null 出现 20 次，
// 全是失败分支；下面把主要入口的失败行为固定下来。
// ---------------------------------------------------------------------------

test('失败路径：expandQuoteMarks 对非法入参一律返回 null', () => {
  assert.equal(expandQuoteMarks(null), null)
  assert.equal(expandQuoteMarks(undefined), null)
  assert.equal(expandQuoteMarks('not an array'), null)
  assert.equal(expandQuoteMarks(42), null)
  assert.equal(expandQuoteMarks({}), null)
})

test('失败路径：内容块缺失或类型异常时整条消息原样保留', () => {
  const messages = [
    { role: 'user' },                                    // 没有 content
    { role: 'user', content: 'plain string' },            // content 不是数组
    { role: 'user', content: null },
  ]
  // 无标记 ⇒ 无变化 ⇒ null（调用方保留原对象）
  assert.equal(expandQuoteMarks(messages), null)
})

test('失败路径：proseOfMessage 对各类非法入参返回 null 而不抛错', () => {
  assert.equal(proseOfMessage(null), null)
  assert.equal(proseOfMessage(undefined), null)
  assert.equal(proseOfMessage({}), null)
  assert.equal(proseOfMessage({ content: null }), null)
  assert.equal(proseOfMessage({ content: 'string' }), null)
  assert.equal(proseOfMessage({ content: [] }), null)
  assert.equal(proseOfMessage({ content: [{ type: 'text', text: '' }] }), null, '空文本不计入')
})

test('失败路径：isPeakTime 对极端时间戳不抛错', () => {
  const none = new Set()
  assert.equal(typeof isPeakTime(0, none), 'boolean')
  assert.equal(typeof isPeakTime(Number.MAX_SAFE_INTEGER, none), 'boolean')
  assert.equal(typeof isPeakTime(-1, none), 'boolean')
})

test('失败路径：引用标记格式不完整时不匹配', () => {
  rememberProse('abcdef1234567890', '正文')
  const cases = ['@引用#', '@引用#abc', '@引用', '@引用#zzzzzzzzzzzz']
  for (const text of cases) {
    const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text }] }])
    assert.equal(out, null, `「${text}」不应被视为有效标记`)
  }
})

// ---------------------------------------------------------------------------
// 快捷按钮条（conversation.input.dock 的那条横条）
// ---------------------------------------------------------------------------

test('快捷按钮：内置清单每条都能寻址，且命令按钮的值是 slash 命令', () => {
  assert.ok(DEFAULT_QUICK_ACTIONS.length >= 3 && DEFAULT_QUICK_ACTIONS.length <= 8,
    '先做三五个按钮看效果')
  for (const button of DEFAULT_QUICK_ACTIONS) {
    assert.equal(typeof button.id, 'string')
    assert.ok(button.id.length > 0, 'id 不能为空')
    assert.ok(button.label.length > 0, 'label 不能为空')
    assert.ok(button.kind === 'prompt' || button.kind === 'command')
    assert.ok(button.value.length > 0, 'value 不能为空')
    if (button.kind === 'command') assert.match(button.value, /^\//, '命令按钮的值必须以 / 开头')
  }
  const ids = DEFAULT_QUICK_ACTIONS.map((button) => button.id)
  assert.equal(new Set(ids).size, ids.length, 'id 不能重复')
})

test('快捷按钮：normalizeQuickActions 丢弃残缺记录而不整条失败', () => {
  assert.equal(normalizeQuickActions(null), null)
  assert.equal(normalizeQuickActions('nope'), null)
  assert.equal(normalizeQuickActions({}), null, '没有 buttons 数组')
  const out = normalizeQuickActions({ buttons: [
    { id: 'a', label: 'A', kind: 'command', value: '/a' },
    { id: '', value: '/x' },
    { id: 'b', value: '' },
    'junk',
    { id: 'c', value: '一段预设' },
  ] })
  assert.deepEqual(out.buttons.map((button) => button.id), ['a', 'c'])
  assert.equal(out.buttons[0].kind, 'command')
  assert.equal(out.buttons[1].kind, 'prompt', 'kind 缺省时按 prompt 处理')
  assert.equal(typeof out.buttons[0].icon, 'string')
  // 也接受裸数组
  assert.deepEqual(normalizeQuickActions([{ id: 'z', value: 'v' }]).buttons.map((b) => b.id), ['z'])
})

test('快捷按钮：投影视图按引用稳定（击穿 viewCache 会无限重渲染）', () => {
  const unit = createQuickActionsProjection()
  assert.equal(unit.key, QUICK_ACTIONS_KEY)
  assert.equal(unit.stateVersion, 1)
  const first = unit.wire.view({})
  const second = unit.wire.view({})
  assert.equal(first, second, 'view 必须返回同一引用')
  assert.equal(first.buttons, DEFAULT_QUICK_ACTIONS)
})

test('快捷按钮：state 在首个事件后只变一次（否则客户端视图永不物化）', () => {
  // 实测教训：apply 若是真正的恒等，客户端那侧的视图缓存不会建立，
  // baseline 与增量里都没有这个 key，界面表现就是「什么都没发生」。
  const unit = createQuickActionsProjection()
  const initial = unit.init({}, 0)
  const once = unit.apply(initial, { type: 'turn/start' })
  assert.notEqual(once, initial, '首个事件必须换掉 state 引用')
  assert.equal(unit.apply(once, { type: 'turn/start' }), once, '之后保持稳定')
})

test('快捷按钮：配置能覆盖默认清单，enabled:false 关掉整条 bar', () => {
  // 没配过（或 schema 把缺失的数组补成 []）→ 回落内置默认
  assert.equal(buttonsFromConfig(undefined), DEFAULT_QUICK_ACTIONS)
  assert.equal(buttonsFromConfig({}), DEFAULT_QUICK_ACTIONS)
  assert.equal(buttonsFromConfig({ buttons: [] }), DEFAULT_QUICK_ACTIONS)
  assert.equal(buttonsFromConfig({ buttons: 'nope' }), DEFAULT_QUICK_ACTIONS)
  // 显式关掉 → 一个都不显示（清空用这个开关，不靠清空数组）
  assert.deepEqual(buttonsFromConfig({ enabled: false }), [])
  assert.deepEqual(buttonsFromConfig({ enabled: false, buttons: [{ id: 'a', value: 'v' }] }), [])
  // 配置了就用配置的，并丢掉残缺项
  const configured = buttonsFromConfig({ buttons: [
    { id: 'mine', label: '我的', icon: 'search', kind: 'skill', value: 'code-review' },
    { id: '', value: 'x' },
  ] })
  assert.deepEqual(configured.map((button) => button.id), ['mine'])
  assert.equal(configured[0].kind, 'skill')
  assert.equal(configured[0].icon, 'search')
  // 配置里的按钮也会进投影视图
  const unit = createQuickActionsProjection(configured)
  assert.equal(unit.wire.view({}).buttons, configured)
})

test('快捷按钮：Config schema 可用于设置页（平台 schema 库可用时）', () => {
  // schema 库缺失时 Config 为 undefined，插件照常工作、只是没有可编辑表单。
  if (Config === undefined) {
    assert.ok(true, '本环境没有 schemastery，跳过 schema 断言')
    return
  }
  const empty = new Config({})
  assert.equal(empty.enabled, true, '默认开启')
  const filled = new Config({ buttons: [{ id: 'a', label: 'A' }] })
  assert.equal(filled.buttons.length, 1)
  assert.equal(filled.buttons[0].id, 'a')
  assert.equal(filled.buttons[0].kind, 'prompt', 'kind 缺省补成 prompt')
  assert.equal(filled.buttons[0].icon, 'dot')
})

//#region git status

/** 一段真实的 `git status --porcelain=v2 --branch` 输出（含四种条目与忽略项）。 */
const PORCELAIN = [
  '# branch.oid 8f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -3',
  '1 .M N... 100644 100644 100644 3b2c1d 3b2c1d lib/client.js',
  '1 M. N... 100644 100644 100644 aa bb lib/host-v18.js',
  '2 R. N... 100644 100644 100644 aa bb R100 new.js\told.js',
  'u UU N... 100644 100644 100644 100644 aa bb cc conflicted.js',
  '? scratch.txt',
  '? notes/待办.md',
  '! dist/bundle.js',
].join('\n')

test('git 状态：porcelain v2 解析出分支、上游、领先落后与文件计数', () => {
  const status = parseGitStatus(PORCELAIN)
  assert.equal(status.branch, 'main')
  assert.equal(status.detached, false)
  assert.equal(status.head, '8f2a1b0', '短 sha 取 7 位')
  assert.equal(status.upstream, 'origin/main')
  assert.equal(status.ahead, 2)
  assert.equal(status.behind, 3)
  assert.equal(status.files, 4, '1/2/u 三类条目都算已跟踪改动')
  assert.equal(status.untracked, 2, '忽略项 ! 不计入未跟踪')
})

test('git 状态：detached 与 initial 不伪造分支或上游', () => {
  const detached = parseGitStatus('# branch.oid 1234567890abcdef\n# branch.head (detached)\n')
  assert.equal(detached.branch, null)
  assert.equal(detached.detached, true)
  assert.equal(detached.head, '1234567')
  assert.equal(detached.ahead, null, '没有 upstream 就是 null，不是 0')
  assert.equal(detached.behind, null)

  const initial = parseGitStatus('# branch.oid (initial)\n# branch.head main\n')
  assert.equal(initial.branch, 'main')
  assert.equal(initial.head, null, '还没有提交时不编造 sha')
})

test('git 状态：空输入按没有仓库处理', () => {
  assert.deepEqual(parseGitStatus('').files, 0)
  assert.equal(parseGitStatus('').branch, null)
  assert.equal(parseGitStatus(undefined).untracked, 0)
})

test('git 状态：numstat 汇总跳过二进制的一侧', () => {
  const totals = parseNumstatTotals('12\t3\tlib/client.js\n-\t-\timage.png\n7\t0\tREADME.md\n')
  assert.equal(totals.files, 3)
  assert.equal(totals.added, 19)
  assert.equal(totals.deleted, 3)
  assert.deepEqual(parseNumstatTotals(''), { files: 0, added: 0, deleted: 0 })
})

test('git 状态：宿主不再产出 remote / compare（用户不做 PR 流程）', async () => {
  // 读取器只放行 status/numstat/rev-parse 三类命令；remote 那一步连同它的建 PR 链接
  // 一起被删除，所以这里断言「没有 compare 这个字段」在源码层面也成立。
  const source = readFileSync(new URL('../lib/host-v18.js', import.meta.url), 'utf8')
  assert.ok(!source.includes('compareUrlFor'), '建 PR 链接的拼接函数应已删除')
  assert.ok(!source.includes("'remote', 'get-url'"), '不应再跑 git remote get-url')
  assert.ok(!source.includes('compare:'), '载荷里不应再有 compare 字段')
})

test('git 状态：路由常量是 /api 下的固定 GET 路径', () => {
  assert.equal(GIT_STATUS_ROUTE, '/api/sym.git')
})

//#endregion

//#region git branch picker

/** 一个记录 argv、按命令回放固定输出的 subprocess 替身。 */
function stubSubprocess(reply, onSpawn) {
  const calls = []
  const spawns = []
  const subprocess = {
    async resolveExecutable() { return '/usr/local/bin/git' },
    spawn(spec) {
      calls.push(spec.argv)
      spawns.push({ argv: spec.argv, signal: spec.signal })
      if (typeof onSpawn === 'function') onSpawn(spec)
      const canned = reply(spec.argv) ?? { exitCode: 0, stdout: '', stderr: '' }
      return {
        done: Promise.resolve({ exitCode: canned.exitCode }),
        collected: {
          stdout: { readFrom: () => ({ text: canned.stdout ?? '', lossy: false }) },
          stderr: { readFrom: () => ({ text: canned.stderr ?? '' }) },
        },
      }
    },
  }
  return { subprocess, calls, spawns, ranSwitch: () => calls.some((argv) => argv.includes('switch') || argv.includes('checkout')) }
}

const REFS_PICKER = 'main\t*\nfeat/x\t\n'
const REFS_NAMES = 'main\nfeat/x\n'
const STATUS_MAIN = '# branch.oid abc1234\n# branch.head main\n'

/** 读取器回放：分支清单 / status / diff / toplevel 都是固定输出，switch 由调用方给。 */
function readerReplies(switchOutcome, statusText = STATUS_MAIN) {
  return (argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('switch')) return switchOutcome
    if (line.startsWith('for-each-ref') && line.includes('%(HEAD)')) return { exitCode: 0, stdout: REFS_PICKER }
    if (line.startsWith('for-each-ref')) return { exitCode: 0, stdout: REFS_NAMES }
    if (line.startsWith('status')) return { exitCode: 0, stdout: statusText }
    if (line.startsWith('diff')) return { exitCode: 0, stdout: '3\t1\tlib/client.js\n' }
    if (line.startsWith('rev-parse')) return { exitCode: 0, stdout: '/repo\n' }
    return { exitCode: 0, stdout: '' }
  }
}

test('git 状态：分支清单解析，当前分支排最前', () => {
  const list = parseBranches(REFS_PICKER)
  assert.deepEqual(list, [{ name: 'main', current: true }, { name: 'feat/x', current: false }])
  assert.deepEqual(parseBranches(''), [])
  assert.deepEqual(parseBranches(undefined), [])
  // 当前分支在 git 的"近因序"里排最后时，也要被提到最前。
  const later = parseBranches('feat/x\t\nmain\t*\n')
  assert.deepEqual(later.map((b) => b.name), ['main', 'feat/x'])
})

test('git 状态：非法分支名在跑任何 git 命令之前就被拒绝', async () => {
  const stub = stubSubprocess(readerReplies({ exitCode: 0 }))
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  for (const bad of ['--force', '-D', 'a'.repeat(300), 'feat\nx', '', null, 'feat\u0007x']) {
    const outcome = await reader.switchBranch('/repo', bad, new AbortController().signal)
    assert.equal(outcome.ok, false, `${String(bad)} 必须被拒`)
    assert.equal(outcome.code, 'invalid')
  }
  assert.equal(stub.ranSwitch(), false, '非法名不得触发 git switch')
})

test('git 状态：不在本地清单里的分支不会交给 git', async () => {
  const stub = stubSubprocess(readerReplies({ exitCode: 0 }))
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.switchBranch('/repo', 'origin/main', new AbortController().signal)
  assert.equal(outcome.ok, false)
  assert.equal(outcome.code, 'unknown')
  assert.equal(stub.ranSwitch(), false, '白名单之外不得触发 git switch')
})

test('git 状态：git 拒绝切换时原样回传 stderr 首行', async () => {
  const refusal = {
    exitCode: 1,
    stderr: 'error: Your local changes to the following files would be overwritten by checkout:\n\tlib/client.js\nPlease commit your changes or stash them before you switch branches.\nAborting\n',
  }
  const stub = stubSubprocess(readerReplies(refusal))
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.switchBranch('/repo', 'feat/x', new AbortController().signal)
  assert.equal(outcome.ok, false)
  assert.equal(outcome.code, 'refused')
  assert.match(outcome.message, /Your local changes/)
  assert.equal(stub.ranSwitch(), true)
})

test('git 状态：切换成功后直接回一份新读数（分支已换）', async () => {
  const after = '# branch.oid 9999999\n# branch.head feat/x\n'
  const stub = stubSubprocess(readerReplies({ exitCode: 0, stderr: "Switched to branch 'feat/x'\n" }, after))
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.switchBranch('/repo', 'feat/x', new AbortController().signal)
  assert.equal(outcome.ok, true)
  assert.equal(outcome.payload.branch, 'feat/x')
  assert.deepEqual(outcome.payload.branches.map((b) => b.name), ['main', 'feat/x'])
  assert.equal(outcome.payload.added, 3)
})

//#endregion

//#region CR-0002 评审整改（A1 / A3 / B1 / B4 / C4）

test('A1：浏览器断连不得打断已经开始的切换', async () => {
  const controller = new AbortController()
  // 白名单查询（读）用调用方 signal；一旦它开始就模拟"页面被关掉"。
  const stub = stubSubprocess(
    (argv) => {
      const line = argv.slice(1).join(' ')
      if (line.startsWith('switch')) return { exitCode: 0, stderr: "Switched to branch 'feat/x'\n" }
      if (line.startsWith('for-each-ref') && !line.includes('%(HEAD)')) return { exitCode: 0, stdout: REFS_NAMES }
      if (line.startsWith('for-each-ref')) return { exitCode: 0, stdout: REFS_PICKER }
      if (line.startsWith('status')) return { exitCode: 0, stdout: '# branch.head feat/x\n' }
      if (line.startsWith('diff')) return { exitCode: 0, stdout: '' }
      if (line.startsWith('rev-parse')) return { exitCode: 0, stdout: '/repo\n' }
      return { exitCode: 0, stdout: '' }
    },
    (spec) => {
      if (spec.argv.slice(1).join(' ').startsWith('for-each-ref') && !spec.argv.includes('%09%(HEAD)')) controller.abort()
    }
  )
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.switchBranch('/repo', 'feat/x', controller.signal)
  assert.equal(controller.signal.aborted, true, '前置读之后调用方 signal 已经中止')
  assert.equal(outcome.ok, true, '写操作不该因为浏览器断连而失败')
  const write = stub.spawns.find((entry) => entry.argv.includes('switch'))
  assert.ok(write !== void 0, '确实执行了 switch')
  assert.notEqual(write.signal, controller.signal, '写操作不得复用请求的 signal')
  assert.equal(write.signal.aborted, false, '写操作用的是自己的超时 signal')
})

test('A3：被拒时带上挡路的文件，而不是半句冒号', async () => {
  const refusal = {
    exitCode: 1,
    stderr: 'error: Your local changes to the following files would be overwritten by checkout:\n\tlib/client.js\nPlease commit your changes or stash them before you switch branches.\nAborting\n',
  }
  const stub = stubSubprocess(readerReplies(refusal))
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.switchBranch('/repo', 'feat/x', new AbortController().signal)
  assert.equal(outcome.code, 'refused')
  assert.match(outcome.message, /would be overwritten by checkout:/)
  assert.match(outcome.message, /lib\/client\.js/, '冒号后面那份文件清单必须留下')
  assert.ok(outcome.message.length <= 200, '仍然有长度上限')
})

test('B1：没有 git switch 的老 git 回退到 checkout', async () => {
  const stub = stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('switch')) return { exitCode: 1, stderr: "git: 'switch' is not a git command. See 'git --help'.\n" }
    if (line.startsWith('checkout')) return { exitCode: 0, stderr: "Switched to branch 'feat/x'\n" }
    if (line.startsWith('for-each-ref') && !line.includes('%(HEAD)')) return { exitCode: 0, stdout: REFS_NAMES }
    if (line.startsWith('for-each-ref')) return { exitCode: 0, stdout: REFS_PICKER }
    if (line.startsWith('status')) return { exitCode: 0, stdout: '# branch.head feat/x\n' }
    if (line.startsWith('diff')) return { exitCode: 0, stdout: '' }
    if (line.startsWith('rev-parse')) return { exitCode: 0, stdout: '/repo\n' }
    return { exitCode: 0, stdout: '' }
  })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.switchBranch('/repo', 'feat/x', new AbortController().signal)
  assert.equal(outcome.ok, true)
  const checkout = stub.calls.find((argv) => argv.includes('checkout'))
  assert.deepEqual(checkout, ['/usr/local/bin/git', 'checkout', 'feat/x'], '回退形式不带 --（名字已过白名单）')
})

test('B4：切换期间在飞的那次读，不能把旧分支写回缓存', async () => {
  let release = null
  const gate = new Promise((resolve) => { release = resolve })
  let statusCalls = 0
  const stub = stubSubprocess(async (argv) => ({ exitCode: 0, stdout: '', stderr: '' }))
  // 手写一个可控替身：第一次 status 卡住，其余立刻返回
  const subprocess = {
    async resolveExecutable() { return '/usr/local/bin/git' },
    spawn(spec) {
      const line = spec.argv.slice(1).join(' ')
      const canned = (() => {
        if (line.startsWith('for-each-ref') && !line.includes('%(HEAD)')) return { exitCode: 0, stdout: REFS_NAMES }
        if (line.startsWith('for-each-ref')) return { exitCode: 0, stdout: 'main\t*\nfeat/x\t\n' }
        if (line.startsWith('switch')) return { exitCode: 0, stderr: '' }
        if (line.startsWith('diff')) return { exitCode: 0, stdout: '' }
        if (line.startsWith('rev-parse')) return { exitCode: 0, stdout: '/repo\n' }
        if (line.startsWith('status')) {
          statusCalls += 1
          if (statusCalls === 1) return { exitCode: 0, stdout: '# branch.head main\n', gate: true }
          return { exitCode: 0, stdout: '# branch.head feat/x\n' }
        }
        return { exitCode: 0, stdout: '' }
      })()
      const text = { text: canned.stdout ?? '', lossy: false }
      const finish = () => ({ exitCode: canned.exitCode, stdout: text, stderr: { text: canned.stderr ?? '' } })
      return {
        done: canned.gate === true ? gate.then(finish) : Promise.resolve(finish()),
        collected: {
          stdout: { readFrom: () => ({ text: canned.stdout ?? '', lossy: false }) },
          stderr: { readFrom: () => ({ text: canned.stderr ?? '' }) },
        },
      }
    },
  }
  const reader = createGitStatusReader({ subprocess })
  const stale = reader.read('/repo', new AbortController().signal)   // 卡在第一次 status
  await new Promise((r) => setTimeout(r, 10))
  const outcome = await reader.switchBranch('/repo', 'feat/x', new AbortController().signal)
  assert.equal(outcome.ok, true)
  assert.equal(outcome.payload.branch, 'feat/x', '切换后立刻读到的必须是新分支（没有并进那次在飞的旧读）')
  release()                                                          // 放行那次旧读
  await stale
  const after = await reader.read('/repo', new AbortController().signal)
  assert.equal(after.branch, 'feat/x', '旧读结束时不得把 main 写回缓存')
})

test('C4：路由把四种结果映射成 400 / 404 / 409 / 200', async () => {
  const route = gitStatusRoute(
    { sessions: { get: (id) => (id === 'ok' ? { header: { cwd: '/repo' } } : undefined) } },
    {
      read: async () => ({ branch: 'main' }),
      switchBranch: async (cwd, branch) =>
        branch === 'nope' ? { ok: false, code: 'unknown', message: 'No such local branch: nope' }
          : branch === 'dirty' ? { ok: false, code: 'refused', message: 'error: overwritten by checkout: a.txt' }
            : { ok: true, payload: { branch } },
    }
  )
  const call = async (method, id, body) => {
    const request = new Request('http://x' + route.path + (id === void 0 ? '' : '?sessionId=' + id), {
      method,
      ...(body === void 0 ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
    })
    const response = await route.fetch(request)
    return { status: response.status, body: await response.json().catch(() => null) }
  }
  assert.deepEqual(route.methods, ['GET', 'POST'])
  assert.equal((await call('GET', void 0)).status, 400, '缺 sessionId')
  assert.equal((await call('GET', 'ghost')).status, 404, '会话不存在')
  assert.equal((await call('GET', 'ok')).status, 200)
  assert.equal((await call('POST', 'ok', { branch: 'nope' })).status, 400, '清单外分支')
  assert.equal((await call('POST', 'ghost', { branch: 'feat/x' })).status, 404, '查询串里的会话不存在')
  assert.equal((await call('POST', 'ok', { branch: 'dirty' })).status, 409, 'git 拒绝 → 409')
  const ok = await call('POST', 'ok', { branch: 'feat/x' })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.ok, true)
  assert.equal(ok.body.payload.branch, 'feat/x')
})

test('C4：超大 body 直接 413，不进解析', async () => {
  const route = gitStatusRoute({ sessions: { get: () => ({ header: { cwd: '/repo' } }) } }, { read: async () => null, switchBranch: async () => ({ ok: false, code: 'unknown', message: 'x' }) })
  const response = await route.fetch(new Request('http://x' + route.path, {
    method: 'POST',
    body: '{}',
    headers: { 'content-type': 'application/json', 'content-length': '9000' },
  }))
  assert.equal(response.status, 413)
})

//#endregion
