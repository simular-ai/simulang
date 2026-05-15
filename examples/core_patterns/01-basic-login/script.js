import {
  App,
  FocusPolicy,
  Visibility,
  AccessibilityTree,
  TraversalOrder,
  AriaRole,
  KeyboardController,
} from '@simular-ai/simulang-js'

const USERNAME = 'student'
const PASSWORD = 'Password123'
const LOGIN_URL = 'https://practicetestautomation.com/practice-test-login/'

const instance = App.defaultBrowser().open(LOGIN_URL, FocusPolicy.Steal, Visibility.Show, true)
instance.focus()
instance.enableAccessibility()
await new Promise((r) => setTimeout(r, 3000))

const tree = AccessibilityTree.fromPid(instance.pid)
const kb = new KeyboardController()

// Fill username — ARIA role Textbox covers AXTextField on macOS
const usernameResults = tree.find(TraversalOrder.BreadthFirst, AriaRole.Textbox, 'Username', true, 1)
if (usernameResults.length === 0) throw new Error('Username field not found')
tree.focusElement(usernameResults[0].refId)
kb.text(USERNAME)

// Fill password — ARIA role Password covers AXSecureTextField on macOS
const passwordResults = tree.find(TraversalOrder.BreadthFirst, AriaRole.Textbox, 'Password', true, 1)
if (passwordResults.length === 0) throw new Error('Password field not found')
tree.focusElement(passwordResults[0].refId)
kb.text(PASSWORD)

// Submit
const submitResults = tree.find(TraversalOrder.BreadthFirst, AriaRole.Button, 'Submit', true, 1)
if (submitResults.length === 0) throw new Error('Submit button not found')
tree.activate(submitResults[0].refId)
console.log('Submitted login form')

await new Promise((r) => setTimeout(r, 2000))

console.log(`Login verified — dashboard element found at (${sx}, ${sy})`)
