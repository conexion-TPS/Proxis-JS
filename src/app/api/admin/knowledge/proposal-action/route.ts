import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type Action = 'aprobar' | 'rechazar'

export async function POST(req: NextRequest) {
  const { proposal_id, action } = await req.json().catch(() => ({}))
  if (!proposal_id || !['aprobar', 'rechazar'].includes(action))
    return NextResponse.json({ error: 'proposal_id y action (aprobar|rechazar) requeridos' }, { status: 400 })

  const sb = supabaseAdmin()
  const act = action as Action

  // Load the proposal
  const { data: proposal, error: pErr } = await sb
    .from('knowledge_proposals')
    .select('*')
    .eq('id', proposal_id)
    .single()

  if (pErr || !proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })

  if (act === 'aprobar') {
    // Insert into knowledge_base_conductual
    await sb.from('knowledge_base_conductual').insert({
      perfil:            proposal.perfil,
      categoria:         proposal.categoria,
      etapa_ciclo:       proposal.etapa_ciclo ?? null,
      contexto:          proposal.justificacion ?? null,
      contenido:         proposal.contenido,
      regla_inferencia:  proposal.regla_inferencia ?? null,
      accion_correctiva: proposal.accion_correctiva ?? null,
      completitud:       proposal.completitud ?? 60,
    })
    // Mark proposal approved + gap cubierto
    await sb.from('knowledge_proposals').update({ estado: 'aprobada' }).eq('id', proposal_id)
    if (proposal.gap_id) {
      await sb.from('knowledge_gaps').update({ estado: 'cubierto' }).eq('id', proposal.gap_id)
    }
    return NextResponse.json({ ok: true, action: 'aprobada' })
  } else {
    // Reject: mark proposal rechazada, revert gap to detectado
    await sb.from('knowledge_proposals').update({ estado: 'rechazada' }).eq('id', proposal_id)
    if (proposal.gap_id) {
      await sb.from('knowledge_gaps').update({ estado: 'detectado' }).eq('id', proposal.gap_id)
    }
    return NextResponse.json({ ok: true, action: 'rechazada' })
  }
}
