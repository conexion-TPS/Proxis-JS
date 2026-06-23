'use client'

import { useEffect, useMemo, useState } from 'react'

/* ── Textos editables en UN solo lugar (TPS confirmará versiones finales) ── */
const MENSAJE_INFORME =
  'Este es un informe tentativo. No representa una mirada completa ni definitiva del desempeño; ' +
  'es una lectura preliminar generada por el sistema y debe interpretarse con criterio profesional.'
const PIE_INFORME = '2026 - Futura Soluciones Digitales Ltda. Derechos Reservados.'

/* ── Paleta Proxis ── */
const C = {
  tinta: '#0b0a09', lima: '#cbf135', verde: '#a8cc1a', azul: '#1a56c4',
  borde: '#e8e6e3', gris: '#8a8885', fondo: '#fafaf7',
}
const CUAD_FILL: Record<string, string> = {
  'Sólido': '#eef7d6', 'Revisar técnica': '#fef3cd', 'Frágil': '#e7eefb', 'Prioridad disciplina': '#fdeaea',
}
const MES_LBL: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}
const lblMes = (m: string) => `${MES_LBL[m.slice(5, 7)] ?? m} ${m.slice(0, 4)}`
const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`)

type SerieItem = { mes: string; indice: number | null; resultado: number | null; cuadrante: string }
type AsesorSerie = { asesor: string; persona_id: string; serie: SerieItem[] }
type EquipoItem = SerieItem & { n_asesores: number; volumen: number | null; habito: number | null; calidad: number | null }
type Data = { meses: string[]; nodo: string | null; asesores: AsesorSerie[]; equipo: EquipoItem[] }

function ProxisLogo() { // réplica de admin/layout.tsx (no exportada allí)
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="4.5" fill={C.verde} />
      <circle cx="6" cy="9" r="3" fill={C.verde} opacity="0.85" />
      <circle cx="26" cy="9" r="3" fill={C.verde} opacity="0.85" />
      <circle cx="6" cy="23" r="3" fill={C.verde} opacity="0.6" />
      <circle cx="26" cy="23" r="3" fill={C.verde} opacity="0.6" />
      <line x1="8.6" y1="10.6" x2="13.2" y2="14.0" stroke={C.verde} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="23.4" y1="10.6" x2="18.8" y2="14.0" stroke={C.verde} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="8.6" y1="21.4" x2="13.2" y2="18.0" stroke={C.verde} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="23.4" y1="21.4" x2="18.8" y2="18.0" stroke={C.verde} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export default function Desempeno({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [seleccion, setSeleccion] = useState<'equipo' | string>('equipo')   // G1: entidad
  const [mesG2, setMesG2] = useState<string | null>(null)                   // G2: mes (null = último con datos)

  useEffect(() => {
    if (!token) return
    fetch('/api/equipo/desempeno?desde=2026-01&hasta=2026-06', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Data) => setData(d))
      .catch(() => setError('No se pudo cargar el desempeño del equipo.'))
      .finally(() => setLoading(false))
  }, [token])

  /* ── Serie activa de G1 (equipo o asesor) ── */
  const serieG1: SerieItem[] = useMemo(() => {
    if (!data) return []
    return seleccion === 'equipo'
      ? data.equipo
      : (data.asesores.find(a => a.asesor === seleccion)?.serie ?? [])
  }, [data, seleccion])

  /* ── Mes activo de G2 (último con datos de equipo) ── */
  const mesesConDatos = useMemo(
    () => (data?.equipo ?? []).filter(e => e.indice != null).map(e => e.mes),
    [data],
  )
  const mesActivo = mesG2 ?? mesesConDatos[mesesConDatos.length - 1] ?? data?.meses.at(-1) ?? null

  if (loading) return <Tarjeta><div style={{ color: C.gris, fontSize: 13 }}>Cargando desempeño…</div></Tarjeta>
  if (error || !data) return <Tarjeta><div style={{ color: '#b03a3a', fontSize: 13 }}>{error || 'Sin datos'}</div></Tarjeta>

  return (
    <div id="informe-desempeno" style={{ marginBottom: 20 }}>
      {/* estilos de impresión: el PDF es el informe limpio, no un volcado de pantalla */}
      <style>{`
        .solo-impresion { display: none; }
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden; }
          #informe-desempeno, #informe-desempeno * { visibility: visible; }
          #informe-desempeno { position: absolute; left: 0; top: 0; width: 100%; margin: 0; }
          .no-imprimir { display: none !important; }
          .solo-impresion { display: block !important; }
          .tarjeta-informe { box-shadow: none !important; border: 1px solid ${C.borde} !important; break-inside: avoid; }
        }
      `}</style>

      {/* ── Encabezado (pantalla + informe) ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 12, marginBottom: 12 }} className="tarjeta-informe">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ProxisLogo />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.tinta }}>Proxis</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.tinta, letterSpacing: '-0.02em' }}>Informe de desempeño del equipo</div>
          <p style={{ fontSize: 11.5, color: C.gris, lineHeight: 1.5, margin: '4px 0 0' }}>{MENSAJE_INFORME}</p>
        </div>
        <button onClick={() => window.print()} className="no-imprimir" style={btn(C.tinta, '#fff')}>Exportar informe</button>
      </div>

      {/* ── G1 — Trayectoria temporal ── */}
      <Tarjeta>
        <Encabezado titulo="Trayectoria (enero–junio 2026)" sub="Índice de actividad y resultado, mes a mes." />
        <div className="no-imprimir" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 14px' }}>
          <Chip activo={seleccion === 'equipo'} onClick={() => setSeleccion('equipo')}>Equipo (consolidado)</Chip>
          {data.asesores.map(a => (
            <Chip key={a.asesor} activo={seleccion === a.asesor} onClick={() => setSeleccion(a.asesor)}>{a.asesor}</Chip>
          ))}
        </div>
        <div className="solo-impresion" style={{ fontSize: 11, color: C.gris, marginBottom: 8 }}>
          Vista: {seleccion === 'equipo' ? 'Equipo (consolidado)' : seleccion}
        </div>
        <GraficoLinea meses={data.meses} serie={serieG1} />
        <Leyenda items={[['Índice de actividad', C.verde], ['Resultado', C.azul]]} />
      </Tarjeta>

      {/* ── G2 — Matriz de cuadrantes ── */}
      <Tarjeta>
        <Encabezado titulo="Matriz de cuadrantes" sub={`Actividad × resultado · ${mesActivo ? lblMes(mesActivo) : '—'}`} />
        <div className="no-imprimir" style={{ display: 'flex', gap: 6, margin: '10px 0 4px' }}>
          {mesesConDatos.map(m => (
            <Chip key={m} activo={m === mesActivo} onClick={() => setMesG2(m)}>{lblMes(m)}</Chip>
          ))}
        </div>
        <GraficoMatriz data={data} mes={mesActivo} />
      </Tarjeta>

      {/* ── Espacio reservado para el análisis cualitativo de la IA (se enchufa luego) ── */}
      <Tarjeta>
        <Encabezado titulo="Análisis" sub="Diagnóstico cualitativo del sistema" />
        <div style={{ marginTop: 10, padding: '24px 20px', border: `1px dashed ${C.borde}`, borderRadius: 10, background: C.fondo, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gris }}>Análisis — próximamente</div>
          <p style={{ fontSize: 12, color: '#b6b3ae', margin: '6px auto 0', maxWidth: 460, lineHeight: 1.5 }}>
            Aquí aparecerá la lectura cualitativa del equipo generada por el sistema una vez procesados los datos.
          </p>
        </div>
      </Tarjeta>

      {/* ── Pie (pantalla + informe) ── */}
      <div style={{ textAlign: 'center', fontSize: 10.5, color: '#b6b3ae', padding: '10px 0 2px' }}>{PIE_INFORME}</div>
    </div>
  )
}

/* ════════════════ Gráfico G1 (línea SVG) ════════════════ */
function GraficoLinea({ meses, serie }: { meses: string[]; serie: SerieItem[] }) {
  const W = 720, H = 260, padL = 40, padR = 16, padT = 16, padB = 30
  const plotW = W - padL - padR, plotH = H - padT - padB
  const yMax = 1.2
  const xFor = (i: number) => padL + (meses.length <= 1 ? 0 : (i / (meses.length - 1)) * plotW)
  const yFor = (v: number) => padT + (1 - v / yMax) * plotH
  const byMes = new Map(serie.map(s => [s.mes, s]))

  const puntos = (key: 'indice' | 'resultado') =>
    meses.map((m, i) => ({ x: xFor(i), y: byMes.get(m)?.[key] }))
      .filter(p => p.y != null)
      .map(p => ({ x: p.x, y: yFor(p.y as number) }))
  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 0.85, 1].map(g => (
        <g key={g}>
          <line x1={padL} y1={yFor(g)} x2={W - padR} y2={yFor(g)} stroke={C.borde} strokeWidth={g === 0.85 || g === 0.5 ? 1 : 0.5} strokeDasharray={g === 0.5 || g === 0.85 ? '4 3' : undefined} />
          <text x={padL - 6} y={yFor(g) + 3} textAnchor="end" fontSize="9" fill={C.gris}>{Math.round(g * 100)}%</text>
        </g>
      ))}
      {meses.map((m, i) => (
        <text key={m} x={xFor(i)} y={H - 10} textAnchor="middle" fontSize="9" fill={C.gris}>{MES_LBL[m.slice(5, 7)]}</text>
      ))}
      <path d={path(puntos('indice'))} fill="none" stroke={C.verde} strokeWidth="2.5" />
      <path d={path(puntos('resultado'))} fill="none" stroke={C.azul} strokeWidth="2.5" />
      {puntos('indice').map((p, i) => <circle key={`i${i}`} cx={p.x} cy={p.y} r="3.5" fill={C.verde} />)}
      {puntos('resultado').map((p, i) => <circle key={`r${i}`} cx={p.x} cy={p.y} r="3.5" fill={C.azul} />)}
    </svg>
  )
}

/* ════════════════ Gráfico G2 (matriz SVG) ════════════════ */
function GraficoMatriz({ data, mes }: { data: Data; mes: string | null }) {
  const W = 460, H = 420, padL = 44, padR = 16, padT = 16, padB = 40
  const plotW = W - padL - padR, plotH = H - padT - padB
  const puntosAsesor = data.asesores
    .map(a => ({ nombre: a.asesor, p: a.serie.find(s => s.mes === mes) }))
    .filter(x => x.p && x.p.indice != null && x.p.resultado != null)
    .map(x => ({ nombre: x.nombre, x: x.p!.indice as number, y: x.p!.resultado as number, esEquipo: false }))
  const eq = data.equipo.find(e => e.mes === mes)
  if (eq && eq.indice != null && eq.resultado != null)
    puntosAsesor.push({ nombre: 'EQUIPO', x: eq.indice, y: eq.resultado, esEquipo: true })

  const yMax = Math.max(1.2, ...puntosAsesor.map(p => p.y + 0.1))
  const xFor = (a: number) => padL + a * plotW
  const yFor = (r: number) => padT + (1 - r / yMax) * plotH
  const midX = xFor(0.5), midY = yFor(0.85)
  const left = padL, right = padL + plotW, top = padT, bottom = padT + plotH
  const rect = (x: number, y: number, w: number, h: number, cuad: string) => (
    <g><rect x={x} y={y} width={w} height={h} fill={CUAD_FILL[cuad]} opacity="0.5" />
      <text x={x + w / 2} y={y + h / 2} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.gris} opacity="0.8">{cuad}</text></g>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto', display: 'block', margin: '10px auto 0' }}>
      {rect(midX, top, right - midX, midY - top, 'Sólido')}
      {rect(midX, midY, right - midX, bottom - midY, 'Revisar técnica')}
      {rect(left, top, midX - left, midY - top, 'Frágil')}
      {rect(left, midY, midX - left, bottom - midY, 'Prioridad disciplina')}
      <line x1={midX} y1={top} x2={midX} y2={bottom} stroke={C.tinta} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
      <line x1={left} y1={midY} x2={right} y2={midY} stroke={C.tinta} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
      <rect x={left} y={top} width={plotW} height={plotH} fill="none" stroke={C.borde} />
      <text x={left + plotW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={C.gris}>Actividad (índice) → umbral 50%</text>
      <text x={12} y={top + plotH / 2} textAnchor="middle" fontSize="10" fill={C.gris} transform={`rotate(-90, 12, ${top + plotH / 2})`}>Resultado → umbral 85%</text>
      {puntosAsesor.map((p, i) => (
        <g key={i}>
          <title>{`${p.nombre} · actividad ${pct(p.x)} · resultado ${pct(p.y)}`}</title>
          {p.esEquipo
            ? <rect x={xFor(p.x) - 6} y={yFor(p.y) - 6} width="12" height="12" fill={C.lima} stroke={C.tinta} strokeWidth="1.5" transform={`rotate(45, ${xFor(p.x)}, ${yFor(p.y)})`} />
            : <circle cx={xFor(p.x)} cy={yFor(p.y)} r="5" fill={C.tinta} />}
          <text x={xFor(p.x) + 8} y={yFor(p.y) + 3} fontSize="9" fontWeight={p.esEquipo ? 700 : 500} fill={C.tinta}>{p.nombre}</text>
        </g>
      ))}
    </svg>
  )
}

/* ════════════════ Bloques reutilizables ════════════════ */
function Tarjeta({ children }: { children: React.ReactNode }) {
  return <div className="tarjeta-informe" style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>{children}</div>
}
function Encabezado({ titulo, sub }: { titulo: string; sub: string }) {
  return <div><div style={{ fontSize: 14, fontWeight: 800, color: C.tinta, letterSpacing: '-0.02em' }}>{titulo}</div>
    <div style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>{sub}</div></div>
}
function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{
    padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
    border: `1px solid ${activo ? C.tinta : C.borde}`, background: activo ? C.tinta : '#fff', color: activo ? '#fff' : C.gris,
  }}>{children}</button>
}
function Leyenda({ items }: { items: [string, string][] }) {
  return <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: C.gris }}>
    {items.map(([t, c]) => <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 12, height: 3, background: c, borderRadius: 2 }} />{t}</span>)}
  </div>
}
function btn(bg: string, fg: string): React.CSSProperties {
  return { padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: bg, color: fg }
}
