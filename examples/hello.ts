// Run: simulang run examples/hello.ts
// Exercises the simulang loader and shows that ESM features work.

const { platform, version } = process

console.log(`Hello from simulang on ${platform}, Node ${version}.`)
console.log(`OPENROUTER_API_KEY = ${process.env.OPENROUTER_API_KEY ? '<set>' : '<empty>'}`)

// Top-level await works.
await new Promise((r) => setTimeout(r, 10))
console.log('Top-level await: ok')

// Dynamic imports work.
const fs = await import('node:fs/promises')
const cwd = await fs.realpath(process.cwd())
console.log(`cwd = ${cwd}`)
