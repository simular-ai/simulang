# Popup / Modal Handling

![Category](https://img.shields.io/badge/category-overlay--handling-blue)
![Difficulty](https://img.shields.io/badge/difficulty-beginner-green)
![Tags](https://img.shields.io/badge/tags-vision%20%7C%20ask%20%7C%20grounding%20%7C%20popups%20%7C%20cookies-lightgrey)

Visit a heavily-overlaid site (Uber Eats) and dismiss every popup, modal, cookie banner, sign-in prompt, and bottom drawer using a vision detect-and-click loop until the page is clear.

## Context

|                    |                                                                |
| ------------------ | -------------------------------------------------------------- |
| **URL**            | https://www.ubereats.com/                                      |
| **App**            | Uber Eats — homepage (web, no auth)                            |
| **Browser state**  | Fresh page; expect Google sign-in prompt, cookie banner, and bottom drawer |
| **Prerequisites**  | macOS Screen Recording + Accessibility permissions; `OPENROUTER_API_KEY` set |
| **Inputs**         | None — `MAX_ATTEMPTS = 10` safety bound                        |
| **Reversible**     | Yes (no actions taken beyond closing overlays)                 |
| **Requires human** | No                                                             |

## How it works

1. Open the URL in the default browser; wait ~3 seconds for the initial render and overlays to appear.
2. **Popup detect-and-dismiss loop** (up to 10 iterations):
   - Take a full-screen screenshot, shrink to 1920×1080 to keep the LLM payload small.
   - Ask the model: "Is there any popup, modal, cookie banner, sign-in prompt, bottom drawer, or overlay blocking the main content? yes/no".
   - If the answer is "yes", vision-click a close/dismiss/decline button via `GroundingModel.default()`, wait ~1 second for the UI to settle, and loop again.
   - If "no", break and report success.
3. Print "Page is clear — all popups dismissed."

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

Every overlay is closed and the Uber Eats homepage is fully usable. The script prints the per-iteration check (`[check N] popup present: yes/no`) and the final cleared message.

## Potential Pitfalls

- Loop runs all 10 attempts because the grounding model keeps clicking the wrong region — refine the natural-language concept (be specific about "decline", "close", "no thanks").
- LLM treats the regular page navbar as a "popup" — tighten the prompt to mention "blocking" or "modal".
- Closing one overlay reveals another offscreen; the next screenshot still detects "yes" but no close button is visible — scroll first or accept that the loop will time out.
- Screenshot permission missing — `screenshotFull` throws; run `simulang setup`.
- `OPENROUTER_API_KEY` not set — `ask()` throws on first call.

## Related Examples

- `06-form-fill-dynamic`
- `03-multi-step-click-using-vision`
