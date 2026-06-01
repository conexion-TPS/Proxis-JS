import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/* Módulo C — Generador de informes para organismos contralores (APDP).
   Devuelve los datos estructurados + un checklist de contenido mínimo legal.
   El render a PDF se hace en el cliente (impresión); también se ofrece JSON. */

const RESPONSABLE = { nombre: 'Futura Soluciones Digitales Limitada', rut: '77.662.922-7' }

const SUBENCARGADOS = [
  { subencargado: 'Supabase', funcion: 'Base de datos e infraestructura', region: 'Estados Unidos (AWS us-west-1)', garantia: 'DPA + cláusulas contractuales tipo (SCC)' },
  { subencargado: 'Vercel', funcion: 'Alojamiento y despliegue', region: 'Estados Unidos (iad1)', garantia: 'DPA + cláusulas contractuales tipo (SCC)' },
  { subencargado: 'Google (Gemini API)', funcion: 'Generación de mensajes con IA', region: 'Estados Unidos (infraestructura global de Google)', garantia: 'DPA Google + SCC; modo sin entrenamiento con datos del cliente' },
  { subencargado: 'Resend', funcion: 'Envío de correos', region: 'Estados Unidos (AWS us-east-1)', garantia: 'DPA + cláusulas contractuales tipo (SCC)' },
]

const CHECKLISTS: Record<string, string[]> = {
  arcop: ['Listado de solicitudes', 'Tipo de derecho', 'Fecha de recepción y fecha límite', 'Estado de resolución', 'Prórrogas documentadas'],
  anonimizaciones: ['Identificador de evento (hash)', 'Fecha y hora UTC', 'Acción ejecutada', 'Tablas afectadas', 'Estado y checksum'],
  consentimientos: ['Usuario', 'Opción otorgada/revocada', 'Fecha y hora', 'Versión del texto', 'Canal'],
  brechas: ['Fecha de detección', 'Fecha de notificación a APDP', 'Categorías de datos', 'Titulares afectados', 'Medidas adoptadas'],
  subencargados: ['Subencargado', 'Función', 'Región de tratamiento', 'Garantía de transferencia'],
}

const FUENTE: Record<string, { tabla: string; cols: string; fecha: string }> = {
  arcop:           { tabla: 'derechos_solicitudes',     cols: 'derecho,tipo,estado,email,nombre_completo,created_at,fecha_limite,prorroga_motivo,resuelto_at', fecha: 'created_at' },
  anonimizaciones: { tabla: 'anonymization_audit_log',  cols: 'event_hash,event_timestamp,action_type,tables_affected,records_processed,process_status,verification_checksum', fecha: 'event_timestamp' },
  consentimientos: { tabla: 'consentimiento_historial', cols: 'asesor,email,opcion,estado,version_texto,canal,created_at', fecha: 'created_at' },
  brechas:         { tabla: 'seguridad_brechas',        cols: 'deteccion_at,descripcion,categorias_datos,n_afectados,estado,notificado_apdp_at,notificado_titulares_at,medidas', fecha: 'deteccion_at' },
}

export async function GET(req: NextRequest) {
  const sb = supabaseAdmin()
  const tipo  = req.nextUrl.searchParams.get('tipo') ?? 'arcop'
  const desde = req.nextUrl.searchParams.get('desde')
  const hasta = req.nextUrl.searchParams.get('hasta')

  let registros: unknown[] = []
  if (tipo === 'subencargados') {
    registros = SUBENCARGADOS
  } else if (FUENTE[tipo]) {
    const f = FUENTE[tipo]
    let q = sb.from(f.tabla).select(f.cols).order(f.fecha, { ascending: false })
    if (desde) q = q.gte(f.fecha, desde)
    if (hasta) q = q.lte(f.fecha, hasta + 'T23:59:59')
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    registros = data ?? []
  } else {
    return NextResponse.json({ error: 'tipo de informe inválido' }, { status: 400 })
  }

  return NextResponse.json({
    tipo,
    responsable: RESPONSABLE,
    rango: { desde: desde ?? null, hasta: hasta ?? null },
    generado_at: new Date().toISOString(),
    checklist: CHECKLISTS[tipo] ?? [],
    registros,
    total: registros.length,
  })
}
