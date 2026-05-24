'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cuestionario = { id: string; nombre: string; tipo: string | null; descripcion: string | null; activo: boolean; created_at: string }
type Pregunta      = { id: string; cuestionario_id: string; orden: number; texto: string; tipo_respuesta: string | null; dimension_target: string | null; perfil_hint: string | null }
type Respuesta     = { id: string; asesor: string; cuestionario_id: string; pregunta_id: string; respuesta: string | null; created_at: string }
type TpsPerfil     = {
  id: string; asesor: string; perfil_base: string; confianza_diagnostico: string
  puntaje_a: number; puntaje_b: number; rasgos_comerciales: Record<string, number>
  backup_style_activo: boolean; deseabilidad_social: boolean; updated_at: string
}

const TIPOS_Q = ['psicometrico','micro','contextual','onboarding','programado']
const TIPOS_R = ['escala_4','escala_5','abierta','alternativas','si_no']
const DIMENSIONES = ['identidad_vendedora','relacion_prospeccion','modelos_mentales','relacion_feedback','perfil_conductual_notas','contexto_situacional']

const PERFIL_LABELS: Record<string, { icon: string; nombre: string; color: string }> = {
  E:   { icon: '🦅', nombre: 'Energético',  color: '#e8440a' },
  S:   { icon: '🦚', nombre: 'Sociable',    color: '#d4a017' },
  R:   { icon: '🕊️', nombre: 'Relacional',  color: '#1f6f56' },
  A:   { icon: '🦉', nombre: 'Reflexivo',   color: '#3a5da8' },
  AMB: { icon: '🔄', nombre: 'Ambivertido', color: '#6b45c8' },
}
const FACTOR_LABELS: Record<string, string> = {
  f1: 'Iniciativa', f2: 'Orient. Cliente', f3: 'Disciplina', f4: 'Estabilidad', f5: 'Aprendizaje',
}

type Tab = 'cuestionarios' | 'preguntas' | 'respuestas' | 'perfiles'

export default function CuestionariosPage() {
  const [tab,          setTab]         = useState<Tab>('cuestionarios')
  const [cuests,       setCuests]      = useState<Cuestionario[]>([])
  const [preguntas,    setPreguntas]   = useState<Pregunta[]>([])
  const [respuestas,   setRespuestas]  = useState<Respuesta[]>([])
  const [perfiles,     setPerfiles]    = useState<TpsPerfil[]>([])
  const [selCuest,     setSelCuest]    = useState<Cuestionario | null>(null)
  const [showModal,    setShowModal]   = useState(false)
  const [editId,       setEditId]      = useState<string | null>(null)
  const [form,         setForm]        = useState({ nombre: '', tipo: '', descripcion: '', activo: true })
  const [pForm,        setPForm]       = useState({ texto: '', tipo_respuesta: 'escala_4', dimension_target: '', perfil_hint: '' })
  const [showPModal,   setShowPModal]  = useState(false)
  const [saving,       setSaving]      = useState(false)
  const [toast,        setToast]       = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3200) }

  const loadCuests = useCallback(async () => {
    const { data } = await supabase.from('cuestionarios').select('*').order('created_at', { ascending: false })
    setCuests(data ?? [])
  }, [])

  const loadPerfiles = useCallback(async () => {
    const { data } = await supabase.from('tps_perfiles').select('*').order('updated_at', { ascending: false })
    setPerfiles(data ?? [])
  }, [])

  useEffect(() => { loadCuests() }, [loadCuests])

  useEffect(() => { if (tab === 'perfiles') loadPerfiles() }, [tab, loadPerfiles])

  async function loadPreguntas(cid: string) {
    const { data } = await supabase.from('preguntas').select('*').eq('cuestionario_id', cid).order('orden')
    setPreguntas(data ?? [])
  }

  async function loadRespuestas(cid: string) {
    const { data } = await supabase.from('respuestas_cuestionario').select('*').eq('cuestionario_id', cid).order('created_at', { ascending: false })
    setRespuestas(data ?? [])
  }

  function selectCuest(c: Cuestionario) {
    setSelCuest(c)
    loadPreguntas(c.id)
    loadRespuestas(c.id)
  }

  async function guardarCuest() {
    if (!form.nombre.trim()) { showToast('El nombre es obligatorio.', true); return }
    setSaving(true)
    const payload = { nombre: form.nombre.trim(), tipo: form.tipo || null, descripcion: form.descripcion || null, activo: form.activo }
    if (editId) {
      await supabase.from('cuestionarios').update(payload).eq('id', editId)
      showToast('Cuestionario actualizado.')
    } else {
      await supabase.from('cuestionarios').insert(payload)
      showToast('Cuestionario creado.')
    }
    setSaving(false); setShowModal(false); loadCuests()
  }

  async function toggleActivo(c: Cuestionario) {
    await supabase.from('cuestionarios').update({ activo: !c.activo }).eq('id', c.id)
    loadCuests()
  }

  async function eliminarCuest(id: string) {
    if (!confirm('¿Eliminar cuestionario y todas sus preguntas?')) return
    await supabase.from('cuestionarios').delete().eq('id', id)
    if (selCuest?.id === id) setSelCuest(null)
    showToast('Eliminado.')
    loadCuests()
  }

  async function guardarPregunta() {
    if (!pForm.texto.trim() || !selCuest) return
    setSaving(true)
    const maxOrden = preguntas.length ? Math.max(...preguntas.map(p => p.orden)) : 0
    await supabase.from('preguntas').insert({
      cuestionario_id: selCuest.id,
      orden: maxOrden + 1,
      texto: pForm.texto.trim(),
      tipo_respuesta: pForm.tipo_respuesta || null,
      dimension_target: pForm.dimension_target || null,
      perfil_hint: pForm.perfil_hint || null,
    })
    setSaving(false); setShowPModal(false); setPForm({ texto: '', tipo_respuesta: 'escala_4', dimension_target: '', perfil_hint: '' })
    loadPreguntas(selCuest.id)
    showToast('Pregunta agregada.')
  }

  async function eliminarPregunta(id: string) {
    if (!confirm('¿Eliminar esta pregunta?')) return
    await supabase.from('preguntas').delete().eq('id', id)
    if (selCuest) loadPreguntas(selCuest.id)
  }

  const byAsesor = (() => {
    const map: Record<string, number> = {}
    for (const r of respuestas) {
      map[r.asesor] = (map[r.asesor] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  })()

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ChevLeft /> Panel admin
          </Link>
          <span style={{ color: '#c8c6c3' }}>/</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Cuestionarios</h1>
        </div>
        <button onClick={() => { setEditId(null); setForm({ nombre: '', tipo: '', descripcion: '', activo: true }); setShowModal(true) }}
          style={{ padding: '9px 16px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Nuevo cuestionario
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e8e6e3' }}>
        {[['cuestionarios','Cuestionarios'],['preguntas','Banco de preguntas'],['respuestas','Respuestas'],['perfiles','Perfiles TPS']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as Tab)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: tab === k ? 700 : 400,
            color: tab === k ? '#0b0a09' : '#8a8885', background: 'none',
            borderBottom: `2px solid ${tab === k ? '#cbf135' : 'transparent'}`, marginBottom: -1,
          }}>{l}</button>
        ))}
      </div>

      {tab === 'cuestionarios' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
          {/* List */}
          <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
            {cuests.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8a8885', fontSize: 13 }}>Sin cuestionarios aún.</div>
            ) : cuests.map(c => (
              <div key={c.id} onClick={() => selectCuest(c)} style={{
                padding: '14px 18px', borderBottom: '1px solid #f5f3ef',
                cursor: 'pointer', background: selCuest?.id === c.id ? '#f5f3ef' : '#fff',
                transition: 'background 0.1s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{c.nombre}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: c.activo ? '#e6f3ed' : '#f0ede8', color: c.activo ? '#1f6f56' : '#8a8885' }}>
                    {c.activo ? 'Activo' : 'Pausado'}
                  </span>
                </div>
                {c.tipo && <div style={{ fontSize: 11, color: '#8a8885', marginTop: 2 }}>{c.tipo}</div>}
              </div>
            ))}
          </div>

          {/* Detail */}
          {selCuest ? (
            <div>
              <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selCuest.nombre}</div>
                    {selCuest.descripcion && <div style={{ fontSize: 12, color: '#8a8885', marginTop: 2 }}>{selCuest.descripcion}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <SmBtn onClick={() => toggleActivo(selCuest)}>{selCuest.activo ? 'Pausar' : 'Activar'}</SmBtn>
                    <SmBtn onClick={() => { setEditId(selCuest.id); setForm({ nombre: selCuest.nombre, tipo: selCuest.tipo ?? '', descripcion: selCuest.descripcion ?? '', activo: selCuest.activo }); setShowModal(true) }}>Editar</SmBtn>
                    <SmBtn onClick={() => eliminarCuest(selCuest.id)} danger>Eliminar</SmBtn>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#8a8885' }}>{preguntas.length} preguntas</span>
                  <button onClick={() => setShowPModal(true)} style={{ padding: '6px 14px', background: '#f5f3ef', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Agregar pregunta
                  </button>
                </div>
              </div>

              {/* Preguntas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {preguntas.map((p, i) => (
                  <div key={p.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12, color: '#8a8885', flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#0b0a09', marginBottom: 4 }}>{p.texto}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {p.tipo_respuesta && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#f5f3ef', color: '#4a4844', border: '1px solid #e8e6e3' }}>{p.tipo_respuesta}</span>}
                        {p.dimension_target && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#e6f3ed', color: '#1f6f56', border: '1px solid #e6f3ed' }}>{p.dimension_target}</span>}
                        {p.perfil_hint && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#f8ecd6', color: '#a8691a', border: '1px solid #f8ecd6' }}>{p.perfil_hint}</span>}
                      </div>
                    </div>
                    <button onClick={() => eliminarPregunta(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#b03a3a', flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885' }}>
              Selecciona un cuestionario para ver sus preguntas.
            </div>
          )}
        </div>
      )}

      {tab === 'preguntas' && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885' }}>
          Selecciona un cuestionario en la pestaña anterior para gestionar sus preguntas.
        </div>
      )}

      {tab === 'respuestas' && (
        <div>
          {!selCuest ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885' }}>
              Selecciona un cuestionario para ver las respuestas.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16, fontSize: 13, color: '#4a4844' }}>
                Respuestas para: <strong>{selCuest.nombre}</strong> — {respuestas.length} total
              </div>
              {byAsesor.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {byAsesor.map(([asesor, count]) => (
                    <div key={asesor} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                      <strong>{asesor.split(' ')[0]}</strong> — {count} resp.
                    </div>
                  ))}
                </div>
              )}
              {respuestas.slice(0, 50).map(r => (
                <div key={r.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{r.asesor.split(' ')[0]}</div>
                  <div style={{ flex: 1, fontSize: 13, color: '#0b0a09' }}>{r.respuesta || '—'}</div>
                  <div style={{ fontSize: 11, color: '#8a8885', flexShrink: 0 }}>
                    {new Date(r.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Modal cuestionario */}
      {showModal && (
        <div onClick={ev => { if (ev.target === ev.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>{editId ? 'Editar cuestionario' : 'Nuevo cuestionario'}</h2>
            <FField label="Nombre *"><input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={inputStyle} /></FField>
            <FField label="Tipo">
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                <option value="">—</option>
                {TIPOS_Q.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FField>
            <FField label="Descripción">
              <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </FField>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
              <span style={{ fontSize: 13 }}>Activo</span>
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 18px', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: '#fff' }}>Cancelar</button>
              <button onClick={guardarCuest} disabled={saving} style={{ padding: '10px 18px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pregunta */}
      {showPModal && (
        <div onClick={ev => { if (ev.target === ev.currentTarget) setShowPModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 520 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>Agregar pregunta</h2>
            <FField label="Texto de la pregunta *">
              <textarea value={pForm.texto} onChange={e => setPForm(f => ({ ...f, texto: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="¿Cómo te sientes cuando debes iniciar contacto con un prospecto nuevo?" />
            </FField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <FField label="Tipo de respuesta">
                <select value={pForm.tipo_respuesta} onChange={e => setPForm(f => ({ ...f, tipo_respuesta: e.target.value }))} style={inputStyle}>
                  {TIPOS_R.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FField>
              <FField label="Dimensión que mide">
                <select value={pForm.dimension_target} onChange={e => setPForm(f => ({ ...f, dimension_target: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>
                  {DIMENSIONES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </FField>
              <FField label="Perfil hint">
                <select value={pForm.perfil_hint} onChange={e => setPForm(f => ({ ...f, perfil_hint: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>
                  {['E','S','R','A'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </FField>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setShowPModal(false)} style={{ padding: '10px 18px', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: '#fff' }}>Cancelar</button>
              <button onClick={guardarPregunta} disabled={saving} style={{ padding: '10px 18px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'perfiles' && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: '#4a4844' }}>
            Perfiles TPS calculados — <strong>{perfiles.length}</strong> asesores evaluados
          </div>
          {perfiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885' }}>
              Ningún asesor ha completado la evaluación TPS aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {perfiles.map(p => {
                const info = PERFIL_LABELS[p.perfil_base] ?? PERFIL_LABELS['AMB']
                const conf = p.confianza_diagnostico
                const confColor = conf === 'Alta' ? '#1f6f56' : conf === 'Media' ? '#a8691a' : '#8a8885'
                return (
                  <div key={p.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 28 }}>{info.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{p.asesor}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                            background: `${info.color}18`, color: info.color, border: `1px solid ${info.color}40` }}>
                            {info.nombre}
                          </span>
                          <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20,
                            background: `${confColor}15`, color: confColor, border: `1px solid ${confColor}35` }}>
                            {conf}
                          </span>
                          {p.backup_style_activo && (
                            <span title="Backup Style activo" style={{ fontSize: 12, padding: '2px 9px', borderRadius: 20,
                              background: '#fff3cd', color: '#a8691a', border: '1px solid #f5c518' }}>
                              ⚠️ Backup
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#8a8885', marginTop: 3 }}>
                          A: {p.puntaje_a?.toFixed(2)} · B: {p.puntaje_b?.toFixed(2)} ·{' '}
                          {new Date(p.updated_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    {p.rasgos_comerciales && Object.keys(p.rasgos_comerciales).length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.entries(p.rasgos_comerciales).map(([k, v]) => (
                          <div key={k} style={{ background: '#f5f3ef', borderRadius: 8, padding: '5px 10px', fontSize: 11 }}>
                            <span style={{ color: '#8a8885' }}>{FACTOR_LABELS[k] ?? k}</span>
                            <span style={{ fontWeight: 700, color: v >= 20 ? '#1f6f56' : v >= 15 ? '#0b0a09' : '#b03a3a', marginLeft: 5 }}>{v}/25</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.err ? '#b03a3a' : '#0b0a09', color: '#fff', fontSize: 13, fontWeight: 500, padding: '10px 22px', borderRadius: 30, zIndex: 999 }}>{toast.msg}</div>
      )}
    </div>
  )
}

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}
function SmBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} style={{ padding: '6px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: danger ? '#fbe9e9' : '#fff', color: danger ? '#b03a3a' : '#4a4844' }}>{children}</button>
}
function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none' }
