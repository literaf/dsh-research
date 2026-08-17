/**
 * The panel's state: one catalog load, a text filter, and which row's command
 * was just copied.
 *
 * A plain snapshot store rather than a framework: the panel has one async
 * source and three fields, and the renderer only needs `getSnapshot` and
 * `subscribe`.
 * @module dsh-research/client/store
 */

import { CATALOG_ROUTE, INSTALL_ROUTE, REMOVE_ROUTE, RESTART_ROUTE } from '../shared/route.js'
import type { CatalogResponse, InstallResponse, MarketItem, RestartResponse } from '../shared/route.js'

/** What the panel renders. */
export interface MarketState {
  /** Whether the first load is still in flight. */
  readonly loading: boolean
  /** Entries from the catalog, in catalog order. */
  readonly items: readonly MarketItem[]
  /** Catalog revision, shown so a reader can judge freshness. */
  readonly revision: string
  /** Set when the snapshot is a cached one served after a failed refresh. */
  readonly stale: boolean
  /** Load failure, if the catalog could not be read at all. */
  readonly error?: string
  /** Current filter text. */
  readonly query: string
  /** Id of the row whose command was copied most recently. */
  readonly copied?: string
  /** Bundles already in the profile, so installed rows say so. */
  readonly installed: readonly string[]
  /** Profile an install mutates, named in the panel so it is never a surprise. */
  readonly profile: string
  /** npm name currently installing, if any. */
  readonly installing?: string
  /** When the current mutation started, so the row can show how long it has run. */
  readonly startedAt?: number
  /** Per-package failure text from the last attempt. */
  readonly failures: Readonly<Record<string, string>>
  /** npm names changed during this session, which need a restart to take effect. */
  readonly pendingRestart: readonly string[]
  /** Set once a restart has been scheduled and this page is about to go away. */
  readonly restarting: boolean
}

/** Minimal snapshot store shape the renderer binds as a hook. */
export interface Store<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Same-origin fetch of the Node half's catalog route; injectable for tests. */
export type CatalogFetch = (lang: string, signal?: AbortSignal) => Promise<CatalogResponse>

/** POST to the Node half's install route; injectable for tests. */
export type InstallRequest = (npm: string) => Promise<InstallResponse>

/** POST one package name to a mutation route. */
async function postPackage(route: string, npm: string): Promise<InstallResponse> {
  const res = await fetch(route, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ npm }),
  })
  const body = await res.json() as InstallResponse & { error?: string }
  if (!res.ok) return { ok: false, npm, error: body.error ?? `route answered ${res.status}` }
  return body
}

/** Default installer: `POST /research-market/install` on the page origin. */
export const requestInstall: InstallRequest = (npm) => postPackage(INSTALL_ROUTE, npm)

/** Default remover: `POST /research-market/remove` on the page origin. */
export const requestRemove: InstallRequest = (npm) => postPackage(REMOVE_ROUTE, npm)

/** Ask the host to restart itself. */
export const requestRestart = async (): Promise<RestartResponse> => {
  const res = await fetch(RESTART_ROUTE, { method: 'POST', credentials: 'same-origin' })
  const body = await res.json() as RestartResponse & { error?: string }
  return res.ok ? body : { ok: false, error: body.error ?? `restart route answered ${res.status}` }
}

/** Default fetcher: `GET /research-market/catalog` on the page origin. */
export const fetchCatalogRoute: CatalogFetch = async (lang, signal) => {
  const res = await fetch(`${CATALOG_ROUTE}?lang=${encodeURIComponent(lang)}`, {
    method: 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(signal !== undefined ? { signal } : {}),
  })
  const body = await res.json() as Record<string, unknown>
  if (!res.ok) throw new Error(typeof body['error'] === 'string' ? body['error'] : `catalog route answered ${res.status}`)
  return body as unknown as CatalogResponse
}

/** Create a snapshot store over a mutable value. */
export function createStore<T>(initial: T): Store<T> & { set(next: T): void } {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next) {
      snapshot = next
      for (const listener of listeners) listener()
    },
  }
}

/** The install command for one entry, or `undefined` when npm name is unknown. */
export function installCommand(item: MarketItem): string | undefined {
  return item.npm === undefined ? undefined : `dsh plugin --profile web add ${item.npm}`
}

/** Case-insensitive filter over the fields a reader would search. */
export function filterItems(items: readonly MarketItem[], query: string): readonly MarketItem[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return items
  return items.filter((item) =>
    `${item.repo} ${item.summary} ${item.category} ${item.npm ?? ''}`.toLowerCase().includes(needle))
}

/** Owns the panel's state and the one request behind it. */
export class MarketController {
  readonly store = createStore<MarketState>({
    loading: true, items: [], revision: '', stale: false, query: '',
    installed: [], profile: '', failures: {}, pendingRestart: [], restarting: false,
  })

  private copyTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * @param load - catalog fetcher; defaults to the same-origin route.
   * @param request - installer; defaults to the same-origin route.
   */
  constructor(
    private readonly load: CatalogFetch = fetchCatalogRoute,
    private readonly request: InstallRequest = requestInstall,
    private readonly remove: InstallRequest = requestRemove,
    private readonly restart: () => Promise<RestartResponse> = requestRestart,
  ) {}

  /** Whether this entry is already a bundle in the profile. */
  isInstalled(item: MarketItem): boolean {
    return item.npm !== undefined && this.state().installed.includes(item.npm)
  }

  /**
   * Install one entry. The Node half re-checks the name against the catalog,
   * so a caller cannot widen what this reaches.
   * @param item - the catalog entry to install.
   */
  async install(item: MarketItem): Promise<void> {
    const npm = item.npm
    if (npm === undefined || this.state().installing !== undefined) return
    const { failures, ...before } = this.state()
    const { [npm]: previous, ...keptFailures } = failures
    void previous
    this.store.set({ ...before, failures: keptFailures, installing: npm, startedAt: Date.now() })
    const answer = await this.request(npm)
    const { installing, startedAt, ...after } = this.state()
    void installing
    void startedAt
    this.store.set(answer.ok
      ? {
          ...after,
          installed: [...after.installed, npm],
          pendingRestart: [...after.pendingRestart, npm],
        }
      : {
          ...after,
          failures: { ...after.failures, [npm]: `${answer.error ?? 'install failed'}${answer.output === undefined ? '' : `\n${answer.output}`}` },
        })
  }

  /** Current snapshot. */
  state(): MarketState {
    return this.store.getSnapshot()
  }

  /** Entries after the current filter. */
  visible(): readonly MarketItem[] {
    const state = this.state()
    return filterItems(state.items, state.query)
  }

  /** Interface language, so the panel reads the catalog feed that matches it. */
  private lang = 'en'

  /**
   * Point later loads at a language's feed.
   * @param lang - `zh` or anything else, which means English.
   */
  setLanguage(lang: string): void {
    this.lang = lang.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }

  /** Which feed later loads read. */
  language(): string {
    return this.lang
  }

  /** Load the catalog once. Safe to call again; the last answer wins. */
  async refresh(): Promise<void> {
    this.store.set({ ...this.state(), loading: true })
    try {
      const answer = await this.load(this.lang)
      const { error, ...rest } = this.state()
      void error
      this.store.set({
        ...rest, loading: false, items: answer.items,
        revision: answer.revision, stale: answer.stale === true,
        installed: answer.installed, profile: answer.profile,
      })
    } catch (cause) {
      this.store.set({
        ...this.state(), loading: false,
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  /** Set the filter text. */
  search(query: string): void {
    this.store.set({ ...this.state(), query })
  }

  /** Copy one entry's install command and flag the row briefly. */
  async copy(item: MarketItem): Promise<void> {
    const command = installCommand(item)
    if (command === undefined) return
    await navigator.clipboard.writeText(command)
    const { copied, ...rest } = this.state()
    void copied
    this.store.set({ ...rest, copied: item.id })
    if (this.copyTimer !== undefined) clearTimeout(this.copyTimer)
    this.copyTimer = setTimeout(() => {
      const { copied: previous, ...current } = this.state()
      void previous
      this.store.set(current)
    }, 1600)
  }

  /**
   * Remove one entry from the profile.
   * @param item - the catalog entry to remove.
   */
  async uninstall(item: MarketItem): Promise<void> {
    const npm = item.npm
    if (npm === undefined || this.state().installing !== undefined) return
    const { failures, ...before } = this.state()
    const { [npm]: previous, ...keptFailures } = failures
    void previous
    this.store.set({ ...before, failures: keptFailures, installing: npm, startedAt: Date.now() })
    const answer = await this.remove(npm)
    const { installing, startedAt, ...after } = this.state()
    void installing
    void startedAt
    this.store.set(answer.ok
      ? {
          ...after,
          installed: after.installed.filter((name) => name !== npm),
          pendingRestart: [...after.pendingRestart.filter((name) => name !== npm), npm],
        }
      : { ...after, failures: { ...after.failures, [npm]: answer.error ?? 'remove failed' } })
  }

  /** Ask the host to restart, so the changes made here take effect. */
  async restartHost(): Promise<void> {
    if (this.state().restarting) return
    this.store.set({ ...this.state(), restarting: true })
    const answer = await this.restart()
    if (!answer.ok) {
      this.store.set({ ...this.state(), restarting: false, error: answer.error ?? 'restart refused' })
    }
    // On success the page is about to be replaced; leaving `restarting` set is
    // what keeps the button from being pressed twice while that happens.
  }

  /** Stop the pending copy reset; called when the section unmounts. */
  dispose(): void {
    if (this.copyTimer !== undefined) clearTimeout(this.copyTimer)
  }
}
