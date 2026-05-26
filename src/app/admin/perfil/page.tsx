'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const DIMENSIONES = [
  { key: 'identidad_vendedora',    label: 'Identidad vendedora',       desc: '¿Cómo se percibe como vendedor/a?' },
  { key: 'relacion_prospeccion',   label: 'Relación con la prospección', desc: 'Actitud y emociones frente al proceso' },
  { key: 'modelos_mentales',       label: 'Modelos mentales',           desc: 'Creencias sobre ventas, éxito, clientes' },
  { key: 'relacion_feedback',      label: 'Relación con el feedback',   desc: 'Cómo recibe y procesa la retroalimentación' },
  { key: 'perfil_conductual_notas',label: 'Perfil conductual (notas)',  desc: 'Observaciones de estilo E/S/R/A' },
  { key: 'contexto_situacional',   label: 'Contexto situacional',       desc: 'Variables de entorno, etapa vital, equipo' },
]

type PerfilRow = {
  asesor: string
  identidad_vendedora: string | null
  relacion_prospeccion: string | null
  modelos_mentales: string | null
  relacion_feedback: string | null
  perfil_conductual_notas: string | null
  contexto_situacional: string | null
  resumen_ia: string | null
  relato_evolucion: string | null
  relato_evolucion_at: string | null
  updated_at: string | null
}

type HistorialRow = {
  id: string
  snapshot_at: string
  progresion_integrador: number | null
  confianza_perfil: number | null
  nivel_riesgo: 'activo' | 'en_riesgo' | 'critico' | null
  hipotesis_count: number
  senales_procesadas: number
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }

export default function PerfilPage() {
  const [asesores,  setAsesores]  = useState<string[]>([])
  const [selAsesor, setSelAsesor] = useState('')
  const [perfil,    setPerfil]    = useState<Partial<PerfilRow>>({})
  const [historial, setHistorial] = useState<HistorialRow[]>([])
  const [saving,    setSaving]    = useState(false)
  const [savingIA,  setSavingIA]  = useState(false)
  const [chat,      setChat]      = useState<ChatMsg[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [toast,     setToast]     = useState<{ msg: string; err?: boolean } | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    supabase.from('metas').select('asesor').order('asesor')
      .then(({ data }) => setAsesores((data ?? []).map(r => r.asesor)))
  }, [])

  async function loadPerfil(asesor: string) {
    setSelAsesor(asesor)
    setChat([])
    setPerfil({})
    setHistorial([])
    if (!asesor) return
    const [perfilRes, histRes] = await Promise.all([
      supabase.from('asesor_perfil').select('*').eq('asesor', asesor).limit(1),
      supabase.from('asesor_perfil_historial')
        .select('id, snapshot_at, progresion_integrador, confianza_perfil, nivel_riesgo, hipotesis_count, senales_procesadas')
        .eq('asesor', asesor)
        .order('snapshot_at', { ascending: true })
        .limit(20),
    ])
    if (perfilRes.data?.[0]) setPerfil(perfilRes.data[0])
    else setPerfil({ asesor })
    setHistorial(histRes.data ?? [])
  }

  async function guardar() {
    if (!selAsesor) return
    setSaving(true)
    const payload = {
      asesor:                  selAsesor,
      identidad_vendedora:     perfil.identidad_vendedora     ?? null,
      relacion_prospeccion:    perfil.relacion_prospeccion    ?? null,
      modelos_mentales:        perfil.modelos_mentales        ?? null,
      relacion_feedback:       perfil.relacion_feedback       ?? null,
      perfil_conductual_notas: perfil.perfil_conductual_notas ?? null,
      contexto_situacional:    perfil.contexto_situacional    ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('asesor_perfil').upsert(payload, { onConflict: 'asesor' })
    setSaving(false)
    if (error) { showToast('Error al guardar: ' + error.message, true); return }
    showToast('Perfil guardado.')
  }

  async function generarResumen() {
    if (!selAsesor) return
    setSavingIA(true)
    const dims = DIMENSIONES.map(d => `${d.label}:\n${perfil[d.key as keyof PerfilRow] || '(sin datos)'}`).join('\n\n')
    const prompt = `Eres un experto en coaching comercial con metodología Proxis TPS.\nGenera un resumen de perfil psicológico-conductual conciso (máx 300 palabras) del asesor ${selAsesor} basado en estas dimensiones:\n\n${dims}\n\nEl resumen debe describir la identidad, fortalezas, bloqueos y recomendaciones de coaching en lenguaje preciso y no clínico.`

    try {
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      const text = data.text ?? ''
      setPerfil(p => ({ ...p, resumen_ia: text }))
      await supabase.from('asesor_perfil').upsert({ asesor: selAsesor, resumen_ia: text, updated_at: new Date().toISOString() }, { onConflict: 'asesor' })
      showToast('Resumen IA generado y guardado.')
    } catch (e: unknown) {
      showToast('Error generando resumen: ' + (e instanceof Error ? e.message : ''), true)
    }
    setSavingIA(false)
  }

  async function sendChat() {
    if (!input.trim() || !selAsesor) return
    const userMsg = input.trim()
    setInput('')
    setSending(true)
    const newChat: ChatMsg[] = [...chat, { role: 'user', content: userMsg }]
    setChat(newChat)
    setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)

    const dims = DIMENSIONES.map(d => `${d.label}: ${perfil[d.key as keyof PerfilRow] || '(sin datos)'}`).join('\n')
    const systemContext = `Eres un experto en coaching comercial Proxis TPS calibrando el perfil ontológico-conductual del asesor ${selAsesor}.\n\nDimensiones actuales:\n${dims}\n\nEl usuario (coach) te hará preguntas o comentarios sobre el asesor. Tu tarea es ayudar a calibrar cada dimensión del perfil. Cuando tengas nuevas inferencias sobre alguna dimensión, inclúyelas en un bloque JSON al final de tu respuesta con este formato:\n\`\`\`json\n{"dimension": "nombre_clave", "valor": "texto sugerido"}\n\`\`\`\nUsa una clave por bloque. Las claves válidas son: ${DIMENSIONES.map(d => d.key).join(', ')}.`

    const history = newChat.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }))

    try {
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemContext + '\n\n', history }),
      })
      const data = await res.json()
      const text = data.text ?? '[Sin respuesta]'

      const updated = [...newChat, { role: 'assistant' as const, content: text }]
      setChat(updated)

      const jsonMatches = [...text.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
      for (const match of jsonMatches) {
        try {
          const parsed = JSON.parse(match[1]) as { dimension: string; valor: string }
          if (parsed.dimension && parsed.valor) {
            setPerfil(p => ({ ...p, [parsed.dimension]: parsed.valor }))
            setHighlight(parsed.dimension)
            setTimeout(() => setHighlight(null), 2000)
          }
        } catch { /* skip malformed */ }
      }
    } catch (e: unknown) {
      setChat(prev => [...prev, { role: 'assistant', content: 'Error: ' + (e instanceof Error ? e.message : 'desconocido') }])
    }
    setSending(false)
    setTimeout(() => chatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1300, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Perfiles de asesores</h1>
      </div>

      {/* Asesor selector */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', whiteSpace: 'nowrap' }}>
          Asesor
        </label>
        <select value={selAsesor} onChange={e => loadPerfil(e.target.value)}
          style={{ flex: 1, padding: '9px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none' }}>
          <option value="">— Selecciona un asesor —</option>
          {asesores.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {selAsesor && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, alignItems: 'start' }}>
          {/* Left: dimensions + resumen */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {DIMENSIONES.map(d => (
                <div key={d.key} style={{
                  background: '#fff', border: `1px solid ${highlight === d.key ? '#cbf135' : '#e8e6e3'}`,
                  borderRadius: 12, padding: 16,
                  transition: 'border-color 0.3s',
                  boxShadow: highlight === d.key ? '0 0 0 3px rgba(203,241,53,0.2)' : 'none',
                }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 4 }}>
                    {d.label}
                  </label>
                  <div style={{ fontSize: 11, color: '#8a8885', marginBottom: 8 }}>{d.desc}</div>
                  <textarea
                    value={perfil[d.key as keyof PerfilRow] as string ?? ''}
                    onChange={e => setPerfil(p => ({ ...p, [d.key]: e.target.value }))}
                    rows={4}
                    placeholder={`Notas sobre ${d.label.toLowerCase()}…`}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1px solid #e8e6e3', borderRadius: 8,
                      fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6,
                      color: '#0b0a09', resize: 'vertical', outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Resumen IA */}
            <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Resumen IA</div>
                  <div style={{ fontSize: 11, color: '#8a8885' }}>Síntesis generada por Gemini — se inyecta en cada mensaje al asesor</div>
                </div>
                <button onClick={generarResumen} disabled={savingIA} style={{
                  padding: '7px 14px', background: '#0b0a09', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: savingIA ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: savingIA ? 0.6 : 1,
                }}>{savingIA ? 'Generando…' : '✨ Generar'}</button>
              </div>
              <textarea
                value={perfil.resumen_ia ?? ''}
                onChange={e => setPerfil(p => ({ ...p, resumen_ia: e.target.value }))}
                rows={5}
                placeholder="El resumen generado por IA aparecerá aquí. También puedes editarlo manualmente."
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #e8e6e3', borderRadius: 8,
                  fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65,
                  color: '#0b0a09', resize: 'vertical', outline: 'none',
                }}
              />
            </div>

            {/* Evolución del perfil */}
            {historial.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Evolución del perfil</div>
                <div style={{ fontSize: 11, color: '#8a8885', marginBottom: 16 }}>
                  {historial.length} ciclos de análisis registrados
                </div>

                {/* Sparkline */}
                <Sparkline rows={historial} />

                {/* Timeline de riesgo */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                  {historial.map((h, i) => (
                    <div key={h.id} title={`${h.snapshot_at.slice(0,10)} — ${h.nivel_riesgo ?? '?'}`}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: h.nivel_riesgo === 'critico' ? '#b03a3a' : h.nivel_riesgo === 'en_riesgo' ? '#a8691a' : '#1f6f56',
                        border: i === historial.length - 1 ? '2px solid #0b0a09' : '2px solid transparent',
                      }} />
                      {i === 0 || i === historial.length - 1 ? (
                        <span style={{ fontSize: 9, color: '#8a8885' }}>{h.snapshot_at.slice(5,10)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  {[{ color: '#1f6f56', label: 'Activo' }, { color: '#a8691a', label: 'En riesgo' }, { color: '#b03a3a', label: 'Crítico' }].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: 10, color: '#8a8885' }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Relato de evolución */}
                {perfil.relato_evolucion ? (
                  <div style={{ marginTop: 16, padding: '14px 16px', background: '#fafaf7', borderRadius: 10, border: '1px solid #e8e6e3' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0b0a09' }}>Relato IA de evolución</span>
                      {perfil.relato_evolucion_at && (
                        <span style={{ fontSize: 10, color: '#8a8885' }}>
                          Generado {new Date(perfil.relato_evolucion_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.7, color: '#2b2926', margin: 0 }}>
                      {perfil.relato_evolucion}
                    </p>
                  </div>
                ) : historial.length >= 3 ? (
                  <div style={{ marginTop: 14, fontSize: 12, color: '#8a8885', fontStyle: 'italic' }}>
                    El relato de evolución se generará automáticamente en el próximo ciclo del analizador (domingo 22:00 UTC).
                  </div>
                ) : (
                  <div style={{ marginTop: 14, fontSize: 12, color: '#8a8885', fontStyle: 'italic' }}>
                    Se necesitan al menos 3 ciclos de análisis para generar el relato de evolución ({3 - historial.length} más).
                  </div>
                )}
              </div>
            )}

            {/* Save bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
              {perfil.updated_at && (
                <span style={{ fontSize: 11, color: '#8a8885' }}>
                  Guardado: {new Date(perfil.updated_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={guardar} disabled={saving} style={{
                padding: '10px 22px', background: '#0b0a09', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Guardando…' : 'Guardar perfil'}</button>
            </div>
          </div>

          {/* Right: Chat calibration */}
          <div style={{
            background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12,
            display: 'flex', flexDirection: 'column', height: 700,
            position: 'sticky', top: 20,
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e6e3' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Calibración IA</div>
              <div style={{ fontSize: 11, color: '#8a8885' }}>Conversa con Gemini para calibrar el perfil. Las sugerencias se aplican automáticamente.</div>
            </div>

            <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chat.length === 0 && (
                <div style={{ textAlign: 'center', color: '#8a8885', fontSize: 12, padding: '20px 0' }}>
                  Empieza describiendo comportamientos, anécdotas o situaciones del asesor.
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? '#0b0a09' : '#f5f3ef',
                  color: m.role === 'user' ? '#fff' : '#0b0a09',
                  borderRadius: 12, padding: '10px 14px', fontSize: 12, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>{m.content}</div>
              ))}
              {sending && (
                <div style={{ alignSelf: 'flex-start', background: '#f5f3ef', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#8a8885' }}>
                  ⏳ Pensando…
                </div>
              )}
            </div>

            <div style={{ padding: 12, borderTop: '1px solid #e8e6e3', display: 'flex', gap: 8 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                placeholder="Describe un comportamiento, anécdota o reacción del asesor…"
                rows={2}
                style={{
                  flex: 1, padding: '10px 12px', border: '1px solid #e8e6e3',
                  borderRadius: 8, fontFamily: 'inherit', fontSize: 12, resize: 'none', outline: 'none',
                }}
              />
              <button onClick={sendChat} disabled={sending || !input.trim()} style={{
                padding: '0 16px', background: '#cbf135', color: '#0b0a09',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !input.trim() ? 0.5 : 1,
              }}>↑</button>
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

function Sparkline({ rows }: { rows: HistorialRow[] }) {
  if (rows.length < 2) return null
  const W = 400, H = 80, PAD = 8
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2

  function toPoints(values: (number | null)[], color: string) {
    const filled = values.map(v => v ?? 0)
    const pts = filled.map((v, i) => {
      const x = PAD + (i / (filled.length - 1)) * innerW
      const y = PAD + innerH - (v / 100) * innerH
      return `${x},${y}`
    })
    return (
      <polyline
        points={pts.join(' ')}
        fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"
      />
    )
  }

  const progValues = rows.map(r => r.progresion_integrador)
  const confValues = rows.map(r => r.confianza_perfil)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: H, display: 'block' }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = PAD + innerH - (pct / 100) * innerH
          return <line key={pct} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#e8e6e3" strokeWidth="0.5" />
        })}
        {toPoints(progValues, '#1f6f56')}
        {toPoints(confValues, '#1a56c4')}
        {/* Dots at last point */}
        {(() => {
          const last = rows[rows.length - 1]
          const x = W - PAD
          const yProg = PAD + innerH - ((last.progresion_integrador ?? 0) / 100) * innerH
          const yConf = PAD + innerH - ((last.confianza_perfil ?? 0) / 100) * innerH
          return <>
            <circle cx={x} cy={yProg} r={3} fill="#1f6f56" />
            <circle cx={x} cy={yConf} r={3} fill="#1a56c4" />
          </>
        })()}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 2, background: '#1f6f56', borderRadius: 1 }} />
          <span style={{ fontSize: 10, color: '#4a4844' }}>Progresión integrador</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 2, background: '#1a56c4', borderRadius: 1 }} />
          <span style={{ fontSize: 10, color: '#4a4844' }}>Confianza perfil</span>
        </div>
      </div>
    </div>
  )
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
