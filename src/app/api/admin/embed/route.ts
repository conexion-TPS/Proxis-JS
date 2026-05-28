import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.HUGGINGFACE_TOKEN
  return NextResponse.json({ configured: !!token, hint: token ? `${token.slice(0,6)}...` : 'EMPTY' })
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

    const token = process.env.HUGGINGFACE_TOKEN
    if (!token) return NextResponse.json({ error: 'HUGGINGFACE_TOKEN not configured' }, { status: 500 })

    const res = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `HuggingFace HTTP ${res.status}: ${err}` }, { status: 502 })
    }

    const data = await res.json()
    const embedding = Array.isArray(data[0]) ? data[0] : data
    return NextResponse.json({ embedding })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Unhandled: ${msg}` }, { status: 500 })
  }
}
