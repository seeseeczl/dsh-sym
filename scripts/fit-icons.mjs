/**
 * 生成图标"大小校正表"（ICON_FIT）—— 统一视觉尺寸，不是统一包围盒。
 *
 * 规则（2026-10-09 定）：
 *   1. 量每枚图标的**墨迹包围盒**（几何范围 + 半个描边，圆头/圆角会外扩），
 *      曲线按采样展平（三次/二次贝塞尔、圆弧按 SVG 规范 F.6.5 转中心参数化）。
 *   2. 取较大边 S 归一到目标值 **TARGET = 12**（16 格 viewBox 里的 12 格，即 75%）。
 *      12 是这套图标的**众数**（43/105 枚本来就在 12.0），所以多数图标几乎不动，
 *      只把过小的放大、过大的收小 —— 这就是"减少大小差距"。
 *   3. 同时把**墨迹中心回正到格心 (8,8)**：15 枚原本偏 >0.6 格，看着像没对齐。
 *   4. 缩放系数夹在 [MIN_K, MAX_K]：`dot` 这类语义上就小的字形不该被放大成巨点。
 *   5. **笔宽不变**：渲染时用 `translate(dx,dy) scale(k)`，并把 `stroke-width`
 *      设为 `QUICK_ICON_STROKE / k`，缩放与补偿相消 → 屏幕上仍是原来的笔宽。
 *
 * 用法：
 *   node scripts/fit-icons.mjs            # 只算并打印统计
 *   node scripts/fit-icons.mjs --write    # 把表写回 lib/client.js 的标记之间
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadClient } from '../test/helpers/load-client.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/**
 * 整体缩放。演进：1.0（原始）→ **1.2**（2026-10-09 用户："整体再大 20%"）→
 * **1.08**（同日用户："所有图标缩小 10%"，即 1.2 × 0.9）。
 *
 * 它同时乘到归一目标与夹取区间上，所以**每一枚图标都恰好大 20%**（连触到夹取的
 * `dot` / `square` 也一样，因为夹取上限同步乘了 1.2）。
 * 笔宽不受影响：渲染时描边写成 `QUICK_ICON_STROKE / k`，缩放乘多少就被除回去多少。
 * 渲染框仍是 20px（不是把 SVG 放大到 24px），所以之前修好的像素栅格对齐不会被破坏。
 */
const ZOOM = 1.08
const TARGET = 12 * ZOOM
/**
 * 夹取区间。2026-10-09 第二次校正时**放宽**（原 [0.75,1.3]×ZOOM 会把 `dot` / `square`
 * 挡在目标之外，残留 2.86 格的差距 —— 那正是"大小不一"看得见的原因）。
 * 现在它不再对任何一枚生效，只作为"数据出错时别把图标放大到离谱"的保险。
 */
const MIN_K = 0.7
const MAX_K = 2.0

/**
 * 光学补偿：同样包围盒，**圆看着比方小**（面积比 π/4 ≈ 0.785），
 * 所以圆形为主的字形要外扩一点。规范给的是 2–4%，这里取 **2%**（保守）——
 * 目标 14.4 格已经很满，再多会贴到 viewBox 边缘。
 * 判定规则（可解释）：图标里存在一个**直径 ≥ 85% 墨迹较大边**的 circle。
 */
const ROUND_BUMP = 1.02
const ROUND_RATIO = 0.85

const NUM = /-?\d*\.?\d+/g

function* flattenCubic(p0, p1, p2, p3, n = 16) {
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t
    yield [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
           u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]
  }
}

function* flattenQuad(p0, p1, p2, n = 16) {
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t
    yield [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]
  }
}

function* flattenArc(p0, rx, ry, phiDeg, largeArc, sweep, p1, n = 24) {
  if (rx === 0 || ry === 0) { yield p1; return }
  const phi = (phiDeg * Math.PI) / 180
  const cos = Math.cos(phi), sin = Math.sin(phi)
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy
  let rxs = rx * rx, rys = ry * ry
  const lam = (x1 * x1) / rxs + (y1 * y1) / rys
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; rxs = rx * rx; rys = ry * ry }
  const den = rxs * y1 * y1 + rys * x1 * x1
  const coef = den === 0 ? 0 : (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (rxs * rys - rxs * y1 * y1 - rys * x1 * x1) / den))
  const cxp = (coef * rx * y1) / ry, cyp = (-coef * ry * x1) / rx
  const cx = cos * cxp - sin * cyp + (p0[0] + p1[0]) / 2
  const cy = sin * cxp + cos * cyp + (p0[1] + p1[1]) / 2
  const angle = (ux, uy, vx, vy) => {
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    if (len === 0) return 0
    const a = Math.acos(Math.min(1, Math.max(-1, (ux * vx + uy * vy) / len)))
    return ux * vy - uy * vx < 0 ? -a : a
  }
  const theta0 = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
  let dTheta = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry)
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI
  for (let i = 1; i <= n; i++) {
    const th = theta0 + (dTheta * i) / n
    yield [cx + rx * Math.cos(th) * cos - ry * Math.sin(th) * sin, cy + rx * Math.cos(th) * sin + ry * Math.sin(th) * cos]
  }
}

/** 一条 path 的 d → 点列。 */
export function flattenPath(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+/g) ?? []
  const pts = []
  let i = 0, cmd = null, cur = [0, 0], start = [0, 0], prevCtrl = null
  const take = (n) => toks.slice(i, i + n).map(Number).map((v) => (i += 1, v))
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i]; i += 1 } else if (cmd === 'M') cmd = 'L'
    else if (cmd === 'm') cmd = 'l'
    const lower = cmd === cmd.toLowerCase()
    const bx = lower ? cur[0] : 0, by = lower ? cur[1] : 0
    switch (cmd.toUpperCase()) {
      case 'M': { const [x, y] = take(2); cur = [x + bx, y + by]; start = [...cur]; pts.push([...cur]); prevCtrl = null; break }
      case 'L': { const [x, y] = take(2); cur = [x + bx, y + by]; pts.push([...cur]); prevCtrl = null; break }
      case 'H': { const [x] = take(1); cur = [x + (lower ? cur[0] : 0), cur[1]]; pts.push([...cur]); prevCtrl = null; break }
      case 'V': { const [y] = take(1); cur = [cur[0], y + (lower ? cur[1] : 0)]; pts.push([...cur]); prevCtrl = null; break }
      case 'C': { const [a, b, c, d2, x, y] = take(6); const p1 = [a + bx, b + by], p2 = [c + bx, d2 + by], p3 = [x + bx, y + by]
        pts.push(...flattenCubic(cur, p1, p2, p3)); prevCtrl = p2; cur = p3; break }
      case 'S': { const [c, d2, x, y] = take(4); const p1 = prevCtrl ? [2 * cur[0] - prevCtrl[0], 2 * cur[1] - prevCtrl[1]] : [...cur]
        const p2 = [c + bx, d2 + by], p3 = [x + bx, y + by]; pts.push(...flattenCubic(cur, p1, p2, p3)); prevCtrl = p2; cur = p3; break }
      case 'Q': { const [a, b, x, y] = take(4); const p1 = [a + bx, b + by], p2 = [x + bx, y + by]
        pts.push(...flattenQuad(cur, p1, p2)); prevCtrl = p1; cur = p2; break }
      case 'T': { const [x, y] = take(2); const p1 = prevCtrl ? [2 * cur[0] - prevCtrl[0], 2 * cur[1] - prevCtrl[1]] : [...cur]
        const p2 = [x + bx, y + by]; pts.push(...flattenQuad(cur, p1, p2)); prevCtrl = p1; cur = p2; break }
      case 'A': { const [rx, ry, rot, la, sw, x, y] = take(7); const p1 = [x + bx, y + by]
        pts.push(...flattenArc(cur, rx, ry, rot, la, sw, p1)); prevCtrl = null; cur = p1; break }
      case 'Z': { pts.push([...start]); cur = [...start]; prevCtrl = null; break }
      default: i += 1
    }
  }
  return pts
}

/** 一枚图标的墨迹包围盒（含描边外扩；stroke:"none" 的填充形状不外扩）。 */
export function inkBox(shapes, halfStroke) {
  const xs = [], ys = []
  const N = (v) => Number(v)
  const add = (pts, inflate) => { for (const [x, y] of pts) { xs.push(x - inflate, x + inflate); ys.push(y - inflate, y + inflate) } }
  for (const [tag, attrs] of shapes) {
    const pad = attrs.stroke === 'none' ? 0 : halfStroke
    if (tag === 'path') add(flattenPath(attrs.d), pad)
    else if (tag === 'circle') { const cx = N(attrs.cx), cy = N(attrs.cy), r = N(attrs.r); add([[cx - r, cy - r], [cx + r, cy + r]], pad) }
    else if (tag === 'rect') { const x = N(attrs.x), y = N(attrs.y), w = N(attrs.width), h = N(attrs.height); add([[x, y], [x + w, y + h]], pad) }
    else if (tag === 'line') add([[N(attrs.x1), N(attrs.y1)], [N(attrs.x2), N(attrs.y2)]], pad)
    else add([[0, 0]], pad)
  }
  if (xs.length === 0) return null
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

/** 算校正表：{ name: [k, dx, dy] } —— dx/dy 是"缩放之后再平移"的量。 */
export function fitTable(icons, stroke) {
  const table = {}
  for (const [name, shapes] of Object.entries(icons)) {
    const box = inkBox(shapes, stroke / 2)
    if (box === null) continue
    const s = Math.max(box.w, box.h)
    // 圆形为主 → 按光学补偿略微外扩（只放大几何；笔宽照旧由渲染侧除以 k 抵消）
    const biggestCircle = Math.max(0, ...shapes
      .filter(([tag, attrs]) => tag === 'circle' && attrs.stroke !== 'none')
      .map(([, attrs]) => Number(attrs.r) * 2))
    const bump = s > 0 && biggestCircle / s >= ROUND_RATIO ? ROUND_BUMP : 1
    const k = Math.min(MAX_K, Math.max(MIN_K, (TARGET * bump) / s))
    // 让墨迹中心落在格心：先按 k 缩放，再把缩放后的中心移回 (8,8)
    table[name] = [Number(k.toFixed(3)), Number((8 - k * box.cx).toFixed(2)), Number((8 - k * box.cy).toFixed(2))]
  }
  return table
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const client = loadClient()
  const stroke = client.QUICK_ICON_STROKE
  const icons = client.QUICK_ICONS
  const table = fitTable(icons, stroke)
  const before = Object.entries(icons).map(([n, sh]) => Math.max(inkBox(sh, stroke / 2).w, inkBox(sh, stroke / 2).h))
  const after = Object.entries(icons).map(([n, sh]) => {
    const b = inkBox(sh, stroke / 2), [k] = table[n] ?? [1]
    return Math.max(b.w, b.h) * k
  })
  const spread = (a) => `min ${Math.min(...a).toFixed(2)} / max ${Math.max(...a).toFixed(2)} / 极差 ${(Math.max(...a) - Math.min(...a)).toFixed(2)}`
  console.log('校正前：', spread(before))
  console.log('校正后：', spread(after), `（夹在 ${MIN_K}~${MAX_K} 之间，所以两端仍有残差）`)
  const clampLow = Object.entries(table).filter(([, [k]]) => k <= MIN_K + 1e-6).map(([n]) => n)
  const clampHigh = Object.entries(table).filter(([, [k]]) => k >= MAX_K - 1e-6).map(([n]) => n)
  console.log('触到上限 ' + MAX_K + '（想缩但只能缩到这里）：', clampHigh.join(' ') || '（无）')
  console.log('触到下限 ' + MIN_K + '（想放但只能放到这里）：', clampLow.join(' ') || '（无）')
  const identity = Object.values(table).filter(([k]) => Math.abs(k - 1) < 0.02).length
  console.log(`k≈1（既没放大也没收小，含整体 ZOOM=${ZOOM}）的枚数：`, identity)
  if (process.argv.includes('--write')) {
    const path = join(ROOT, 'lib/client.js')
    const src = readFileSync(path, 'utf8')
    const names = Object.keys(table)
    const nums = names.flatMap((n) => table[n])
    const payload =
      `\t\tconst ICON_FIT_NAMES = ${JSON.stringify(names.join(','))};\n` +
      `\t\tconst ICON_FIT_NUMBERS = [${nums.map((v) => (Number.isInteger(v) ? v : v)).join(',')}];`
    const re = /\/\/#region ICON_FIT[\s\S]*?\/\/#endregion ICON_FIT/
    const block = `//#region ICON_FIT（由 scripts/fit-icons.mjs --write 生成，勿手改）\n${payload}\n\t\t//#endregion ICON_FIT`
    if (!re.test(src)) throw new Error('没找到 ICON_FIT 标记区，先在 client.js 里放好标记')
    writeFileSync(path, src.replace(re, block))
    console.log('已写回 lib/client.js：', names.length, '枚')
  }
}
