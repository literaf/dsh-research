<p align="center"><a href="https://ai4scholar.net?src=dsh"><img src="https://raw.githubusercontent.com/literaf/dsh-ai4scholar/main/docs/logo.svg" width="110" alt="AI4Scholar"></a></p>
<p align="center"><strong>dsh-research</strong></p>

# AI4Scholar 科研套件（DeepSeek Harness）

[English](README.md) | 中文

[![npm](https://img.shields.io/npm/v/dsh-research?label=npm)](https://www.npmjs.com/package/dsh-research) [![CI](https://github.com/literaf/dsh-research/actions/workflows/ci.yml/badge.svg)](https://github.com/literaf/dsh-research/actions/workflows/ci.yml) [![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin) ![license](https://img.shields.io/badge/license-MIT-green)

把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 变成科研工作台的**编排层**：它自己不做检索，而是装上科研技能、文献优先的工作流指令和工作区约定，让能力插件（`dsh-ai4scholar`）和 Agent 配合起来像一个完整的研究助手。

## 装什么

**4 个科研技能**（AI4Scholar 原创，随包内嵌，装完即用）

| 技能 | 什么时候用 |
|---|---|
| `ai4scholar-paper-review` | 投稿前预审：五位审稿人视角逐维度审查，给出修改优先级 |
| `ai4scholar-introduction-writing` | 写引言：背景架构 → 文献转折 → 贡献聚焦 → 结构路标 → 质检 |
| `ai4scholar-academic-formatting` | 参考文献格式化、三线表、摘要结构、换投期刊适配 |
| `ai4scholar-reference-audit` | 参考文献审计：交叉引用、格式一致性、DOI 验证、重复与自引 |

**一段工作流指令**（system prompt）：要求"先检索再断言"，说明什么任务该加载哪个技能，并约定工作区结构——论文放 `papers/`、参考文献写进 `references.bib`、阅读笔记放 `notes/`，让下一轮对话能接着上一轮继续。

## 装上之后，Agent 会怎么做

一句"帮我找 X 最近最扎实的证据，然后据此写一段引言"，会被当成一条链走完，而不是四次互不相干的回答：

1. 指令禁止凭记忆作答，所以 Agent 先调 `search_papers`，只用检索回来的结果说话。
2. 关键论文用 `read_*` 工具读全文，原文归到 `papers/`，每篇一份笔记放进 `notes/`。
3. 动笔前先加载 `ai4scholar-introduction-writing`，于是草稿按背景 → 空白 → 贡献 → 路标推进，而不是即兴分段。
4. 引用过的文献统一写进 `references.bib`，投稿前可以用 `ai4scholar-reference-audit` 拿它跟正文对一遍。

下一轮对话直接从这三处文件接着做，工作是累积的，不用重来。

## 会怎样随组合变化

指令在每次组装提示词时重建，因此它描述的永远是当下真实可用的东西：

| 组合 | 套件提供什么 |
|---|---|
| `dsh-research` + `dsh-ai4scholar` | 技能，加上一段按名字把模型引向文献工具的工作流 |
| 只装 `dsh-research` | 技能，加上一段"先装文献工具再谈引用"的提示 |
| profile 里没有技能注册表 | 只有工作流。此时不再宣传技能，以免模型去加载一个解析不出来的技能 |

## 安装

```sh
dsh plugin --profile web add dsh-ai4scholar dsh-research
dsh web
```

两个包一条命令装完，各自是独立的层——`dsh-ai4scholar` 提供 38 个文献工具（Semantic Scholar / PubMed / Google Scholar / arXiv / bioRxiv / DOI 全文 / 自动引用 / 科研绘图），本套件提供技能与工作流。也可以只装套件，技能照样能用，只是没有检索能力。

## 配置

组合包插入一行（`id: research-pack`）。在 profile 的 `cordis.patch.yml` 里覆盖（patch 会整体替换 `config`，保留的键要一起写）：

```yaml
- id: research-pack
  config:
    skills: true                  # 注册内置技能
    skillNames: []                # 只注册其中几个，空表示全部
    promptGuidance: true          # 注册工作流指令
    promptOrder: 140
    workspaceConventions: true    # 在指令里说明工作区约定
    papersDir: papers/
    bibliographyFile: references.bib
    notesDir: notes/
    language: zh                  # zh | en —— 指令与技能目录文案的语言
```

### 语言

`language` 决定工作流指令和每个技能目录条目用什么语言。**技能正文两种设置下都是中文** —— 那是 AI4Scholar 的原创技能，逐字保留以便与已发布版本保持同步。设为 `en` 时，指令会明确说明这一点，并要求模型按中文流程执行、用用户所用的语言汇报结果。

## 说明

- 技能内容来自 [ai4scholar.net](https://ai4scholar.net?src=dsh) 发布的原创技能，随包内嵌（`ctx.skills.register`），不需要用户自己下载或配置目录；正文为中文（见[语言](#语言)）。
- 本套件是**编排层不是容器**：成员插件平级安装，各自保留自己的设置页、卡片和升级节奏。
- 技能内容按 MIT 授权，可自由使用与修改。

## 许可证

MIT
