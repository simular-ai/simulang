import { spawn } from 'node:child_process'
import { resolve as resolvePath } from 'node:path'
import { resolveSimulangSpec, SIMULANG_JS } from './which.js'

const LOADER_URL = new URL('./loader.js', import.meta.url)

// Inline preload, passed via `node -e` in interactive mode. Copies every
// simulang-js export onto globalThis so they're usable at the REPL prompt
// without an explicit `await import(...)`. Runs AFTER `--import loader.js`,
// so the bare specifier resolves through the simulang loader hooks the same
// way it would in a user script.
//
// Note the `.then()` chain rather than top-level await: Node rejects
// `--input-type=module` together with `-i` ("Cannot specify --input-type for
// REPL"), so the preload has to live in CommonJS land. The promise resolves
// during REPL startup — well before the first prompt — so `App`, `FocusPolicy`,
// etc. are already on globalThis by the time the user types anything.
const REPL_PRELOAD = `import(${JSON.stringify(SIMULANG_JS)}).then(m => { for (const [k, v] of Object.entries(m)) { if (k !== 'default') globalThis[k] = v } globalThis.simulang = m }, err => { console.error('simulang: failed to pre-load ${SIMULANG_JS}:', err && err.message ? err.message : err) })`

export interface RunOptions {
  // When true, drop into a Node REPL instead of executing a script. The two
  // modes share everything except the args handed to the spawned `node` after
  // `--import loader.js`.
  interactive?: boolean
  scriptPath: string | null
  scriptArgs?: string[]
  simulangPath?: string | null
}

export async function run({
  interactive = false,
  scriptPath,
  scriptArgs = [],
  simulangPath = null,
}: RunOptions): Promise<number> {
  if (!interactive && !scriptPath) {
    throw new Error('Missing script path. Usage: simulang run [--simulang-js=<path>] <script>')
  }
  const loader = LOADER_URL.href
  // The `--simulang-js=` flag wins; otherwise inherit the env var (if set).
  // Both accept the same spec shapes — path, exact version, or `latest` — and
  // go through the same `resolveSimulangSpec` as `simulang which`, so the two
  // commands can never disagree on what a given spec means.
  // SIMULANG_SIMULIB is the pre-rename env var, accepted as an undocumented
  // fallback so shells that still export it keep working.
  const effectiveSpec = simulangPath ?? process.env.SIMULANG_JS ?? process.env.SIMULANG_SIMULIB ?? null

  const env: NodeJS.ProcessEnv = { ...process.env }
  if (!env.OPENROUTER_API_KEY) {
    process.stderr.write(
      'simulang: warning: OPENROUTER_API_KEY is not set; scripts that hit hosted services will fail to authenticate.\n',
    )
  }
  if (effectiveSpec) {
    const result = await resolveSimulangSpec(effectiveSpec, { mode: 'install' })
    env.SIMULANG_JS = resolvePath(process.cwd(), result.path)
  }

  const nodeArgs = interactive
    ? ['--import', loader, '-e', REPL_PRELOAD, '-i']
    : ['--import', loader, resolvePath(process.cwd(), scriptPath as string), ...scriptArgs]

  const child = spawn(process.execPath, nodeArgs, {
    stdio: 'inherit',
    env,
  })

  // Forward common termination signals so Ctrl+C in the CLI propagates cleanly.
  const forward = (signal: NodeJS.Signals): void => {
    if (!child.killed) child.kill(signal)
  }
  process.on('SIGINT', () => forward('SIGINT'))
  process.on('SIGTERM', () => forward('SIGTERM'))

  return await new Promise<number>((resolveExit, rejectExit) => {
    child.on('error', rejectExit)
    child.on('exit', (code, signal) => {
      if (signal) {
        // Re-raise the signal on the parent so the parent's exit reflects it.
        process.kill(process.pid, signal)
        return
      }
      resolveExit(code ?? 0)
    })
  })
}
