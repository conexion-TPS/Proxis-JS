'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Dim = { key: string; label: string; desc: string; sensible?: boolean }

// Dimensiones narrativas EDITABLES del perfil. `resiliencia` (score f4) NO está aquí: es un
// puntaje, no prosa — se presenta aparte en SOLO-LECTURA (Corrección 2). Las marcadas `sensible`
// (🔒) nunca entran al prompt del Resumen IA, que sí ve el supervisor (Corrección 1).
const DIMENSIONES: Dim[] = [
  { key: 'identidad_vendedora',    label: 'Identidad vendedora',       desc: '¿Cómo se percibe como vendedor/a?' },
  { key: 'relacion_prospeccion',   label: 'Relación con la prospección', desc: 'Actitud y emociones frente al proceso' },
  { key: 'modelos_mentales',       label: 'Modelos mentales',           desc: 'Creencias sobre ventas, éxito, clientes' },
  { key: 'relacion_feedback',      label: 'Relación con el feedback',   desc: 'Cómo recibe y procesa la retroalimentación' },
  { key: 'perfil_conductual_notas',label: 'Perfil conductual (notas)',  desc: 'Observaciones de estilo E/S/R/A' },
  { key: 'contexto_situacional',   label: 'Contexto situacional',       desc: 'Variables de entorno, etapa vital, equipo' },
  { key: 'equilibrio_adaptativo',  label: 'Equilibrio adaptativo',      desc: '🔒 confidencial — no visible para el supervisor', sensible: true },
]

type PerfilRow = {
  asesor: string
  identidad_vendedora: string | null
  relacion_prospeccion: string | null
  modelos_mentales: string | null
  relacion_feedback: string | null
  perfil_conductual_notas: string | null
  contexto_situacional: string | null
  equilibrio_adaptativo: string | null
  resiliencia: string | null
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

// F6 — detalle de resiliencia (f4), canal cerrado solo-Admin (viene de /api/admin/resiliencia).
type ResilienciaItem = { orden: number | null; texto: string; negativo: boolean; respuesta: string | null; valor: number | null }
type ResilienciaDetalle = {
  score: { suma: number; base: number; n: number } | null
  items: ResilienciaItem[]
  analisis: string | null
  generado_at: string | null
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }
type AsesorCred = { asesor: string; org_nodo_id: string | null }
type OrgNodo    = { id: string; parent_id: string | null; nombre: string; capa_id: string | null; institucion_id: string }
type OrgCapa    = { id: string; nombre_cargo: string; nivel: number; institucion_id: string }
type OrgInst    = { id: string; nombre: string }

function buildBreadcrumb(nodoId: string | null, nodos: OrgNodo[], capas: OrgCapa[], insts: OrgInst[]): string[] {
  if (!nodoId) return []
  const chain: string[] = []
  let current: OrgNodo | undefined = nodos.find(n => n.id === nodoId)
  while (current) {
    const capa = capas.find(c => c.id === current!.capa_id)
    chain.unshift(capa ? `${capa.nombre_cargo}: ${current.nombre}` : current.nombre)
    current = current.parent_id ? nodos.find(n => n.id === current!.parent_id) : undefined
  }
  const nodo0 = nodos.find(n => n.id === nodoId)
  if (nodo0) {
    const inst = insts.find(i => i.id === nodo0.institucion_id)
    if (inst) chain.unshift(inst.nombre)
  }
  return chain
}

export default function PerfilPage() {
  const [asesoresCreds, setAsesoresCreds] = useState<AsesorCred[]>([])
  const [asesores,      setAsesores]      = useState<string[]>([])
  const [orgNodos,      setOrgNodos]      = useState<OrgNodo[]>([])
  const [orgCapas,      setOrgCapas]      = useState<OrgCapa[]>([])
  const [orgInsts,      setOrgInsts]      = useState<OrgInst[]>([])
  const [filtroNodo,    setFiltroNodo]    = useState('')
  const [selAsesor,     setSelAsesor]     = useState('')
  const [perfil,    setPerfil]    = useState<Partial<PerfilRow>>({})
  const [resiliencia, setResiliencia] = useState<ResilienciaDetalle | null>(null)
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
    Promise.all([
      supabase.from('asesor_credentials').select('asesor, org_nodo_id').eq('activo', true).order('asesor'),
      fetch('/api/admin/org').then(r => r.json()),
    ]).then(([{ data: creds }, org]) => {
      const c = (creds ?? []) as AsesorCred[]
      setAsesoresCreds(c)
      setAsesores(c.map(r => r.asesor))
      setOrgNodos(org.nodos  ?? [])
      setOrgCapas(org.capas  ?? [])
      setOrgInsts(org.instituciones ?? [])
    })
  }, [])

  // F6 — header con el access_token de la sesión admin (GoTrue) para llamar al route cerrado.
  async function authHeader(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession()
    const t = data.session?.access_token
    return t ? { Authorization: `Bearer ${t}` } : {}
  }

  async function loadPerfil(asesor: string) {
    setSelAsesor(asesor)
    setChat([])
    setPerfil({})
    setResiliencia(null)
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
    // F6 — desglose f4 + análisis (canal cerrado solo-Admin). No bloquea el render del perfil.
    try {
      const r = await fetch(`/api/admin/resiliencia?asesor=${encodeURIComponent(asesor)}`, { headers: await authHeader() })
      setResiliencia(r.ok ? await r.json() : null)
    } catch { setResiliencia(null) }
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
      equilibrio_adaptativo:   perfil.equilibrio_adaptativo   ?? null,
      // resiliencia NO se escribe aquí: es el score f4 (dueño: tps-evaluar), solo lectura en Admin.
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
    // Corrección 1 — las dimensiones sensibles (🔒) NUNCA entran al prompt del Resumen IA, que
    // sí ve el supervisor. resiliencia ya está fuera de DIMENSIONES (es score); equilibrio_adaptativo
    // se excluye por `sensible`.
    const narrativas = DIMENSIONES.filter(d => !d.sensible)
    const dims = narrativas.map(d => `${d.label}:\n${perfil[d.key as keyof PerfilRow] || '(sin datos)'}`).join('\n\n')
    // I1 — además del resumen, poblar las dimensiones narrativas VACÍAS (no se sobrescriben
    // las que ya tienen contenido del flujo analyzer→aprobación).
    const faltantes = narrativas.filter(d => !String(perfil[d.key as keyof PerfilRow] ?? '').trim())
    const prompt = `Eres un experto en coaching comercial con metodología Proxis TPS.
Con base en estas dimensiones del asesor ${selAsesor}:

${dims}

Devuelve SOLO un objeto JSON válido (sin texto fuera del JSON, sin markdown) con estas claves:
- "resumen_ia": resumen psicológico-conductual conciso (máx 300 palabras): identidad, fortalezas, bloqueos y recomendaciones de coaching, en lenguaje preciso y no clínico.${faltantes.length ? `\nY redacta estas dimensiones que faltan (2-4 oraciones cada una, sobre conducta observable, no clínico):\n${faltantes.map(d => `- "${d.key}"`).join('\n')}` : ''}`

    try {
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      // R1 — si la IA falla (p.ej. GROQ_KEY ausente, 500) NO se debe borrar ni persistir nada:
      // se conserva el resumen previo y se reporta el error real.
      if (!res.ok || data?.error) throw new Error(data?.error || `La IA respondió ${res.status}`)
      const textoIA = String(data.text ?? '').trim()
      if (!textoIA) throw new Error('La IA no devolvió contenido.')

      const raw = textoIA.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      let parsed: Record<string, string> = {}
      try { parsed = JSON.parse(raw) } catch { parsed = { resumen_ia: textoIA } }

      const upd: Record<string, unknown> = { asesor: selAsesor, updated_at: new Date().toISOString() }
      // Nunca sobrescribir con vacío: si el resumen viene en blanco, se conserva el anterior.
      const nuevoResumen = String(parsed.resumen_ia ?? textoIA).trim()
      if (nuevoResumen) upd.resumen_ia = nuevoResumen
      for (const d of faltantes) if (parsed[d.key] && String(parsed[d.key]).trim()) upd[d.key] = parsed[d.key]

      const tieneCambios = Object.keys(upd).some(k => k !== 'asesor' && k !== 'updated_at')
      if (!tieneCambios) throw new Error('La IA no devolvió un resumen utilizable.')

      setPerfil(p => ({ ...p, ...(upd as Partial<PerfilRow>) }))
      await supabase.from('asesor_perfil').upsert(upd, { onConflict: 'asesor' })
      const nDims = faltantes.filter(d => upd[d.key]).length
      showToast(`Resumen IA guardado${nDims ? ` · ${nDims} dimensión(es) poblada(s)` : ''}.`)

      // F6 — el análisis de resiliencia se genera AUTOMÁTICAMENTE junto con el perfil (canal
      // cerrado solo-Admin; nunca toca resumen_ia ni viaja al supervisor). No rompe el resumen.
      try {
        const r = await fetch(`/api/admin/resiliencia?asesor=${encodeURIComponent(selAsesor)}`, { method: 'POST', headers: await authHeader() })
        if (r.ok) setResiliencia(await r.json())
      } catch { /* el resumen ya quedó guardado; el análisis se reintenta al regenerar */ }
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
      // R3 — si la IA falla, mostrar el error real en el chat (no un silencioso '[Sin respuesta]').
      if (!res.ok || data?.error) throw new Error(data?.error || `La IA respondió ${res.status}`)
      const text = String(data.text ?? '').trim() || '[Sin respuesta]'

      const updated = [...newChat, { role: 'assistant' as const, content: text }]
      setChat(updated)

      const validKeys = new Set(DIMENSIONES.map(d => d.key))
      const jsonMatches = [...text.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
      const aplicadas: Record<string, string> = {}
      for (const match of jsonMatches) {
        try {
          const parsed = JSON.parse(match[1]) as { dimension: string; valor: string }
          // Solo claves de dimensión válidas: nunca se escribe una columna arbitraria, y
          // `resiliencia` (score f4, fuera de DIMENSIONES) jamás se persiste por el chat.
          if (parsed.dimension && parsed.valor && validKeys.has(parsed.dimension)) {
            aplicadas[parsed.dimension] = parsed.valor
            setPerfil(p => ({ ...p, [parsed.dimension]: parsed.valor }))
            setHighlight(parsed.dimension)
            setTimeout(() => setHighlight(null), 2000)
          }
        } catch { /* skip malformed */ }
      }

      // Corrección 3 — persistir automáticamente lo que la Calibración IA aplica, sin depender de
      // "Guardar perfil". Solo dimensiones válidas (lado admin/cerrado); ninguna llega al resumen del
      // supervisor (las sensibles ya están excluidas allí). "Guardar perfil" sigue funcionando igual.
      if (Object.keys(aplicadas).length && selAsesor) {
        const updated_at = new Date().toISOString()
        const { error } = await supabase.from('asesor_perfil')
          .upsert({ asesor: selAsesor, ...aplicadas, updated_at }, { onConflict: 'asesor' })
        if (error) showToast('No se pudo autoguardar la calibración: ' + error.message, true)
        else {
          setPerfil(p => ({ ...p, updated_at }))
          showToast(`Calibración aplicada y guardada · ${Object.keys(aplicadas).length} dimensión(es).`)
        }
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

      {/* Asesor selector + filtro por nodo */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '16px 22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Filtro por nodo */}
          {orgNodos.length > 0 && (
            <>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', whiteSpace: 'nowrap' }}>
                Equipo
              </label>
              <select value={filtroNodo} onChange={e => { setFiltroNodo(e.target.value); setSelAsesor('') }}
                style={{ padding: '9px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none', minWidth: 180 }}>
                <option value="">Todos</option>
                {orgNodos.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              </select>
              <span style={{ color: '#ddd' }}>|</span>
            </>
          )}
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', whiteSpace: 'nowrap' }}>
            Asesor
          </label>
          <select value={selAsesor} onChange={e => loadPerfil(e.target.value)}
            style={{ flex: 1, padding: '9px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none' }}>
            <option value="">— Selecciona —</option>
            {asesoresCreds
              .filter(c => !filtroNodo || c.org_nodo_id === filtroNodo)
              .map(c => <option key={c.asesor} value={c.asesor}>{c.asesor}</option>)}
          </select>
        </div>
        {/* Breadcrumb jerárquico */}
        {selAsesor && (() => {
          const cred  = asesoresCreds.find(c => c.asesor === selAsesor)
          const crumbs = buildBreadcrumb(cred?.org_nodo_id ?? null, orgNodos, orgCapas, orgInsts)
          if (!crumbs.length) return null
          return (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#888', background: '#f4f4f0', padding: '3px 10px', borderRadius: 20 }}>{c}</span>
                  {i < crumbs.length - 1 && <span style={{ color: '#ccc', fontSize: 11 }}>›</span>}
                </span>
              ))}
              <span style={{ fontSize: 11, color: '#aaa' }}>› <strong style={{ color: '#0b0a09' }}>{selAsesor}</strong></span>
            </div>
          )
        })()}
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

            {/* Resiliencia (f4) — SOLO LECTURA (Corrección 2 + F6). Score + desglose de ítems +
                análisis IA. Canal cerrado: 🔒 nunca se muestra al supervisor. */}
            <ResilienciaScore detalle={resiliencia} rawFallback={perfil.resiliencia ?? null} savingIA={savingIA} />

            {/* Resumen IA */}
            <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Resumen IA</div>
                  <div style={{ fontSize: 11, color: '#8a8885' }}>Síntesis generada por la IA (Groq) — se inyecta en cada mensaje al asesor</div>
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
              <div style={{ fontSize: 11, color: '#8a8885' }}>Conversa con la IA (Groq) para calibrar el perfil. Las sugerencias se aplican automáticamente.</div>
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

// Resiliencia (f4) en SOLO-LECTURA para Admin (Correcciones 1/2 + F6). El score es el puente
// ERRIM "suma/base/n_items" de tps-evaluar. Muestra: agregado + desglose expandible de los 5
// ítems (texto + respuesta cruda de Bart) + análisis IA cualitativo. Canal cerrado: nada de
// esto viaja al supervisor.
function ResilienciaScore({ detalle, rawFallback, savingIA }: {
  detalle: ResilienciaDetalle | null
  rawFallback: string | null
  savingIA: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  // score del route, o parseo de respaldo desde asesor_perfil.resiliencia si el route no respondió.
  const fb = rawFallback ? String(rawFallback).match(/^\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*$/) : null
  const score = detalle?.score ?? (fb ? { suma: +fb[1], base: +fb[2], n: +fb[3] } : null)
  const items = detalle?.items ?? []

  return (
    <div style={{ background: '#fbfbf8', border: '1px solid #e8e6e3', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885' }}>
            Resiliencia (f4)
          </div>
          <div style={{ fontSize: 11, color: '#8a8885', marginTop: 2 }}>
            🔒 Solo lectura · solo-Admin · no visible para el supervisor
          </div>
        </div>
        {score ? (
          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: '#0b0a09' }}>{score.suma}</span>
            <span style={{ fontSize: 14, color: '#8a8885' }}> / {score.base}</span>
            <div style={{ fontSize: 11, color: '#8a8885' }}>{score.n} ítems</div>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: '#8a8885' }}>{rawFallback || 'Sin datos'}</span>
        )}
      </div>

      {/* Desglose de los 5 ítems (texto + respuesta cruda). Solo-Admin. */}
      {items.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setAbierto(a => !a)} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#1a56c4',
          }}>
            {abierto ? '▾' : '▸'} Ver desglose ({items.length} ítems)
          </button>
          {abierto && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: '#fff', border: '1px solid #eceae6', borderRadius: 8 }}>
                  <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: '#2b2926' }}>
                    {it.texto}
                    {it.negativo && <span style={{ fontSize: 10, color: '#a8691a', marginLeft: 6 }}>(ítem inverso)</span>}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0b0a09' }}>{it.respuesta ?? '—'}</span>
                    {it.valor != null && it.negativo && (
                      <div style={{ fontSize: 10, color: '#8a8885' }}>aporta {it.valor}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Análisis IA (canal cerrado). Se genera junto con el perfil ("Generar" del Resumen IA). */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eceae6' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 6 }}>
          Análisis de resiliencia (IA · solo-Admin)
        </div>
        {detalle?.analisis ? (
          <>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: '#2b2926', margin: 0 }}>{detalle.analisis}</p>
            {detalle.generado_at && (
              <div style={{ fontSize: 10, color: '#8a8885', marginTop: 6 }}>
                Generado {new Date(detalle.generado_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 12, color: '#8a8885', fontStyle: 'italic', margin: 0 }}>
            {savingIA ? 'Generando junto con el perfil…' : 'Se generará automáticamente al pulsar "Generar" en el Resumen IA.'}
          </p>
        )}
      </div>
    </div>
  )
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
