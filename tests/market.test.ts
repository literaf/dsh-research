import { describe, expect, it } from 'vitest'
import { argvProfile, normalizeCatalog, pluginArgs, quoteCmdArg, spawnEnv, trustedRestartRequest } from '../src/index.js'
import { MarketController, filterItems, installCommand } from '../src/client/index.js'
import type { CatalogResponse, InstallResponse, MarketItem, RestartResponse } from '../src/index.js'

const PAGE = {
  schemaVersion: '1.0.0',
  revision: '2026-08-17T00:00:00Z',
  items: [
    {
      id: 'literaf-dsh-ai4scholar',
      summary: 'Academic search over Semantic Scholar, PubMed and more.',
      homepage: 'https://github.com/literaf/dsh-ai4scholar',
      categories: ['literature'],
      package: { registry: 'npm', name: 'dsh-ai4scholar' },
      publisher: { name: 'literaf' },
      license: 'MIT',
    },
  ],
  page: { hasMore: false },
}

describe('catalog normalization', () => {
  it('keeps a well-formed entry and derives its repository slug', () => {
    const page = normalizeCatalog(PAGE)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({ repo: 'literaf/dsh-ai4scholar', npm: 'dsh-ai4scholar', ours: true })
    expect(page.revision).toBe('2026-08-17T00:00:00Z')
  })

  it('drops entries the panel could only render half of', () => {
    const page = normalizeCatalog({
      items: [
        { id: 'a', homepage: 'https://github.com/x/y' },                 // no summary
        { summary: 's', homepage: 'https://github.com/x/y' },            // no id
        { id: 'c', summary: 's' },                                       // no homepage
        'not an object',
      ],
    })
    expect(page.items).toEqual([])
  })

  it('refuses a non-https homepage, because the panel renders it as a link', () => {
    const page = normalizeCatalog({ items: [{ id: 'a', summary: 's', homepage: 'javascript:alert(1)' }] })
    expect(page.items).toEqual([])
  })

  it('omits the package field when the catalog states no npm name', () => {
    // Guessing it would send a user to whatever package holds that name.
    const page = normalizeCatalog({ items: [{ id: 'a', summary: 's', homepage: 'https://github.com/x/y' }] })
    expect(page.items[0]?.npm).toBeUndefined()
    expect(installCommand(page.items[0]!)).toBeUndefined()
  })

  it('rejects a body that is not a provider page', () => {
    expect(() => normalizeCatalog(null)).toThrow(/not an object/)
    expect(() => normalizeCatalog({})).toThrow(/no items array/)
  })
})

describe('process layer', () => {
  it('reads the profile this host booted rather than assuming one', () => {
    expect(argvProfile(['node', 'dsh', '--profile', 'research', 'web'])).toBe('research')
    expect(argvProfile(['node', 'dsh', 'web'])).toBeUndefined()
    // A following flag is not a profile name.
    expect(argvProfile(['node', 'dsh', '--profile', '--verbose'])).toBeUndefined()
  })

  it('forces CI so pnpm fails instead of waiting on a prompt with no TTY', () => {
    expect(spawnEnv()['CI']).toBe('true')
  })

  it('quotes only the cmd.exe tokens that need it', () => {
    expect(quoteCmdArg('dsh-ai4scholar')).toBe('dsh-ai4scholar')
    expect(quoteCmdArg('a b')).toBe('"a b"')
    expect(quoteCmdArg('a"b')).toBe('"a""b"')
    expect(quoteCmdArg('a&b')).toBe('"a&b"')
  })
})

/** A catalog answer with one installable entry. */
function answer(overrides: Partial<CatalogResponse> = {}): CatalogResponse {
  return {
    items: normalizeCatalog(PAGE).items,
    revision: '2026-08-17', installed: [], profile: 'web', ...overrides,
  }
}

describe('install flow', () => {
  it('records the install and asks for a restart', async () => {
    const calls: string[] = []
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => { calls.push(npm); return Promise.resolve({ ok: true, npm } satisfies InstallResponse) },
    )
    await controller.refresh()
    const item = controller.state().items[0]!
    expect(controller.isInstalled(item)).toBe(false)

    await controller.install(item)
    expect(calls).toEqual(['dsh-ai4scholar'])
    expect(controller.isInstalled(item)).toBe(true)
    expect(controller.state().pendingRestart).toEqual(['dsh-ai4scholar'])
    expect(controller.state().installing).toBeUndefined()
  })

  it('keeps a failure against its own row and leaves it installable', async () => {
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => Promise.resolve({ ok: false, npm, error: 'exited 1', output: 'pnpm said no' }),
    )
    await controller.refresh()
    const item = controller.state().items[0]!
    await controller.install(item)
    expect(controller.isInstalled(item)).toBe(false)
    expect(controller.state().failures['dsh-ai4scholar']).toContain('exited 1')
    expect(controller.state().failures['dsh-ai4scholar']).toContain('pnpm said no')
  })

  it('refuses a second install while one is running', async () => {
    let started = 0
    let release: (value: InstallResponse) => void = () => undefined
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => { started += 1; return new Promise<InstallResponse>((r) => { release = r }) },
    )
    await controller.refresh()
    const item = controller.state().items[0]!
    const first = controller.install(item)
    await controller.install(item)
    expect(started).toBe(1)
    release({ ok: true, npm: 'dsh-ai4scholar' })
    await first
  })

  it('marks an entry the profile already carries as installed', async () => {
    const controller = new MarketController(() => Promise.resolve(answer({ installed: ['dsh-ai4scholar'] })))
    await controller.refresh()
    expect(controller.isInstalled(controller.state().items[0]!)).toBe(true)
  })

  it('surfaces a catalog failure instead of rendering an empty list as success', async () => {
    const controller = new MarketController(() => Promise.reject(new Error('offline')))
    await controller.refresh()
    expect(controller.state().error).toBe('offline')
    expect(controller.state().loading).toBe(false)
  })
})

describe('catalog language', () => {
  it('asks for the feed matching the interface', async () => {
    const asked: string[] = []
    const controller = new MarketController((lang) => { asked.push(lang); return Promise.resolve(answer()) })
    await controller.refresh()
    expect(asked).toEqual(['en'])

    controller.setLanguage('zh-CN')
    await controller.refresh()
    // The contract fixes the item shape, so a bilingual catalog is two feeds.
    expect(asked).toEqual(['en', 'zh'])
  })

  it('treats anything that is not Chinese as the English feed', () => {
    const controller = new MarketController(() => Promise.resolve(answer()))
    for (const tag of ['en', 'en-GB', 'ja', 'fr-CA']) {
      controller.setLanguage(tag)
      expect(controller.language()).toBe('en')
    }
    for (const tag of ['zh', 'zh-CN', 'zh-Hant-TW', 'ZH']) {
      controller.setLanguage(tag)
      expect(controller.language()).toBe('zh')
    }
  })
})

describe('filtering', () => {
  const items = normalizeCatalog(PAGE).items as readonly MarketItem[]

  it('matches the fields a reader would search, case-insensitively', () => {
    expect(filterItems(items, 'PUBMED')).toHaveLength(1)
    expect(filterItems(items, 'literature')).toHaveLength(1)
    expect(filterItems(items, 'dsh-ai4scholar')).toHaveLength(1)
    expect(filterItems(items, 'nothing here')).toHaveLength(0)
    expect(filterItems(items, '   ')).toHaveLength(1)
  })
})

describe('removal and restart', () => {
  it('takes the entry back out and still asks for a restart', async () => {
    const removed: string[] = []
    const controller = new MarketController(
      () => Promise.resolve(answer({ installed: ['dsh-ai4scholar'] })),
      () => Promise.resolve({ ok: true, npm: 'dsh-ai4scholar' }),
      (npm) => { removed.push(npm); return Promise.resolve({ ok: true, npm }) },
    )
    await controller.refresh()
    const item = controller.state().items[0]!
    expect(controller.isInstalled(item)).toBe(true)

    await controller.uninstall(item)
    expect(removed).toEqual(['dsh-ai4scholar'])
    expect(controller.isInstalled(item)).toBe(false)
    // Removing needs a restart just as much as installing does.
    expect(controller.state().pendingRestart).toEqual(['dsh-ai4scholar'])
  })

  it('keeps the row installed when removal fails', async () => {
    const controller = new MarketController(
      () => Promise.resolve(answer({ installed: ['dsh-ai4scholar'] })),
      () => Promise.resolve({ ok: true, npm: 'dsh-ai4scholar' }),
      (npm) => Promise.resolve({ ok: false, npm, error: 'exited 1' }),
    )
    await controller.refresh()
    await controller.uninstall(controller.state().items[0]!)
    expect(controller.isInstalled(controller.state().items[0]!)).toBe(true)
    expect(controller.state().failures['dsh-ai4scholar']).toContain('exited 1')
  })

  it('does not offer a second restart while one is under way', async () => {
    let calls = 0
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => Promise.resolve({ ok: true, npm }),
      (npm) => Promise.resolve({ ok: true, npm }),
      () => { calls += 1; return Promise.resolve({ ok: true } satisfies RestartResponse) },
    )
    await controller.restartHost()
    await controller.restartHost()
    expect(calls).toBe(1)
    expect(controller.state().restarting).toBe(true)
  })

  it('re-enables the button when the host refuses to restart', async () => {
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => Promise.resolve({ ok: true, npm }),
      (npm) => Promise.resolve({ ok: true, npm }),
      () => Promise.resolve({ ok: false, error: 'self-restart is disabled' }),
    )
    await controller.restartHost()
    expect(controller.state().restarting).toBe(false)
    expect(controller.state().error).toBe('self-restart is disabled')
  })
})

describe('process-control guard', () => {
  const base = { socket: { remoteAddress: '127.0.0.1' }, headers: { origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080' } }

  it('accepts a same-origin loopback request', () => {
    expect(trustedRestartRequest(base)).toBe(true)
  })

  it('refuses a non-loopback peer', () => {
    expect(trustedRestartRequest({ ...base, socket: { remoteAddress: '192.168.1.20' } })).toBe(false)
  })

  it('refuses a forwarded request, because that peer is a proxy not the user', () => {
    for (const header of ['forwarded', 'x-forwarded-for', 'x-real-ip']) {
      expect(trustedRestartRequest({ ...base, headers: { ...base.headers, [header]: 'anything' } })).toBe(false)
    }
  })

  it('refuses a cross-origin or headerless request', () => {
    expect(trustedRestartRequest({ ...base, headers: { ...base.headers, origin: 'http://evil.test' } })).toBe(false)
    expect(trustedRestartRequest({ ...base, headers: { host: '127.0.0.1:3080' } })).toBe(false)
  })
})

describe('pnpm workspace compatibility', () => {
  it('leaves the arguments alone for a profile that is not a workspace', () => {
    // The scratch profile name below has no pnpm-workspace.yaml.
    expect(pluginArgs('definitely-not-a-profile', ['add', 'dsh-ai4scholar']))
      .toEqual(['add', 'dsh-ai4scholar'])
  })

  it('passes through a subcommand pnpm does not gate', () => {
    expect(pluginArgs('definitely-not-a-profile', ['list'])).toEqual(['list'])
  })
})
