/**
 * The pack's system-prompt section: how to run a literature-driven task in
 * this workspace, and which of the bundled skills covers which step. The text
 * is a provider (re-evaluated at every assembly) so it can adapt to whether
 * the literature tools are actually installed in this composition.
 * @module dsh-research/prompt
 */

import type { BundledSkill, GuidanceLanguage } from './skills.js'
import { skillRouting } from './skills.js'

/** Tool that proves `dsh-ai4scholar` is composed alongside this pack. */
export const LITERATURE_PROBE_TOOL = 'search_papers'

/** Files and folders the pack asks the agent to keep a research workspace in. */
export interface WorkspaceConventions {
  /** Directory for downloaded PDFs and extracted text. */
  papers: string
  /** BibTeX file collecting every cited work. */
  bibliography: string
  /** Directory for per-paper reading notes. */
  notes: string
}

/** The conventions used when the deployment configures none. */
export const DEFAULT_CONVENTIONS: WorkspaceConventions = {
  papers: 'papers/',
  bibliography: 'references.bib',
  notes: 'notes/',
}

/** Inputs of {@link buildGuidance}. */
export interface GuidanceInput {
  /** Skills registered by this pack, in catalog order. */
  skills: readonly BundledSkill[]
  /** Workspace conventions to state, or `undefined` to omit that paragraph. */
  conventions?: WorkspaceConventions | undefined
  /** Whether the literature tools of `dsh-ai4scholar` are present right now. */
  literatureTools: boolean
  /** Language of the guidance and of the routing copy; defaults to `zh`. */
  language?: GuidanceLanguage | undefined
}

/** Every model-facing string of the guidance, in one language. */
interface GuidanceStrings {
  /** Opening line naming the pack. */
  header: string
  /** Rule to follow when the literature tools are installed. */
  search: string
  /** What to do instead when they are not. */
  noTools: string
  /** Line introducing the skill list. */
  skillsIntro: string
  /**
   * Warning that the skill bodies are not in this guidance's language, or
   * `undefined` when they are.
   */
  bodyLanguage?: string
  /** Paragraph stating the workspace layout. */
  conventions: (conventions: WorkspaceConventions) => string
  /** Rule about which language to answer in. */
  answerLanguage: string
}

const STRINGS: Record<GuidanceLanguage, GuidanceStrings> = {
  zh: {
    header: 'AI4Scholar 科研套件已启用。',
    search: '先检索再断言：回答文献类问题前调用 search_papers（跨库检索并去重）或单库工具，需要细节时用 read_* 工具读全文，不要凭记忆给出论文、作者或数据。',
    noTools: '本工作台没有安装文献检索工具。遇到需要查找、核实论文或参考文献的任务，先告诉用户可以安装 dsh-ai4scholar（`dsh plugin --profile web add dsh-ai4scholar`）获得跨库检索、全文阅读与自动引用能力，然后再决定是否继续。',
    skillsIntro: '遇到下列任务时，先加载对应技能再动手，不要即兴发挥：',
    conventions: (c) => `工作区约定：论文原文与抽取的全文放在 ${c.papers}，参考文献统一写入 ${c.bibliography}，每篇论文的阅读笔记放在 ${c.notes}（一篇一个文件，记录问题、方法、结论和证据位置）。新增文献时同步更新这三处，让下一轮对话可以直接接着用。`,
    answerLanguage: '用户用什么语言提问，就用什么语言回答；论文标题、期刊名和引用保持原文。',
  },
  en: {
    header: 'The AI4Scholar research pack is active.',
    search: 'Search before asserting: for any question about the literature, call search_papers (cross-database search with de-duplication) or a single-database tool, and read the full text with the read_* tools when the details matter. Never state a paper, an author, or a number from memory.',
    noTools: 'No literature tools are installed in this workbench. When a task needs papers or references found or verified, first tell the user they can install dsh-ai4scholar (`dsh plugin --profile web add dsh-ai4scholar`) for cross-database search, full-text reading and automatic citation, then decide whether to go on.',
    skillsIntro: 'Load the matching skill before starting one of these tasks instead of improvising:',
    // The bodies are AI4Scholar's originals, kept verbatim, so an English
    // session still loads a Chinese procedure and must not echo it back as-is.
    bodyLanguage: 'The skill bodies themselves are written in Chinese. Follow the procedure as written and report the result in the language the user is using.',
    conventions: (c) => `Workspace layout: keep downloaded papers and extracted full text in ${c.papers}, write every reference into ${c.bibliography}, and keep one reading note per paper in ${c.notes} (the question, the method, the findings, and where the evidence sits). Update all three whenever you add a paper, so the next session can continue from them.`,
    answerLanguage: 'Answer in the language the user writes in; keep paper titles, journal names and citations in their original language.',
  },
}

/**
 * Build the guidance text.
 * @param input - registered skills, conventions, language, and whether the literature tools exist.
 * @returns the section text.
 */
export function buildGuidance(input: GuidanceInput): string {
  const language = input.language ?? 'zh'
  const strings = STRINGS[language]
  const lines: string[] = [input.literatureTools ? strings.search : strings.noTools]
  if (input.skills.length > 0) {
    lines.push(strings.skillsIntro)
    for (const skill of input.skills) lines.push(`  - ${skill.name} — ${skillRouting(skill, language).whenToUse}`)
    if (strings.bodyLanguage !== undefined) lines.push(strings.bodyLanguage)
  }
  if (input.conventions !== undefined) lines.push(strings.conventions(input.conventions))
  lines.push(strings.answerLanguage)
  return [strings.header, ...lines].join('\n')
}
