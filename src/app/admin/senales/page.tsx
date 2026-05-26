'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Signal = {
  id: string; asesor: string; fuente: string; tipo: string
  valor: string | null; dimension_target: string | null
  perfil_hint: string | null; confianza_hint: number | null
  procesada: boolean; created_at: string
}

const FUENTES = ['plataforma','email','sailor','cuestionario','manual','supervisor']
const FUENTE_COLORS: Record<string, string> = {
  plataforma: '#1f6f56', email: '#a8691a', sailor: '#0b0a09',
  cuestionario: '#8e35d4', manual: '#4a4844', supervisor: '#2563a8',
}

const DIMENSIONES = [
  'relacion_prospeccion',
  'identidad_vendedora',
  'modelos_mentales',
  'relacion_feedback',
  'contexto_situacional',
]

type MetaRow = { asesor: string; supervisor: string | null }

export default function SenalesPage() {
  const [signals,    setSignals]    = useState<Signal[]>([])
  const [metaRows,   setMetaRows]   = useState<MetaRow[]>([])
  const [filterA,    setFilterA]    = useState('')
  const [filterSup,  setFilterSup]  = useState('')
  const [filterF,    setFilterF]    = useState('')
  const [filterProc, setFilterProc] = useState<'all' | 'pending' | 'done'>('all')
  const [loading,    setLoading]    = useState(true)

  // Formulario de observación de supervisor
  const [obsAsesor,  setObsAsesor]  = useState('')
  const [obsTexto,   setObsTexto]   = useState('')
  const [obsDim,     setObsDim]     = useState('')
  const [obsPerfil,  setObsPerfil]  = useState('')
  const [obsSaving,  setObsSaving]  = useState(false)
  const [obsOk,      setObsOk]      = useState(false)

  const asesores     = metaRows.map(r => r.asesor)
  const supervisores = [...new Set(metaRows.map(r => r.supervisor).filter(Boolean) as string[])].sort()
  const asesoresDelSup = filterSup
    ? metaRows.filter(r => r.supervisor === filterSup).map(r => r.asesor)
    : null

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('behavioral_signals').select('*').order('created_at', { ascending: false }).limit(300)
    if (filterA) {
      q = q.eq('asesor', filterA)
    } else if (asesoresDelSup && asesoresDelSup.length > 0) {
      q = q.in('asesor', asesoresDelSup)
    }
    if (filterF) q = q.eq('fuente', filterF)
    if (filterProc === 'pending') q = q.eq('procesada', false)
    if (filterProc === 'done')    q = q.eq('procesada', true)
    const { data } = await q
    setSignals(data ?? [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterA, filterSup, filterF, filterProc, metaRows])

  useEffect(() => {
    supabase.from('metas').select('asesor,supervisor').order('asesor')
      .then(({ data }) => setMetaRows(data ?? []))
  }, [])

  useEffect(() => { load() }, [load])

  async function saveObservacion() {
    if (!obsAsesor || !obsTexto.trim()) return
    setObsSaving(true)
    await supabase.from('behavioral_signals').insert({
      asesor:           obsAsesor,
      fuente:           'supervisor',
      tipo:             'observacion_supervisor',
      valor:            obsTexto.trim(),
      dimension_target: obsDim || null,
      perfil_hint:      obsPerfil || null,
      confianza_hint:   55,
      procesada:        false,
      contexto:         { origen: 'admin_manual' },
    })
    setObsTexto('')
    setObsDim('')
    setObsPerfil('')
    setObsSaving(false)
    setObsOk(true)
    setTimeout(() => setObsOk(false), 3000)
    load()
  }

  // Cobertura de dimensiones
  const dimCoverage = (() => {
    const map: Record<string, { count: number; pending: number }> = {}
    for (const s of signals) {
      const d = s.dimension_target ?? '(sin dimensión)'
      if (!map[d]) map[d] = { count: 0, pending: 0 }
      map[d].count++
      if (!s.procesada) map[d].pending++
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count)
  })()

  const byFuente = FUENTES.map(f => ({
    fuente: f,
    count: signals.filter(s => s.fuente === f).length,
  })).filter(x => x.count > 0)

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChevLeft /> Panel admin
        </Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Señales de comportamiento</h1>
      </div>

      {/* Formulario de observación de supervisor */}
      <div style={{ background: '#fff', border: '1px solid #d0e4f7', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2563a8', marginBottom: 14 }}>
          Registrar observación de supervisor
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <select value={obsAsesor} onChange={e => setObsAsesor(e.target.value)} style={{ ...selStyle, minWidth: 180 }}>
            <option value="">Asesor…</option>
            {asesores.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={obsDim} onChange={e => setObsDim(e.target.value)} style={{ ...selStyle, minWidth: 200 }}>
            <option value="">Dimensión (opcional)</option>
            {DIMENSIONES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={obsPerfil} onChange={e => setObsPerfil(e.target.value)} style={{ ...selStyle, minWidth: 120 }}>
            <option value="">Perfil hint</option>
            {['E','S','R','A'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'flex-end' }}>
          <textarea
            value={obsTexto}
            onChange={e => setObsTexto(e.target.value)}
            placeholder="Observación del supervisor sobre el asesor…"
            rows={3}
            style={{ flex: 1, padding: '10px 14px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', resize: 'vertical', outline: 'none' }}
          />
          <button
            onClick={saveObservacion}
            disabled={obsSaving || !obsAsesor || !obsTexto.trim()}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: obsSaving || !obsAsesor || !obsTexto.trim() ? 'not-allowed' : 'pointer',
              border: 'none', background: obsOk ? '#1f6f56' : '#2563a8', color: '#fff',
              opacity: obsSaving || !obsAsesor || !obsTexto.trim() ? 0.5 : 1,
              transition: 'background 0.2s', whiteSpace: 'nowrap',
            }}
          >
            {obsOk ? '✓ Guardado' : obsSaving ? 'Guardando…' : 'Guardar señal'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#8a8885', marginTop: 8 }}>
          Confianza fija: 55% · fuente: supervisor · tipo: observacion_supervisor
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
        {byFuente.map(({ fuente, count }) => (
          <div key={fuente} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: FUENTE_COLORS[fuente] }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#4a4844' }}>{fuente}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: FUENTE_COLORS[fuente] }}>{count}</div>
          </div>
        ))}
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#8a8885', marginBottom: 4 }}>Pendientes</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#a8691a' }}>
            {signals.filter(s => !s.procesada).length}
          </div>
        </div>
      </div>

      {/* Dimensiones coverage */}
      {dimCoverage.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Cobertura de dimensiones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dimCoverage.slice(0, 8).map(([dim, { count, pending }]) => {
              const max = dimCoverage[0][1].count
              return (
                <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 180, fontSize: 11, color: '#4a4844', flexShrink: 0 }}>{dim}</div>
                  <div style={{ flex: 1, height: 6, background: '#f5f3ef', borderRadius: 3 }}>
                    <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: '#cbf135', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#4a4844', width: 30, textAlign: 'right' }}>{count}</span>
                  {pending > 0 && (
                    <span style={{ fontSize: 10, color: '#a8691a', width: 50 }}>{pending} pend.</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
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
        <select value={filterF} onChange={e => setFilterF(e.target.value)} style={selStyle}>
          <option value="">Todas las fuentes</option>
          {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all','pending','done'] as const).map(v => (
            <button key={v} onClick={() => setFilterProc(v)} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: '1px solid',
              background: filterProc === v ? '#0b0a09' : '#fff',
              color: filterProc === v ? '#fff' : '#4a4844',
              borderColor: filterProc === v ? '#0b0a09' : '#e8e6e3',
            }}>{v === 'all' ? 'Todas' : v === 'pending' ? 'Pendientes' : 'Procesadas'}</button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8a8885' }}>Cargando señales…</div>
      ) : signals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8a8885' }}>Sin señales registradas aún.</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafaf7', borderBottom: '1px solid #e8e6e3' }}>
                {['Asesor','Fuente','Tipo','Valor','Dimensión','Perfil hint','Conf.','Estado','Fecha'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a8885' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f5f3ef', opacity: s.procesada ? 0.6 : 1 }}>
                  <td style={td}>{s.asesor.split(' ')[0]}</td>
                  <td style={td}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${FUENTE_COLORS[s.fuente]}15`, color: FUENTE_COLORS[s.fuente] }}>
                      {s.fuente}
                    </span>
                  </td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono), monospace', fontSize: 11 }}>{s.tipo}</td>
                  <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.valor || '—'}</td>
                  <td style={{ ...td, fontSize: 11 }}>{s.dimension_target || '—'}</td>
                  <td style={td}>{s.perfil_hint || '—'}</td>
                  <td style={td}>{s.confianza_hint !== null ? `${s.confianza_hint}%` : '—'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: s.procesada ? '#e6f3ed' : '#f8ecd6', color: s.procesada ? '#1f6f56' : '#a8691a' }}>
                      {s.procesada ? 'Procesada' : 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 11, color: '#8a8885', whiteSpace: 'nowrap' }}>
                    {new Date(s.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 14px', fontSize: 12, verticalAlign: 'middle' }
const selStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, color: '#0b0a09', background: '#fff', outline: 'none' }
function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
