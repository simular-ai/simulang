import {
  App,
  FocusPolicy,
  Visibility,
  GroundingModel,
  AskModel,
  Screen,
  screenshotFull,
  MouseController,
  KeyboardController,
  Coordinate,
  Button,
  Direction,
} from '@simular-ai/simulang-js'

const SITE_URL = 'https://www.chope.co/singapore-restaurants'
const SEARCH_TEXT = 'Capitol Theatre'

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/** Round a Date to the nearest N minutes. */
function roundToNearest(date, minutes) {
  const ms = minutes * 60 * 1000
  return new Date(Math.round(date.getTime() / ms) * ms)
}

/** Format a Date as the Chope time string, e.g. "7:00 pm" or "11:15 am". */
function formatChopeTime(date) {
  let h = date.getHours()
  const m = date.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  const mm = String(m).padStart(2, '0')
  return `${h}:${mm} ${ampm}`
}

// ─── Time computation ────────────────────────────────────────────────────────

const now = new Date()
const targetTime = roundToNearest(new Date(now.getTime() + 1 * 60 * 60 * 1000), 15)
const chopeTimeLabel = formatChopeTime(targetTime)
console.log(`Current time: ${now.toLocaleTimeString()}`)
console.log(`Target booking time (1 hrs, rounded to 15 min): ${chopeTimeLabel}`)

// ─── Open browser ────────────────────────────────────────────────────────────

const instance = App.defaultBrowser().open(SITE_URL, FocusPolicy.Steal, Visibility.Show, true)
instance.focus()
await new Promise(r => setTimeout(r, 3000))

const mouse = new MouseController()
const kb    = new KeyboardController()
const askModel = AskModel.default()

// ─── 1. Dismiss popups via vision ────────────────────────────────────────────

while (true) {
  const shot = screenshotFull(true, Screen.mainScreen())
  shot.shrink(1920, 1080)
  const answer = askModel.ask(
    'Is there a popup, modal, or overlay blocking the page? Reply with only "yes" or "no".',
    null,
    [shot],
  )
  if (!/yes/i.test(answer)) break
  console.log('[popup] detected — closing via vision click')
  await visionClick(mouse, 'close or dismiss button on the popup or modal overlay', 'popup close button')
  await new Promise(r => setTimeout(r, 800))
}

// ─── 2. Click the search / food search field and type ────────────────────────

await visionClick(mouse, 'food text input field', 'search field')
await new Promise(r => setTimeout(r, 1000))
kb.text(SEARCH_TEXT)
console.log(`Typed: "${SEARCH_TEXT}"`)
await new Promise(r => setTimeout(r, 600))

// ─── 3. Click the Guests field, then click + to increase Adults ──────────────

await visionClick(mouse, 'Guests number of people pax field', 'guests field')
await new Promise(r => setTimeout(r, 600))

await visionClick(mouse, '+ button to increase number of adults', 'adults + button')

// ─── 4. Click the Time field and select the computed time ────────────────────

await visionClick(mouse, 'time selector drop down field', 'time field')
await new Promise(r => setTimeout(r, 700))

await visionClick(mouse, `"${chopeTimeLabel}" option in the time dropdown list`, `time option "${chopeTimeLabel}"`)

// ─── 5. Click the Let's Go / Search button ───────────────────────────────────

await visionClick(mouse, "Let's Go search submit button", "Let's Go button")

await new Promise(r => setTimeout(r, 2000))
console.log('Done — search submitted.')
