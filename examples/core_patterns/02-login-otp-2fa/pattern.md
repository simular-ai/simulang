# TOTP Code Entry (oathtool + mock site)

![Category](https://img.shields.io/badge/category-authentication-blue)
![Difficulty](https://img.shields.io/badge/difficulty-medium-yellow)
![Tags](https://img.shields.io/badge/tags-2fa%20%7C%20otp%20%7C%20totp%20%7C%20oathtool%20%7C%20clipboard-lightgrey)

Generate a current TOTP one-time code via `oathtool`, paste it into a local mock site through the system clipboard, and submit — no terminal-window automation required.

## Context

|                    |                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **URL**            | http://localhost:8080                                                                                                      |
| **App**            | TOTP Demo — local mock site (web, no auth)                                                                                 |
| **Browser state**  | Fresh                                                                                                                      |
| **Prerequisites**  | `oathtool` installed (`brew install oath-toolkit`); mock site running on port 8080; macOS Accessibility permission granted |
| **Fixtures**       | `TOTP_SECRET=JBSWY3DPEHPK3PXP` (env var, with default fallback)                                                            |
| **Reversible**     | No                                                                                                                         |
| **Requires human** | No                                                                                                                         |

## Setup

```bash
brew install oath-toolkit

cd core_patterns/02-login-otp-2fa/mock-site && python3 -m http.server 8080
cd core_patterns/02-login-otp-2fa/mock-site && npx serve -l 8080

simulang run core_patterns/02-login-otp-2fa/script.js
```

The mock site lives in `mock-site/index.html` — a self-contained single HTML file that validates the TOTP entirely in-browser via the Web Crypto API and accepts ±1 step (30 s) of clock skew. The OTP `<input>` is wrapped in a `<label>` so Chrome populates the input's AX node name with the label text, which is what `tree.find()` matches.

## How it works

1. Shell out to `oathtool --totp --base32 <secret>` via `execSync` to get the current 6-digit code.
2. Open `http://localhost:8080` in the default browser, focus it, and enable accessibility; wait ~1.5 seconds.
3. Build an `AccessibilityTree` from the browser PID and locate the **One-Time Password** field (`AriaRole.Textbox`).
4. Focus the field and call `Clipboard.pasteText(code)` to fill it.
5. Press **Enter** to submit; wait ~1 second for the success banner.

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

The mock site shows a green success banner confirming the code was accepted.

## Why `Clipboard.pasteText()` instead of `kb.text()`

`kb.text()` types characters one-by-one through the keyboard event pipeline. `Clipboard.pasteText()` sets the system clipboard to the value and fires Cmd+V — it is more reliable for numeric-only inputs that may have `inputmode="numeric"` or other restrictions, and sidesteps any keyboard-layout mapping for digits.

## Potential Pitfalls

- `oathtool` not found — install with `brew install oath-toolkit`.
- Port 8080 already in use — change the port in setup and `LOGIN_URL` in `script.js`.
- OTP expires between generation and paste (script runs close to a 30-second boundary).
- Browser missing Accessibility permission — `tree.find()` returns no results.
- OTP field's accessible name differs by browser — script searches for `AriaRole.Textbox` named "One-Time Password"; update if needed.

## Related Examples

- `basic-login`
