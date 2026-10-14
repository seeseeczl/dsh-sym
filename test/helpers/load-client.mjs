/**
 * Load `lib/client.js` outside a browser.
 *
 * The browser half is a module-factory bundle: it registers itself through
 * `window.__ModuleLoader__.load({ id, factory })` and only requires the platform
 * baseline (`react`, `react/jsx-runtime`). This shim captures that registration
 * and materialises the factory with a minimal React stand-in, so exported pure
 * helpers (`describeScope`, `formatCny`, `pickTurn`, …) can be asserted without
 * a DOM. Deliberately no jsdom dependency — see the audit's P1-01 stop condition.
 *
 * @param options - `document` replaces the minimal DOM shim, for the helpers that
 *   do touch it (`focusComposer` queries `[data-composer-input]`).
 * @param options.primitives - replaces the primitives stand-in, for assertions
 *   that need the menu leaf (`MenuItemButton`) or a recording `writeClipboard`.
 * @returns the module's exports.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const CLIENT = join(here, '..', '..', 'lib', 'client.js')

/**
 * Minimal `react` stand-in: enough for module bodies and for calling one
 * component more than once, never for real rendering.
 *
 * State lives per component type, in `useState` call order, and is created on
 * the first call. A `setState` re-invokes its own component with the same props,
 * so "the row's label changes after a failed copy" is assertable without a
 * renderer. Call a component through `callComponent` to get both the element and
 * the re-rendered element.
 */
function fakeReact() {
  const noop = () => {}
  /** component type -> its state slots, in `useState` call order. */
  const stateByType = new WeakMap()
  /** The component type and props currently being invoked, for `setState`. */
  let active = null
  let cursor = 0
  class Component {
    constructor(props) {
      this.props = props
    }
  }
  const invoke = (type, props) => {
    let slots = stateByType.get(type)
    if (slots === undefined) {
      slots = []
      stateByType.set(type, slots)
    }
    const result = { element: null, rerendered: null }
    const previous = active
    const previousCursor = cursor
    active = { type, props, slots, result }
    cursor = 0
    try {
      result.element = type(props)
    } finally {
      cursor = previousCursor
      active = previous
    }
    return result
  }
  return {
    Component,
    createElement: (type, props, ...kids) => ({ type, props, kids }),
    useState: (init) => {
      if (active === null) return [typeof init === 'function' ? init() : init, noop]
      const index = cursor++
      const slots = active.slots
      // Capture the owner now: `setState` may run after `invoke` returned (an
      // async copy resolving later), when the module-level `active` is cleared.
      const owner = active
      if (!(index in slots)) slots[index] = typeof init === 'function' ? init() : init
      const set = (next) => {
        const value = typeof next === 'function' ? next(slots[index]) : next
        if (Object.is(value, slots[index])) return
        slots[index] = value
        // Re-render the owner so the caller can observe the new output.
        owner.result.rerendered = invoke(owner.type, owner.props).element
      }
      return [slots[index], set]
    },
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    useEffect: noop,
    useMemo: (fn) => fn(),
    memo: (c) => c,
    /** Test-only: invoke a component under the hook ledger. */
    __invoke: (type, props) => invoke(type, props),
  }
}

export function loadClient(options = {}) {
  // Save and restore the global so repeated loads cannot leak state into each
  // other (AUD-TEST-003): the module's own module-level caches stay per-instance
  // only if nothing of ours survives the call.
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window')
  const savedWindow = globalThis.window

  let captured = null
  try {
    globalThis.window = { __ModuleLoader__: { load: (mod) => { captured = mod } } }

    const source = readFileSync(CLIENT, 'utf8')
    // The bundle is CJS-ish inside the factory; run it with the shim globals.
    const run = new Function(
      'window', 'document', 'MutationObserver', 'requestAnimationFrame',
      'cancelAnimationFrame', 'setTimeout', 'clearTimeout', source
    )
    // `options.document` is merged onto the shim (not swapped in): the module
    // injects its stylesheet at load time, so an override that only wants to
    // answer one query must not have to reimplement `head`/`createElement`.
    const baseDocument = {
      querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ dataset: {} }),
      head: { appendChild: () => {} }, body: {},
      documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {} },
      addEventListener() {}, removeEventListener() {},
    }
    run(
      globalThis.window,
      { ...baseDocument, ...(options.document ?? {}) },
      function () {},
      () => 0,
      () => {},
      () => 0,
      () => {}
    )
    if (captured === null) throw new Error('client.js did not register a module')
    const react = fakeReact()
    // Stand in the platform modules a real deployment provides. Without them
    // every load would record `panel:react-dom` and `brand:primitives` as
    // degradations, drowning the cases that are actually about a missing module.
    const reactDom = { createPortal: () => null }
    // The menu leaf is part of the stand-in because `lib/client.js` gates its
    // Session-menu rows on it: an absent `MenuItemButton` is the "no primitives
    // bundle" deployment, which is a case worth asserting on purpose rather than
    // hitting by accident on every load.
    const primitives = {
      BrandWordmark: () => null,
      // 断言读的是 `React.createElement` 替身产出的元素（`{ type, props, kids }`），
      // 所以这里只需是"可当类型用"的函数。
      MenuItemButton: () => null,
      IconCopyOutlineRegular: () => null,
      IconDownloadOutlineRegular: () => null,
      writeClipboard: async () => true,
      ...(options.primitives ?? {}),
    }
    const exports = captured.factory((spec) => {
      if (spec === 'react' || spec === 'react/jsx-runtime') return react
      if (spec === 'react-dom') return reactDom
      if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives
      throw new Error('unexpected platform module: ' + spec)
    })
    // Test-only handle: invoke a component through the hook ledger so its state
    // and re-render are observable. Not part of the plugin's own surface.
    Object.defineProperty(exports, '__invoke', {
      value: (type, props) => react.__invoke(type, props),
      enumerable: false,
    })
    return exports
  } finally {
    if (hadWindow) globalThis.window = savedWindow
    else delete globalThis.window
  }
}
