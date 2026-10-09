import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * 分支菜单的**点击链路**回归（CR-0002 评审整改 A4）。
 *
 * 这一份故意不复用 `helpers/load-client.mjs`：那个替身的 `useState` 是 no-op，
 * 只够"渲染一次不炸"；这里需要**真的重渲染**才能验证「点分支名 → 出菜单 → 选另一支 →
 * 胶囊改名」。所以自带一个迷你 hook 运行时，并给 `ref` 接上一个假的按钮节点
 * （`getBoundingClientRect` / `contains`），让菜单定位与"点外部关闭"这两段逻辑也能跑到。
 *
 * 全程不联网：`fetch` 被换成按 URL 回放的假实现。
 */

const CLIENT = new URL('../lib/client.js', import.meta.url)

const MAIN = {
  root: '/repo',
  branches: [{ name: 'main', current: true }, { name: 'feat/x', current: false }],
  branch: 'main', detached: false, head: 'abc1234', upstream: 'origin/main',
  ahead: 0, behind: 0, files: 2, added: 10, deleted: 3, untracked: 0,
}
const FEAT = { ...MAIN, branches: [{ name: 'main', current: false }, { name: 'feat/x', current: true }], branch: 'feat/x', added: 42, deleted: 0 }

/** 一个够用的 React 替身：useState 真的会重渲染，ref 会挂上假节点。 */
function miniReact() {
  const hooks = []
  const state = { cursor: 0, dirty: false, calls: [] }
  const fakeNode = () => ({
    getBoundingClientRect: () => ({ left: 900, top: 20, right: 1100, bottom: 44 }),
    contains: () => false,
    querySelectorAll: () => [],
    focus() {},
  })
  return {
    state,
    react: {
      createElement: (type, props, ...kids) => {
        const p = props ?? {}
        if (p.ref !== void 0 && p.ref !== null && typeof p.ref === 'object') p.ref.current = fakeNode()
        return { type, props: p, kids: kids.flat(Infinity).filter((kid) => kid !== null && kid !== void 0 && kid !== false) }
      },
      useState(init) {
        const i = state.cursor++
        if (hooks.length <= i) hooks[i] = { value: typeof init === 'function' ? init() : init }
        const slot = hooks[i]
        slot.set = (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; state.dirty = true }
        return [slot.value, slot.set]
      },
      useRef(init) { const i = state.cursor++; if (hooks.length <= i) hooks[i] = { current: init }; return hooks[i] },
      useCallback(fn) { state.cursor++; return fn },
      useMemo(fn) { state.cursor++; return fn() },
      useEffect(fn) { const i = state.cursor++; hooks[i] = fn },
      memo: (c) => c,
      Component: class { constructor(props) { this.props = props } },
    },
    flushEffects: () => { for (const hook of hooks) if (typeof hook === 'function') hook() },
    resetCursor: () => { state.cursor = 0 },
  }
}

/** 物化客户端 bundle，并返回组件 + 交互工具。 */
function mount(payloads) {
  const mini = miniReact()
  const calls = mini.state.calls
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window')
  const savedWindow = globalThis.window
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document')
  const savedDocument = globalThis.document
  let captured = null
  globalThis.window = { __ModuleLoader__: { load: (mod) => { captured = mod } }, innerWidth: 1440, innerHeight: 900, addEventListener() {}, removeEventListener() {} }
  globalThis.document = {
    querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {} }),
    head: { appendChild: () => {} }, body: {}, visibilityState: 'visible', activeElement: null,
    documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {} },
    addEventListener() {}, removeEventListener() {},
  }
  // 组件里有 5s 轮询；不清理的话 node:test 进程永远不会退出（这是把 /tmp 脚本
  // 搬进仓库时才暴露的问题：脚本里靠 process.exit 掩盖了）。
  const timers = new Set()
  const trackInterval = (fn, ms) => { const id = setInterval(fn, ms); timers.add(id); return id }
  const trackClear = (id) => { timers.delete(id); clearInterval(id) }
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET'
    calls.push({ url: String(url), method, body: options.body === void 0 ? null : JSON.parse(options.body) })
    if (method === 'POST') return { ok: true, status: 200, json: async () => ({ ok: true, payload: payloads.post }) }
    return { ok: true, status: 200, json: async () => payloads.get }
  }
  const source = readFileSync(CLIENT, 'utf8')
  new Function('window', 'document', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', source)(
    globalThis.window, globalThis.document, setTimeout, clearTimeout, trackInterval, trackClear)
  const client = captured.factory((spec) => {
      if (spec === 'react' || spec === 'react/jsx-runtime') return mini.react
      if (spec === 'react-dom') return { createPortal: (element) => ({ __portal: element }) }
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return { BrandWordmark: () => null }
    throw new Error('unexpected platform module: ' + spec)
  })
  const render = () => { mini.resetCursor(); return client.GitStatusCell({ sessionId: 'session-x', t: undefined }) }
  // ⚠ 全局替身必须活到 teardown：组件的首次读与 5s 轮询都是**异步**发生的，
  // 在 mount() 里就还回去的话它们会打到真的 fetch（相对 URL 直接失败）。
  const teardown = () => {
    for (const id of timers) clearInterval(id)
    timers.clear()
    globalThis.fetch = realFetch
    if (hadWindow) globalThis.window = savedWindow
    else delete globalThis.window
    if (hadDocument) globalThis.document = savedDocument
    else delete globalThis.document
  }
  return { client, render, ...mini, calls, teardown }
}

const flatten = (node, out = []) => {
  if (node === null || node === void 0) return out
  if (typeof node !== 'object') { out.push(node); return out }
  if (Array.isArray(node)) { for (const kid of node) flatten(kid, out); return out }
  out.push(node)
  for (const kid of node.kids ?? []) flatten(kid, out)
  return out
}
const textsOf = (tree) => flatten(tree).filter((node) => typeof node === 'string')
const findIn = (tree, test) => flatten(tree).find((node) => typeof node === 'object' && test(node))

test('分支菜单：点分支名 → 选另一支 → 胶囊改名（离屏、真组件）', async (t) => {
  const app = mount({ get: MAIN, post: FEAT })
  t.after(() => app.teardown())
  app.render()
  app.flushEffects()
  await new Promise((resolve) => setTimeout(resolve, 20))
  let tree = app.render()

  const button = findIn(tree, (node) => node.type === 'button' && node.props['data-git-branches'] !== void 0)
  assert.ok(button !== void 0, '分支数 > 1 时分支名是按钮')
  assert.equal(button.props['data-git-branches'], 2)
  assert.equal(button.props.title, void 0, '按钮不再自带 title（否则盖掉胶囊的信息 tooltip）')
  assert.match(String(button.props['aria-label']), /切换分支/, '无障碍名字由 aria-label 给')
  assert.ok(textsOf(tree).includes('main'), '胶囊显示当前分支')

  button.props.onClick()
  tree = app.render()
  const menu = findIn(tree, (node) => node.__portal !== void 0)?.__portal
  assert.ok(menu !== void 0, '点开后出现菜单')
  const items = flatten(menu).filter((node) => node.type === 'button')
  assert.equal(items.length, 2, '菜单里两条分支')
  assert.equal(items[0].props.disabled, true, '当前分支不可点')
  assert.ok(textsOf(items[0]).includes('✓'), '当前分支带 ✓')
  assert.notEqual(items[1].props.disabled, true, '另一条分支可点')

  items[1].props.onClick()
  await new Promise((resolve) => setTimeout(resolve, 20))
  tree = app.render()
  const post = app.calls.find((call) => call.method === 'POST')
  assert.ok(post !== void 0, '确实发了 POST')
  assert.match(post.url, /\/api\/sym\.git$/)
  assert.deepEqual(post.body, { sessionId: 'session-x', branch: 'feat/x' })
  assert.ok(textsOf(tree).includes('feat/x'), '胶囊改名为新分支')
  assert.ok(textsOf(tree).includes('+42'), '读数换成新分支的')
  assert.equal(findIn(tree, (node) => node.__portal !== void 0), void 0, '切换成功后菜单关闭')
})

test('分支菜单：只有一个分支时不给按钮', async (t) => {
  const app = mount({ get: { ...MAIN, branches: [{ name: 'main', current: true }] }, post: MAIN })
  t.after(() => app.teardown())
  app.render()
  app.flushEffects()
  await new Promise((resolve) => setTimeout(resolve, 20))
  const tree = app.render()
  assert.equal(findIn(tree, (node) => node.type === 'button' && node.props['data-git-branches'] !== void 0), void 0)
  assert.ok(textsOf(tree).includes('main'), '分支名照常显示，只是不可点')
})
