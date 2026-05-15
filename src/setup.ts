import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from './run.js'

// `simulang setup` — run the bundled setup-permissions.mjs through the same
// `node --import loader.js <script>` pipeline that real user scripts use.
//
// Why this matters: macOS's TCC attributes a permission request to the
// running executable (and its responsible parent app). By going through the
// exact same spawn path as `simulang run`, the entry that lands in System
// Settings → Privacy & Security panes is the one that will be checked when
// the user runs their actual scripts. Triggering the same APIs from the
// `simulang` CLI process directly would attribute to a *different* path
// than what real scripts use, and the user would have to grant twice.

function findBundledScript(): string {
  // Walk up from this file (src or compiled) to the package root, then into
  // ./scripts/. Robust to running from `src/` (dev) or `dist/src/` (compiled).
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    const candidate = join(dir, 'scripts', 'setup-permissions.mjs')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error('Could not locate scripts/setup-permissions.mjs (is the package install complete?)')
    }
    dir = parent
  }
}

export async function runSetup(): Promise<number> {
  if (process.platform !== 'darwin') {
    process.stdout.write('simulang setup: nothing to do on this platform.\n')
    return 0
  }
  const scriptPath = findBundledScript()
  return await run({ scriptPath, scriptArgs: [], simulangPath: null })
}
