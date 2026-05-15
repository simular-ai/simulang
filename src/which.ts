import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findCachedSimulangVersion, installSimulangVersion, resolveSimulangTag } from './install-simulang.js'

// Single home for "where does simulang-js live?". Two related questions
// answered here, kept together so they can never drift apart:
//
//   1. resolveSimulangSpec(spec, { mode })   --simulang-js=<path|version|latest>
//      Translates a user-provided spec into a filesystem path. In `install`
//      mode it delegates to install-simulang.ts to fetch missing versions; in
//      `check` mode it returns `{ ok: false }` instead. `simulang run` and
//      `simulang which` both go through this function.
//
//   2. resolveSimulangRoot({ parentURL, simulangOverride })
//      Picks an actual simulang-js install: explicit override wins, else walk
//      node_modules from a script URL, else fall back to the CLI's bundled
//      copy. Used by `simulang which` and src/hooks.ts (runtime ESM resolution).
//
// All `npm` shelling and on-disk cache layout lives in install-simulang.ts;
// this file is pure orchestration plus local filesystem walking.

export const SIMULANG_JS = '@simular-ai/simulang-js'

// Legacy alias. The library was renamed from `simulib-js` to `simulang-js`;
// accepting the old name keeps pre-rename user scripts and project-local
// installs working without changes. Intentionally undocumented — new code
// should use `simulang-js`.
export const SIMULIB_JS = '@simular-ai/simulib-js'

export const KNOWN_LIB_NAMES: readonly string[] = [SIMULANG_JS, SIMULIB_JS]

// True for the bare package or any subpath import (`<name>` or `<name>/foo`).
export function isLibSpecifier(specifier: string): boolean {
  return KNOWN_LIB_NAMES.some((name) => specifier === name || specifier.startsWith(name + '/'))
}

// Returns whichever of KNOWN_LIB_NAMES the specifier started with, or null.
// Callers need the matched prefix to strip it when computing subpaths.
export function libNameFromSpecifier(specifier: string): string | null {
  return KNOWN_LIB_NAMES.find((name) => specifier === name || specifier.startsWith(name + '/')) ?? null
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimulangSource = 'override' | 'script-local' | 'bundled'

export interface SimulangRoot {
  source: SimulangSource
  path: string
}

export interface SimulangInfo extends SimulangRoot {
  version: string
}

export interface ResolveSimulangRootOptions {
  parentURL?: string | null
  simulangOverride?: string | null
}

export interface WhichSimulangOptions {
  scriptPath?: string | null
  simulangOverride?: string | null
}

export interface TagResolution {
  tag: string
  version: string
}

export type SimulangResolution =
  | { ok: true; path: string; resolvedFromTag?: TagResolution }
  | { ok: false; reason: 'not-installed'; version: string; resolvedFromTag?: TagResolution }

export type ResolveMode = 'install' | 'check'

// ---------------------------------------------------------------------------
// Spec → cache path  (--simulang-js=<path|version|latest>)
// ---------------------------------------------------------------------------

// Strict semver: MAJOR.MINOR.PATCH with optional prerelease / build suffix.
// Anything that isn't an exact version or a known tag is taken to be a path —
// the existing override semantics, fully backward compatible.
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/
const KNOWN_TAGS = new Set(['latest'])

type SpecKind = 'path' | 'version' | 'tag'

function classifySpec(spec: string): SpecKind {
  if (EXACT_VERSION.test(spec)) return 'version'
  if (KNOWN_TAGS.has(spec)) return 'tag'
  return 'path'
}

// Overloads narrow the return type for the install path so callers don't
// have to handle an `ok: false` branch that can't happen there (install mode
// either succeeds or throws).
export async function resolveSimulangSpec(
  spec: string,
  opts: { mode: 'install' },
): Promise<{ ok: true; path: string; resolvedFromTag?: TagResolution }>
export async function resolveSimulangSpec(spec: string, opts: { mode: 'check' }): Promise<SimulangResolution>
export async function resolveSimulangSpec(spec: string, { mode }: { mode: ResolveMode }): Promise<SimulangResolution> {
  const kind = classifySpec(spec)
  if (kind === 'path') return { ok: true, path: spec }

  const resolvedFromTag = kind === 'tag' ? { tag: spec, version: await resolveSimulangTag(spec) } : undefined
  const version = resolvedFromTag?.version ?? spec

  const cached = findCachedSimulangVersion(version)
  if (cached) return { ok: true, path: cached, resolvedFromTag }
  if (mode === 'check') return { ok: false, reason: 'not-installed', version, resolvedFromTag }

  const installed = await installSimulangVersion(version)
  return { ok: true, path: installed, resolvedFromTag }
}

// ---------------------------------------------------------------------------
// Filesystem context → simulang install  (override / script-local / bundled)
// ---------------------------------------------------------------------------

// Resolution order:
//   1. override:     `simulangOverride` (from --simulang-js flag or SIMULANG_JS env var)
//   2. script-local: walk node_modules from `parentURL` (a script's URL)
//   3. bundled:      this CLI's own node_modules
//
// Returns `{ source, path }` or null if simulang-js cannot be found anywhere.
//
// Uses `createRequire(...).resolve(...)` rather than the ESM resolver
// (`nextResolve` / `import.meta.resolve`) for one specific reason: it must run
// identically inside loader hooks AND in normal userland.
//   - `nextResolve` is only available inside loader hooks.
//   - `import.meta.resolve(specifier, parent)` ignores the `parent` argument
//      in Node >= 22 (the two-argument form was always experimental and got
//      dropped). It always resolves relative to the calling module.
// `createRequire(parentURL).resolve(specifier)` is the only API that honors an
// arbitrary parent in both contexts. For `@simular-ai/simulang-js` (whose
// `exports['.']` has no condition-specific entries) the CommonJS and ESM
// resolvers produce identical paths, so we lose nothing.
export function resolveSimulangRoot({
  parentURL = null,
  simulangOverride = null,
}: ResolveSimulangRootOptions = {}): SimulangRoot | null {
  if (simulangOverride) {
    return { source: 'override', path: resolvePath(process.cwd(), simulangOverride) }
  }
  if (parentURL) {
    const localRoot = tryResolveFrom(parentURL)
    if (localRoot) return { source: 'script-local', path: localRoot }
  }
  // Bundled fallback: anchor at this module's URL → the CLI's own node_modules,
  // independent of whatever script the user is running.
  const bundledRoot = tryResolveFrom(import.meta.url)
  if (bundledRoot) return { source: 'bundled', path: bundledRoot }
  return null
}

// CLI-friendly wrapper: takes a script path (the natural input for
// `simulang which <script>`) and adds the resolved version from package.json.
export function whichSimulang({
  scriptPath = null,
  simulangOverride = null,
}: WhichSimulangOptions = {}): SimulangInfo | null {
  const parentURL = scriptPath ? pathToFileURL(resolvePath(process.cwd(), scriptPath)).href : null
  const root = resolveSimulangRoot({ parentURL, simulangOverride })
  if (!root) return null
  const pkg = JSON.parse(readFileSync(join(root.path, 'package.json'), 'utf8')) as { version: string }
  return { ...root, version: pkg.version }
}

function tryResolveFrom(parentURL: string): string | null {
  // createRequire only accepts file:// URLs (and absolute paths). Other URL
  // schemes (data:, node:, http:) have no node_modules tree to walk.
  if (!parentURL.startsWith('file://')) return null
  // Try the canonical name first; fall back to the legacy alias so a
  // project-local pre-rename install (`node_modules/@simular-ai/simulib-js`)
  // is still found.
  const req = createRequire(parentURL)
  for (const name of KNOWN_LIB_NAMES) {
    try {
      return findPackageRoot(req.resolve(name))
    } catch (err) {
      if (isNotFound(err)) continue
      throw err
    }
  }
  return null
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object' || !('code' in err)) return false
  const { code } = err as { code: unknown }
  return code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'
}

// Walk up from an entry path (e.g. .../node_modules/@simular-ai/simulang-js/index.js)
// to the directory whose package.json's `name` matches the canonical name or
// the legacy alias.
function findPackageRoot(entryPath: string): string {
  let dir = dirname(entryPath)
  while (true) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: string }
      if (pkg.name && KNOWN_LIB_NAMES.includes(pkg.name)) return dir
    } catch {
      // No (or unreadable) package.json here — keep walking.
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`Could not locate ${SIMULANG_JS} package.json starting from ${entryPath}`)
    }
    dir = parent
  }
}
