import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readUserSkillVersion, type SyncResult } from './skill-sync.js'

// One time nudge in the terminal driven by the result of an upstream
// `maybeAutoUpdateSkill` call. The combinations are:
//
//   'updated' → auto-upgrade succeeded silently; no nudge needed
//   'current' → skill matches CLI; no nudge needed
//   'absent'  → no skill installed → nudge "run init-claude to install"
//   'edited'  → user-edited stale skill → nudge "run init-claude --force to refresh"
//
// We marker on (cli, syncResult) so the user gets at most one nudge per
// transition. After an upgrade that flips the state (e.g. 'current' → 'edited'),
// the marker no longer matches and the hint fires exactly once.

const CONFIG_DIR = join(homedir(), '.config', 'simulang')
const MARKER_FILE = join(CONFIG_DIR, '.claude-hint-shown')
const MACOS_PERMS_MARKER_FILE = join(CONFIG_DIR, '.macos-perms-hint-shown')

interface HintEnv {
  cliVersion: string
  syncResult: SyncResult
}

interface MarkerState {
  cli: string
  result: SyncResult
}

function readMarker(): MarkerState | null {
  try {
    const parsed = JSON.parse(readFileSync(MARKER_FILE, 'utf8')) as { cli?: unknown; result?: unknown }
    if (typeof parsed.cli !== 'string') return null
    if (parsed.result !== 'absent' && parsed.result !== 'edited') return null
    return { cli: parsed.cli, result: parsed.result }
  } catch {
    return null
  }
}

function suppressed(): boolean {
  if (!process.stdout.isTTY || !process.stderr.isTTY) return true
  if (process.env.CI) return true
  // Only nudge users who have Claude Code installed.
  if (!existsSync(join(homedir(), '.claude'))) return true
  return false
}

// macOS-only: nudge once per CLI version about the three TCC permissions
// that gate Screen Recording / Accessibility / Input Monitoring. We can't
// preflight without native bindings, so this is purely an upfront pointer
// at the README — better than letting the user discover it three calls
// into their first script.
//
// Suppressed by the same TTY/CI rules as the Claude hint, plus
// SIMULANG_QUIET=1 for users who've already set everything up and don't
// want any chatter on a new CLI install.
export function maybeShowMacosPermissionsHint({ cliVersion }: { cliVersion: string }): void {
  try {
    if (process.platform !== 'darwin') return
    if (process.env.SIMULANG_QUIET) return
    if (!process.stdout.isTTY || !process.stderr.isTTY) return
    if (process.env.CI) return

    let shownForCli: string | null = null
    try {
      const parsed = JSON.parse(readFileSync(MACOS_PERMS_MARKER_FILE, 'utf8')) as { cli?: unknown }
      if (typeof parsed.cli === 'string') shownForCli = parsed.cli
    } catch {
      // No marker yet — fall through and show the hint.
    }
    if (shownForCli === cliVersion) return

    process.stderr.write(
      'ℹ First run on macOS? Scripts need Screen Recording, Accessibility, and Input Monitoring\n' +
        '  granted to your terminal/IDE (Cursor, iTerm, Terminal, …). Run `simulang setup` once\n' +
        '  to trigger the prompts. Silence this hint with SIMULANG_QUIET=1.\n',
    )

    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(
      MACOS_PERMS_MARKER_FILE,
      JSON.stringify({ cli: cliVersion, shownAt: new Date().toISOString() }, null, 2) + '\n',
    )
  } catch {
    // A broken hint must never interrupt the command the user actually asked for.
  }
}

export function maybeShowClaudeCodeHint({ cliVersion, syncResult }: HintEnv): void {
  try {
    if (syncResult === 'updated' || syncResult === 'current') return
    if (suppressed()) return

    const marker = readMarker()
    if (marker && marker.cli === cliVersion && marker.result === syncResult) return

    let msg: string
    if (syncResult === 'absent') {
      msg =
        'ℹ Claude Code detected. Run `simulang init-claude` to install a skill that teaches Claude how to use simulang and simulang-js (one-time).'
    } else {
      // 'edited': we left the file alone because the user modified it.
      const skillVersion = readUserSkillVersion()
      msg = `ℹ The simulang Claude Code skill on disk (${skillVersion ?? 'unknown version'}) has local edits and is older than CLI ${cliVersion}. Run \`simulang init-claude --force\` to overwrite, or update it manually.`
    }

    process.stderr.write(`${msg}\n`)

    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(
      MARKER_FILE,
      JSON.stringify({ cli: cliVersion, result: syncResult, shownAt: new Date().toISOString() }, null, 2) + '\n',
    )
  } catch {
    // A broken hint must never interrupt the command the user actually asked for.
  }
}
