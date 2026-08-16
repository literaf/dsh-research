/**
 * dsh-research: the AI4Scholar research pack for DeepSeek Harness. It is an
 * orchestration layer, not a container — it ships the research skills, the
 * workflow guidance, and the workspace conventions, while the capabilities
 * themselves come from plugins installed beside it (`dsh-ai4scholar` for
 * literature search, reading, citation and figures).
 * @module dsh-research
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-skill'
import { BUNDLED_SKILLS, loadSkillContent } from './skills.js'
import { DEFAULT_CONVENTIONS, LITERATURE_PROBE_TOOL, buildGuidance } from './prompt.js'
import type { WorkspaceConventions } from './prompt.js'

export { BUNDLED_SKILLS, loadSkillContent } from './skills.js'
export type { BundledSkill } from './skills.js'
export { buildGuidance, DEFAULT_CONVENTIONS, LITERATURE_PROBE_TOOL } from './prompt.js'
export type { GuidanceInput, WorkspaceConventions } from './prompt.js'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'research-pack'

/** Services required before `apply` runs; `skills` is optional and injected lazily. */
export const inject = ['systemPrompt']

/** Plugin configuration. */
export interface Config {
  /** Register the bundled research skills. */
  skills?: boolean
  /** Register only these skill names; empty means all of them. */
  skillNames?: string[]
  /** Register the workflow guidance section. */
  promptGuidance?: boolean
  /** Order of the guidance section within the assembled prompt (tool guidance uses 100-199). */
  promptOrder?: number
  /** State the workspace conventions in the guidance. */
  workspaceConventions?: boolean
  /** Directory for downloaded papers and extracted text. */
  papersDir?: string
  /** File collecting BibTeX entries. */
  bibliographyFile?: string
  /** Directory for per-paper reading notes. */
  notesDir?: string
}

export const Config: Schema<Config> = Schema.object({
  skills: Schema.boolean().default(true).description('Register the bundled research skills.'),
  skillNames: Schema.array(Schema.string()).default([]).description('Register only these skills; empty means all.'),
  promptGuidance: Schema.boolean().default(true).description('Register the workflow guidance section.'),
  promptOrder: Schema.number().default(140).description('Order of the guidance section.'),
  workspaceConventions: Schema.boolean().default(true).description('State the workspace conventions in the guidance.'),
  papersDir: Schema.string().default(DEFAULT_CONVENTIONS.papers).description('Directory for papers and extracted text.'),
  bibliographyFile: Schema.string().default(DEFAULT_CONVENTIONS.bibliography).description('BibTeX file for cited works.'),
  notesDir: Schema.string().default(DEFAULT_CONVENTIONS.notes).description('Directory for reading notes.'),
})

/** Complete config after schemastery applies every default. */
type ResolvedConfig = Required<Config>

/**
 * Register the pack's skills and guidance. Both are effects on `ctx`, so
 * unloading the plugin withdraws them together.
 * @param ctx - plugin context with `systemPrompt` ready.
 * @param config - schemastery-validated config with defaults applied.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  const selected = resolved.skillNames.length > 0
    ? BUNDLED_SKILLS.filter(skill => resolved.skillNames.includes(skill.name))
    : BUNDLED_SKILLS
  if (resolved.skillNames.length > 0) {
    const known = new Set(BUNDLED_SKILLS.map(skill => skill.name))
    const unknown = resolved.skillNames.filter(name => !known.has(name))
    if (unknown.length > 0) {
      throw new Error(`research-pack: unknown skillNames ${unknown.join(', ')} (available: ${BUNDLED_SKILLS.map(s => s.name).join(', ')})`)
    }
  }
  if (!Number.isFinite(resolved.promptOrder)) throw new Error('research-pack: promptOrder must be a finite number')

  const registered = resolved.skills ? selected : []
  if (registered.length > 0) {
    // `skills` is optional: a composition without the registry still gets the guidance.
    ctx.inject(['skills'], (skillCtx) => {
      for (const skill of registered) {
        skillCtx.skills.register({
          name: skill.name,
          description: skill.description,
          whenToUse: skill.whenToUse,
          // `bundled`: the body ships inside this package, not on the user's disk.
          source: 'bundled',
          content: loadSkillContent(skill, import.meta.url),
        })
      }
    })
  }

  if (!resolved.promptGuidance) return
  const conventions: WorkspaceConventions | undefined = resolved.workspaceConventions
    ? { papers: resolved.papersDir, bibliography: resolved.bibliographyFile, notes: resolved.notesDir }
    : undefined
  ctx.systemPrompt.section({
    name: 'pack:ai4scholar-research',
    order: resolved.promptOrder,
    // A provider, not a string: whether the literature tools exist is decided
    // by the composition around this pack and can change while it runs.
    text: () => buildGuidance({
      skills: registered,
      conventions,
      literatureTools: ctx.get('tools')?.get(LITERATURE_PROBE_TOOL) !== undefined,
    }) ?? '',
  })
}
