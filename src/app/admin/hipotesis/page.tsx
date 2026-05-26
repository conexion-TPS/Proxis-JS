'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Hipotesis = {
  id: string; asesor: string; dimension_afectada: string | null
  hipotesis: string; confianza: number | null; valor_sugerido: string | null
  evidencia: string | null
  estado: 'pendiente' | 'validada' | 'rechazada' | 'editada'
  correccion: string | null; created_at: string; reviewed_at: string | null
  accion_tipo: 'trigger' | 'ajuste_dimension' | 'escalar_supervisor' | 'ninguna' | null
  accion_descripcion: string | null
  accion_ejecutada: boolean
  accion_ejecutada_at: string | null
}
type Proposal = {
  id: string; gap_id: string | null; asesor: string | null
  titulo: string | null; contenido: string; perfil: string | null
  categoria: string | null; etapa_ciclo: string | null
  completitud: number | null; regla_inferencia: string | null
  accion_correctiva: string | null; justificacion: string | null
  estado: string; created_at: string
}
type Gap = {
  id: string; asesor: string | null; dimension: string | null
  descripcion: string; prioridad: number | null; estado: string
  created_at: string
}
type RiesgoRow = { asesor: string; nivel_riesgo: string | null; nivel_riesgo_nota: string | null; nivel_riesgo_at: string | null }

type Tab = 'pendientes' | 'historial' | 'propuestas' | 'vacios'

const ACCION_LABEL: Record<string, string> = {
  trigger:             'Trigger',
  ajuste_dimension:    'Ajuste perfil',
  escalar_supervisor:  'Escalar supervisor',
  ninguna:             'Sin acción',
}
const ACCION_COLOR: Record<string, { bg: string; color: string }> = {
  trigger:            { bg: '#e8f0fd', color: '#1a56c4' },
  ajuste_dimension:   { bg: '#e6f3ed', color: '#1f6f56' },
  escalar_supervisor: { bg: '#f8ecd6', color: '#a8691a' },
  ninguna:            { bg: '#f0ede8', color: '#8a8885' },
}
const RIESGO_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  activo:    { bg: '#e6f3ed', color: '#1f6f56', label: 'Activo' },
  en_riesgo: { bg: '#f8ecd6', color: '#a8691a', label: 'En riesgo' },
  critico:   { bg: '#fbe9e9', color: '#b03a3a', label: 'Crítico' },
}

export default function HipotesisPage() {
  const [tab, setTab]             = useState<Tab>('pendientes')
  const [hipotesis, setHipotesis] = useState<Hipotesis[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [gaps,      setGaps]      = useState<Gap[]>([])
  const [riesgos,   setRiesgos]   = useState<RiesgoRow[]>([])
  const [editing,   setEditing]   = useState<{ id: string; text: string } | null>(null)
  const [toast,     setToast]     = useState<{ msg: string; err?: boolean } | null>(null)
  const [loading,   setLoading]   = useState(true)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [h, p, g, r] = await Promise.all([
      supabase.from('deductions_log').select('*').order('confianza', { ascending: false }),
      supabase.from('knowledge_proposals').select('*').order('created_at', { ascending: false }),
      supabase.from('knowledge_gaps').select('*').order('prioridad', { ascending: false }),
      supabase.from('asesor_perfil').select('asesor, nivel_riesgo, nivel_riesgo_nota, nivel_riesgo_at').not('nivel_riesgo', 'is', null),
    ])
    setHipotesis(h.data ?? [])
    setProposals(p.data ?? [])
    setGaps(g.data ?? [])
    setRiesgos(r.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function validar(h: Hipotesis) {
    const texto = editing?.id === h.id ? editing.text : h.hipotesis
    await supabase.from('deductions_log').update({
      estado: editing?.id === h.id ? 'editada' : 'validada',
      correccion: editing?.id === h.id ? texto : null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', h.id)

    if (h.dimension_afectada) {
      const campo = dimensionToColumn(h.dimension_afectada)
      if (campo) {
        await supabase.from('asesor_perfil').upsert({
          asesor: h.asesor,
          [campo]: texto,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'asesor' })
      }
    }
    showToast('Hipótesis validada y perfil actualizado.')
    setEditing(null)
    load()
  }

  async function rechazar(id: string) {
    await supabase.from('deductions_log').update({ estado: 'rechazada', reviewed_at: new Date().toISOString() }).eq('id', id)
    showToast('Hipótesis rechazada.')
    load()
  }

  async function ejecutarAccion(h: Hipotesis) {
    const now = new Date().toISOString()
    await supabase.from('deductions_log').update({
      accion_ejecutada: true,
      accion_ejecutada_at: now,
    }).eq('id', h.id)

    if (h.accion_tipo === 'ajuste_dimension' && h.dimension_afectada && h.valor_sugerido) {
      const campo = dimensionToColumn(h.dimension_afectada)
      if (campo) {
        await supabase.from('asesor_perfil').upsert({
          asesor: h.asesor,
          [campo]: h.valor_sugerido,
          updated_at: now,
        }, { onConflict: 'asesor' })
      }
    }

    const label = ACCION_LABEL[h.accion_tipo ?? 'ninguna'] ?? 'Acción'
    showToast(`${label} marcada como ejecutada. Pendiente validación humana.`)
    load()
  }

  async function aprobarPropuesta(p: Proposal) {
    await supabase.from('knowledge_base_conductual').insert({
      titulo:            p.titulo ?? '(sin título)',
      contenido:         p.contenido,
      perfil:            p.perfil ?? 'GEN',
      categoria:         p.categoria ?? 'otro',
      etapa_ciclo:       p.etapa_ciclo ?? null,
      completitud:       p.completitud ?? 60,
      regla_inferencia:  p.regla_inferencia ?? null,
      accion_correctiva: p.accion_correctiva ?? null,
    })
    await supabase.from('knowledge_proposals').update({ estado: 'aprobada', reviewed_at: new Date().toISOString() }).eq('id', p.id)
    if (p.gap_id) {
      await supabase.from('knowledge_gaps').update({ estado: 'cubierto' }).eq('id', p.gap_id)
    }
    showToast('Propuesta aprobada e incorporada a la base conductual.')
    load()
  }

  async function rechazarPropuesta(id: string) {
    await supabase.from('knowledge_proposals').update({ estado: 'rechazada', reviewed_at: new Date().toISOString() }).eq('id', id)
    showToast('Propuesta rechazada.')
    load()
  }

  async function investigarGap(id: string) {
    await supabase.from('knowledge_gaps').update({ estado: 'en_investigacion' }).eq('id', id)
    showToast('Investigando con IA… esto puede tardar unos segundos.')
    try {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const res = await fetch(`${sbUrl}/functions/v1/proxis-researcher?gap_id=${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      })
      const result = await res.json()
      if (result.successful > 0) {
        showToast('Propuesta generada. Revisa la pestaña Propuestas IA.')
      } else {
        showToast('Gap marcado. El motor lo procesará en el próximo ciclo.')
      }
    } catch {
      showToast('Gap marcado. El motor lo procesará en el próximo ciclo.')
    }
    load()
  }

  const pending   = hipotesis.filter(h => h.estado === 'pendiente')
  const historial = hipotesis.filter(h => h.estado !== 'pendiente')
  const propPend  = proposals.filter(p => p.estado === 'pendiente')
  const gapsPend  = gaps.filter(g => g.estado !== 'cubierto')

  const criticos   = riesgos.filter(r => r.nivel_riesgo === 'critico')
  const enRiesgo   = riesgos.filter(r => r.nivel_riesgo === 'en_riesgo')

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'pendientes',  label: 'Hipótesis pendientes', count: pending.length },
    { key: 'historial',   label: 'Historial' },
    { key: 'propuestas',  label: 'Propuestas IA',        count: propPend.length },
    { key: 'vacios',      label: 'Vacíos',               count: gapsPend.length },
  ]

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Hipótesis IA</h1>
      </div>

      {/* Riesgo summary bar */}
      {riesgos.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {criticos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 14px', background: '#fbe9e9', borderRadius: 10, border: '1px solid #f5c6c6' }}>
              <span style={{ fontSize: 14 }}>🔴</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#b03a3a' }}>{criticos.length} crítico{criticos.length > 1 ? 's' : ''}</span>
              <span style={{ fontSize: 11, color: '#b03a3a', opacity: 0.8 }}>{criticos.map(r => r.asesor.split(' ')[0]).join(', ')}</span>
            </div>
          )}
          {enRiesgo.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 14px', background: '#f8ecd6', borderRadius: 10, border: '1px solid #f0d49a' }}>
              <span style={{ fontSize: 14 }}>🟡</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#a8691a' }}>{enRiesgo.length} en riesgo</span>
              <span style={{ fontSize: 11, color: '#a8691a', opacity: 0.8 }}>{enRiesgo.map(r => r.asesor.split(' ')[0]).join(', ')}</span>
            </div>
          )}
          {riesgos.filter(r => r.nivel_riesgo === 'activo').length > 0 && (
            <div style={{ padding: '8px 14px', background: '#e6f3ed', borderRadius: 10, border: '1px solid #b3dfc9' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1f6f56' }}>
                {riesgos.filter(r => r.nivel_riesgo === 'activo').length} activos
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e8e6e3' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? '#0b0a09' : '#8a8885',
            background: 'none',
            borderBottom: `2px solid ${tab === t.key ? '#cbf135' : 'transparent'}`,
            marginBottom: -1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{
                background: '#cbf135', color: '#0b0a09',
                borderRadius: 20, fontSize: 10, fontWeight: 800,
                padding: '1px 7px',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8a8885' }}>Cargando…</div>
      ) : (
        <>
          {/* ── PENDIENTES ── */}
          {tab === 'pendientes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pending.length === 0 ? (
                <Empty>Sin hipótesis pendientes de revisión.</Empty>
              ) : pending.map(h => (
                <div key={h.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{h.asesor}</span>
                        {h.dimension_afectada && <DimBadge>{h.dimension_afectada}</DimBadge>}
                        {h.confianza !== null && <ConfBar value={h.confianza} />}
                      </div>
                      {editing?.id === h.id ? (
                        <textarea
                          value={editing.text}
                          onChange={e => setEditing({ id: h.id, text: e.target.value })}
                          rows={4}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbf135', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none' }}
                        />
                      ) : (
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#0b0a09', marginBottom: 8 }}>{h.hipotesis}</p>
                      )}
                      {h.evidencia && (
                        <p style={{ fontSize: 11, color: '#8a8885', fontStyle: 'italic', marginBottom: 8 }}>
                          Evidencia: {h.evidencia}
                        </p>
                      )}

                      {/* Acción propuesta */}
                      {h.accion_tipo && h.accion_tipo !== 'ninguna' && (
                        <div style={{
                          marginTop: 10, padding: '10px 14px', borderRadius: 8,
                          background: ACCION_COLOR[h.accion_tipo]?.bg ?? '#f5f3ef',
                          border: `1px solid ${ACCION_COLOR[h.accion_tipo]?.color ?? '#e8e6e3'}30`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                              background: ACCION_COLOR[h.accion_tipo]?.color ?? '#8a8885',
                              color: '#fff',
                            }}>
                              {ACCION_LABEL[h.accion_tipo] ?? h.accion_tipo}
                            </span>
                            <span style={{ fontSize: 11, color: '#4a4844', fontWeight: 600 }}>Acción propuesta por IA</span>
                            {h.accion_ejecutada && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#e6f3ed', color: '#1f6f56' }}>
                                Ejecutada
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: '#2b2926', lineHeight: 1.5, margin: 0 }}>
                            {h.accion_descripcion ?? '—'}
                          </p>
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: '#8a8885', marginTop: 8 }}>
                        {new Date(h.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {editing?.id === h.id ? (
                        <>
                          <ActionBtn onClick={() => validar(h)} color="#1f6f56">Validar con edición</ActionBtn>
                          <ActionBtn onClick={() => setEditing(null)} color="#8a8885">Cancelar</ActionBtn>
                        </>
                      ) : (
                        <>
                          <ActionBtn onClick={() => validar(h)} color="#1f6f56">Validar</ActionBtn>
                          <ActionBtn onClick={() => setEditing({ id: h.id, text: h.hipotesis })} color="#a8691a">Editar</ActionBtn>
                          <ActionBtn onClick={() => rechazar(h.id)} color="#b03a3a">Rechazar</ActionBtn>
                          {h.accion_tipo && h.accion_tipo !== 'ninguna' && !h.accion_ejecutada && (
                            <ActionBtn onClick={() => ejecutarAccion(h)} color="#1a56c4">Ejecutar acción</ActionBtn>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── HISTORIAL ── */}
          {tab === 'historial' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {historial.length === 0 ? (
                <Empty>Sin hipótesis revisadas aún.</Empty>
              ) : historial.map(h => (
                <div key={h.id} style={{
                  background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '14px 20px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <EstadoBadge estado={h.estado} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{h.asesor}</span>
                      {h.dimension_afectada && <DimBadge>{h.dimension_afectada}</DimBadge>}
                      {h.accion_tipo && h.accion_tipo !== 'ninguna' && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: ACCION_COLOR[h.accion_tipo]?.bg ?? '#f5f3ef',
                          color: ACCION_COLOR[h.accion_tipo]?.color ?? '#4a4844',
                        }}>{ACCION_LABEL[h.accion_tipo]}{h.accion_ejecutada ? ' ✓' : ''}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#4a4844', lineHeight: 1.5 }}>{h.correccion ?? h.hipotesis}</p>
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8885', whiteSpace: 'nowrap' }}>
                    {h.reviewed_at ? new Date(h.reviewed_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── PROPUESTAS ── */}
          {tab === 'propuestas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {proposals.length === 0 ? (
                <Empty>Sin propuestas de conocimiento pendientes.</Empty>
              ) : proposals.map(p => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        {p.categoria && <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: '#f5f3ef', color: '#4a4844',
                        }}>{p.categoria}</span>}
                        {p.perfil && <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: '#e6f3ed', color: '#1f6f56',
                        }}>{p.perfil}</span>}
                        {p.completitud !== null && <ConfBar value={p.completitud} />}
                        {p.estado !== 'pendiente' && <EstadoBadge estado={p.estado as Hipotesis['estado']} />}
                      </div>
                      {p.titulo && <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{p.titulo}</div>}
                      <p style={{ fontSize: 13, lineHeight: 1.65, color: '#0b0a09', marginBottom: 8 }}>{p.contenido}</p>
                      {p.justificacion && (
                        <p style={{ fontSize: 11, color: '#8a8885', fontStyle: 'italic' }}>Justificación: {p.justificacion}</p>
                      )}
                    </div>
                    {p.estado === 'pendiente' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <ActionBtn onClick={() => aprobarPropuesta(p)} color="#1f6f56">Aprobar</ActionBtn>
                        <ActionBtn onClick={() => rechazarPropuesta(p.id)} color="#b03a3a">Rechazar</ActionBtn>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── VACÍOS ── */}
          {tab === 'vacios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gaps.length === 0 ? (
                <Empty>Sin vacíos de conocimiento detectados.</Empty>
              ) : gaps.map(g => (
                <div key={g.id} style={{
                  background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '14px 20px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                    background: g.prioridad && g.prioridad >= 4 ? '#b03a3a' : g.prioridad === 3 ? '#a8691a' : '#8a8885',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      {g.dimension && <DimBadge>{g.dimension}</DimBadge>}
                      {g.asesor && <DimBadge>{g.asesor.split(' ')[0]}</DimBadge>}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: g.estado === 'cubierto' ? '#e6f3ed' : g.estado === 'en_investigacion' ? '#f8ecd6' : '#f0ede8',
                        color: g.estado === 'cubierto' ? '#1f6f56' : g.estado === 'en_investigacion' ? '#a8691a' : '#8a8885',
                      }}>{g.estado}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#0b0a09' }}>{g.descripcion}</p>
                  </div>
                  {g.estado === 'detectado' && (
                    <ActionBtn onClick={() => investigarGap(g.id)} color="#0b0a09">Investigar</ActionBtn>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.err ? '#b03a3a' : '#0b0a09', color: '#fff',
          fontSize: 13, fontWeight: 500, padding: '10px 22px', borderRadius: 30, zIndex: 999,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

function dimensionToColumn(dim: string): string | null {
  const map: Record<string, string> = {
    'identidad_vendedora':    'identidad_vendedora',
    'relacion_prospeccion':   'relacion_prospeccion',
    'modelos_mentales':       'modelos_mentales',
    'relacion_feedback':      'relacion_feedback',
    'perfil_conductual_notas':'perfil_conductual_notas',
    'contexto_situacional':   'contexto_situacional',
  }
  return map[dim] ?? null
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a8885', fontSize: 13 }}>{children}</div>
}
function DimBadge({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f5f3ef', color: '#4a4844', border: '1px solid #e8e6e3' }}>{children}</span>
}
function ConfBar({ value }: { value: number }) {
  const color = value >= 70 ? '#1f6f56' : value >= 40 ? '#a8691a' : '#b03a3a'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: '#f5f3ef', borderRadius: 2 }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 700 }}>{value}%</span>
    </div>
  )
}
function EstadoBadge({ estado }: { estado: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    validada:  { bg: '#e6f3ed', color: '#1f6f56' },
    rechazada: { bg: '#fbe9e9', color: '#b03a3a' },
    editada:   { bg: '#f8ecd6', color: '#a8691a' },
    aprobada:  { bg: '#e6f3ed', color: '#1f6f56' },
    pendiente: { bg: '#f0ede8', color: '#8a8885' },
  }
  const s = cfg[estado] ?? cfg.pendiente
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>{estado}</span>
}
function ActionBtn({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', border: `1px solid ${color}20`, borderRadius: 8,
      background: `${color}10`, color, fontSize: 12, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}
function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
