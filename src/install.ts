/**
 * Process layer: re-invoking the dsh CLI that launched this host so the panel
 * can run `dsh plugin add` for a curated entry.
 *
 * The spawn mechanics here are adapted from dsh-market (MIT, © 2026 fkysly and
 * dsh-market contributors, https://github.com/dsh-market/dsh-market), which
 * paid for these four facts the hard way:
 *
 *   - `ctx.shell` cannot be used. It is the agent's sandboxed executor and
 *     denies writes to the profile directory, which is exactly what an install
 *     must do. So this is the one module that starts child processes.
 *   - A macOS app launched from Finder or the Dock inherits a minimal PATH
 *     with no Homebrew and no npm, and every install dies with ENOENT. The
 *     well-known bin directories are appended to make the child find its tools.
 *   - pnpm v10 blocks forever on an interactive prompt when there is no TTY, so
 *     children run with `CI=true` and fail instead of hanging.
 *   - On Windows `dsh`, `npm` and `pnpm` are `.cmd` shims that Node's `spawn`
 *     cannot start directly; they need a `cmd.exe /c` command line.
 *
 * @module dsh-research/install
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { ChildProcess } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

/** Longest an install may run before it is killed. */
export const INSTALL_TIMEOUT_MS = 10 * 60 * 1000

/** True where `dsh` and friends are `.cmd` shims rather than executables. */
export const winCmdShim = process.platform === 'win32'

/** Characters cmd.exe treats as syntax even inside a token. */
const CMD_METACHARS = /[\s"&|<>^()%!]/

/**
 * Quote one argv token for a cmd.exe `/c` command line.
 * @param arg - the token.
 * @returns the token, wrapped and escaped when cmd would otherwise split it.
 */
export function quoteCmdArg(arg: string): string {
  return CMD_METACHARS.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg
}

/**
 * Environment for a child install.
 * @returns the parent environment with `CI` set and the usual bin directories on PATH.
 */
export function spawnEnv(): NodeJS.ProcessEnv {
  const separator = process.platform === 'win32' ? ';' : ':'
  const parts = (process.env['PATH'] ?? '').split(separator).filter((part) => part !== '')
  const candidates = process.platform === 'win32'
    ? []
    : ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local', 'bin')]
  for (const bin of candidates) {
    if (!parts.includes(bin)) parts.push(bin)
  }
  return { ...process.env, CI: 'true', PATH: parts.join(separator) }
}

/** How to re-invoke the dsh CLI. */
export interface DshInvocation {
  /** Executable to spawn. */
  readonly file: string
  /** Leading arguments before the `plugin` subcommand. */
  readonly args: readonly string[]
  /** Working directory, when the entry needs one to resolve its imports. */
  readonly cwd: string | undefined
  /** Whether the file is a shim that only a shell can start. */
  readonly viaShell: boolean
}

/**
 * Argv re-invoking the CLI that launched this host, so an install works
 * whether dsh runs from a global bin, a local install, or repo source.
 * @returns the invocation, falling back to a bare `dsh` on PATH.
 */
export function dshArgv(): DshInvocation {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    // Absolute: a source launch passes a relative entry that the child would
    // resolve against its own cwd. The cwd keeps execArgv imports resolvable.
    const abs = resolve(entry)
    return { file: process.execPath, args: [...process.execArgv, abs], cwd: dirname(abs), viaShell: false }
  }
  return { file: 'dsh', args: [], cwd: undefined, viaShell: winCmdShim }
}

/** What one install attempt produced. */
export interface InstallOutcome {
  /** Whether the CLI exited zero. */
  readonly ok: boolean
  /** Exit code, or `null` when the process was killed. */
  readonly exitCode: number | null
  /** Whether the run hit {@link INSTALL_TIMEOUT_MS}. */
  readonly timedOut: boolean
  /** Combined output, trimmed to the tail a reader can act on. */
  readonly output: string
}

/** Spawn one command, handling the Windows shim case. */
function launch(file: string, args: readonly string[], cwd: string | undefined, viaShell: boolean): ChildProcess {
  const options = { env: spawnEnv(), ...(cwd === undefined ? {} : { cwd }), stdio: ['ignore', 'pipe', 'pipe'] as ('ignore' | 'pipe')[] }
  if (!viaShell) return spawn(file, [...args], options)
  const comspec = process.env['COMSPEC'] ?? 'cmd.exe'
  const line = [file, ...args].map(quoteCmdArg).join(' ')
  return spawn(comspec, ['/d', '/s', '/c', `"${line}"`], { ...options, shell: false, windowsVerbatimArguments: true })
}

/**
 * The profile directory this host mutates.
 * @param profile - profile name.
 * @returns its absolute directory.
 */
export function profileDir(profile: string): string {
  const home = process.env['DSH_HOME'] ?? join(homedir(), '.dsh')
  return join(home, 'profiles', profile)
}

/**
 * Insert pnpm's workspace flag when the profile is one.
 *
 * pnpm refuses `add`/`remove` at the root of a workspace without `-w`, and a
 * profile that happens to carry a `pnpm-workspace.yaml` is one.
 * @param profile - profile name.
 * @param args - the plugin subcommand arguments.
 * @returns the arguments, with `-w` inserted where pnpm requires it.
 */
export function pluginArgs(profile: string, args: readonly string[]): string[] {
  const verb = args[0]
  if (verb !== 'add' && verb !== 'remove') return [...args]
  if (!existsSync(join(profileDir(profile), 'pnpm-workspace.yaml'))) return [...args]
  return [verb, '-w', ...args.slice(1)]
}

/**
 * Run `dsh plugin --profile <profile> add <package>`.
 * @param profile - the profile to mutate.
 * @param packageName - npm package to add; the caller must have checked it against the catalog.
 * @param timeoutMs - kill the run after this long.
 * @returns what the CLI did.
 */
export function installPackage(
  profile: string, packageName: string, timeoutMs: number = INSTALL_TIMEOUT_MS,
): Promise<InstallOutcome> {
  return runPlugin(profile, ['add', packageName], timeoutMs)
}

/**
 * Run `dsh plugin --profile <profile> remove <package>`.
 * @param profile - the profile to mutate.
 * @param packageName - npm package to remove; checked against the catalog by the caller.
 * @param timeoutMs - kill the run after this long.
 * @returns what the CLI did.
 */
export function removePackage(
  profile: string, packageName: string, timeoutMs: number = INSTALL_TIMEOUT_MS,
): Promise<InstallOutcome> {
  return runPlugin(profile, ['remove', packageName], timeoutMs)
}

/** Spawn one `dsh plugin` subcommand and collect its outcome. */
function runPlugin(profile: string, subcommand: readonly string[], timeoutMs: number): Promise<InstallOutcome> {
  const { file, args, cwd, viaShell } = dshArgv()
  const child = launch(
    file,
    [...args, 'plugin', '--profile', profile, ...pluginArgs(profile, subcommand)],
    cwd,
    viaShell,
  )

  return new Promise<InstallOutcome>((settle) => {
    let output = ''
    let timedOut = false
    const collect = (chunk: Buffer): void => {
      output += chunk.toString()
      // Keep the tail: pnpm's useful diagnosis is always at the end.
      if (output.length > 8000) output = output.slice(-8000)
    }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeoutMs)

    child.on('error', (cause) => {
      clearTimeout(timer)
      settle({ ok: false, exitCode: null, timedOut, output: `${output}\n${cause.message}`.trim() })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      settle({ ok: code === 0 && !timedOut, exitCode: code, timedOut, output: output.trim() })
    })
  })
}

/**
 * The profile this host actually booted.
 *
 * Read from argv rather than assumed: installing into `web` while the user
 * runs a test profile would mutate a composition they are not looking at.
 * @param argv - process arguments; injectable for tests.
 * @returns the profile name, or `undefined` when the flag is absent.
 */
export function argvProfile(argv: readonly string[] = process.argv): string | undefined {
  const flag = argv.indexOf('--profile')
  const value = flag === -1 ? undefined : argv[flag + 1]
  return value !== undefined && !value.startsWith('-') ? value : undefined
}

/**
 * Restart this dsh host so a newly installed plugin loads.
 *
 * A process cannot restart itself: killing it first leaves nothing to start
 * the replacement. So a detached helper is spawned that outlives this one,
 * waits for the port to be released, and launches a fresh host. The mechanism
 * is dsh-market's (MIT); the timings are theirs too, and they are load-bearing
 * — the parent exits before the helper launches, or the new host finds the
 * port still bound.
 * @param profile - profile the replacement boots.
 * @returns the pids involved and where the replacement's output goes.
 */
export function scheduleRestart(profile: string): { pid: number; helperPid: number | undefined; log: string } {
  const { file, args, cwd, viaShell } = dshArgv()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const log = join(tmpdir(), `dsh-research-restart-${stamp}.log`)
  const relaunch = [...args, 'web']
  const helperCode = [
    "const { spawn } = require('node:child_process')",
    "const fs = require('node:fs')",
    `const file = ${JSON.stringify(file)}`,
    `const args = ${JSON.stringify(relaunch)}`,
    `const cwd = ${JSON.stringify(cwd ?? process.cwd())}`,
    `const viaShell = ${JSON.stringify(viaShell)}`,
    `const log = ${JSON.stringify(log)}`,
    'setTimeout(() => {',
    '  try {',
    '    const out = fs.openSync(log, "a")',
    '    const child = spawn(file, args, { cwd, detached: true, stdio: ["ignore", out, out], env: process.env, shell: viaShell })',
    '    child.unref()',
    '  } catch {}',
    '}, 1500)',
  ].join('\n')
  const helper = spawn(process.execPath, ['-e', helperCode], { detached: true, stdio: 'ignore', env: process.env })
  helper.unref()
  setTimeout(() => process.kill(process.pid, 'SIGTERM'), 500)
  return { pid: process.pid, helperPid: helper.pid, log }
}

/**
 * Whether a process-control request came from this host on loopback.
 *
 * Stricter than the same-origin check the install route uses, because this
 * ends the process: only a loopback peer qualifies, and any forwarding header
 * means that peer is a proxy rather than the person at the machine.
 * @param request - the incoming request.
 * @returns whether the restart may proceed.
 */
export function trustedRestartRequest(request: {
  headers: Record<string, string | string[] | undefined>
  socket: { remoteAddress?: string | undefined }
}): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  if (request.headers['forwarded'] !== undefined
    || request.headers['x-forwarded-for'] !== undefined
    || request.headers['x-real-ip'] !== undefined) return false
  const origin = request.headers['origin']
  const host = request.headers['host']
  if (typeof origin !== 'string' || typeof host !== 'string') return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  } catch {
    return false
  }
}
