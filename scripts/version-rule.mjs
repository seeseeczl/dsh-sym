/**
 * 版本号规则的可执行实现（用户 2026-10-16 定）。
 *
 * 规则：**三段、每段最多两位数字（0–99）；每次更新只在第三段 +1；满 99 进位。**
 * 唯一口径在 `CHANGELOG.md` 顶部「发布规则」，本模块是它的可执行副本 ——
 * 发现不一致时先改 CHANGELOG，再改这里。
 *
 * 纯函数、无副作用、零依赖：由 `scripts/check-invariants.mjs`（第 4 条不变量）
 * 与 `test/version-rule.test.mjs` 共用。**不要**在这里读文件或跑 git。
 */

/** 每段的硬上限。 */
export const SEGMENT_MAX = 99

/**
 * 严格解析版本号：三段、每段 1–2 位数字、不接受前导零。
 *
 * @param value - 待解析的字符串。
 * @returns `[主, 次, 修订]`，或 `null`（段数不对 / 超两位 / 前导零 / 非字符串）。
 */
export function parseVersion(value) {
  if (typeof value !== 'string') return null
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/.exec(value.trim())
  if (m === null) return null
  const raw = [m[1], m[2], m[3]]
  // 前导零不是规范写法：'01.8.1' 要被拒，否则同一个版本会有两种合法拼写。
  if (raw.some((s) => s.length > 1 && s.startsWith('0'))) return null
  const parts = raw.map(Number)
  if (parts.some((n) => n > SEGMENT_MAX)) return null
  return parts
}

/** 是否符合版本号规则。 */
export function isValidVersion(value) {
  return parseVersion(value) !== null
}

/**
 * 下一个版本号：只在第三段 +1；满 99 才进位。
 *
 * @param value - 当前版本号。
 * @returns 下一个版本号；入参非法或已到 `99.99.99`（封顶）时返回 `null`。
 */
export function nextVersion(value) {
  const parts = parseVersion(value)
  if (parts === null) return null
  const [major, minor, patch] = parts
  if (patch < SEGMENT_MAX) return major + '.' + minor + '.' + (patch + 1)
  if (minor < SEGMENT_MAX) return major + '.' + (minor + 1) + '.0'
  if (major < SEGMENT_MAX) return (major + 1) + '.0.0'
  return null
}

/** 去掉可选的 `v` 前缀后解析；不是合法版本号时返回 `null`。 */
export function versionFromTag(tag) {
  if (typeof tag !== 'string') return null
  const raw = tag.trim().replace(/^v/, '')
  return isValidVersion(raw) ? raw : null
}

/**
 * 这个 tag 是不是**想表达**一个版本号。
 *
 * 用途：`v1.8.100` 的 `versionFromTag` 也是 `null`，但它显然是版本 tag 且**违反了规则**，
 * 不能和 `v1.8.0-experimental` 这类非版本 tag 一样被静默跳过。
 */
export function looksLikeVersionTag(tag) {
  return typeof tag === 'string' && /^v?\d+(\.\d+)*$/.test(tag.trim())
}

/** 从若干版本号里取最大的那个（非法的忽略）；没有合法的返回 `null`。 */
export function latestVersion(versions) {
  let latest = null
  for (const value of versions) {
    const a = parseVersion(value)
    if (a === null) continue
    const b = latest === null ? null : parseVersion(latest)
    const greater = b === null
      || a[0] > b[0]
      || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))
    if (greater) latest = value
  }
  return latest
}

/**
 * 把当前版本号与既有版本号序列对照，判断是否合规则。
 *
 * 允许两种情形：① 等于最新版本（这一版已发布、尚未升版）；② 等于它的下一个版本
 * （按规则升了一格）。其余一律违规 —— 包括"看起来更合理"的 `1.9.0`。
 *
 * @param version - `package.json` 的当前版本号。
 * @param versions - 已知的版本号（通常来自 git tag 的解引用）。
 * @returns `{ ok: true, latest, stepped }` 或 `{ ok: false, reason, latest, expected }`。
 */
export function checkVersionAgainst(version, versions) {
  if (!isValidVersion(version)) return { ok: false, reason: 'format' }
  const latest = latestVersion(versions)
  if (latest === null) return { ok: true, latest: null, stepped: false }
  if (version === latest) return { ok: true, latest, stepped: false }
  const expected = nextVersion(latest)
  if (expected !== null && version === expected) return { ok: true, latest, stepped: true }
  return { ok: false, reason: 'step', latest, expected }
}
