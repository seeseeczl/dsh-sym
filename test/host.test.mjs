import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isPeakTime, expandQuoteMarks, rememberProse, proseOfMessage, readProcessMemory,
  DEEPSEEK_CNY, DEFAULT_USD_TO_CNY,
  QUICK_ACTIONS_KEY, DEFAULT_QUICK_ACTIONS, normalizeQuickActions,
  createQuickActionsProjection, buttonsFromConfig, Config,
  GIT_STATUS_ROUTE, parseGitStatus, parseNumstatTotals, parseBranches, createGitStatusReader, gitStatusRoute, parseGitLog,
  CONTEXT_LOSS_KEY, contextLossProjection,
} from '../lib/host-v20.js'

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
  '1 M. N... 100644 100644 100644 aa bb lib/host-v20.js',
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
  const source = readFileSync(new URL('../lib/host-v20.js', import.meta.url), 'utf8')
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

//#region CR-0007 提交记录列表 + 重置 / 回滚
// 三条硬要求（用户明确要求过）：
// ① 列表是**完整**历史、可分页；② reset **只改本地**，绝不碰远程；
// ③ reset 不允许 `--hard`（会丢未提交改动），revert 冲突要如实回报而不是吞掉。

const LOG_ROW = (hash, short, author, at, subject) => [hash, short, author, String(at), subject].join('\t')

test('git log：解析成描述 / 提交 / 作者 / 日期四列，末位自由文本里的制表符不会串列', () => {
  const stdout = [
    LOG_ROW('a'.repeat(40), 'aaaaaaa', 'Zhang San', 1700000000, 'feat: 添加提交记录'),
    LOG_ROW('b'.repeat(40), 'bbbbbbb', 'Li Si', 1700000100, 'fix: tab\tin subject'),
  ].join('\0') + '\0'
  const { commits, hasMore } = parseGitLog(stdout, 5)
  assert.equal(hasMore, false)
  assert.equal(commits.length, 2)
  assert.deepEqual(commits[0], { hash: 'a'.repeat(40), short: 'aaaaaaa', author: 'Zhang San', at: 1700000000, subject: 'feat: 添加提交记录' })
  assert.equal(commits[1].subject, 'fix: tab\tin subject', '主题里的制表符原样保留（它排最后，不会挤掉别的列）')
  assert.equal(commits[1].author, 'Li Si', '作者列照常')
})

test('git log：多读的那一行只用于 hasMore，不进结果', () => {
  const rows = Array.from({ length: 4 }, (_, i) => LOG_ROW(String(i).repeat(40), 'x'.repeat(7), 'a', 1 + i, 'm' + i))
  const page = parseGitLog(rows.join('\0') + '\0', 3)
  assert.equal(page.commits.length, 3, '要 3 条就只给 3 条')
  assert.equal(page.hasMore, true, '第 4 条是"还有下一页"的证据，不是结果')
  assert.equal(parseGitLog(rows.slice(0, 3).join('\0') + '\0', 3).hasMore, false)
})

test('git log：真实 git 的分隔是「<NUL><换行>」，剥掉前导换行才能解析（真机踩过）', () => {
  // `%x00` 之后 git 会另起一行，于是切完 NUL 每条都带一个前导 \n。
  // 不剥掉它，%H 校验会把**每一个提交**都判成坏行 —— 真机表现是"列表永远为空"。
  const real = LOG_ROW('a'.repeat(40), 'aaaaaaa', 'A', 1700000000, 'one') + '\0\n'
    + LOG_ROW('b'.repeat(40), 'bbbbbbb', 'B', 1700000100, 'two') + '\0\n'
  const { commits } = parseGitLog(real, 10)
  assert.equal(commits.length, 2, '两条都不能丢')
  assert.deepEqual(commits.map((c) => c.subject), ['one', 'two'])
})

test('git log：坏行跳过，时间戳非法时是 null 而不是编造 1970', () => {
  const stdout = ['short\tx\ty\t1\ttoo-short-hash', LOG_ROW('c'.repeat(40), 'ccccccc', 'A', 'not-a-number', 'ok')].join('\0')
  const { commits } = parseGitLog(stdout, 10)
  assert.equal(commits.length, 1, '哈希不合法的那行被丢弃')
  assert.equal(commits[0].at, null, '时间戳解析不了就是 null')
  assert.deepEqual(parseGitLog('', 10), { commits: [], hasMore: false })
  assert.deepEqual(parseGitLog(undefined, 10), { commits: [], hasMore: false })
})

/** 记录 argv 的替身：log/rev-parse/status 都有回放，写命令由调用方给。 */
function logStub(writes, extra = {}) {
  return stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('log')) return { exitCode: 0, stdout: LOG_ROW('d'.repeat(40), 'ddddddd', 'A', 1700000000, 'only') }
    // revert 前会先探一次「是否已有进行中的 revert」；没有就是退出码 1（正常态）。
    if (line.startsWith('rev-parse --verify') && /CHERRY_PICK_HEAD|REVERT_HEAD/.test(line)) return { exitCode: 1, stderr: '' }
    if (line.startsWith('rev-parse --verify') && line.includes('^{commit}')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    if (line.startsWith('rev-parse --short')) return { exitCode: 0, stdout: 'fffffff\n' }
    if (line.startsWith('rev-parse --short')) return { exitCode: 0, stdout: 'fffffff\n' }
    if (line.startsWith('rev-parse')) return { exitCode: 0, stdout: '/repo\n' }
    if (line.startsWith('status')) return { exitCode: 0, stdout: STATUS_MAIN }
    if (line.startsWith('diff')) return { exitCode: 0, stdout: '' }
    for (const [prefix, outcome] of Object.entries(writes)) {
      if (line.startsWith(prefix)) return outcome
    }
    return { exitCode: 0, stdout: '' }
  })
}

test('git log：分页参数夹紧，且 --format 由宿主写死（调用方给不了格式指令）', async () => {
  const stub = logStub({})
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const page = await reader.log('/repo', 9999, -5, new AbortController().signal)
  assert.equal(page.limit, 200, '上限 200')
  assert.equal(page.skip, 0, '负数偏移按 0')
  assert.equal(page.commits.length, 1)
  const argv = stub.calls.find((entry) => entry.includes('log'))
  assert.ok(argv.includes('--max-count=201'), '多读一条判断 hasMore')
  assert.ok(argv.includes('--skip=0'))
  assert.ok(argv.some((entry) => entry.startsWith('--format=')), '格式是宿主给的')
  assert.deepEqual(argv.slice(-2), ['HEAD', '--'], '修订范围后面必须有 --，路径不会被当成修订')
})

test('log：载荷带上 dirty（已跟踪文件的未提交改动数），供破坏性确认说清会丢多少', async () => {
  // `git reset --hard` 会丢弃这些文件的未提交改动，但**不碰**未跟踪文件 ——
  // 所以只数 files（status 已用 --untracked-files=no），不数 untracked。
  const make = (statusOut) => stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('log')) return { exitCode: 0, stdout: LOG_ROW('a'.repeat(40), 'aaaaaaa', 'A', 1700000000, 'one') }
    if (line.startsWith('rev-parse --abbrev-ref')) return { exitCode: 0, stdout: 'main\n' }
    if (line.startsWith('rev-parse --verify')) return { exitCode: 1, stderr: '' }
    if (line.startsWith('rev-parse')) return { exitCode: 0, stdout: '/repo\n' }
    if (line.startsWith('status')) return { exitCode: 0, stdout: statusOut }
    return { exitCode: 0, stdout: '' }
  })
  const two = make('# branch.head main\n1 .M N... 100644 100644 100644 abc abc f.txt\n1 .M N... 100644 100644 100644 abc abc g.txt\n')
  const page = await createGitStatusReader({ subprocess: two.subprocess }).log('/repo', 10, 0, new AbortController().signal)
  assert.ok(page !== null)
  assert.equal(page.dirty, 2, '两个已跟踪文件有改动')

  const clean = make(STATUS_MAIN)
  const page2 = await createGitStatusReader({ subprocess: clean.subprocess }).log('/repo', 10, 0, new AbortController().signal)
  assert.equal(page2.dirty, 0, '干净工作区是 0')
})

test('reset：mode 是封闭枚举（hard 合法，其它一律在跑 git 之前拒绝）', async () => {
  // 2026-11-03 起 hard 是**用户明确要求**的能力（"回滚、丢失后面的修改"），
  // 所以它从"被拒"变成"合法"；但枚举之外的值仍然一个都不许到 git。
  for (const bad of ['HARD', 'hardd', 'merge', '', null, '--hard', 'soft ']) {
    const stub = logStub({})
    const reader = createGitStatusReader({ subprocess: stub.subprocess })
    const outcome = await reader.reset('/repo', 'ABCDEF', bad, new AbortController().signal)
    assert.equal(outcome.ok, false, String(bad) + ' 必须被拒')
    assert.equal(outcome.code, 'invalid')
    assert.ok(!stub.calls.some((argv) => argv.includes('reset')), '被拒时不得跑 git reset')
  }
})

test('reset：hard 会被原样交给 git（它只是换了个 mode，不是绕过）', async () => {
  const stub = logStub({ reset: { exitCode: 0, stderr: '' } })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.reset('/repo', 'abc1234', 'hard', new AbortController().signal)
  assert.equal(outcome.ok, true)
  const argv = stub.calls.find((entry) => entry.includes('reset'))
  assert.deepEqual(argv, ['/usr/local/bin/git', 'reset', '--hard', 'e'.repeat(40), '--'], '仍然走 argv + 尾随 --，用解析后的完整哈希')
})

test('reset：目标不是提交就拒绝（拒绝选项、拒绝缩写以外的输入）', async () => {
  for (const bad of ['--hard', 'HEAD~1', 'origin/main', 'not-a-sha', 'abc']) {
    const stub = stubSubprocess((argv) => {
      const line = argv.slice(1).join(' ')
      if (line.startsWith('rev-parse')) return { exitCode: 128, stderr: 'unknown revision' }
      return { exitCode: 0, stdout: '' }
    })
    const reader = createGitStatusReader({ subprocess: stub.subprocess })
    const outcome = await reader.reset('/repo', bad, 'soft', new AbortController().signal)
    assert.equal(outcome.ok, false, String(bad) + ' 应当解析不到')
    if (/^[0-9a-f]{4,64}$/i.test(bad) === false) {
      assert.equal(stub.calls.length, 0, String(bad) + ' 不是提交 id，连 rev-parse 都不该跑')
    }
  }
})

test('reset：argv 是「已解析的完整哈希 + --mode + --」，且成功后才回一份新读数', async () => {
  const stub = logStub({ reset: { exitCode: 0, stderr: '' } })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.reset('/repo', 'abc1234', 'keep', new AbortController().signal)
  assert.equal(outcome.ok, true)
  assert.equal(outcome.payload.branch, 'main')
  const argv = stub.calls.find((entry) => entry.includes('reset'))
  assert.deepEqual(argv, ['/usr/local/bin/git', 'reset', '--keep', 'e'.repeat(40), '--'], '用解析后的完整哈希，尾随 --')
  assert.ok(!argv.includes('--hard'), '绝不出现 --hard')
})

test('reset：git 拒绝时把 stderr 原样回传，且不复用请求的 signal', async () => {
  const controller = new AbortController()
  const stub = stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('reset')) return { exitCode: 1, stderr: 'error: Your local changes would be overwritten\nAborting\n' }
    if (line.startsWith('rev-parse --verify')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    return { exitCode: 0, stdout: '' }
  })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  controller.abort()
  const outcome = await reader.reset('/repo', 'abc1234', 'mixed', controller.signal)
  assert.equal(outcome.ok, false)
  assert.equal(outcome.code, 'refused')
  assert.match(outcome.message, /Your local changes/)
  const write = stub.spawns.find((entry) => entry.argv.includes('reset'))
  assert.notEqual(write.signal, controller.signal, '写操作不得复用请求 signal')
})

test('revert：argv 固定为 revert --no-edit <完整哈希> --；成功后带新提交的短号', async () => {
  const stub = logStub({ revert: { exitCode: 0, stderr: '' } })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.revert('/repo', 'abc1234', new AbortController().signal)
  assert.equal(outcome.ok, true)
  assert.equal(outcome.short, 'fffffff')
  assert.equal(outcome.payload.branch, 'main')
  const argv = stub.calls.find((entry) => entry.includes('revert'))
  assert.deepEqual(argv, ['/usr/local/bin/git', 'revert', '--no-edit', 'e'.repeat(40), '--'])
})

test('revert：冲突如实回报（code 是 conflict，带挡路文件），不假装成功', async () => {
  const conflict = {
    exitCode: 1,
    stderr: 'Auto-merging f.txt\nCONFLICT (content): Merge conflict in f.txt\nerror: could not revert 1111111... c2\nhint: run "git revert --abort"\n',
  }
  const stub = stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('revert')) return conflict
    if (line.startsWith('rev-parse --verify') && /CHERRY_PICK_HEAD|REVERT_HEAD/.test(line)) return { exitCode: 1, stderr: '' }
    if (line.startsWith('rev-parse --verify')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    return { exitCode: 0, stdout: '' }
  })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.revert('/repo', 'abc1234', new AbortController().signal)
  assert.equal(outcome.ok, false)
  assert.equal(outcome.code, 'conflict', '必须是 conflict，前端才能提示"已中止的 merge 状态"')
  assert.deepEqual(outcome.files, [], 'git 用 CONFLICT 行报冲突时，files 为空也不算失败')
  assert.match(outcome.message, /CONFLICT/)
})

test('revert：已经有一次在进行的 revert 时不再叠加', async () => {
  const stub = stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('rev-parse --verify') && line.includes('REVERT_HEAD')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    if (line.startsWith('rev-parse --verify')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    return { exitCode: 0, stdout: '' }
  })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.revert('/repo', 'abc1234', new AbortController().signal)
  assert.equal(outcome.ok, false)
  assert.equal(outcome.code, 'busy')
  assert.ok(!stub.calls.some((argv) => argv.includes('revert')), '不得再跑一次 git revert')
})

test('revert：冲突后 git 留下的是 REVERT_HEAD，必须能认出来（真机踩过的 bug）', async () => {
  // 2026-11-03 真机验证实测：冲突的 `git revert` 写的是 REVERT_HEAD，
  // **不是** CHERRY_PICK_HEAD。只查后者时这层保护完全失效 —— 之后每次 revert
  // 都被 git 以 "you have unmerged files" 拒绝，而界面上没有任何中止入口。
  const stub = stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('rev-parse --verify') && line.includes('REVERT_HEAD')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    if (line.startsWith('rev-parse --short')) return { exitCode: 0, stdout: 'eeeeeee\n' }
    if (line.startsWith('rev-parse --verify')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    return { exitCode: 0, stdout: '' }
  })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.revert('/repo', 'abc1234', new AbortController().signal)
  assert.equal(outcome.ok, false)
  assert.equal(outcome.code, 'busy', '必须报 busy，而不是让 git 再撞一次')
  assert.equal(outcome.revert.short, 'eeeeeee', '带上卡住的那笔提交，界面才能提示')
  assert.ok(!stub.calls.some((argv) => argv.includes('revert')), '不得再跑一次 git revert')
})

test('revert：abortRevert 用 `revert --abort` 收尾，没有在途时是 idle', async () => {
  // 没有在途：直接 idle，不跑任何写命令
  const idleStub = stubSubprocess(() => ({ exitCode: 1, stderr: '' }))
  const idleReader = createGitStatusReader({ subprocess: idleStub.subprocess })
  const idle = await idleReader.abortRevert('/repo', new AbortController().signal)
  assert.equal(idle.ok, false)
  assert.equal(idle.code, 'idle')
  assert.ok(!idleStub.calls.some((argv) => argv.includes('revert')), '空闲时不得跑 git revert')

  // 有在途：执行 `git revert --abort`
  const stub = stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('rev-parse --verify') && line.includes('REVERT_HEAD')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    if (line.startsWith('rev-parse --short')) return { exitCode: 0, stdout: 'eeeeeee\n' }
    if (line.startsWith('rev-parse --verify')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    if (line.startsWith('status')) return { exitCode: 0, stdout: STATUS_MAIN }
    if (line.startsWith('diff')) return { exitCode: 0, stdout: '' }
    if (line.startsWith('rev-parse')) return { exitCode: 0, stdout: '/repo\n' }
    return { exitCode: 0, stdout: '' }
  })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const outcome = await reader.abortRevert('/repo', new AbortController().signal)
  assert.equal(outcome.ok, true)
  assert.equal(outcome.payload.branch, 'main')
  const argv = stub.calls.find((entry) => entry.includes('revert'))
  assert.deepEqual(argv, ['/usr/local/bin/git', 'revert', '--abort'], '只用 --abort，不带 reset/stash')
})

test('git log：载荷里带"是否有未完成的回滚"，刷新后界面仍能提示', async () => {
  const stub = stubSubprocess((argv) => {
    const line = argv.slice(1).join(' ')
    if (line.startsWith('log')) return { exitCode: 0, stdout: LOG_ROW('d'.repeat(40), 'ddddddd', 'A', 1700000000, 'only') }
    if (line.startsWith('rev-parse --verify') && line.includes('REVERT_HEAD')) return { exitCode: 0, stdout: 'e'.repeat(40) + '\n' }
    if (line.startsWith('rev-parse --short')) return { exitCode: 0, stdout: 'eeeeeee\n' }
    if (line.startsWith('rev-parse')) return { exitCode: 0, stdout: '/repo\n' }
    if (line.startsWith('status')) return { exitCode: 0, stdout: STATUS_MAIN }
    return { exitCode: 0, stdout: '' }
  })
  const reader = createGitStatusReader({ subprocess: stub.subprocess })
  const page = await reader.log('/repo', 10, 0, new AbortController().signal)
  assert.equal(page.revert.short, 'eeeeeee', '列表页要说出仓库停在哪笔回滚上')
})

test('CR-0007 路由：GET kind=log 走新读取器，POST reset/revert 映射成 200 / 409', async () => {
  const route = gitStatusRoute(
    { sessions: { get: (id) => (id === 'ok' ? { header: { cwd: '/repo' } } : undefined) } },
    {
      read: async () => ({ branch: 'main' }),
      switchBranch: async (cwd, branch) => ({ ok: true, payload: { branch } }),
      log: async (cwd, limit, skip) => ({ branch: 'main', commits: [], hasMore: false, limit, skip }),
      reset: async (cwd, commit, mode) => (mode === 'hard' ? { ok: false, code: 'invalid', message: 'no' } : { ok: true, payload: { branch: 'main', head: commit } }),
      revert: async () => ({ ok: false, code: 'conflict', message: 'CONFLICT (content): Merge conflict in f.txt', files: ['f.txt'] }),
    }
  )
  const call = async (url, body) => {
    const response = await route.fetch(new Request('http://x' + url, body === void 0 ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }))
    return { status: response.status, body: await response.json().catch(() => null) }
  }
  const log = await call(route.path + '?sessionId=ok&kind=log&limit=50&skip=0')
  assert.equal(log.status, 200)
  assert.equal(log.body.limit, 50)
  // 分支切换的老形状（没有 action 字段）不能被打断 —— CR-0002 的回归。
  const switched = await call(route.path + '?sessionId=ok', { branch: 'feat/x' })
  assert.equal(switched.status, 200)
  assert.equal(switched.body.payload.branch, 'feat/x')
  assert.equal((await call(route.path, { sessionId: 'ok', action: 'reset', commit: 'abc1234', mode: 'soft' })).status, 200)
  assert.equal((await call(route.path, { sessionId: 'ok', action: 'reset', commit: 'abc1234', mode: 'hard' })).status, 400)
  const conflict = await call(route.path, { sessionId: 'ok', action: 'revert', commit: 'abc1234' })
  assert.equal(conflict.status, 409, '冲突是 409，客户端才能给出"中止"这类说明')
  assert.deepEqual(conflict.body.files, ['f.txt'])
  assert.equal((await call(route.path, { sessionId: 'ok', action: 'push' })).status, 400, '未定义动作直接 400')
})

//#endregion
// 用户诉求：压缩次数是"信息丢失程度"的指标。客户端拿不到 compaction 事件，
// 所以由宿主折叠成 { compactions, prunes, lostTokens }。

/** 折叠一串事件，返回 wire view。 */
const foldLoss = (events) => {
  let state = contextLossProjection.init()
  for (const event of events) state = contextLossProjection.apply(state, event)
  return contextLossProjection.wire.view(state)
}

test('contextLoss：compact 与 prune 都计入次数，token 累加', () => {
  const view = foldLoss([
    { type: 'compaction/start', data: { compactionId: 'c1', turn: 3 } },
    { type: 'compaction/summary', data: { compactionId: 'c1', turn: 3, shadowedTokenCount: 120000 } },
    { type: 'compaction/end', data: { compactionId: 'c1', turn: 3 } },
    { type: 'compaction/prune', data: { shadowedTokenCount: 8000 } },
    { type: 'compaction/start', data: { compactionId: 'c2', turn: 7 } },
    { type: 'compaction/summary', data: { compactionId: 'c2', turn: 7, shadowedTokenCount: 45000 } },
    { type: 'compaction/end', data: { compactionId: 'c2', turn: 7 } },
  ])
  assert.equal(view.compactions, 2, '两次 compact')
  assert.equal(view.prunes, 1, '一次 prune')
  assert.equal(view.lostTokens, 173000, '120000 + 8000 + 45000')
  assert.equal(view.lastTurn, 7)
})

test('contextLoss：只有 summary/prune 计数，start 不算一次压缩', () => {
  // 失败的压缩会有 start 但没有 summary —— 不能被算成"压缩过一次"。
  const view = foldLoss([
    { type: 'compaction/start', data: { compactionId: 'c1', turn: 2 } },
    { type: 'compaction/end', data: { compactionId: 'c1', turn: 2, error: 'boom' } },
  ])
  assert.equal(view.compactions, 0, 'start+error 不算压缩成功')
  assert.equal(view.lostTokens, 0)
})

test('contextLoss：缺 shadowedTokenCount 或非数值时按 0 计，不编数', () => {
  const view = foldLoss([
    { type: 'compaction/summary', data: { compactionId: 'c1', turn: 1 } },
    { type: 'compaction/prune', data: { shadowedTokenCount: 'nope' } },
    { type: 'compaction/prune', data: { shadowedTokenCount: -5 } },
    { type: 'compaction/summary', data: { compactionId: 'c2', turn: 1, shadowedTokenCount: 100 } },
  ])
  assert.equal(view.compactions, 2)
  assert.equal(view.prunes, 2)
  assert.equal(view.lostTokens, 100, '只有合法值才计入')
})

test('contextLoss：无关事件保持 state 引用不变（不白算视图）', () => {
  const state = contextLossProjection.init()
  for (const type of ['assistant/message', 'tool/result', 'turn/start', 'request/header']) {
    assert.equal(contextLossProjection.apply(state, { type, data: {} }), state, type + ' 不该改 state')
  }
})

test('contextLoss：首次压缩后 state 引用必须变（投影可见性的硬要求）', () => {
  const state = contextLossProjection.init()
  const next = contextLossProjection.apply(state, { type: 'compaction/summary', data: { turn: 1, shadowedTokenCount: 1 } })
  assert.notEqual(next, state, 'state 引用不变则客户端永远读不到这个 key')
})

test('contextLoss：契约常量与客户端一致', () => {
  assert.equal(CONTEXT_LOSS_KEY, 'contextLoss')
})
//#endregion
