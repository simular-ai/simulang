# File Upload (mock site, cross-platform)

![Category](https://img.shields.io/badge/category-file--operations-blue)
![Difficulty](https://img.shields.io/badge/difficulty-medium-yellow)
![Tags](https://img.shields.io/badge/tags-upload%20%7C%20file--picker%20%7C%20clipboard%20%7C%20cross--platform-lightgrey)

Drive a fully reproducible file-upload flow against a local mock website using a strategy that works on **macOS, Windows, and Linux** regardless of how the user has configured their Finder / Explorer / file manager.

## Context

|                    |                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL**            | http://localhost:8080                                                                                                                         |
| **App**            | File Upload Demo — local mock site (web, no auth)                                                                                             |
| **Browser state**  | Fresh                                                                                                                                         |
| **Prerequisites**  | Mock site running on port 8080; OS Accessibility permission granted; system-default file picker (no Path Finder / Default Folder X overrides) |
| **Fixtures**       | File: `simulang_upload_demo.txt`, written to the OS temp dir on each run                                                                      |
| **Reversible**     | Yes (no real upload — the mock site reads the file purely client-side)                                                                        |
| **Requires human** | No                                                                                                                                            |

## Setup

```bash
cd core_patterns/05-file-upload/mock-site && python3 -m http.server 8080
cd core_patterns/05-file-upload/mock-site && npx serve -l 8080

simulang run core_patterns/05-file-upload/script.js
```

## How it works

1. Write a fresh dummy `.txt` file to the OS temp directory (`/tmp/...` on macOS/Linux, `%TEMP%\...` on Windows).
2. Open `http://localhost:8080`, focus the window, enable accessibility; wait ~1.5 seconds.
3. Build an `AccessibilityTree` and locate the file-input button — try `"Choose File"`, then `"Choose file"`, falling back to the first `AriaRole.Button` if needed.
4. `tree.activate(...)` the button to open the OS-native file picker; wait ~1.2 seconds.
5. Branch on `process.platform` to bypass the picker's UI state and open a path-entry field:
   - **macOS** → `Cmd+Shift+G` opens the "Go to folder" sheet.
   - **Linux** (GTK file chooser) → `Ctrl+L` focuses the location entry.
   - **Windows** → no shortcut needed; the **File name** box is already focused and accepts absolute paths.
6. Call `Clipboard.pasteText(FILE_PATH)`; wait ~1 second.
7. Press **Enter**. On macOS, send a second **Enter** because the "Go to folder" sheet needs one Enter to load the path and another to confirm the selection.

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

The browser displays a green **"Upload complete"** banner showing the file name, byte count (~81 bytes; varies because the file embeds a fresh ISO timestamp), and MIME type `text/plain`.

The mock site reads the file purely client-side via the `change` event on `<input type="file">` — **nothing is uploaded over the network**, so this demo is safe to run repeatedly with no side effects.

## Why this approach is platform-and-setting-agnostic

The classic failure mode of automated file pickers is that **every user has a different last-used folder, view mode, sort order, and sidebar configuration**. Driving the picker by clicks would require visual grounding for every step and break under any of those changes.

The shortcuts used here (`Cmd+Shift+G` on macOS, `Ctrl+L` on Linux) open a dedicated **path entry field** that is independent of the picker's current state. On Windows, the standard Common Item Dialog auto-focuses the File name box, which itself accepts absolute paths. So in all three cases, pasting the path and pressing Enter works regardless of how the picker was previously left.

## Why a mock site instead of a public test page

- **No flakiness.** Public test sites change layouts, throttle, or disappear.
- **No data privacy concerns.** Even a dummy file leaks the script's filesystem path, hostname, and timing.
- **Deterministic AX tree.** The `<input type="file">` is wrapped in a `<label>` so the browser populates a clean accessible name.
- **Self-defined success state.** The success banner shows immediately on file selection — no real backend, no upload progress, no flaky retry logic.

## Potential Pitfalls

- Port 8080 already in use — change the server port and `UPLOAD_URL` in `script.js`.
- OS file picker takes longer than 1.2 s to appear — increase the post-activate sleep.
- Custom file picker (Path Finder, Default Folder X, etc.) — disable for the demo; the script targets the system default.
- Browser missing Accessibility permission — `tree.activate()` will silently no-op.
- Non-English locale — the file-input button name may differ (e.g. "Choisir un fichier"); update the `find()` calls accordingly.

## Related Examples

- `basic-login`
- `file-download`
