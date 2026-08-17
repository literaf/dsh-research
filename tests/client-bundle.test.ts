/**
 * Loads the built browser bundle the way the dsh web shell does — a classic
 * script handing a CommonJS factory to `window.__ModuleLoader__.load` — and
 * mounts it against a context that enforces Cordis's own access rule.
 *
 * That last part exists because of a real failure: the client half read
 * `ctx.locale` without declaring it in `inject`, and Cordis refuses an
 * undeclared property access. The loader entry died with "cannot get property
 * locale without inject" and the settings dialog rendered a boot error instead
 * of the app. Nothing in the unit tests touched a context at all, so the first
 * thing that noticed was a person opening the page.
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const BUNDLE = new URL('../lib/client.js', import.meta.url)
const SOURCE = new URL('../src/client/index.ts', import.meta.url)

/** Platform modules the web shell's module table exposes to a plugin bundle. */
const PLATFORM = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
])

/** Run the bundle like the module host and return what its factory exported. */
function loadBundle(): { id: string; exports: Record<string, unknown>; required: string[] } {
  let captured: { id: string; factory: (req: (id: string) => unknown) => unknown } | undefined
  const win = { __ModuleLoader__: { load(entry: typeof captured) { captured = entry } } }
  new Function('window', readFileSync(BUNDLE, 'utf8'))(win)
  if (captured === undefined) throw new Error('bundle did not register a factory')

  const required: string[] = []
  const platformRequire = (id: string): unknown => {
    required.push(id)
    if (!PLATFORM.has(id)) throw new Error(`bundle required a non-platform module: ${id}`)
    // Only the shapes the module body touches at import time are needed.
    return id.startsWith('react') ? { createElement: () => null, useEffect: () => undefined } : {}
  }
  return { id: captured.id, exports: captured.factory(platformRequire) as Record<string, unknown>, required }
}

describe.skipIf(!existsSync(BUNDLE))('browser bundle', () => {
  it('registers a factory under the package id and requires only platform modules', () => {
    const { id, required } = loadBundle()
    expect(id).toBe('dsh-research')
    for (const module of required) expect(PLATFORM.has(module)).toBe(true)
  })

  it('declares every service it reaches through ctx', () => {
    const source = readFileSync(SOURCE, 'utf8')
    const { exports } = loadBundle()
    const declared = new Set(exports['inject'] as string[])

    // Cordis allows `ctx.<name>` only for a declared injection; anything else
    // is an undeclared access that kills the whole loader entry at mount.
    const touched = new Set(
      [...source.matchAll(/\bctx\.([a-zA-Z][a-zA-Z0-9]*)/g)]
        .map((match) => match[1] as string)
        // `effect` and `get` are context methods, not injected services.
        .filter((name) => !['effect', 'get', 'plugin', 'on', 'inject'].includes(name)),
    )
    expect(touched.size).toBeGreaterThan(0)
    for (const service of touched) {
      expect(declared, `ctx.${service} is used but not in inject`).toContain(service)
    }
  })

  it('exports the plugin shape the client loader mounts', () => {
    const { exports } = loadBundle()
    expect(exports['name']).toBe('research-market-client')
    expect(typeof exports['apply']).toBe('function')
    expect(Array.isArray(exports['inject'])).toBe(true)
  })
})
