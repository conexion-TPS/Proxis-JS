'use client'
import { useEffect, useRef, useState } from 'react'

/*
 * <MiInforme> — render compartido de "Mi Informe" (T3b). Extraído 1:1 de
 * src/app/app/informe/page.tsx (el bloque de contenido + helpers + charts + tooltip).
 * Lo usan /app/informe (asesor, su propio informe) y el Tracker "Desempeño individual"
 * (supervisor viendo el informe de un asesor). Solo presentación; recibe el DTO ya calculado.
 * Las clases CSS (.mc, .dt, .chart-wrap, etc.) las provee el <style> de la página contenedora.
 */

const MESES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const getMesLabel = (m: string) => { const [y, mo] = m.split('-'); return `${MESES_NOM[parseInt(mo) - 1]} ${y}` }
const fmt = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CL')
const semaforo = (pct: number) => (pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'bad')
const VINCULOS = ['Amigo/a', 'Familiar', 'Cliente', 'Conocido/a']

const TOOLTIPS: Record<string, string> = {
  'prospectos-obtenidos': 'Prospectos obtenidos: total de prospectos referidos por tus contactos este mes. Es el resultado central de la actividad de contacto.',
  'contactos-realizados': 'Contactos realizados: personas que activaste como nodo potencial esta semana. Cada contacto puede darte hasta 5 prospectos.',
  'eficiencia-contactos': 'Eficiencia de Contactos: cuánto del potencial máximo estás aprovechando. Si cada contacto diera 5 referidos, el potencial sería mayor. Meta: ≥80%.',
}

export type Semana = { semana: number; fecha: string; contactos: number; reuniones: number; prospectos: number; potencial: number; prom: number; esFantasma: boolean; confirmado: boolean }
export type Informe = {
  mes: string; hasReportes: boolean; semanasCount: number
  identidad?: { nombre: string; institucion: string | null; via: string; tipo: string }
  meta?: { meta_contactos_semana: number; meta_contactos_mes: number; meta_prospectos_mes: number; meta_ventas_mes: number; meta_ingresos: number }
  meta_existe?: boolean
  ingreso?: number
  kpis?: { totC: number; totR: number; totP: number; totPot: number; promG: number; tasaReu: number; efic: number; brecha: number; prospReu: number; mejorV: [string, number] | null }
  semanas?: Semana[]
  vincAcum?: Record<string, number>
  nodos?: {
    count: number; totalActs: number; totalProsp: number; ultPct: number
    lista: { nombre: string; activaciones: number; total_prospectos: number; fecha_conversion: string | null }[]
    chart: { labels: string[]; dAcum: number[]; dNuevos: number[]; dProspNodos: number[]; dProspTotal: number[]; dPct: number[] }
  }
  avances?: { avMes: number | null; avC: number | null; avIng: number | null }
}
type Tip = { show: boolean; x: number; y: number; title: string; body: string }

// Calco de interpretarNodos() (esEquipo=false): mensajes según tendencia de la red de nodos.
function interpretarNodos(ch: { dAcum: number[]; dNuevos: number[]; dPct: number[]; labels: string[] }): { color: string; txt: string }[] {
  const { dAcum, dNuevos, dPct, labels } = ch
  if (!dAcum.length) return []
  const ultimo = dAcum[dAcum.length - 1], ultNuevos = dNuevos[dNuevos.length - 1], ultPct = dPct[dPct.length - 1]
  const msgs: { color: string; txt: string }[] = []
  let planos = 0; for (let i = dNuevos.length - 1; i >= 0; i--) { if (dNuevos[i] === 0) planos++; else break }
  if (planos >= 2) msgs.push({ color: '#BA7517', txt: `Llevas ${planos} mes${planos > 1 ? 'es' : ''} sin nuevos nodos — es momento de reactivar contactos anteriores.` })
  else if (ultNuevos >= 2) msgs.push({ color: '#0F6E56', txt: `Mes destacado: ${ultNuevos} nodos nuevos en ${labels[labels.length - 1]}. La red está creciendo activamente.` })
  else if (ultNuevos === 1) msgs.push({ color: '#0F6E56', txt: `Se agregó 1 nodo nuevo este mes. Ritmo constante de profundización.` })
  if (dPct.length >= 2) {
    const diff = ultPct - (dPct[dPct.length - 2] || 0)
    if (diff >= 10) msgs.push({ color: '#0F6E56', txt: `La proporción de prospectos de nodos subió ${diff}% este mes — la red está rindiendo más.` })
    else if (diff <= -10) msgs.push({ color: '#BA7517', txt: `La proporción de prospectos de nodos bajó ${Math.abs(diff)}% — los nodos están menos activos.` })
  }
  if (ultPct >= 40) msgs.push({ color: '#0F6E56', txt: `Más del ${ultPct}% de tus prospectos ya vienen de la red de nodos — hábito consolidado.` })
  else if (ultPct >= 20) msgs.push({ color: '#185FA5', txt: `${ultPct}% de tus prospectos vienen de nodos. El objetivo es superar el 40%.` })
  else if (ultimo > 0) msgs.push({ color: '#BA7517', txt: `Solo el ${ultPct}% de tus prospectos vienen de nodos — la red aún no está rindiendo su potencial.` })
  return msgs
}

export default function MiInforme({ dto, mes }: { dto: Informe; mes: string }) {
  const [tip, setTip] = useState<Tip>({ show: false, x: 0, y: 0, title: '', body: '' })
  const actRef = useRef<HTMLCanvasElement | null>(null)
  const potRef = useRef<HTMLCanvasElement | null>(null)
  const nodRef = useRef<HTMLCanvasElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartsRef = useRef<any[]>([])

  // Gráficos (Chart.js) — calco de renderInformeCharts()
  useEffect(() => {
    chartsRef.current.forEach((c) => c.destroy())
    chartsRef.current = []
    const semanas = dto?.semanas
    if (!dto?.hasReportes || !semanas || !actRef.current || !potRef.current) return
    let cancelado = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('chart.js/auto').then((mod: any) => {
      if (cancelado) return
      const Chart = mod.default
      const labels = semanas.map((s) => `Sem. ${s.semana}`)
      chartsRef.current.push(new Chart(actRef.current, {
        type: 'bar',
        data: {
          labels, datasets: [
            { label: 'Contactos', data: semanas.map((s) => s.contactos), backgroundColor: '#B5D4F4' },
            { label: 'Reuniones', data: semanas.map((s) => s.reuniones), backgroundColor: '#9FE1CB' },
            { label: 'Prospectos', data: semanas.map((s) => s.prospectos), backgroundColor: '#003781' },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: false } } } },
      }))
      let ap = 0, ar = 0; const dp: number[] = [], dr: number[] = []
      semanas.forEach((s) => { ap += s.potencial; ar += s.prospectos; dp.push(ap); dr.push(ar) })
      chartsRef.current.push(new Chart(potRef.current, {
        type: 'line',
        data: {
          labels, datasets: [
            { label: 'Potencial', data: dp, borderColor: '#9E9D97', backgroundColor: 'transparent', borderDash: [5, 5] },
            { label: 'Real', data: dr, borderColor: '#003781', backgroundColor: 'rgba(0,55,129,.1)', fill: true },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: false } } } },
      }))

      // Gráfico de nodos (calco de buildNodosChart) — tri-dataset, ejes y/y2/y3
      const nod = dto.nodos
      if (nod && nod.count > 0 && nodRef.current) {
        const c = nod.chart
        chartsRef.current.push(new Chart(nodRef.current, {
          data: {
            labels: c.labels, datasets: [
              { type: 'bar', label: 'Nuevos nodos', data: c.dNuevos, backgroundColor: c.dNuevos.map((v) => v === 0 ? 'rgba(242,91,91,.18)' : 'rgba(15,110,86,.3)'), borderColor: c.dNuevos.map((v) => v === 0 ? '#F7C1C1' : '#5DCAA5'), borderWidth: 1, borderRadius: 3, yAxisID: 'y2', order: 3 },
              { type: 'line', label: 'Nodos acumulados', data: c.dAcum, borderColor: '#0F6E56', backgroundColor: 'rgba(15,110,86,.08)', fill: true, tension: .3, pointRadius: 4, pointBackgroundColor: c.dNuevos.map((v) => v === 0 ? '#E24B4A' : '#0F6E56'), pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y', order: 1 },
              { type: 'line', label: 'Prospectos de nodos', data: c.dProspNodos, borderColor: '#185FA5', borderDash: [5, 4], backgroundColor: 'transparent', tension: .3, pointRadius: 3, borderWidth: 2, yAxisID: 'y3', order: 2 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            plugins: { legend: { display: false }, tooltip: { callbacks: { afterBody: (items: any) => {
              const i = items[0]?.dataIndex; const pct = c.dPct[i]; const nn = c.dNuevos[i]; const lines: string[] = []
              if (pct != null) lines.push('% del total: ' + pct + '%'); if (nn === 0) lines.push('⚠ Sin nodo nuevo este mes'); return lines
            } } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              y: { position: 'left', min: 0, title: { display: true, text: 'Acumulados', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { stepSize: 1, font: { size: 10 } } },
              y2: { position: 'right', min: 0, max: Math.max(...c.dNuevos) + 1, title: { display: true, text: 'Nuevos', font: { size: 10 } }, grid: { display: false }, ticks: { stepSize: 1, font: { size: 10 } } },
              y3: { display: false },
            },
          },
        }))
      }
    })
    return () => { cancelado = true; chartsRef.current.forEach((c) => c.destroy()); chartsRef.current = [] }
  }, [dto])

  // ── Tooltip flotante (calco de showTooltip/#tooltip-modal) ──
  function moverTip(k: string, e: React.MouseEvent) {
    const body = TOOLTIPS[k]; if (!body) return
    const title = k.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    setTip({ show: true, title, body, x: Math.min(e.clientX + 12, window.innerWidth - 300), y: Math.max(e.clientY - 60, 10) })
  }
  const ocultarTip = () => setTip((t) => ({ ...t, show: false }))

  function Info({ k }: { k: string }) {
    return (
      <span onMouseEnter={(e) => moverTip(k, e)} onMouseMove={(e) => moverTip(k, e)} onMouseLeave={ocultarTip}
        style={{ cursor: 'help', color: 'var(--blue)', fontStyle: 'normal' }}> <span className="ico-info">i</span></span>
    )
  }

  // ── Tile (calco de mc / mcBad / mcOk / emptyMc) ──
  function Tile({ label, info, value, sub, pct, explain, tone, valueSize, borderColor, bg, corner, bold }: {
    label: string; info?: string; value: React.ReactNode; sub?: React.ReactNode
    pct?: number | null; explain?: string; tone?: 'ok' | 'bad'; valueSize?: number
    borderColor?: string; bg?: string; corner?: string; bold?: boolean
  }) {
    const cls = tone ? `mc ${tone}` : pct != null ? `mc ${semaforo(pct)}` : 'mc'
    const dot = tone === 'bad' ? 'bad' : tone === 'ok' ? null : pct != null ? semaforo(pct) : null
    const style: React.CSSProperties = { position: 'relative' }
    if (borderColor) style.border = `3px solid ${borderColor}`
    if (bg) style.background = bg
    return (
      <div className={cls} style={style}>
        {corner && <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 27, lineHeight: 1 }}>{corner}</div>}
        {dot && <div className={`semaforo ${dot}`} />}
        <div className="mc-label" style={bold ? { fontWeight: 700 } : undefined}>{label}{info && <Info k={info} />}</div>
        <div className="mc-value" style={valueSize ? { fontSize: valueSize } : undefined}>{value}</div>
        {sub != null && sub !== '' && <div className="mc-sub">{sub}</div>}
        {explain && <div className="mc-explain">{explain}</div>}
      </div>
    )
  }

  const k = dto.kpis, av = dto.avances, meta = dto.meta, semanas = dto.semanas, vincAcum = dto.vincAcum
  if (!k || !av || !meta) return null

  return (
    <>
      {/* Card: Nodos activos (calco de renderInformeHTML nodos-section + loadNodosEnInforme) */}
      <div className="card" style={{ border: '2px solid var(--teal)', marginBottom: 16 }}>
        <div className="card-title" style={{ color: 'var(--teal)' }}>✦ Nodos activos</div>
        {dto.nodos && dto.nodos.count > 0 ? (
          <>
            <div className="grid4" style={{ marginBottom: 14 }}>
              <div className="mc ok"><div className="mc-label">Nodos activos</div><div className="mc-value">{dto.nodos.count}</div><div className="mc-sub">contactos convertidos en nodo</div></div>
              <div className="mc"><div className="mc-label">Total activaciones</div><div className="mc-value">{dto.nodos.totalActs}</div><div className="mc-sub">veces que han vuelto a referir</div></div>
              <div className="mc"><div className="mc-label">Prospectos de nodos</div><div className="mc-value">{dto.nodos.totalProsp}</div><div className="mc-sub">total histórico acumulado</div></div>
              <div className="mc"><div className="mc-label">% del total este mes</div><div className="mc-value">{dto.nodos.ultPct}%</div><div className="mc-sub">de prospectos vienen de nodos</div></div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {dto.nodos.lista.map((n, i) => (
                <div key={i} style={{ background: 'var(--teal-lt)', border: '1px solid rgba(15,110,86,.3)', borderRadius: 'var(--r)', padding: '9px 12px', minWidth: 160 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g900)' }}>🌳 {n.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 2 }}>{n.activaciones} activaciones · {n.total_prospectos || 0} prosp.</div>
                  <div style={{ fontSize: 10, color: 'var(--g400)' }}>Nodo desde {n.fecha_conversion || '—'}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--g400)', marginBottom: 6 }}>Evolución de nodos acumulados y prospectos generados</p>
            <div style={{ display: 'flex', gap: 14, marginBottom: 6, fontSize: 11, color: 'var(--g400)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 4, background: '#0F6E56', borderRadius: 2, display: 'inline-block' }} />Nodos acumulados</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 0, borderTop: '2px dashed #185FA5', display: 'inline-block' }} />Prospectos de nodos</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'rgba(15,110,86,.3)', borderRadius: 2, display: 'inline-block' }} />Nuevos nodos</span>
            </div>
            <div style={{ position: 'relative', height: 160 }}><canvas ref={nodRef} role="img" aria-label="Evolución nodos" /></div>
            {interpretarNodos(dto.nodos.chart).length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {interpretarNodos(dto.nodos.chart).map((m, i) => (
                  <div key={i} style={{ fontSize: 11, lineHeight: 1.5, padding: '7px 10px', borderRadius: 'var(--r)', borderLeft: `3px solid ${m.color}`, background: m.color + '18', color: 'var(--g700)' }}>{m.txt}</div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--g100)', borderRadius: 'var(--r)' }}>
            <span style={{ fontSize: 20 }}>🌱</span>
            <p style={{ fontSize: 12, color: 'var(--g700)', lineHeight: 1.5 }}>Aún no hay nodos confirmados. Un contacto se convierte en <strong>nodo</strong> cuando refiere prospectos en más de una ocasión.</p>
          </div>
        )}
      </div>

      {/* Card: Resumen del mes */}
      <div className="card">
        <div className="card-title">Resumen del mes — {getMesLabel(mes)}</div>
        <div className="grid4" style={{ marginBottom: 12 }}>
          <Tile label="Prospectos obtenidos" info="prospectos-obtenidos" value={k.totP} sub={dto.meta_existe ? `Meta: ${meta.meta_prospectos_mes} · ${av.avMes}% cumplido` : 'Sin meta definida aún'} pct={av.avMes} explain="Total de prospectos que tus contactos te referenciaron este mes. Es el resultado central de toda la actividad de prospección." />
          <Tile label="Contactos realizados" info="contactos-realizados" value={k.totC} sub={`Meta: ${meta.meta_contactos_semana * dto.semanasCount} (${meta.meta_contactos_semana}/sem × ${dto.semanasCount} sem)`} pct={av.avC} explain="Número de nodos relacionales activados. Cada contacto es una persona que puede referirte entre 3 y 5 prospectos calificados." />
          <Tile label="Tasa de reunión" value={`${k.tasaReu}%`} sub={`${k.totR} reuniones de ${k.totC} contactos · Meta: ≥60%`} pct={Math.round(k.tasaReu / 60 * 100)} explain="Porcentaje de contactos que aceptaron reunirse. Mide tu capacidad de apertura y la confianza que genera tu acercamiento." />
          <Tile label="Eficiencia de Contactos" info="eficiencia-contactos" value={`${k.efic}%`} sub={`Prospectos reales vs. potencial (${k.totPot})`} pct={k.efic} explain={`¿Cuánto del potencial máximo aprovechas? Si cada contacto diera 5 referidos, el potencial sería ${k.totPot}. Meta: ≥80%.`} />
        </div>
        <div className="grid4">
          <Tile label="Prospectos / contacto" value={k.promG} sub="Meta: ≥ 4,5 prospectos" pct={Math.round(k.promG / 4.5 * 100)} explain="Indicador clave de efectividad. Si es bajo, trabajar el guión de solicitud, la confianza y la imagen personal ante el contacto." />
          <Tile label="Prospectos / reunión" value={k.prospReu} sub={`${k.totR} reuniones · Meta: ≥ 4`} pct={Math.round(k.prospReu / 4 * 100)} explain="Calidad de cada reunión. Al reunirte, deberías salir siempre con al menos 4 nombres de referidos calificados." />
          <Tile label="Brecha de prospectos" value={k.brecha} sub="Prospectos no obtenidos este mes" tone="bad" explain="Cuántos prospectos se perdieron por no llegar a 5 referidos por contacto. Representa oportunidad no capitalizada." />
          {k.mejorV
            ? <Tile label="Vínculo más productivo" value={k.mejorV[0]} sub={`${k.mejorV[1]} prospectos generados`} tone="ok" valueSize={18} explain="El tipo de relación que más referidos produce. Prioriza tu energía en estos vínculos." />
            : <Tile label="Vínculo" value="—" sub="" valueSize={18} />}
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--g200)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--g400)', marginBottom: 10 }}>CORRELACIÓN ACTIVIDAD → INGRESOS</p>
          <div className="grid2">
            <Tile
              label="Meta de ingresos proyectados del mes" bold
              value={dto.meta_existe ? fmt(meta.meta_ingresos) : <span style={{ color: 'var(--g400)', fontWeight: 500 }}>Sin meta definida aún</span>}
              valueSize={dto.meta_existe ? undefined : 15}
              borderColor="#639922" corner="🏆"
              explain="La meta de ingresos es consecuencia directa de la actividad de prospección."
            />
            <Tile
              label="Meta de actividad mensual" bold
              value={dto.meta_existe ? (
                <div style={{ display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'flex-start' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: '#185FA5' }}>{meta.meta_contactos_mes ?? 0}</div>
                    <div style={{ fontSize: 11, color: 'var(--g400)', marginTop: 4 }}>contactos</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: '#161614' }}>{meta.meta_prospectos_mes ?? 0}</div>
                    <div style={{ fontSize: 11, color: 'var(--g400)', marginTop: 4 }}>prospectos</div>
                  </div>
                </div>
              ) : <span style={{ color: 'var(--g400)', fontWeight: 500 }}>Sin meta definida aún</span>}
              borderColor="#85B7EB" bg="#E6F1FB" corner="🏁"
            />
          </div>
        </div>
      </div>

      {/* Card: Evolución semanal */}
      <div className="card">
        <div className="card-title">Evolución semanal</div>
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="dt">
            <thead><tr><th>Semana</th><th>Contactos</th><th>Reuniones</th><th>Tasa reunión</th><th>Prospectos</th><th>Potencial</th><th>Prom./contacto</th><th>Estado</th></tr></thead>
            <tbody>
              {(semanas ?? []).map((s, i) => {
                const sinAct = s.contactos === 0
                const rowStyle: React.CSSProperties = s.esFantasma ? { background: 'var(--red-lt)', opacity: .7 } : sinAct ? { background: 'var(--red-lt)' } : {}
                const promCls = s.prom >= 4.5 ? 'pill-gn' : s.prom >= 3 ? 'pill-am' : 'pill-rd'
                return (
                  <tr key={i} style={rowStyle}>
                    <td>Semana {s.semana} <span style={{ fontSize: 11, color: 'var(--g400)' }}>({s.fecha})</span></td>
                    <td><strong>{s.contactos}</strong></td><td>{s.reuniones}</td>
                    <td>{s.contactos ? Math.round(s.reuniones / s.contactos * 100) : 0}%</td>
                    <td><strong>{s.prospectos}</strong></td>
                    <td style={{ color: 'var(--g400)' }}>{s.potencial}</td>
                    <td>{sinAct ? <span className="pill pill-rd">Sin actividad</span> : <span className={`pill ${promCls}`}>{s.prom}</span>}</td>
                    <td>{s.esFantasma ? <span className="pill pill-rd">Sin reporte</span> : sinAct ? <span className="pill pill-rd">Sin contactos</span> : <span className="pill pill-bl">Guardado</span>}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot><tr style={{ fontWeight: 600, borderTop: '2px solid var(--g200)' }}>
              <td>Total mes</td><td>{k.totC}</td><td>{k.totR}</td><td>{k.tasaReu}%</td>
              <td>{k.totP}</td><td style={{ color: 'var(--g400)' }}>{k.totPot}</td>
              <td><span className={`pill ${k.promG >= 4.5 ? 'pill-gn' : k.promG >= 3 ? 'pill-am' : 'pill-rd'}`}>{k.promG}</span></td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>
        <div className="grid2">
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--g400)', marginBottom: 6 }}>EVOLUCIÓN DE ACTIVIDAD</p>
            <div className="chart-wrap"><canvas ref={actRef} role="img" aria-label="Gráfico de evolución de actividad semanal" /></div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--g400)', marginBottom: 6 }}>POTENCIAL vs. REAL ACUMULADO</p>
            <div className="chart-wrap"><canvas ref={potRef} role="img" aria-label="Gráfico de potencial vs real acumulado" /></div>
          </div>
        </div>
      </div>

      {/* Card: Productividad por tipo de vínculo */}
      {vincAcum && Object.keys(vincAcum).length > 0 && (
        <div className="card">
          <div className="card-title">Productividad por tipo de vínculo</div>
          <p style={{ fontSize: 12, color: 'var(--g400)', marginBottom: 12, marginLeft: 12 }}>Prospectos generados según el tipo de relación con el contacto. Identifica dónde concentrar el esfuerzo.</p>
          <div className="grid4">
            {VINCULOS.map((v) => (
              <div className="mc" key={v}>
                <div className="mc-label">{v}</div>
                <div className="mc-value">{vincAcum[v] || 0}</div>
                <div className="mc-sub">prospectos</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip flotante */}
      <div style={{ display: tip.show ? 'block' : 'none', position: 'fixed', zIndex: 900, pointerEvents: 'none', left: tip.x, top: tip.y }}>
        <div style={{ background: 'var(--g900)', color: 'white', borderRadius: 10, padding: '10px 14px', maxWidth: 280, fontSize: 12, lineHeight: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tip.title}</div>
          <div>{tip.body}</div>
        </div>
      </div>
    </>
  )
}
