# Multi-Step Click Using Vision

![Category](https://img.shields.io/badge/category-navigation-blue)
![Difficulty](https://img.shields.io/badge/difficulty-beginner-green)
![Tags](https://img.shields.io/badge/tags-vision%20%7C%20grounding%20%7C%20multi--step%20%7C%20back--navigation-lightgrey)

Open simular.ai in the default browser and iteratively click each top-nav link — "About", "Product", "Research" — using visual grounding to locate them on screen, then send the OS-appropriate browser-back shortcut to return home before the next iteration.

## Context

|                    |                                           |
| ------------------ | ----------------------------------------- |
| **URL**            | https://simular.ai                        |
| **App**            | simular.ai (web, no auth)                 |
| **Browser state**  | Fresh                                     |
| **Prerequisites**  | None beyond a working default browser     |
| **Fixtures**       | Nav links: `About`, `Product`, `Research` |
| **Reversible**     | Yes                                       |
| **Requires human** | No                                        |

## How it works

1. Open `https://simular.ai` with focus and steal; wait ~3 seconds for the page to render.
2. Pick the OS-appropriate back-modifier once at startup: `Key.Meta` on macOS, otherwise `Key.Alt`.
3. Send a precautionary `Button.Left` `Direction.Release` to clear any stuck mouse-button state from a prior crashed run.
4. For each label in `["About", "Product", "Research"]`:
   1. Take a full screenshot of the main screen.
   2. Use `GroundingModel.default()` to locate `"<label>" navigation link` on the screenshot.
   3. Move the mouse to the returned absolute pixel coordinates and left-click.
   4. Wait ~2 seconds for the destination page to load.
   5. Press the back shortcut (modifier + `Key.LeftArrow`).
   6. Wait ~2 seconds for simular.ai to reload.
5. Log completion.

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

The console logs each click coordinate and "Navigated back" after each iteration, finishing with `Done — all nav links visited.` Visually, the browser cycles through About → home → Product → home → Research → home.

## Why visual grounding instead of the AX tree

The simular.ai nav bar renders links in a way that may not expose predictable `AriaRole.Link` nodes with stable names across deployments. Visual grounding via `screenshot.ground(GroundingModel.default(), ...)` is more resilient to markup changes and works regardless of accessibility-tree structure.

## Potential Pitfalls

- Nav link not visible in the viewport because the page is not fully loaded.
- Grounding model misidentifies a visually similar element.
- Browser back lands on a cached or blank page instead of simular.ai.
- OS or browser ignores the back shortcut if focus shifted to a non-browser window between steps.

## Related Examples

- `basic-login`
