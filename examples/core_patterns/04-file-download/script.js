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

const PAGE_URL = 'https://scholar.google.com/scholar?hl=en&as_sdt=0%2C10&q=Reliable+Computer+Use+Agents&btnG='

App.defaultBrowser().open(PAGE_URL, FocusPolicy.Steal, Visibility.Show, true)
await new Promise((r) => setTimeout(r, 3000))

const mouse = new MouseController()
const kb = new KeyboardController()

// Locate the first [PDF] arxiv.org link via visual grounding
const screenshot = screenshotFull(true, Screen.mainScreen())
const [x, y] = screenshot.ground(GroundingModel.default(), 'first [PDF] arxiv.org link in the search results')
console.log(`Right-clicking [PDF] link at (${x}, ${y})`)

// Right-click to open the context menu
mouse.moveMouse(x, y, Coordinate.Abs)
mouse.button(Button.Right, Direction.Click)
await new Promise((r) => setTimeout(r, 800))

// Locate and click "Save Link As…" in the context menu
const menuShot = screenshotFull(true, Screen.mainScreen())
const [mx, my] = menuShot.ground(GroundingModel.default(), '"Save Link As" context menu item')
console.log(`Clicking "Save Link As" at (${mx}, ${my})`)
mouse.moveMouse(mx, my, Coordinate.Abs)
mouse.button(Button.Left, Direction.Click)
await new Promise((r) => setTimeout(r, 1500))

// Press Enter to confirm the save dialog with the default filename/location.
kb.key(Key.Return, Direction.Click)
console.log('Pressed Enter to confirm download')
