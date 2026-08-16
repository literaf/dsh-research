import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { PromptSection } from '@deepseek-ai/dsh-system-prompt'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import { BUNDLED_SKILLS, Config, DEFAULT_CONVENTIONS, apply, buildGuidance, loadSkillContent, skillRouting } from '../src/index.js'
import type { Config as ConfigType } from '../src/index.js'

/** Minimal stand-in for the plugin context: records skill and prompt registrations. */
function fakeContext(options: { skillsService?: boolean; tools?: string[] } = {}) {
  const skills: SkillRegistration[] = []
  const sections: PromptSection[] = []
  const registered = new Set(options.tools ?? [])
  const ctx = {
    systemPrompt: {
      section(section: PromptSection) {
        sections.push(section)
        return () => undefined
      },
    },
    get(name: string) {
      if (name === 'tools') return { get: (tool: string) => (registered.has(tool) ? {} : undefined) }
      // The guidance reads `skills` to decide whether the pack's skills exist,
      // so the fake must report the same absence its `inject` simulates.
      if (name === 'skills') return options.skillsService === false ? undefined : {}
      return undefined
    },
    inject(deps: string[], callback: (child: unknown) => void) {
      if (deps.includes('skills') && options.skillsService === false) return
      callback({
        skills: {
          register(skill: SkillRegistration) {
            skills.push(skill)
            return () => undefined
          },
        },
      })
    },
  } as unknown as Context
  return { ctx, skills, sections }
}

function mount(overrides: Partial<ConfigType> = {}, options: Parameters<typeof fakeContext>[0] = {}) {
  const fake = fakeContext(options)
  apply(fake.ctx, new Config(overrides))
  return fake
}

/** Render the section's text provider the way the prompt assembler does. */
function sectionText(section: PromptSection): string {
  return typeof section.text === 'string' ? section.text : section.text({} as never)
}

describe('pack mount', () => {
  it('registers the four bundled skills and one guidance section by default', () => {
    const fake = mount()
    expect(fake.skills.map(s => s.name)).toEqual([
      'ai4scholar-paper-review',
      'ai4scholar-introduction-writing',
      'ai4scholar-academic-formatting',
      'ai4scholar-reference-audit',
    ])
    for (const skill of fake.skills) {
      expect(skill.source).toBe('bundled')
      expect(skill.description.length).toBeGreaterThan(10)
      expect(skill.whenToUse).toBeDefined()
      // Default language: the catalog copy the model routes on is Chinese.
      expect(skill.description).toBe(skillRouting(BUNDLED_SKILLS.find(s => s.name === skill.name)!, 'zh').description)
      // Bodies come from the shipped markdown, with the frontmatter and the
      // other harnesses' `@name` invocation syntax removed.
      expect(skill.content.length).toBeGreaterThan(1000)
      expect(skill.content.startsWith('---')).toBe(false)
      expect(skill.content).not.toContain('@ai4scholar')
    }
    expect(fake.sections).toHaveLength(1)
    expect(fake.sections[0]?.name).toBe('pack:ai4scholar-research')
    expect(fake.sections[0]?.order).toBe(140)
  })

  it('every bundled skill name is a valid dsh skill id', () => {
    for (const skill of BUNDLED_SKILLS) expect(skill.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    expect(new Set(BUNDLED_SKILLS.map(s => s.name)).size).toBe(BUNDLED_SKILLS.length)
  })

  it('carries routing copy in every supported language', () => {
    for (const skill of BUNDLED_SKILLS) {
      for (const language of ['zh', 'en'] as const) {
        const routing = skillRouting(skill, language)
        expect(routing.description.length).toBeGreaterThan(20)
        expect(routing.whenToUse.length).toBeGreaterThan(20)
      }
      // Distinct copy, not the same string reused for both languages.
      expect(skillRouting(skill, 'en').description).not.toBe(skillRouting(skill, 'zh').description)
    }
  })

  it('honors the toggles and the skill subset', () => {
    expect(mount({ skills: false }).skills).toHaveLength(0)
    expect(mount({ promptGuidance: false }).sections).toHaveLength(0)
    const subset = mount({ skillNames: ['ai4scholar-paper-review'] })
    expect(subset.skills.map(s => s.name)).toEqual(['ai4scholar-paper-review'])
    // The guidance only advertises what was actually registered.
    expect(sectionText(subset.sections[0]!)).not.toContain('ai4scholar-reference-audit')
    expect(() => mount({ skillNames: ['nope'] })).toThrow(/unknown skillNames nope/)
  })

  it('still mounts where the skill registry is absent, and stops advertising skills', () => {
    const fake = mount({}, { skillsService: false })
    expect(fake.skills).toHaveLength(0)
    expect(fake.sections).toHaveLength(1)
    // Routing the model at skills nothing registered makes it call a loader
    // that cannot resolve them, so the guidance drops the whole list.
    const text = sectionText(fake.sections[0]!)
    for (const skill of BUNDLED_SKILLS) expect(text).not.toContain(skill.name)
    expect(text).not.toContain('先加载对应技能')
    // The rest of the guidance survives: conventions and the install hint.
    expect(text).toContain(DEFAULT_CONVENTIONS.bibliography)
    expect(text).toContain('dsh plugin --profile web add dsh-ai4scholar')
  })
})

describe('guidance', () => {
  it('adapts to whether the literature tools are installed', () => {
    const withTools = sectionText(mount({}, { tools: ['search_papers'] }).sections[0]!)
    expect(withTools).toContain('先检索再断言')
    expect(withTools).toContain('search_papers')
    expect(withTools).not.toContain('dsh plugin --profile web add dsh-ai4scholar')

    const without = sectionText(mount().sections[0]!)
    expect(without).toContain('没有安装文献检索工具')
    expect(without).toContain('dsh plugin --profile web add dsh-ai4scholar')
  })

  it('states the workspace conventions and honors overrides', () => {
    const text = sectionText(mount().sections[0]!)
    expect(text).toContain(DEFAULT_CONVENTIONS.papers)
    expect(text).toContain(DEFAULT_CONVENTIONS.bibliography)
    const custom = sectionText(mount({ papersDir: 'literature/', bibliographyFile: 'refs.bib' }).sections[0]!)
    expect(custom).toContain('literature/')
    expect(custom).toContain('refs.bib')
    expect(sectionText(mount({ workspaceConventions: false }).sections[0]!)).not.toContain(DEFAULT_CONVENTIONS.bibliography)
  })

  it('lists each registered skill with its routing hint', () => {
    const text = buildGuidance({ skills: BUNDLED_SKILLS, literatureTools: true })
    for (const skill of BUNDLED_SKILLS) {
      expect(text).toContain(skill.name)
      expect(text).toContain(skillRouting(skill, 'zh').whenToUse)
    }
  })

  it('switches guidance and catalog copy to English, and flags the Chinese bodies', () => {
    const fake = mount({ language: 'en' }, { tools: ['search_papers'] })
    const text = sectionText(fake.sections[0]!)
    expect(text).toContain('Search before asserting')
    expect(text).toContain('search_papers')
    // The bodies stay Chinese, so the model is told to translate its report.
    expect(text).toContain('written in Chinese')
    for (const skill of BUNDLED_SKILLS) expect(text).toContain(skillRouting(skill, 'en').whenToUse)
    expect(text).not.toContain('先检索再断言')

    // The registered catalog entries follow the same language.
    for (const registration of fake.skills) {
      const skill = BUNDLED_SKILLS.find(s => s.name === registration.name)!
      expect(registration.description).toBe(skillRouting(skill, 'en').description)
      expect(registration.whenToUse).toBe(skillRouting(skill, 'en').whenToUse)
    }
  })

  it('states the English install hint when the literature tools are absent', () => {
    const text = sectionText(mount({ language: 'en' }).sections[0]!)
    expect(text).toContain('No literature tools are installed')
    expect(text).toContain('dsh plugin --profile web add dsh-ai4scholar')
  })
})

describe('skill bodies', () => {
  it('loads every shipped markdown file', () => {
    for (const skill of BUNDLED_SKILLS) {
      const content = loadSkillContent(skill, import.meta.url.replace('/tests/', '/src/'))
      expect(content).toContain('##')
      expect(content.split('\n')[0]).toBe(`# ${skill.name}`)
    }
  })
})
