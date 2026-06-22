'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import LegalGate from '@/components/LegalGate'
import { supabase } from '@/lib/supabase'
import CapturaIngreso from './CapturaIngreso'

type AsesorRow = {
  asesor: string; daysSince: number; msgs7d: number
  urgency: number; sinValorar: number; lastMsg: string | null
  nodo: string | null; nodo_id: string | null
}
type NodoRow = { id: string; parent_id: string | null; nombre: string; titulo_propio: string | null; cargo_nombre: string | null }
type SupRow  = { id: string; nombre: string; org_nodo_id: string | null; cargo: string | null }
type MensajeRow = { id: string; trigger_id: string | null; descripcion: string; cuerpo: string; fecha: string; score: number | null }
type Session = { token: string; nombre?: string; email?: string; usuario_id?: string; cargo?: string; isAdmin?: boolean }
type ObsOpcion = { texto: string; perfil_hint: string }
type ObsItem = { dimension: string | null; stem: string; basis: string | null; opciones: ObsOpcion[]; deduction_id: string | null }
type Frecuencia = 'una_vez' | 'a_veces' | 'casi_siempre'
const FREQ_LABEL: Record<Frecuencia, string> = { una_vez: 'Lo vi una vez', a_veces: 'A veces', casi_siempre: 'Casi siempre' }

/* ── helpers de árbol ── */
function childrenOf(nodos: NodoRow[], parentId: string | null) {
  return nodos.filter(n => n.parent_id === parentId)
}
function descendants(nodos: NodoRow[], id: string): NodoRow[] {
  const direct = childrenOf(nodos, id)
  return direct.flatMap(n => [n, ...descendants(nodos, n.id)])
}
function subtreeIds(nodos: NodoRow[], id: string) {
  return new Set([id, ...descendants(nodos, id).map(n => n.id)])
}

export default function EquipoDashboard() {
  const router = useRouter()
  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [legalOk,   setLegalOk]   = useState(false)
  const [tipo,      setTipo]      = useState<'supervisor' | 'director'>('supervisor')
  const [asesores,  setAsesores]  = useState<AsesorRow[]>([])
  const [nodos,     setNodos]     = useState<NodoRow[]>([])
  const [sups,      setSups]      = useState<SupRow[]>([])
  const [rootId,    setRootId]    = useState<string | null>(null)
  const [selNode,   setSelNode]   = useState<string | null>(null)   // null = todo el equipo
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [mensajes,  setMensajes]  = useState<Record<string, MensajeRow[]>>({})
  const [loadingMsg,setLoadingMsg]= useState<string | null>(null)
  const [token,     setToken]     = useState('')
  // Observación del supervisor (lectura de primera mano que afina el perfil)
  const [observacion, setObservacion] = useState<Record<string, ObsItem | null>>({})
  const [obsLoading,  setObsLoading]  = useState<string | null>(null)
  const [obsDone,     setObsDone]     = useState<Record<string, boolean>>({})
  const [obsSel,      setObsSel]      = useState<number | null>(null)
  const [obsFreq,     setObsFreq]     = useState<Frecuencia>('a_veces')

  // FUENTE ÚNICA DE VERDAD del dashboard. Todos los agregados (banner "sin valorar",
  // badges por asesor, urgencia, conteos del árbol) salen de aquí. Tras cualquier
  // mutación se vuelve a llamar en modo `silent` para reconciliar con el servidor:
  // así ningún contador depende de matemática a mano y no se desincroniza.
  const cargarDashboard = useCallback(async (tok: string, silent = false) => {
    try {
      const r = await fetch('/api/equipo/dashboard', { headers: { Authorization: `Bearer ${tok}` } })
      if (r.status === 401) { localStorage.removeItem('equipo_session'); router.push('/equipo/login'); return }
      const json = await r.json()
      setTipo(json.tipo ?? 'supervisor')
      setAsesores(json.asesores ?? [])
      setNodos(json.nodos ?? [])
      setSups(json.supervisores ?? [])
      setRootId(json.rootId ?? null)
    } catch {
      if (!silent) setError('Error al cargar datos')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [router])

  useEffect(() => {
    function arrancar(session: Session) {
      setNombre(session.nombre ?? '')
      setEmail(session.email ?? '')
      setUsuarioId(session.usuario_id ?? '')
      setToken(session.token ?? '')
      // El admin (vista god) no pasa por los términos de supervisor
      if (session.isAdmin || session.cargo === 'admin') {
        setLegalOk(true)
      } else {
        fetch(`/api/legal/check?tipo=terminos_supervisor&org_usuario_id=${session.usuario_id}`)
          .then(r => r.json())
          .then(d => { if (d.acepto) setLegalOk(true) })
          .catch(() => setLegalOk(true))
      }
      cargarDashboard(session.token)
    }

    const raw = localStorage.getItem('equipo_session')
    if (raw) { arrancar(JSON.parse(raw)); return }

    // Puente admin → portal equipo: si hay sesión GoTrue admin, canjear un token de vista total.
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session
      if (s && s.user?.app_metadata?.cargo === 'admin') {
        fetch('/api/equipo/admin-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
          body: '{}',
        })
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(j => {
            const session: Session = { token: j.token, nombre: j.nombre, email: j.email, usuario_id: j.usuario_id, cargo: j.cargo, isAdmin: true }
            localStorage.setItem('equipo_session', JSON.stringify(session))
            arrancar(session)
          })
          .catch(() => router.push('/equipo/login'))
      } else {
        router.push('/equipo/login')
      }
    })
  }, [router, cargarDashboard])

  function salir() {
    localStorage.removeItem('equipo_session')
    router.push('/equipo/login')
  }

  async function toggleAsesor(asesor: string) {
    if (expanded === asesor) { setExpanded(null); return }
    setExpanded(asesor)
    setObsSel(null); setObsFreq('a_veces')

    if (!mensajes[asesor]) {
      setLoadingMsg(asesor)
      fetch(`/api/equipo/mensajes?asesor=${encodeURIComponent(asesor)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(json => setMensajes(prev => ({ ...prev, [asesor]: json.mensajes ?? [] })))
        .finally(() => setLoadingMsg(null))
    }

    if (observacion[asesor] === undefined && !obsDone[asesor]) {
      setObsLoading(asesor)
      fetch(`/api/equipo/observacion?asesor=${encodeURIComponent(asesor)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(json => setObservacion(prev => ({ ...prev, [asesor]: json.item ?? null })))
        .catch(() => setObservacion(prev => ({ ...prev, [asesor]: null })))
        .finally(() => setObsLoading(null))
    }
  }

  async function enviarObservacion(asesor: string) {
    const item = observacion[asesor]
    if (!item || obsSel === null) return
    const opcion = item.opciones[obsSel]
    setObsDone(prev => ({ ...prev, [asesor]: true }))
    await fetch('/api/equipo/observacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        asesor, dimension: item.dimension, opcion_texto: opcion.texto,
        perfil_hint: opcion.perfil_hint, frecuencia: obsFreq, deduction_id: item.deduction_id, stem: item.stem,
      }),
    })
    // Reconciliar con el servidor (fuente única) — cualquier agregado se actualiza solo.
    cargarDashboard(token, true)
  }

  async function darFeedback(asesor: string, messageId: string, score: number) {
    const prevScore = (mensajes[asesor] ?? []).find(m => m.id === messageId)?.score ?? null
    // Solo baja el contador si el mensaje pasa de SIN valorar a valorado
    // (revalorar uno ya valorado no cambia el total).
    const eraSinValorar = prevScore == null
    setMensajes(prev => ({
      ...prev,
      [asesor]: (prev[asesor] ?? []).map(m => m.id === messageId ? { ...m, score } : m),
    }))
    if (eraSinValorar) {
      setAsesores(prev => prev.map(a =>
        a.asesor === asesor ? { ...a, sinValorar: Math.max(0, (a.sinValorar ?? 0) - 1) } : a))
    }
    try {
      const r = await fetch('/api/equipo/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: messageId, score }),
      })
      if (!r.ok) throw new Error()
      // Reconciliar el dashboard con el servidor: el optimista de arriba es solo para
      // la respuesta instantánea; la verdad de los contadores la fija este refetch.
      cargarDashboard(token, true)
    } catch {
      // Revertir mensaje y contador si no se pudo guardar (sin confirmación falsa)
      setMensajes(prev => ({
        ...prev,
        [asesor]: (prev[asesor] ?? []).map(m => m.id === messageId ? { ...m, score: prevScore } : m),
      }))
      if (eraSinValorar) {
        setAsesores(prev => prev.map(a =>
          a.asesor === asesor ? { ...a, sinValorar: (a.sinValorar ?? 0) + 1 } : a))
      }
    }
  }

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf7' }}>
      <span style={{ color: '#8a8885', fontSize: 14 }}>Cargando tu equipo…</span>
    </div>
  )

  if (!legalOk) return (
    <LegalGate tipo="terminos_supervisor" plataforma="equipo" orgUsuarioId={usuarioId} email={email} onAceptado={() => setLegalOk(true)} />
  )

  // ¿Hay sub-equipos que navegar? (el nodo del usuario tiene hijos)
  const hasTree = childrenOf(nodos, rootId).length > 0

  // Asesores visibles según nodo seleccionado
  const visibles = selNode
    ? (() => { const ids = subtreeIds(nodos, selNode); return asesores.filter(a => a.nodo_id && ids.has(a.nodo_id)) })()
    : asesores

  // Estadística por nodo (para los badges del árbol)
  function nodeStats(nodeId: string) {
    const ids = subtreeIds(nodos, nodeId)
    const m = asesores.filter(a => a.nodo_id && ids.has(a.nodo_id))
    return { total: m.length, avg: m.length ? Math.round(m.reduce((s, x) => s + x.urgency, 0) / m.length) : 0 }
  }

  // Mensajes del coach sin valorar (en el alcance visible)
  const totalSinValorar = visibles.reduce((s, a) => s + (a.sinValorar ?? 0), 0)

  // Migas de pan del nodo seleccionado
  const breadcrumb: NodoRow[] = []
  if (selNode) {
    let cur: NodoRow | undefined = nodos.find(n => n.id === selNode)
    while (cur) { breadcrumb.unshift(cur); cur = cur.parent_id ? nodos.find(n => n.id === cur!.parent_id) : undefined }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf7' }}>
      {/* Header */}
      <div style={{ background: '#0b0a09', padding: '0 32px' }}>
        <div style={{ maxWidth: hasTree ? 1180 : 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
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

      <div style={{ maxWidth: hasTree ? 1180 : 900, margin: '0 auto', padding: '32px 24px' }}>
        {error && <div style={{ background: '#fde8e8', border: '1px solid #f5c6c6', borderRadius: 10, padding: '12px 16px', color: '#b03a3a', fontSize: 13, marginBottom: 20 }}>{error}</div>}

        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
          {tipo === 'director' ? 'Vista de dirección' : 'Mi equipo hoy'}
        </h1>
        <p style={{ fontSize: 13, color: '#8a8885', marginBottom: 24 }}>
          {hasTree
            ? 'Elige un equipo en el árbol para ver sus asesores, o revisa todos juntos.'
            : 'Asesores ordenados por quién necesita más atención ahora'}
        </p>

        <div style={{ display: hasTree ? 'grid' : 'block', gridTemplateColumns: hasTree ? '320px 1fr' : undefined, gap: 24, alignItems: 'start' }}>
          {/* ── Navegador de árbol ── */}
          {hasTree && (
            <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '14px 12px', position: 'sticky', top: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 6px 10px' }}>Equipos</div>
              {/* Todo mi equipo */}
              <button onClick={() => setSelNode(null)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                padding: '8px 10px', marginBottom: 4, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${selNode === null ? 'rgba(203,241,53,0.6)' : 'transparent'}`,
                background: selNode === null ? 'rgba(203,241,53,0.14)' : 'transparent',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0b0a09' }}>Todo mi equipo</span>
                <span style={{ fontSize: 11, color: '#8a8885' }}>{asesores.length}</span>
              </button>
              {childrenOf(nodos, rootId).map(n => (
                <TeamNode key={n.id} nodo={n} depth={0} nodos={nodos} sups={sups}
                  selNode={selNode} onSelect={setSelNode}
                  collapsed={collapsed} onToggle={toggleCollapse} stats={nodeStats} />
              ))}
            </div>
          )}

          {/* ── Lista de asesores ── */}
          <div>
            {/* F2c — Captura mensual de ingreso (cola del subárbol, vía /api/equipo/captura-ingreso) */}
            <CapturaIngreso token={token} />
            {totalSinValorar > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef6e6', border: '1px solid #f3d9a4', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <span style={{ fontSize: 18 }}>📝</span>
                <div style={{ fontSize: 12.5, color: '#8a6212', lineHeight: 1.5 }}>
                  Tienes <strong>{totalSinValorar}</strong> mensaje{totalSinValorar !== 1 ? 's' : ''} de Sailor Mentor sin valorar.
                  <span style={{ color: '#a8691a' }}> Marcar “oportuno / no era el momento” en cada uno me enseña cuándo acerté con tu gente — toma segundos al abrir cada asesor.</span>
                </div>
              </div>
            )}
            {hasTree && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, fontSize: 13, color: '#8a8885', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#0b0a09' }}>Viendo:</span>
                {selNode === null
                  ? <span>Todo mi equipo</span>
                  : breadcrumb.map((b, i) => (
                      <span key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {i > 0 && <span style={{ color: '#c8c6c3' }}>›</span>}
                        <button onClick={() => setSelNode(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: i === breadcrumb.length - 1 ? '#0b0a09' : '#1a56c4', fontWeight: i === breadcrumb.length - 1 ? 700 : 500, padding: 0 }}>{b.nombre}</button>
                      </span>
                    ))}
                <span style={{ marginLeft: 6, color: '#c8c6c3' }}>· {visibles.length} asesor{visibles.length !== 1 ? 'es' : ''}</span>
              </div>
            )}

            {visibles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#8a8885', fontSize: 14 }}>
                {asesores.length === 0 ? 'Sin asesores asignados a tu equipo todavía.' : 'Este equipo no tiene asesores asignados.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visibles.map((a, i) => {
                  const level = a.urgency > 30 ? 'alta' : a.urgency > 15 ? 'media' : 'baja'
                  const levelColor = level === 'alta' ? '#b03a3a' : level === 'media' ? '#a8691a' : '#1f6f56'
                  const levelBg    = level === 'alta' ? '#fde8e8' : level === 'media' ? '#fef3cd' : '#e6f3ed'
                  const isOpen = expanded === a.asesor
                  const msgs   = mensajes[a.asesor] ?? []
                  return (
                    <div key={a.asesor} style={{ background: '#fff', border: `1px solid ${isOpen ? 'rgba(203,241,53,0.5)' : '#e8e6e3'}`, borderRadius: 12, overflow: 'hidden' }}>
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
                          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#8a8885', flexWrap: 'wrap' }}>
                            <span>{a.daysSince === 99 ? 'Sin mensajes registrados' : a.daysSince === 0 ? 'Activo hoy' : `Último mensaje hace ${a.daysSince}d`}</span>
                            <span>{a.msgs7d} mensaje{a.msgs7d !== 1 ? 's' : ''} esta semana</span>
                            {a.sinValorar > 0 && (
                              <span style={{ color: '#a8691a', fontWeight: 600 }}>📝 {a.sinValorar} sin valorar</span>
                            )}
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

                      {isOpen && (
                        <div style={{ borderTop: '1px solid #f5f3ef', background: '#fafaf7', padding: '12px 20px' }}>
                          {loadingMsg === a.asesor ? (
                            <div style={{ fontSize: 12, color: '#8a8885', padding: '8px 0' }}>Cargando mensajes…</div>
                          ) : msgs.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#8a8885', padding: '8px 0' }}>Sin mensajes enviados aún.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                                Últimos mensajes de Sailor Mentor — ¿fueron oportunos?
                              </div>
                              {msgs.map(m => (
                                <div key={m.id} style={{ background: '#fff', border: `1px solid ${m.score == null ? '#f3d9a4' : '#e8e6e3'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ fontSize: 12, fontWeight: 600, color: '#0b0a09' }}>{m.descripcion}</span>
                                      {m.score == null && <span style={{ fontSize: 9, fontWeight: 700, color: '#a8691a', background: '#fef6e6', padding: '1px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sin valorar</span>}
                                    </div>
                                    {m.cuerpo && <div style={{ fontSize: 12, color: '#4a4844', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.cuerpo}</div>}
                                    <div style={{ fontSize: 10, color: '#c8c6c3', marginTop: 4 }}>
                                      {new Date(m.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
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
                                    {m.score != null && (
                                      <span style={{ fontSize: 10, color: '#1f6f56', fontWeight: 600 }}>✓ ¡Gracias! Tu valoración quedó registrada</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Tu lectura del supervisor — afina el perfil */}
                          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed #e0ddd8' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8885', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                              Tu lectura de {a.asesor.split(' ')[0]}
                              <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#c8c6c3' }}> · revisable, no es un test</span>
                            </div>
                            {obsDone[a.asesor] ? (
                              <div style={{ fontSize: 12, color: '#1f6f56' }}>Gracias — tu lectura entra al perfil de {a.asesor.split(' ')[0]} como una pista más (no concluyente).</div>
                            ) : obsLoading === a.asesor ? (
                              <div style={{ fontSize: 12, color: '#8a8885' }}>Preparando una observación…</div>
                            ) : !observacion[a.asesor] ? (
                              <div style={{ fontSize: 12, color: '#c8c6c3' }}>Sin observación sugerida por ahora.</div>
                            ) : (
                              <div>
                                {observacion[a.asesor]!.basis && (
                                  <div style={{ fontSize: 11, color: '#a8691a', marginBottom: 6 }}>{observacion[a.asesor]!.basis}</div>
                                )}
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0b0a09', marginBottom: 10 }}>{observacion[a.asesor]!.stem}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                  {observacion[a.asesor]!.opciones.map((op, idx) => (
                                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                                      border: `1px solid ${obsSel === idx ? 'rgba(203,241,53,0.7)' : '#e8e6e3'}`, background: obsSel === idx ? 'rgba(203,241,53,0.12)' : '#fff' }}>
                                      <input type="radio" name={`obs-${a.asesor}`} checked={obsSel === idx} onChange={() => setObsSel(idx)} />
                                      <span style={{ fontSize: 12.5, color: '#0b0a09' }}>{op.texto}</span>
                                    </label>
                                  ))}
                                </div>
                                {obsSel !== null && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#8a8885', flexWrap: 'wrap' }}>
                                    <span>¿Qué tan seguido lo has visto?</span>
                                    {(['una_vez', 'a_veces', 'casi_siempre'] as Frecuencia[]).map(f => (
                                      <button key={f} onClick={() => setObsFreq(f)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                                        border: `1px solid ${obsFreq === f ? '#1f6f56' : '#e8e6e3'}`, background: obsFreq === f ? '#e6f3ed' : '#fff', color: obsFreq === f ? '#1f6f56' : '#8a8885' }}>
                                        {FREQ_LABEL[f]}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => enviarObservacion(a.asesor)} disabled={obsSel === null}
                                    style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: obsSel === null ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                                      background: '#0b0a09', color: '#fff', opacity: obsSel === null ? 0.4 : 1 }}>
                                    Aportar lectura
                                  </button>
                                  <button onClick={() => setObsDone(prev => ({ ...prev, [a.asesor]: true }))}
                                    style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e8e6e3', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: '#fff', color: '#8a8885' }}>
                                    No lo he visto
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: 32, fontSize: 11, color: '#c8c6c3', textAlign: 'center' }}>
              Urgencia = días sin mensaje del coach (×3) + actividad semanal baja<br/>
              Actualizado al {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Nodo del navegador de árbol (recursivo) ──────────────────────────────────
function TeamNode({ nodo, depth, nodos, sups, selNode, onSelect, collapsed, onToggle, stats }: {
  nodo: NodoRow; depth: number; nodos: NodoRow[]; sups: SupRow[]
  selNode: string | null; onSelect: (id: string) => void
  collapsed: Set<string>; onToggle: (id: string) => void
  stats: (id: string) => { total: number; avg: number }
}) {
  const children   = childrenOf(nodos, nodo.id)
  const holder     = sups.find(s => s.org_nodo_id === nodo.id)
  const isCol      = collapsed.has(nodo.id)
  const isSel      = selNode === nodo.id
  const { total, avg } = stats(nodo.id)

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', marginLeft: depth * 14, marginBottom: 2,
        borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${isSel ? 'rgba(203,241,53,0.6)' : 'transparent'}`,
        background: isSel ? 'rgba(203,241,53,0.14)' : 'transparent',
      }} onClick={() => onSelect(nodo.id)}>
        {children.length > 0
          ? <span onClick={e => { e.stopPropagation(); onToggle(nodo.id) }} style={{ width: 12, fontSize: 9, color: '#aaa', textAlign: 'center' }}>{isCol ? '▶' : '▼'}</span>
          : <span style={{ width: 12 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0b0a09', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nodo.nombre}</div>
          <div style={{ fontSize: 10, color: '#8a8885', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {holder ? holder.nombre : (nodo.cargo_nombre ? `${nodo.cargo_nombre} · vacante` : 'vacante')}
          </div>
        </div>
        {total > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: urgBg(avg), color: urgColor(avg), flexShrink: 0 }}>
            {total} · {avg}
          </span>
        )}
      </div>
      {!isCol && children.map(c => (
        <TeamNode key={c.id} nodo={c} depth={depth + 1} nodos={nodos} sups={sups}
          selNode={selNode} onSelect={onSelect} collapsed={collapsed} onToggle={onToggle} stats={stats} />
      ))}
    </div>
  )
}

function urgColor(u: number) { return u > 30 ? '#b03a3a' : u > 15 ? '#a8691a' : '#1f6f56' }
function urgBg(u: number)    { return u > 30 ? '#fde8e8' : u > 15 ? '#fef3cd' : '#e6f3ed' }
