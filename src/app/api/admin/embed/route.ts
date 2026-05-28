import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const token = process.env.HUGGINGFACE_TOKEN
  if (!token) return NextResponse.json({ error: 'HUGGINGFACE_TOKEN not configured', hint: Object.keys(process.env).filter(k => k.includes('HUG')) }, { status: 500 })

  const res = await fetch(
    'https://api-inference.huggingface.co/models/sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 502 })
  }

  const data = await res.json()
  // HuggingFace returns nested array for sentence-transformers — unwrap if needed
  const embedding = Array.isArray(data[0]) ? data[0] : data
  return NextResponse.json({ embedding })
}
