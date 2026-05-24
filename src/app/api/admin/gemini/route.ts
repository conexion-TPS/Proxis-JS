import { NextRequest, NextResponse } from 'next/server'
import { callGemini } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const { prompt, history } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'Falta el prompt' }, { status: 400 })

    // If history provided, append current prompt as last user turn
    const fullPrompt = history?.length
      ? `${prompt}\n\n[Conversación anterior]\n${history.map((m: { role: string; parts: { text: string }[] }) => `${m.role}: ${m.parts[0].text}`).join('\n')}\n\n[Mensaje actual del usuario]`
      : prompt

    const text = await callGemini(fullPrompt, { maxTokens: 1500, temperature: 0.7 })
    return NextResponse.json({ text })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
