'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/* ── Types ─────────────────────────────────────────────────── */
type Signal = {
  id: string; asesor: string; tipo: string; fuente: string
  valor: string | null; procesada: boolean; created_at: string
  ageHours: number; kind: string; label: string
}
type AsesorNode = {
  id: string; nombre: string; perfil: string | null; signals: Signal[]; observaciones: Signal[]; obsDays: number
}
type Nodo = {
  id: string; nombre: string; supervisor: string | null; supervisorObsDays: number; asesores: AsesorNode[]
}
type Institucion = { id: string; nombre: string; tipo: string | null; nodos: Nodo[] }

/* ── Signal catalogue ───────────────────────────────────────── */
const TIPOS: Record<string, { label: string; kind: string }> = {
  riesgo_elevado:           { label: 'Asesor en riesgo elevado',     kind: 'flag'       },
  progresion_hito:          { label: 'Hito de progresión alcanzado', kind: 'trend-up'   },
  hipotesis_acumuladas:     { label: 'Hipótesis acumuladas',         kind: 'alert'      },
  sin_mensajes_recientes:   { label: 'Sin mensajes recientes',       kind: 'clock'      },
  'bajo-meta-miercoles':    { label: 'Bajo meta al miércoles',       kind: 'target'     },
  'meta-superada':          { label: 'Meta semanal superada',        kind: 'trend-up'   },
  'semana-sin-reporte-alerta': { label: 'Semana sin reporte',        kind: 'calendar'   },
  'persistencia-umbral':    { label: 'Bajo umbral contractual',      kind: 'flag'       },
  'primer-lunes-mes':       { label: 'Inicio de mes',                kind: 'calendar'   },
  observacion_supervisor:   { label: 'Observación de supervisor',    kind: 'message'    },
  reaccion_positiva:        { label: 'Reacción positiva',            kind: 'trend-up'   },
  reaccion_negativa:        { label: 'Reacción negativa',            kind: 'trend-down' },
  sin_mensajes:             { label: 'Sin mensajes del coach',       kind: 'message'    },
}
function sigMeta(tipo: string) {
  return TIPOS[tipo] ?? { label: tipo.replace(/_/g, ' '), kind: 'activity' }
}
function ageHours(created_at: string) {
  return (Date.now() - new Date(created_at).getTime()) / 3_600_000
}
function antiguedad(h: number) {
  if (h < 1)  return 'hace minutos'
  if (h < 24) return `hace ${Math.round(h)} h`
  const d = Math.floor(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}

/* ── Urgency helpers ───────────────────────────────────────── */
const CRIT_H   = 48
const STALE_OBS = 7

const pending  = (a: AsesorNode) => a.signals.filter(s => !s.procesada)
const critical = (a: AsesorNode) => pending(a).filter(s => s.ageHours > CRIT_H)
const asesorUrgency = (a: AsesorNode) => critical(a).length * 10000 + Math.max(...pending(a).map(s => s.ageHours), 0) * 10 + pending(a).length

function nodoStatus(n: Nodo): 'critico' | 'medio' | 'ok' {
  if (n.asesores.some(a => critical(a).length > 0)) return 'critico'
  if (n.asesores.some(a => pending(a).length > 0))  return 'medio'
  return 'ok'
}
function nodoUrgency(n: Nodo) {
  const crit = n.asesores.reduce((acc, a) => acc + critical(a).length, 0)
  const pend = n.asesores.reduce((acc, a) => acc + pending(a).length, 0)
  return crit * 100000 + (n.supervisorObsDays > STALE_OBS ? 50000 : 0) + pend * 100 + n.supervisorObsDays
}
function nodoProcesadas(n: Nodo) {
  let proc = 0, total = 0
  n.asesores.forEach(a => a.signals.forEach(s => { total++; if (s.procesada) proc++ }))
  return { proc, total }
}

/* ── Global summary ─────────────────────────────────────────── */
function globalSummary(data: Institucion[]) {
  let pendientes = 0, nodosCriticos = 0, asesoresStale = 0
  data.forEach(inst => inst.nodos.forEach(n => {
    n.asesores.forEach(a => {
      pendientes += pending(a).length
      if (a.obsDays > STALE_OBS) asesoresStale++
    })
    if (nodoStatus(n) === 'critico') nodosCriticos++
  }))
  return { pendientes, nodosCriticos, asesoresStale }
}

/* ══════════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════ */
function Ico({ d, size = 16, sw = 1.75, children, style }: { d?: string; size?: number; sw?: number; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
         style={{ flex: 'none', ...style }}>
      {children ?? <path d={d} />}
    </svg>
  )
}
const ICONS: Record<string, (p: { size?: number; sw?: number }) => React.ReactNode> = {
  chevron:    p => <Ico {...p} d="M9 6l6 6-6 6" />,
  refresh:    p => <Ico {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v4h-4" /></Ico>,
  plus:       p => <Ico {...p} d="M12 5v14M5 12h14" />,
  close:      p => <Ico {...p} d="M6 6l12 12M18 6L6 18" />,
  building:   p => <Ico {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M10 21v-3h4v3" /></Ico>,
  users:      p => <Ico {...p}><circle cx="9" cy="8" r="3" /><path d="M3 19a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5M21 19a6 6 0 0 0-4-5.6" /></Ico>,
  clock:      p => <Ico {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Ico>,
  alert:      p => <Ico {...p}><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></Ico>,
  flag:       p => <Ico {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></Ico>,
  target:     p => <Ico {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".6" /></Ico>,
  activity:   p => <Ico {...p} d="M3 12h4l2.5 7 5-15L17 12h4" />,
  'trend-up': p => <Ico {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></Ico>,
  'trend-down': p => <Ico {...p}><path d="M3 7l6 6 4-4 8 8" /><path d="M21 17v-4h-4" /></Ico>,
  message:    p => <Ico {...p}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></Ico>,
  calendar:   p => <Ico {...p}><rect x="4" y="5" width="16" height="16" rx="1.5" /><path d="M8 3v4M16 3v4M4 10h16" /></Ico>,
  check:      p => <Ico {...p} d="M5 12l5 5L20 7" />,
  user:       p => <Ico {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></Ico>,
}
function Glyph({ name, size = 16, sw = 1.75 }: { name: string; size?: number; sw?: number }) {
  const C = ICONS[name] ?? ICONS.activity
  return <>{C({ size, sw })}</>
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTS
══════════════════════════════════════════════════════════════ */
const STATUS = {
  critico: { dot: '#b03a3a', bg: '#fbe9e9' },
  medio:   { dot: '#a8691a', bg: '#fef3e2' },
  ok:      { dot: '#1f6f56', bg: '#e6f3ed' },
}

function StatusDot({ status, size = 8 }: { status: keyof typeof STATUS; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0, display: 'inline-block',
      background: STATUS[status].dot,
      boxShadow: status === 'critico' ? `0 0 0 3px ${STATUS[status].bg}` : 'none',
    }} />
  )
}

function PerfilChip({ perfil, large }: { perfil: string | null; large?: boolean }) {
  return (
    <span style={{
      width: large ? 34 : 22, height: large ? 34 : 22, borderRadius: large ? 8 : 6,
      flexShrink: 0, display: 'grid', placeItems: 'center',
      fontSize: large ? 14 : 11, fontWeight: 700, color: '#0b0a09',
      background: '#f1efe9', border: '1px solid #e8e6e3', letterSpacing: 0,
    }}>
      {perfil ?? '—'}
    </span>
  )
}

function SignalPill({ s }: { s: Signal }) {
  const crit = !s.procesada && s.ageHours > CRIT_H
  const tone = s.procesada ? 'ok' : crit ? 'critico' : 'medio'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
      padding: crit ? '3px 9px 3px 9px' : '3px 9px 3px 7px',
      borderRadius: 7, background: '#fff',
      border: crit ? 'none' : '1px solid #e8e6e3',
      boxShadow: crit ? 'inset 3px 0 0 #b03a3a' : 'none',
      fontSize: 12, maxWidth: 240,
    }}>
      <span style={{ display: 'inline-flex', color: STATUS[tone].dot }}>
        <Glyph name={s.kind} size={13} sw={2} />
      </span>
      <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {s.label}
      </span>
      <span style={{ color: '#8a8885', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {antiguedad(s.ageHours)}
      </span>
      {s.procesada && <span style={{ display: 'inline-flex', color: '#1f6f56' }}><Glyph name="check" size={11} sw={2.5} /></span>}
    </span>
  )
}

function ProgressBar({ proc, total }: { proc: number; total: number }) {
  const pct = total ? Math.round((proc / total) * 100) : 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, width: 190, justifyContent: 'flex-end' }}>
      <div style={{ width: 96, height: 5, borderRadius: 99, background: '#e8e6e3', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#0b0a09', borderRadius: 99, width: pct + '%', transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11.5, color: '#8a8885', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {proc}/{total} procesadas
      </span>
    </div>
  )
}

function SummaryCards({ summary }: { summary: { pendientes: number; nodosCriticos: number; asesoresStale: number } }) {
  const cards = [
    { n: summary.pendientes,   tone: summary.pendientes > 0   ? 'critico' : 'ok', title: 'Señales pendientes',        sub: 'sin procesar por la IA',         icon: 'alert' },
    { n: summary.nodosCriticos, tone: summary.nodosCriticos > 0 ? 'medio' : 'ok', title: 'Nodos con señales >48 h',   sub: 'sin atender',                    icon: 'clock' },
  ] as const
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 30 }}>
      {cards.map((c, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, padding: '18px 20px 16px', boxShadow: '0 1px 2px rgba(11,10,9,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', color: STATUS[c.tone].dot, background: STATUS[c.tone].bg }}>
              <Glyph name={c.icon} size={17} />
            </span>
            <StatusDot status={c.tone} size={7} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-.04em', lineHeight: 1, color: c.n > 0 ? STATUS[c.tone].dot : '#0b0a09' }}>{c.n}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 10 }}>{c.title}</div>
          <div style={{ fontSize: 12.5, color: '#8a8885', marginTop: 1 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

/* ── AsesorRow ─────────────────────────────────────────────── */
function AsesorRow({ a, onOpen }: { a: AsesorNode; onOpen: (id: string) => void }) {
  const crit  = critical(a)
  const pend  = pending(a)
  const isCrit = crit.length > 0
  const active = [...pend].sort((x, y) => y.ageHours - x.ageHours).slice(0, 2)
  const extra  = pend.length - active.length
  return (
    <button onClick={() => onOpen(a.id)} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      padding: '0 18px', height: 46, borderTop: '1px solid #f0eee9',
      background: isCrit ? '#fbe9e9' : '#fafaf7',
      cursor: 'pointer', border: 'none', fontFamily: 'inherit',
      position: 'relative',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isCrit ? '#f9e2e2' : '#f5f4ef' }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isCrit ? '#fbe9e9' : '#fafaf7' }}>
      {isCrit && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#b03a3a' }} />}
      <span style={{ width: 30, flexShrink: 0 }} />
      <PerfilChip perfil={a.perfil} />
      <span style={{ fontSize: 13.5, fontWeight: 550, flexShrink: 0, width: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {a.nombre}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {active.length === 0 && <span style={{ fontSize: 12.5, color: '#b4b1ac' }}>Sin señales activas</span>}
        {active.map(s => <SignalPill key={s.id} s={s} />)}
        {extra > 0 && <span style={{ fontSize: 11.5, color: '#8a8885', fontWeight: 600, background: '#f0eee9', padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>+{extra}</span>}
      </span>
      <span style={{ color: '#b4b1ac', flexShrink: 0, opacity: 0.5 }}><Glyph name="chevron" size={15} /></span>
    </button>
  )
}

/* ── NodoRow ───────────────────────────────────────────────── */
function NodoRow({ n, expanded, onToggle, onOpenAsesor }: { n: Nodo; expanded: boolean; onToggle: () => void; onOpenAsesor: (id: string) => void }) {
  const status = nodoStatus(n)
  const { proc, total } = nodoProcesadas(n)
  const asesores = [...n.asesores].sort((a, b) => asesorUrgency(b) - asesorUrgency(a))
  return (
    <div style={{ borderTop: '1px solid #f0eee9' }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        padding: '0 18px', height: 54, cursor: 'pointer', background: 'transparent',
        border: 'none', fontFamily: 'inherit',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fbfbf9' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
        <span style={{ width: 8, flexShrink: 0 }} />
        <span style={{ display: 'inline-flex', color: '#b4b1ac', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .16s', flexShrink: 0 }}>
          <Glyph name="chevron" size={16} />
        </span>
        <span style={{ width: 3, height: 20, borderRadius: 3, flexShrink: 0, background: STATUS[status].dot, marginRight: 2 }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{n.nombre}</span>
            {n.supervisor && <span style={{ fontSize: 12.5, color: '#8a8885', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {n.supervisor}</span>}
          </span>
        </span>
        <ProgressBar proc={proc} total={total} />
        <span style={{ flexShrink: 0, width: 26, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, color: '#8a8885', background: '#f0eee9' }}>
          {n.asesores.length}
        </span>
      </button>
      {expanded && (
        <div style={{ background: '#fafaf7' }}>
          {asesores.map(a => <AsesorRow key={a.id} a={a} onOpen={onOpenAsesor} />)}
        </div>
      )}
    </div>
  )
}

/* ── InstitucionBlock ──────────────────────────────────────── */
function InstitucionBlock({ inst, expState, toggle, onOpenAsesor }: { inst: Institucion; expState: Record<string, boolean>; toggle: (k: string) => void; onOpenAsesor: (id: string) => void }) {
  const expanded = expState['inst:' + inst.id] !== false
  const nodos = [...inst.nodos].sort((a, b) => nodoUrgency(b) - nodoUrgency(a))
  const totalAs = inst.nodos.reduce((acc, n) => acc + n.asesores.length, 0)
  const critNodos = inst.nodos.filter(n => nodoStatus(n) === 'critico').length
  return (
    <div style={{ borderBottom: '1px solid #e8e6e3' }}>
      <button onClick={() => toggle('inst:' + inst.id)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        padding: '0 18px', height: 52, cursor: 'pointer', background: '#fcfcfa',
        border: 'none', fontFamily: 'inherit',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f7f6f2' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fcfcfa' }}>
        <span style={{ display: 'inline-flex', color: '#b4b1ac', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .16s', flexShrink: 0 }}>
          <Glyph name="chevron" size={18} />
        </span>
        <span style={{ display: 'inline-flex', color: '#8a8885' }}><Glyph name="building" size={18} /></span>
        <span style={{ fontSize: 14.5, fontWeight: 650 }}>{inst.nombre}</span>
        {inst.tipo && <span style={{ fontSize: 12.5, color: '#b4b1ac' }}>{inst.tipo}</span>}
        {critNodos > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b03a3a', fontWeight: 550, marginLeft: 4 }}>
            <StatusDot status="critico" size={6} />
            {critNodos} {critNodos === 1 ? 'nodo crítico' : 'nodos críticos'}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#8a8885', background: '#fafaf7', border: '1px solid #e8e6e3', padding: '4px 9px', borderRadius: 99, flexShrink: 0 }}>
          <Glyph name="users" size={13} sw={2} />{totalAs} asesores
        </span>
      </button>
      {expanded && (
        <div>
          {nodos.map(n => (
            <NodoRow key={n.id} n={n}
                     expanded={!!expState['nodo:' + n.id]}
                     onToggle={() => toggle('nodo:' + n.id)}
                     onOpenAsesor={onOpenAsesor} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── DetailPanel ───────────────────────────────────────────── */
function DetailPanel({ asesor, nodo, onClose }: { asesor: AsesorNode | null; nodo: Nodo | null; onClose: () => void }) {
  const open = !!asesor
  const sorted = asesor ? [...asesor.signals].sort((a, b) => {
    if (a.procesada !== b.procesada) return a.procesada ? 1 : -1
    return b.ageHours - a.ageHours
  }) : []
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,10,9,.28)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .26s', zIndex: 40 }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 392, maxWidth: '92vw', background: '#fff', borderLeft: '1px solid #e8e6e3', boxShadow: '0 12px 40px -8px rgba(11,10,9,.22)', zIndex: 50, transform: open ? 'none' : 'translateX(100%)', transition: 'transform .3s cubic-bezier(.32,.72,0,1)', display: 'flex', flexDirection: 'column' }}>
        {asesor && (
          <>
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 20px 18px', borderBottom: '1px solid #e8e6e3' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <PerfilChip perfil={asesor.perfil} large />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: '-.02em' }}>{asesor.nombre}</div>
                  <div style={{ fontSize: 12, color: '#8a8885', marginTop: 1 }}>Perfil {asesor.perfil ?? '—'}</div>
                </div>
              </div>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 7, display: 'grid', placeItems: 'center', color: '#8a8885', cursor: 'pointer', background: 'none', border: 'none' }}>
                <Glyph name="close" size={18} />
              </button>
            </header>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 40px' }}>
              {nodo && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0b0a09', background: '#fafaf7', border: '1px solid #e8e6e3', padding: '5px 11px', borderRadius: 99, marginBottom: 22 }}>
                  <Glyph name="building" size={12} sw={2} /> {nodo.nombre}
                  {nodo.supervisor && <span style={{ color: '#8a8885' }}>· {nodo.supervisor}</span>}
                </span>
              )}
              <section style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8885', fontWeight: 600 }}>Señales</h3>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8885', background: '#f0eee9', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, display: 'grid', placeItems: 'center' }}>{asesor.signals.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sorted.length === 0 && <p style={{ fontSize: 13, color: '#b4b1ac' }}>Sin señales registradas.</p>}
                  {sorted.map(s => {
                    const crit = !s.procesada && s.ageHours > CRIT_H
                    const tone = s.procesada ? 'ok' : crit ? 'critico' : 'medio'
                    return (
                      <div key={s.id} style={{ display: 'flex', gap: 11, padding: '11px 12px', border: crit ? 'none' : '1px solid #e8e6e3', borderRadius: 7, background: crit ? '#fbe9e9' : '#fcfcfa', boxShadow: crit ? 'inset 3px 0 0 #b03a3a' : 'none' }}>
                        <span style={{ flexShrink: 0, marginTop: 1, color: STATUS[tone].dot }}><Glyph name={s.kind} size={16} sw={2} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 550 }}>{s.label}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', padding: '2px 7px', borderRadius: 99, flexShrink: 0, color: STATUS[tone].dot, background: STATUS[tone].bg }}>
                              {s.procesada ? 'Procesada' : 'Pendiente'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#8a8885', marginTop: 3 }}>
                            <span>{s.fuente}</span><span style={{ color: '#b4b1ac' }}>·</span><span>{antiguedad(s.ageHours)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
              <section style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8885', fontWeight: 600 }}>Observaciones del supervisor</h3>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8a8885', background: '#f0eee9', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, display: 'grid', placeItems: 'center' }}>{asesor.observaciones.length}</span>
                </div>
                {asesor.observaciones.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#b4b1ac' }}>Sin observaciones. El supervisor las registra desde su Portal de Equipo.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...asesor.observaciones].sort((a, b) => b.ageHours - a.ageHours).map(o => (
                      <div key={o.id} style={{ padding: '11px 12px', border: '1px solid #e8e6e3', borderRadius: 7, background: '#fcfcfa' }}>
                        <div style={{ fontSize: 13, color: '#0b0a09', lineHeight: 1.5 }}>{o.valor || '—'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#8a8885', marginTop: 5 }}>
                          <span>{antiguedad(o.ageHours)}</span><span style={{ color: '#b4b1ac' }}>·</span>
                          <span>{o.procesada ? 'procesada' : 'pendiente de análisis'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
const EXP_KEY = 'proxis.exp.v1'
function loadExp(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(EXP_KEY) ?? '{}') } catch { return {} }
}

export default function SenalesPage() {
  const [data,     setData]     = useState<Institucion[]>([])
  const [expState, setExpState] = useState<Record<string, boolean>>({})
  const [selId,    setSelId]    = useState<string | null>(null)
  const [spin,     setSpin]     = useState(false)
  const [stamp,    setStamp]    = useState(new Date())
  const [loading,  setLoading]  = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [canareando, setCanareando] = useState(false)
  const [geminiUso, setGeminiUso] = useState<{ hoy: { llamadas: number; tokens: number; fallos: number }; cap_dia: number } | null>(null)
  const [toast,    setToast]    = useState('')

  useEffect(() => { setExpState(loadExp()) }, [])
  useEffect(() => {
    try { localStorage.setItem(EXP_KEY, JSON.stringify(expState)) } catch {}
  }, [expState])

  const toggle = useCallback((key: string) => {
    setExpState(s => ({ ...s, [key]: key.startsWith('inst:') ? !(s[key] !== false) : !s[key] }))
  }, [])

  const loadData = useCallback(async () => {
    setSpin(true)
    try {
      const [instRes, nodosRes, credsRes, signalsRes, metasRes, obsRes, perfilesRes] = await Promise.all([
        supabase.from('instituciones').select('id,nombre,tipo').eq('activo', true).order('nombre'),
        supabase.from('org_nodos').select('id,institucion_id,nombre').eq('activo', true).order('nombre'),
        supabase.from('asesor_credentials').select('asesor,org_nodo_id').eq('activo', true),
        supabase.from('behavioral_signals').select('id,asesor,tipo,fuente,valor,procesada,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('metas').select('asesor,supervisor'),
        supabase.from('behavioral_signals').select('asesor,created_at').eq('fuente', 'supervisor').order('created_at', { ascending: false }),
        supabase.from('tps_perfiles').select('asesor,perfil'),
      ])

      const insts    = instRes.data    ?? []
      const nodos    = nodosRes.data   ?? []
      const creds    = credsRes.data   ?? []
      const signals  = signalsRes.data ?? []
      const metas    = metasRes.data   ?? []
      const obsRows  = obsRes.data     ?? []
      const perfiles = perfilesRes.data ?? []

      const supMap: Record<string, string> = {}
      for (const m of metas) if (m.supervisor) supMap[m.asesor] = m.supervisor

      const perfilMap: Record<string, string> = {}
      for (const p of perfiles) perfilMap[p.asesor] = p.perfil

      const lastObsMap: Record<string, number> = {}
      for (const o of obsRows) {
        if (!(o.asesor in lastObsMap))
          lastObsMap[o.asesor] = (Date.now() - new Date(o.created_at).getTime()) / 86_400_000
      }

      const sigMap: Record<string, Signal[]> = {}
      for (const s of signals) {
        if (!sigMap[s.asesor]) sigMap[s.asesor] = []
        const meta = sigMeta(s.tipo)
        sigMap[s.asesor].push({ ...s, ageHours: ageHours(s.created_at), kind: meta.kind, label: meta.label })
      }

      function makeAsesor(nombre: string): AsesorNode {
        const all = sigMap[nombre] ?? []
        return {
          id: nombre, nombre, perfil: perfilMap[nombre] ?? null,
          signals:       all.filter(s => s.tipo !== 'observacion_supervisor'), // alertas (excluye observaciones)
          observaciones: all.filter(s => s.tipo === 'observacion_supervisor'), // input del supervisor (read-only)
          obsDays: Math.round(lastObsMap[nombre] ?? 999),
        }
      }

      // Build nodo → asesores from credentials
      const nodoAsesores: Record<string, AsesorNode[]> = {}
      for (const c of creds) {
        const nid = c.org_nodo_id ?? '__sin_nodo__'
        if (!nodoAsesores[nid]) nodoAsesores[nid] = []
        nodoAsesores[nid].push(makeAsesor(c.asesor))
      }

      function nodoSupervisor(nid: string) { const as = nodoAsesores[nid] ?? []; for (const a of as) if (supMap[a.id]) return supMap[a.id]; return null }
      function nodoSupObsDays(nid: string) { const as = nodoAsesores[nid] ?? []; return as.length ? Math.max(...as.map(a => a.obsDays)) : 0 }

      // Hierarchy from org structure
      const orgResult: Institucion[] = insts.map(inst => ({
        id: inst.id, nombre: inst.nombre, tipo: inst.tipo,
        nodos: nodos.filter(n => n.institucion_id === inst.id).map(n => ({
          id: n.id, nombre: n.nombre,
          supervisor: nodoSupervisor(n.id),
          supervisorObsDays: nodoSupObsDays(n.id),
          asesores: nodoAsesores[n.id] ?? [],
        })).filter(n => n.asesores.length > 0),
      })).filter(inst => inst.nodos.length > 0)

      // Fallback: asesores with signals but no org assignment
      const assignedAsesores = new Set(creds.map(c => c.asesor))
      const unassigned = [...new Set(signals.map(s => s.asesor))].filter(a => !assignedAsesores.has(a))

      if (unassigned.length > 0) {
        orgResult.push({
          id: '__sin_estructura__', nombre: 'Sin estructura asignada', tipo: 'Asesores sin nodo',
          nodos: [{
            id: '__sin_nodo__', nombre: 'Sin nodo', supervisor: null, supervisorObsDays: 0,
            asesores: unassigned.map(makeAsesor),
          }],
        })
      }

      // Also add asesores assigned to no nodo
      if (nodoAsesores['__sin_nodo__']?.length) {
        const existing = orgResult.find(i => i.id === '__sin_estructura__')
        if (existing) existing.nodos[0].asesores.push(...nodoAsesores['__sin_nodo__'])
        else orgResult.push({
          id: '__sin_estructura__', nombre: 'Sin estructura asignada', tipo: 'Asesores sin nodo',
          nodos: [{ id: '__sin_nodo__', nombre: 'Sin nodo', supervisor: null, supervisorObsDays: 0, asesores: nodoAsesores['__sin_nodo__'] }],
        })
      }

      setData(orgResult)
      setStamp(new Date())
    } catch (e) {
      console.error('Error loading señales:', e)
    }
    setSpin(false)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const loadGeminiUso = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/gemini-uso')
      if (r.ok) setGeminiUso(await r.json())
    } catch { /* silencioso */ }
  }, [])
  useEffect(() => { loadGeminiUso() }, [loadGeminiUso])

  const procesar = useCallback(async () => {
    setProcesando(true)
    try {
      const r = await fetch('/api/admin/procesar-senales', { method: 'POST' })
      const j = await r.json()
      if (r.ok) {
        setToast(j.senales > 0
          ? `${j.senales} señal(es) procesadas · ${j.hipotesis} hipótesis generadas`
          : 'Sin cambios: 0 señales procesadas (posible límite temporal de la IA — reintenta en un momento)')
        await loadData()
      } else setToast('Error: ' + (j.error ?? 'desconocido'))
    } catch { setToast('Error de red al procesar') }
    setProcesando(false)
    setTimeout(() => setToast(''), 4500)
  }, [loadData])

  // Arnés de canarios: auto-test activo del pipeline end-to-end (on-demand).
  const correrCanarios = useCallback(async () => {
    setCanareando(true)
    try {
      const r = await fetch('/api/admin/canarios', { method: 'POST' })
      const j = await r.json()
      if (r.ok) {
        const fallos  = (j.resultados ?? []).filter((x: any) => !x.ok && !x.skipped).map((x: any) => x.id)
        const incon   = (j.resultados ?? []).filter((x: any) => x.skipped && x.id !== 'C1').length
        setToast(j.ok
          ? `Canarios ✓ ${j.passed} contrato(s) OK${incon ? ` · ${incon} inconcluso(s)` : ''}${j.gemini_ok ? '' : ' · Gemini sin cuota'}`
          : `Canarios ✗ ${j.failed} fallo(s) de contrato: ${fallos.join(', ')}`)
      } else setToast('Error: ' + (j.error ?? 'desconocido'))
    } catch { setToast('Error de red al correr canarios') }
    setCanareando(false)
    loadGeminiUso()  // los canarios IA consumen Gemini → refrescar el medidor
    setTimeout(() => setToast(''), 6500)
  }, [loadGeminiUso])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelId(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // resolve selected asesor + nodo
  let selAsesor: AsesorNode | null = null
  let selNodo: Nodo | null = null
  if (selId) {
    outer: for (const inst of data) for (const n of inst.nodos) for (const a of n.asesores) {
      if (a.id === selId) { selAsesor = a; selNodo = n; break outer }
    }
  }

  const summary = globalSummary(data)
  const hhmm = stamp.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  const insts = [...data].sort((a, b) => {
    const ca = a.nodos.filter(n => nodoStatus(n) === 'critico').length
    const cb = b.nodos.filter(n => nodoStatus(n) === 'critico').length
    return cb - ca
  })

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 36px 120px', fontFamily: 'Inter,-apple-system,system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Panel admin
            </Link>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.03em' }}>Señales de comportamiento</h1>
          <p style={{ color: '#8a8885', fontSize: 13, marginTop: 3 }}>Centro de alertas · actualizado {hhmm}</p>
          {geminiUso && (() => {
            const { llamadas, tokens, fallos } = geminiUso.hoy
            const pct = Math.round((llamadas / geminiUso.cap_dia) * 100)
            const alto = llamadas >= geminiUso.cap_dia * 0.8
            return (
              <div title={`Medidor de uso de Gemini (free-tier). Tope conservador ~${geminiUso.cap_dia} llamadas/día. ${tokens.toLocaleString('es-CL')} tokens hoy · ${fallos} fallo(s).`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: alto ? '#fdf0e6' : '#f3f2f0', color: alto ? '#9a4a16' : '#6a6864', border: `1px solid ${alto ? '#f0d3bd' : '#e8e6e3'}` }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: alto ? '#e07a3a' : '#9bb89b' }} />
                Gemini hoy: {llamadas} llamada{llamadas === 1 ? '' : 's'} · {pct}% del tope{fallos > 0 ? ` · ${fallos} fallo${fallos === 1 ? '' : 's'}` : ''}
              </div>
            )
          })()}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={procesar} disabled={procesando} title="Procesa las señales pendientes con el motor IA (genera hipótesis)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 15px', borderRadius: 7, fontSize: 13.5, fontWeight: 600, background: '#0b0a09', color: '#fff', border: 'none', cursor: procesando ? 'default' : 'pointer', fontFamily: 'inherit', opacity: procesando ? 0.6 : 1 }}>
            <Glyph name="activity" size={15} />
            {procesando ? 'Procesando…' : 'Procesar ahora'}
          </button>
          <button onClick={correrCanarios} disabled={canareando} title="Arnés de canarios: siembra datos sintéticos, invoca cada pipeline y verifica su contrato (on-demand, no gasta Gemini en el cron)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 15px', borderRadius: 7, fontSize: 13.5, fontWeight: 500, background: '#fff', border: '1px solid #e8e6e3', cursor: canareando ? 'default' : 'pointer', fontFamily: 'inherit', opacity: canareando ? 0.6 : 1 }}>
            <Glyph name="activity" size={15} />
            {canareando ? 'Verificando…' : 'Correr canarios'}
          </button>
          <button onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 15px', borderRadius: 7, fontSize: 13.5, fontWeight: 500, background: '#fff', border: '1px solid #e8e6e3', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'inline-flex', animation: spin ? 'spin .65s linear infinite' : 'none' }}>
              <Glyph name="refresh" size={15} />
            </span>
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8a8885' }}>Cargando señales…</div>
      ) : (
        <>
          <SummaryCards summary={summary} />

          {/* Tree */}
          <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 10, boxShadow: '0 1px 2px rgba(11,10,9,.04)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid #e8e6e3' }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8885' }}>Jerarquía</span>
              <div style={{ display: 'flex', gap: 16 }}>
                {(['critico', 'medio', 'ok'] as const).map(s => (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8a8885' }}>
                    <StatusDot status={s} size={7} />
                    {s === 'critico' ? 'Señales >48 h' : s === 'medio' ? 'Pendientes' : 'Al día'}
                  </span>
                ))}
              </div>
            </div>
            <div>
              {insts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#8a8885', fontSize: 13 }}>
                  Sin estructura organizacional configurada.{' '}
                  <Link href="/admin/jerarquia" style={{ color: '#cbf135', fontWeight: 600 }}>Configurar en Jerarquía →</Link>
                </div>
              ) : insts.map(inst => (
                <InstitucionBlock key={inst.id} inst={inst} expState={expState} toggle={toggle} onOpenAsesor={setSelId} />
              ))}
            </div>
          </div>
        </>
      )}

      <DetailPanel asesor={selAsesor} nodo={selNodo} onClose={() => setSelId(null)} />

      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#0b0a09', color: '#fff', fontSize: 13, fontWeight: 500, padding: '10px 22px', borderRadius: 30, zIndex: 999 }}>{toast}</div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
