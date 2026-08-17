# Changelog

All notable changes to `dsh-research` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [0.3.0] - 2026-08-17

`dsh-research` is now **the research plugin market** — a page in the Settings sidebar listing a curated index of research plugins, each installable with one click.

This replaces the skill pack that carried the name through 0.1 and 0.2. The pack was four markdown procedures and a prompt section: real content, but nothing another author could not write, and it was competing for the name that should carry the thing this project is actually about. The name now holds the entry point; the skills remain published at [ai4scholar-skill-hub](https://github.com/literaf/ai4scholar-skill-hub) and are a better fit inside `dsh-ai4scholar`, whose tools they depend on to mean anything.

`^0.2.0` does not match `0.3.0` under 0.x semver, so nobody on the old pack is moved onto a different plugin by an update.

### Added
- A **Research plugins** page in the Settings sidebar: the curated catalog with search, category filters, and Discover / Installed tabs.
- One-click install and removal, fenced four ways: an allowlist (the browser may name any package, only a catalogued one is ever spawned), a same-origin check, a single-flight lock, and a profile read from the argv this host booted.
- A restart action, guarded harder than install because ending the process is a stronger act: loopback peers only, and any forwarding header disqualifies the request.
- A confirmation before every mutation, naming the plugin, the profile, and the exact command that will run.
- Progress feedback with an elapsed counter, because a dependency resolve can run for minutes and a silent button reads as a hang.
- Bilingual catalog: the provider contract fixes the item shape, so the two languages are two feeds and the panel reads the one its interface speaks.

### Removed
- The four bundled skills and the workflow prompt section (see above).

## [0.2.0] - 2026-08-17

The skill pack's last release. See the repository history for its changelog.
