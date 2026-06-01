import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/* Módulo D — Registro de consentimientos de uso secundario.
   Estado vigente por (asesor, opción) = último evento de consentimiento_historial.
   Devuelve además el historial completo para la línea de tiempo por usuario. */
export async function GET() {
  const sb = supabaseAdmin()
  const { data: hist, error } = await sb
    .from('consentimiento_historial')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventos = hist ?? []
  // Estado vigente por asesor+opción (el más reciente gana, ya vienen ordenados desc)
  const vigentes = new Map<string, Record<string, unknown>>()
  for (const e of eventos) {
    const k = `${e.asesor ?? e.email}|${e.opcion}`
    if (!vigentes.has(k)) vigentes.set(k, e)
  }

  // Agrupar por usuario para la tabla
  const porUsuario = new Map<string, { asesor: string | null; email: string | null; A: string; B: string; ultimo: string }>()
  for (const e of vigentes.values()) {
    const uk = (e.asesor as string) ?? (e.email as string) ?? '—'
    const u = porUsuario.get(uk) ?? { asesor: (e.asesor as string) ?? null, email: (e.email as string) ?? null, A: 'no_otorgado', B: 'no_otorgado', ultimo: e.created_at as string }
    if (e.opcion === 'A') u.A = e.estado as string
    if (e.opcion === 'B') u.B = e.estado as string
    if ((e.created_at as string) > u.ultimo) u.ultimo = e.created_at as string
    porUsuario.set(uk, u)
  }

  return NextResponse.json({
    usuarios: Array.from(porUsuario.values()),
    historial: eventos,
    total_eventos: eventos.length,
  })
}
