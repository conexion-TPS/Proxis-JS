// src/lib/ai-client.ts
// Cliente AI unificado para Next.js (Vercel): Groq (primario) → OpenRouter (fallback)
// Reemplaza callGemini de @/lib/gemini en las rutas API.
// Mantiene la MISMA firma que callGemini para reemplazo mínimo en las rutas.

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const OR_MODEL   = 'meta-llama/llama-3.3-70b-instruct:free'
const MAX_RETRIES = 3

// Leído en tiempo de llamada, no en carga de módulo (cold starts de Vercel)
function getGroqKey():       string { return process.env.GROQ_KEY       ?? '' }
function getOpenRouterKey(): string { return process.env.OPENROUTER_KEY ?? '' }

export interface AIOptions {
  maxTokens?:   number
  temperature?: number
  jsonMode?:    boolean
}

/* ── Groq ───────────────────────────────────────────────────── */

async function callGroq(prompt: string, opts: Required<AIOptions>): Promise<string> {
  const key = getGroqKey()
  if (!key) throw new Error('GROQ_KEY no configurada')

  const messages: { role: string; content: string }[] = []
  if (opts.jsonMode) {
    messages.push({
      role:    'system',
      content: 'Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks.',
    })
  }
  messages.push({ role: 'user', content: prompt })

  const body: Record<string, unknown> = {
    model:       GROQ_MODEL,
    messages,
    max_tokens:  opts.maxTokens,
    temperature: opts.temperature,
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    const e = new Error(`Groq HTTP ${res.status}: ${err?.error?.message ?? ''}`) as Error & { status: number }
    e.status = res.status
    throw e
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

/* ── OpenRouter (fallback) ──────────────────────────────────── */

async function callOpenRouter(prompt: string, opts: Required<AIOptions>): Promise<string> {
  const key = getOpenRouterKey()
  if (!key) throw new Error('OPENROUTER_KEY no configurada')

  const messages: { role: string; content: string }[] = []
  if (opts.jsonMode) {
    messages.push({
      role:    'system',
      content: 'Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks.',
    })
  }
  messages.push({ role: 'user', content: prompt })

  const body: Record<string, unknown> = {
    model:       OR_MODEL,
    messages,
    max_tokens:  opts.maxTokens,
    temperature: opts.temperature,
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://proxis.app',
      'X-Title':       'Proxis Coach',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    const e = new Error(`OpenRouter HTTP ${res.status}: ${err?.error?.message ?? ''}`) as Error & { status: number }
    e.status = res.status
    throw e
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

/* ── callAI — misma firma que el viejo callGemini ───────────── */

export async function callAI(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number; jsonMode?: boolean }
): Promise<string> {
  const options: Required<AIOptions> = {
    maxTokens:   opts?.maxTokens   ?? 1200,
    temperature: opts?.temperature ?? 0.7,
    jsonMode:    opts?.jsonMode    ?? false,
  }

  let lastError: Error = new Error('callAI: sin intentos')

  for (let intento = 0; intento < MAX_RETRIES; intento++) {
    if (intento > 0) await new Promise(r => setTimeout(r, 2000 * intento))
    const useGroq = intento < 2
    try {
      return useGroq
        ? await callGroq(prompt, options)
        : await callOpenRouter(prompt, options)
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e))
      const status = (e as { status?: number })?.status ?? 0
      if (![429, 500, 502, 503].includes(status)) throw lastError
    }
  }
  throw lastError
}

/* ── callAIJson — wrapper que parsea JSON ───────────────────── */

export async function callAIJson<T = unknown>(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<T> {
  const raw = await callAI(prompt, { ...opts, jsonMode: true })
  const clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  return JSON.parse(clean) as T
}

/* ── embedText — STUB (Groq no hace embeddings) ─────────────── */
// La búsqueda de conocimiento del piloto usa SELECT directo por perfil/categoría,
// no similitud vectorial. Este stub mantiene la firma para no romper imports.
// Cuando se necesite búsqueda semántica real, se conecta Cohere aquí.

export async function embedText(_text: string): Promise<number[]> {
  return []
}
