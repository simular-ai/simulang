// Run: simulang run examples/import-simulang.ts
// Verifies the resolve hook finds @simular-ai/simulang-js. Written in TypeScript;
// Node strips the types natively (Node >= 22.18).

import * as simulang from '@simular-ai/simulang-js'

interface ExportSummary {
  total: number
  preview: string[]
}

function summarize(mod: object): ExportSummary {
  const names = Object.keys(mod).sort()
  return { total: names.length, preview: names.slice(0, 5) }
}

const { total, preview } = summarize(simulang)
console.log(`Loaded @simular-ai/simulang-js, ${total} exports.`)
console.log(`First ${preview.length} exports: ${preview.join(', ')}`)
