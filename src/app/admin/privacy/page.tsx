'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

/* Dashboard de Administración de Privacidad (Ley 21.719) — spec doc 7, Parte 3.
   Cinco módulos en pestañas: A ARCOP+, B Anonimizaciones, C Informes, D Consentimientos, E Brechas.
   NOTA de seguridad: gate por la auth admin existente (clave compartida). El RBAC real
   ADMIN/PRIVACY_OFFICER + middleware queda como deuda atada al pendiente de seguridad #3. */

const TABS = [
  { id: 'A', label: 'Solicitudes ARCOP+' },
  { id: 'B', label: 'Anonimizaciones' },
  { id: 'C', label: 'Informes APDP' },
  { id: 'D', label: 'Consentimientos' },
  { id: 'E', label: 'Brechas' },
] as const

const SEM = { verde: '#1f6f56', amarillo: '#b8860b', rojo: '#b4493d', gris: '#8a8885', cerrada: '#8a8885' }

export default function PrivacyDashboard() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('A')
  return (
    <div style={{ padding: '32px 36px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/admin/dashboard" style={{ fontSize: 12, color: '#8a8885', textDecoration: 'none' }}>← Panel admin</Link>
        <span style={{ color: '#c8c6c3' }}>/</span>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Privacidad y Cumplimiento</h1>
      </div>
      <p style={{ fontSize: 13, color: '#8a8885', margin: '0 0 22px' }}>
        Gestión conforme a la Ley N° 21.719. Plazo legal de respuesta ARCOP+: <strong>30 días hábiles</strong>. Notificación de brechas a la APDP: <strong>72 horas</strong>.
      </p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e8e6e3', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            color: tab === t.id ? '#0b0a09' : '#8a8885',
            borderBottom: tab === t.id ? '2px solid #0b0a09' : '2px solid transparent', marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'A' && <ModuloArcop />}
      {tab === 'B' && <ModuloAnonim />}
      {tab === 'C' && <ModuloInformes />}
      {tab === 'D' && <ModuloConsentimientos />}
      {tab === 'E' && <ModuloBrechas />}
    </div>
  )
}

// ─────────────────────────────── MÓDULO A — ARCOP+ ───────────────────────────────

const DERECHOS = ['acceso', 'rectificacion', 'cancelacion', 'oposicion', 'portabilidad', 'bloqueo', 'revision_humana']
const DERECHO_LABEL: Record<string, string> = {
  acceso: 'Acceso', rectificacion: 'Rectificación', cancelacion: 'Cancelación/Supresión',
  oposicion: 'Oposición', portabilidad: 'Portabilidad', bloqueo: 'Bloqueo', revision_humana: 'Revisión humana',
}

type Solicitud = {
  id: string; derecho: string | null; tipo: string; estado: string; email: string; nombre_completo: string | null
  created_at: string; fecha_limite: string | null; dias_habiles_restantes: number | null; semaforo: keyof typeof SEM
  responsable: string | null; respuesta: string | null; prorroga_motivo: string | null; canal: string | null
}

function ModuloArcop() {
  const [data, setData] = useState<{ solicitudes: Solicitud[]; kpis: Record<string, number> } | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [toast, setToast] = useState('')
  const load = useCallback(async () => {
    const r = await fetch('/api/admin/privacy/arcop-requests').then(r => r.json())
    setData(r)
  }, [])
  useEffect(() => { load() }, [load])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2500) }

  async function prorrogar(s: Solicitud) {
    const motivo = prompt('Motivo de la prórroga (obligatorio):')
    if (!motivo) return
    await fetch('/api/admin/privacy/arcop-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, accion: 'prorrogar', prorroga_motivo: motivo }) })
    flash('Prórroga registrada'); load()
  }
  async function resolver(s: Solicitud, rechazar = false) {
    const respuesta = prompt(rechazar ? 'Motivo del rechazo:' : 'Describe la acción tomada para resolver:')
    if (respuesta === null) return
    await fetch('/api/admin/privacy/arcop-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, accion: 'resolver', estado: rechazar ? 'rechazado' : 'completado', respuesta }) })
    flash('Solicitud cerrada'); load()
  }

  if (!data) return <Loading />
  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Kpi label="Abiertas" value={data.kpis.abiertas} />
        <Kpi label="Por vencer (<8 días)" value={data.kpis.por_vencer} tone={data.kpis.por_vencer > 0 ? 'rojo' : undefined} />
        <Kpi label="Vencidas" value={data.kpis.vencidas} tone={data.kpis.vencidas > 0 ? 'rojo' : undefined} />
        <Kpi label="Total histórico" value={data.kpis.total} />
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowNew(true)} style={btnPrimary}>+ Registrar solicitud</button>
      </div>

      <Guide text="Cada solicitud ARCOP+ debe responderse dentro de 30 días hábiles desde su recepción. El semáforo indica urgencia: verde >15 días, amarillo 8–15, rojo <8. El incumplimiento del plazo es sancionable por la APDP. Usa Prórroga (con motivo) solo antes del vencimiento." />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
        <thead><tr>{['Titular', 'Derecho', 'Recepción', 'Fecha límite', 'Días háb.', 'Estado', 'Acciones'].map(h => (
          <th key={h} style={th}>{h}</th>))}</tr></thead>
        <tbody>
          {data.solicitudes.length === 0 && <tr><td colSpan={7} style={{ padding: 20, color: '#8a8885' }}>Sin solicitudes registradas.</td></tr>}
          {data.solicitudes.map(s => (
            <tr key={s.id} style={{ borderTop: '1px solid #f0ede8' }}>
              <td style={td}><div style={{ fontWeight: 600 }}>{s.nombre_completo ?? '—'}</div><div style={{ color: '#8a8885', fontSize: 11 }}>{s.email}</div></td>
              <td style={td}>{DERECHO_LABEL[s.derecho ?? ''] ?? s.tipo}</td>
              <td style={td}>{new Date(s.created_at).toLocaleDateString('es-CL')}</td>
              <td style={td}>{s.fecha_limite ? new Date(s.fecha_limite + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</td>
              <td style={td}>
                {s.dias_habiles_restantes === null ? '—' : (
                  <span style={{ fontWeight: 700, color: SEM[s.semaforo] }}>
                    {s.dias_habiles_restantes < 0 ? `Vencida (${Math.abs(s.dias_habiles_restantes)})` : s.dias_habiles_restantes}
                  </span>
                )}
              </td>
              <td style={td}><EstadoChip estado={s.estado} /></td>
              <td style={td}>
                {!['completado', 'rechazado'].includes(s.estado) && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => resolver(s)} style={btnMini}>Resolver</button>
                    <button onClick={() => prorrogar(s)} style={btnMiniOutline}>Prórroga</button>
                    <button onClick={() => resolver(s, true)} style={btnMiniOutline}>Rechazar</button>
                  </div>
                )}
                {s.respuesta && <div style={{ fontSize: 11, color: '#8a8885', marginTop: 4 }}>{s.respuesta}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showNew && <NewArcop onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); flash('Solicitud registrada') }} />}
      {toast && <Toast msg={toast} />}
    </>
  )
}

function NewArcop({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ derecho: 'acceso', nombre_completo: '', email: '', responsable: '' })
  const [err, setErr] = useState('')
  async function guardar() {
    if (!f.nombre_completo || !f.email) { setErr('Nombre y email son requeridos'); return }
    const r = await fetch('/api/admin/privacy/arcop-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    if (!r.ok) { setErr('Error al registrar'); return }
    onSaved()
  }
  return (
    <Modal onClose={onClose} title="Registrar solicitud ARCOP+">
      <Field label="Derecho ejercido">
        <select value={f.derecho} onChange={e => setF({ ...f, derecho: e.target.value })} style={input}>
          {DERECHOS.map(d => <option key={d} value={d}>{DERECHO_LABEL[d]}</option>)}
        </select>
      </Field>
      <Field label="Nombre completo del titular"><input value={f.nombre_completo} onChange={e => setF({ ...f, nombre_completo: e.target.value })} style={input} /></Field>
      <Field label="Email"><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={input} /></Field>
      <Field label="Responsable asignado (opcional)"><input value={f.responsable} onChange={e => setF({ ...f, responsable: e.target.value })} style={input} /></Field>
      {err && <div style={{ color: '#b4493d', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={guardar} style={btnPrimary}>Registrar (plazo: 30 días hábiles)</button>
        <button onClick={onClose} style={btnOutline}>Cancelar</button>
      </div>
    </Modal>
  )
}

// ─────────────────────────────── MÓDULO B — Anonimizaciones ───────────────────────

type Evento = { id: string; event_hash: string; event_timestamp: string; action_type: string; tables_affected: string[] | null; records_processed: number | null; process_status: string; verification_checksum: string | null }

function ModuloAnonim() {
  const [data, setData] = useState<{ eventos: Evento[]; kpis: Record<string, number> } | null>(null)
  const [sel, setSel] = useState<Evento | null>(null)
  useEffect(() => { fetch('/api/admin/privacy/anonymization-log').then(r => r.json()).then(setData) }, [])
  if (!data) return <Loading />
  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Kpi label="Cuentas activas" value={data.kpis.cuentas_activas} />
        <Kpi label="Eliminaciones (mes)" value={data.kpis.eliminaciones_mes} />
        <Kpi label="Anonimizaciones OK" value={data.kpis.anonimizaciones_ok} tone="verde" />
        <Kpi label="Fallidas / pendientes" value={data.kpis.anonimizaciones_fallidas} tone={data.kpis.anonimizaciones_fallidas > 0 ? 'rojo' : undefined} />
      </div>
      <Guide text="Anonimización real ≠ seudonimización. El log de auditoría es inmutable y NO contiene datos personales: solo el hash del evento, fecha UTC, tablas afectadas y estado. Si un proceso falla, los datos siguen siendo personales y sujetos a la ley — atiende los fallos de inmediato." />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
        <thead><tr>{['Evento (hash)', 'Fecha UTC', 'Tablas', 'Estado', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {data.eventos.length === 0 && <tr><td colSpan={5} style={{ padding: 20, color: '#8a8885' }}>Sin eventos de anonimización.</td></tr>}
          {data.eventos.map(e => (
            <tr key={e.id} style={{ borderTop: '1px solid #f0ede8' }}>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{e.event_hash.slice(0, 24)}…</td>
              <td style={td}>{new Date(e.event_timestamp).toISOString().replace('T', ' ').slice(0, 19)}</td>
              <td style={td}>{(e.tables_affected ?? []).length}</td>
              <td style={td}><EstadoChip estado={e.process_status} /></td>
              <td style={td}><button onClick={() => setSel(e)} style={btnMiniOutline}>Detalle</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {sel && (
        <Modal onClose={() => setSel(null)} title="Detalle del evento de auditoría">
          <Kv k="Event hash" v={sel.event_hash} mono />
          <Kv k="Timestamp (UTC)" v={new Date(sel.event_timestamp).toISOString()} />
          <Kv k="Acción" v={sel.action_type} />
          <Kv k="Tablas afectadas" v={(sel.tables_affected ?? []).join(', ')} />
          <Kv k="Registros procesados" v={String(sel.records_processed ?? '—')} />
          <Kv k="Estado" v={sel.process_status} />
          <Kv k="Checksum verificación" v={sel.verification_checksum ?? '—'} mono />
          <button onClick={() => downloadJSON(`evento_${sel.event_hash.slice(0, 12)}.json`, sel)} style={btnOutline}>Exportar registro (JSON)</button>
        </Modal>
      )}
    </>
  )
}

// ─────────────────────────────── MÓDULO C — Informes APDP ─────────────────────────

const REPORTES = [
  { id: 'arcop', label: 'Cumplimiento ARCOP+' },
  { id: 'anonimizaciones', label: 'Anonimizaciones' },
  { id: 'consentimientos', label: 'Registro de consentimientos' },
  { id: 'brechas', label: 'Brechas de seguridad' },
  { id: 'subencargados', label: 'Registro de subencargados' },
]

function ModuloInformes() {
  const [tipo, setTipo] = useState('arcop')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [rep, setRep] = useState<{ checklist: string[]; registros: Record<string, unknown>[]; total: number; responsable: { nombre: string; rut: string }; generado_at: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function generar() {
    setLoading(true)
    const qs = new URLSearchParams({ tipo, ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) })
    const r = await fetch(`/api/admin/privacy/reports?${qs}`).then(r => r.json())
    setRep(r); setLoading(false)
  }

  async function auditReport() {
    const key = (typeof window !== 'undefined' && localStorage.getItem('proxis_admin')) || ''
    const qs = new URLSearchParams({ format: 'pdf', ...(desde ? { date_from: desde } : {}), ...(hasta ? { date_to: hasta } : {}) })
    const r = await fetch(`/api/admin/privacy/audit-report?${qs}`, { headers: { 'x-admin-key': key } })
    if (!r.ok) { alert('Acceso restringido (ADMIN / PRIVACY_OFFICER).'); return }
    const html = await r.text()
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <Field label="Tipo de informe"><select value={tipo} onChange={e => setTipo(e.target.value)} style={input}>{REPORTES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
        <Field label="Desde"><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={input} /></Field>
        <Field label="Hasta"><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={input} /></Field>
        <button onClick={generar} style={btnPrimary}>Generar informe</button>
        <button onClick={auditReport} style={btnOutline}>Informe de auditoría (log legal)</button>
      </div>
      <Guide text="La APDP puede solicitar estos antecedentes ante una supervisión, auditoría o denuncia. Verifica el checklist de contenido mínimo antes de entregar. NO incluyas datos personales de terceros no involucrados. Para PDF usa 'Imprimir' del navegador (Guardar como PDF)." />

      {loading && <Loading />}
      {rep && (
        <div style={{ marginTop: 18 }}>
          <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{REPORTES.find(r => r.id === tipo)?.label} · {rep.total} registros</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => downloadJSON(`informe_${tipo}.json`, rep)} style={btnMiniOutline}>JSON</button>
                <button onClick={() => window.print()} style={btnMini}>Imprimir / PDF</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#8a8885', marginBottom: 14 }}>
              {rep.responsable.nombre} · RUT {rep.responsable.rut} · Generado {new Date(rep.generado_at).toLocaleString('es-CL')}
            </div>
            <div style={{ background: '#f5f3ef', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#8a8885', marginBottom: 6 }}>Checklist de contenido mínimo</div>
              {rep.checklist.map(c => <div key={c} style={{ fontSize: 12, color: '#2b2926' }}>✓ {c}</div>)}
            </div>
            {rep.total === 0 ? <div style={{ color: '#8a8885', fontSize: 13 }}>Sin registros en el rango seleccionado.</div> : <JsonTable rows={rep.registros} />}
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────── MÓDULO D — Consentimientos ───────────────────────

function ModuloConsentimientos() {
  const [data, setData] = useState<{ usuarios: { asesor: string | null; email: string | null; A: string; B: string; ultimo: string }[]; historial: Record<string, unknown>[]; total_eventos: number } | null>(null)
  useEffect(() => { fetch('/api/admin/privacy/consents').then(r => r.json()).then(setData) }, [])
  if (!data) return <Loading />
  return (
    <>
      <Guide text="Registro de la validez del consentimiento de uso secundario (Opción A: mejora de modelos / Opción B: analítica agregada). Cada cambio queda con fecha, hora UTC, versión del texto y canal — prueba ante la APDP. El consentimiento es separable y revocable." />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => downloadJSON('consentimientos.json', data.historial)} style={btnMiniOutline}>Exportar historial ({data.total_eventos})</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{['Titular', 'Opción A (Mejora)', 'Opción B (Analítica)', 'Último cambio'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {data.usuarios.length === 0 && <tr><td colSpan={4} style={{ padding: 20, color: '#8a8885' }}>Sin consentimientos registrados aún.</td></tr>}
          {data.usuarios.map((u, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f0ede8' }}>
              <td style={td}>{u.asesor ?? u.email ?? '—'}</td>
              <td style={td}><ConsentChip estado={u.A} /></td>
              <td style={td}><ConsentChip estado={u.B} /></td>
              <td style={td}>{new Date(u.ultimo).toLocaleString('es-CL')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ─────────────────────────────── MÓDULO E — Brechas ───────────────────────────────

type Brecha = { id: string; deteccion_at: string; descripcion: string; categorias_datos: string[] | null; n_afectados: number | null; estado: string; consecuencias: string | null; medidas: string | null; horas_restantes_apdp: number | null; notificado_apdp_at: string | null }
const ESTADOS_BRECHA = ['detectado', 'investigacion', 'notificado_apdp', 'notificado_titulares', 'cerrado']

function ModuloBrechas() {
  const [brechas, setBrechas] = useState<Brecha[]>([])
  const [showNew, setShowNew] = useState(false)
  const load = useCallback(async () => { const r = await fetch('/api/admin/privacy/breaches').then(r => r.json()); setBrechas(r.brechas ?? []) }, [])
  useEffect(() => { load() }, [load])

  async function cambiarEstado(b: Brecha, estado: string) {
    await fetch('/api/admin/privacy/breaches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, estado }) })
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Guide text="Toda violación de seguridad con riesgo para los titulares debe notificarse a la APDP dentro de 72 horas desde su detección. El contador corre desde el momento de detección registrado." />
        <button onClick={() => setShowNew(true)} style={{ ...btnPrimary, flexShrink: 0, marginLeft: 12 }}>+ Registrar incidente</button>
      </div>
      {brechas.length === 0 && <div style={{ color: '#8a8885', fontSize: 13, marginTop: 16 }}>Sin incidentes registrados.</div>}
      {brechas.map(b => {
        const urgente = b.horas_restantes_apdp !== null && b.horas_restantes_apdp < 24
        return (
          <div key={b.id} style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: 18, marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#8a8885' }}>Detectado: {new Date(b.deteccion_at).toLocaleString('es-CL')}</div>
                <div style={{ fontSize: 14, fontWeight: 600, margin: '4px 0' }}>{b.descripcion}</div>
                <div style={{ fontSize: 12, color: '#4a4844' }}>
                  {(b.categorias_datos ?? []).join(', ') || 'Categorías no especificadas'} · {b.n_afectados ?? '?'} titulares
                </div>
              </div>
              {b.horas_restantes_apdp !== null && (
                <div style={{ textAlign: 'center', padding: '8px 14px', borderRadius: 10, background: urgente ? '#fbe9e7' : '#f5f3ef', minWidth: 130 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#8a8885', letterSpacing: '0.05em' }}>Plazo APDP</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: urgente ? '#b4493d' : '#0b0a09' }}>
                    {b.horas_restantes_apdp < 0 ? 'VENCIDO' : `${b.horas_restantes_apdp}h`}
                  </div>
                  <div style={{ fontSize: 10, color: '#8a8885' }}>de 72h</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <EstadoChip estado={b.estado} />
              <span style={{ color: '#c8c6c3' }}>→</span>
              {ESTADOS_BRECHA.filter(e => e !== b.estado).map(e => (
                <button key={e} onClick={() => cambiarEstado(b, e)} style={btnMiniOutline}>{estadoLabel(e)}</button>
              ))}
            </div>
          </div>
        )
      })}
      {showNew && <NewBrecha onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
    </>
  )
}

function NewBrecha({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const ahora = new Date(); ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset())
  const [f, setF] = useState({ deteccion_at: ahora.toISOString().slice(0, 16), descripcion: '', categorias: '', n_afectados: '', consecuencias: '', medidas: '' })
  const [err, setErr] = useState('')
  async function guardar() {
    if (!f.descripcion) { setErr('Describe el incidente'); return }
    const r = await fetch('/api/admin/privacy/breaches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deteccion_at: new Date(f.deteccion_at).toISOString(), descripcion: f.descripcion,
        categorias_datos: f.categorias ? f.categorias.split(',').map(s => s.trim()) : null,
        n_afectados: f.n_afectados ? Number(f.n_afectados) : null, consecuencias: f.consecuencias, medidas: f.medidas,
      }),
    })
    if (!r.ok) { setErr('Error al registrar'); return }
    onSaved()
  }
  return (
    <Modal onClose={onClose} title="Registrar incidente de seguridad">
      <Field label="Fecha y hora de detección"><input type="datetime-local" value={f.deteccion_at} onChange={e => setF({ ...f, deteccion_at: e.target.value })} style={input} /></Field>
      <Field label="Descripción del incidente"><textarea value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} rows={3} style={{ ...input, resize: 'vertical' }} /></Field>
      <Field label="Categorías de datos afectados (separadas por coma)"><input value={f.categorias} onChange={e => setF({ ...f, categorias: e.target.value })} style={input} placeholder="identificación, perfil TPS…" /></Field>
      <Field label="N° estimado de titulares afectados"><input type="number" value={f.n_afectados} onChange={e => setF({ ...f, n_afectados: e.target.value })} style={input} /></Field>
      <Field label="Consecuencias probables"><textarea value={f.consecuencias} onChange={e => setF({ ...f, consecuencias: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} /></Field>
      <Field label="Medidas de contención adoptadas"><textarea value={f.medidas} onChange={e => setF({ ...f, medidas: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} /></Field>
      {err && <div style={{ color: '#b4493d', fontSize: 12, marginBottom: 10 }}>{err}</div>}
      <div style={{ background: '#fbe9e7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#b4493d', marginBottom: 12 }}>
        Al registrar, el contador de 72 horas para notificar a la APDP comienza desde la fecha de detección.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={guardar} style={btnPrimary}>Registrar incidente</button>
        <button onClick={onClose} style={btnOutline}>Cancelar</button>
      </div>
    </Modal>
  )
}

// ─────────────────────────────── Helpers / UI compartida ──────────────────────────

function estadoLabel(e: string): string {
  return ({ detectado: 'Detectado', investigacion: 'En investigación', notificado_apdp: 'Notificado APDP', notificado_titulares: 'Notificado titulares', cerrado: 'Cerrado', recibida: 'Recibida', pendiente: 'Pendiente', procesando: 'En proceso', completado: 'Resuelta', rechazado: 'Rechazada', prorrogada: 'Prorrogada', SUCCESS: 'Exitoso', FAILED: 'Fallido', PARTIAL: 'Parcial' } as Record<string, string>)[e] ?? e
}

function EstadoChip({ estado }: { estado: string }) {
  const ok = ['completado', 'cerrado', 'SUCCESS'].includes(estado)
  const bad = ['rechazado', 'FAILED', 'PARTIAL'].includes(estado)
  const warn = ['prorrogada', 'notificado_apdp', 'investigacion'].includes(estado)
  const c = ok ? { bg: '#e6f3ed', fg: '#1f6f56' } : bad ? { bg: '#fbe9e7', fg: '#b4493d' } : warn ? { bg: '#fdf3df', fg: '#b8860b' } : { bg: '#f5f3ef', fg: '#8a8885' }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.fg }}>{estadoLabel(estado)}</span>
}

function ConsentChip({ estado }: { estado: string }) {
  const c = estado === 'otorgado' ? { bg: '#e6f3ed', fg: '#1f6f56', t: 'Otorgado' } : estado === 'revocado' ? { bg: '#fbe9e7', fg: '#b4493d', t: 'Revocado' } : { bg: '#f5f3ef', fg: '#8a8885', t: 'No otorgado' }
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: c.bg, color: c.fg }}>{c.t}</span>
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'verde' | 'rojo' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 12, padding: '12px 18px', minWidth: 120 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone === 'rojo' ? '#b4493d' : tone === 'verde' ? '#1f6f56' : '#0b0a09' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8a8885', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Guide({ text }: { text: string }) {
  return <div style={{ background: '#f0f4ff', border: '1px solid #d4e0ff', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#2b3a66', lineHeight: 1.5 }}>ℹ️ {text}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8a8885', marginBottom: 5 }}>{label}</label>{children}</div>
}

function Kv({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: '#8a8885' }}>{k}</div><div style={{ fontSize: 13, color: '#0b0a09', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{v}</div></div>
}

function JsonTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null
  const cols = Object.keys(rows[0])
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{cols.map(c => <th key={c} style={th}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} style={{ borderTop: '1px solid #f0ede8' }}>
            {cols.map(c => <td key={c} style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmt(r[c])}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800 }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function Toast({ msg }: { msg: string }) {
  return <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#0b0a09', color: '#fff', fontSize: 13, padding: '10px 22px', borderRadius: 30, zIndex: 1000 }}>{msg}</div>
}

function Loading() { return <div style={{ color: '#8a8885', fontSize: 13, padding: 20 }}>Cargando…</div> }

function downloadJSON(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px 10px 0', color: '#8a8885', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }
const td: React.CSSProperties = { padding: '10px 10px 10px 0', verticalAlign: 'top' }
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #e8e6e3', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '9px 16px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnOutline: React.CSSProperties = { padding: '9px 16px', background: '#fff', color: '#4a4844', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
const btnMini: React.CSSProperties = { padding: '5px 11px', background: '#0b0a09', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnMiniOutline: React.CSSProperties = { padding: '5px 11px', background: '#fff', color: '#4a4844', border: '1px solid #e8e6e3', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }
