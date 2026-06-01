import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { corsHeaders, handleOptions } from '@/lib/cors'

export async function OPTIONS(req: Request) { return handleOptions(req) }

const JWT_SECRET = process.env.SAILOR_JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? 'proxis-sailor-secret'

function authAsesor(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  try { return (jwt.verify(auth.slice(7), JWT_SECRET) as { asesor: string }).asesor } catch { return null }
}

/* Consentimiento de uso secundario (Ley 21.719): libre, específico, separable y revocable.
   GET → estado vigente de las opciones A y B para el asesor.
   POST → registra otorgamiento/revocación de una opción (queda en consentimiento_historial). */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin'); const cors = corsHeaders(origin)
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const sb = supabaseAdmin()
  const { data } = await sb.from('consentimiento_historial')
    .select('opcion, estado, created_at').eq('asesor', asesor).order('created_at', { ascending: false })

  const estado = { A: 'no_otorgado', B: 'no_otorgado' }
  for (const e of data ?? []) {
    if (e.opcion === 'A' && estado.A === 'no_otorgado') estado.A = e.estado as string
    if (e.opcion === 'B' && estado.B === 'no_otorgado') estado.B = e.estado as string
  }
  return NextResponse.json({ estado }, { headers: cors })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin'); const cors = corsHeaders(origin)
  const asesor = authAsesor(req)
  if (!asesor) return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: cors })

  const b = await req.json()
  if (!['A', 'B'].includes(b.opcion) || !['otorgado', 'revocado'].includes(b.estado))
    return NextResponse.json({ error: 'opcion (A|B) y estado (otorgado|revocado) requeridos' }, { status: 400, headers: cors })

  const sb = supabaseAdmin()
  const [{ data: cred }, { data: doc }] = await Promise.all([
    sb.from('asesor_credentials').select('email').eq('asesor', asesor).single(),
    sb.from('legal_documentos').select('version').eq('tipo', 'consentimiento_datos_secundarios').eq('activo', true).single(),
  ])

  const { error } = await sb.from('consentimiento_historial').insert({
    asesor, email: cred?.email ?? null, opcion: b.opcion, estado: b.estado,
    version_texto: doc?.version ?? null, canal: b.canal ?? 'sailor',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors })

  // Flag de estado vigente en asesor_credentials (Opción A = uso secundario principal)
  if (b.opcion === 'A') {
    await sb.from('asesor_credentials').update({
      consentimiento_secundario: b.estado === 'otorgado',
      consentimiento_secundario_at: b.estado === 'otorgado' ? new Date().toISOString() : null,
      consentimiento_secundario_rev: b.estado === 'revocado' ? new Date().toISOString() : null,
    }).eq('asesor', asesor)
  }

  return NextResponse.json({ ok: true }, { headers: cors })
}
