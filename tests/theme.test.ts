/**
 * Guards the panel's stylesheet against the two ways it has actually broken.
 *
 * First: invented token names. `--dsw-alias-text-primary` looks plausible and
 * does not exist, so every rule using it silently fell back to a hardcoded
 * colour and stopped following the theme. Nothing failed; the panel just quietly
 * stopped being themed.
 *
 * Second: a hardcoded label on a themed fill. `.primary` painted
 * `background: var(--dsw-alias-brand-primary)` with `color: #fff`. That token
 * inverts between themes — near-black in light, near-white in dark — so the
 * install button read correctly in light mode and turned white-on-white in dark.
 * Again nothing failed; a person had to open the panel in dark mode and squint.
 *
 * Both classes are invisible to a test that only mounts the component, so they
 * are checked here against the stylesheet text itself.
 */
import { describe, expect, it } from 'vitest'
import { installStyles } from '../src/client/styles.js'

/**
 * The alias tokens the shell actually defines, transcribed from the copy of
 * `@deepseek-ai/dsh-client-ui-theme/lib/styles/design-platform.css` that ships
 * with dsh. Adding a name here should mean looking it up in that file first —
 * that lookup is the whole point of the list.
 */
const VERIFIED = new Set([
  // bg-base: verified in design-platform.css — neutral-bluish-00 in light,
  // neutral-bluish-950 in dark (one step deeper than the settings surface).
  'bg-base',
  'bg-layer-1', 'bg-layer-2', 'bg-layer-3',
  'border-l2',
  'brand-primary',
  'button-primary-fill', 'button-primary-hover',
  'label-primary', 'label-primary-foreground', 'label-secondary', 'label-tertiary',
  'state-warn-primary',
])

/** Run `installStyles` against a stub document and return the CSS it injected. */
function stylesheet(): string {
  let injected: string | undefined
  const doc = {
    querySelector: () => null,
    createElement: () => ({ setAttribute: () => undefined, textContent: '' }),
    head: { append: (tag: { textContent: string }) => void (injected = tag.textContent) },
  } as unknown as Document
  installStyles(doc)
  if (injected === undefined) throw new Error('installStyles injected nothing')
  return injected
}

/** Split the CSS into `{ selector, body }` rules, skipping at-rules. */
function rules(css: string): { selector: string; body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((match) => ({ selector: (match[1] as string).trim(), body: match[2] as string }))
    .filter((rule) => !rule.selector.startsWith('@'))
}

describe('panel stylesheet', () => {
  it('references only alias tokens the shell defines', () => {
    const used = new Set(
      [...stylesheet().matchAll(/--dsw-alias-([a-z0-9-]+)/g)].map((match) => match[1] as string),
    )
    expect(used.size).toBeGreaterThan(0)
    for (const token of used) {
      expect(VERIFIED, `--dsw-alias-${token} is not a token the shell defines`).toContain(token)
    }
  })

  it('never paints a literal colour on a themed background', () => {
    for (const { selector, body } of rules(stylesheet())) {
      const background = /(?:^|;)\s*background(?:-color)?:\s*var\(--dsw-/.test(body)
      const literal = /(?:^|;)\s*color:\s*(#|rgb|hsl)/.test(body)
      expect(
        background && literal,
        `${selector} sets a literal colour over a themed background; both must come from tokens, ` +
          'or the label vanishes in whichever theme inverts the fill',
      ).toBe(false)
    }
  })

  it('builds the filled button from the pair the shell uses for its own', () => {
    const button = rules(stylesheet()).find((rule) => rule.selector === '.rmkt-primary')
    expect(button).toBeDefined()
    expect(button?.body).toContain('background:var(--dsw-alias-button-primary-fill')
    expect(button?.body).toContain('color:var(--dsw-alias-label-primary-foreground')
  })
})
