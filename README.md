<p align="center"><a href="https://ai4scholar.net?src=dsh"><img src="https://raw.githubusercontent.com/literaf/dsh-ai4scholar/main/docs/logo.svg" width="110" alt="AI4Scholar"></a></p>
<p align="center"><strong>dsh-research</strong></p>

# AI4Scholar Research Pack for DeepSeek Harness

English | [中文](README_CN.md)

[![npm](https://img.shields.io/npm/v/dsh-research?label=npm)](https://www.npmjs.com/package/dsh-research) [![CI](https://github.com/literaf/dsh-research/actions/workflows/ci.yml/badge.svg)](https://github.com/literaf/dsh-research/actions/workflows/ci.yml) [![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin) ![license](https://img.shields.io/badge/license-MIT-green)

The **orchestration layer** that turns [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) into a research workbench. It searches nothing itself: it ships the research skills, the literature-first workflow guidance, and the workspace conventions that make capability plugins (`dsh-ai4scholar`) and the agent behave like one research assistant.

## What it installs

**Four research skills** (authored by AI4Scholar, embedded in the package — nothing to download):

| Skill | When the agent loads it |
|---|---|
| `ai4scholar-paper-review` | Pre-submission review from five reviewer perspectives, with a fix-priority list |
| `ai4scholar-introduction-writing` | Introductions: background → gap → contribution → signposting → polish |
| `ai4scholar-academic-formatting` | Reference formatting, three-line tables, abstract structure, re-submission reformatting |
| `ai4scholar-reference-audit` | Reference audit: cross-citation, format consistency, DOI checks, duplicates, self-citation |

**One workflow section** in the system prompt: search before asserting, which task loads which skill, and a workspace layout — papers in `papers/`, citations in `references.bib`, reading notes in `notes/` — so the next session can pick up where the last one stopped.

The section **adapts to the composition**: with `dsh-ai4scholar` present it points the model at the search tools; without it, it tells the user how to install them.

## Install

```sh
dsh plugin --profile web add dsh-ai4scholar dsh-research
dsh web
```

One command, two independent layers: `dsh-ai4scholar` brings 38 literature tools (Semantic Scholar / PubMed / Google Scholar / arXiv / bioRxiv / DOI full text / auto-cite / figures), this pack brings the skills and the workflow. The pack works alone too — the skills still load, there is just nothing to search with.

## Configuration

The bundle inserts one row (`id: research-pack`). Override it from your profile's `cordis.patch.yml` (a patch replaces the whole `config`, so restate every key you keep):

```yaml
- id: research-pack
  config:
    skills: true                  # register the bundled skills
    skillNames: []                # register only these; empty means all
    promptGuidance: true          # register the workflow section
    promptOrder: 140
    workspaceConventions: true    # state the workspace layout in the guidance
    papersDir: papers/
    bibliographyFile: references.bib
    notesDir: notes/
```

## Notes

- Skill bodies are the ones published on [ai4scholar.net](https://ai4scholar.net?src=dsh), embedded through `ctx.skills.register` — no directories to configure.
- This pack is an **orchestration layer, not a container**: member plugins install beside it and keep their own settings pages, cards, and release cadence.
- Skill content is MIT licensed; use and adapt freely.

## License

MIT
