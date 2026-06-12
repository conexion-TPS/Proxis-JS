'use client'
import { useEffect, useRef, useState } from 'react'

/*
 * BitacoraSemanal — Bitácora del asesor en el /app. Calco de la bitácora A (/plataforma):
 *   • Tarjeta de nodos (read-only)            ← renderNodosPanel()
 *   • Historial de semanas + edición inline   ← renderReporteLista()/mostrarFormulario()
 * ESCRITURAS v1 (POST /api/app/bitacora): nueva_semana, guardar_contactos (delete-all+reinsert),
 * sin_actividad, confirmar. NODOS/HOMÓNIMOS: NO en v1 (la detección/modal y la conversión a
 * nodos quedan para v2 — el form guarda lo que el usuario escribió; tipo_contacto se preserva).
 * Lock = calco A: una semana es editable mientras NO esté confirmada; al confirmar → solo lectura.
 * Datos: /api/app/bitacora (proxis_dev por persona_id).
 */

const MESES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const VINCULOS = ['Amigo/a', 'Familiar', 'Cliente', 'Conocido/a']

type ContactoB = { id: string; reporte_id: string; nombre: string; vinculo: string | null; llamo: boolean; reunion: boolean; prospectos: number; tipo_contacto: string | null; created_at: string }
type ReporteB = { id: string; semana_inicio: string; semana_num: number; confirmado: boolean; sin_actividad: boolean; contactos: ContactoB[] }
type NodoB = { id: string; nombre: string; vinculo: string | null; activaciones: number; total_prospectos: number; fecha_primer_contacto: string | null; fecha_conversion: string | null; ultima_activacion: string | null }
type ActB = { id: string; nodo_id: string; semana_inicio: string; prospectos: number }
export type BitacoraDTO = { mes: string; mesPrev: string; reportes: ReporteB[]; nodos: NodoB[]; activaciones: ActB[] }

// Fila editable del formulario (calco de leerForm: nombre, vinculo, tipo_contacto, llamo, reunion, prospectos).
type Fila = { nombre: string; vinculo: string; tipo_contacto: string; llamo: boolean; reunion: boolean; prospectos: number }
const filaVacia = (): Fila => ({ nombre: '', vinculo: 'Conocido/a', tipo_contacto: 'nuevo', llamo: false, reunion: false, prospectos: 0 })

// CSS del formulario, portado verbatim del legacy A (/plataforma/page.tsx) — no existía en /app.
const FORM_CSS = `
.bw-form-table{width:100%;border-collapse:collapse}
.bw-form-table th{text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--g400);padding:8px 10px;border-bottom:1px solid var(--g200)}
.bw-form-table td{padding:8px;border-bottom:1px solid var(--g100);vertical-align:middle}
.bw-form-table input[type=text],.bw-form-table select{width:100%;padding:8px 10px;border:1px solid var(--g200);border-radius:8px;font-family:var(--font);font-size:13px;outline:none;background:white;transition:all .15s}
.bw-form-table input[type=text]:focus,.bw-form-table select:focus{border-color:var(--blue);box-shadow:var(--ring)}
.bw-form-table input[type=number]{width:72px;padding:8px 10px;border:1px solid var(--g200);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none;text-align:center;transition:all .15s;background:white;font-feature-settings:"tnum"}
.bw-form-table input[type=number]:focus{border-color:var(--blue);box-shadow:var(--ring)}
.bw-check-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--g200);background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all .15s;margin:auto;color:var(--g400)}
.bw-check-btn:hover{border-color:var(--g700);color:var(--g700)}
.bw-check-btn.on{background:var(--teal);border-color:var(--teal);color:white}
.bw-del-btn{width:28px;height:28px;border-radius:7px;border:1px solid rgba(176,58,58,0.22);background:var(--red-lt);color:var(--red);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;margin:auto;transition:all .15s}
.bw-del-btn:hover{background:var(--red);color:white;border-color:var(--red)}
.bw-btn{padding:10px 18px;border:none;border-radius:var(--r);font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;display:inline-flex;align-items:center;gap:7px}
.bw-btn:disabled{opacity:.5;cursor:not-allowed}
.bw-btn-primary{background:#0b0a09;color:white}
.bw-btn-primary:hover{background:#2a2926}
.bw-btn-secondary{background:white;color:var(--g700);border:1px solid var(--g200)}
.bw-btn-secondary:hover{border-color:var(--g700);color:var(--g900)}
.bw-btn-success{background:var(--teal);color:white;border:1px solid var(--teal)}
.bw-btn-success:hover{background:#175743}
.bw-msg{padding:10px 12px;border-radius:var(--r);font-size:12px;margin-top:10px;border:1px solid transparent}
.bw-msg.rd{background:var(--red-lt);color:var(--red);border-color:rgba(176,58,58,0.18)}
.bw-msg.gn{background:var(--teal-lt);color:var(--teal);border-color:rgba(31,111,86,0.18)}
`

// Helper de escritura (POST /api/app/bitacora con el token de sesión).
export async function postBitacora(token: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  try {
    const r = await fetch('/api/app/bitacora', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    return r.ok ? { ok: true, ...d } : { ok: false, error: d.error ?? `HTTP ${r.status}` }
  } catch { return { ok: false, error: 'No se pudo conectar' } }
}

// ── Helpers temporales (calco de plataforma-core.js) ──
const _SEM1 = new Date('2026-03-30')
const semNum = (f: string) => Math.round((+new Date(f) - +_SEM1) / (7 * 24 * 60 * 60 * 1000)) + 1
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

// ── Tarjeta de una semana EDITABLE (no confirmada) — calco de mostrarFormulario() ──
function SemanaEditable({ rep, num, token, onChanged }: { rep: ReporteB; num: number; token: string; onChanged: () => void | Promise<void> }) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    rep.contactos.length
      ? rep.contactos.map((c) => ({ nombre: c.nombre, vinculo: VINCULOS.includes(c.vinculo ?? '') ? (c.vinculo as string) : 'Conocido/a', tipo_contacto: c.tipo_contacto || 'nuevo', llamo: c.llamo, reunion: c.reunion, prospectos: c.prospectos }))
      : [filaVacia()]
  )
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false)

  const setFila = (i: number, patch: Partial<Fila>) => setFilas((p) => p.map((f, k) => (k === i ? { ...f, ...patch } : f)))
  const addFila = () => setFilas((p) => [...p, filaVacia()])
  const delFila = (i: number) => setFilas((p) => (p.length === 1 ? [filaVacia()] : p.filter((_, k) => k !== i)))

  async function guardar() {
    const conNombre = filas.filter((f) => f.nombre.trim())
    if (!conNombre.length) { setErr('Ingresa al menos un contacto con nombre.'); setOk(''); return }
    setErr(''); setOk(''); setBusy(true)
    const r = await postBitacora(token, { accion: 'guardar_contactos', reporte_id: rep.id, contactos: conNombre })
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? 'Error al guardar'); return }
    setOk('Reporte guardado.'); await onChanged()
  }
  async function marcarSinActividad(value: boolean) {
    setErr(''); setOk(''); setBusy(true)
    const r = await postBitacora(token, { accion: 'sin_actividad', reporte_id: rep.id, value })
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? 'Error'); return }
    await onChanged()
  }
  async function confirmar() {
    if (!window.confirm('¿Confirmar la semana? Quedará en solo lectura y no podrás editarla.')) return
    setErr(''); setOk(''); setBusy(true)
    const r = await postBitacora(token, { accion: 'confirmar', reporte_id: rep.id })
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? 'Error'); return }
    await onChanged()
  }

  const totC = rep.contactos.length, totR = rep.contactos.filter((c) => c.reunion).length, totP = rep.contactos.reduce((a, c) => a + c.prospectos, 0)

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 0 }}>Semana {num} — {rep.semana_inicio}</div>
          <p style={{ fontSize: 12, color: 'var(--g400)', marginTop: 4 }}>{totC} contactos · {totR} reuniones · {totP} prospectos · guardados</p>
        </div>
        <label style={{ fontSize: 12, color: 'var(--g600)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={rep.sin_actividad} disabled={busy} onChange={(e) => marcarSinActividad(e.target.checked)} />
          Sin actividad esta semana
        </label>
      </div>
      <div className="ib am" style={{ fontSize: 11, marginBottom: 12 }}><strong>Ingresa tus contactos de esta semana.</strong> Meta: al menos 5 prospectos por contacto.</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="bw-form-table">
          <thead><tr><th>#</th><th>Nombre del contacto</th><th>Vínculo</th><th>¿Llamó?</th><th>¿Reunión?</th><th>N° Prospectos</th><th></th></tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--g400)', fontFamily: 'var(--mono)', fontSize: 12 }}>{i + 1}</td>
                <td><input type="text" value={f.nombre} placeholder="Nombre completo" autoComplete="off" onChange={(e) => setFila(i, { nombre: e.target.value })} /></td>
                <td><select value={f.vinculo} onChange={(e) => setFila(i, { vinculo: e.target.value })}>{VINCULOS.map((v) => <option key={v} value={v}>{v}</option>)}</select></td>
                <td><button type="button" className={`bw-check-btn${f.llamo ? ' on' : ''}`} onClick={() => setFila(i, { llamo: !f.llamo })}>{f.llamo ? '✓' : '○'}</button></td>
                <td><button type="button" className={`bw-check-btn${f.reunion ? ' on' : ''}`} onClick={() => setFila(i, { reunion: !f.reunion })}>{f.reunion ? '✓' : '○'}</button></td>
                <td><input type="number" min={0} max={20} value={f.prospectos} onChange={(e) => setFila(i, { prospectos: parseInt(e.target.value) || 0 })} /></td>
                <td><button type="button" className="bw-del-btn" onClick={() => delFila(i)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="bw-btn bw-btn-secondary" onClick={addFila} disabled={busy}>+ Agregar contacto</button>
        <button className="bw-btn bw-btn-primary" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : '💾 Guardar reporte'}</button>
        <button className="bw-btn bw-btn-success" onClick={confirmar} disabled={busy} style={{ marginLeft: 'auto' }}>🔒 Confirmar semana</button>
      </div>
      {err && <div className="bw-msg rd">{err}</div>}
      {ok && <div className="bw-msg gn">{ok}</div>}
    </div>
  )
}

export default function BitacoraSemanal({ dto, token, onChanged }: { dto: BitacoraDTO; token: string; onChanged: () => void | Promise<void> }) {
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
      <style>{FORM_CSS}</style>
      {/* ══ TARJETA DE NODOS (renderNodosPanel) — read-only ══ */}
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

      {/* ══ HISTORIAL DE SEMANAS (renderReporteLista) — editable si NO confirmada (calco A) ══ */}
      {!todasFechas.length && !dto.reportes.length ? (
        <div className="ib am"><strong>No tienes reportes registrados.</strong> Usa <strong>+ Nueva semana</strong> para abrir la semana en curso.</div>
      ) : (
        todasFechas.map((fecha) => {
          const r = repPorFecha[fecha]
          const num = semNum(fecha)

          // ── Semana sin reporte (fantasma) — read-only ──
          if (!r) {
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

          // ── Semana NO confirmada → editable (calco A: editable mientras no se confirme) ──
          if (!r.confirmado) {
            return <SemanaEditable key={fecha} rep={r} num={num} token={token} onChanged={onChanged} />
          }

          // ── Semana confirmada → solo lectura ──
          const cs = r.contactos || []
          const totC = cs.length, totR = cs.filter((c) => c.reunion).length, totP = cs.reduce((a, c) => a + c.prospectos, 0)
          return (
            <div key={fecha} className="card" style={{ opacity: .9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 0 }}>Semana {num} — {fecha}</div>
                  <p style={{ fontSize: 12, color: 'var(--g400)', marginTop: 4 }}>{totC} contactos · {totR} reuniones · {totP} prospectos</p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--teal)', padding: '5px 10px', border: '0.5px solid var(--teal)', borderRadius: 'var(--r)' }}>🔒 Confirmada</span>
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
                <p style={{ fontSize: 13, color: 'var(--g400)', padding: '8px 0' }}>Semana confirmada sin contactos {r.sin_actividad ? '(marcada sin actividad).' : '.'}</p>
              )}
            </div>
          )
        })
      )}
    </>
  )
}
