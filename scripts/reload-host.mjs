#!/usr/bin/env node
/**
 * dsh-sym — 宿主入口换名助手。
 *
 * 来源发现：AUD-OPS-002（宿主改动流程会累积幽灵模块）。宿主代码不热重载，
 * 每次改 `lib/host-v*.js` 都要"停用插件 → 换文件名 → 同步引用 → 启用"。
 * 手工做这件事漏一处，插件就会静默不生效。这个脚本只做其中**机械的两步**：
 * 换文件名、把所有引用一起改掉，并把"还需要人做什么"打印出来。
 *
 * 它**不**调用任何 DSH 内部 API（任务卡 P1-04 的停止条件）：停用/启用插件、
 * 重启 App 都留给人。默认是 dry-run，只有显式 `--apply` 才写盘。
 *
 * 用法：
 *   node scripts/reload-host.mjs --dry-run              # 只打印将要改动的文件与行
 *   node scripts/reload-host.mjs --apply                # 真改：v6 → v7，并同步引用
 *   node scripts/reload-host.mjs --to host-v18.js --apply
 *   node scripts/reload-host.mjs --profile ~/.dsh/profiles/other
 *
 * 退出码：0 正常（含 dry-run）；1 参数或环境有问题。
 */

import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARGS = process.argv.slice(2)

/** 取 `--name value` 形式的值。 */
function option(name, fallback) {
  const index = ARGS.indexOf(name)
  return index >= 0 && ARGS[index + 1] !== undefined ? ARGS[index + 1] : fallback
}

const APPLY = ARGS.includes('--apply')
const DRY_RUN = !APPLY || ARGS.includes('--dry-run')
const PROFILE = resolve(option('--profile', join(homedir(), '.dsh', 'profiles', 'desktop')))

/** 要同步改写引用的文件类型；node_modules/.git 不遍历。 */
const SCANNED_EXTENSIONS = ['.json', '.yml', '.yaml', '.md', '.mjs', '.js']
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'coverage'])
/**
 * 历史审计产物**永不覆盖**（AGENTS.md 的治理约定）：里面提到的旧文件名是当时的
 * 事实，改掉就毁了证据链。活文档（README、AGENTS.md、openspec、任务书）照改。
 */
const SKIPPED_PATH_PREFIXES = ['docs/05-audits/', 'adversarial-audits/']

/** 递归收集仓库内所有可能提到入口文件名的文本文件。 */
function collectFiles(directory, found = []) {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue
    const full = join(directory, entry)
    const relative = full.slice(ROOT.length + 1)
    if (SKIPPED_PATH_PREFIXES.some((prefix) => relative.startsWith(prefix))) continue
    const info = statSync(full)
    if (info.isDirectory()) {
      collectFiles(full, found)
      continue
    }
    if (SCANNED_EXTENSIONS.some((extension) => entry.endsWith(extension))) found.push(full)
  }
  return found
}

/** 当前入口：以 package.json 的 `main` 为准，而不是猜 lib/host-v*.js。 */
function currentEntry() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const main = manifest.main
  if (typeof main !== 'string' || !main.startsWith('lib/host-v')) {
    throw new Error('package.json 的 main 不是 lib/host-v<N>.js，无法推断入口：' + String(main))
  }
  return main
}

/** v6 → v7；已经是 vN 就 +1。 */
function nextEntry(entry, explicit) {
  if (explicit !== undefined) return join('lib', explicit)
  const match = /^lib\/host-v(\d+)\.js$/.exec(entry)
  if (match === null) throw new Error('无法从入口推断下一个版本号：' + entry)
  return 'lib/host-v' + String(Number(match[1]) + 1) + '.js'
}

/** 一个文件里所有需要替换的行，附行号与替换后的文本。 */
function planFile(file, from, to) {
  if (!existsSync(file)) return null
  const text = readFileSync(file, 'utf8')
  if (!text.includes(from)) return null
  const lines = text.split('\n')
  const hits = []
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes(from)) continue
    hits.push({ line: index + 1, before: lines[index].trim(), after: lines[index].split(from).join(to).trim() })
  }
  return { file, hits, rewrite: () => writeFileSync(file, text.split(from).join(to)) }
}

function main() {
  const entry = currentEntry()
  const target = nextEntry(entry, option('--to', undefined))
  const from = entry.replace(/^lib\//, '')
  const to = target.replace(/^lib\//, '')

  console.log('dsh-sym 宿主入口换名')
  console.log('  仓库：' + ROOT)
  console.log('  当前入口：' + entry)
  console.log('  目标入口：' + target)
  console.log('  模式：' + (DRY_RUN ? 'dry-run（不写盘；要执行加 --apply）' : 'apply（将写盘）'))
  console.log('')

  const entryPath = join(ROOT, entry)
  const targetPath = join(ROOT, target)
  if (!existsSync(entryPath)) {
    console.error('找不到当前入口文件：' + entryPath)
    process.exitCode = 1
    return
  }
  if (existsSync(targetPath)) {
    console.error('目标文件已存在，换名会覆盖它：' + targetPath)
    process.exitCode = 1
    return
  }

  // 仓库内所有提到入口名的文件，外加用户的 profile patch（在仓库之外）。
  const candidates = collectFiles(ROOT)
  const profilePatch = join(PROFILE, 'cordis.patch.yml')
  if (existsSync(profilePatch)) candidates.push(profilePatch)

  const plans = []
  for (const file of candidates) {
    const plan = planFile(file, from, to)
    if (plan !== null) plans.push(plan)
  }

  console.log('将改名：')
  console.log('  ' + entry + ' → ' + target)
  console.log('')
  console.log('将改写引用（' + String(plans.length) + ' 个文件）：')
  if (plans.length === 0) console.log('  （没有找到引用，可能已经改过名）')
  for (const plan of plans) {
    const shown = plan.file.startsWith(ROOT) ? plan.file.slice(ROOT.length + 1) : plan.file
    console.log('  ' + shown)
    for (const hit of plan.hits) {
      console.log('    L' + String(hit.line) + ': ' + hit.before)
      console.log('      → ' + hit.after)
    }
  }

  if (!DRY_RUN) {
    renameSync(entryPath, targetPath)
    for (const plan of plans) plan.rewrite()
    console.log('')
    console.log('已改名并同步 ' + String(plans.length) + ' 个文件的引用。')
  }

  console.log('')
  console.log('⚠ 接下来必须由人来做的（脚本不碰 DSH 内部 API）：')
  console.log('  1) 在会话里停用 sym-cost 插件，再重新启用 —— 让宿主按新文件重新加载。')
  console.log('  2) 重启 DeepSeek Harness：旧模块仍留在宿主内存里，只有重启能清干净（AUD-OPS-002）。')
  console.log('  3) 重启后确认状态栏两个金额、余额、峰谷标记、@ 引用都还在。')
}

try {
  main()
} catch (error) {
  console.error('换名失败：' + (error !== null && error !== undefined && error.message !== undefined ? error.message : String(error)))
  process.exitCode = 1
}
