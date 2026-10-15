#!/usr/bin/env node
/**
 * 四条「静默失败」规则的可执行校验（审计 AUD-GOV-001 / 任务书 P1.2）。
 *
 * 为什么需要它：dsh-sym 有四处极易犯、且**违反后不报错**的约定 —— 表现一律是
 * "界面上没出现/没变化"，而不是抛异常。前三处在同一轮会话里各被违反过一次：
 *
 *   1. **跨端常量失配** —— 两端各持一份拷贝（客户端是浏览器 module factory，
 *      宿主是 Node 模块，不能共享）。失配时数据不显示，控制台无提示。
 *   2. **客户端双份不同步** —— profile 里那条 `file://` 只接管**宿主**，客户端
 *      半边仍按包名解析到 `node_modules/dsh-sym/lib/client.js`。改完工作副本不同步，
 *      浏览器永远读到旧代码（本轮为此让用户白等了两轮）。
 *   3. **投影 view 字段漂移** —— 客户端读的是 `wire.view` 的结果，**不是宿主 state**。
 *      形状不对时组件恒返回 null，格子静默消失（本轮连错三版）。
 *   4. **版本号跳段** —— 规则是"三段、每段最多两位数字、每次只加 0.0.1"（用户 2026-10-16 定），
 *      而工具与直觉都偏向语义化版本：`npm version major` 会推出 2.0.0，顺手也容易写成 1.9.0。
 *      违反不会让任何功能报错，只会在发布那一刻与规则冲突。
 *
 * 用法：`npm run check`（或 `node scripts/check-invariants.mjs`）。
 * 退出码：0 = 全部通过；1 = 有违规（并打印修复指引）。
 *
 * 零依赖：只用 Node 内置模块。`lib/client.js` 是浏览器 module factory，**不能
 * `import()`**（它第一行就调 `window.__ModuleLoader__.load`），所以常量与 view
 * 都按源码**正则提取**；正则失配按失败处理，绝不静默放过。
 *
 * ⚠ 做故障注入验证时**别用 `git checkout` 还原未跟踪文件**（`lib/host-v19.js` 就是
 * 未跟踪的），那条命令对 `??` 状态的文件无效，会留下一份真的被改坏的源码 ——
 * 2026-10-14 实际踩到：删掉 `lastFailed` 后用 `git checkout` 还原，字段没回来，
 * 反而是本脚本报的警才发现。还原请用 `cp` 自备份。
 */

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { isValidVersion, versionFromTag, looksLikeVersionTag, checkVersionAgainst } from './version-rule.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOST_SRC = join(ROOT, 'lib', 'host-v19.js')
const CLIENT_SRC = join(ROOT, 'lib', 'client.js')
const PACKED_CLIENT = join(homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-sym', 'lib', 'client.js')

const failures = []
const notes = []

/** 记一次失败，附带修复指引。 */
function fail(check, detail, fix) {
  failures.push({ check, detail, fix })
}

/** 读文件，读不到直接算失败。 */
function readOrFail(path, check) {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    fail(check, '读不到 ' + path + '：' + String(error?.message ?? error), '确认路径存在且可读。')
    return null
  }
}

// ── 检查 1：跨端契约常量一致 ───────────────────────────────────────────────
{
  const CHECK = '跨端常量'
  const host = readOrFail(HOST_SRC, CHECK)
  const client = readOrFail(CLIENT_SRC, CHECK)

  if (host !== null && client !== null) {
    // 每个常量：宿主与客户端各一条提取规则。任一侧提不到 = 失败（不静默）。
    const RULES = [
      { name: 'PROJECTION_KEY', host: /export const PROJECTION_KEY = '([^']*)'/, client: /const PROJECTION_KEY = "([^"]*)"/ },
      { name: 'QUICK_ACTIONS_KEY', host: /export const QUICK_ACTIONS_KEY = '([^']*)'/, client: /const QUICK_ACTIONS_KEY = "([^"]*)"/ },
      { name: 'GIT_STATUS_ROUTE', host: /export const GIT_STATUS_ROUTE = '([^']*)'/, client: /const GIT_STATUS_ROUTE = "([^"]*)"/ },
      { name: 'CONTEXT_LOSS_KEY', host: /export const CONTEXT_LOSS_KEY = '([^']*)'/, client: /const CONTEXT_LOSS_KEY = "([^"]*)"/ },
      { name: 'QUOTE_MARK_PREFIX', host: /export const QUOTE_MARK_PREFIX = '([^']*)'/, client: /const QUOTE_MARK_PREFIX = "([^"]*)"/ },
      { name: 'QUOTE_MARK_ID_LENGTH', host: /export const QUOTE_MARK_ID_LENGTH = (\d+)/, client: /const QUOTE_MARK_ID_LENGTH = (\d+)/ },
    ]
    for (const rule of RULES) {
      const h = host.match(rule.host)
      const c = client.match(rule.client)
      if (h === null) { fail(CHECK, '宿主的 ' + rule.name + ' 提取失败（正则不匹配）', '检查 lib/host-v19.js 里的定义形式；若是改名，同步更新本脚本。'); continue }
      if (c === null) { fail(CHECK, '客户端的 ' + rule.name + ' 提取失败（正则不匹配）', '检查 lib/client.js 的 contract 区；若是改名，同步更新本脚本。'); continue }
      if (h[1] !== c[1]) {
        fail(CHECK, rule.name + ' 两端不一致：宿主 "' + h[1] + '" vs 客户端 "' + c[1] + '"',
          '失配不会报错，只会表现为数据不显示或引用不展开。把两端改成同一值，然后跑 npm test。')
      }
    }
    if (failures.every((f) => f.check !== CHECK)) notes.push(CHECK + '：6 个常量两端一致')
  }
}

// ── 检查 2：客户端双份同步 ────────────────────────────────────────────────
{
  const CHECK = '客户端双份'
  const local = readOrFail(CLIENT_SRC, CHECK)
  if (!existsSync(PACKED_CLIENT)) {
    // 包副本不存在时不判失败：profile 可能改用包安装形态，那时这里本就没有副本。
    notes.push(CHECK + '：包副本不存在（' + PACKED_CLIENT + '），本项跳过')
  } else if (local !== null) {
    const packed = readOrFail(PACKED_CLIENT, CHECK)
    if (packed !== null && packed !== local) {
      fail(CHECK, '工作副本与 profile 包副本不一致（' + local.length + ' vs ' + packed.length + ' 字节）',
        '客户端半边按包名解析到包副本，界面读的是它。执行：\n'
        + '      cp ~/GitHub/DSH-Sym/lib/client.js ~/.dsh/profiles/desktop/node_modules/dsh-sym/lib/client.js\n'
        + '    然后完全退出 DSH（Cmd+Q）再打开 —— 该应用没有刷新快捷键。')
    } else if (packed !== null) {
      notes.push(CHECK + '：与包副本逐字节一致（' + local.length + ' 字节）')
    }
  }
}

// ── 检查 3：投影 view 字段形状 ────────────────────────────────────────────
{
  const CHECK = '投影 view'
  const host = readOrFail(HOST_SRC, CHECK)
  if (host !== null) {
    /**
     * 取某个投影的 `wire.view` 实际产出的字段名。
     *
     * ⚠ view 有两种写法：内联箭头函数（如 `contextLoss`），或指向一个**外部命名
     * 函数**（如 `sessionCost` 的 `view: viewOf`）。后者在定义块里只有函数名，
     * 字段要去那个函数体里找 —— 第一版只看定义块，于是把 sessionCost 误报成缺字段。
     *
     * @param keyLiteral - 形如 `PROJECTION_KEY` 的源码里的常量名。
     * @param fields - 期望出现在 view 里的字段名。
     */
    function viewFields(keyLiteral, fields) {
      const at = host.indexOf('key: ' + keyLiteral)
      if (at < 0) { fail(CHECK, '找不到投影 ' + keyLiteral + ' 的定义', '确认 lib/host-v19.js 里该投影仍存在。'); return }
      const seg = host.slice(at, at + 6000)
      const wireAt = seg.indexOf('wire:')
      if (wireAt >= 0) {
        // 若 view 指向外部函数，把该函数体也纳入检查范围。
        const wireSeg = seg.slice(wireAt, wireAt + 400)
        const ref = wireSeg.match(/view:\s*([A-Za-z_$][\w$]*)\s*[,}]/)
        if (ref !== null) {
          const fnAt = host.indexOf('function ' + ref[1] + '(')
          if (fnAt >= 0) {
            // 取到下一个顶层函数/常量定义为止，够覆盖整个 view 计算体。
            const rest = host.slice(fnAt)
            const endRel = rest.slice(10).search(/\n(function |const |\/\*\*)/)
            const fnBody = endRel < 0 ? rest : rest.slice(0, endRel + 10)
            for (const field of fields) {
              if (!fnBody.includes(field)) {
                fail(CHECK, keyLiteral + ' 的 view（' + ref[1] + '）缺字段 `' + field + '`',
                  '客户端读的就是 wire.view 的结果（不是宿主 state）。缺字段会让那一格渲染成空。')
              }
            }
            return
          }
        }
      }
      if (wireAt < 0) { fail(CHECK, keyLiteral + ' 没有 wire 块', '客户端要读它就必须有 wire.view。'); return }
      const viewSeg = seg.slice(wireAt, wireAt + 2000)
      for (const field of fields) {
        if (!viewSeg.includes(field)) {
          fail(CHECK, keyLiteral + ' 的 view 缺字段 `' + field + '`',
            '客户端读的就是 wire.view 的结果（不是宿主 state）。缺字段会让那一格渲染成空。')
        }
      }
    }
    viewFields('CONTEXT_LOSS_KEY', ['compactions', 'prunes', 'lostTokens', 'lastTurn'])
    viewFields('PROJECTION_KEY', ['requests', 'models', 'turns', 'memory'])

    // 公开契约：sessionCost 的投影**不存金额**（金额只在 view 里算）。
    if (/\b(amount|price|fx|cny)\s*:/.test(host.slice(0, host.length))) {
      // 只在 state 折叠区检查：找 sessionCostProjection 的 apply 段
      const at = host.indexOf('const sessionCostProjection')
      const seg = at < 0 ? '' : host.slice(at, host.indexOf('const contextLossProjection'))
      if (/\b(amount|price|fx)\s*:/.test(seg)) {
        fail(CHECK, 'sessionCost 的折叠状态里出现了金额字段（amount/price/fx）',
          '公开契约规定：投影只存 token 与计数，金额只在 wire.view 里算。')
      }
    }
    if (failures.every((f) => f.check !== CHECK)) notes.push(CHECK + '：contextLoss / sessionCost 的 view 字段齐备')
  }
}

// ── 检查 4：版本号规则 ────────────────────────────────────────────────────
{
  const CHECK = '版本号规则'

  /** 本地 tag 清单；git 不可用 / 不是仓库时返回空数组（环境问题，不判失败）。 */
  function gitTags() {
    try {
      const r = spawnSync('git', ['tag', '--list'], { cwd: ROOT, encoding: 'utf8', timeout: 5000 })
      if (r.status !== 0 || typeof r.stdout !== 'string') return []
      return r.stdout.split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
    } catch { return [] }
  }

  const RULE = '规则：三段、每段最多两位数字（0–99）、每次只在第三段 +1（满 99 进位）。\n'
    + '    口径见 CHANGELOG.md 顶部「发布规则」；可执行实现见 scripts/version-rule.mjs。'

  const pkg = readOrFail(join(ROOT, 'package.json'), CHECK)
  if (pkg !== null) {
    let version = null
    try {
      version = JSON.parse(pkg).version ?? null
    } catch (error) {
      fail(CHECK, 'package.json 解析失败：' + String(error?.message ?? error), '修好 JSON 语法。')
    }

    // ① 格式：不合规则当场报，不等 tag 比较。
    if (version !== null && !isValidVersion(version)) {
      fail(CHECK, 'package.json 的 version "' + version + '" 不合规则', RULE
        + '\n    反例：1.8.100（段超两位）、01.8.1（前导零）、1.8（段数不对）。')
    }

    const tags = gitTags()

    // ② 看起来像版本号的 tag 也要合规则 —— `v1.8.100` 不能因为"解析不出来"就被静默跳过。
    for (const tag of tags) {
      if (looksLikeVersionTag(tag) && versionFromTag(tag) === null) {
        fail(CHECK, 'tag ' + tag + ' 不合版本号规则', RULE)
      }
    }

    // ③ 递增：只允许「等于最新 tag」或「等于它的下一个版本」，其余（含"看起来更合理"的 1.9.0）都违规。
    if (version !== null && isValidVersion(version)) {
      const verdict = checkVersionAgainst(version, tags.map(versionFromTag).filter((v) => v !== null))
      if (!verdict.ok) {
        fail(CHECK, 'version ' + version + ' 既不是最新 tag（' + verdict.latest + '），也不是它的下一个版本',
          RULE + '\n    从 ' + verdict.latest + ' 出发只能是 '
          + (verdict.expected === null ? '（已到 99.99.99，无法再升）' : verdict.expected)
          + '。**不要**用 `npm version minor` / `npm version major`，也不要按语义化版本推。')
      } else if (verdict.latest === null) {
        notes.push(CHECK + '：' + version + ' 格式合法（无版本 tag 可比，跳过递增校验）')
      } else {
        notes.push(CHECK + '：' + version + '（最新 tag ' + verdict.latest + '）')
      }
    }
  }
}

// ── 汇总 ─────────────────────────────────────────────────────────────────
for (const note of notes) console.log('  ✓ ' + note)
if (failures.length === 0) {
  console.log('\n全部不变量通过（' + notes.length + ' 项）。')
  process.exit(0)
}
console.error('')
for (const f of failures) {
  console.error('✗ [' + f.check + '] ' + f.detail)
  console.error('  修复：' + f.fix)
}
console.error('\n' + failures.length + ' 项违规。这些都不会在界面上报错，只会静默失效。')
process.exit(1)
