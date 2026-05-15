---
name: simulang
description: |
  Use when working with simulang scripts (typically .ts or .mts), the simulang
  CLI, or @simular-ai/simulang-js (Node bindings for the simulang-rs desktop
  automation crate). Covers how to write, run, and debug scripts, how to look
  up the simulang-js API, and the per-script version-pin model.
---

# simulang

`simulang` is the CLI that runs TypeScript or JavaScript scripts against the
`@simular-ai/simulang-js` desktop-automation library. It bundles its own copy
of simulang-js but lets each script pin a specific version.

## When to use this skill

- The user is editing or running a file with extension `.ts`, `.mts`, `.js`,
  `.mjs`, or `.simulang` that imports `@simular-ai/simulang-js`.
- The user mentions `simulang` (the CLI) or `simulang-js`, or
  desktop automation tasks (mouse, keyboard, screenshots, app launching,
  accessibility trees).
- The user wants to write a new script for desktop automation.

## First-time setup / troubleshooting permissions

Run `simulang setup` once after installing (and again any time screenshots,
accessibility, or mouse control stop working). It grants the macOS permissions
— Screen Recording, Accessibility, and Input Monitoring — that simulang-js
needs.

## Running a script

```
simulang run <script>                        # run once
simulang run --interactive                   # Node REPL with simulang pre-loaded (alias: -i)
simulang run --simulang-js=0.2.1 <script>        # pin to a specific simulang-js version
simulang run --simulang-js=latest <script>       # latest from the registry
simulang run --simulang-js=/abs/path <script>    # local checkout
simulang which <script>                      # show which simulang-js the script will resolve
simulang --version                           # CLI version + bundled simulang-js version
```

Scripts can be `.ts`, `.mts`, `.js`, `.mjs`, or `.simulang`. TypeScript is
stripped natively by Node (requires Node >= 22.18) — no build step. Prefer
`.ts` / `.mts` so editors and `tsc` recognize the file without extra
configuration; `.simulang` is supported but loses out-of-the-box tooling.

The REPL pre-loads every simulang-js export onto `globalThis`, so `App`,
`FocusPolicy`, `MouseController`, etc. are available without an import. The
full module namespace is also available as `simulang`.

## Inspecting the simulang-js API for a given script

`simulang-js` ships its own API knowledge document in the package tarball.
Always look up the version actually in use, not whatever you remember:

```
simulang which <script>
```

This prints `source`, `path`, and `version`. From the printed `path`:

- `<path>/index.d.ts` — the full typed API surface (~1500 lines).
- `<path>/CLAUDE.md` — idioms, lifecycle rules, platform quirks. Read this
  before recommending an API; it covers the things `.d.ts` cannot express.

For the REPL or scripts without an explicit path, run
`simulang which` against any script in the project (or use `simulang --version`
to find the bundled copy's version and locate it via `npm root -g`).

## Authoring scripts

ES modules, top-level await, dynamic imports — all supported. Import simulang-js
by its bare specifier:

```js
import { App, FocusPolicy, Visibility } from '@simular-ai/simulang-js'

App.defaultBrowser().open('https://example.com', FocusPolicy.Steal, Visibility.Show, true)
```

TypeScript example with type annotations:

```ts
import { App, FocusPolicy, Visibility, type Instance } from '@simular-ai/simulang-js'

const instance: Instance = App.defaultBrowser().open(
  'https://example.com',
  FocusPolicy.DoNotSteal,
  Visibility.Show,
  true,
)
console.log('opened pid:', instance.pid)
```

## Verifying changes

`tsc --noEmit` reliably catches type mismatches — `index.d.ts` is generated
from the Rust source, so signatures are accurate. What types can't express
only surfaces at runtime: lifecycle preconditions (e.g.
`LoopbackSource.record()` requires `start()` first; accessibility `refId`
values invalidate on every tree rebuild), permission failures (screen
recording / accessibility on macOS), and resource / environment failures
(missing audio device, network unreachable for grounding/STT models).

After editing a script, run it:

```
simulang run <script>
```

For interactive exploration, use `simulang run -i` and try snippets at the
REPL prompt before committing to a script.

## Live log visibility (interactive runs only)

For automation where the terminal is hidden behind the app being driven,
`@simular-ai/simulang-log-viewer` opens a floating, always-on-top window
that tails log records in real time. It's a **separate, optional companion
package** — install it alongside simulang-js (`npm install @simular-ai/simulang-log-viewer`)
when the user is writing an interactive script and would benefit from live
visibility. The bridge between the two is `simulang-js`'s `initLogger`
callback fed into `LogWindow.log`. For behavior details (click-through
default, macOS screen-capture exclusion, grab hotkey, `LogWindow` API),
read either the log-viewer's own README at
`node_modules/@simular-ai/simulang-log-viewer/README.md`, or the shorter
Claude-optimized summary in simulang-js's `CLAUDE.md` (resolved from
`simulang which <script>`). Don't suggest it for headless / CI / unattended
runs (no human is watching, and it spawns a window subprocess for no
benefit).

## Version pinning

`simulang` chooses the simulang-js install in this order:

1. `--simulang-js=` flag on the command line (path / exact version / `latest`).
2. `SIMULANG_JS` environment variable (same shape).
3. A `node_modules/@simular-ai/simulang-js` next to the script (project-local).
4. The CLI's own bundled copy.

`simulang which <script>` resolves this order and reports the winner. If a
project pins a specific version in its `package.json` and installs locally,
that version takes precedence over the bundled one.

## Authentication

Scripts that hit hosted services need an OpenRouter API key. Set
`OPENROUTER_API_KEY` in the environment before running a script. `simulang run`
prints a warning to stderr when it is unset but still executes the script —
scripts that don't hit hosted services work without it.

## Common pitfalls

- **`App.open` focus/visibility are advisory** — Chromium/Electron apps and
  macOS Notes can ignore `FocusPolicy.DoNotSteal` and `Visibility.Hidden`.
- **Accessibility refs invalidate on every tree rebuild.** Don't stash a
  `refId` across `snapshot()` or `find()` calls; re-resolve as needed.
- **`AriaRole` is a numeric enum.** `AriaRole[role]` does _not_ reverse-map
  to a name — use the exported `ariaRoleToString(role)` helper instead.
- **`Directory.temp()` does not auto-clean.** Wrap usage in try/finally.

Always check `<path>/CLAUDE.md` (from `simulang which`) before assuming an API
shape — it is shipped in lockstep with `index.d.ts` for the exact version
the script resolves to.
