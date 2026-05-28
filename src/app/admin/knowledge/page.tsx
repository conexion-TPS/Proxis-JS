'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const PERFILES = [
  { value: '',    label: 'Todos' },
  { value: 'E',   label: 'E — Energético' },
  { value: 'S',   label: 'S — Sociable' },
  { value: 'R',   label: 'R — Relacional' },
  { value: 'A',   label: 'A — Reflexivo' },
  { value: 'GEN', label: 'General' },
]

type KBEntry = {
  id: string; titulo: string | null; contenido: string | null
  dominio: string | null; tags: string[] | null; embedding: unknown
  created_at: string
}

export default function KnowledgePage() {
  const [entries,   setEntries]   = useState<KBEntry[]>([])
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState({ titulo: '', contenido: '', dominio: '', tags: [] as string[], tagInput: '' })
  const [saving,    setSaving]    = useState(false)
  const [embedding, setEmbedding] = useState<Record<string, 'pending' | 'done' | 'error'>>({})
  const [toast,     setToast]     = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('knowledge_base').select('*').order('created_at', { ascending: false })
    setEntries(data ?? [])
  }

  const filtered = entries.filter(e => {
    const matchP = filter === ''    ? true
                 : filter === 'GEN' ? !e.dominio
                 :                    e.dominio === filter
    const q = search.toLowerCase()
    const matchQ = !q || (e.titulo ?? '').toLowerCase().includes(q) || (e.contenido ?? '').toLowerCase().includes(q)
    return matchP && matchQ
  })

  const pendingCount = entries.filter(e => !e.embedding).length

  function openModal(e?: KBEntry) {
    if (e) {
      setEditId(e.id)
      setForm({ titulo: e.titulo ?? '', contenido: e.contenido ?? '', dominio: e.dominio ?? '', tags: e.tags ?? [], tagInput: '' })
    } else {
      setEditId(null)
      setForm({ titulo: '', contenido: '', dominio: '', tags: [], tagInput: '' })
    }
    setShowModal(true)
  }

  function addTag(val: string) {
    const t = val.trim().toLowerCase()
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: '' }))
    else setForm(f => ({ ...f, tagInput: '' }))
  }

  async function guardar() {
    const { titulo, contenido, dominio, tags } = form
    if (!titulo.trim())    { showToast('El título es obligatorio.', true); return }
    if (!contenido.trim()) { showToast('El contenido es obligatorio.', true); return }
    setSaving(true)
    const payload = { titulo: titulo.trim(), contenido: contenido.trim(), dominio: dominio || null, tags }
    if (editId) {
      await supabase.from('knowledge_base').update(payload).eq('id', editId)
      showToast('Entrada actualizada.')
    } else {
      await supabase.from('knowledge_base').insert(payload)
      showToast('Entrada creada.')
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta entrada? La acción no se puede deshacer.')) return
    await supabase.from('knowledge_base').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    showToast('Entrada eliminada.')
  }

  async function getEmbedding(text: string): Promise<unknown> {
    const res = await fetch('/api/admin/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data.embedding ?? null
  }

  async function embedOne(id: string) {
    const entry = entries.find(e => e.id === id)
    if (!entry) return
    setEmbedding(m => ({ ...m, [id]: 'pending' }))
    try {
      const text = `${entry.titulo}\n\n${entry.contenido}`
      const emb = await getEmbedding(text)
      await supabase.from('knowledge_base').update({ embedding: emb }).eq('id', id)
      setEntries(prev => prev.map(e => e.id === id ? { ...e, embedding: emb } : e))
      setEmbedding(m => ({ ...m, [id]: 'done' }))
      showToast('Embedding generado.')
    } catch (e: unknown) {
      setEmbedding(m => ({ ...m, [id]: 'error' }))
      showToast('Error embedding: ' + (e instanceof Error ? e.message : ''), true)
    }
  }

  async function embedAll() {
    const pending = entries.filter(e => !e.embedding)
    if (!pending.length) { showToast('Todas las entradas ya tienen embedding.'); return }
    let done = 0
    for (const entry of pending) {
      try {
        const text = `${entry.titulo}\n\n${entry.contenido}`
        const emb = await getEmbedding(text)
        const { error: sbErr } = await supabase.from('knowledge_base').update({ embedding: emb }).eq('id', entry.id)
        if (sbErr) throw new Error(`Supabase: ${sbErr.message}`)
        setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, embedding: emb } : e))
        done++
      } catch (e: unknown) {
        showToast(`Error en "${entry.titulo?.slice(0,30)}": ${e instanceof Error ? e.message : 'desconocido'}`, true)
        break
      }
    }
    if (done > 0) showToast(`${done} embedding${done !== 1 ? 's' : ''} generado${done !== 1 ? 's' : ''}.`)
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Base de conocimiento</h1>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8885" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o contenido…"
            style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
              border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
          />
        </div>

        {/* Profile filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERFILES.map(p => (
            <button key={p.value} onClick={() => setFilter(p.value)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: '1px solid',
              background: filter === p.value ? '#0b0a09' : '#fff',
              color: filter === p.value ? '#fff' : '#4a4844',
              borderColor: filter === p.value ? '#0b0a09' : '#e8e6e3',
            }}>{p.label}</button>
          ))}
        </div>

        {/* Embed all */}
        <button onClick={embedAll} disabled={pendingCount === 0} style={{
          padding: '7px 14px', border: '1px solid #e8e6e3', borderRadius: 8,
          fontSize: 12, fontFamily: 'inherit', cursor: pendingCount ? 'pointer' : 'not-allowed',
          background: '#fff', color: pendingCount ? '#4a4844' : '#c8c6c3',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <VectorIcon /> {pendingCount} sin vector
        </button>

        {/* New entry */}
        <button onClick={() => openModal()} style={{
          padding: '9px 16px', background: '#0b0a09', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          + Nueva entrada
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#8a8885', marginBottom: 16 }}>
        {filtered.length} entrada{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885' }}>
          {entries.length ? 'Sin resultados para este filtro.' : 'No hay entradas en la base de conocimiento.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(e => {
            const hasEmb = !!e.embedding
            const embState = embedding[e.id]
            return (
              <div key={e.id} style={{
                background: '#fff', border: '1px solid #e8e6e3',
                borderRadius: 12, padding: 20, position: 'relative',
              }}>
                {/* Actions */}
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
                  <ActBtn onClick={() => embedOne(e.id)} title="Generar embedding">
                    {embState === 'pending' ? '⏳' : <VectorIcon />}
                  </ActBtn>
                  <ActBtn onClick={() => openModal(e)} title="Editar">✏️</ActBtn>
                  <ActBtn onClick={() => eliminar(e.id)} title="Eliminar" danger>🗑</ActBtn>
                </div>

                {/* Profile badge */}
                <div style={{ marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: e.dominio ? '#f5f3ef' : '#f0ede8',
                    color: '#4a4844', border: '1px solid #e8e6e3',
                  }}>{e.dominio || 'GEN'}</span>
                </div>

                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, paddingRight: 80 }}>
                  {e.titulo || '(sin título)'}
                </div>
                <div style={{ fontSize: 12, color: '#4a4844', lineHeight: 1.6, marginBottom: 12 }}>
                  {(e.contenido ?? '').slice(0, 200)}{(e.contenido ?? '').length > 200 ? '…' : ''}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {(e.tags ?? []).map(t => (
                    <span key={t} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: '#f5f3ef', color: '#4a4844', border: '1px solid #e8e6e3',
                    }}>{t}</span>
                  ))}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: hasEmb ? '#1f6f56' : '#8a8885' }}>
                    {hasEmb ? '✓ vector' : '· sin vector'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>
              {editId ? 'Editar entrada' : 'Nueva entrada'}
            </h2>

            {([
              { label: 'Título', key: 'titulo', type: 'text', placeholder: 'Ej: Cómo manejar el silencio con perfil A' },
            ] as const).map(f => (
              <Field key={f.key} label={f.label}>
                <input value={form[f.key]} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} maxLength={120}
                  style={inputStyle} />
              </Field>
            ))}

            <Field label="Perfil conductual">
              <select value={form.dominio} onChange={e => setForm(s => ({ ...s, dominio: e.target.value }))}
                style={inputStyle}>
                <option value="">General (aplica a todos)</option>
                <option value="E">E — Energético</option>
                <option value="S">S — Sociable</option>
                <option value="R">R — Relacional</option>
                <option value="A">A — Reflexivo</option>
              </select>
            </Field>

            <Field label="Contenido">
              <textarea value={form.contenido} onChange={e => setForm(s => ({ ...s, contenido: e.target.value }))}
                rows={7} placeholder="Escribe aquí el conocimiento, insight o técnica de coaching…"
                style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ fontSize: 11, color: '#8a8885', textAlign: 'right', marginTop: 4 }}>
                {form.contenido.length} caracteres
              </div>
            </Field>

            <Field label="Etiquetas (Enter o coma para agregar)">
              <div style={{
                border: '1px solid #e8e6e3', borderRadius: 8, padding: '6px 10px',
                display: 'flex', flexWrap: 'wrap', gap: 6, cursor: 'text',
              }} onClick={() => document.getElementById('tag-input')?.focus()}>
                {form.tags.map(t => (
                  <span key={t} style={{
                    background: '#f5f3ef', borderRadius: 20, padding: '2px 10px',
                    fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    {t}
                    <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                  </span>
                ))}
                <input id="tag-input" value={form.tagInput}
                  onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(form.tagInput) }
                    if (e.key === 'Backspace' && !form.tagInput && form.tags.length)
                      setForm(f => ({ ...f, tags: f.tags.slice(0, -1) }))
                  }}
                  placeholder="prospección, cierre…"
                  style={{ border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', flex: 1, minWidth: 120 }}
                />
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{
                padding: '10px 18px', border: '1px solid #e8e6e3', borderRadius: 8,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: '#fff',
              }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{
                padding: '10px 18px', background: '#0b0a09', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.err ? '#b03a3a' : '#0b0a09',
          color: '#fff', fontSize: 13, fontWeight: 500,
          padding: '10px 22px', borderRadius: 30, zIndex: 999,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ActBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      padding: '4px 6px', borderRadius: 6, fontSize: 12,
      color: danger ? '#b03a3a' : '#8a8885',
      transition: 'background 0.12s',
    }}>{children}</button>
  )
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function VectorIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #e8e6e3', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, color: '#0b0a09',
  outline: 'none', background: '#fff',
}
