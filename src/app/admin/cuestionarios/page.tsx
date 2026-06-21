'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cuestionario = { id: string; nombre: string; tipo: string | null; descripcion: string | null; activo: boolean; created_at: string }
type Pregunta      = { id: string; cuestionario_id: string; orden: number; texto: string; tipo_respuesta: string | null; dimension_target: string | null; perfil_hint: string | null }
type Respuesta     = { id: string; asesor: string; cuestionario_id: string; pregunta_id: string; respuesta: string | null; created_at: string }
type OrgNodo      = { id: string; nombre: string }
type AsesorCred   = { asesor: string; org_nodo_id: string | null }
type TpsPerfil     = {
  id: string; asesor: string; perfil_base: string; confianza_diagnostico: string
  puntaje_a: number; puntaje_b: number; rasgos_comerciales: Record<string, number>
  deseabilidad_social: boolean; updated_at: string
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

type Tab = 'cuestionarios' | 'preguntas' | 'respuestas' | 'perfiles' | 'preview'

export default function CuestionariosPage() {
  const [tab,          setTab]         = useState<Tab>('cuestionarios')
  const [cuests,       setCuests]      = useState<Cuestionario[]>([])
  const [preguntas,    setPreguntas]   = useState<Pregunta[]>([])
  const [respuestas,   setRespuestas]  = useState<Respuesta[]>([])
  const [perfiles,     setPerfiles]    = useState<TpsPerfil[]>([])
  const [selCuest,     setSelCuest]    = useState<Cuestionario | null>(null)
  const [allPreguntas, setAllPreguntas] = useState<Pregunta[]>([])
  const [filterCuest,  setFilterCuest] = useState<string>('all')
  const [showModal,    setShowModal]   = useState(false)
  const [editId,       setEditId]      = useState<string | null>(null)
  const [form,         setForm]        = useState({ nombre: '', tipo: '', descripcion: '', activo: true })
  const [pForm,        setPForm]       = useState({ texto: '', tipo_respuesta: 'escala_4', dimension_target: '', perfil_hint: '' })
  const [showPModal,   setShowPModal]  = useState(false)
  const [saving,       setSaving]      = useState(false)
  const [generando,    setGenerando]   = useState(false)
  const [toast,        setToast]       = useState<{ msg: string; err?: boolean } | null>(null)
  const [orgNodos,     setOrgNodos]    = useState<OrgNodo[]>([])
  const [creds,        setCreds]       = useState<AsesorCred[]>([])
  const [filtroNodo,   setFiltroNodo]  = useState('')

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3200) }

  const loadCuests = useCallback(async () => {
    const { data } = await supabase.from('cuestionarios').select('*').order('created_at', { ascending: false })
    setCuests(data ?? [])
  }, [])

  const loadPerfiles = useCallback(async () => {
    const { data } = await supabase.from('tps_perfiles').select('*').order('updated_at', { ascending: false })
    setPerfiles(data ?? [])
  }, [])

  const loadAllPreguntas = useCallback(async () => {
    const { data } = await supabase.from('preguntas').select('*').order('cuestionario_id').order('orden')
    setAllPreguntas(data ?? [])
  }, [])

  useEffect(() => { loadCuests() }, [loadCuests])

  useEffect(() => {
    if (tab === 'perfiles') {
      loadPerfiles()
      Promise.all([
        fetch('/api/admin/org').then(r => r.json()),
        supabase.from('asesor_credentials').select('asesor, org_nodo_id').eq('activo', true),
      ]).then(([org, { data }]) => {
        setOrgNodos(org.nodos ?? [])
        setCreds((data ?? []) as AsesorCred[])
      })
    }
  }, [tab, loadPerfiles])

  useEffect(() => { if (tab === 'preguntas') loadAllPreguntas() }, [tab, loadAllPreguntas])

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

  async function generarSenales() {
    if (!selCuest) return
    setGenerando(true)
    try {
      const resp = await fetch('/api/admin/cuestionarios/generar-senales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuestionario_id: selCuest.id }),
      })
      const json = await resp.json()
      if (json.error) { showToast(json.error, true); return }
      showToast(json.created > 0
        ? `${json.created} señal${json.created !== 1 ? 'es' : ''} generada${json.created !== 1 ? 's' : ''}`
        : json.message ?? 'Sin respuestas nuevas'
      )
      if (selCuest) loadRespuestas(selCuest.id)
    } catch {
      showToast('Error al generar señales', true)
    } finally {
      setGenerando(false)
    }
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
        {[['cuestionarios','Cuestionarios'],['preguntas','Banco de preguntas'],['respuestas','Respuestas'],['preview','Preview'],['perfiles','Perfiles TPS']].map(([k, l]) => (
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
        <div>
          {/* Filtro por cuestionario */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Cuestionario
            </label>
            <select
              value={filterCuest}
              onChange={e => setFilterCuest(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none' }}
            >
              <option value="all">Todos ({allPreguntas.length} preguntas)</option>
              {cuests.map(c => {
                const count = allPreguntas.filter(p => p.cuestionario_id === c.id).length
                return <option key={c.id} value={c.id}>{c.nombre} ({count})</option>
              })}
            </select>
            <span style={{ fontSize: 12, color: '#8a8885', marginLeft: 'auto' }}>
              {(filterCuest === 'all' ? allPreguntas : allPreguntas.filter(p => p.cuestionario_id === filterCuest)).length} preguntas
            </span>
          </div>

          {/* Lista de preguntas */}
          {allPreguntas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885', fontSize: 13 }}>
              No hay preguntas cargadas en ningún cuestionario.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(filterCuest === 'all' ? allPreguntas : allPreguntas.filter(p => p.cuestionario_id === filterCuest))
                .map((p, i) => {
                  const cuestNombre = cuests.find(c => c.id === p.cuestionario_id)?.nombre ?? p.cuestionario_id.slice(0, 8)
                  return (
                    <div key={p.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '11px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: '#c8c6c3', flexShrink: 0, marginTop: 2, minWidth: 28, textAlign: 'right' }}>
                        {p.orden}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#0b0a09', marginBottom: 5 }}>{p.texto}</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {filterCuest === 'all' && (
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#0b0a0912', color: '#4a4844', border: '1px solid #e8e6e3' }}>
                              {cuestNombre}
                            </span>
                          )}
                          {p.tipo_respuesta && (
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#f5f3ef', color: '#4a4844', border: '1px solid #e8e6e3' }}>
                              {p.tipo_respuesta}
                            </span>
                          )}
                          {p.dimension_target && (
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#e6f3ed', color: '#1f6f56', border: '1px solid #e6f3ed' }}>
                              {p.dimension_target}
                            </span>
                          )}
                          {p.perfil_hint && (
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: '#f8ecd6', color: '#a8691a', border: '1px solid #f8ecd6' }}>
                              {p.perfil_hint}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {tab === 'respuestas' && (
        <div>
          {!selCuest ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885' }}>
              Selecciona un cuestionario en la pestaña Cuestionarios para ver sus respuestas.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#4a4844' }}>
                  Respuestas para: <strong>{selCuest.nombre}</strong> — {respuestas.length} total
                </div>
                <button onClick={generarSenales} disabled={generando} style={{
                  padding: '7px 14px', background: generando ? '#f5f3ef' : '#1f6f56', color: generando ? '#8a8885' : '#fff',
                  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: generando ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}>
                  {generando ? 'Generando…' : '⚡ Generar señales'}
                </button>
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

      {tab === 'preview' && (
        <div>
          {!selCuest ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885' }}>
              Selecciona un cuestionario en la pestaña Cuestionarios para previsualizar.
            </div>
          ) : (
            <div style={{ maxWidth: 620, margin: '0 auto' }}>
              <div style={{ background: '#0b0a09', borderRadius: '16px 16px 0 0', padding: '28px 32px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{selCuest.nombre}</div>
                {selCuest.descripcion && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{selCuest.descripcion}</div>}
                <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''} · {selCuest.tipo ?? 'cuestionario'}
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: '0 0 16px 16px', border: '1px solid #e8e6e3', borderTop: 'none', padding: '24px 32px' }}>
                {preguntas.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#8a8885', padding: '24px 0' }}>Sin preguntas aún.</div>
                ) : preguntas.map((p, i) => (
                  <div key={p.id} style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0b0a09', marginBottom: 10, lineHeight: 1.5 }}>
                      {i + 1}. {p.texto}
                    </div>
                    <PreviewInput tipo={p.tipo_respuesta} />
                    {(p.dimension_target || p.perfil_hint) && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 5 }}>
                        {p.dimension_target && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: '#e6f3ed', color: '#1f6f56', border: '1px solid #e6f3ed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.dimension_target}</span>}
                        {p.perfil_hint && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: '#f8ecd6', color: '#a8691a', border: '1px solid #f8ecd6', fontWeight: 600 }}>perfil {p.perfil_hint}</span>}
                      </div>
                    )}
                  </div>
                ))}
                <button disabled style={{ width: '100%', padding: '14px', background: '#cbf135', color: '#0b0a09', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit', marginTop: 8 }}>
                  Enviar respuestas
                </button>
                <div style={{ textAlign: 'center', fontSize: 11, color: '#c8c6c3', marginTop: 10 }}>Vista previa — los botones no son funcionales aquí</div>
              </div>
            </div>
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
          {/* Nodo filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            {orgNodos.length > 0 && (
              <select value={filtroNodo} onChange={e => setFiltroNodo(e.target.value)}
                style={{ padding: '7px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff', outline: 'none' }}>
                <option value="">Todos los equipos</option>
                {orgNodos.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              </select>
            )}
            <span style={{ fontSize: 13, color: '#4a4844', marginLeft: 'auto' }}>
              {(() => {
                const visible = filtroNodo
                  ? perfiles.filter(p => creds.find(c => c.asesor === p.asesor)?.org_nodo_id === filtroNodo)
                  : perfiles
                return <><strong>{visible.length}</strong> asesor{visible.length !== 1 ? 'es' : ''} evaluado{visible.length !== 1 ? 's' : ''}</>
              })()}
            </span>
          </div>

          {/* Distribución de perfiles del equipo */}
          {(() => {
            const visible = filtroNodo
              ? perfiles.filter(p => creds.find(c => c.asesor === p.asesor)?.org_nodo_id === filtroNodo)
              : perfiles
            if (visible.length === 0) return (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885', lineHeight: 1.7 }}>
                {filtroNodo ? (
                  <>
                    Ningún asesor de este equipo tiene perfil TPS calculado.
                    <br />
                    <a href="/admin/jerarquia" style={{ fontSize: 12, color: '#cbf135', fontWeight: 600 }}>
                      Asignar asesores al equipo en Jerarquía →
                    </a>
                  </>
                ) : 'Ningún asesor ha completado la evaluación TPS aún.'}
              </div>
            )
            const dist: Record<string, number> = {}
            for (const p of visible) dist[p.perfil_base] = (dist[p.perfil_base] ?? 0) + 1
            const total = visible.length
            return (
              <>
                <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 14 }}>
                    Distribución del equipo
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {Object.entries(PERFIL_LABELS).map(([key, info]) => {
                      const n = dist[key] ?? 0
                      const pct = total ? Math.round((n / total) * 100) : 0
                      return (
                        <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{info.icon}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: n > 0 ? info.color : '#c8c6c3' }}>{n}</div>
                          <div style={{ fontSize: 10, color: '#8a8885', marginBottom: 6 }}>{info.nombre}</div>
                          <div style={{ height: 4, background: '#f5f3ef', borderRadius: 2 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: info.color, borderRadius: 2 }} />
                          </div>
                          <div style={{ fontSize: 10, color: '#8a8885', marginTop: 3 }}>{pct}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visible.map(p => {
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
              </>
            )
          })()}
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
function PreviewInput({ tipo }: { tipo: string | null }) {
  if (tipo === 'escala_4' || tipo === 'escala_5') {
    const n = tipo === 'escala_4' ? 4 : 5
    const labels = tipo === 'escala_4'
      ? ['Nunca', 'Casi nunca', 'Frecuentemente', 'Siempre']
      : ['Nunca', 'Rara vez', 'A veces', 'Frecuentemente', 'Siempre']
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: n }, (_, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ width: '100%', aspectRatio: '1', border: '2px solid #e8e6e3', borderRadius: '50%', margin: '0 auto 4px', maxWidth: 36 }} />
            <div style={{ fontSize: 9, color: '#8a8885', lineHeight: 1.2 }}>{labels[i]}</div>
          </div>
        ))}
      </div>
    )
  }
  if (tipo === 'si_no') return (
    <div style={{ display: 'flex', gap: 10 }}>
      {['Sí', 'No'].map(l => (
        <div key={l} style={{ flex: 1, padding: '10px', border: '1px solid #e8e6e3', borderRadius: 8, textAlign: 'center', fontSize: 13, color: '#4a4844' }}>{l}</div>
      ))}
    </div>
  )
  if (tipo === 'alternativas') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {['Opción A', 'Opción B', 'Opción C'].map(l => (
        <div key={l} style={{ padding: '9px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, color: '#8a8885' }}>{l}</div>
      ))}
    </div>
  )
  return <textarea disabled rows={3} placeholder="Escribe tu respuesta aquí…" style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#8a8885', resize: 'none', boxSizing: 'border-box' }} />
}

function SmBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} style={{ padding: '6px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: danger ? '#fbe9e9' : '#fff', color: danger ? '#b03a3a' : '#4a4844' }}>{children}</button>
}
function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none' }
