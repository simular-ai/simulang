import {
  App,
  FocusPolicy,
  Visibility,
  AccessibilityTree,
  TraversalOrder,
  AriaRole,
  Clipboard,
  KeyboardController,
  Key,
  Direction,
} from '@simular-ai/simulang-js'
import { writeFileSync } from 'node:fs'
import { tmpdir, platform } from 'node:os'
import { join } from 'node:path'

const UPLOAD_URL = 'http://localhost:8080'

// 1. Create a dummy text file in the OS temp dir.
const FILE_PATH = join(tmpdir(), 'simulang_upload_demo.txt')
writeFileSync(FILE_PATH, `Hello from simulang!\nGenerated at: ${new Date().toISOString()}\n`)
console.log(`Created dummy file at: ${FILE_PATH}`)

// 2. Open the mock site.
const instance = App.defaultBrowser().open(UPLOAD_URL, FocusPolicy.Steal, Visibility.Show, true)
instance.focus()
instance.enableAccessibility()
await new Promise((r) => setTimeout(r, 1500))

const tree = AccessibilityTree.fromPid(instance.pid)
const kb = new KeyboardController()
const clip = new Clipboard()

// 3. Find and activate the file input — opens the OS file picker.
//    Browsers expose <input type="file"> as a Button with a name like
//    "Choose File", "Choose file", or just "Browse…". Search loosely.
let fileBtn =
  tree.find(TraversalOrder.BreadthFirst, AriaRole.Button, 'Choose File', true, 1)[0] ??
  tree.find(TraversalOrder.BreadthFirst, AriaRole.Button, 'Choose file', true, 1)[0] ??
  tree.find(TraversalOrder.BreadthFirst, AriaRole.Button, null, true, 1)[0]

if (!fileBtn) {
  throw new Error('No file-input button found in the AX tree — is the page loaded?')
}
tree.activate(fileBtn.refId)
console.log('Opened OS file picker')

// 4. Wait for the file picker to actually appear.
await new Promise((r) => setTimeout(r, 1200))

// 5. Open the "Go to path" prompt — bypasses Finder/Explorer state.
//    macOS:   Cmd+Shift+G  →  "Go to folder" sheet
//    Windows: type the path directly into the File name box (it accepts absolute paths)
//    Linux:   GTK file chooser → Ctrl+L  →  location entry
const os = platform()
console.log(`Detected platform: ${os}`)

if (os === 'darwin') {
  // Cmd+Shift+G
  kb.key(Key.Meta, Direction.Press)
  kb.key(Key.Shift, Direction.Press)
  kb.key(Key.G, Direction.Click)
  kb.key(Key.Shift, Direction.Release)
  kb.key(Key.Meta, Direction.Release)
  await new Promise((r) => setTimeout(r, 500))
} else if (os === 'linux') {
  // Ctrl+L (GTK / GNOME file chooser)
  kb.key(Key.Control, Direction.Press)
  kb.key(Key.L, Direction.Click)
  kb.key(Key.Control, Direction.Release)
  await new Promise((r) => setTimeout(r, 500))
}
// Windows: no special shortcut — the File name field is already focused and
// accepts an absolute path directly. If you're on a non-English Windows or a
// custom file dialog and this fails, uncomment the next line to focus the
// File name box explicitly:
//   kb.key(Key.F4, Direction.Click)  // Alt+F4 closes; for "File name" focus, try Alt+N

// 6. Paste the file path and confirm.
clip.pasteText(FILE_PATH)
await new Promise((r) => setTimeout(r, 1000))
kb.key(Key.Return, Direction.Click)
await new Promise((r) => setTimeout(r, 1000))

// On macOS, the "Go to folder" sheet needs a second Enter to actually select
// the file (first Enter loads the path, second confirms the selection).
if (os === 'darwin') {
  kb.key(Key.Return, Direction.Click)
}

console.log('Submitted file path')
await new Promise((r) => setTimeout(r, 1500))

console.log('Done — check the browser for the green "Upload complete" banner showing the file name and size.')
