# File Download via Right-Click "Save Link As"

![Category](https://img.shields.io/badge/category-file--operations-blue)
![Difficulty](https://img.shields.io/badge/difficulty-beginner-green)
![Tags](https://img.shields.io/badge/tags-download%20%7C%20pdf%20%7C%20context--menu%20%7C%20vision-lightgrey)

Open a Google Scholar search, locate the first `[PDF] arxiv.org` link via visual grounding, right-click it, choose **Save Link As** from the context menu, and confirm the save dialog with Enter.

## Context

|                    |                                                                               |
| ------------------ | ----------------------------------------------------------------------------- |
| **URL**            | `https://scholar.google.com/scholar?...&q=Reliable+Computer+Use+Agents`       |
| **App**            | Google Scholar (web, no auth)                                                 |
| **Browser state**  | Fresh                                                                         |
| **Prerequisites**  | Default browser configured to show a save dialog (not auto-download)          |
| **Fixtures**       | Query: `Reliable Computer Use Agents`; target: first `[PDF] arxiv.org` result |
| **Reversible**     | Yes (delete the downloaded file)                                              |
| **Requires human** | No                                                                            |

## How it works

1. Open the Google Scholar search URL with focus; wait ~3 seconds for results.
2. Take a full screenshot and use `GroundingModel.default()` to locate the first `[PDF] arxiv.org` link.
3. Move the mouse there and right-click (`Button.Right`); wait ~800 ms for the context menu.
4. Take a fresh screenshot and ground for the **Save Link As** menu item; left-click it.
5. Wait ~1.5 seconds for the save dialog, then press **Enter** to accept the default filename and location.

> See [`script.js`](./script.js) for the runnable implementation.

## Expected Result

The browser downloads a PDF (the first arxiv.org result for the query) to the default downloads folder. Console logs the click coordinates for both the PDF link and the menu item.

## Note on macOS save dialogs

On macOS, the save panel sometimes requires **two Returns** when the filename field has focus — one to commit the field edit, one to press the default **Save** button. The script ships with a single Enter (which works on Chrome's default save dialog as of writing). If the download silently fails, add a leading Enter + ~300 ms gap before the final Enter.

## Potential Pitfalls

- No `[PDF] arxiv.org` link visible because results changed or the page didn't load.
- Context menu item label differs by browser or OS locale.
- Save dialog does not appear because the browser is set to auto-download.
- Grounding picks the wrong PDF link if multiple are visible — refine the prompt to be more specific.

## Related Examples

- `multi-step-click-using-vision`
- `file-upload`
