#!/usr/bin/env node
/**
 * P1.1 的验收脚本：确认 `contextLoss` 投影已在真实运行环境落地。
 *
 * 为什么需要它：DSH 桌面版没有任何刷新/DevTools 入口，客户端改动必须重启 App
 * 才能观察，所以"改完了"与"真的生效了"之间隔着一次人工确认。这个脚本把
 * **宿主那一半**的确认自动化（按 AGENTS.md 的唯一可靠判据：看投影缓存里有没有
 * 那个 key），剩下客户端那一半仍需人眼看界面。
 *
 * 用法：
 *   node scripts/verify-context-loss.mjs          # 只读检查
 *   node scripts/verify-context-loss.mjs --verbose # 附每个会话的折叠值
 *
 * 退出码：0 = 至少一个会话含该投影；1 = 未落地（宿主尚未重新装配）。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const KEY = 'contextLoss'
const CACHE = join(homedir(), '.dsh', 'storages', 'session_projcache', 'sessions')
const verbose = process.argv.includes('--verbose')

/** 投影 view 应有的字段（与 `lib/host-v19.js` 的 wire.view 一致）。 */
const EXPECTED = ['compactions', 'prunes', 'lostTokens', 'lastTurn']

let files
try {
  files = readdirSync(CACHE).filter((name) => name.endsWith('.json'))
} catch (error) {
  console.error('读不到投影缓存目录：' + CACHE)
  console.error('原因：' + String(error?.message ?? error))
  process.exit(1)
}

const hits = []
for (const name of files) {
  let record
  try {
    // ⚠ 层级是 { version, record: { identity, rows } } —— rows 在 record 下面。
    record = JSON.parse(readFileSync(join(CACHE, name), 'utf8'))?.record
  } catch {
    continue // 读坏或写到一半的文件：跳过，不算证据
  }
  const rows = record?.rows
  if (rows === undefined || rows === null || !Object.hasOwn(rows, KEY)) continue
  hits.push({
    session: name.replace(/^session-|\.json$/g, ''),
    cwd: record?.identity?.cwd ?? '(未知)',
    val: rows[KEY]?.val ?? null,
  })
}

console.log('扫描 ' + files.length + ' 个投影缓存文件，`' + KEY + '` 命中 ' + hits.length + ' 个会话。')

if (hits.length === 0) {
  console.error('')
  console.error('未落地。宿主尚未重新装配 —— 按顺序做这两步：')
  console.error('  1) 在本会话里对插件执行「停用 → 启用」（需要 set_plugin 工具，Agent 没有）')
  console.error('  2) 完全退出 DSH（Cmd+Q），再重新打开')
  console.error('然后重跑本脚本。')
  process.exit(1)
}

// 字段形状守卫：客户端读的就是这几个字段，缺一个那一格就会渲染成空的。
let bad = 0
for (const hit of hits) {
  const val = hit.val
  const missing = val === null || typeof val !== 'object'
    ? EXPECTED
    : EXPECTED.filter((field) => !Object.hasOwn(val, field))
  if (missing.length > 0) {
    console.error('⚠ 会话 ' + hit.session + ' 的投影缺字段：' + missing.join(', '))
    bad += 1
    continue
  }
  if (verbose) {
    console.log('  ' + hit.session + ' [' + hit.cwd + '] ' + JSON.stringify(val))
  }
}
if (bad > 0) {
  console.error('字段形状不符 —— 客户端那一格会显示不全。检查 `contextLossProjection.wire.view`。')
  process.exit(1)
}

console.log('')
console.log('✅ 宿主侧已闭环：投影落地且字段齐备（' + EXPECTED.join(' / ') + '）。')
console.log('最后一步需要人眼确认：输入框下方那排、内存读数之后，应出现')
console.log('  「尚未压缩过上下文」或「压缩 N 次 · 丢失 X」。')
process.exit(0)
