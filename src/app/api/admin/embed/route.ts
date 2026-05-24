import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const key = process.env.GEMINI_KEY
  if (!key) return NextResponse.json({ error: 'GEMINI_KEY not configured' }, { status: 500 })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] } })
    }
  )
  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 502 })
  }
  const data = await res.json()
  const embedding = data.embedding?.values ?? null
  return NextResponse.json({ embedding })
}
