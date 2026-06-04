// supabase/functions/_shared/ai-client.ts
// Cliente AI unificado: Groq (primario) → OpenRouter (fallback)
// Reemplaza todos los callGemini de las edge functions.
// Maneja throttle global, reintentos con backoff y logging a Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* ── Configuración ──────────────────────────────────────────── */

const GROQ_KEY       = Deno.env.get('GROQ_KEY')       ?? ''
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_KEY') ?? ''
const SB_URL         = Deno.env.get('SUPABASE_URL')!
const SB_KEY         = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Groq free tier: 30 RPM → 1 llamada cada 2s. Usamos 2500ms de margen.
const GROQ_MODEL   = 'llama-3.3-70b-versatile'
const OR_MODEL     = 'meta-llama/llama-3.3-70b-instruct:free'
const THROTTLE_MS  = 2500
const MAX_RETRIES  = 3

/* ── Throttle global por invocación ─────────────────────────── */
// Dentro de una misma ejecución (ej: monitor recorriendo asesores)
// asegura que no se disparen llamadas más rápido que THROTTLE_MS.

let lastCallAt = 0

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastCallAt
  if (elapsed < THROTTLE_MS) {
    await new Promise(r => setTimeout(r, THROTTLE_MS - elapsed))
  }
  lastCallAt = Date.now()
}

/* ── Logging (compatible con la tabla gemini_usage existente) ── */

const sb = createClient(SB_URL, SB_KEY)

async function logUsage(params: {
  componente: string
  ok:         boolean
  status:     number
  modelo?:    string
  promptTokens?: number | null
  outputTokens?: number | null
  totalTokens?:  number | null
}): Promise<void> {
  try {
    await sb.from('gemini_usage').insert({
      componente:    params.componente,
      ok:            params.ok,
      status:        params.status,
      modelo:        params.modelo ?? null,
      prompt_tokens: params.promptTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      total_tokens:  params.totalTokens  ?? null,
    })
  } catch (_) { /* best-effort */ }
}

/* ── Opciones de llamada ────────────────────────────────────── */

export interface AIOptions {
  maxTokens?:   number   // default: 2000
  temperature?: number   // default: 0.7
  jsonMode?:    boolean  // default: false
  componente?:  string   // para el log
}

/* ── Groq ───────────────────────────────────────────────────── */

async function callGroq(
  prompt: string,
  opts: Required<AIOptions>
): Promise<string> {
  if (!GROQ_KEY) throw new Error('GROQ_KEY no configurada')

  // Groq JSON mode exige que el system prompt mencione "JSON"
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
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    const e = new Error(`Groq HTTP ${res.status}: ${err?.error?.message ?? ''}`) as Error & { status: number }
    e.status = res.status
    throw e
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  await logUsage({
    componente:   opts.componente,
    ok:           true,
    status:       200,
    modelo:       GROQ_MODEL,
    promptTokens: data.usage?.prompt_tokens     ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
    totalTokens:  data.usage?.total_tokens      ?? null,
  })

  return data.choices?.[0]?.message?.content ?? ''
}

/* ── OpenRouter (fallback) ──────────────────────────────────── */

async function callOpenRouter(
  prompt: string,
  opts: Required<AIOptions>
): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_KEY no configurada')

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
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
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

  const data = await res.json() as {
    choices: { message: { content: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  await logUsage({
    componente:   opts.componente,
    ok:           true,
    status:       200,
    modelo:       OR_MODEL,
    promptTokens: data.usage?.prompt_tokens     ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
    totalTokens:  data.usage?.total_tokens      ?? null,
  })

  return data.choices?.[0]?.message?.content ?? ''
}

/* ── callAI — función principal exportada ───────────────────── */

export async function callAI(
  prompt: string,
  opts: AIOptions = {}
): Promise<string> {
  const options: Required<AIOptions> = {
    maxTokens:   opts.maxTokens   ?? 2000,
    temperature: opts.temperature ?? 0.7,
    jsonMode:    opts.jsonMode    ?? false,
    componente:  opts.componente  ?? 'unknown',
  }

  await throttle()

  let lastError: Error = new Error('callAI: sin intentos')

  for (let intento = 0; intento < MAX_RETRIES; intento++) {
    if (intento > 0) await new Promise(r => setTimeout(r, 2000 * intento))

    // Intentos 0-1: Groq. Intento 2: OpenRouter como fallback.
    const useGroq = intento < 2

    try {
      return useGroq
        ? await callGroq(prompt, options)
        : await callOpenRouter(prompt, options)
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e))
      const status = (e as { status?: number })?.status ?? 0
      const isRetryable = [429, 500, 502, 503].includes(status)

      await logUsage({
        componente: options.componente,
        ok:         false,
        status,
        modelo:     useGroq ? GROQ_MODEL : OR_MODEL,
      })

      // Error no retriable (ej: 400 prompt inválido) → fallar inmediatamente
      if (!isRetryable) throw lastError
    }
  }

  throw lastError
}

/* ── callAIJson — wrapper que parsea JSON ───────────────────── */
// Usa jsonMode:true internamente y limpia posibles backticks residuales.

export async function callAIJson<T = unknown>(
  prompt: string,
  opts: AIOptions = {}
): Promise<T> {
  const raw = await callAI(prompt, { ...opts, jsonMode: true })
  const clean = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  return JSON.parse(clean) as T
}
