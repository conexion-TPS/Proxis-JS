'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LegalGate from '@/components/LegalGate'

type AsesorRow = {
  asesor: string; daysSince: number; msgs7d: number
  signals7d: number; urgency: number; lastMsg: string | null; nodo: string | null
}
type EquipoRow = { nodo: string; nodo_id: string; total: number; urgenciaPromedio: number }
type MensajeRow = { id: string; trigger_id: string | null; descripcion: string; resumen: string; fecha: string; score: number | null }

export default function EquipoDashboard() {
  const router = useRouter()
  const [nombre,      setNombre]      = useState('')
  const [email,       setEmail]       = useState('')
  const [usuarioId,   setUsuarioId]   = useState('')
  const [legalOk,     setLegalOk]     = useState(false)
  const [tipo,        setTipo]        = useState<'supervisor' | 'director'>('supervisor')
  const [asesores,   setAsesores]   = useState<AsesorRow[]>([])
  const [equipos,    setEquipos]    = useState<EquipoRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [mensajes,   setMensajes]   = useState<Record<string, MensajeRow[]>>({})
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)
  const [token,      setToken]      = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('equipo_session')
    if (!raw) { router.push('/equipo/login'); return }
    const session = JSON.parse(raw)
    setNombre(session.nombre ?? '')
    setEmail(session.email ?? '')
    setUsuarioId(session.usuario_id ?? '')
    setToken(session.token ?? '')
    // Check if supervisor accepted terms
    fetch(`/api/legal/check?tipo=terminos_supervisor&org_usuario_id=${session.usuario_id}`)
      .then(r => r.json())
      .then(d => { if (d.acepto) setLegalOk(true) })
      .catch(() => setLegalOk(true))

    fetch('/api/equipo/dashboard', {
      headers: { Authorization: `Bearer ${session.token}` },
    }).then(async r => {
      if (r.status === 401) { localStorage.removeItem('equipo_session'); router.push('/equipo/login'); return }
      const json = await r.json()
      setTipo(json.tipo ?? 'supervisor')
      setAsesores(json.asesores ?? [])
      setEquipos(json.equipos ?? [])
      setLoading(false)
    }).catch(() => { setError('Error al cargar datos'); setLoading(false) })
  }, [router])

  function salir() {
    localStorage.removeItem('equipo_session')
    router.push('/equipo/login')
  }

  async function toggleAsesor(asesor: string) {
    if (expanded === asesor) { setExpanded(null); return }
    setExpanded(asesor)
    if (mensajes[asesor]) return
    setLoadingMsg(asesor)
    const res = await fetch(`/api/equipo/mensajes?asesor=${encodeURIComponent(asesor)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    setMensajes(prev => ({ ...prev, [asesor]: json.mensajes ?? [] }))
    setLoadingMsg(null)
  }

  async function darFeedback(asesor: string, messageId: string, score: number) {
    setMensajes(prev => ({
      ...prev,
      [asesor]: (prev[asesor] ?? []).map(m => m.id === messageId ? { ...m, score } : m),
    }))
    await fetch('/api/equipo/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message_id: messageId, score }),
    })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf7' }}>
      <span style={{ color: '#8a8885', fontSize: 14 }}>Cargando tu equipo…</span>
    </div>
  )

  if (!legalOk) return (
    <LegalGate
      tipo="terminos_supervisor"
      plataforma="equipo"
      orgUsuarioId={usuarioId}
      email={email}
      onAceptado={() => setLegalOk(true)}
    />
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf7' }}>
      {/* Header */}
      <div style={{ background: '#0b0a09', padding: '0 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#cbf135', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Proxis</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Mi equipo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{nombre}</span>
            <button onClick={salir} style={{
              padding: '5px 12px', background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            }}>Salir</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {error && <div style={{ background: '#fde8e8', border: '1px solid #f5c6c6', borderRadius: 10, padding: '12px 16px', color: '#b03a3a', fontSize: 13, marginBottom: 20 }}>{error}</div>}

        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
          {tipo === 'director' ? 'Vista de dirección' : 'Mi equipo hoy'}
        </h1>
        <p style={{ fontSize: 13, color: '#8a8885', marginBottom: 28 }}>
          {tipo === 'director'
            ? 'Tus equipos ordenados por urgencia promedio'
            : 'Asesores ordenados por quién necesita más atención ahora'}
        </p>

        {/* Director: equipo summary cards */}
        {tipo === 'director' && equipos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
            {equipos.map(eq => (
              <div key={eq.nodo_id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{eq.nodo}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: urgColor(eq.urgenciaPromedio), marginBottom: 2 }}>
                  {eq.urgenciaPromedio}
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8885', marginLeft: 4 }}>urgencia</span>
                </div>
                <div style={{ fontSize: 11, color: '#8a8885' }}>{eq.total} asesor{eq.total !== 1 ? 'es' : ''}</div>
              </div>
            ))}
          </div>
        )}

        {/* Advisor list */}
        {asesores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885', fontSize: 14 }}>
            Sin asesores asignados a tu equipo todavía.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {asesores.map((a, i) => {
              const level = a.urgency > 30 ? 'alta' : a.urgency > 15 ? 'media' : 'baja'
              const levelColor = level === 'alta' ? '#b03a3a' : level === 'media' ? '#a8691a' : '#1f6f56'
              const levelBg    = level === 'alta' ? '#fde8e8' : level === 'media' ? '#fef3cd' : '#e6f3ed'
              const isOpen = expanded === a.asesor
              const msgs   = mensajes[a.asesor] ?? []
              return (
                <div key={a.asesor} style={{ background: '#fff', border: `1px solid ${isOpen ? 'rgba(203,241,53,0.5)' : '#e8e6e3'}`, borderRadius: 12, overflow: 'hidden' }}>
                  {/* Fila principal */}
                  <div onClick={() => toggleAsesor(a.asesor)} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f5f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#8a8885', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{a.asesor}</span>
                        {a.nodo && <span style={{ fontSize: 10, color: '#8a8885', background: '#f5f3ef', padding: '2px 7px', borderRadius: 20 }}>{a.nodo}</span>}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: levelBg, color: levelColor }}>
                          {level === 'alta' ? '⚠ Atención alta' : level === 'media' ? '◉ Atención media' : '✓ Al día'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#8a8885' }}>
                        <span>{a.daysSince === 99 ? 'Sin mensajes registrados' : a.daysSince === 0 ? 'Activo hoy' : `Último mensaje hace ${a.daysSince}d`}</span>
                        <span>{a.msgs7d} mensaje{a.msgs7d !== 1 ? 's' : ''} esta semana</span>
                        {a.signals7d > 0 && <span style={{ color: '#a8691a' }}>{a.signals7d} señal{a.signals7d !== 1 ? 'es' : ''} pendientes</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: urgColor(a.urgency) }}>{a.urgency}</div>
                        <div style={{ fontSize: 9, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.06em' }}>urgencia</div>
                      </div>
                      <span style={{ fontSize: 12, color: '#c8c6c3' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Panel expandible — últimos mensajes */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f5f3ef', background: '#fafaf7', padding: '12px 20px' }}>
                      {loadingMsg === a.asesor ? (
                        <div style={{ fontSize: 12, color: '#8a8885', padding: '8px 0' }}>Cargando mensajes…</div>
                      ) : msgs.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#8a8885', padding: '8px 0' }}>Sin mensajes enviados aún.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                            Últimos mensajes del coach — ¿fueron oportunos?
                          </div>
                          {msgs.map(m => (
                            <div key={m.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#0b0a09', marginBottom: 2 }}>{m.descripcion}</div>
                                {m.resumen && <div style={{ fontSize: 11, color: '#8a8885', lineHeight: 1.5 }}>{m.resumen}</div>}
                                <div style={{ fontSize: 10, color: '#c8c6c3', marginTop: 4 }}>
                                  {new Date(m.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button onClick={() => darFeedback(a.asesor, m.id, 1)}
                                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                                    background: m.score === 1 ? '#e6f3ed' : '#fff',
                                    borderColor: m.score === 1 ? '#1f6f56' : '#e8e6e3',
                                    color: m.score === 1 ? '#1f6f56' : '#8a8885' }}>
                                  ✓ Oportuno
                                </button>
                                <button onClick={() => darFeedback(a.asesor, m.id, -1)}
                                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                                    background: m.score === -1 ? '#fde8e8' : '#fff',
                                    borderColor: m.score === -1 ? '#b03a3a' : '#e8e6e3',
                                    color: m.score === -1 ? '#b03a3a' : '#8a8885' }}>
                                  ✗ No era el momento
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 32, fontSize: 11, color: '#c8c6c3', textAlign: 'center' }}>
          Urgencia = días sin mensaje (×3) + señales sin procesar (×2) + actividad semanal baja<br/>
          Actualizado al {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

function urgColor(u: number) {
  return u > 30 ? '#b03a3a' : u > 15 ? '#a8691a' : '#1f6f56'
}
