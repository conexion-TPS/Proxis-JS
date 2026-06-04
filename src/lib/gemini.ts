// src/lib/gemini.ts
// PUENTE DE COMPATIBILIDAD tras la migración a Groq/OpenRouter.
// El nombre se conserva para no romper imports existentes, pero internamente
// ya no llama a Gemini — delega en ai-client.ts (Groq → OpenRouter).
// callGemini queda como alias de callAI con firma idéntica.

import { callAI, callAIJson, embedText } from '@/lib/ai-client'

export async function callGemini(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  return callAI(prompt, opts)
}

export { callAI, callAIJson, embedText }
