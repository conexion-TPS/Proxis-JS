'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const PERFILES  = ['Energético','Sociable','Relacional','Reflexivo','Integrador','General']
const CATEGORIAS = [
  'fortaleza','debilidad','tactica_cliente','ciclo_7pasos',
  'backup_style','colision_espejo','diagnostico_perceptual',
  'cierre','pregunta_interna','sales_dna','ruta_desarrollo',
  'variable_situacional','protocolo_intervención',
]
const ETAPAS = ['prospeccion','pre_contacto','acercamiento','presentacion','objeciones','cierre','seguimiento']

type Entry = {
  id: string; perfil: string | null; categoria: string | null; etapa_ciclo: string | null
  contexto: string | null; contenido: string; regla_inferencia: string | null
  accion_correctiva: string | null; fuente: string | null; completitud: number; created_at: string
}

const EMPTY_FORM = {
  perfil: '', categoria: '', etapa_ciclo: '', contexto: '', contenido: '',
  regla_inferencia: '', accion_correctiva: '', fuente: '', completitud: 50,
}

export default function ConocimientoPage() {
  const [entries,   setEntries]  = useState<Entry[]>([])
  const [filterP,   setFilterP]  = useState('')
  const [filterC,   setFilterC]  = useState('')
  const [search,    setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]   = useState<string | null>(null)
  const [form,      setForm]     = useState({ ...EMPTY_FORM })
  const [saving,    setSaving]   = useState(false)
  const [toast,     setToast]    = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3200)
  }

  async function load() {
    const { data } = await supabase.from('knowledge_base_conductual')
      .select('*').order('created_at', { ascending: false })
    setEntries(data ?? [])
  }

  useEffect(() => { load() }, [])

  const filtered = entries.filter(e => {
    const matchP = !filterP || e.perfil === filterP
    const matchC = !filterC || e.categoria === filterC
    const q = search.toLowerCase()
    const matchQ = !q || (e.contenido ?? '').toLowerCase().includes(q) || (e.contexto ?? '').toLowerCase().includes(q)
    return matchP && matchC && matchQ
  })

  // Completitud por perfil
  const completitudByPerfil = PERFILES.map(p => {
    const rows = entries.filter(e => e.perfil === p || (p === 'General' && !e.perfil))
    const avg = rows.length ? Math.round(rows.reduce((s, e) => s + e.completitud, 0) / rows.length) : 0
    return { perfil: p, count: rows.length, avg }
  })

  function openModal(e?: Entry) {
    if (e) {
      setEditId(e.id)
      setForm({
        perfil: e.perfil ?? '', categoria: e.categoria ?? '',
        etapa_ciclo: e.etapa_ciclo ?? '', contexto: e.contexto ?? '',
        contenido: e.contenido, regla_inferencia: e.regla_inferencia ?? '',
        accion_correctiva: e.accion_correctiva ?? '', fuente: e.fuente ?? '',
        completitud: e.completitud,
      })
    } else {
      setEditId(null)
      setForm({ ...EMPTY_FORM })
    }
    setShowModal(true)
  }

  async function guardar() {
    if (!form.contenido.trim()) { showToast('El contenido es obligatorio.', true); return }
    setSaving(true)
    const payload = {
      perfil:            form.perfil   || null,
      categoria:         form.categoria || null,
      etapa_ciclo:       form.etapa_ciclo || null,
      contexto:          form.contexto || null,
      contenido:         form.contenido.trim(),
      regla_inferencia:  form.regla_inferencia || null,
      accion_correctiva: form.accion_correctiva || null,
      fuente:            form.fuente || null,
      completitud:       form.completitud,
      updated_at:        new Date().toISOString(),
    }
    if (editId) {
      await supabase.from('knowledge_base_conductual').update(payload).eq('id', editId)
      showToast('Entrada actualizada.')
    } else {
      await supabase.from('knowledge_base_conductual').insert(payload)
      showToast('Entrada creada.')
    }
    setSaving(false); setShowModal(false); load()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta entrada?')) return
    await supabase.from('knowledge_base_conductual').delete().eq('id', id)
    showToast('Eliminada.')
    load()
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ChevLeft /> Panel admin
          </Link>
          <span style={{ color: '#c8c6c3' }}>/</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Conocimiento conductual</h1>
        </div>
        <button onClick={() => openModal()} style={{
          padding: '9px 16px', background: '#0b0a09', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>+ Nueva entrada</button>
      </div>

      {/* Completitud por perfil */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 24 }}>
        {completitudByPerfil.map(({ perfil, count, avg }) => (
          <div key={perfil} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4a4844', marginBottom: 6 }}>{perfil}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: avg >= 70 ? '#1f6f56' : avg >= 40 ? '#a8691a' : '#b03a3a', marginBottom: 4 }}>{avg}%</div>
            <div style={{ height: 3, background: '#f5f3ef', borderRadius: 2, marginBottom: 4 }}>
              <div style={{ width: `${avg}%`, height: '100%', background: avg >= 70 ? '#1f6f56' : avg >= 40 ? '#a8691a' : '#b03a3a', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, color: '#8a8885' }}>{count} entr{count !== 1 ? 'adas' : 'ada'}</div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterP} onChange={e => setFilterP(e.target.value)} style={selStyle}>
          <option value="">Todos los perfiles</option>
          {PERFILES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterC} onChange={e => setFilterC(e.target.value)} style={selStyle}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar en contenido…"
          style={{ ...selStyle, flex: 1, minWidth: 200 }}
        />
      </div>
      <div style={{ fontSize: 12, color: '#8a8885', marginBottom: 12 }}>{filtered.length} entrada{filtered.length !== 1 ? 's' : ''}</div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885' }}>Sin entradas. Crea la primera.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(e => (
            <div key={e.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    {e.perfil    && <Badge color="#f5f3ef">{e.perfil}</Badge>}
                    {e.categoria && <Badge color="#f0ede8">{e.categoria}</Badge>}
                    {e.etapa_ciclo && <Badge color="#e6f3ed">{e.etapa_ciclo}</Badge>}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 40, height: 3, background: '#f5f3ef', borderRadius: 2 }}>
                        <div style={{ width: `${e.completitud}%`, height: '100%', background: e.completitud >= 70 ? '#1f6f56' : '#a8691a', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#8a8885' }}>{e.completitud}%</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: '#0b0a09', marginBottom: e.regla_inferencia ? 6 : 0 }}>
                    {e.contenido.slice(0, 300)}{e.contenido.length > 300 ? '…' : ''}
                  </p>
                  {e.regla_inferencia && (
                    <p style={{ fontSize: 11, color: '#8a8885', fontStyle: 'italic' }}>
                      Regla: {e.regla_inferencia}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <SmBtn onClick={() => openModal(e)}>✏️</SmBtn>
                  <SmBtn onClick={() => eliminar(e.id)} danger>🗑</SmBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div onClick={ev => { if (ev.target === ev.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>{editId ? 'Editar entrada' : 'Nueva entrada'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Field label="Perfil">
                <select value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))} style={inputStyle}>
                  <option value="">General</option>
                  {PERFILES.filter(p => p !== 'General').map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Categoría">
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Etapa del ciclo">
                <select value={form.etapa_ciclo} onChange={e => setForm(f => ({ ...f, etapa_ciclo: e.target.value }))} style={inputStyle}>
                  <option value="">—</option>
                  {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Contenido *">
              <textarea value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                rows={5} placeholder="El conocimiento, patrón o técnica…"
                style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <Field label="Regla de inferencia (si X entonces Y)">
              <textarea value={form.regla_inferencia} onChange={e => setForm(f => ({ ...f, regla_inferencia: e.target.value }))}
                rows={2} placeholder="Si el asesor evita nombrar clientes, puede indicar…"
                style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <Field label="Acción correctiva">
              <textarea value={form.accion_correctiva} onChange={e => setForm(f => ({ ...f, accion_correctiva: e.target.value }))}
                rows={2} placeholder="¿Qué debería hacer el asesor en este caso?"
                style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 16 }}>
              <Field label="Fuente">
                <input value={form.fuente} onChange={e => setForm(f => ({ ...f, fuente: e.target.value }))}
                  placeholder="Libro, documento, experiencia de campo…" style={inputStyle} />
              </Field>
              <Field label={`Completitud: ${form.completitud}%`}>
                <input type="range" min={0} max={100} value={form.completitud}
                  onChange={e => setForm(f => ({ ...f, completitud: parseInt(e.target.value) }))}
                  style={{ width: '100%', marginTop: 6 }} />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 18px', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: '#fff' }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{ padding: '10px 18px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.err ? '#b03a3a' : '#0b0a09', color: '#fff', fontSize: 13, fontWeight: 500, padding: '10px 22px', borderRadius: 30, zIndex: 999 }}>{toast.msg}</div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: color, color: '#4a4844', border: '1px solid #e8e6e3' }}>{children}</span>
}
function SmBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, fontSize: 14, color: danger ? '#b03a3a' : '#8a8885' }}>{children}</button>
}
function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const selStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid #e8e6e3', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #e8e6e3', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none',
}
