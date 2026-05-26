'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Supervisor = {
  id: string; nombre: string; email: string | null
  activo: boolean; notas: string | null; created_at: string
}
type MetaRow = {
  asesor: string; supervisor: string | null
  contactos_semana: number | null; prospectos_mes: number | null; meta_ingresos: number | null
}
type PerfilRow = { asesor: string; nivel_riesgo: string | null; progresion_integrador: number | null }
type HipCount  = { asesor: string; pendientes: number }
type SignalRow = { asesor: string; created_at: string }

export default function SupervisoresPage() {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [metas,        setMetas]        = useState<MetaRow[]>([])
  const [perfiles,     setPerfiles]     = useState<PerfilRow[]>([])
  const [hipCounts,    setHipCounts]    = useState<Record<string, number>>({})
  const [lastSignal,   setLastSignal]   = useState<Record<string, string>>({})
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set())
  const [modal,        setModal]        = useState<'create' | 'edit' | null>(null)
  const [editing,      setEditing]      = useState<Supervisor | null>(null)
  const [form,         setForm]         = useState({ nombre: '', email: '', notas: '' })
  const [assignModal,  setAssignModal]  = useState<{ asesor: string; supActual: string | null } | null>(null)
  const [assignSup,    setAssignSup]    = useState('')
  const [toast,        setToast]        = useState<{ msg: string; err?: boolean } | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [supRes, metasRes, perfilRes, hipRes, sigRes] = await Promise.all([
      supabase.from('supervisores').select('*').order('nombre'),
      supabase.from('metas').select('asesor, supervisor, contactos_semana, prospectos_mes, meta_ingresos').order('asesor'),
      supabase.from('asesor_perfil').select('asesor, nivel_riesgo, progresion_integrador'),
      supabase.from('deductions_log').select('asesor').eq('estado', 'pendiente'),
      supabase.from('behavioral_signals').select('asesor, created_at').order('created_at', { ascending: false }).limit(500),
    ])

    setSupervisores(supRes.data ?? [])
    setMetas(metasRes.data ?? [])
    setPerfiles(perfilRes.data ?? [])

    // Contar hipótesis pendientes por asesor
    const counts: Record<string, number> = {}
    for (const h of (hipRes.data ?? [])) {
      counts[h.asesor] = (counts[h.asesor] ?? 0) + 1
    }
    setHipCounts(counts)

    // Última señal por asesor (primera aparición en lista ordenada desc)
    const latest: Record<string, string> = {}
    for (const s of (sigRes.data ?? [])) {
      if (!latest[s.asesor]) latest[s.asesor] = s.created_at
    }
    setLastSignal(latest)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function asesoresOf(supNombre: string) {
    return metas.filter(m => m.supervisor === supNombre)
  }

  const perfilMap = Object.fromEntries(perfiles.map(p => [p.asesor, p]))

  function riesgoColor(r: string | null | undefined) {
    if (r === 'critico')   return '#b03a3a'
    if (r === 'en_riesgo') return '#a8691a'
    return '#1f6f56'
  }
  function riesgoLabel(r: string | null | undefined) {
    if (r === 'critico')   return 'Crítico'
    if (r === 'en_riesgo') return 'En riesgo'
    return 'Activo'
  }

  function teamStats(equipo: MetaRow[]) {
    const criticos  = equipo.filter(e => perfilMap[e.asesor]?.nivel_riesgo === 'critico').length
    const enRiesgo  = equipo.filter(e => perfilMap[e.asesor]?.nivel_riesgo === 'en_riesgo').length
    const hipPend   = equipo.reduce((s, e) => s + (hipCounts[e.asesor] ?? 0), 0)
    const ultimaAct = equipo.reduce((latest, e) => {
      const d = lastSignal[e.asesor]
      return d && (!latest || d > latest) ? d : latest
    }, '' as string)
    return { criticos, enRiesgo, hipPend, ultimaAct }
  }

  const sinSupervisor = metas.filter(m => !m.supervisor || m.supervisor.trim() === '')

  // ── Acciones ────────────────────────────────────────────────────────────────

  async function crearSupervisor() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const { error } = await supabase.from('supervisores').insert({
      nombre: form.nombre.trim(),
      email:  form.email.trim() || null,
      notas:  form.notas.trim() || null,
    })
    setSaving(false)
    if (error) { showToast(error.message, true); return }
    showToast('Supervisor creado.')
    setModal(null)
    setForm({ nombre: '', email: '', notas: '' })
    load()
  }

  async function editarSupervisor() {
    if (!editing) return
    setSaving(true)
    const { error } = await supabase.from('supervisores').update({
      nombre: form.nombre.trim(),
      email:  form.email.trim() || null,
      notas:  form.notas.trim() || null,
    }).eq('id', editing.id)
    setSaving(false)
    if (error) { showToast(error.message, true); return }
    showToast('Supervisor actualizado.')
    setModal(null)
    setEditing(null)
    load()
  }

  async function toggleActivo(sup: Supervisor) {
    await supabase.from('supervisores').update({ activo: !sup.activo }).eq('id', sup.id)
    showToast(sup.activo ? 'Supervisor desactivado.' : 'Supervisor reactivado.')
    load()
  }

  async function asignarSupervisor() {
    if (!assignModal) return
    setSaving(true)
    await supabase.from('metas')
      .update({ supervisor: assignSup || null })
      .eq('asesor', assignModal.asesor)
    setSaving(false)
    showToast(`${assignModal.asesor} asignado a ${assignSup || 'Sin supervisor'}.`)
    setAssignModal(null)
    setAssignSup('')
    load()
  }

  function openEdit(sup: Supervisor) {
    setEditing(sup)
    setForm({ nombre: sup.nombre, email: sup.email ?? '', notas: sup.notas ?? '' })
    setModal('edit')
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const totalAsesores = metas.length
  const totalCriticos = perfiles.filter(p => p.nivel_riesgo === 'critico').length
  const totalEnRiesgo = perfiles.filter(p => p.nivel_riesgo === 'en_riesgo').length

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ChevLeft /> Panel admin
          </Link>
          <span style={{ color: '#c8c6c3' }}>/</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Supervisores</h1>
        </div>
        <button onClick={() => { setForm({ nombre: '', email: '', notas: '' }); setModal('create') }} style={{
          padding: '8px 18px', background: '#0b0a09', color: '#cbf135',
          border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          + Agregar supervisor
        </button>
      </div>

      {/* Resumen ejecutivo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Supervisores', value: supervisores.filter(s => s.activo).length, color: '#0b0a09' },
          { label: 'Asesores totales', value: totalAsesores, color: '#0b0a09' },
          { label: 'En riesgo', value: totalEnRiesgo, color: '#a8691a' },
          { label: 'Críticos', value: totalCriticos, color: '#b03a3a' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8a8885', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.04em' }}>{value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8a8885' }}>Cargando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Cards de supervisores ── */}
          {supervisores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8a8885', fontSize: 13 }}>
              Sin supervisores. Agrega el primero con el botón de arriba.
            </div>
          ) : supervisores.map(sup => {
            const equipo  = asesoresOf(sup.nombre)
            const stats   = teamStats(equipo)
            const isOpen  = expanded.has(sup.id)

            return (
              <div key={sup.id} style={{
                background: '#fff', border: '1px solid #e8e6e3', borderRadius: 14,
                opacity: sup.activo ? 1 : 0.55,
              }}>
                {/* Header de la card */}
                <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{sup.nombre}</span>
                      {!sup.activo && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f0ede8', color: '#8a8885' }}>Inactivo</span>}
                    </div>
                    {sup.email && <div style={{ fontSize: 12, color: '#8a8885' }}>{sup.email}</div>}
                    {sup.notas && <div style={{ fontSize: 11, color: '#8a8885', marginTop: 2, fontStyle: 'italic' }}>{sup.notas}</div>}
                  </div>

                  {/* Stats del equipo */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <Stat label="Asesores" value={equipo.length} />
                    <Stat label="En riesgo" value={stats.enRiesgo} color="#a8691a" />
                    <Stat label="Críticos"  value={stats.criticos} color="#b03a3a" />
                    <Stat label="Hipótesis pend." value={stats.hipPend} color={stats.hipPend > 0 ? '#1a56c4' : undefined} />
                    {stats.ultimaAct && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8885', marginBottom: 2 }}>Últ. señal</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0b0a09' }}>
                          {new Date(stats.ultimaAct).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => openEdit(sup)} style={btnSt('#0b0a09')}>Editar</button>
                    <button onClick={() => toggleActivo(sup)} style={btnSt(sup.activo ? '#8a8885' : '#1f6f56')}>
                      {sup.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => toggleExpand(sup.id)} style={{
                      ...btnSt('#0b0a09'),
                      background: isOpen ? '#0b0a0915' : 'transparent',
                    }}>
                      {isOpen ? '▲ Cerrar' : `▼ Equipo (${equipo.length})`}
                    </button>
                  </div>
                </div>

                {/* Equipo expandido */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f0ede8', padding: '14px 22px' }}>
                    {equipo.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#8a8885', padding: '8px 0' }}>
                        Sin asesores asignados. Usa el botón "Reasignar" en la sección "Sin supervisor" de abajo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {equipo.map(m => {
                          const pf = perfilMap[m.asesor]
                          const hip = hipCounts[m.asesor] ?? 0
                          const sig = lastSignal[m.asesor]
                          return (
                            <div key={m.asesor} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 14px', background: '#fafaf7', borderRadius: 10,
                            }}>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.asesor}</span>
                              {pf?.nivel_riesgo && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                  background: riesgoColor(pf.nivel_riesgo) + '18',
                                  color: riesgoColor(pf.nivel_riesgo),
                                }}>{riesgoLabel(pf.nivel_riesgo)}</span>
                              )}
                              {pf?.progresion_integrador != null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <div style={{ width: 40, height: 3, background: '#e8e6e3', borderRadius: 2 }}>
                                    <div style={{ width: `${pf.progresion_integrador}%`, height: '100%', background: '#1f6f56', borderRadius: 2 }} />
                                  </div>
                                  <span style={{ fontSize: 10, color: '#8a8885' }}>{pf.progresion_integrador}%</span>
                                </div>
                              )}
                              {hip > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#e8f0fd', color: '#1a56c4' }}>
                                  {hip} hipót.
                                </span>
                              )}
                              {sig && (
                                <span style={{ fontSize: 11, color: '#8a8885' }}>
                                  {new Date(sig).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                              <button
                                onClick={() => { setAssignModal({ asesor: m.asesor, supActual: m.supervisor }); setAssignSup(m.supervisor ?? '') }}
                                style={btnSt('#8a8885')}
                              >Reasignar</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Sin supervisor ── */}
          {sinSupervisor.length > 0 && (
            <div style={{ background: '#fff', border: '1px dashed #e8e6e3', borderRadius: 14, padding: '18px 22px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#8a8885', marginBottom: 12 }}>
                Sin supervisor asignado ({sinSupervisor.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sinSupervisor.map(m => {
                  const pf  = perfilMap[m.asesor]
                  const hip = hipCounts[m.asesor] ?? 0
                  return (
                    <div key={m.asesor} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', background: '#fafaf7', borderRadius: 10,
                    }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.asesor}</span>
                      {pf?.nivel_riesgo && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: riesgoColor(pf.nivel_riesgo) + '18',
                          color: riesgoColor(pf.nivel_riesgo),
                        }}>{riesgoLabel(pf.nivel_riesgo)}</span>
                      )}
                      {hip > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#e8f0fd', color: '#1a56c4' }}>
                          {hip} hipót.
                        </span>
                      )}
                      <button
                        onClick={() => { setAssignModal({ asesor: m.asesor, supActual: null }); setAssignSup('') }}
                        style={btnSt('#1f6f56')}
                      >Asignar supervisor</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Modal crear/editar supervisor ── */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => { setModal(null); setEditing(null) }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 18, padding: '28px 32px',
            width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, letterSpacing: '-0.03em' }}>
              {modal === 'create' ? 'Nuevo supervisor' : 'Editar supervisor'}
            </h2>
            <Field label="Nombre *" value={form.nombre} onChange={v => setForm(f => ({ ...f, nombre: v }))} placeholder="Nombre completo" />
            <Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="email@empresa.com" type="email" />
            <Field label="Notas" value={form.notas} onChange={v => setForm(f => ({ ...f, notas: v }))} placeholder="Rol, zona, equipo…" />
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => { setModal(null); setEditing(null) }} style={{
                flex: 1, padding: '11px', border: '1px solid #e8e6e3', borderRadius: 10,
                background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancelar</button>
              <button
                onClick={modal === 'create' ? crearSupervisor : editarSupervisor}
                disabled={saving || !form.nombre.trim()}
                style={{
                  flex: 2, padding: '11px', background: '#0b0a09', color: '#cbf135',
                  border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: saving || !form.nombre.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
                }}
              >{saving ? 'Guardando…' : modal === 'create' ? 'Crear supervisor' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal asignar supervisor ── */}
      {assignModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setAssignModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 18, padding: '28px 32px',
            width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.03em' }}>Asignar supervisor</h2>
            <p style={{ fontSize: 13, color: '#8a8885', marginBottom: 20 }}>{assignModal.asesor}</p>
            <label style={labelSt}>Supervisor</label>
            <select
              value={assignSup}
              onChange={e => setAssignSup(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8e6e3', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, outline: 'none', marginBottom: 20, background: '#fff' }}
            >
              <option value="">— Sin supervisor —</option>
              {supervisores.filter(s => s.activo).map(s => (
                <option key={s.id} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAssignModal(null)} style={{
                flex: 1, padding: '11px', border: '1px solid #e8e6e3', borderRadius: 10,
                background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancelar</button>
              <button onClick={asignarSupervisor} disabled={saving} style={{
                flex: 2, padding: '11px', background: '#0b0a09', color: '#cbf135',
                border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Guardando…' : 'Confirmar asignación'}</button>
            </div>
          </div>
        </div>
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

// ── Micro-componentes ─────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 52 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8885', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? '#0b0a09', letterSpacing: '-0.03em' }}>{value}</div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelSt}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8e6e3', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 6,
}
function btnSt(color: string): React.CSSProperties {
  return {
    padding: '5px 12px', border: `1px solid ${color}25`, borderRadius: 8,
    background: `${color}10`, color, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  }
}
