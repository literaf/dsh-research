<p align="center"><a href="https://ai4scholar.net?src=dsh"><img src="https://raw.githubusercontent.com/literaf/ai4scholar-plugin-dsh/main/docs/logo.svg" width="110" alt="AI4Scholar"></a></p>
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

这段指令会**根据实际组合自动调整**：检测到 `dsh-ai4scholar` 的检索工具就直接引导模型使用；没检测到就提示用户先安装它。

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
```

## 说明

- 技能内容来自 [ai4scholar.net](https://ai4scholar.net?src=dsh) 发布的原创技能，随包内嵌（`ctx.skills.register`），不需要用户自己下载或配置目录。
- 本套件是**编排层不是容器**：成员插件平级安装，各自保留自己的设置页、卡片和升级节奏。
- 技能内容按 MIT 授权，可自由使用与修改。

## 许可证

MIT
