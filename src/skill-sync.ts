import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SKILL_NAME = 'simulang'

// Walk up from this module to the package's own package.json. Works whether
// this file is loaded from `src/` (dev) or `dist/src/` (post-build), and is
// resilient to wherever npm installs the package on disk.
function findOwnPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string }
        if (pkg.name === '@simular-ai/simulang') return dir
      } catch {
        // Malformed package.json: keep walking.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) throw new Error('Could not locate the simulang package root')
    dir = parent
  }
}

const SKILL_TEMPLATE_PATH = join(findOwnPackageRoot(), 'SKILL.md')

function readSkillTemplate(): string {
  return readFileSync(SKILL_TEMPLATE_PATH, 'utf8')
}

// Install path layout (per install location):
//   <dir>/SKILL.md       — the skill body
//   <dir>/manifest.json  — { cli, contentHash, installedAt }
//
// The content hash lets us tell whether an installed skill is pristine (safe
// to auto-upgrade) or user-edited (must not be silently overwritten).

export interface Manifest {
  cli: string
  contentHash: string
  installedAt: string
}

export const USER_SKILL_DIR = join(homedir(), '.claude', 'skills', SKILL_NAME)

export function projectSkillDir(cwd: string = process.cwd()): string {
  return join(cwd, '.claude', 'skills', SKILL_NAME)
}

export function skillFile(dir: string): string {
  return join(dir, 'SKILL.md')
}

export function manifestFile(dir: string): string {
  return join(dir, 'manifest.json')
}

export function hashContent(content: string): string {
  return 'sha256-' + createHash('sha256').update(content).digest('hex')
}

// Strict semver triple, ignoring prerelease tags for ordering. We only need
// "is X older than Y"; exact equality and "lexically newer" are both fine to
// treat as "no update needed."
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): [number, number, number] => {
    const m = v.match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!m) return [0, 0, 0]
    return [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  const [a1, a2, a3] = parse(a)
  const [b1, b2, b3] = parse(b)
  if (a1 !== b1) return a1 - b1
  if (a2 !== b2) return a2 - b2
  return a3 - b3
}

export function readManifest(dir: string): Manifest | null {
  try {
    const parsed = JSON.parse(readFileSync(manifestFile(dir), 'utf8')) as Partial<Manifest>
    if (typeof parsed.cli !== 'string' || typeof parsed.contentHash !== 'string') return null
    return {
      cli: parsed.cli,
      contentHash: parsed.contentHash,
      installedAt: typeof parsed.installedAt === 'string' ? parsed.installedAt : '',
    }
  } catch {
    return null
  }
}

export function writeSkill(dir: string, cliVersion: string): Manifest {
  const content = readSkillTemplate()
  mkdirSync(dir, { recursive: true })
  writeFileSync(skillFile(dir), content)
  const manifest: Manifest = {
    cli: cliVersion,
    contentHash: hashContent(content),
    installedAt: new Date().toISOString(),
  }
  writeFileSync(manifestFile(dir), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

// Auto-upgrade outcome for the user-level skill. The startup path in
// `bin/simulang.ts` calls `maybeAutoUpdateSkill` and then passes the result
// to the first-run hint, so the hint can suppress its nudge in the cases
// we've already resolved.
export type SyncResult =
  | 'updated' // we just rewrote SKILL.md to the new template
  | 'edited' // skill is stale but the user has edited it; we left it alone
  | 'current' // skill matches this CLI; nothing to do
  | 'absent' // no skill installed yet

export function maybeAutoUpdateSkill({ cliVersion }: { cliVersion: string }): SyncResult {
  try {
    const manifest = readManifest(USER_SKILL_DIR)
    if (manifest === null) return 'absent'

    // Only act when the on-disk skill is strictly older than this CLI. If it
    // matches or is *ahead* (e.g. the user downgraded the CLI temporarily),
    // we leave it alone — auto-downgrading the skill would clobber newer
    // content with an older template.
    if (compareVersions(manifest.cli, cliVersion) >= 0) return 'current'

    let onDisk: string
    try {
      onDisk = readFileSync(skillFile(USER_SKILL_DIR), 'utf8')
    } catch {
      return 'absent'
    }
    // Hash mismatch ⇒ user has edited the file; refuse to auto-overwrite.
    if (hashContent(onDisk) !== manifest.contentHash) return 'edited'

    writeSkill(USER_SKILL_DIR, cliVersion)
    return 'updated'
  } catch {
    // Any filesystem failure: bail out silently. The hint path will still
    // run and may or may not nudge depending on what state it can observe.
    return 'absent'
  }
}

// Convenience for callers (the hint) that want to know the installed version
// without re-deriving it from a Manifest.
export function readUserSkillVersion(): string | null {
  return readManifest(USER_SKILL_DIR)?.cli ?? null
}
