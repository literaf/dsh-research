/**
 * The bundled AI4Scholar research skills: metadata plus the loader that turns
 * each shipped `skills/*.md` file into a runtime skill body.
 *
 * The markdown files are the ones published on ai4scholar.net, kept verbatim
 * so they stay in sync with their source; host-specific bits (the YAML
 * frontmatter and the `@name` invocation syntax other harnesses use) are
 * normalized here rather than by editing the files.
 * @module dsh-research/skills
 */

import { readFileSync } from 'node:fs'

/** One bundled skill: its dsh name, its routing copy, and the file that holds its body. */
export interface BundledSkill {
  /** Kebab-case dsh skill name (`^[a-z0-9]+(-[a-z0-9]+)*$`). */
  readonly name: string
  /** Routing description shown in the skill catalog. */
  readonly description: string
  /** Extra routing guidance for the model. */
  readonly whenToUse: string
  /** File under `skills/`, without the extension. */
  readonly file: string
}

/**
 * The skills this pack ships. Literature *search* is deliberately absent:
 * `dsh-ai4scholar` registers native search tools, and a skill describing the
 * same capability would compete with them.
 */
export const BUNDLED_SKILLS: readonly BundledSkill[] = [
  {
    name: 'ai4scholar-paper-review',
    description: '投稿前预审：模拟理论贡献、方法论、文献对话、逻辑链条、主编预筛五位审稿人，逐维度审查论文并给出修改优先级。',
    whenToUse: '用户说要审稿、预审、自查论文、看会不会被拒稿或 Desk Reject 时使用。',
    file: 'paper-review',
  },
  {
    name: 'ai4scholar-introduction-writing',
    description: '引言写作：按背景架构、文献转折、贡献聚焦、结构路标、质检抛光五个步骤生成或修改学术论文引言。',
    whenToUse: '用户要写引言、开头、研究背景，或抱怨引言逻辑不顺时使用。',
    file: 'introduction-writing',
  },
  {
    name: 'ai4scholar-academic-formatting',
    description: '论文排版：参考文献格式化、三线表生成、摘要结构润色、换投期刊时的格式适配。',
    whenToUse: '用户要调整参考文献格式、做三线表、改摘要结构，或换投另一本期刊时使用。',
    file: 'academic-formatting',
  },
  {
    name: 'ai4scholar-reference-audit',
    description: '参考文献审计：交叉引用匹配、格式一致性、DOI/URL 验证、期刊名核查、重复与自引率分析、排序校验。',
    whenToUse: '用户要检查参考文献列表、核对引用是否真实、投稿前查文献格式时使用。',
    file: 'reference-audit',
  },
]

/** Strip a leading YAML frontmatter block, if the file carries one. */
function stripFrontmatter(text: string): string {
  if (!text.startsWith('---')) return text
  const end = text.indexOf('\n---', 3)
  if (end < 0) return text
  const after = text.indexOf('\n', end + 1)
  return after < 0 ? '' : text.slice(after + 1).replace(/^\s+/, '')
}

/**
 * Rewrite the `@<display name>` invocation syntax other harnesses use into a
 * plain instruction: in dsh the agent loads a skill itself, so the reader is
 * the model, not a human typing a prefix.
 */
function normalizeInvocation(body: string, skill: BundledSkill): string {
  return body
    .replace(/^输入 `@[^`]+`，然后描述你要做什么：\s*$/m, `以下是这个技能能处理的请求类型（用户不需要输入任何前缀，你直接按下面的流程执行）：`)
    .replace(/@ai4scholar-[^\s`]+\s*/g, '')
    .replace(/^# .*$/m, `# ${skill.name}`)
}

/**
 * Read and normalize one bundled skill body.
 * @param skill - the skill to load.
 * @param baseUrl - directory holding this module, used to find `../skills`.
 * @returns the model-facing skill content.
 */
export function loadSkillContent(skill: BundledSkill, baseUrl: string | URL): string {
  const file = new URL(`../skills/${skill.file}.md`, baseUrl)
  const raw = readFileSync(file, 'utf8')
  return normalizeInvocation(stripFrontmatter(raw), skill).trim()
}
