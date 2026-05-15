import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, posix, win32 } from 'node:path'
import { SIMULANG_JS } from './which.js'

// All npm/network operations and on-disk cache layout for `--simulang-js=<version>`
// live here. The resolver (resolver.ts) calls into this module — never the
// other way around for installation work — so anything that touches `npm`,
// writes to the cache, or knows where the cache lives is in this file.
//
// Three public operations:
//   - findCachedSimulangVersion(version)   read-only cache lookup
//   - installSimulangVersion(version)      `npm install` into the cache
//   - resolveSimulangTag(tag)              `npm view` to resolve `latest` etc.
//
// Cross-platform detail: cache root by OS (XDG / Library/Caches / LOCALAPPDATA),
// `posix.join` vs `win32.join` chosen at call time so unit tests that stub
// `process.platform` produce correct separators, and `npm` is invoked as
// `npm.cmd` on Windows.

// Returns the absolute path to the installed simulang-js inside our cache for
// `version` if a previous `installSimulangVersion` succeeded, else null. Never
// performs network or shell calls — pure filesystem check.
export function findCachedSimulangVersion(version: string): string | null {
  const path = simulangCachePath(version)
  return existsSync(join(path, 'package.json')) ? path : null
}

// Installs `@simular-ai/simulang-js@<version>` into the per-version cache and
// returns the absolute path to the installed package. Throws on any failure
// (npm errors, missing manifest after install, etc.).
export async function installSimulangVersion(version: string): Promise<string> {
  const dir = cacheDirForVersion(version)
  await seedCacheDir(dir, version)
  await runNpm(
    [
      'install',
      `${SIMULANG_JS}@${version}`,
      '--prefix',
      dir,
      '--no-save',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
    ],
    { cwd: dir, capture: false },
  )
  const installed = simulangCachePath(version)
  if (!existsSync(join(installed, 'package.json'))) {
    throw new Error(`npm install finished but ${SIMULANG_JS} is not present at ${installed}.`)
  }
  return installed
}

// Resolves a dist-tag (e.g. `latest`) to an exact version via `npm view`.
// Runs in a seeded cache directory so npm has a manifest to anchor to; the
// public npmjs.org registry is used by default.
export async function resolveSimulangTag(tag: string): Promise<string> {
  const root = cacheRoot()
  await seedCacheDir(root)
  const stdout = await runNpm(['view', `${SIMULANG_JS}@${tag}`, 'version', '--json'], { cwd: root, capture: true })
  const trimmed = stdout.trim()
  if (!trimmed) throw new Error(`Could not resolve ${SIMULANG_JS}@${tag}: empty response from npm view.`)
  // `npm view ... --json` returns a JSON-encoded string (with quotes); fall
  // back to the raw line if a future npm omits the wrapping.
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed === 'string') return parsed
  } catch {
    // not JSON
  }
  return trimmed
}

function cacheRoot(): string {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? win32.join(homedir(), 'AppData', 'Local')
    return win32.join(base, 'simulang', 'Cache')
  }
  if (process.platform === 'darwin') {
    return posix.join(homedir(), 'Library', 'Caches', 'simulang')
  }
  const base = process.env.XDG_CACHE_HOME ?? posix.join(homedir(), '.cache')
  return posix.join(base, 'simulang')
}

function cacheDirForVersion(version: string): string {
  const platformJoin = process.platform === 'win32' ? win32.join : posix.join
  return platformJoin(cacheRoot(), 'versions', version)
}

function simulangCachePath(version: string): string {
  return join(cacheDirForVersion(version), 'node_modules', SIMULANG_JS)
}

const npmBin = (): string => (process.platform === 'win32' ? 'npm.cmd' : 'npm')

// Seed a directory with a minimal package.json so `npm install` / `npm view`
// don't complain about a missing manifest. simulang-js lives on the public
// npmjs.org registry, so no scope→registry override is needed here.
async function seedCacheDir(dir: string, version?: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) {
    const name = version ? `simulang-cache-${version.replace(/[^a-z0-9.-]/gi, '-')}` : 'simulang-cache'
    await writeFile(pkgPath, JSON.stringify({ name, version: '0.0.0', private: true }, null, 2) + '\n', 'utf8')
  }
}

async function runNpm(args: string[], { cwd, capture }: { cwd: string; capture: boolean }): Promise<string> {
  return await new Promise<string>((resolveExit, reject) => {
    const child = spawn(npmBin(), args, {
      cwd,
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    })
    let stdout = ''
    if (capture && child.stdout) {
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk
      })
    }
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') reject(new Error(`Could not run \`${npmBin()}\`. Is npm on your PATH?`))
      else reject(err)
    })
    child.on('exit', (exitCode, signal) => {
      if (signal) reject(new Error(`\`${npmBin()} ${args.join(' ')}\` was killed by signal ${signal}.`))
      else if (exitCode !== 0)
        reject(new Error(`\`${npmBin()} ${args.join(' ')}\` exited with code ${exitCode ?? 'null'}.`))
      else resolveExit(stdout)
    })
  })
}
