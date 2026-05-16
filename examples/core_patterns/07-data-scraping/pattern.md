# Data Extraction (Scrape)

![Category](https://img.shields.io/badge/category-data--extraction-blue)
![Difficulty](https://img.shields.io/badge/difficulty-beginner-green)
![Tags](https://img.shields.io/badge/tags-ax--tree%20%7C%20ask%20%7C%20json%20%7C%20scraping-lightgrey)

Open a public website, capture its accessibility-tree text snapshot, and ask the LLM to extract structured data — in this case, every social-media link on the page — returned as JSON.

## Context

|                    |                                                              |
| ------------------ | ------------------------------------------------------------ |
| **URL**            | https://simular.ai                                           |
| **App**            | Simular — landing page (web, no auth)                        |
| **Browser state**  | Fresh page; no login required                                |
| **Prerequisites**  | macOS Accessibility permission granted for the browser; `OPENROUTER_API_KEY` set |
| **Inputs**         | None — site URL is hard-coded                                |
| **Reversible**     | Yes (read-only)                                              |
| **Requires human** | No                                                           |

## How it works

1. Open `https://simular.ai` in the default browser.
2. Call `instance.enableAccessibility()` so Chrome exposes the AX tree, then wait ~2 seconds for the page to render.
3. Render the entire accessibility tree as a Playwright-style indented text string via `AccessibilityNode.fromPid(instance.pid).snapshot()` — this captures all visible text and link names.
4. Send the snapshot text to `AskModel.default().ask(...)` with a prompt asking for "all social media links" as a JSON array of `{platform, url}` objects.
5. Parse the response with `JSON.parse` and pretty-print each `platform: url` pair. Falls back to printing the raw response if the model didn't return valid JSON.

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

A list like:

```
Social media links found on simular.ai:

  Twitter: https://twitter.com/...
  LinkedIn: https://www.linkedin.com/company/...
  YouTube: https://www.youtube.com/...
```

## Potential Pitfalls

- AX tree is empty — `enableAccessibility()` was skipped, or the wait was too short for a slow-loading page.
- Model wraps the JSON in code fences or prose — the script handles this via try/catch and prints the raw response.
- Page has lazy-loaded links below the fold; AX snapshots only capture rendered content. Scroll first if needed.
- `OPENROUTER_API_KEY` not set — `ask()` throws on first call.
- Site layout changes (e.g. icons replaced with images without accessible names) — the AX text loses the link semantics.

## Related Examples

- `09-multi-tab-workflow`
- `06-form-fill-dynamic`
