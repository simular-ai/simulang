# Shell Integration (ASCII Art Hello)

![Category](https://img.shields.io/badge/category-shell-blue)
![Difficulty](https://img.shields.io/badge/difficulty-beginner-green)
![Tags](https://img.shields.io/badge/tags-execSync%20%7C%20cross--platform%20%7C%20heredoc%20%7C%20powershell-lightgrey)

Shell out from a simulang script to print a small ASCII-art cat — works on macOS, Linux, and Windows by branching between a `/bin/sh` heredoc and a PowerShell here-string.

## Context

|                    |                                              |
| ------------------ | -------------------------------------------- |
| **URL**            | n/a (no browser involved)                    |
| **App**            | Local shell (`/bin/sh` on Unix, PowerShell on Windows) |
| **Prerequisites**  | None — Node ≥ 22.18 only                     |
| **Inputs**         | None — ASCII art is hard-coded               |
| **Reversible**     | Yes (writes nothing)                         |
| **Requires human** | No                                           |

## How it works

1. Determine the platform with `os.platform() === 'win32'`.
2. Build a single command string:
   - **Unix**: `cat <<'EOF'…EOF` — single-quoted heredoc so no shell interpolation runs on the art.
   - **Windows**: `powershell -NoProfile -Command "Write-Output @'…'@"` — PowerShell single-quoted here-string with the same property.
3. Run it with `execSync`, passing `shell: '/bin/sh'` on Unix (Windows uses Node's default `cmd.exe` to launch PowerShell).
4. `console.log` the trimmed stdout.

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

```
   /\_/\
  ( o.o )   < hello from simulang!
   > ^ <
```

## Potential Pitfalls

- ASCII art contains a `'` — would close a heredoc/here-string prematurely. Stick to characters that survive single-quoted contexts.
- Windows users run from a stripped-down shell where `powershell` isn't on `PATH` — fall back to `pwsh` (PowerShell 7) or write the art directly with `Write-Host` via `cmd.exe`.
- `execSync` has a default `maxBuffer` (~1 MB) — fine for ASCII art, watch out for larger payloads.
- This pattern shows shell-out as a primitive; for richer parsing, capture `stdout` and `JSON.parse` it (see commits in earlier revisions of this script for a `find | sort` example).