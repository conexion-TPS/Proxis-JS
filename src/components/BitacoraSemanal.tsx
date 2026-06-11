'use client'
import { useEffect, useRef } from 'react'

/*
 * BitacoraSemanal — vista INERTE read-only de la Bitácora del asesor en el /app.
 * Calco fiel de la bitácora A (/plataforma / plataforma-core.js), SOLO la parte de lectura:
 *   • Tarjeta de nodos  ← renderNodosPanel()    (plataforma-core.js:1550-1665)
 *   • Historial de semanas + tabla de contactos ← renderReporteLista() (plataforma-core.js:773-853)
 * Sin botones de escritura: NO se portan abrir/editar/guardar/confirmar/activar/eliminar.
 * Toda la lógica de escritura está documentada en MAPEO_BITACORA_FASE3.md (Fase 3).
 * Datos: /api/app/bitacora (proxis_dev por persona_id), mes actual + mes previo.
 */

const MESES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type ContactoB = { id: string; reporte_id: string; nombre: string; vinculo: string | null; llamo: boolean; reunion: boolean; prospectos: number; tipo_contacto: string | null; created_at: string }
type ReporteB = { id: string; semana_inicio: string; semana_num: number; confirmado: boolean; sin_actividad: boolean; contactos: ContactoB[] }
type NodoB = { id: string; nombre: string; vinculo: string | null; activaciones: number; total_prospectos: number; fecha_primer_contacto: string | null; fecha_conversion: string | null; ultima_activacion: string | null }
type ActB = { id: string; nodo_id: string; semana_inicio: string; prospectos: number }
export type BitacoraDTO = { mes: string; mesPrev: string; reportes: ReporteB[]; nodos: NodoB[]; activaciones: ActB[] }

// ── Helpers temporales (calco de plataforma-core.js) ──
const _SEM1 = new Date('2026-03-30')
const semNum = (f: string) => Math.round((+new Date(f) - +_SEM1) / (7 * 24 * 60 * 60 * 1000)) + 1
// Formatea una fecha como YYYY-MM-DD en hora LOCAL (sin pasar por UTC). Reemplaza
// d.toISOString(), que en husos UTC+ corría la fecha un día y borraba la semana del historial.
const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function getLunes(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  return fmtLocal(new Date(now.getFullYear(), now.getMonth(), diff))
}
function lunesDelMes(mesISO: string): string[] {
  const [yy, mm] = mesISO.split('-').map(Number)
  const dow = new Date(yy, mm - 1, 1).getDay()
  const back = dow === 0 ? 6 : dow - 1
  const lunes: string[] = []
  let d = new Date(yy, mm - 1, 1 - back)
  while (d < new Date(yy, mm, 1)) { lunes.push(fmtLocal(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) }
  return lunes
}

export default function BitacoraSemanal({ dto }: { dto: BitacoraDTO }) {
  const trendRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<{ destroy: () => void } | null>(null)

  // ── NODOS: semana de referencia = reporte más reciente del mes actual, o lunes de hoy (calco 1556-1560) ──
  const reportesMes = dto.reportes.filter((r) => r.semana_inicio.slice(0, 7) === dto.mes)
  const semanaRef = reportesMes.length
    ? [...reportesMes].sort((a, b) => +new Date(b.semana_inicio) - +new Date(a.semana_inicio))[0].semana_inicio
    : getLunes()
  const actsEstaSemana = dto.activaciones.filter((a) => a.semana_inicio === semanaRef)
  const nodosConAct = new Set(actsEstaSemana.map((a) => a.nodo_id))

  // ── Gráfico de tendencia de nodos (calco 1634-1664). Solo si hay nodos. ──
  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    if (!dto.nodos.length || !trendRef.current) return
    let cancel = false
    import('chart.js/auto').then(({ default: Chart }) => {
      if (cancel || !trendRef.current) return
      const byMes: Record<string, Set<string>> = {}
      for (const a of dto.activaciones) {
        const mo = a.semana_inicio?.slice(0, 7); if (!mo) continue
        ;(byMes[mo] ??= new Set()).add(a.nodo_id)
      }
      const mesesLabels = Object.keys(byMes).sort()
      let acum = 0
      const dataAcum = mesesLabels.map((mo) => { acum += byMes[mo].size; return acum })
      const dataMes = mesesLabels.map((mo) => byMes[mo].size)
      chartRef.current = new Chart(trendRef.current, {
        data: {
          labels: mesesLabels.map((m) => { const [y, mo] = m.split('-'); return MESES_NOM[parseInt(mo) - 1].slice(0, 3) + ' ' + y.slice(2) }),
          datasets: [
            { type: 'line', label: 'Nodos acumulados', data: dataAcum, borderColor: '#0F6E56', backgroundColor: 'rgba(15,110,86,.1)', fill: true, tension: .3, yAxisID: 'y' },
            { type: 'bar', label: 'Activaciones del mes', data: dataMes, backgroundColor: 'rgba(15,110,86,.3)', yAxisID: 'y' },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { font: { size: 10 }, stepSize: 1 } } } },
      })
    })
    return () => { cancel = true; if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [dto])

  // ── HISTORIAL: fechas de los dos meses ya pasadas (calco 786-805) ──
  const hoy = new Date()
  const lunesHoy = getLunes()
  const repPorFecha: Record<string, ReporteB> = {}
  dto.reportes.forEach((r) => { repPorFecha[r.semana_inicio] = r })
  const todasFechas = [...new Set([...lunesDelMes(dto.mesPrev), ...lunesDelMes(dto.mes)])]
    .filter((f) => new Date(f) <= hoy && !(f === lunesHoy && !repPorFecha[f]))
    .sort((a, b) => +new Date(b) - +new Date(a)) // más reciente primero

  return (
    <>
      {/* ══ TARJETA DE NODOS (renderNodosPanel) ══ */}
      {!dto.nodos.length ? (
        <div className="card" style={{ border: '1.5px dashed var(--teal)', background: 'white', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>🌱</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>Mis Nodos Activos</div>
              <div style={{ fontSize: 11, color: 'var(--g400)' }}>Aún no tienes nodos confirmados</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--g700)', lineHeight: 1.6 }}>
            Un contacto se convierte en <strong>nodo</strong> cuando vuelve a referirte prospectos por segunda vez. Es el indicador de profundización de tu red. Cuando ocurra, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="card" style={{ border: '2px solid var(--teal)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0, color: 'var(--teal)' }}>✦ Mis Nodos Activos — {dto.nodos.length} nodo{dto.nodos.length > 1 ? 's' : ''}</div>
            <span style={{ fontSize: 11, color: 'var(--g400)' }}>Semana: {semanaRef}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--g700)', marginBottom: 14, lineHeight: 1.5 }}>
            Un <strong>nodo</strong> es un contacto que ha vuelto a referirte prospectos.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
            {dto.nodos.map((n) => {
              const yaActivo = nodosConAct.has(n.id)
              const actEsta = actsEstaSemana.find((a) => a.nodo_id === n.id)
              return (
                <div key={n.id} style={{ background: yaActivo ? 'var(--teal-lt)' : 'white', borderRadius: 'var(--r)', padding: '12px 14px', border: `1.5px solid ${yaActivo ? 'var(--teal)' : 'rgba(15,110,86,.2)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{yaActivo ? '🌳' : '🌿'}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--g900)' }}>{n.nombre}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--teal)', marginBottom: 2 }}>✦ {n.activaciones} activaciones · {n.total_prospectos || 0} prosp. totales</div>
                  <div style={{ fontSize: 11, color: 'var(--g400)', marginBottom: 8 }}>Conversión: {n.fecha_conversion || '—'} · Vínculo: {n.vinculo || '—'}</div>
                  {yaActivo && (
                    <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 500 }}>✓ Activado esta semana · {actEsta?.prospectos || 0} prospectos</div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--g200)' }}>
            <p style={{ fontSize: 11, color: 'var(--g400)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>Evolución de nodos acumulados</p>
            <div style={{ position: 'relative', height: 120 }}><canvas ref={trendRef} aria-label="Evolución de nodos" /></div>
          </div>
        </div>
      )}

      {/* ══ HISTORIAL DE SEMANAS (renderReporteLista) ══ */}
      {!todasFechas.length && !dto.reportes.length ? (
        <div className="ib am"><strong>No tienes reportes registrados.</strong> Tu actividad semanal aparecerá aquí.</div>
      ) : (
        todasFechas.map((fecha) => {
          const r = repPorFecha[fecha]
          const esFantasma = !r
          const cs = r?.contactos || []
          const totC = cs.length, totR = cs.filter((c) => c.reunion).length, totP = cs.reduce((a, c) => a + c.prospectos, 0)
          const esEditable = fecha === lunesHoy && !esFantasma
          const num = semNum(fecha)

          if (esFantasma) {
            return (
              <div key={fecha} className="card" style={{ opacity: .65, borderLeft: '3px solid var(--red)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="card-title" style={{ marginBottom: 0, color: 'var(--red)' }}>Semana {num} — {fecha}</div>
                    <p style={{ fontSize: 12, color: 'var(--g400)', marginTop: 4 }}>Sin reporte — semana sin actividad registrada</p>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--red)', padding: '5px 10px', border: '0.5px solid var(--red)', borderRadius: 'var(--r)', opacity: .8 }}>⚠ Sin reporte</span>
                </div>
              </div>
            )
          }

          return (
            <div key={fecha} className="card" style={!esEditable ? { opacity: .85 } : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 0 }}>Semana {num} — {fecha}</div>
                  <p style={{ fontSize: 12, color: 'var(--g400)', marginTop: 4 }}>{totC} contactos · {totR} reuniones · {totP} prospectos</p>
                </div>
                {!esEditable && (
                  <span style={{ fontSize: 11, color: 'var(--g400)', padding: '5px 10px', border: '0.5px solid var(--g200)', borderRadius: 'var(--r)' }}>🔒 Semana cerrada</span>
                )}
              </div>
              {totC ? (
                <table className="dt">
                  <thead><tr><th>#</th><th>Nombre</th><th>Vínculo</th><th>Llamó</th><th>Reunión</th><th>Prospectos</th></tr></thead>
                  <tbody>
                    {cs.map((c, i) => (
                      <tr key={c.id}>
                        <td style={{ color: 'var(--g400)' }}>{i + 1}</td>
                        <td>{c.nombre}{(c.tipo_contacto === 'reactivacion' || c.tipo_contacto === 'activacion_nodo') && <span style={{ color: 'var(--teal)', fontSize: 10 }}> ✦</span>}</td>
                        <td><span className="pill pill-bl">{c.vinculo}</span></td>
                        <td>{c.llamo ? '✓' : '—'}</td>
                        <td>{c.reunion ? '✓' : '—'}</td>
                        <td><strong>{c.prospectos}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--g400)', padding: '8px 0' }}>Sin contactos registrados.</p>
              )}
            </div>
          )
        })
      )}
    </>
  )
}
