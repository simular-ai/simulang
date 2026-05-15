# `@simular-ai/simulang`

CLI for running Simulang scripts written in JavaScript or TypeScript, with full access to [`@simular-ai/simulang-js`](https://github.com/simular-ai/simulang-js) and the standard Node runtime.

Requires Node.js **22.18+**.

## Install

```bash
npm install -g @simular-ai/simulang
```

A copy of `@simular-ai/simulang-js` is bundled, so nothing else is needed.

## First run on macOS

macOS gates the APIs simulang-js drives behind three permissions, granted **per host app** — the terminal or IDE you launch `simulang` from (Terminal, iTerm, Cursor, VS Code, …):

- **Screen Recording** — for `Screen.screenshot()` and any vision-grounded action.
- **Accessibility** — for the AX tree, AX actions, and window control.
- **Input Monitoring** — for synthesized mouse and keyboard events to actually reach the foreground app.

Run this once, from the terminal/IDE you'll use:

```bash
simulang setup
```

It triggers each permission's system prompt one at a time. macOS will pop up a dialog for each, automatically add the requesting host to the corresponding System Settings pane, and offer an **Open System Settings** button — just toggle the entry on. The `setup` command then re-checks and reports what's still pending.

Re-run `simulang setup` any time you switch terminals, upgrade Node, or want to confirm everything is still granted. If a script silently does nothing (clicks not landing, screenshots all-black), missing permissions are almost always the cause — re-run setup.

## First run on Windows

Windows has no system-wide accessibility prompt, but two things can bite on the first run:

- The bundled native `.node` binary may be marked as downloaded and blocked by SmartScreen. If `simulang run` fails with a load error, run PowerShell `Get-ChildItem -Recurse <node_modules path> | Unblock-File` against the simulang install directory.
- If your script targets an elevated app, launch your terminal **as Administrator**.

## Usage

```bash
simulang run hello.ts           # run a script
simulang run --interactive      # Node REPL with simulang-js pre-imported (alias: -i)
simulang which hello.ts         # show which simulang-js a script would resolve
simulang --version              # prints the CLI version + the bundled simulang-js version
```

Scripts can be `.ts`, `.mts`, `.js`, `.mjs`, or `.simulang` — TypeScript is stripped natively by Node, no build step. The `.simulang` suffix is supported for clarity in workflows that mix shell scripts with simulang scripts, but `.ts` / `.mts` are recommended since editors and `tsc` recognize them out of the box. Example:

```js
import { App, FocusPolicy, Visibility } from '@simular-ai/simulang-js'

App.defaultBrowser().open('https://example.com', FocusPolicy.Steal, Visibility.Show, true)
```

In the REPL, every `simulang-js` export (`App`, `Key`, `FocusPolicy`, …) is pre-loaded as a global, and the full namespace is also available as `simulang`.

### Using with Claude Code

Run once to install a Claude Code skill that teaches Claude how to use `simulang`:

```bash
simulang init-claude              # user-level, into ~/.claude/skills/simulang/
simulang init-claude --project    # project-local, into <cwd>/.claude/skills/simulang/
simulang init-claude --check      # report whether the installed skill is up to date
```

Safe to re-run.

### Picking a `simulang-js` version

The bundled copy is used by default. To override:

```bash
simulang run --simulang-js=0.2.1 <script>        # specific version (cached after first install)
simulang run --simulang-js=latest <script>       # latest from the registry
simulang run --simulang-js=/path/to/simulang-js <script>   # local checkout
```

You can also set `SIMULANG_JS` in the environment, or `npm install @simular-ai/simulang-js` next to your script for a per-project pin. If none of the above is set, the CLI's own bundled copy is used.

Use `simulang which` to see which copy a script resolves to.

## Authentication

Scripts that hit hosted services need an OpenRouter API key. Set `OPENROUTER_API_KEY` in your environment before running a script:

```bash
export OPENROUTER_API_KEY=...
simulang run <script>
```

`simulang run` prints a warning to stderr when `OPENROUTER_API_KEY` is unset, but does not refuse to run — scripts that don't hit hosted services work without it.

## Development

```bash
git clone https://github.com/simular-ai/simulang-cli
cd simulang-cli
npm install
npm run build          # tsc → dist/
npm link               # exposes `simulang` on PATH
simulang run examples/hello.ts
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run format`.

To test against a local `simulang-js` checkout:

```bash
simulang run --simulang-js=/path/to/simulang-js examples/hello.ts
```

## License

MIT — see [LICENSE](./LICENSE).
