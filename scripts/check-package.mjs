#!/usr/bin/env node
/**
 * 发布产物完整性核对（审计 AUD-SUPPLY-001 / 任务书 P2.2）。
 *
 * `npm pack` 的产物是用户真正装到 profile 里的东西，而它只由 `package.json` 的
 * `files` 白名单与 `exports` 映射决定 —— 两处任一处写错，表现都是**装完就不工作**：
 * 入口 404、客户端半边缺失、价目表丢了。所以在发布前拿真实产物核一遍，而不是
 * 相信源码树里"文件都在"。
 *
 * 用法：`npm run check:pack`。
 * 退出码：0 = 通过；1 = 缺失或入口不可加载。
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 包必须自带的文件 —— 少一个都会让插件装不上或功能残缺。 */
const REQUIRED = [
  'package.json',          // 加载器据此找入口与 patch
  'cordis.patch.yml',      // 包形态的装配补丁
  'lib/host-v19.js',       // 宿主入口（`exports["."]`）
  'lib/client.js',         // 客户端半边（`exports["./client"]`）
  'lib/prices.json',       // 价目来源之一
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
]

const failures = []

// ── 1) 真实产物清单 ──────────────────────────────────────────────────────
let packed = []
try {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  packed = (JSON.parse(out)?.[0]?.files ?? []).map((f) => f.path)
} catch (error) {
  console.error('跑不动 `npm pack --dry-run`：' + String(error?.message ?? error))
  process.exit(1)
}
if (packed.length === 0) {
  console.error('产物清单为空 —— 核对无法进行。')
  process.exit(1)
}

for (const path of REQUIRED) {
  if (!existsSync(join(ROOT, path))) {
    failures.push({ what: path, why: '源码树里就不存在', fix: '确认文件名（宿主换名后要同步 package.json 的 files/exports）。' })
    continue
  }
  if (!packed.includes(path)) {
    failures.push({ what: path, why: '存在但**没有**进包（不在 files 白名单/被 .npmignore 排除）', fix: '把该路径加进 package.json 的 files。' })
  }
}

// ── 2) exports 指向的入口必须在包里 ──────────────────────────────────────
const { default: pkg } = await import(join(ROOT, 'package.json'), { with: { type: 'json' } }).catch(() => ({ default: null }))
if (pkg === null) {
  failures.push({ what: 'package.json', why: '读不出（JSON 非法）', fix: '修好 JSON 语法。' })
} else {
  const entries = [pkg.main, pkg.exports?.['.']?.default, pkg.exports?.['./client']?.default].filter((v) => typeof v === 'string')
  for (const entry of entries) {
    const rel = entry.replace(/^\.\//, '')
    if (!packed.includes(rel)) {
      failures.push({ what: entry, why: 'exports/main 指向它，但它不在包里', fix: '同步 files 白名单与 exports。' })
    }
  }
  // 宿主入口必须真的能被 Node 加载（语法/顶层 import 错会在这里暴露）。
  const hostEntry = (pkg.exports?.['.']?.default ?? pkg.main ?? '').replace(/^\.\//, '')
  if (hostEntry !== '' && packed.includes(hostEntry)) {
    try {
      await import(join(ROOT, hostEntry))
    } catch (error) {
      failures.push({ what: hostEntry, why: '能进包但 import 失败：' + String(error?.message ?? error), fix: '修到 `node -e "import(...)"` 能过为止。' })
    }
  }
}

// ── 3) 包形态的 patch 不能引用工作副本的绝对路径 ─────────────────────────
try {
  const { readFileSync } = await import('node:fs')
  const patch = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8')
  if (patch.includes('file://')) {
    failures.push({
      what: 'cordis.patch.yml',
      why: '含 `file://` 绝对路径 —— 那是**开发期挂载**，发到别人机器上必然 404',
      fix: '包内 patch 一律用裸包名 insert；`file://` 只留在本机 profile 的 cordis.patch.yml 里。',
    })
  }
} catch { /* 文件不存在已在第 1 步报过 */ }

// ── 汇总 ─────────────────────────────────────────────────────────────────
if (failures.length === 0) {
  console.log('  ✓ 产物 ' + packed.length + ' 个文件；' + REQUIRED.length + ' 项必需文件齐备，导出入口可加载。')
  process.exit(0)
}
for (const f of failures) {
  console.error('✗ ' + f.what + ' —— ' + f.why)
  console.error('  修复：' + f.fix)
}
console.error('\n' + failures.length + ' 项问题。')
process.exit(1)
