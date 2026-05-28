import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/legal?tipo=terminos_asesor_corporativo
// Returns active document for a given type
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo')
  if (!tipo) return NextResponse.json({ error: 'tipo requerido' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('legal_documentos')
    .select('id, tipo, version, titulo, contenido, vigente_desde')
    .eq('tipo', tipo)
    .eq('activo', true)
    .single()

  if (error || !data) return NextResponse.json({ error: 'documento no encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

// POST /api/legal — register acceptance
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tipo, nombre_completo, email, asesor, org_usuario_id, institucion_id, plataforma } = body

  if (!tipo || !nombre_completo || !email || !plataforma)
    return NextResponse.json({ error: 'faltan campos requeridos' }, { status: 400 })

  const sb = supabaseAdmin()

  // Get active document
  const { data: doc } = await sb
    .from('legal_documentos')
    .select('id, version')
    .eq('tipo', tipo)
    .eq('activo', true)
    .single()

  if (!doc) return NextResponse.json({ error: 'documento activo no encontrado' }, { status: 404 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? null
  const user_agent = req.headers.get('user-agent') ?? null

  const { error } = await sb.from('legal_aceptaciones').insert({
    documento_id:    doc.id,
    tipo,
    version:         doc.version,
    asesor:          asesor          || null,
    org_usuario_id:  org_usuario_id  || null,
    institucion_id:  institucion_id  || null,
    email,
    nombre_completo,
    ip_address:      ip,
    user_agent,
    plataforma,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, version: doc.version })
}
