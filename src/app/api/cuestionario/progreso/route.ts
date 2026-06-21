import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { authAsesor } from '@/lib/sailorAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) { return handleOptions(req) }

// POST /api/cuestionario/progreso { progress } → registra avance del asesor del TOKEN.
// Solo escribe tps_progress (upsert parcial): NO toca perfil_base ni el dato sensible.
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const body = await req.json().catch(() => ({}))
  const progress = Number(body?.progress)
  if (!Number.isFinite(progress) || progress < 0 || progress > 100)
    return NextResponse.json({ error: 'progress (0-100) requerido' }, { status: 400, headers: cors })

  const sb = supabaseAdmin()
  const { error } = await sb.from('tps_perfiles').upsert(
    { asesor, version_instrumento: '1.0', tps_progress: Math.round(progress), updated_at: new Date().toISOString() },
    { onConflict: 'asesor' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors })

  return NextResponse.json({ ok: true }, { headers: cors })
}
