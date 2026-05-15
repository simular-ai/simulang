import { readFileSync } from 'node:fs'
import type { LoadHook, ResolveHook } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isLibSpecifier, libNameFromSpecifier, resolveSimulangRoot } from './which.js'

interface SimulangPackageJson {
  main?: string
  exports?: {
    '.'?: string | { default?: string }
  }
}

interface LoaderResult {
  url: string
  format: 'commonjs'
  shortCircuit: true
}

// `matchedName` is whichever of the known package names the specifier
// actually started with (`@simular-ai/simulang-js` or the legacy
// `@simular-ai/simulib-js`); needed to strip the right prefix for subpaths.
function loaderResultFromRoot(root: string, specifier: string, matchedName: string): LoaderResult {
  if (specifier === matchedName) {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as SimulangPackageJson
    const dotExport = pkg.exports?.['.']
    const fromDefault = typeof dotExport === 'object' ? dotExport.default : undefined
    const fromString = typeof dotExport === 'string' ? dotExport : undefined
    const entry = fromDefault ?? fromString ?? pkg.main ?? 'index.js'
    return { url: pathToFileURL(join(root, entry)).href, format: 'commonjs', shortCircuit: true }
  }
  const subPath = specifier.slice(matchedName.length + 1)
  return { url: pathToFileURL(join(root, subPath)).href, format: 'commonjs', shortCircuit: true }
}

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  if (!isLibSpecifier(specifier)) {
    return nextResolve(specifier, context)
  }

  // Same function `simulang which` uses — the runtime and the diagnostic
  // command are guaranteed to resolve to the same simulang-js install.
  // SIMULANG_SIMULIB is the pre-rename env var, accepted as an undocumented
  // fallback so shells that still export it keep working.
  const root = resolveSimulangRoot({
    parentURL: context.parentURL ?? null,
    simulangOverride: process.env.SIMULANG_JS ?? process.env.SIMULANG_SIMULIB ?? null,
  })

  if (!root) {
    // Let Node's resolver produce the canonical "module not found" error.
    return nextResolve(specifier, context)
  }

  // libNameFromSpecifier is non-null whenever isLibSpecifier was true above.
  const matchedName = libNameFromSpecifier(specifier) as string
  return loaderResultFromRoot(root.path, specifier, matchedName)
}

export const load: LoadHook = async (url, context, nextLoad) => {
  if (url.endsWith('.simulang')) {
    // Treat .simulang files as ordinary ESM JavaScript. No source transform.
    return nextLoad(url, { ...context, format: 'module' })
  }
  return nextLoad(url, context)
}
