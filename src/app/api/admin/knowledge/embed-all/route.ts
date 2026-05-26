import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { embedText } from '@/lib/gemini'

export async function POST(_req: NextRequest) {
  const sb = supabaseAdmin()
  const { data: rows, error } = await sb
    .from('knowledge_base_conductual')
    .select('id, contenido, contexto, regla_inferencia')
    .is('embedded_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows || rows.length === 0) return NextResponse.json({ embedded: 0, message: 'Todo ya está embedeado' })

  let count = 0
  const errors: string[] = []

  for (const row of rows) {
    const text = [row.contenido, row.contexto, row.regla_inferencia]
      .filter(Boolean).join('\n')
    try {
      const embedding = await embedText(text)
      if (!embedding.length) { errors.push(row.id); continue }

      const { error: upErr } = await sb.from('knowledge_base_conductual').update({
        embedding:   `[${embedding.join(',')}]`,
        embedded_at: new Date().toISOString(),
      }).eq('id', row.id)

      if (upErr) { errors.push(row.id); continue }
      count++
    } catch (e) {
      console.error('[embed-all]', row.id, e)
      errors.push(row.id)
    }
  }

  return NextResponse.json({ embedded: count, total: rows.length, errors })
}
