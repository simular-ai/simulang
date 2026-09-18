// structural_output: a prompt, a state and a JSON schema of choices in, an
// object that fits the schema out. One primitive, two providers underneath.
//
//   structuralOutput({ prompt, state, schema, provider, model })
//
// `schema` is ordinary JSON Schema: an object whose properties are strings
// with `oneOf: [{ const, description }]`. TypeSafe (Jev) gets each property
// as its own Choice question over one shared state; OpenRouter gets the
// schema flattened to enums as a strict json_schema response_format.
//
// Keys live in ~/.typesafe-key and ~/.openrouter-key, mode 600, with
// TYPESAFE_API_KEY / OPENROUTER_API_KEY as the fallback. The file wins: a
// stale export in a shell profile shadowed a good key on disk and answered
// 401 with no hint why.
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'

export type Provider = 'typesafe' | 'openrouter'

export interface ChoiceProperty {
  type: 'string'
  description?: string
  oneOf: Array<{ const: string; description?: string }>
}

/** Any other JSON Schema for a property — a number, a free string, an array. */
export type JsonSchema = Record<string, unknown>

export interface Schema {
  type: 'object'
  properties: Record<string, ChoiceProperty | JsonSchema>
}

export interface Options {
  /** Milliseconds before a call is given up on. Default 60000. */
  timeoutMs?: number
  /** When the chosen provider cannot answer this schema, use one that can. Default true. */
  fallback?: boolean
  /** OpenRouter only. Gemini refuses to turn reasoning off, so this is how much to pay for. Default 'low'. */
  reasoningEffort?: 'low' | 'medium' | 'high'
  /** OpenRouter only. Default 4000; covers the reasoning as well as the answer. */
  maxTokens?: number
  /** OpenRouter only. Default 0. */
  temperature?: number
}

export interface StructuralOutputRequest {
  prompt: string
  state: unknown
  schema: Schema
  provider?: Provider
  model?: string
  options?: Options
}

const DEFAULTS: Required<Options> = {
  timeoutMs: 60000,
  fallback: true,
  reasoningEffort: 'low',
  maxTokens: 4000,
  temperature: 0,
}

/** `retry` is true for the kind of failure that answers differently next time: network, 5xx, 429. */
export type Failure = { error: string; retry?: boolean }
export type Answer = Record<string, unknown>

const PROVIDERS: Record<Provider, { url: string; env: string; file: string; model: string }> = {
  typesafe: {
    url: 'https://api.typesafe.ai/v1/systemone',
    env: 'TYPESAFE_API_KEY',
    file: '.typesafe-key',
    model: 'jev-latest',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    env: 'OPENROUTER_API_KEY',
    file: '.openrouter-key',
    model: 'google/gemini-3.8-flash',
  },
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: PROVIDERS.typesafe.model,
  openrouter: PROVIDERS.openrouter.model,
}

/** The key for a provider, or a sentence saying where to put one. */
export function key(provider: Provider): { key: string } | { error: string } {
  const p = PROVIDERS[provider]
  if (!p) return { error: `no such provider: ${provider}` }
  const path = `${homedir()}/${p.file}`
  try {
    // Refuse a key anyone else on this machine can read, the way ssh does.
    // Windows has no mode bits worth reading, so the check is POSIX only.
    if (process.platform !== 'win32' && statSync(path).mode & 0o077) {
      return { error: `~/${p.file} is readable by others — chmod 600 it` }
    }
    return { key: readFileSync(path, 'utf8').trim() }
  } catch {
    const fromEnv = process.env[p.env]
    if (fromEnv) return { key: fromEnv }
    return { error: `no ${p.env} — put the key in ~/${p.file}, mode 600` }
  }
}

const isChoice = (prop: ChoiceProperty | JsonSchema): prop is ChoiceProperty =>
  prop.type === 'string' &&
  Array.isArray(prop.oneOf) &&
  prop.oneOf.length > 0 &&
  prop.oneOf.every((o) => typeof (o as { const?: unknown }).const === 'string')

const options = (prop: ChoiceProperty): Record<string, string> =>
  Object.fromEntries(prop.oneOf.map((o) => [o.const, o.description ?? '']))

/**
 * Can this provider answer this schema at all? TypeSafe has a fixed set of
 * question types and this binding uses one of them, Choice, so every property
 * has to be a choice. OpenRouter takes any JSON Schema.
 */
export function canSatisfy(provider: Provider, schema: Schema): boolean {
  if (provider === 'openrouter') return true
  return Object.values(schema.properties).every(isChoice)
}

export async function structuralOutput({
  prompt,
  state,
  schema,
  provider = 'typesafe',
  model,
  options: given,
}: StructuralOutputRequest): Promise<Answer | Failure> {
  const opts = { ...DEFAULTS, ...given }
  if (!canSatisfy(provider, schema)) {
    if (!opts.fallback) return { error: `${provider} cannot answer this schema: every property must be a choice` }
    // The model was chosen for the provider, so it does not carry over.
    provider = 'openrouter'
    model = undefined
  }
  const p = PROVIDERS[provider]
  const k = key(provider)
  if ('error' in k) return { error: k.error }
  const send = provider === 'typesafe' ? viaTypesafe : viaOpenrouter
  const chosen = model ?? p.model
  let r: Response
  try {
    r = await fetch(p.url, {
      signal: AbortSignal.timeout(opts.timeoutMs),
      method: 'POST',
      headers: { authorization: `Bearer ${k.key}`, 'content-type': 'application/json' },
      body: JSON.stringify(send.body(prompt, state, schema, chosen, opts)),
    })
  } catch (e) {
    return { retry: true, error: `${provider} unreachable: ${String((e as Error)?.message ?? e)}` }
  }
  if (!r.ok) {
    // A bad key or a malformed question answers the same thing every time;
    // an overloaded model does not.
    return {
      retry: r.status >= 500 || r.status === 429,
      error: `${provider} ${r.status}: ${(await r.text()).slice(0, 200)}`,
    }
  }
  return send.read(await r.json(), chosen)
}

interface Wire {
  body(prompt: string, state: unknown, schema: Schema, model: string, opts: Required<Options>): unknown
  read(body: unknown, model: string): Answer | Failure
}

const viaTypesafe: Wire = {
  body(prompt, state, schema, model) {
    const questions: Record<string, unknown> = {}
    for (const [name, prop] of Object.entries(schema.properties)) {
      if (!isChoice(prop)) continue // canSatisfy has already said no
      questions[name] = {
        type: 'choice',
        instructions: `${prop.description ?? ''} ${prompt}`.trim(),
        criteria: options(prop),
      }
    }
    return { state, questions, model }
  },
  read(body) {
    const answers = ((body as { answers?: Record<string, { choice?: string }> }).answers ?? {}) as Record<
      string,
      { choice?: string }
    >
    const out: Answer = {}
    for (const [name, v] of Object.entries(answers)) if (v?.choice) out[name] = v.choice
    return out
  },
}

// A chat model gets choices flattened to enums, which is the nearest thing it
// has to a Choice; any other property goes through as the JSON Schema it is.
const viaOpenrouter: Wire = {
  body(prompt, state, schema, model, opts) {
    const properties: Record<string, unknown> = {}
    for (const [name, prop] of Object.entries(schema.properties)) {
      if (!isChoice(prop)) {
        properties[name] = prop
        continue
      }
      const choices = options(prop)
      properties[name] = {
        type: 'string',
        enum: Object.keys(choices),
        description: [prop.description, ...Object.entries(choices).map(([k, v]) => `${k}: ${v}`)]
          .filter(Boolean)
          .join(' | '),
      }
    }
    return {
      model,
      reasoning: { effort: opts.reasoningEffort },
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'answer',
          strict: true,
          schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
        },
      },
      messages: [
        { role: 'system', content: `${prompt} Answer only with the JSON object, filling in every field.` },
        { role: 'user', content: JSON.stringify(state) },
      ],
    }
  },
  read(body, model) {
    const text = (body as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content
    let out: unknown
    try {
      out = JSON.parse(String(text))
    } catch {
      // A model that ignored the schema will usually ignore it again, but a
      // truncated response is worth one more go.
      return { retry: true, error: `${model} did not answer with JSON: ${String(text).slice(0, 120)}` }
    }
    // JSON.parse('null') returns null and throws nothing.
    if (!out || typeof out !== 'object')
      return { retry: true, error: `${model} answered with nothing: ${String(text).slice(0, 120)}` }
    return out as Answer
  },
}
