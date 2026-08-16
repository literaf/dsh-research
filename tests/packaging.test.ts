/**
 * Checks the published tarball, not the working tree.
 *
 * Skill bodies are read at mount time with `readFileSync(new URL('../skills/…',
 * import.meta.url))`, resolved relative to the *built* `lib/index.js`. Every
 * other test imports from `src/`, where that relative path also happens to
 * work, so a packaging mistake — dropping `skills` from `files`, moving the
 * build output one level deeper, renaming the directory — would ship a package
 * that throws on mount while the whole suite stayed green.
 */
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { BUNDLED_SKILLS } from '../src/index.js'
import packageJson from '../package.json' with { type: 'json' }

/** File list of the tarball `npm publish` would upload. */
function packedFiles(): string[] {
  const stdout = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    timeout: 120_000,
  })
  const [tarball] = JSON.parse(stdout) as [{ files: { path: string }[] }]
  return tarball.files.map((file) => file.path)
}

describe('published tarball', () => {
  const files = packedFiles()

  it('ships every bundled skill body beside the built entry', () => {
    // Both at the package root: `../skills/x.md` from `lib/index.js` resolves.
    expect(files).toContain('lib/index.js')
    for (const skill of BUNDLED_SKILLS) expect(files).toContain(`skills/${skill.file}.md`)
  })

  it('ships no skill file the catalog does not declare', () => {
    const declared = new Set(BUNDLED_SKILLS.map((skill) => `skills/${skill.file}.md`))
    const shipped = files.filter((file) => file.startsWith('skills/'))
    expect(shipped.sort()).toEqual([...declared].sort())
  })

  it('ships the bundle patch the dsh manifest points at', () => {
    // `dsh plugin add` reads dsh.bundle.patch out of the installed package;
    // without the file the install resolves to nothing.
    const patch = packageJson.dsh.bundle.patch.replace(/^\.\//, '')
    expect(files).toContain(patch)
  })

  it('ships the type declarations its exports map promises', () => {
    for (const entry of [packageJson.types, packageJson.exports['.'].types]) {
      expect(files).toContain(entry.replace(/^\.\//, ''))
    }
  })
})
