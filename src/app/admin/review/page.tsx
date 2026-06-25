'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type LogRow = {
  id: string; asesor: string; trigger_id: string | null
  body: string | null; prompt_version: number | null
  leido: boolean; created_at: string
}
type FeedbackRow = { id: string; message_id: string; score: number; correccion: string | null }

const PAGE_SIZE = 20

type OrgNodo  = { id: string; nombre: string }
type AsesorCred = { asesor: string; org_nodo_id: string | null }

export default function ReviewPage() {
  const [logs,       setLogs]       = useState<LogRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(0)
  const [selected,   setSelected]   = useState<LogRow | null>(null)
  const [fbMap,      setFbMap]      = useState<Record<string, FeedbackRow>>({})
  const [correction, setCorrection] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; err?: boolean } | null>(null)
  const [orgNodos,   setOrgNodos]   = useState<OrgNodo[]>([])
  const [creds,      setCreds]      = useState<AsesorCred[]>([])
  const [filtroNodo, setFiltroNodo] = useState('')

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/org').then(r => r.json()),
      supabase.from('asesor_credentials').select('asesor, org_nodo_id').eq('activo', true),
    ]).then(([org, { data }]) => {
      setOrgNodos(org.nodos ?? [])
      setCreds((data ?? []) as AsesorCred[])
    })
  }, [])

  const load = useCallback(async (p: number) => {
    const offset = p * PAGE_SIZE
    const asesoresEnNodo = filtroNodo
      ? creds.filter(c => c.org_nodo_id === filtroNodo).map(c => c.asesor)
      : null

    let q = supabase.from('message_log').select('*').order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
    if (asesoresEnNodo && asesoresEnNodo.length > 0) q = q.in('asesor', asesoresEnNodo)

    const { data: rows } = await q
    const logRows = rows ?? []
    setLogs(logRows)

    if (logRows.length) {
      const ids = logRows.map(l => l.id)
      const { data: fb } = await supabase.from('feedback')
        .select('*').in('message_id', ids)
      const map: Record<string, FeedbackRow> = {}
      for (const f of fb ?? []) map[f.message_id] = f
      setFbMap(map)
    }
  }, [])

  useEffect(() => { load(page) }, [page, load, filtroNodo, creds])

  function selectLog(log: LogRow) {
    setSelected(log)
    // '[supervisor]' es un marcador de autoría (feedback del supervisor desde el portal),
    // NO una corrección real: se trata como "sin corrección" para no mostrarlo como texto.
    const c = fbMap[log.id]?.correccion
    setCorrection(c && c !== '[supervisor]' ? c : '')
  }

  async function darFeedback(score: number) {
    if (!selected) return
    const existing = fbMap[selected.id]
    if (existing) {
      await supabase.from('feedback').update({ score }).eq('id', existing.id)
      setFbMap(m => ({ ...m, [selected.id]: { ...existing, score } }))
    } else {
      const { data } = await supabase.from('feedback').insert({ message_id: selected.id, score }).select().single()
      if (data) setFbMap(m => ({ ...m, [selected.id]: data }))
    }
    showToast(score > 0 ? '👍 Feedback positivo guardado.' : '👎 Feedback negativo guardado.')
  }

  async function guardarCorreccion() {
    if (!selected) return
    if (!correction.trim()) { showToast('Escribe la corrección antes de guardar.', true); return }
    setSaving(true)
    const existing = fbMap[selected.id]
    if (existing) {
      await supabase.from('feedback').update({ correccion: correction }).eq('id', existing.id)
      setFbMap(m => ({ ...m, [selected.id]: { ...existing, correccion: correction } }))
    } else {
      const { data } = await supabase.from('feedback')
        .insert({ message_id: selected.id, score: -1, correccion: correction }).select().single()
      if (data) setFbMap(m => ({ ...m, [selected.id]: data }))
    }

    if (selected.trigger_id) {
      const { data: prompts } = await supabase.from('prompts')
        .select('id,notas').eq('trigger_id', selected.trigger_id).eq('activo', true)
        .order('version', { ascending: false }).limit(1)
      if (prompts?.[0]) {
        const fewShot = `\n\n---\nEjemplo esperado (${new Date().toLocaleDateString('es-CL')}):\n${correction}`
        await supabase.from('prompts')
          .update({ notas: (prompts[0].notas || '') + fewShot }).eq('id', prompts[0].id)
      }
    }

    setSaving(false)
    showToast('Corrección guardada y agregada al prompt.')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Revisión de mensajes</h1>
      </div>

      {orgNodos.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Equipo</span>
          <select value={filtroNodo} onChange={e => { setFiltroNodo(e.target.value); setPage(0) }}
            style={{ padding: '7px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff', outline: 'none' }}>
            <option value="">Todos</option>
            {orgNodos.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20, alignItems: 'start' }}>
        {/* Log list */}
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafaf7', borderBottom: '1px solid #e8e6e3' }}>
                {['Asesor','Trigger','Fecha','Leído','Feedback'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#8a8885', padding: 32 }}>Sin mensajes registrados aún.</td></tr>
              ) : logs.map(log => {
                const fb = fbMap[log.id]
                return (
                  <tr key={log.id} onClick={() => selectLog(log)} style={{
                    borderBottom: '1px solid #f5f3ef',
                    background: selected?.id === log.id ? '#f5f3ef' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}>
                    <td style={td}>{log.asesor}</td>
                    <td style={{ ...td, fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: '#4a4844' }}>{log.trigger_id || '—'}</td>
                    <td style={{ ...td, fontSize: 11, color: '#8a8885' }}>{fmtDateTime(log.created_at)}</td>
                    <td style={td}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: log.leido ? '#e6f3ed' : '#f8ecd6',
                        color: log.leido ? '#1f6f56' : '#a8691a',
                      }}>{log.leido ? 'Leído' : 'Nuevo'}</span>
                    </td>
                    <td style={td}>
                      {fb ? (
                        <span style={{ fontSize: 16 }}>{fb.score > 0 ? '👍' : '👎'}</span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f5f3ef', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#8a8885' }}>
              {total ? `Página ${page + 1} de ${totalPages} — ${total} mensajes` : 'Sin mensajes'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <PageBtn onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Anterior</PageBtn>
              <PageBtn onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Siguiente →</PageBtn>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 20 }}>
          {!selected ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8a8885', fontSize: 13 }}>
              Selecciona un mensaje para revisarlo
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{selected.asesor}</div>
                <div style={{ fontSize: 11, color: '#8a8885', display: 'flex', gap: 12 }}>
                  <span>⚡ {selected.trigger_id || '—'}</span>
                  <span>🕐 {fmtDateTime(selected.created_at)}</span>
                  {selected.prompt_version && <span>v{selected.prompt_version}</span>}
                </div>
              </div>

              <div style={{
                background: '#f5f3ef', borderRadius: 8, padding: 14,
                fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                marginBottom: 16, maxHeight: 300, overflowY: 'auto',
              }}>{selected.body || '[sin contenido]'}</div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[1, -1].map(score => {
                  const fb = fbMap[selected.id]
                  const active = fb?.score === score
                  return (
                    <button key={score} onClick={() => darFeedback(score)} style={{
                      fontSize: 20, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                      border: active ? `2px solid ${score > 0 ? '#1f6f56' : '#b03a3a'}` : '1px solid #e8e6e3',
                      background: active ? (score > 0 ? '#e6f3ed' : '#fbe9e9') : '#fff',
                    }}>{score > 0 ? '👍' : '👎'}</button>
                  )
                })}
              </div>

              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 6 }}>
                Reescribir como debería ser
              </label>
              <textarea
                value={correction}
                onChange={e => setCorrection(e.target.value)}
                rows={4}
                placeholder="Escribe aquí cómo debería ser el mensaje ideal…"
                style={{
                  width: '100%', padding: 12,
                  border: '1px solid #e8e6e3', borderRadius: 8,
                  fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6,
                  color: '#0b0a09', resize: 'vertical', outline: 'none',
                  marginBottom: 12,
                }}
              />
              <button onClick={guardarCorreccion} disabled={saving} style={{
                width: '100%', padding: 12,
                background: '#0b0a09', color: '#fff',
                border: 'none', borderRadius: 8,
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Guardando…' : 'Guardar corrección'}</button>
            </div>
          )}
        </div>
      </div>

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

const td: React.CSSProperties = { padding: '11px 16px', fontSize: 13, verticalAlign: 'middle' }

function fmtDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '5px 12px', border: '1px solid #e8e6e3', borderRadius: 6,
      fontSize: 12, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
      background: '#fff', color: disabled ? '#c8c6c3' : '#4a4844',
    }}>{children}</button>
  )
}
