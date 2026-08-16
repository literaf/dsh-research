/**
 * Boots a REAL Cordis context with the published `SystemPrompt` and
 * `SkillRegistry` services and mounts the built plugin from `lib/`, proving
 * the shipped artifact registers through the genuine registries — schema
 * compilation, skill-name validation, prompt assembly, effect-scoped disposal
 * — rather than the hand-built fakes in `pack.test.ts`.
 *
 * Requires `pnpm build` first; package.json `pretest` does it, and the tests
 * skip themselves when `lib/` is absent.
 */
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import { BUNDLED_SKILLS } from '../src/index.js'

const LIB_ENTRY = new URL('../lib/index.js', import.meta.url)

/** Load the built plugin namespace, typed against the source it is compiled from. */
async function builtPlugin() {
  return await import(LIB_ENTRY.href) as typeof import('../src/index.js')
}

/** Assemble the prompt and return this pack's section text, or `undefined`. */
async function guidanceText(ctx: Context): Promise<string | undefined> {
  const assembly = await ctx.systemPrompt.assemble()
  const section = assembly.sections.find((s) => s.name === 'pack:ai4scholar-research')
  return section === undefined ? undefined : JSON.stringify(section)
}

describe.skipIf(!existsSync(LIB_ENTRY))('built pack in a real composition', () => {
  it('registers every skill and the guidance section, then withdraws them on dispose', async () => {
    const plugin = await builtPlugin()
    const ctx = new Context()
    await ctx.plugin(SystemPrompt, {})
    await ctx.plugin(SkillRegistry, {})

    const fiber = await ctx.plugin(plugin, {})

    // The real registry validates names and rejects duplicates, so reaching
    // the catalog at all proves the bundled metadata is well-formed.
    const listed = await ctx.skills.list()
    const names = listed.map((s) => s.name)
    for (const skill of BUNDLED_SKILLS) expect(names).toContain(skill.name)

    // Bodies load through the registry's own loader, from the packaged markdown.
    const review = await ctx.skills.get('ai4scholar-paper-review')
    expect(review?.content).toContain('#')
    expect(review?.content.startsWith('---')).toBe(false)

    const text = await guidanceText(ctx)
    expect(text).toBeDefined()
    expect(text).toContain('ai4scholar-paper-review')
    // No literature tools in this composition, so the guidance offers the install.
    expect(text).toContain('dsh-ai4scholar')

    // Every contribution is an effect: disposing the fiber withdraws all of them.
    await fiber.dispose()
    expect((await ctx.skills.list()).map((s) => s.name)).not.toContain('ai4scholar-paper-review')
    expect(await guidanceText(ctx)).toBeUndefined()
  })

  it('honors config through the real schema, including a skill subset', async () => {
    const plugin = await builtPlugin()
    const ctx = new Context()
    await ctx.plugin(SystemPrompt, {})
    await ctx.plugin(SkillRegistry, {})

    await ctx.plugin(plugin, { skillNames: ['ai4scholar-reference-audit'], papersDir: 'literature/' })

    const names = (await ctx.skills.list()).map((s) => s.name)
    expect(names).toContain('ai4scholar-reference-audit')
    expect(names).not.toContain('ai4scholar-paper-review')

    const text = await guidanceText(ctx)
    expect(text).toContain('literature/')
    expect(text).not.toContain('ai4scholar-paper-review')
  })

  it('mounts without the skill registry and keeps the skills out of the guidance', async () => {
    const plugin = await builtPlugin()
    const ctx = new Context()
    await ctx.plugin(SystemPrompt, {})

    await ctx.plugin(plugin, {})

    const text = await guidanceText(ctx)
    expect(text).toBeDefined()
    for (const skill of BUNDLED_SKILLS) expect(text).not.toContain(skill.name)
    // The conventions and the install hint do not depend on the registry.
    expect(text).toContain('references.bib')
    expect(text).toContain('dsh-ai4scholar')
  })
})
