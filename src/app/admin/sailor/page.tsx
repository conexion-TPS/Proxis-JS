'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type SailorMsg = {
  id: string; asesor: string; origen: 'coach_ia' | 'asesora'
  contenido: string; tipo: string | null; leido: boolean; created_at: string
}
type PushToken = {
  id: string; asesor: string; token: string
  plataforma: 'ios' | 'android' | null; activo: boolean; created_at: string
}
type MetaRow = { asesor: string; supervisor: string | null }

export default function SailorPage() {
  const [mensajes,     setMensajes]     = useState<SailorMsg[]>([])
  const [tokens,       setTokens]       = useState<PushToken[]>([])
  const [metaRows,     setMetaRows]     = useState<MetaRow[]>([])
  const [filterA,      setFilterA]      = useState('')
  const [filterSup,    setFilterSup]    = useState('')
  const [tab,          setTab]          = useState<'feed' | 'tokens' | 'stats'>('feed')
  const [loading,   setLoading]   = useState(true)
  const [sendForm,  setSendForm]  = useState<{ asesor: string; contenido: string } | null>(null)
  const [sending,   setSending]   = useState(false)
  const [toast,     setToast]     = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, tRes, aRes] = await Promise.all([
      supabase.from('sailor_messages').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('push_tokens').select('*').order('created_at', { ascending: false }),
      supabase.from('metas').select('asesor,supervisor').order('asesor'),
    ])
    setMensajes(mRes.data ?? [])
    setTokens(tRes.data ?? [])
    setMetaRows(aRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Derivados del modelo de datos
  const asesores    = metaRows.map(r => r.asesor)
  const supervisores = [...new Set(metaRows.map(r => r.supervisor).filter(Boolean) as string[])].sort()
  const supDeAsesor  = Object.fromEntries(metaRows.map(r => [r.asesor, r.supervisor ?? null]))

  // Asesores del supervisor seleccionado (para filtrar mensajes)
  const asesoresDelSup = filterSup
    ? metaRows.filter(r => r.supervisor === filterSup).map(r => r.asesor)
    : null

  const filteredMsgs = mensajes.filter(m => {
    if (filterA   && m.asesor !== filterA) return false
    if (asesoresDelSup && !asesoresDelSup.includes(m.asesor)) return false
    return true
  })

  // Stats
  const totalMsgs    = mensajes.length
  const coachMsgs    = mensajes.filter(m => m.origen === 'coach_ia').length
  const asesorMsgs   = mensajes.filter(m => m.origen === 'asesora').length
  const activeTokens = tokens.filter(t => t.activo).length
  const readRate     = coachMsgs > 0
    ? Math.round((mensajes.filter(m => m.origen === 'coach_ia' && m.leido).length / coachMsgs) * 100)
    : 0

  // By-asesor stats (respeta filtro supervisor)
  const asesoresFiltrados = asesoresDelSup ?? asesores
  const byAsesor = asesoresFiltrados.map(a => ({
    asesor:    a,
    supervisor: supDeAsesor[a] ?? null,
    total:     mensajes.filter(m => m.asesor === a).length,
    coach:     mensajes.filter(m => m.asesor === a && m.origen === 'coach_ia').length,
    replies:   mensajes.filter(m => m.asesor === a && m.origen === 'asesora').length,
    token:     tokens.find(t => t.asesor === a && t.activo),
  })).filter(x => x.total > 0 || x.token)

  async function enviarMensaje() {
    if (!sendForm?.asesor || !sendForm.contenido.trim()) return
    setSending(true)
    const { error } = await supabase.from('sailor_messages').insert({
      asesor:    sendForm.asesor,
      origen:    'coach_ia',
      contenido: sendForm.contenido.trim(),
      tipo:      'mensaje',
      leido:     false,
    })
    if (!error) {
      // Notificación por email en background (no bloqueante)
      fetch('/api/email/notificacion-sailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asesor: sendForm.asesor, contenido: sendForm.contenido.trim() }),
      }).catch(() => {})
      showToast('Mensaje enviado. Notificación email en camino.')
      setSendForm(null)
      load()
    }
    setSending(false)
  }

  async function toggleToken(id: string, activo: boolean) {
    await supabase.from('push_tokens').update({ activo: !activo }).eq('id', id)
    setTokens(prev => prev.map(t => t.id === id ? { ...t, activo: !activo } : t))
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Sailor App</h1>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: 'rgba(203,241,53,0.15)', color: '#7aaa00',
          border: '1px solid rgba(203,241,53,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          MVP
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Mensajes totales', value: totalMsgs,    color: '#0b0a09' },
          { label: 'Del coach',        value: coachMsgs,    color: '#1f6f56' },
          { label: 'Del asesor',       value: asesorMsgs,   color: '#a8691a' },
          { label: 'Tokens activos',   value: activeTokens, color: '#8e35d4' },
          { label: 'Tasa lectura',     value: `${readRate}%`, color: '#0b0a09' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e8e6e3' }}>
        {([['feed','Feed de mensajes'],['tokens','Push tokens'],['stats','Por asesor']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: tab === k ? 700 : 400,
            color: tab === k ? '#0b0a09' : '#8a8885', background: 'none',
            borderBottom: tab === k ? '2px solid #0b0a09' : '2px solid transparent',
            marginBottom: -1,
          }}>{l}</button>
        ))}
        <div style={{ marginLeft: 'auto', paddingBottom: 8 }}>
          <button onClick={() => setSendForm({ asesor: filterA || asesores[0] || '', contenido: '' })}
            style={{
              padding: '7px 14px', background: '#0b0a09', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            + Mensaje manual
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8a8885' }}>Cargando…</div>
      ) : (
        <>
          {/* FEED */}
          {tab === 'feed' && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {supervisores.length > 0 && (
                  <select value={filterSup} onChange={e => { setFilterSup(e.target.value); setFilterA('') }} style={selStyle}>
                    <option value="">Todos los supervisores</option>
                    {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                <select value={filterA} onChange={e => setFilterA(e.target.value)} style={selStyle}>
                  <option value="">Todos los asesores</option>
                  {(asesoresDelSup ?? asesores).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {filteredMsgs.length === 0 ? (
                <EmptyState msg="Sin mensajes en Sailor todavía." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredMsgs.map(m => (
                    <div key={m.id} style={{
                      background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12,
                      padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: m.origen === 'coach_ia' ? '#cbf135' : '#e8e6e3',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700,
                        color: m.origen === 'coach_ia' ? '#0b0a09' : '#4a4844',
                      }}>
                        {m.origen === 'coach_ia' ? '🤖' : m.asesor.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>
                            {m.origen === 'coach_ia'
                              ? <>Coach IA <span style={{ color: '#8a8885', fontWeight: 600 }}>→ {m.asesor.split(' ')[0]}</span></>
                              : m.asesor.split(' ')[0]}
                          </span>
                          {m.tipo && (
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20,
                              background: '#f5f3ef', color: '#8a8885', fontWeight: 600 }}>
                              {m.tipo}
                            </span>
                          )}
                          {m.origen === 'coach_ia' && (
                            <span style={{ fontSize: 10, color: m.leido ? '#1f6f56' : '#a8691a' }}>
                              {m.leido ? '✓ leído' : '· no leído'}
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a8885' }}>
                            {new Date(m.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: '#0b0a09', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {m.contenido.length > 300 ? m.contenido.slice(0, 300) + '…' : m.contenido}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* PUSH TOKENS */}
          {tab === 'tokens' && (
            tokens.length === 0 ? (
              <EmptyState msg="Sin tokens push registrados. Los tokens se registran cuando el asesor instala Sailor App." />
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafaf7', borderBottom: '1px solid #e8e6e3' }}>
                      {['Asesor','Plataforma','Token (parcial)','Estado','Registrado'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                          letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f5f3ef' }}>
                        <td style={td}>{t.asesor.split(' ')[0]}</td>
                        <td style={td}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
                            background: t.plataforma === 'ios' ? '#e8f0fe' : '#e6f3ed',
                            color: t.plataforma === 'ios' ? '#1a56c4' : '#1f6f56', fontWeight: 600 }}>
                            {t.plataforma ?? '—'}
                          </span>
                        </td>
                        <td style={{ ...td, fontFamily: 'var(--font-mono), monospace', fontSize: 11 }}>
                          {t.token.slice(0, 20)}…
                        </td>
                        <td style={td}>
                          <button onClick={() => toggleToken(t.id, t.activo)} style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            border: 'none', cursor: 'pointer',
                            background: t.activo ? '#e6f3ed' : '#f5f3ef',
                            color: t.activo ? '#1f6f56' : '#8a8885',
                          }}>{t.activo ? 'Activo' : 'Inactivo'}</button>
                        </td>
                        <td style={{ ...td, fontSize: 11, color: '#8a8885' }}>
                          {new Date(t.created_at).toLocaleDateString('es-CL')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* STATS POR ASESOR */}
          {tab === 'stats' && (
            <>
              {supervisores.length > 0 && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <select value={filterSup} onChange={e => setFilterSup(e.target.value)} style={selStyle}>
                    <option value="">Todos los supervisores</option>
                    {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {byAsesor.length === 0 ? (
                <EmptyState msg="Sin datos todavía." />
              ) : (
                <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafaf7', borderBottom: '1px solid #e8e6e3' }}>
                        {['Asesor', ...(supervisores.length > 0 ? ['Supervisor'] : []), 'Msgs recibidos','Respuestas','Tasa respuesta','Push token'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                            letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {byAsesor.map(a => {
                        const rate = a.coach > 0 ? Math.round((a.replies / a.coach) * 100) : 0
                        return (
                          <tr key={a.asesor} style={{ borderBottom: '1px solid #f5f3ef' }}>
                            <td style={{ ...td, fontWeight: 600 }}>{a.asesor.split(' ')[0]}</td>
                            {supervisores.length > 0 && (
                              <td style={{ ...td, fontSize: 11 }}>
                                {a.supervisor
                                  ? <span style={{ padding: '2px 8px', borderRadius: 20, background: '#e8f0fe', color: '#1a56c4', fontSize: 10, fontWeight: 600 }}>{a.supervisor.split(' ')[0]}</span>
                                  : <span style={{ fontSize: 11, color: '#c8c6c3' }}>—</span>
                                }
                              </td>
                            )}
                            <td style={td}>{a.coach}</td>
                            <td style={td}>{a.replies}</td>
                            <td style={td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 60, height: 4, background: '#f5f3ef', borderRadius: 2 }}>
                                  <div style={{ width: `${rate}%`, height: 4, background: rate >= 50 ? '#cbf135' : '#e8c572', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 11 }}>{rate}%</span>
                              </div>
                            </td>
                            <td style={td}>
                              {a.token ? (
                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
                                  background: '#e6f3ed', color: '#1f6f56', fontWeight: 600 }}>
                                  ✓ {a.token.plataforma ?? 'activo'}
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, color: '#8a8885' }}>sin token</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal enviar mensaje */}
      {sendForm && (
        <div onClick={e => { if (e.target === e.currentTarget) setSendForm(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>Mensaje manual a Sailor</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Asesor</label>
              <select value={sendForm.asesor}
                onChange={e => setSendForm(f => f ? { ...f, asesor: e.target.value } : f)}
                style={{ ...selStyle, width: '100%' }}>
                {asesores.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Mensaje</label>
              <textarea value={sendForm.contenido}
                onChange={e => setSendForm(f => f ? { ...f, contenido: e.target.value } : f)}
                rows={5} placeholder="Escribe el mensaje que verá el asesor en Sailor…"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8e6e3',
                  borderRadius: 8, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSendForm(null)}
                style={{ padding: '10px 18px', border: '1px solid #e8e6e3', borderRadius: 8,
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: '#fff' }}>
                Cancelar
              </button>
              <button onClick={enviarMensaje} disabled={sending || !sendForm.contenido.trim()}
                style={{ padding: '10px 18px', background: '#0b0a09', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', opacity: sending ? 0.6 : 1 }}>
                {sending ? 'Enviando…' : 'Guardar mensaje'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0b0a09', color: '#fff', fontSize: 13, fontWeight: 500,
          padding: '10px 22px', borderRadius: 30, zIndex: 999 }}>{toast}</div>
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 16px', fontSize: 12, verticalAlign: 'middle' }
const selStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #e8e6e3', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 6 }

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885', fontSize: 13 }}>{msg}</div>
}
function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
