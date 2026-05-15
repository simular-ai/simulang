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
import { execSync } from 'node:child_process'

const TOTP_SECRET = process.env.TOTP_SECRET ?? 'JBSWY3DPEHPK3PXP'
const LOGIN_URL = 'http://localhost:8080'

const code = execSync(`oathtool --totp --base32 ${TOTP_SECRET}`).toString().trim()
console.log(`Generated TOTP code: ${code}`)

const instance = App.defaultBrowser().open(LOGIN_URL, FocusPolicy.Steal, Visibility.Show, true)
instance.focus()
instance.enableAccessibility()
await new Promise((r) => setTimeout(r, 1500))

const tree = AccessibilityTree.fromPid(instance.pid)
const kb = new KeyboardController()
const clip = new Clipboard()

const [otpField] = tree.find(TraversalOrder.BreadthFirst, AriaRole.Textbox, 'One-Time Password', true, 1)
if (!otpField) throw new Error('OTP field not found')
tree.focusElement(otpField.refId)
clip.pasteText(code)
console.log(`Pasted OTP code into field`)

kb.key(Key.Return, Direction.Click)
await new Promise((r) => setTimeout(r, 1000))

console.log('Done — check the browser for the success message.')
