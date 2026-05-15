#!/usr/bin/env node
// Best-effort installer for the Claude Code skill, run automatically after
// `npm install`. Mirrors `simulang init-claude` (user-level, no --force) so the
// skill is in place the first time a user invokes the CLI — without them
// having to remember a follow-up command.
//
// Two safety rails:
//   1. If `dist/` is absent (fresh git clone before `npm run build`), bail
//      silently. The developer will run the build, and `simulang init-claude`
//      remains available manually.
//   2. Any failure is caught and reported to stderr without a non-zero exit
//      code, so a flaky filesystem or unexpected error never breaks the host
//      `npm install`.

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(here)
const initClaudeModule = join(packageRoot, 'dist', 'src', 'init-claude.js')

if (!existsSync(initClaudeModule)) {
  process.exit(0)
}

try {
  const { runInitClaude } = await import(initClaudeModule)
  await runInitClaude({ project: false, check: false, force: false })
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`simulang: skipped Claude skill install: ${message}\n`)
}
