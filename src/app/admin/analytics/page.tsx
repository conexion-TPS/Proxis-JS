'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type KPI = { total: number; month: number; avgScore: number | null; scoreCount: number; activeTriggers: number; totalTriggers: number }
type TriggerStat = { id: string; count: number; descripcion: string | null }
type AsesorStat  = { asesor: string; total: number; pos: number; neg: number; lastSent: string | null }
type LogRow      = { id: string; asesor: string; trigger_id: string | null; created_at: string }

export default function AnalyticsPage() {
  const [kpi,       setKpi]       = useState<KPI | null>(null)
  const [byTrigger, setByTrigger] = useState<TriggerStat[]>([])
  const [byAsesor,  setByAsesor]  = useState<AsesorStat[]>([])
  const [recentLog, setRecentLog] = useState<LogRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  function getMes() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  async function loadAll() {
    setLoading(true); setError('')
    try {
      const mes = getMes()
      const [logsRes, logsMonthRes, fbRes, triggersRes] = await Promise.all([
        supabase.from('message_log').select('id,asesor,trigger_id,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('message_log').select('id').gte('created_at', `${mes}-01`),
        supabase.from('feedback').select('message_id,score'),
        supabase.from('trigger_config').select('trigger_id,descripcion,activo'),
      ])
      const logs     = logsRes.data     ?? []
      const logsMonth = logsMonthRes.data ?? []
      const fb       = fbRes.data       ?? []
      const triggers = triggersRes.data ?? []

      const scores    = fb.map(f => f.score).filter(s => s !== null) as number[]
      const avgScore  = scores.length ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null
      const fbMap: Record<string, number> = {}
      for (const f of fb) fbMap[f.message_id] = f.score

      setKpi({
        total: logs.length,
        month: logsMonth.length,
        avgScore,
        scoreCount: scores.length,
        activeTriggers: triggers.filter(t => t.activo).length,
        totalTriggers: triggers.length,
      })

      // By trigger
      const byT: Record<string, TriggerStat> = {}
      for (const l of logs) {
        const tid = l.trigger_id ?? '(sin trigger)'
        if (!byT[tid]) byT[tid] = { id: tid, count: 0, descripcion: triggers.find(t => t.trigger_id === tid)?.descripcion ?? null }
        byT[tid].count++
      }
      setByTrigger(Object.values(byT).sort((a, b) => b.count - a.count))

      // By asesor
      const byA: Record<string, AsesorStat> = {}
      for (const l of logs) {
        if (!byA[l.asesor]) byA[l.asesor] = { asesor: l.asesor, total: 0, pos: 0, neg: 0, lastSent: null }
        byA[l.asesor].total++
        if (!byA[l.asesor].lastSent) byA[l.asesor].lastSent = l.created_at
        const s = fbMap[l.id]
        if (s === 1)  byA[l.asesor].pos++
        if (s === -1) byA[l.asesor].neg++
      }
      setByAsesor(Object.values(byA).sort((a, b) => b.total - a.total))

      setRecentLog(logs.slice(0, 10))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ChevLeft /> Panel admin
          </Link>
          <span style={{ color: '#c8c6c3' }}>/</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Analytics</h1>
        </div>
        <button onClick={loadAll} disabled={loading} style={{
          padding: '7px 14px', border: '1px solid #e8e6e3', borderRadius: 8,
          fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: '#fff',
          display: 'flex', alignItems: 'center', gap: 6,
          opacity: loading ? 0.5 : 1,
        }}>
          ↻ Actualizar
        </button>
      </div>

      {error && (
        <div style={{ background: '#fbe9e9', border: '1px solid rgba(176,58,58,0.3)', borderRadius: 8, padding: '12px 16px', color: '#b03a3a', fontSize: 13, marginBottom: 20 }}>
          Error: {error}
        </div>
      )}

      {loading && !kpi ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8a8885' }}>Cargando métricas…</div>
      ) : kpi ? (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <KpiCard label="Total mensajes"  value={kpi.total}           sub="desde el inicio"                 color="#cbf135" />
            <KpiCard label="Este mes"        value={kpi.month}           sub={getMes()}                        color="#0b0a09" />
            <KpiCard label="Feedback prom."  value={kpi.avgScore ?? '—'} sub={`${kpi.scoreCount} valoraciones`} color={kpi.avgScore === null ? '#8a8885' : kpi.avgScore > 0 ? '#1a9e4a' : '#b03a3a'} />
            <KpiCard label="Triggers activos" value={kpi.activeTriggers} sub={`de ${kpi.totalTriggers} configurados`} color="#1f6f56" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* By trigger */}
            <Panel title="Mensajes por trigger" sub="acumulado">
              {byTrigger.length === 0 ? <Empty /> : (
                <div>
                  {byTrigger.map(t => (
                    <div key={t.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono), monospace', color: '#4a4844' }}>{t.id}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0b0a09' }}>{t.count}</span>
                      </div>
                      <div style={{ height: 4, background: '#f5f3ef', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: '#cbf135',
                          width: `${Math.round((t.count / byTrigger[0].count) * 100)}%`,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* By asesor */}
            <Panel title="Resumen por asesor" sub="">
              {byAsesor.length === 0 ? <Empty /> : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Asesor','Msgs','👍','👎','Último'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8885', padding: '0 8px 8px 0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byAsesor.map(a => (
                      <tr key={a.asesor} style={{ borderTop: '1px solid #f5f3ef' }}>
                        <td style={{ padding: '8px 8px 8px 0', fontSize: 12 }}>{a.asesor.split(' ')[0]}</td>
                        <td style={{ padding: '8px 8px 8px 0', fontSize: 12, fontWeight: 700 }}>{a.total}</td>
                        <td style={{ padding: '8px 8px 8px 0', fontSize: 12, color: '#1f6f56' }}>{a.pos || '—'}</td>
                        <td style={{ padding: '8px 8px 8px 0', fontSize: 12, color: '#b03a3a' }}>{a.neg || '—'}</td>
                        <td style={{ padding: '8px 0', fontSize: 11, color: '#8a8885' }}>{a.lastSent ? fmtDate(a.lastSent) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          {/* Recent log */}
          <Panel title="Últimos mensajes enviados" sub="máx. 10">
            {recentLog.length === 0 ? <Empty /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Asesor','Trigger','Fecha'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8885', padding: '0 12px 8px 0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLog.map(l => (
                    <tr key={l.id} style={{ borderTop: '1px solid #f5f3ef' }}>
                      <td style={{ padding: '8px 12px 8px 0', fontSize: 13 }}>{l.asesor}</td>
                      <td style={{ padding: '8px 12px 8px 0', fontSize: 11, fontFamily: 'var(--font-mono), monospace', color: '#4a4844' }}>{l.trigger_id || '—'}</td>
                      <td style={{ padding: '8px 0', fontSize: 11, color: '#8a8885' }}>{fmtDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.04em', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8a8885' }}>{sub}</div>
    </div>
  )
}

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: '#8a8885' }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

function Empty() {
  return <div style={{ textAlign: 'center', color: '#8a8885', fontSize: 13, padding: '20px 0' }}>Sin datos aún.</div>
}

function ChevLeft() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
