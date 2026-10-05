import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PROJECTION_KEY, QUOTE_MARK_PREFIX, QUOTE_MARK_ID_LENGTH, QUICK_ACTIONS_KEY,
  DEFAULT_QUICK_ACTIONS, sessionCostProjection, rememberProse, expandQuoteMarks,
} from '../lib/host-v12.js'
import { loadClient } from './helpers/load-client.mjs'

/**
 * 跨端契约的守卫（审计 AUD-ARCH-001 / 任务卡 P1-02）。
 *
 * 客户端 bundle 与宿主模块**不能共享代码**：前者是浏览器里的 module factory，
 * 后者是读文件系统的 Node 模块。所以两端各自持有一份契约常量，本文件负责
 * 证明两份拷贝仍然相等，并且证明"客户端写出的东西宿主真的认得"。
 *
 * 这是唯一的机器可检手段：两端失配时不会报错，只会表现为数据不出现或引用不展开。
 */

test('跨端契约：投影 key 与引用标记格式，两端常量一致', () => {
  const client = loadClient()
  assert.equal(client.PROJECTION_KEY, PROJECTION_KEY, '投影 key 必须两端同名')
  assert.equal(client.QUOTE_MARK_PREFIX, QUOTE_MARK_PREFIX, '引用标记前缀必须两端一致')
  assert.equal(client.QUOTE_MARK_ID_LENGTH, QUOTE_MARK_ID_LENGTH, '标记里的 id 长度必须两端一致')
  assert.equal(client.QUICK_ACTIONS_KEY, QUICK_ACTIONS_KEY, '快捷按钮条的投影 key 必须两端同名')
})

test('跨端契约：两端的默认按钮清单必须一致', () => {
  // 客户端内置一份默认（宿主配置还没写时顶上），宿主也有一份（投影的兜底）。
  // 两份拷贝不允许漂移 —— 改一边就必须改另一边。
  const client = loadClient()
  const shape = (list) => list.map((button) => [button.id, button.label, button.icon, button.kind, button.value])
  assert.deepEqual(shape(client.DEFAULT_QUICK_ACTIONS), shape(DEFAULT_QUICK_ACTIONS),
    '默认按钮清单两端不一致：改了宿主 DEFAULT_QUICK_ACTIONS 就要同步客户端那份')
})

test('跨端契约：每个默认按钮的图标名都在图标集里', () => {
  // 图标集只存在于客户端（宿主不画图），这条守住"默认清单不会指向一个不存在的图标"。
  const client = loadClient()
  const names = client.QUICK_ICON_NAMES
  assert.ok(Array.isArray(names) && names.length >= 20, '图标集至少要有 20 个可选图标')
  for (const button of client.DEFAULT_QUICK_ACTIONS) {
    assert.ok(names.includes(button.icon), `默认按钮 ${button.id} 的图标 ${button.icon} 不在图标集里`)
  }
})

test('跨端契约：宿主投影单元用的是同一个 key 与状态版本', () => {
  assert.equal(sessionCostProjection.key, PROJECTION_KEY)
  assert.equal(sessionCostProjection.stateVersion, 3, '改版本号要同时确认客户端解析')
})

test('跨端契约：客户端写出的标记，宿主确实能展开（端到端）', () => {
  const client = loadClient()
  const id = 'abcdef12-3456-7890-abcd-ef1234567890'
  const mark = client.quoteMark(id)

  assert.equal(mark, QUOTE_MARK_PREFIX + 'abcdef123456', '标记 = 前缀 + 去连字符的前 12 位小写十六进制')

  rememberProse(id, '被引用的那一段正文。')
  const out = expandQuoteMarks([{ role: 'user', content: [{ type: 'text', text: mark + ' 请参考这段' }] }])

  assert.ok(out !== null, '宿主应认出客户端写的标记并展开')
  assert.match(out[0].content[0].text, /被引用的那一段正文。/)
  assert.doesNotMatch(out[0].content[0].text, /@引用#/, '标记本身应被替换掉')
})

test('跨端契约：客户端对同一条消息两次生成的标记完全相同', () => {
  const client = loadClient()
  const id = 'ABCDEF12-3456-7890-abcd-ef1234567890'
  assert.equal(client.quoteMark(id), client.quoteMark(id.toLowerCase()), '大小写不同的同一个 id 必须生成同一标记')
})

test('跨端契约：缓存省下的文案与数据属性不得回流', () => {
  // 「缓存为你省下」连同它的产物「本来要花」已被用户否决并整体撤掉：
  // 那个数字拿命中 token 乘（未命中价 − 命中价），假设没有缓存时照样按未命中价计费。
  // 文案散在 zh / en 两份词典和面板行里，删一处漏一处不会报错，所以在这里钉住。
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const gone of ['缓存为你省下', 'cacheSaved', '本来要花', 'wouldHaveCost', 'data-sym-cache-saved']) {
    assert.ok(!source.includes(gone), `客户端不该再出现 ${gone}：缓存省下已整体移除`)
  }
  // 谷时折扣是唯一保留的省钱项。
  assert.ok(source.includes('谷时折扣为你省下'), '谷时折扣必须保留')
})

test('跨端契约：会抢走输入框焦点的四个控件都必须按下去不抢', () => {
  // 两类控件，两种处理：
  // · 往草稿里写字的（竖条快捷按钮、回复动作行的 @）—— 不抢焦点，写完全程把光标还回去；
  // · 只是看一眼的（成本药丸、侧栏余额药丸）—— 只做到不抢，不去抓焦点（看花费不是要写字）。
  // 这两类都是 `<button>` 或非聚焦元素，按下时都会把输入框的焦点弄丢，用户报过
  // "点完光标就没了"。少写一处不会报错，只会在线上表现为"点完要再点一下输入框"，所以钉住。
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const guarded = source.match(/onMouseDown: keepComposerFocus/g) ?? []
  assert.equal(guarded.length, 4, '竖条按钮、@ 引用按钮、成本药丸、余额药丸四处都要挂 keepComposerFocus')
  const focused = source.match(/if \(ok\) focusComposer\(/g) ?? []
  assert.equal(focused.length, 3, '@ 引用、竖条提示词/技能、竖条官方命令降级：三处插入成功后都要把光标还回去（并带上触发元素用于收窄会话）')
  // 官方命令的 claim 路径不写文本，而是派发 `slash/input-begin-command` 让会话 shell
  // 去替换草稿；落成之后同样要把光标还给输入框（否则接着打字打不进去）。
  const claimed = source.match(/if \(applied === true\) focusComposer\(/g) ?? []
  assert.equal(claimed.length, 1, '官方命令 claim 落进草稿后也要把光标还回去')
})
