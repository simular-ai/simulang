# Form Fill Dynamic

![Category](https://img.shields.io/badge/category-form--filling-blue)
![Difficulty](https://img.shields.io/badge/difficulty-intermediate-yellow)
![Tags](https://img.shields.io/badge/tags-vision%20%7C%20ask%20%7C%20grounding%20%7C%20popups%20%7C%20datetime-lightgrey)

Compute a target booking time, dismiss any blocking popups via vision-grounded clicks, then fill a multi-field reservation form (search, guests, time) on a dynamic restaurant booking site.

## Context

|                    |                                                                |
| ------------------ | -------------------------------------------------------------- |
| **URL**            | https://www.chope.co/singapore-restaurants                     |
| **App**            | Chope — Singapore Restaurants (web, no auth)                   |
| **Browser state**  | Fresh page; cookie banners and signup popups may appear        |
| **Prerequisites**  | macOS Screen Recording + Accessibility permissions; `OPENROUTER_API_KEY` set |
| **Inputs**         | `SEARCH_TEXT = "Capitol Theatre"`, target time = now + 1h rounded to 15 min |
| **Reversible**     | Yes (no booking is submitted past the search step)             |
| **Requires human** | No                                                             |

## How it works

1. Compute the target booking time: `now + 1 hour`, rounded to the nearest 15 minutes, formatted as Chope's `"7:00 pm"` style.
2. Open the URL in the default browser; wait ~3 seconds for the page to render.
3. **Popup-dismissal loop** — repeatedly take a 1080p screenshot, ask the LLM `"Is there a popup, modal, or overlay blocking the page? yes/no"`, and if "yes", vision-click the close button. Break when the answer is "no".
4. Vision-click the food/restaurant search field, then type the search text via `KeyboardController.text`.
5. Vision-click the **Guests** field, then the **+** button to increment Adults.
6. Vision-click the **Time** field, then the dropdown option matching the computed time label.
7. Vision-click the **Let's Go** submit button and wait ~2 seconds.

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

The browser lands on the search-results page for "Capitol Theatre" with the chosen guest count and time pre-applied — no popups remaining on screen.

## Potential Pitfalls

- LLM answers ambiguously (e.g. `"Yes, but..."`) — the script uses `/yes/i` so any "yes" substring triggers another close attempt.
- Grounding model misses a control because the concept string is too generic — refine the natural-language description of the target.
- The dropdown time option is not visible — increase the post-click wait or scroll the dropdown into view first.
- Site layout changes break the visual concepts; popup loop may also fail to converge if the close button is off-screen — bound it with a max-attempts counter as in `08-popup-modal-handling`.
- `OPENROUTER_API_KEY` not set — `ask()` throws on first call.

## Related Examples

- `08-popup-modal-handling`
- `03-multi-step-click-using-vision`
- `01-basic-login`
