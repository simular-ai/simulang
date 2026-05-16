import {
  App,
  FocusPolicy,
  Visibility,
  GroundingModel,
  AskModel,
  Screen,
  screenshotFull,
  MouseController,
  Coordinate,
  Button,
  Direction,
} from '@simular-ai/simulang-js'

const TARGET_URL = 'https://www.ubereats.com/'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function click(mouse, x, y) {
  mouse.moveMouse(x, y, Coordinate.Abs)
  mouse.button(Button.Left, Direction.Click)
}

async function visionClick(mouse, concept, label) {
  const shot = screenshotFull(true, Screen.mainScreen())
  const [x, y] = shot.ground(GroundingModel.default(), concept)
  click(mouse, x, y)
  console.log(`[vision] ${label ?? concept} → (${x}, ${y})`)
  await new Promise(r => setTimeout(r, 500))
}

// ─── Open browser ─────────────────────────────────────────────────────────────

const instance = App.defaultBrowser().open(TARGET_URL, FocusPolicy.Steal, Visibility.Show, true)
instance.focus()
await new Promise(r => setTimeout(r, 3000))

const mouse = new MouseController()
const askModel = AskModel.default()

// ─── Dismiss all popups via vision loop ──────────────────────────────────────
// Keep checking until the LLM confirms no blocking UI remains.
// Handles Google sign-in prompts, cookie banners, bottom drawers, etc.

let attempts = 0
const MAX_ATTEMPTS = 10

while (attempts < MAX_ATTEMPTS) {
  const shot = screenshotFull(true, Screen.mainScreen())
  shot.shrink(1920, 1080)
  const answer = askModel.ask(
    'Look at this screenshot of a web browser. ' +
    'Is there any popup, modal dialog, cookie consent banner, sign-in prompt, ' +
    'bottom drawer, or overlay that is blocking or interrupting the main page content? ' +
    'Reply with only "yes" or "no".',
    null,
    [shot],
  )
  console.log(`[check ${attempts + 1}] popup present: ${answer.trim()}`)
  if (!/yes/i.test(answer)) break

  await visionClick(
    mouse,
    'close, dismiss, decline, or "no thanks" button on the popup, modal, cookie banner, or sign-in overlay',
    'popup dismiss button',
  )
  await new Promise(r => setTimeout(r, 1000))
  attempts++
}

console.log('Page is clear — all popups dismissed.')
