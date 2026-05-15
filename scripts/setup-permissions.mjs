// Bundled "first-run setup" script for `simulang setup`.
//
// Run via the same `node --import loader.js <script>` pipeline that real user
// scripts go through, so the *exact same Node binary* (and therefore the same
// macOS responsible-process attribution) requests each permission. That way
// the entry macOS adds to its TCC panes is the one that will be checked when
// real scripts run.
//
// On macOS each permission has a designated trigger:
//   - Screen Recording  → /usr/sbin/screencapture (see note below)
//   - Accessibility     → `AccessibilityTree.fromForeground()`
//   - Input Monitoring  → `KeyboardController.key(Key.Shift, Press)` then `Release`
// The first call from a fresh executable prompts the user; subsequent calls
// from a denied executable fail silently (or with a permission error). Either
// way the executable is now in the System Settings list ready to be toggled.
//
// Why shell out for Screen Recording: simulang-js's `screenshotFull` preflights
// `CGPreflightScreenCaptureAccess()` and returns an error before macOS ever
// sees a capture attempt — so the system never prompts and the host never gets
// added to the Screen Recording pane. The system `screencapture(1)` tool, in
// contrast, *does* attempt the capture, which surfaces the standard TCC dialog
// and registers the responsible parent app (Terminal / iTerm / Cursor / …) in
// the Screen Recording list. Spawned from this same Node process so the
// attribution is identical to what real `simulang run` invocations get.
//
// On non-macOS this script is a no-op success — the simulang CLI never spawns
// it on Windows / Linux.

import { spawnSync } from 'node:child_process'
import { unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AccessibilityTree,
  Direction,
  hasScreenCapturePermission,
  Key,
  KeyboardController,
} from '@simular-ai/simulang-js'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'

function line(s = '') {
  process.stdout.write(s + '\n')
}

function header(s) {
  line('')
  line(BOLD + s + RESET)
}

function ok(label, detail = '') {
  line(`  ${GREEN}✓${RESET} ${label}${detail ? ' ' + DIM + detail + RESET : ''}`)
}

function warn(label, detail = '') {
  line(`  ${YELLOW}!${RESET} ${label}${detail ? ' ' + DIM + detail + RESET : ''}`)
}

function fail(label, detail = '') {
  line(`  ${RED}✗${RESET} ${label}${detail ? ' ' + DIM + detail + RESET : ''}`)
}

// Each step returns true on success, false on failure. We do NOT throw —
// failure here is the *expected* path the very first time, and is exactly
// what surfaces the system prompt and adds the binary to System Settings.
function tryStep(name, fn) {
  try {
    fn()
    return true
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    fail(name, message)
    return false
  }
}

function setupScreenRecording() {
  header('1/3  Screen Recording')
  line(DIM + '       Needed for Screen.screenshot() and vision-grounded actions.' + RESET)
  if (hasScreenCapturePermission()) {
    ok('Already granted')
    return true
  }
  // simulang-js short-circuits on the preflight, so it never triggers the
  // dialog. Use the system `screencapture` tool: it actually attempts the
  // capture, which makes macOS surface the TCC prompt and add the responsible
  // parent app to the Screen Recording pane. Discard the output file; we
  // only want the side effect.
  const probe = join(tmpdir(), 'simulang-screen-probe.png')
  // -x: silent (no shutter sound). spawnSync doesn't throw on non-zero exit,
  // which is the expected path the first time (capture fails → prompt fires).
  spawnSync('/usr/sbin/screencapture', ['-x', probe], { stdio: 'ignore' })
  try {
    unlinkSync(probe)
  } catch {
    // The file may not exist if the capture was denied — that's fine.
  }
  if (hasScreenCapturePermission()) {
    ok('Granted just now')
    return true
  }
  warn('Pending', 'click Open System Settings in the prompt, toggle the entry on, then re-run `simulang setup`')
  return false
}

function setupAccessibility() {
  header('2/3  Accessibility')
  line(DIM + '       Needed for the AX tree, AX actions, and window control.' + RESET)
  // Any AX call from a fresh binary triggers the macOS prompt and adds the
  // binary to the Accessibility list. fromForeground() is cheap and works
  // as long as *some* app is in the foreground (always true in a terminal
  // session — the terminal itself or its parent IDE counts).
  const triggered = tryStep('Triggering Accessibility prompt', () => {
    AccessibilityTree.fromForeground()
  })
  if (triggered) {
    ok('Granted (or no prompt needed)')
    return true
  }
  warn('Pending', 'click Open System Settings in the prompt, toggle the entry on, then re-run `simulang setup`')
  return false
}

function setupInputMonitoring() {
  header('3/3  Input Monitoring')
  line(DIM + '       Needed for synthesized mouse/keyboard events to reach the foreground app.' + RESET)
  // Posting any synthetic input event triggers Input Monitoring on macOS.
  // We use Shift press+release: visible only as the modifier briefly toggling,
  // no characters typed, no window focus changes.
  const kb = new KeyboardController()
  const triggered = tryStep('Triggering Input Monitoring prompt', () => {
    kb.key(Key.Shift, Direction.Press)
    kb.key(Key.Shift, Direction.Release)
  })
  if (triggered) {
    ok('Granted (or no prompt needed)')
    return true
  }
  warn('Pending', 'click Open System Settings in the prompt, toggle the entry on, then re-run `simulang setup`')
  return false
}

if (process.platform !== 'darwin') {
  line('simulang setup: nothing to do on this platform.')
  process.exit(0)
}

line(
  BOLD +
    'simulang setup' +
    RESET +
    '  ' +
    DIM +
    '— requesting macOS permissions for the host that will run your scripts' +
    RESET,
)
line('')
line(DIM + 'macOS will prompt for each permission the first time. After granting,' + RESET)
line(DIM + 'each subsequent run is silent. Re-run this command anytime to verify.' + RESET)

const screen = setupScreenRecording()
const accessibility = setupAccessibility()
const input = setupInputMonitoring()

line('')
const allGranted = screen && accessibility && input
if (allGranted) {
  line(GREEN + 'All permissions look good. You can now run real scripts.' + RESET)
  process.exit(0)
} else {
  line(YELLOW + 'Some permissions are still pending — see above.' + RESET)
  line(DIM + 'Toggle each pending entry on in System Settings, then re-run `simulang setup` to confirm.' + RESET)
  process.exit(1)
}
