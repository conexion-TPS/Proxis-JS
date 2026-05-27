const MODEL    = 'gemini-2.5-flash'
const API_URL  = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`

// Read at call-time, not at module load — Vercel injects encrypted vars after cold start
function getKey(): string {
  return process.env.GEMINI_KEY ?? ''
}

export async function embedText(text: string): Promise<number[]> {
  const key = getKey()
  if (!key) return []
  const res = await fetch(`${EMBED_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  })
  if (!res.ok) throw new Error(`Gemini embed HTTP ${res.status}`)
  const data = await res.json()
  return data.embedding?.values ?? []
}

export async function callGemini(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const key = getKey()
  if (!key) return '[GEMINI_KEY no configurada]'

  const res = await fetch(`${API_URL}?key=${key}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: opts?.maxTokens   ?? 1200,
        temperature:     opts?.temperature ?? 0.7,
      },
    }),
  })

  if (!res.ok) {
    const status = res.status
    if (status === 429) throw new Error('Gemini HTTP 429: cuota de API agotada — espera 1 minuto y reintenta')
    throw new Error(`Gemini HTTP ${status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}
