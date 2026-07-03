/**
 * AI advisor — one local-first Ollama client + a generic retrieval-augmented
 * contract shared by every domain.
 *
 * Consolidates three near-identical advisors (retail's `ai/ollama.ts` +
 * `ai/analyst.ts`, geostrategy's `api/ai/route.ts` deterministic responder,
 * productlab's advisor). The contract:
 *   - A domain builds an AdvisorContext (labeled sections of engine output).
 *   - It supplies a persona and a set of deterministic IntentRules.
 *   - `answer()` tries the local model grounded in the context, and ALWAYS falls
 *     back to the deterministic router so the advisor never fails (no key, no
 *     network, Vercel — all fine).
 */

export const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fn(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** Fast reachability probe — short timeout so it never blocks a request on Vercel. */
export async function isAvailable(timeoutMs = 800): Promise<boolean> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal })
      return res.ok
    }, timeoutMs)
  } catch {
    return false
  }
}

export interface GenerateOptions {
  system?: string
  temperature?: number
  timeoutMs?: number
}

/** Generate from the local model, or null if unreachable (callers must fall back). */
export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string | null> {
  const { system, temperature = 0.2, timeoutMs = 45_000 } = opts
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt, system, stream: false, options: { temperature } }),
        signal,
      })
      if (!res.ok) return null
      const json = (await res.json()) as { response?: string }
      return json.response?.trim() ?? null
    }, timeoutMs)
  } catch {
    return null
  }
}

/* ── Input validation ────────────────────────────────────────────────────────── */

export const MAX_QUESTION_LENGTH = 500

/**
 * Validate and normalize a user question. Returns the trimmed question, or null
 * when empty/not a string/over the length cap — callers respond 400. The cap
 * bounds prompt size to the local model and prevents junk payloads from tying up
 * the (45s-timeout) generation call.
 */
export function sanitizeQuestion(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const q = input.trim()
  if (!q || q.length > MAX_QUESTION_LENGTH) return null
  return q
}

/* ── Retrieval-augmented contract ────────────────────────────────────────────── */

export interface ContextSection {
  label: string
  text: string
}

export interface AdvisorContext {
  sections: ContextSection[]
}

/** Render the structured context into a compact, model-readable document. */
export function buildContextText(ctx: AdvisorContext): string {
  return ctx.sections.map((s) => `${s.label.toUpperCase()}: ${s.text}`).join('\n')
}

export function advisorPrompt(persona: string, question: string, contextText: string): string {
  return `${persona}

Answer the user's question using ONLY the context below. Be specific, cite the numbers, explain the "why", and end with a concrete recommendation. Keep it under 6 sentences. If the context doesn't cover it, say what data would be needed.

CONTEXT:
${contextText}

QUESTION: ${question}

ANSWER:`
}

/* ── Deterministic intent router (the always-available fallback) ─────────────── */

export interface IntentRule<C> {
  /** Lowercased keywords; the rule fires if the question contains any of them. */
  match: string[]
  /** Produce an answer from the typed context, or null to defer to the next rule. */
  answer: (ctx: C) => string | null
}

/** Route a question through ordered intent rules; return the first non-null answer. */
export function routeDeterministic<C>(
  question: string,
  ctx: C,
  rules: IntentRule<C>[],
  fallback: (ctx: C) => string,
): string {
  const q = question.toLowerCase()
  for (const rule of rules) {
    if (rule.match.some((kw) => q.includes(kw))) {
      const ans = rule.answer(ctx)
      if (ans) return ans
    }
  }
  return fallback(ctx)
}

/* ── Orchestrator: local model first, deterministic always ───────────────────── */

export interface AnswerConfig<C> {
  persona: string
  question: string
  /** Structured context for the LLM prompt. */
  context: AdvisorContext
  /** Typed context for the deterministic rules. */
  ruleContext: C
  rules: IntentRule<C>[]
  fallback: (ctx: C) => string
}

export interface AdvisorAnswer {
  text: string
  source: 'ollama' | 'deterministic'
}

/** Answer a question: grounded local model if available, deterministic otherwise. */
export async function answer<C>(config: AnswerConfig<C>): Promise<AdvisorAnswer> {
  const deterministic = () =>
    routeDeterministic(config.question, config.ruleContext, config.rules, config.fallback)

  if (await isAvailable()) {
    const prompt = advisorPrompt(config.persona, config.question, buildContextText(config.context))
    const out = await generate(prompt)
    if (out) return { text: out, source: 'ollama' }
  }
  return { text: deterministic(), source: 'deterministic' }
}
