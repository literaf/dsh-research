/**
 * The pack's system-prompt section: how to run a literature-driven task in
 * this workspace, and which of the bundled skills covers which step. The text
 * is a provider (re-evaluated at every assembly) so it can adapt to whether
 * the literature tools are actually installed in this composition.
 * @module dsh-research/prompt
 */

import type { BundledSkill } from './skills.js'

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
}

/**
 * Build the guidance text.
 * @param input - registered skills, conventions, and whether literature tools exist.
 * @returns the section text, or `undefined` when there is nothing to say.
 */
export function buildGuidance(input: GuidanceInput): string | undefined {
  const lines: string[] = []
  if (input.literatureTools) {
    lines.push('先检索再断言：回答文献类问题前调用 search_papers（跨库检索并去重）或单库工具，需要细节时用 read_* 工具读全文，不要凭记忆给出论文、作者或数据。')
  } else {
    lines.push('本工作台没有安装文献检索工具。遇到需要查找、核实论文或参考文献的任务，先告诉用户可以安装 dsh-ai4scholar（`dsh plugin --profile web add dsh-ai4scholar`）获得跨库检索、全文阅读与自动引用能力，然后再决定是否继续。')
  }
  if (input.skills.length > 0) {
    lines.push('遇到下列任务时，先加载对应技能再动手，不要即兴发挥：')
    for (const skill of input.skills) lines.push(`  - ${skill.name} — ${skill.whenToUse}`)
  }
  const c = input.conventions
  if (c !== undefined) {
    lines.push(`工作区约定：论文原文与抽取的全文放在 ${c.papers}，参考文献统一写入 ${c.bibliography}，每篇论文的阅读笔记放在 ${c.notes}（一篇一个文件，记录问题、方法、结论和证据位置）。新增文献时同步更新这三处，让下一轮对话可以直接接着用。`)
  }
  lines.push('用户用什么语言提问，就用什么语言回答；论文标题、期刊名和引用保持原文。')
  if (lines.length === 0) return undefined
  return ['AI4Scholar 科研套件已启用。', ...lines].join('\n')
}
