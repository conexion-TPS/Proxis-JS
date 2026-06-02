import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendLegalEmail } from '@/lib/resend'
import { logLegalEvent, sha256, hashIp } from '@/lib/legal'

const TITULOS: Record<string, string> = {
  terminos_asesor_corporativo: 'Términos de Uso — Asesor (Plan Corporativo)',
  terminos_asesor_independiente: 'Términos de Servicio — Asesor Independiente',
  terminos_supervisor: 'Términos de Uso — Supervisor',
  dpa_empresa: 'Acuerdo de Tratamiento de Datos (DPA)',
  consentimiento_datos_secundarios: 'Consentimiento de Uso Secundario de Datos',
  politica_privacidad: 'Política de Privacidad',
}

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

  // Ítem 1 — enviar copia/enlace estable de la versión aceptada ANTES de cerrar el registro.
  const titulo = TITULOS[tipo] ?? tipo
  let copiaEnviada = false
  try {
    await sendLegalEmail({
      to: email,
      subject: `Copia de tu aceptación — ${titulo} (v${doc.version})`,
      bodyHtml: `<p>Hola ${String(nombre_completo).split(' ')[0]},</p>
        <p>Registramos tu aceptación del documento <strong>${titulo}</strong>, versión <strong>${doc.version}</strong>, con fecha ${new Date().toLocaleString('es-CL')}.</p>
        <p>Puedes consultar el texto vigente exacto en este enlace estable:</p>
        <p><a href="https://proxis-dev-admin.vercel.app/legal/${tipo}" style="color:#1a56c4">Ver ${titulo} (v${doc.version})</a></p>
        <p>Conserva este correo como comprobante de tu aceptación.</p>`,
    })
    copiaEnviada = true
  } catch { /* el envío es informativo; no bloquea el registro */ }

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

  const actorHash = sha256(asesor || org_usuario_id || institucion_id || email)
  // Ítem 14 — si es un supervisor, refrescar su marca de última aceptación.
  if (org_usuario_id) {
    await sb.from('org_usuarios').update({ ultima_aceptacion_at: new Date().toISOString(), acceso_bloqueado: false }).eq('id', org_usuario_id)
  }
  await logLegalEvent({
    event_type: 'TERMS_ACCEPTED', actor_type: 'USER', actor_id_hash: actorHash,
    affected_entity: 'USER_ACCOUNT', event_summary: `Aceptación de ${tipo} v${doc.version} (${plataforma})`,
    legal_reference: 'Ley 19.799', risk_level: 'LOW',
    metadata: { tipo, version: doc.version, plataforma, ip_hash: hashIp(req) },
  })
  if (copiaEnviada) {
    await logLegalEvent({
      event_type: 'TERMS_COPY_SENT', actor_type: 'SYSTEM', actor_id_hash: actorHash,
      affected_entity: 'USER_ACCOUNT', event_summary: `Copia de ${tipo} v${doc.version} enviada por email`,
      legal_reference: 'Ley 19.628', risk_level: 'LOW', metadata: { tipo, version: doc.version },
    })
  }
  return NextResponse.json({ ok: true, version: doc.version })
}
