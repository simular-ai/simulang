import { register } from 'node:module'

// Registers `./hooks.js` as an ESM customization hook for the current process.
// Spawned by `bin/simulang.ts` via `node --import <this file>` (after compilation,
// the spec resolves to the compiled `dist/src/hooks.js`).
register('./hooks.js', import.meta.url)
