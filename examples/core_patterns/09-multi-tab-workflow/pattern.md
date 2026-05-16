# Multi-Tab Workflow (Parallel LLM Summaries)

![Category](https://img.shields.io/badge/category-orchestration-blue)
![Difficulty](https://img.shields.io/badge/difficulty-advanced-red)
![Tags](https://img.shields.io/badge/tags-multi--tab%20%7C%20ax--tree%20%7C%20ask%20%7C%20worker--threads%20%7C%20parallel-lightgrey)

Open three URLs in browser tabs, snapshot each page's accessibility tree, then fan the LLM `ask()` calls out to Node `worker_threads` so the three summaries run in parallel — total wall time becomes `max(latencies)` instead of `sum(latencies)`.

## Context

|                    |                                                              |
| ------------------ | ------------------------------------------------------------ |
| **URLs**           | https://www.simular.ai/about, https://www.sai.work/, https://www.simular.ai/research |
| **App**            | Default browser (web, no auth)                               |
| **Browser state**  | Three tabs opened back-to-back                               |
| **Prerequisites**  | macOS Accessibility permission granted for the browser; `OPENROUTER_API_KEY` set; Node ≥ 22.18 |
| **Inputs**         | None — pages are hard-coded                                  |
| **Reversible**     | Yes (read-only)                                              |
| **Requires human** | No                                                           |

## How it works

1. The script is its own Node worker entry point. When `!isMainThread`, the file reads `{ prompt, text }` from `workerData`, calls `AskModel.default().ask(prompt, text)`, posts the result back via `parentPort`, and exits.
2. **Main thread**:
   1. Open all three URLs back-to-back via `browser.open(...)` with `waitForLoadComplete: false`. The first tab uses `FocusPolicy.Steal`; the other two use `FocusPolicy.DoNotSteal` so they load in background tabs.
   2. Wait ~4 seconds — all three pages load **in parallel** during this single sleep.
   3. For each instance: focus it briefly, then snapshot the page text via `AccessibilityNode.fromPid(instance.pid).snapshot()`. Snapshots are cheap and stay on the main thread.
   4. Spawn three `Worker(SELF, { workerData })` — one per page — and `Promise.all` over their `'message'` events. Because each worker is its own V8 isolate, the three blocking `ask()` calls run concurrently.
   5. Print elapsed time and each `[label] summary`.

> See [`script.js`](./script.js) for the runnable implementation.

## Why workers (and not just Promise.all)

`AskModel.ask` is a **synchronous napi-rs binding** — it blocks the JS event loop until the HTTP response returns. Wrapping three `.ask()` calls in `Promise.all` on the main thread runs them serially. Each `Worker` has its own event loop, so the three network round-trips overlap.

## Expected Result

Roughly:

```
All 3 summaries returned in 3.2s

[simular.ai/about] Simular is an AI-research company building neuro-symbolic agents that combine LLM flexibility with symbolic precision...
[sai.work] Sai is an always-on agentic AI coworker that performs GUI tasks across apps and websites with approval-based control...
[simular.ai/research] Simular publishes the Agent S family — open-source computer-use agents that reach near-human performance on OSWorld...
```

The wall-clock time should be close to the slowest single `ask` call, not the sum.

## Potential Pitfalls

- The browser blocks/throttles background tabs — increase the post-open wait or focus each tab briefly before snapshotting.
- Worker startup cost (~100–300 ms per worker to load the napi module + provider config) — meaningful only when individual asks are very fast; LLM round-trips dwarf it.
- Each worker re-reads `OPENROUTER_API_KEY` from env; missing key fails three times in parallel.
- The script imports simulang-js at the top so workers do too — this is what `simulang run` enables for any spawned worker as long as the resolved simulang-js install is on the worker's module path (it is, because workers inherit the parent's module resolution).
- `process.exit(0)` in the worker is intentional — it keeps the worker from idling on dangling timers/keep-alives.

## Related Examples

- `07-data-scraping`
