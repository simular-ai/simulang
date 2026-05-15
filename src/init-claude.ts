import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareVersions, projectSkillDir, readManifest, USER_SKILL_DIR, writeSkill } from './skill-sync.js'

// Install layout (see skill-sync.ts):
//   ~/.claude/skills/simulang/SKILL.md
//   ~/.claude/skills/simulang/manifest.json
// or with --project, under `<cwd>/.claude/skills/simulang/`.

export interface InitClaudeOptions {
  project: boolean
  check: boolean
  force: boolean
}

interface ParsedFlags {
  options: InitClaudeOptions
}

type FlagsResult = { ok: true; flags: ParsedFlags } | { ok: false; error: string }

export function parseInitClaudeFlags(argv: string[]): FlagsResult {
  const options: InitClaudeOptions = { project: false, check: false, force: false }
  for (const arg of argv) {
    if (arg === '--project') options.project = true
    else if (arg === '--user') options.project = false
    else if (arg === '--check') options.check = true
    else if (arg === '--force') options.force = true
    else return { ok: false, error: `Unknown flag: ${arg}` }
  }
  if (options.check && options.force) {
    return { ok: false, error: '--check and --force are mutually exclusive.' }
  }
  return { ok: true, flags: { options } }
}

function readCliVersion(): string {
  // Walk up from this file (src or compiled) to the package.json that owns it.
  // Mirrors the resolution in `bin/simulang.ts` so we stay version-consistent.
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string; version?: string }
        if (pkg.name === '@simular-ai/simulang' && typeof pkg.version === 'string') return pkg.version
      } catch {
        // Continue walking on malformed package.json.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error("Could not locate the simulang CLI's package.json")
    }
    dir = parent
  }
}

export async function runInitClaude(options: InitClaudeOptions): Promise<number> {
  const cliVersion = readCliVersion()
  const target = options.project ? projectSkillDir() : USER_SKILL_DIR
  const manifest = readManifest(target)
  const location = options.project ? 'project' : 'user'

  if (options.check) {
    if (!manifest) {
      process.stdout.write(`simulang: no skill installed at ${target}\n`)
      return 1
    }
    const cmp = compareVersions(manifest.cli, cliVersion)
    if (cmp < 0) {
      process.stdout.write(
        `simulang: skill at ${target} is version ${manifest.cli}, CLI is ${cliVersion} — run \`simulang init-claude\` to update.\n`,
      )
      return 1
    }
    if (cmp > 0) {
      process.stdout.write(
        `simulang: skill at ${target} is version ${manifest.cli}, newer than this CLI (${cliVersion}).\n`,
      )
      return 0
    }
    process.stdout.write(`simulang: skill at ${target} is up to date (${cliVersion}).\n`)
    return 0
  }

  if (manifest && !options.force) {
    const cmp = compareVersions(manifest.cli, cliVersion)
    if (cmp >= 0) {
      process.stdout.write(
        `simulang: skill at ${target} already up to date (${manifest.cli}). Use --force to overwrite.\n`,
      )
      return 0
    }
  }

  writeSkill(target, cliVersion)
  const verb = manifest ? 'updated' : 'installed'
  process.stdout.write(`simulang: ${verb} ${location} skill at ${target} (version ${cliVersion}).\n`)
  return 0
}
