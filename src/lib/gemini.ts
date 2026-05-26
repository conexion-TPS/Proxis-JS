const GEMINI_KEY = process.env.GEMINI_KEY ?? ''
const MODEL      = 'gemini-2.5-flash'
const API_URL    = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
const EMBED_URL  = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent`

export async function embedText(text: string): Promise<number[]> {
  if (!GEMINI_KEY) return []
  const res = await fetch(`${EMBED_URL}?key=${GEMINI_KEY}`, {
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
  if (!GEMINI_KEY) return '[GEMINI_KEY no configurada]'

  const res = await fetch(`${API_URL}?key=${GEMINI_KEY}`, {
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

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}
