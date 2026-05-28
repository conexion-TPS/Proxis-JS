import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/legal/check?tipo=terminos_supervisor&org_usuario_id=xxx
// Returns { acepto: bool }
export async function GET(req: NextRequest) {
  const tipo          = req.nextUrl.searchParams.get('tipo')
  const asesor        = req.nextUrl.searchParams.get('asesor')
  const orgUsuarioId  = req.nextUrl.searchParams.get('org_usuario_id')
  const institucionId = req.nextUrl.searchParams.get('institucion_id')

  if (!tipo) return NextResponse.json({ error: 'tipo requerido' }, { status: 400 })

  const sb = supabaseAdmin()

  // Get active document version
  const { data: doc } = await sb
    .from('legal_documentos')
    .select('id, version')
    .eq('tipo', tipo)
    .eq('activo', true)
    .single()

  if (!doc) return NextResponse.json({ acepto: true }) // no active doc = no gate

  // Check acceptance
  let query = sb
    .from('legal_aceptaciones')
    .select('id')
    .eq('tipo', tipo)
    .eq('version', doc.version)

  if (asesor)        query = query.eq('asesor', asesor)
  if (orgUsuarioId)  query = query.eq('org_usuario_id', orgUsuarioId)
  if (institucionId) query = query.eq('institucion_id', institucionId)

  const { data } = await query.limit(1)
  return NextResponse.json({ acepto: (data?.length ?? 0) > 0 })
}
