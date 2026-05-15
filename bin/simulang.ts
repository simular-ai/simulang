#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSimulangSpec, SIMULANG_JS, whichSimulang } from '../src/which.js'
import { run, type RunOptions } from '../src/run.js'
import { parseInitClaudeFlags, runInitClaude } from '../src/init-claude.js'
import { runSetup } from '../src/setup.js'
import { maybeShowClaudeCodeHint, maybeShowMacosPermissionsHint } from '../src/first-run-hint.js'
import { maybeAutoUpdateSkill } from '../src/skill-sync.js'

const USAGE = `Usage:
  simulang run         [--simulang-js=<path|version|latest>] <script> [...args]
  simulang run         [--simulang-js=<path|version|latest>] --interactive   # drop into a Node REPL
  simulang which       [--simulang-js=<path|version|latest>] <script>
  simulang setup                                         # request macOS permissions (one-time, per host)
  simulang init-claude [--project] [--check] [--force]   # install Claude Code skill
  simulang --help
  simulang --version

  --simulang-js= accepts a path (e.g. ./vendored), an exact version (e.g. 0.2.1), or
  the tag \`latest\`. Versions and tags install on demand into a per-version
  cache and are reused on subsequent invocations.

  setup triggers the macOS Screen Recording, Accessibility, and Input Monitoring
  prompts so the host running simulang is auto-added to each list. No-op on
  Windows / Linux.

  init-claude installs a Claude Code skill describing how to use simulang and
  simulang-js. Default target is ~/.claude/skills/simulang/; pass --project to
  install into <cwd>/.claude/skills/simulang/ instead.

Environment:
  SIMULANG_JS  Same shape as --simulang-js=: a path, an exact version (e.g. 0.2.1), or
                       \`latest\`. Versions / tags install on demand into the per-version
                       cache. The --simulang-js= flag overrides this when both are set.
  OPENROUTER_API_KEY   Required by scripts that hit hosted services. \`simulang run\` warns
                       on stderr when unset, but still executes the script.
`

interface ParsedScriptArgs {
  simulangPath: string | null
  interactive: boolean
  scriptPath: string | null
  scriptArgs: string[]
}

type ParseResult = { args: ParsedScriptArgs } | { error: string }

function readPackageVersion(): string {
  // Walk up from this file (src or compiled) to the nearest package.json. This
  // is robust to the difference between running from `bin/` (source) and
  // `dist/bin/` (compiled).
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string; version?: string }
      if (pkg.name === '@simular-ai/simulang' && typeof pkg.version === 'string') return pkg.version
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error("Could not locate the simulang CLI's package.json")
    }
    dir = parent
  }
}

function printVersion(): void {
  process.stdout.write(`@simular-ai/simulang ${readPackageVersion()}\n`)

  const bundled = whichSimulang({})
  if (bundled) {
    process.stdout.write(`@simular-ai/simulang-js ${bundled.version} (bundled)\n`)
  } else {
    process.stdout.write(`@simular-ai/simulang-js (not installed)\n`)
  }
}

async function printWhich({
  scriptPath,
  simulangOverride,
}: {
  scriptPath: string
  simulangOverride: string | null
}): Promise<void> {
  // SIMULANG_JS lets `simulang which script.simulang` reflect what
  // `simulang run` would pick up if the user has the env var set globally.
  // Same resolver as `run`, just in `check` mode so we never trigger an
  // install — `which` is diagnostic-only.
  // SIMULANG_SIMULIB is the pre-rename env var, accepted as an undocumented
  // fallback for users who still have it exported.
  const rawOverride = simulangOverride ?? process.env.SIMULANG_JS ?? process.env.SIMULANG_SIMULIB ?? null
  let override: string | null = null
  if (rawOverride) {
    let resolution
    try {
      resolution = await resolveSimulangSpec(rawOverride, { mode: 'check' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Could not resolve ${SIMULANG_JS} override "${rawOverride}": ${message}\n`)
      process.exit(1)
    }
    if (resolution.resolvedFromTag) {
      const { tag, version } = resolution.resolvedFromTag
      process.stdout.write(`${SIMULANG_JS}@${tag} resolves to ${version}\n`)
    }
    if (!resolution.ok) {
      process.stderr.write(
        `${SIMULANG_JS}@${resolution.version} is not installed yet — run \`simulang run --simulang-js=${resolution.version} <script>\` to fetch it.\n`,
      )
      process.exit(1)
    }
    override = resolution.path
  }
  const result = whichSimulang({ scriptPath, simulangOverride: override })
  if (!result) {
    process.stderr.write(`${SIMULANG_JS}: not found (no override, no script-local install, no bundled copy)\n`)
    process.exit(1)
  }
  process.stdout.write(`${SIMULANG_JS} ${result.version}\n`)
  process.stdout.write(`  source: ${result.source}\n`)
  process.stdout.write(`  path:   ${result.path}\n`)
}

// Parses "[--simulang-js=<path>] <script> [...trailing]" — shared by `run` and `which`.
// `which` rejects trailing args; `run` forwards them to the spawned script.
//
// Returns `{ args }` on success or `{ error }` on a malformed flag.
function parseScriptArgs(argv: string[]): ParseResult {
  const args: ParsedScriptArgs = { simulangPath: null, interactive: false, scriptPath: null, scriptArgs: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--') {
      args.scriptArgs.push(...argv.slice(i + 1))
      break
    }

    // `--simulib=` is the pre-rename flag, accepted as an undocumented alias
    // so existing scripts / aliases / CI invocations keep working. Error
    // messages always point users at the canonical `--simulang-js=` form.
    if (arg === '--simulang-js' || arg === '--simulib') {
      return { error: `Use --simulang-js=<path>, not ${arg} <path>.` }
    } 
    const legacyPrefix = ['--simulang-js=', '--simulib='].find((p) => arg.startsWith(p))
    if (legacyPrefix) {
      const value = arg.slice(legacyPrefix.length)
      if (!value) return { error: `${legacyPrefix} requires a value (use --simulang-js=<path>).` }
      args.simulangPath = value
      continue
    }

    if (arg === '--interactive' || arg === '-i') {
      args.interactive = true
      continue
    }

    // Reject unknown long flags rather than silently turning a typo into the
    // script path (e.g. `--similib=/x` — note the typo — would otherwise be
    // treated as the script path, leading to a confusing failure).
    if (arg.startsWith('--')) {
      return { error: `Unknown flag: ${arg}` }
    }

    if (!args.scriptPath) {
      args.scriptPath = arg
    } else {
      args.scriptArgs.push(arg)
    }
  }
  return { args }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2)

  // Sync the user-level Claude Code skill before dispatch:
  //   1. If the on-disk skill matches a prior shipped version (hash check),
  //      silently overwrite it with the current template.
  //   2. Otherwise nudge once via the hint, keyed on the sync result so we
  //      re-nudge on transitions (no install → installed, edited → still
  //      edited but newer CLI, etc.).
  // Both calls are best-effort and silent on failure.
  const cliVersion = readPackageVersion()
  const syncResult = maybeAutoUpdateSkill({ cliVersion })
  maybeShowClaudeCodeHint({ cliVersion, syncResult })

  if (!cmd || cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE)
    process.exit(cmd ? 0 : 2)
  }

  if (cmd === '--version' || cmd === '-v') {
    printVersion()
    return
  }

  if (cmd === 'init-claude') {
    const parsed = parseInitClaudeFlags(rest)
    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n\n${USAGE}`)
      process.exit(2)
    }
    const exitCode = await runInitClaude(parsed.flags.options)
    process.exit(exitCode)
  }

  if (cmd === 'setup') {
    if (rest.length > 0) {
      process.stderr.write(`\`simulang setup\` does not accept arguments.\n\n${USAGE}`)
      process.exit(2)
    }
    const exitCode = await runSetup()
    process.exit(exitCode)
  }

  if (cmd === 'run' || cmd === 'which') {
    const parsed = parseScriptArgs(rest)
    if ('error' in parsed) {
      process.stderr.write(`${parsed.error}\n\n${USAGE}`)
      process.exit(2)
    }
    const { args } = parsed

    if (cmd === 'run') {
      // Permissions only matter for actually running scripts. Skip the hint
      // for `simulang which`, `--version`, `--help`, and `init-claude` so we
      // don't nag people doing diagnostic / setup work.
      maybeShowMacosPermissionsHint({ cliVersion })
      if (args.interactive) {
        // `--interactive` is mutually exclusive with a script path: if the
        // user wanted a script they wouldn't be asking for a REPL.
        if (args.scriptPath || args.scriptArgs.length > 0) {
          process.stderr.write(`\`simulang run --interactive\` does not accept a script path or args.\n\n${USAGE}`)
          process.exit(2)
        }
        const exitCode = await run({ interactive: true, scriptPath: null, simulangPath: args.simulangPath })
        process.exit(exitCode)
      }
      if (!args.scriptPath) {
        process.stderr.write(`Missing script path.\n\n${USAGE}`)
        process.exit(2)
      }
      const runOptions: RunOptions = {
        scriptPath: args.scriptPath,
        scriptArgs: args.scriptArgs,
        simulangPath: args.simulangPath,
      }
      const exitCode = await run(runOptions)
      process.exit(exitCode)
    }

    // cmd === 'which'
    if (args.interactive) {
      process.stderr.write(`\`simulang which\` does not accept --interactive.\n\n${USAGE}`)
      process.exit(2)
    }
    if (!args.scriptPath) {
      process.stderr.write(`Missing script path.\n\n${USAGE}`)
      process.exit(2)
    }
    if (args.scriptArgs.length > 0) {
      process.stderr.write(`\`simulang which\` does not accept trailing args.\n\n${USAGE}`)
      process.exit(2)
    }
    await printWhich({ scriptPath: args.scriptPath, simulangOverride: args.simulangPath })
    return
  }

  process.stderr.write(`Unknown command: ${cmd}\n\n${USAGE}`)
  process.exit(2)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`simulang: ${message}\n`)
  process.exit(1)
})
