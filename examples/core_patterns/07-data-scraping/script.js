import {
  App,
  FocusPolicy,
  Visibility,
  AccessibilityNode,
  AskModel,
} from '@simular-ai/simulang-js'

const TARGET_URL = 'https://simular.ai'

const instance = App.defaultBrowser().open(TARGET_URL, FocusPolicy.Steal, Visibility.Show, true)
instance.focus()
instance.enableAccessibility()
await new Promise(r => setTimeout(r, 2000))

const pageText = AccessibilityNode.fromPid(instance.pid).snapshot()

const model = AskModel.default()
const response = model.ask(
  'Extract all social media links from the page content below. ' +
  'Return them as a JSON array of objects with "platform" and "url" fields. ' +
  'Return only the JSON array, no explanation.',
  pageText,
)

console.log('Social media links found on simular.ai:\n')
try {
  const links = JSON.parse(response)
  for (const { platform, url } of links) {
    console.log(`  ${platform}: ${url}`)
  }
} catch {
  console.log(response)
}
