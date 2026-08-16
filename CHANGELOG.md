# Changelog

All notable changes to `dsh-research` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/) (0.x: minor bumps may change the skill set).

## [0.1.0] - 2026-08-16

### Added
- Four embedded research skills authored by AI4Scholar — `ai4scholar-paper-review`, `ai4scholar-introduction-writing`, `ai4scholar-academic-formatting`, `ai4scholar-reference-audit` — registered through `ctx.skills.register`, so nothing has to be downloaded or configured by the user.
- A workflow section in the system prompt that adapts to the composition: it points the model at the `dsh-ai4scholar` search tools when they are installed, and tells the user how to install them when they are not.
- Workspace conventions (`papers/`, `references.bib`, `notes/`) stated in the guidance so a research session resumes where the previous one stopped, all configurable.
