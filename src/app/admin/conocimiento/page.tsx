'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const PERFILES       = ['Energético','Sociable','Relacional','Reflexivo','Integrador','General']
const PERFILES_CORE  = ['Energético','Sociable','Relacional','Reflexivo']
const CATEGORIAS = [
  'fortaleza','debilidad','tactica_cliente','ciclo_7pasos',
  'backup_style','colision_espejo','diagnostico_perceptual',
  'cierre','pregunta_interna','sales_dna','ruta_desarrollo',
  'variable_situacional','protocolo_intervención',
]

type CellStats      = { count: number; avgCompletitud: number }
type CoverageMatrix = Record<string, Record<string, CellStats>>
type GapsByCell     = Record<string, number>

type Gap = {
  id: string; categoria: string; perfil_afectado: string | null
  descripcion: string | null; prioridad: number; estado: string; created_at: string
}
type Proposal = {
  id: string; gap_id: string | null; titulo: string | null; contenido: string
  perfil: string | null; categoria: string | null; completitud: number
  regla_inferencia: string | null; accion_correctiva: string | null
  estado: string; created_at: string
}
const ETAPAS = ['prospeccion','pre_contacto','acercamiento','presentacion','objeciones','cierre','seguimiento']

type Entry = {
  id: string; perfil: string | null; categoria: string | null; etapa_ciclo: string | null
  contexto: string | null; contenido: string; regla_inferencia: string | null
  accion_correctiva: string | null; fuente: string | null; completitud: number; created_at: string
  embedded_at: string | null; institucion_id: string | null; org_nodo_id: string | null
}
type OrgInst = { id: string; nombre: string }
type OrgNodo = { id: string; nombre: string; institucion_id: string }

const EMPTY_FORM = {
  perfil: '', categoria: '', etapa_ciclo: '', contexto: '', contenido: '',
  regla_inferencia: '', accion_correctiva: '', fuente: '', completitud: 50,
  scope: 'global' as 'global' | 'institucion' | 'nodo',
  institucion_id: '', org_nodo_id: '',
}

export default function ConocimientoPage() {
  const [entries,   setEntries]  = useState<Entry[]>([])
  const [filterP,   setFilterP]  = useState('')
  const [filterC,   setFilterC]  = useState('')
  const [search,    setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]   = useState<string | null>(null)
  const [form,      setForm]     = useState({ ...EMPTY_FORM })
  const [orgInsts,  setOrgInsts] = useState<OrgInst[]>([])
  const [orgNodos,  setOrgNodos] = useState<OrgNodo[]>([])
  const [saving,     setSaving]    = useState(false)
  const [embedding,  setEmbedding] = useState(false)
  const [scanning,      setScanning]      = useState(false)
  const [coverage,      setCoverage]      = useState<CoverageMatrix | null>(null)
  const [gapsByCell,    setGapsByCell]    = useState<GapsByCell>({})
  const [showCoverage,  setShowCoverage]  = useState(false)
  const [gaps,          setGaps]          = useState<Gap[]>([])
  const [proposals,     setProposals]     = useState<Proposal[]>([])
  const [showGaps,      setShowGaps]      = useState(false)
  const [showProposals, setShowProposals] = useState(false)
  const [investigando,  setInvestigando]  = useState<string | null>(null)
  const [actioning,     setActioning]     = useState<string | null>(null)
  const [toast,         setToast]         = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3200)
  }

  async function load() {
    const { data } = await supabase.from('knowledge_base_conductual')
      .select('*').order('created_at', { ascending: false })
    setEntries(data ?? [])
  }

  async function loadCoverage() {
    const resp = await fetch('/api/admin/knowledge/scan-gaps')
    if (!resp.ok) return
    const json = await resp.json()
    setCoverage(json.matrix ?? null)
    setGapsByCell(json.gapsByCell ?? {})
  }

  async function loadGaps() {
    const { data } = await supabase.from('knowledge_gaps')
      .select('*').neq('estado', 'cubierto').order('prioridad', { ascending: false })
    setGaps(data ?? [])
  }

  async function loadProposals() {
    const { data } = await supabase.from('knowledge_proposals')
      .select('*').eq('estado', 'pendiente').order('created_at', { ascending: false })
    setProposals(data ?? [])
  }

  useEffect(() => {
    load(); loadCoverage(); loadGaps(); loadProposals()
    fetch('/api/admin/org').then(r => r.json()).then(org => {
      setOrgInsts(org.instituciones ?? [])
      setOrgNodos((org.nodos ?? []).map((n: { id: string; nombre: string; institucion_id: string }) => n))
    })
  }, [])

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
      const scope: 'global' | 'institucion' | 'nodo' =
        e.org_nodo_id ? 'nodo' : e.institucion_id ? 'institucion' : 'global'
      setForm({
        perfil: e.perfil ?? '', categoria: e.categoria ?? '',
        etapa_ciclo: e.etapa_ciclo ?? '', contexto: e.contexto ?? '',
        contenido: e.contenido, regla_inferencia: e.regla_inferencia ?? '',
        accion_correctiva: e.accion_correctiva ?? '', fuente: e.fuente ?? '',
        completitud: e.completitud,
        scope, institucion_id: e.institucion_id ?? '', org_nodo_id: e.org_nodo_id ?? '',
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
      institucion_id:    form.scope !== 'global' ? (form.institucion_id || null) : null,
      org_nodo_id:       form.scope === 'nodo'   ? (form.org_nodo_id   || null) : null,
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

  async function scanGaps() {
    setScanning(true)
    try {
      const resp = await fetch('/api/admin/knowledge/scan-gaps', { method: 'POST' })
      const json = await resp.json()
      if (json.error) { showToast(json.error, true); return }
      showToast(json.created > 0
        ? `${json.created} vacío${json.created !== 1 ? 's' : ''} detectado${json.created !== 1 ? 's' : ''} y registrado${json.created !== 1 ? 's' : ''}`
        : 'Sin vacíos nuevos — cobertura al día'
      )
      loadCoverage(); loadGaps()
    } catch {
      showToast('Error al escanear', true)
    } finally {
      setScanning(false)
    }
  }

  async function investigarGap(gapId: string) {
    setInvestigando(gapId)
    try {
      const resp = await fetch('/api/admin/knowledge/investigar-gap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap_id: gapId }),
      })
      const json = await resp.json()
      if (!json.ok && json.error) { showToast(json.error, true); return }
      showToast('Investigación completada — nueva propuesta generada')
      loadGaps(); loadProposals(); loadCoverage()
    } catch {
      showToast('Error al investigar', true)
    } finally {
      setInvestigando(null)
    }
  }

  async function proposalAction(proposalId: string, action: 'aprobar' | 'rechazar') {
    setActioning(proposalId)
    try {
      const resp = await fetch('/api/admin/knowledge/proposal-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId, action }),
      })
      const json = await resp.json()
      if (json.error) { showToast(json.error, true); return }
      showToast(action === 'aprobar' ? 'Propuesta aprobada — entrada agregada a la KB' : 'Propuesta rechazada')
      loadProposals(); loadGaps(); load()
    } catch {
      showToast('Error', true)
    } finally {
      setActioning(null)
    }
  }

  async function embedAll() {
    setEmbedding(true)
    try {
      const resp = await fetch('/api/admin/knowledge/embed-all', { method: 'POST' })
      const json = await resp.json()
      if (json.error) { showToast(json.error, true); return }
      showToast(`${json.embedded} entrada${json.embedded !== 1 ? 's' : ''} embedeada${json.embedded !== 1 ? 's' : ''} (${json.total} total)`)
      load()
    } catch {
      showToast('Error al embedear', true)
    } finally {
      setEmbedding(false)
    }
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={scanGaps} disabled={scanning} style={{
            padding: '9px 16px', background: scanning ? '#f5f3ef' : '#fff', color: scanning ? '#8a8885' : '#4a4844',
            border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: scanning ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {scanning ? 'Escaneando…' : '🔍 Escanear vacíos'}
          </button>
          <button onClick={embedAll} disabled={embedding || entries.length === 0} style={{
            padding: '9px 16px', background: embedding ? '#f5f3ef' : '#1f6f56', color: embedding ? '#8a8885' : '#fff',
            border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: embedding ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {embedding ? 'Embedeando…' : `⚡ Embedear KB (${entries.filter(e => !e.embedded_at).length} pendientes)`}
          </button>
          <button onClick={() => openModal()} style={{
            padding: '9px 16px', background: '#0b0a09', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>+ Nueva entrada</button>
        </div>
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

      {/* Coverage heatmap */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
        <button onClick={() => setShowCoverage(v => !v)} style={{
          width: '100%', padding: '12px 18px', background: 'none', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#4a4844' }}>
            Mapa de cobertura — perfil × categoría
          </span>
          <span style={{ fontSize: 12, color: '#8a8885' }}>{showCoverage ? '▲ ocultar' : '▼ ver'}</span>
        </button>

        {showCoverage && coverage && (
          <div style={{ padding: '0 18px 18px', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#8a8885', fontWeight: 600, borderBottom: '1px solid #e8e6e3', whiteSpace: 'nowrap' }}>Categoría</th>
                  {PERFILES_CORE.map(p => (
                    <th key={p} style={{ padding: '6px 8px', textAlign: 'center', color: '#4a4844', fontWeight: 700, borderBottom: '1px solid #e8e6e3', whiteSpace: 'nowrap' }}>{p.slice(0,3)}</th>
                  ))}
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: '#4a4844', fontWeight: 700, borderBottom: '1px solid #e8e6e3' }}>Gral</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIAS.map((cat, i) => (
                  <tr key={cat} style={{ background: i % 2 === 0 ? '#fafaf9' : '#fff' }}>
                    <td style={{ padding: '5px 8px', color: '#4a4844', fontWeight: 500, whiteSpace: 'nowrap', borderRight: '1px solid #e8e6e3' }}>{cat}</td>
                    {[...PERFILES_CORE, 'General'].map(p => {
                      const cell   = coverage[p]?.[cat] ?? { count: 0, avgCompletitud: 0 }
                      const hasGap = gapsByCell[`${p}||${cat}`] > 0
                      const bg     = cell.count === 0 ? '#fde8e8'
                        : cell.avgCompletitud < 40     ? '#fef3cd'
                        : cell.avgCompletitud < 70     ? '#d4edda'
                        :                               '#c3e6cb'
                      const color  = cell.count === 0 ? '#b03a3a'
                        : cell.avgCompletitud < 40     ? '#856404'
                        : '#1f6f56'
                      return (
                        <td key={p} title={`${p} × ${cat}: ${cell.count} entrada${cell.count !== 1 ? 's' : ''}, ${Math.round(cell.avgCompletitud)}% completitud${hasGap ? ' · ⚠ gap detectado' : ''}`}
                          style={{ padding: '5px 8px', textAlign: 'center', background: bg, color, fontWeight: 700, cursor: 'default' }}>
                          {cell.count > 0 ? cell.count : '—'}
                          {hasGap && <span style={{ marginLeft: 2, fontSize: 9 }}>⚠</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 10, color: '#8a8885' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fde8e8', border: '1px solid #e8e6e3', borderRadius: 2, marginRight: 4 }}/>Sin entradas</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#fef3cd', border: '1px solid #e8e6e3', borderRadius: 2, marginRight: 4 }}/>Baja completitud</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#d4edda', border: '1px solid #e8e6e3', borderRadius: 2, marginRight: 4 }}/>Parcial</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#c3e6cb', border: '1px solid #e8e6e3', borderRadius: 2, marginRight: 4 }}/>Bien cubierto</span>
              <span>⚠ = gap registrado</span>
            </div>
          </div>
        )}
      </div>

      {/* Vacíos KB */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => setShowGaps(v => !v)} style={{
          width: '100%', padding: '12px 18px', background: 'none', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#4a4844' }}>
            Vacíos de conocimiento
            {gaps.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: '#fde8e8', color: '#b03a3a' }}>{gaps.length}</span>}
          </span>
          <span style={{ fontSize: 12, color: '#8a8885' }}>{showGaps ? '▲ ocultar' : '▼ ver'}</span>
        </button>
        {showGaps && (
          <div style={{ borderTop: '1px solid #e8e6e3' }}>
            {gaps.length === 0 ? (
              <div style={{ padding: '20px 18px', fontSize: 12, color: '#8a8885', textAlign: 'center' }}>Sin vacíos detectados. Ejecuta "Escanear vacíos".</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafaf9' }}>
                    {['Perfil','Categoría','Descripción','Prioridad','Estado','Acción'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885', borderBottom: '1px solid #e8e6e3' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gaps.map(g => {
                    const estadoColor = g.estado === 'en_investigacion' ? '#a8691a' : g.estado === 'en_revision' ? '#2563a8' : '#b03a3a'
                    const estadoBg   = g.estado === 'en_investigacion' ? '#fef3cd' : g.estado === 'en_revision' ? '#dbeafe' : '#fde8e8'
                    return (
                      <tr key={g.id} style={{ borderBottom: '1px solid #f5f3ef' }}>
                        <td style={{ padding: '9px 14px' }}>{g.perfil_afectado || '—'}</td>
                        <td style={{ padding: '9px 14px' }}>{g.categoria}</td>
                        <td style={{ padding: '9px 14px', maxWidth: 280, color: '#4a4844' }}>{g.descripcion?.slice(0, 100) || '—'}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: g.prioridad >= 4 ? '#b03a3a' : g.prioridad >= 3 ? '#a8691a' : '#8a8885' }}>{g.prioridad}/5</span>
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: estadoBg, color: estadoColor }}>{g.estado}</span>
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          {(g.estado === 'detectado') && (
                            <button onClick={() => investigarGap(g.id)} disabled={investigando === g.id} style={{
                              padding: '4px 12px', background: investigando === g.id ? '#f5f3ef' : '#0b0a09', color: investigando === g.id ? '#8a8885' : '#cbf135',
                              border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: investigando === g.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            }}>
                              {investigando === g.id ? 'Investigando…' : '🔬 Investigar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Propuestas IA */}
      {proposals.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #d0e4f7', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          <button onClick={() => setShowProposals(v => !v)} style={{
            width: '100%', padding: '12px 18px', background: 'none', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#2563a8' }}>
              🤖 Propuestas de IA pendientes de revisión
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: '#dbeafe', color: '#2563a8' }}>{proposals.length}</span>
            </span>
            <span style={{ fontSize: 12, color: '#8a8885' }}>{showProposals ? '▲ ocultar' : '▼ ver'}</span>
          </button>
          {showProposals && (
            <div style={{ borderTop: '1px solid #d0e4f7', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {proposals.map(p => (
                <div key={p.id} style={{ border: '1px solid #e8e6e3', borderRadius: 10, padding: '14px 18px', background: '#fafff9' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.titulo || '(sin título)'}</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        {p.perfil   && <Badge color="#f5f3ef">{p.perfil}</Badge>}
                        {p.categoria && <Badge color="#f0ede8">{p.categoria}</Badge>}
                        <Badge color="#e6f3ed">{p.completitud}% completitud</Badge>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => proposalAction(p.id, 'aprobar')} disabled={actioning === p.id} style={{
                        padding: '6px 14px', background: '#1f6f56', color: '#fff', border: 'none', borderRadius: 7,
                        fontSize: 12, fontWeight: 700, cursor: actioning === p.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                        opacity: actioning === p.id ? 0.5 : 1,
                      }}>✓ Aprobar</button>
                      <button onClick={() => proposalAction(p.id, 'rechazar')} disabled={actioning === p.id} style={{
                        padding: '6px 14px', background: '#fde8e8', color: '#b03a3a', border: '1px solid #f5c6c6', borderRadius: 7,
                        fontSize: 12, fontWeight: 700, cursor: actioning === p.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                        opacity: actioning === p.id ? 0.5 : 1,
                      }}>✕ Rechazar</button>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#4a4844', lineHeight: 1.6, margin: '0 0 6px' }}>{p.contenido.slice(0, 400)}{p.contenido.length > 400 ? '…' : ''}</p>
                  {p.regla_inferencia && <p style={{ fontSize: 11, color: '#8a8885', margin: 0, fontStyle: 'italic' }}>Regla: {p.regla_inferencia}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                    {e.org_nodo_id
                      ? <Badge color="#ede9fe">👥 {orgNodos.find(n => n.id === e.org_nodo_id)?.nombre ?? 'Equipo'}</Badge>
                      : e.institucion_id
                      ? <Badge color="#dbeafe">🏢 {orgInsts.find(i => i.id === e.institucion_id)?.nombre ?? 'Institución'}</Badge>
                      : <Badge color="#f5f3ef">🌍 Global</Badge>
                    }
                    <span title={e.embedded_at ? `Embedeado ${new Date(e.embedded_at).toLocaleDateString('es-CL')}` : 'Sin embedding'} style={{ fontSize: 11 }}>
                      {e.embedded_at ? '🔵' : '⚪'}
                    </span>
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

            {/* Scope selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 5 }}>Alcance</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: form.scope !== 'global' ? 10 : 0 }}>
                {(['global', 'institucion', 'nodo'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setForm(f => ({ ...f, scope: s, institucion_id: '', org_nodo_id: '' }))} style={{
                    padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                    border: form.scope === s ? '2px solid #0b0a09' : '1px solid #e8e6e3',
                    background: form.scope === s ? '#0b0a09' : '#fff',
                    color: form.scope === s ? '#fff' : '#4a4844',
                  }}>
                    {s === 'global' ? '🌍 Global' : s === 'institucion' ? '🏢 Institución' : '👥 Equipo'}
                  </button>
                ))}
              </div>
              {form.scope !== 'global' && (
                <div style={{ display: 'grid', gridTemplateColumns: form.scope === 'nodo' ? '1fr 1fr' : '1fr', gap: 10 }}>
                  <select value={form.institucion_id} onChange={e => setForm(f => ({ ...f, institucion_id: e.target.value, org_nodo_id: '' }))} style={inputStyle}>
                    <option value="">— Seleccionar institución —</option>
                    {orgInsts.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                  </select>
                  {form.scope === 'nodo' && (
                    <select value={form.org_nodo_id} onChange={e => setForm(f => ({ ...f, org_nodo_id: e.target.value }))} style={inputStyle} disabled={!form.institucion_id}>
                      <option value="">— Seleccionar equipo —</option>
                      {orgNodos.filter(n => n.institucion_id === form.institucion_id).map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                    </select>
                  )}
                </div>
              )}
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
