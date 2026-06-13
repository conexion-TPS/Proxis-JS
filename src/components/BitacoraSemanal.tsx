'use client'
import { useEffect, useRef, useState } from 'react'

/*
 * BitacoraSemanal — Bitácora del asesor en el /app. Calco de la bitácora A (/plataforma):
 *   • Tarjeta de nodos (read-only)            ← renderNodosPanel()
 *   • Historial de semanas + edición inline   ← renderReporteLista()/mostrarFormulario()
 * ESCRITURAS (POST /api/app/bitacora): nueva_semana, guardar_contactos (delete-all+reinsert),
 * sin_actividad. NODOS/HOMÓNIMOS: detección/modal + conversión server-side (RPC guardar_contactos_v2).
 * LOCK POR FECHA (divergencia deliberada, NO calco): editable ⇔ la semana es la EN CURSO
 * (semana_inicio === dto.semana_actual, que viene del servidor); las anteriores quedan en solo
 * lectura, ignorando 'confirmado'. No hay acción "Confirmar". El sellado es automático al cambiar
 * de semana (cambia dto.semana_actual). Datos: /api/app/bitacora (proxis_dev por persona_id).
 */

const MESES_NOM = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const VINCULOS = ['Amigo/a', 'Familiar', 'Cliente', 'Conocido/a']

type ContactoB = { id: string; reporte_id: string; nombre: string; vinculo: string | null; llamo: boolean; reunion: boolean; prospectos: number; tipo_contacto: string | null; created_at: string }
type ReporteB = { id: string; semana_inicio: string; semana_num: number; confirmado: boolean; sin_actividad: boolean; contactos: ContactoB[] }
type NodoB = { id: string; nombre: string; vinculo: string | null; activaciones: number; total_prospectos: number; fecha_primer_contacto: string | null; fecha_conversion: string | null; ultima_activacion: string | null }
type ActB = { id: string; nodo_id: string; semana_inicio: string; prospectos: number }
export type BitacoraDTO = { mes: string; mesPrev: string; semana_actual: string; reportes: ReporteB[]; nodos: NodoB[]; activaciones: ActB[] }

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
.bw-modal-ov{position:fixed;inset:0;background:rgba(11,10,9,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.bw-modal{background:white;border-radius:14px;max-width:440px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.bw-modal h3{font-size:15px;font-weight:700;color:var(--g900);margin-bottom:10px;line-height:1.4}
.bw-modal p{font-size:13px;color:var(--g700);line-height:1.5;margin-bottom:8px}
.bw-modal-acts{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.bw-name-wrap{position:relative}
.bw-sug{position:absolute;top:100%;left:0;right:0;background:white;border:1px solid var(--g200);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:50;max-height:180px;overflow-y:auto;margin-top:2px}
.bw-sug-item{padding:8px 10px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--g100);color:var(--g700)}
.bw-sug-item:last-child{border-bottom:none}
.bw-sug-item:hover{background:var(--g100);color:var(--g900)}
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
function lunesDelMes(mesISO: string): string[] {
  const [yy, mm] = mesISO.split('-').map(Number)
  const dow = new Date(yy, mm - 1, 1).getDay()
  const back = dow === 0 ? 6 : dow - 1
  const lunes: string[] = []
  let d = new Date(yy, mm - 1, 1 - back)
  while (d < new Date(yy, mm, 1)) { lunes.push(fmtLocal(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) }
  return lunes
}

// ── Similitud de nombres — calco EXACTO de plataforma-core.js §1 (portado casi literal).
//    Mismos resultados que el JS legacy (la RPC server replica estos helpers en SQL). ──
const SIMILITUD_THRESHOLD = 0.70
function normNombre(s: string): string {
  if (!s) return ''
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim().replace(/\s+/g, ' ')
}
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}
function similitud(a: string, b: string): number {
  a = normNombre(a); b = normNombre(b)
  if (!a || !b) return 0
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const fullSim = (maxLen - levenshtein(a, b)) / maxLen
  const aParts = a.split(' '), bParts = b.split(' ')
  const fnSim = aParts[0] && bParts[0]
    ? (Math.max(aParts[0].length, bParts[0].length) - levenshtein(aParts[0], bParts[0])) / Math.max(aParts[0].length, bParts[0].length)
    : 0
  return fnSim > 0.8 ? Math.max(fullSim, fullSim * 0.7 + fnSim * 0.3) : fullSim
}
function esSimilar(a: string, b: string): boolean { return similitud(a, b) >= SIMILITUD_THRESHOLD }
// esMismoExacto disponible por paridad con el legacy (la conversión real la decide la RPC):
// function esMismoExacto(a: string, b: string): boolean { return normNombre(a) === normNombre(b) }

// Dedup intra-form — calco EXACTO §2c (esSimilar OR startsWith OR includes; conserva la
// primera aparición, descarta el resto en silencio).
function dedupForm<T extends { nombre: string }>(items: T[]): T[] {
  const seen: string[] = []
  const out: T[] = []
  for (const it of items) {
    if (!it.nombre.trim()) continue
    const nNorm = normNombre(it.nombre)
    const dupe = seen.some((s) => {
      const sNorm = normNombre(s)
      return esSimilar(s, it.nombre) || nNorm.startsWith(sNorm) || sNorm.startsWith(nNorm) || nNorm.includes(sNorm) || sNorm.includes(nNorm)
    })
    if (!dupe) { seen.push(it.nombre); out.push(it) }
  }
  return out
}

// ── Tarjeta de una semana EDITABLE (no confirmada) — calco de mostrarFormulario() ──
function SemanaEditable({ rep, num, token, onChanged, nodos, todosContactos }: { rep: ReporteB; num: number; token: string; onChanged: () => void | Promise<void>; nodos: NodoB[]; todosContactos: ContactoB[] }) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    rep.contactos.length
      ? rep.contactos.map((c) => ({ nombre: c.nombre, vinculo: VINCULOS.includes(c.vinculo ?? '') ? (c.vinculo as string) : 'Conocido/a', tipo_contacto: c.tipo_contacto || 'nuevo', llamo: c.llamo, reunion: c.reunion, prospectos: c.prospectos }))
      : [filaVacia()]
  )
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false)
  // ── Estado de la capa de homónimos / nodos (v2b) ──
  const [homModal, setHomModal] = useState<{ nombre: string; prev: ContactoB } | null>(null)
  const homResolver = useRef<((d: 'mismo' | 'distinto', id?: string) => void) | null>(null)
  const [celeb, setCeleb] = useState<{ nombre: string; numNodo: number } | null>(null)
  const [sugFor, setSugFor] = useState<number | null>(null)

  // Historial de OTRAS semanas (para §2a-ii). La RPC re-deriva contra el historial completo;
  // aquí el modal usa lo cargado por el GET (mes actual + previo) → UX, no fuente de verdad.
  const historialOtras = todosContactos.filter((c) => c.reporte_id !== rep.id)

  const setFila = (i: number, patch: Partial<Fila>) => setFilas((p) => p.map((f, k) => (k === i ? { ...f, ...patch } : f)))
  const addFila = () => setFilas((p) => [...p, filaVacia()])
  const delFila = (i: number) => setFilas((p) => (p.length === 1 ? [filaVacia()] : p.filter((_, k) => k !== i)))

  // Promesa que resuelve cuando el usuario decide en el modal de homónimo (calco del await del legacy).
  const pedirDecision = (nombre: string, prev: ContactoB) =>
    new Promise<{ decision: 'mismo' | 'distinto'; idNombre?: string }>((resolve) => {
      setHomModal({ nombre, prev })
      homResolver.current = (decision, idNombre) => { setHomModal(null); resolve({ decision, idNombre }) }
    })

  // Autocomplete — calco getContactSuggestions (datos frescos del GET; dedup por nombre normalizado).
  function sugerencias(query: string): string[] {
    if (!query || query.trim().length < 2) return []
    const cand = todosContactos
      .filter((c) => { const cn = normNombre(c.nombre), qn = normNombre(query); return cn.includes(qn) || qn.includes(cn) || esSimilar(c.nombre, query) })
      .sort((a, b) => similitud(b.nombre, query) - similitud(a.nombre, query))
    const seen = new Set<string>(); const out: string[] = []
    for (const c of cand) { const cn = normNombre(c.nombre); if (!seen.has(cn)) { seen.add(cn); out.push(c.nombre) } if (out.length >= 6) break }
    return out
  }

  async function guardar() {
    const conNombre = filas.map((f, i) => ({ ...f, _idx: i })).filter((x) => x.nombre.trim())
    if (!conNombre.length) { setErr('Ingresa al menos un contacto con nombre.'); setOk(''); return }
    setErr(''); setOk(''); setSugFor(null); setBusy(true)

    // ── §2a — detección de homónimos (en orden, calco del loop de guardarBorrador) ──
    for (const it of conNombre) {
      if (it.tipo_contacto === 'reactivacion' || it.tipo_contacto === 'activacion_nodo') continue
      // (i) ya es nodo confirmado → reactivación, SIN modal
      if (nodos.some((n) => esSimilar(n.nombre, it.nombre))) { it.tipo_contacto = 'reactivacion'; continue }
      // (ii) aparece en otra semana → modal "¿es la misma persona?"
      const prev = historialOtras.find((c) => c.nombre && esSimilar(c.nombre, it.nombre))
      if (prev) {
        const { decision, idNombre } = await pedirDecision(it.nombre, prev)
        if (decision === 'mismo') {
          it.nombre = prev.nombre              // adopta el nombre canónico
          it.tipo_contacto = 'reactivacion'
        } else if (idNombre && idNombre.trim()) {
          it.nombre = idNombre.trim()          // B3: el identificador SÍ se aplica a la fila
          setFila(it._idx, { nombre: idNombre.trim() })
          // tipo queda 'nuevo'
        }
      }
    }

    // ── §2c — dedup intra-form (conserva la primera, descarta el resto) ──
    const finales = dedupForm(conNombre).map(({ _idx, ...c }) => c)

    const r = await postBitacora(token, { accion: 'guardar_contactos', reporte_id: rep.id, contactos: finales })
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? 'Error al guardar'); return }
    setOk('Reporte guardado.')
    // ── §3c — celebración: solo el PRIMER nodo nuevo (quirk de celebración única, calcado) ──
    const nuevos = r.nodos_nuevos as { nombre: string; numNodo: number }[] | undefined
    if (nuevos && nuevos.length) setCeleb(nuevos[0])
    await onChanged()
  }
  async function marcarSinActividad(value: boolean) {
    setErr(''); setOk(''); setBusy(true)
    const r = await postBitacora(token, { accion: 'sin_actividad', reporte_id: rep.id, value })
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
                <td>
                  <div className="bw-name-wrap">
                    <input type="text" value={f.nombre} placeholder="Nombre completo" autoComplete="off"
                      onChange={(e) => { setFila(i, { nombre: e.target.value }); setSugFor(i) }}
                      onFocus={() => setSugFor(i)}
                      onBlur={() => setTimeout(() => setSugFor((s) => (s === i ? null : s)), 150)} />
                    {sugFor === i && (() => {
                      const sg = sugerencias(f.nombre)
                      return sg.length ? (
                        <div className="bw-sug">
                          {sg.map((s) => (
                            <div key={s} className="bw-sug-item" onMouseDown={(e) => { e.preventDefault(); setFila(i, { nombre: s }); setSugFor(null) }}>{s}</div>
                          ))}
                        </div>
                      ) : null
                    })()}
                  </div>
                </td>
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
      </div>
      {err && <div className="bw-msg rd">{err}</div>}
      {ok && <div className="bw-msg gn">{ok}</div>}

      {/* ══ Modal de homónimo (calco §2b: "¿es la misma persona?") ══ */}
      {homModal && (
        <div className="bw-modal-ov">
          <div className="bw-modal">
            <h3>«{homModal.nombre}» es similar a un contacto anterior ({Math.round(similitud(homModal.nombre, homModal.prev.nombre) * 100)}% coincidencia)</h3>
            <p>Contacto anterior encontrado: <strong>{homModal.prev.nombre}</strong> · {homModal.prev.vinculo || '—'} · {homModal.prev.prospectos || 0} prospectos previos</p>
            <p style={{ color: 'var(--g400)', fontSize: 12 }}>¿Es la misma persona?</p>
            <div className="bw-modal-acts">
              <button className="bw-btn bw-btn-success" onClick={() => homResolver.current?.('mismo')}>Sí, es la misma</button>
              <button className="bw-btn bw-btn-secondary" onClick={() => {
                const id = window.prompt(`Agrega un identificador para distinguirlo:\n(ej. "${homModal.nombre} (amigo de Carlos)")`)
                homResolver.current?.('distinto', id || undefined)
              }}>No, es otra persona</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal de celebración de nodo (calco §3c: solo el primero) ══ */}
      {celeb && (
        <div className="bw-modal-ov" onClick={() => setCeleb(null)}>
          <div className="bw-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>🌳</div>
            <h3 style={{ color: 'var(--teal)' }}>¡{celeb.nombre} es tu Nodo {celeb.numNodo}!</h3>
            <p>{celeb.nombre} ha vuelto a referirte prospectos. Has profundizado esta relación y ahora tienes un nodo activo más en tu red. ¡Sigue cultivando esta confianza!</p>
            <div className="bw-modal-acts" style={{ justifyContent: 'center' }}>
              <button className="bw-btn bw-btn-success" onClick={() => setCeleb(null)}>¡Genial!</button>
            </div>
          </div>
        </div>
      )}
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
    : dto.semana_actual
  const actsEstaSemana = dto.activaciones.filter((a) => a.semana_inicio === semanaRef)
  const nodosConAct = new Set(actsEstaSemana.map((a) => a.nodo_id))

  // Todos los contactos cargados (mes actual + previo) — base de la detección de homónimos
  // y del autocomplete en cada semana editable. NO se crea cliente Supabase nuevo (calco vía GET).
  const todosContactos = dto.reportes.flatMap((r) => r.contactos)

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
  const lunesHoy = dto.semana_actual // fuente única = servidor (DTO), no el reloj del navegador
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

          // ── Semana EN CURSO → editable (lock por fecha: solo la semana actual; ignora 'confirmado') ──
          if (fecha === dto.semana_actual) {
            return <SemanaEditable key={fecha} rep={r} num={num} token={token} onChanged={onChanged} nodos={dto.nodos} todosContactos={todosContactos} />
          }

          // ── Semana anterior → solo lectura ──
          const cs = r.contactos || []
          const totC = cs.length, totR = cs.filter((c) => c.reunion).length, totP = cs.reduce((a, c) => a + c.prospectos, 0)
          return (
            <div key={fecha} className="card" style={{ opacity: .9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 0 }}>Semana {num} — {fecha}</div>
                  <p style={{ fontSize: 12, color: 'var(--g400)', marginTop: 4 }}>{totC} contactos · {totR} reuniones · {totP} prospectos</p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--g400)', padding: '5px 10px', border: '0.5px solid var(--g200)', borderRadius: 'var(--r)' }}>🔒 Semana cerrada</span>
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
