import {
  App,
  FocusPolicy,
  Visibility,
  GroundingModel,
  Screen,
  screenshotFull,
  MouseController,
  Coordinate,
  Button,
  Direction,
  KeyboardController,
  Key,
} from '@simular-ai/simulang-js'

const START_URL = 'https://simular.ai'
const NAV_LINKS = ['About', 'Product', 'Research']

App.defaultBrowser().open(START_URL, FocusPolicy.Steal, Visibility.Show, true)
await new Promise((r) => setTimeout(r, 3000))

const mouse = new MouseController()
const kb = new KeyboardController()

// Browser "back" shortcut: Cmd+Left on macOS, Alt+Left on Windows/Linux
const BACK_MODIFIER = process.platform === 'darwin' ? Key.Meta : Key.Alt

// Clear any stuck mouse button state from prior runs
mouse.button(Button.Left, Direction.Release)

for (const label of NAV_LINKS) {
  console.log(`\nClicking: "${label}"`)

  const shot = screenshotFull(true, Screen.mainScreen())
  const [x, y] = shot.ground(GroundingModel.default(), `"${label}" navigation link`)
  mouse.moveMouse(x, y, Coordinate.Abs)
  mouse.button(Button.Left, Direction.Click)
  console.log(`  Clicked at (${x}, ${y})`)

  // Wait for destination page to load
  await new Promise((r) => setTimeout(r, 2000))

  // Navigate back (Cmd+Left on macOS, Alt+Left on Windows/Linux)
  kb.key(BACK_MODIFIER, Direction.Press)
  kb.key(Key.LeftArrow, Direction.Click)
  kb.key(BACK_MODIFIER, Direction.Release)
  console.log(`  Navigated back`)

  // Wait for simular.ai to reload
  await new Promise((r) => setTimeout(r, 2000))
}

console.log('\nDone — all nav links visited.')
