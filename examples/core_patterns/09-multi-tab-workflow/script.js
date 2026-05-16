import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import {
  App,
  FocusPolicy,
  Visibility,
  AccessibilityNode,
  AskModel,
} from '@simular-ai/simulang-js'

const PAGES = [
  { url: 'https://www.simular.ai/about',    label: 'simular.ai/about' },
  { url: 'https://www.sai.work/',           label: 'sai.work' },
  { url: 'https://www.simular.ai/research', label: 'simular.ai/research' },
]

const SELF = fileURLToPath(import.meta.url)

// ── Worker entry: receives page text, runs ask(), posts the summary back ──

if (!isMainThread) {
  const { prompt, text } = workerData
  const summary = AskModel.default().ask(prompt, text)
  parentPort.postMessage(summary)
  process.exit(0)
}

// ── Main: open all tabs, snapshot each, fan ask() calls out to workers ───

const browser = App.defaultBrowser()

const instances = PAGES.map(({ url }, i) => {
  const instance = browser.open(
    url,
    i === 0 ? FocusPolicy.Steal : FocusPolicy.DoNotSteal,
    Visibility.Show,
    false,
  )
  instance.enableAccessibility()
  return instance
})

await new Promise(r => setTimeout(r, 4000))

const snapshots = instances.map((instance, i) => {
  instance.focus()
  return {
    label: PAGES[i].label,
    text: AccessibilityNode.fromPid(instance.pid).snapshot(),
  }
})

const t0 = Date.now()
const summaries = await Promise.all(
  snapshots.map(({ text }) =>
    new Promise((resolve, reject) => {
      const w = new Worker(SELF, {
        workerData: {
          prompt: 'Summarise this web page in one sentence.',
          text,
        },
      })
      w.once('message', resolve)
      w.once('error', reject)
      w.once('exit', code => {
        if (code !== 0) reject(new Error(`worker exited with code ${code}`))
      })
    }),
  ),
)

console.log(`All ${PAGES.length} summaries returned in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)
for (let i = 0; i < PAGES.length; i++) {
  console.log(`[${snapshots[i].label}] ${summaries[i]}`)
}
