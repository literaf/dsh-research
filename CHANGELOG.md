# Changelog

All notable changes to `dsh-research` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/) (0.x: minor bumps may change the skill set).

## [0.2.0] - 2026-08-17

### Added
- `language` config (`zh` | `en`, default `zh`) selecting the language of the workflow guidance and of each skill's catalog entry. The skill bodies remain the verbatim Chinese originals in both settings, and the English guidance states that outright so the model reports back in the user's language instead of echoing the procedure untranslated.
- A real-composition test suite: the built `lib/` mounts under a genuine `SystemPrompt` and `SkillRegistry`, proving skill-name validation, body loading through the registry's own loader, prompt assembly, config through the compiled schema, and that disposing the fiber withdraws every contribution.
- A packaging test that inspects the tarball `npm publish` would upload, so a package that cannot resolve its own skill bodies at mount time fails the suite instead of the user's install.

### Fixed
- The workflow guidance listed the pack's skills even where no skill registry was composed, so nothing had registered them and the model was routed at a loader that could not resolve the names. The guidance now reads `ctx.get('skills')` at assembly time, the same way it already probed `tools`.

### Changed
- `buildGuidance` returns `string` rather than `string | undefined`; the undefined branch was unreachable because the search rule and the answer-language rule are always emitted.

## [0.1.1] - 2026-08-16

### Fixed
- `repository` and `bugs` pointed at the pre-rename repository name, so the npm page linked to a repository that does not exist.

## [0.1.0] - 2026-08-16

### Added
- Four embedded research skills authored by AI4Scholar — `ai4scholar-paper-review`, `ai4scholar-introduction-writing`, `ai4scholar-academic-formatting`, `ai4scholar-reference-audit` — registered through `ctx.skills.register`, so nothing has to be downloaded or configured by the user.
- A workflow section in the system prompt that adapts to the composition: it points the model at the `dsh-ai4scholar` search tools when they are installed, and tells the user how to install them when they are not.
- Workspace conventions (`papers/`, `references.bib`, `notes/`) stated in the guidance so a research session resumes where the previous one stopped, all configurable.
