'use client'

import { useEffect, useMemo, useState } from 'react'

/* ── Textos definitivos (editables en un solo lugar) ── */
const MENSAJE_INFORME = 'Informe tentativo · lectura preliminar del sistema, a interpretar con criterio profesional'
export const PIE_INFORME = '2026 - Futura Soluciones Digitales Ltda. Derechos Reservados.'

/* ── Paleta del HTML aprobado (definitiva) ── */
const C = {
  tinta: '#2C2C2A', gris: '#888780', tert: '#b6b3ae', borde: '#e8e6e3', bordeF: '#d3d1c7', fondo: '#fafaf7',
  verde: '#1D9E75', ambar: '#BA7517', rojo: '#A32D2D', azul: '#185FA5', lima: '#cbf135',
}
const CUAD_FILL: Record<string, string> = { 'Sólido': '#E1F5EE', 'Revisar técnica': '#FAEEDA', 'Frágil': '#E6F1FB', 'Prioridad disciplina': '#FCEBEB' }
const cuadColor = (c: string) => c === 'Sólido' ? C.verde : c === 'Revisar técnica' ? C.ambar : c === 'Frágil' ? C.azul : c === 'Prioridad disciplina' ? C.rojo : C.gris
const SEVERIDAD = ['Prioridad disciplina', 'Revisar técnica', 'Frágil', 'Sólido']
const CUAD_RAZON: Record<string, string> = {
  'Prioridad disciplina': 'Baja actividad y bajo resultado',
  'Revisar técnica': 'Actividad alta pero resultado por debajo de la meta',
  'Frágil': 'Buen resultado sostenido en muy poca actividad',
  'Sólido': 'Actividad y resultado en meta',
}
// Descripción de arquetipo por nombre_errim — el label que entrega /api/equipo/desempano,
// ya resuelto server-side vía nombreTipo (service_role). La de "Reflexivo" calca el HTML.
const PERFIL_DESC: Record<string, string> = {
  'Energético': 'Directo y orientado a resultados, con ritmo rápido y foco en el cierre. Fortaleza en tomar la iniciativa. Riesgo conocido: puede atropellar el vínculo y descuidar el seguimiento fino.',
  'Magnético': 'Expresivo y entusiasta, orientado a las personas y al relato. Fortaleza en generar cercanía rápido. Riesgo conocido: dispersión y dificultad para sostener el proceso hasta el cierre.',
  'Relacional': 'Paciente y orientado a la confianza de largo plazo. Fortaleza en fidelizar y cuidar la cartera. Riesgo conocido: evita la presión y posterga la apertura de frentes nuevos.',
  'Reflexivo': 'Analítico, meticuloso, orientado al detalle. Fortaleza en relaciones de confianza de largo plazo. Riesgo conocido: tiende a sobre-analizar y, bajo presión, se repliega a lo conocido en vez de abrir frentes nuevos.',
  'Ambiguo': 'Perfil sin un eje dominante claro: combina rasgos según el contexto. Fortaleza en adaptarse. Conviene afinar la lectura con más observación antes de concluir.',
}
const MES_LBL: Record<string, string> = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' }
const mShort = (m: string) => MES_LBL[m.slice(5, 7)] ?? m
const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`)
const iniciales = (n: string) => n.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()

type Perfil = { base: string | null; label: string | null; confianza: string | null; evaluado: boolean }
type SerieItem = { mes: string; indice: number | null; resultado: number | null; cuadrante: string }
type AsesorRow = { asesor: string; persona_id: string; serie: SerieItem[]; perfil: Perfil }
type EquipoItem = SerieItem & { n_asesores: number }
type Data = { meses: string[]; meta: { supervisor: string | null; institucion: string | null; n_asesores: number }; asesores: AsesorRow[]; equipo: EquipoItem[] }
// I2 / AD-5 — informe del supervisor (secciones 3-6, lectura pura)
type Informe = {
  seccion3: { perfil_dominante: string | null; identidad_vendedora: string | null; relacion_prospeccion: string | null; modelos_mentales: string | null; contexto_situacional: string | null } | null
  seccion4: { resumen_ia: string | null; nivel_riesgo: string | null; nivel_riesgo_nota: string | null; relacion_feedback: string | null } | null
  seccion5: { accion: string; dimension: string | null; estado: string | null; fecha: string }[]
  seccion6: { relato_evolucion: string | null; mensajes: { trigger_id: string | null; cuerpo: string; fecha: string }[] }
}

function ProxisLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="4.5" fill={C.verde} />
      <circle cx="6" cy="9" r="3" fill={C.verde} opacity="0.85" /><circle cx="26" cy="9" r="3" fill={C.verde} opacity="0.85" />
      <circle cx="6" cy="23" r="3" fill={C.verde} opacity="0.6" /><circle cx="26" cy="23" r="3" fill={C.verde} opacity="0.6" />
      <line x1="8.6" y1="10.6" x2="13.2" y2="14" stroke={C.verde} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="23.4" y1="10.6" x2="18.8" y2="14" stroke={C.verde} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="8.6" y1="21.4" x2="13.2" y2="18" stroke={C.verde} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="23.4" y1="21.4" x2="18.8" y2="18" stroke={C.verde} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export default function Desempeno({ token, onVistaChange }: { token: string; onVistaChange?: (v: 'gen' | 'det') => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [vista, setVista] = useState<'gen' | 'det'>('gen')
  const [sel, setSel] = useState<string | null>(null)

  // Notifica al contenedor la pestaña activa (para que page.tsx oculte la lista legada en "Detalle").
  useEffect(() => { onVistaChange?.(vista) }, [vista, onVistaChange])

  useEffect(() => {
    if (!token) return
    fetch('/api/equipo/desempeno?desde=2026-01&hasta=2026-06', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Data) => setData(d))
      .catch(() => setError('No se pudo cargar el informe de desempeño.'))
      .finally(() => setLoading(false))
  }, [token])

  const meses = data?.meses ?? []
  const conDatos = useMemo(() => (data?.equipo ?? []).filter(e => e.indice != null).map(e => e.mes), [data])
  const mesAct = conDatos.at(-1) ?? meses.at(-1) ?? null
  const mesPrev = conDatos.at(-2) ?? null
  const eqAct = data?.equipo.find(e => e.mes === mesAct) ?? null
  const eqPrev = data?.equipo.find(e => e.mes === mesPrev) ?? null

  // tendencia: meses consecutivos de caída de resultado terminando en el último
  const mesesEnCaida = (s: SerieItem[]) => {
    const r = s.map(x => x.resultado).filter(v => v != null) as number[]
    let n = 0; for (let i = r.length - 1; i > 0; i--) { if (r[i] < r[i - 1]) n++; else break } return n
  }

  const prioridad = useMemo(() => {
    if (!data || !mesAct) return [] as { a: AsesorRow; cuad: string; razon: string; res: number }[]
    return data.asesores
      .map(a => ({ a, p: a.serie.find(s => s.mes === mesAct) }))
      .filter(x => x.p && x.p.indice != null)
      .map(x => {
        const cuad = x.p!.cuadrante
        const caida = mesesEnCaida(x.a.serie)
        const razon = CUAD_RAZON[cuad] + (caida >= 2 ? ` · ${caida} meses en caída` : '')
        return { a: x.a, cuad, razon, res: x.p!.resultado ?? 0 }
      })
      .sort((u, v) => SEVERIDAD.indexOf(u.cuad) - SEVERIDAD.indexOf(v.cuad) || u.res - v.res)
      .slice(0, 3)
  }, [data, mesAct])

  useEffect(() => { if (!sel && prioridad.length) setSel(prioridad[0].a.asesor) }, [prioridad, sel])

  if (loading) return <Card><div style={{ color: C.gris, fontSize: 13 }}>Cargando informe…</div></Card>
  if (error || !data || !mesAct) return <Card><div style={{ color: C.rojo, fontSize: 13 }}>{error || 'Sin datos'}</div></Card>

  const enMeta = data.asesores.filter(a => { const p = a.serie.find(s => s.mes === mesAct); return p && p.resultado != null && p.resultado >= 0.85 }).length
  const cumpl = eqAct?.resultado != null ? Math.round(eqAct.resultado * 100) : null
  const dCumpl = (eqAct?.resultado != null && eqPrev?.resultado != null) ? Math.round((eqAct.resultado - eqPrev.resultado) * 100) : null
  const selRow = data.asesores.find(a => a.asesor === sel) ?? null

  return (
    <div id="informe-desempeno" style={{ maxWidth: 840, margin: '0 auto 20px' }}>
      <style>{`
        .solo-print{display:none;}
        @media print{
          @page{size:A4;margin:14mm;}
          body *{visibility:hidden;}
          #informe-desempeno,#informe-desempeno *{visibility:visible;}
          #informe-desempeno{position:absolute;left:0;top:0;width:100%;}
          .no-print{display:none!important;}
          .solo-print{display:block!important;}
          #v-gen,#v-det{display:block!important;}
          #v-det{margin-top:24px;border-top:1px solid #ccc;padding-top:18px;}
          .card{break-inside:avoid;}
        }`}</style>

      {/* Pestañas */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <Tab on={vista === 'gen'} onClick={() => setVista('gen')}>Vista general</Tab>
        <Tab on={vista === 'det'} onClick={() => setVista('det')}>Detalle por asesor</Tab>
        <button onClick={() => window.print()} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: `0.5px solid ${C.bordeF}`, background: '#fff', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', color: C.tinta }}>⤓ Exportar a PDF</button>
      </div>

      {/* Encabezado */}
      <div className="card" style={cardSt({ display: 'flex', gap: 11, alignItems: 'flex-start' })}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e6f1fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ProxisLogo /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{data.meta.institucion ?? 'Equipo'} · Informe de desempeño</div>
          <div style={{ fontSize: 11.5, color: C.gris }}>Supervisor {data.meta.supervisor ?? '—'} · equipo de {data.meta.n_asesores} · {mShort(mesAct).toLowerCase()} {mesAct.slice(0, 4)}</div>
        </div>
        <div style={{ fontSize: 10.5, color: C.tert, maxWidth: 200, textAlign: 'right', lineHeight: 1.4 }}>{MENSAJE_INFORME}</div>
      </div>

      {/* ===== VISTA GENERAL ===== */}
      <div id="v-gen" style={{ display: vista === 'gen' ? 'block' : 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          <Kpi k="Asesores" v={String(data.meta.n_asesores)} />
          <Kpi k="En meta" v={String(enMeta)} u={`de ${data.meta.n_asesores}`} />
          <Kpi k="Cumplimiento" v={cumpl != null ? `${cumpl}%` : '—'} u={dCumpl != null && mesPrev ? `${dCumpl >= 0 ? '▲' : '▼'} ${Math.abs(dCumpl)} pts vs ${mShort(mesPrev).toLowerCase()}` : ''} uColor={dCumpl != null && dCumpl < 0 ? C.rojo : C.verde} />
          <Kpi k="Cuadrante" v={eqAct?.cuadrante ?? '—'} u="equipo" small />
        </div>

        <Card>
          <CardH t="Trayectoria del equipo · enero–junio 2026" s="Índice de actividad y cumplimiento de resultado, mes a mes (consolidado del equipo)" />
          <G1 meses={meses} serie={data.equipo} />
          <Legend items={[['Índice de actividad', C.verde], ['Resultado', C.azul]]} />
        </Card>

        <Card>
          <CardH t={`Matriz de cuadrantes · ${mShort(mesAct).toLowerCase()}`} s="Actividad × resultado · cada punto un asesor · rombo = equipo consolidado" />
          <G2 data={data} mes={mesAct} />
        </Card>

        <Card>
          <CardH t="Atención prioritaria esta semana" s="El sistema ordena por urgencia. Un clic abre el detalle del asesor." />
          {prioridad.map(({ a, cuad, razon }) => (
            <button key={a.asesor} onClick={() => { setSel(a.asesor); setVista('det') }} style={prioBtn()}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cuadColor(cuad), flexShrink: 0 }} />
              <span style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 500, color: C.tinta }}>{a.asesor}</span><span style={{ fontSize: 11, color: C.gris, display: 'block' }}>{razon}</span></span>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: cuadColor(cuad) + '1f', color: cuadColor(cuad), whiteSpace: 'nowrap' }}>{cuad}</span>
              <span style={{ color: C.tinta }}>›</span>
            </button>
          ))}
        </Card>
      </div>

      {/* ===== VISTA DETALLE ===== */}
      <div id="v-det" style={{ display: vista === 'det' ? 'block' : 'none' }}>
        {/* selector de asesor (no entra al PDF) */}
        <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {data.asesores.map(a => <Tab key={a.asesor} on={sel === a.asesor} onClick={() => setSel(a.asesor)}>{a.asesor}</Tab>)}
        </div>
        {selRow && <Detalle row={selRow} token={token} mesAct={mesAct} mesPrev={mesPrev} meses={meses} mesesEnCaida={mesesEnCaida} />}
      </div>

      {/* Pie legal: SOLO en el PDF exportado; en pantalla va en el footer de /equipo (page.tsx) */}
      <div className="solo-print" style={{ textAlign: 'center', fontSize: 10.5, color: C.tert, padding: '18px 0 4px' }}>{PIE_INFORME}</div>
    </div>
  )
}

/* ── Detalle de un asesor (7 secciones; cuantitativo real, IA en placeholder) ── */
function Detalle({ row, token, mesAct, mesPrev, meses, mesesEnCaida }: { row: AsesorRow; token: string; mesAct: string; mesPrev: string | null; meses: string[]; mesesEnCaida: (s: SerieItem[]) => number }) {
  const pAct = row.serie.find(s => s.mes === mesAct)
  const pPrev = mesPrev ? row.serie.find(s => s.mes === mesPrev) : null
  const cuad = pAct?.cuadrante ?? '—'
  const res = pAct?.resultado ?? null
  const dRes = (res != null && pPrev?.resultado != null) ? Math.round((res - pPrev.resultado) * 100) : null
  const caida = mesesEnCaida(row.serie)
  const perfilTxt = row.perfil.evaluado && row.perfil.label ? PERFIL_DESC[row.perfil.label] : null

  // I2 — secciones 3-6 por lectura del endpoint server-side (cadena de mando vía subárbol).
  const [inf, setInf] = useState<Informe | null>(null)
  const [infLoading, setInfLoading] = useState(true)
  useEffect(() => {
    let vivo = true
    setInfLoading(true); setInf(null)
    fetch(`/api/equipo/informe?asesor=${encodeURIComponent(row.asesor)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then((d: Informe | null) => { if (vivo) setInf(d) })
      .catch(() => { if (vivo) setInf(null) })
      .finally(() => { if (vivo) setInfLoading(false) })
    return () => { vivo = false }
  }, [row.asesor, token])

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: `0.5px solid ${C.borde}` }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: 14, color: '#854F0B' }}>{iniciales(row.asesor)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{row.asesor}</div>
          <div style={{ fontSize: 12, color: C.gris }}>{row.perfil.evaluado ? `Perfil ${row.perfil.label} (${row.perfil.base})` : 'Perfil sin evaluar'} · cuadrante “{cuad.toLowerCase()}” · {mShort(mesAct).toLowerCase()} {mesAct.slice(0, 4)}</div>
        </div>
        {res != null && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: res < 0.85 ? '#FAEEDA' : '#E1F5EE', color: res < 0.85 ? C.ambar : C.verde }}>Resultado {pct(res)} {res < 0.85 ? '▼' : '▲'}</span>}
      </div>

      <Sec n="1" t="Quién es">
        {perfilTxt
          ? <p style={pTxt()}>Perfil <strong style={{ color: C.tinta }}>{row.perfil.label?.toLowerCase()}</strong>: {perfilTxt}</p>
          : <Placeholder>Perfil aún sin evaluar en el cuestionario. La lectura conductual aparecerá cuando se complete.</Placeholder>}
      </Sec>

      <Sec n="2" t="Cómo está · trayectoria ene–jun">
        <Spark serie={row.serie} meses={meses} />
        <Legend small items={[['Actividad', C.verde], ['Resultado', C.azul]]} />
      </Sec>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={subCard()}>
          <Lbl>Resultado vs {mesPrev ? mShort(mesPrev).toLowerCase() : '—'}</Lbl>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0 9px' }}>
            <span style={{ fontSize: 29, fontWeight: 500, color: res != null && res < 0.85 ? C.rojo : C.verde }}>{pct(res)}</span>
            {dRes != null && <span style={{ fontSize: 13, color: dRes < 0 ? C.rojo : C.verde }}>{dRes < 0 ? '▼' : '▲'} {Math.abs(dRes)} pts</span>}
          </div>
          <div style={{ fontSize: 12, color: C.gris, lineHeight: 1.6, borderTop: `0.5px solid ${C.borde}`, paddingTop: 8 }}>
            De cada $100 de su meta, logró ${res != null ? Math.round(res * 100) : '—'}.{caida >= 2 && <> <strong style={{ color: C.tinta }}>{caida} meses consecutivos a la baja.</strong></>}
          </div>
        </div>
        <div style={subCard()}>
          <Lbl>Plan de {mesPrev ? mShort(mesPrev).toLowerCase() : 'mes previo'}</Lbl>
          <div style={{ marginTop: 8 }}><Placeholder>Pendiente — requiere el plan del mes anterior, que generará el módulo de análisis.</Placeholder></div>
        </div>
      </div>

      <SecBox n="3" t="El cruce — perfil × desempeño" bg="#FAEEDA" col="#854F0B">
        {infLoading ? <Placeholder>Cargando…</Placeholder> : (() => {
          const s3 = inf?.seccion3
          const narr = [s3?.modelos_mentales, s3?.contexto_situacional, s3?.relacion_prospeccion, s3?.identidad_vendedora].filter(Boolean) as string[]
          if (!s3 || narr.length === 0) return <Placeholder>Aún sin datos.</Placeholder>
          return (
            <>
              <p style={pTxt()}>Su cuadrante actual es <strong style={{ color: C.tinta }}>“{cuad.toLowerCase()}”</strong> ({CUAD_RAZON[cuad] ?? '—'}). Leído junto a su perfil{row.perfil.base ? ` ${row.perfil.label?.toLowerCase()}` : ''}:</p>
              {narr.map((t, i) => <p key={i} style={{ ...pTxt(), marginTop: 8 }}><Rich>{t}</Rich></p>)}
            </>
          )
        })()}
      </SecBox>

      <Sec n="4" t="Diagnóstico">
        {infLoading ? <Placeholder>Cargando…</Placeholder> : (inf?.seccion4?.resumen_ia || inf?.seccion4?.nivel_riesgo_nota) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inf!.seccion4!.resumen_ia && <p style={pTxt()}><Rich>{inf!.seccion4!.resumen_ia}</Rich></p>}
            {inf!.seccion4!.nivel_riesgo_nota && <p style={pTxt()}><strong style={{ color: C.tinta }}>Atención:</strong> <Rich>{inf!.seccion4!.nivel_riesgo_nota}</Rich></p>}
          </div>
        ) : <Placeholder>Aún sin datos.</Placeholder>}
      </Sec>

      <Sec n="5" t="Plan de acción del mes">
        {infLoading ? <Placeholder>Cargando…</Placeholder> : (inf?.seccion5?.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inf.seccion5.map((a, i) => (
              <li key={i} style={{ ...pTxt(), listStyle: 'disc' }}><Rich>{a.accion}</Rich></li>
            ))}
          </ul>
        ) : <Placeholder>Aún sin datos.</Placeholder>)}
      </Sec>

      <SecBox n="6" t="Acompañamiento de Sailor durante el mes" bg="#E1F5EE" col="#0F6E56">
        {infLoading ? <Placeholder>Cargando…</Placeholder> : (inf?.seccion6?.relato_evolucion || inf?.seccion6?.mensajes?.length) ? (
          <>
            {inf!.seccion6.relato_evolucion && <p style={pTxt()}><Rich>{inf!.seccion6.relato_evolucion}</Rich></p>}
            {inf!.seccion6.mensajes?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Mensajes de coaching recibidos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {inf!.seccion6.mensajes.map((m, i) => (
                    <div key={i} style={{ fontSize: 12, color: C.gris, lineHeight: 1.5, textAlign: 'left' }}>
                      <span style={{ color: C.tert }}>{new Date(m.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} · </span><Rich>{m.cuerpo ?? ''}</Rich>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : <Placeholder>Aún sin datos.</Placeholder>}
      </SecBox>

      <div style={{ border: `1px dashed ${C.bordeF}`, borderRadius: 10, padding: 13, textAlign: 'center' }}>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: C.gris }}>7 · Comprobación al cierre — próximamente</div>
        <p style={{ fontSize: 11, color: C.tert, margin: '5px auto 0', maxWidth: 460, lineHeight: 1.5 }}>Al cierre del mes, el tracker de resultados (calidad de fuente y persistencia) mostrará si el plan dio fruto.</p>
      </div>
    </Card>
  )
}

/* ── Gráficos (port directo de las funciones drawG1/drawG2/drawSpark del HTML) ── */
function G1({ meses, serie }: { meses: string[]; serie: SerieItem[] }) {
  const W = 780, H = 200, padL = 38, padR = 14, padT = 14, padB = 26, pw = W - padL - padR, ph = H - padT - padB, yMax = 1.1
  const xF = (i: number) => padL + (i / (meses.length - 1)) * pw, yF = (v: number) => padT + (1 - v / yMax) * ph
  const by = new Map(serie.map(s => [s.mes, s]))
  const pts = (k: 'indice' | 'resultado') => meses.map((m, i) => ({ x: xF(i), y: by.get(m)?.[k] })).filter(p => p.y != null).map(p => ({ x: p.x, y: yF(p.y as number) }))
  const path = (a: { x: number; y: number }[]) => a.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0.5, 0.85, 1].map(g => <g key={g}><line x1={padL} y1={yF(g)} x2={W - padR} y2={yF(g)} stroke={C.borde} strokeWidth={g === 1 ? 0.5 : 1} strokeDasharray={g === 1 ? '' : '4 3'} /><text x={padL - 5} y={yF(g) + 3} textAnchor="end" fontSize="9" fill={C.gris}>{Math.round(g * 100)}%</text></g>)}
      {meses.map((m, i) => <text key={m} x={xF(i)} y={H - 9} textAnchor="middle" fontSize="9" fill={C.gris}>{mShort(m)}</text>)}
      <path d={path(pts('indice'))} fill="none" stroke={C.verde} strokeWidth="2.5" />
      <path d={path(pts('resultado'))} fill="none" stroke={C.azul} strokeWidth="2.5" />
      {pts('indice').map((p, i) => <circle key={'i' + i} cx={p.x} cy={p.y} r="3.5" fill={C.verde} />)}
      {pts('resultado').map((p, i) => <circle key={'r' + i} cx={p.x} cy={p.y} r="3.5" fill={C.azul} />)}
    </svg>
  )
}
function G2({ data, mes }: { data: Data; mes: string }) {
  const W = 780, H = 380, padL = 46, padR = 18, padT = 12, padB = 38, pw = W - padL - padR, ph = H - padT - padB, yMax = 1.25
  const xF = (a: number) => padL + a * pw, yF = (r: number) => padT + (1 - r / yMax) * ph
  const mX = xF(0.5), mY = yF(0.85), L = padL, R = padL + pw, T = padT, B = padT + ph
  const pts = data.asesores.map(a => { const p = a.serie.find(s => s.mes === mes); return p && p.indice != null && p.resultado != null ? { n: a.asesor, x: p.indice, y: p.resultado, cuad: p.cuadrante, e: false } : null }).filter(Boolean) as { n: string; x: number; y: number; cuad: string; e: boolean }[]
  const eq = data.equipo.find(e => e.mes === mes)
  if (eq && eq.indice != null && eq.resultado != null) pts.push({ n: 'EQUIPO', x: eq.indice, y: eq.resultado, cuad: eq.cuadrante, e: true })
  const q: [number, number, number, number, string][] = [[mX, T, R - mX, mY - T, 'Sólido'], [mX, mY, R - mX, B - mY, 'Revisar técnica'], [L, T, mX - L, mY - T, 'Frágil'], [L, mY, mX - L, B - mY, 'Prioridad disciplina']]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {q.map(a => <g key={a[4]}><rect x={a[0]} y={a[1]} width={a[2]} height={a[3]} fill={CUAD_FILL[a[4]]} opacity="0.6" /><text x={a[0] + a[2] / 2} y={a[1] + a[3] / 2} textAnchor="middle" fontSize="11" fontWeight="500" fill={C.gris} opacity="0.85">{a[4]}</text></g>)}
      <line x1={mX} y1={T} x2={mX} y2={B} stroke={C.tinta} strokeDasharray="4 3" opacity="0.4" /><line x1={L} y1={mY} x2={R} y2={mY} stroke={C.tinta} strokeDasharray="4 3" opacity="0.4" />
      <rect x={L} y={T} width={pw} height={ph} fill="none" stroke={C.borde} />
      <text x={L + pw / 2} y={H - 7} textAnchor="middle" fontSize="10.5" fill={C.gris}>Actividad (índice) · umbral 50%</text>
      <text x={12} y={T + ph / 2} textAnchor="middle" fontSize="10.5" fill={C.gris} transform={`rotate(-90,12,${T + ph / 2})`}>Resultado · umbral 85%</text>
      {pts.map((p, i) => { const cx = xF(p.x), cy = yF(Math.min(p.y, yMax)); return <g key={i}><title>{`${p.n} · actividad ${pct(p.x)} · resultado ${pct(p.y)}`}</title>{p.e ? <rect x={cx - 6} y={cy - 6} width="12" height="12" fill={C.verde} stroke={C.tinta} strokeWidth="1.5" transform={`rotate(45,${cx},${cy})`} /> : <circle cx={cx} cy={cy} r="6" fill={cuadColor(p.cuad)} />}<text x={cx + 9} y={cy + 3} fontSize="9.5" fontWeight={p.e ? 500 : 400} fill={C.tinta}>{p.n}</text></g> })}
    </svg>
  )
}
function Spark({ serie, meses }: { serie: SerieItem[]; meses: string[] }) {
  const W = 760, H = 150, padL = 34, padR = 60, padT = 10, padB = 22, pw = W - padL - padR, ph = H - padT - padB
  const xF = (i: number) => padL + (i / (meses.length - 1)) * pw, yF = (v: number) => padT + (1 - v / 1.2) * ph
  const by = new Map(serie.map(s => [s.mes, s]))
  const pts = (k: 'indice' | 'resultado') => meses.map((m, i) => ({ x: xF(i), y: by.get(m)?.[k] })).filter(p => p.y != null).map(p => ({ x: p.x, y: yF(Math.min(p.y as number, 1.2)) }))
  const path = (a: { x: number; y: number }[]) => a.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  const last = (k: 'indice' | 'resultado') => { const a = pts(k); return a.length ? a[a.length - 1].y : padT }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0.5, 0.85].map(g => <g key={g}><line x1={padL} y1={yF(g)} x2={W - padR} y2={yF(g)} stroke={C.gris} strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" /><text x={padL - 5} y={yF(g) + 3} textAnchor="end" fontSize="8" fill={C.gris}>{Math.round(g * 100)}%</text></g>)}
      {meses.map((m, i) => <text key={m} x={xF(i)} y={H - 7} textAnchor="middle" fontSize="8" fill={C.gris}>{mShort(m)}</text>)}
      <path d={path(pts('indice'))} fill="none" stroke={C.verde} strokeWidth="2" /><path d={path(pts('resultado'))} fill="none" stroke={C.azul} strokeWidth="2" />
      {pts('indice').map((p, i) => <circle key={'i' + i} cx={p.x} cy={p.y} r="2.5" fill={C.verde} />)}
      {pts('resultado').map((p, i) => <circle key={'r' + i} cx={p.x} cy={p.y} r="2.5" fill={C.azul} />)}
      <text x={W - padR + 6} y={last('indice') + 3} fontSize="8.5" fill={C.verde}>actividad</text>
      <text x={W - padR + 6} y={last('resultado') + 3} fontSize="8.5" fill={C.azul}>resultado</text>
    </svg>
  )
}

/* ── Bloques reutilizables ── */
const cardSt = (extra: React.CSSProperties = {}): React.CSSProperties => ({ background: '#fff', border: `0.5px solid ${C.borde}`, borderRadius: 12, padding: '15px 18px', marginBottom: 14, ...extra })
const subCard = (): React.CSSProperties => ({ border: `0.5px solid ${C.borde}`, borderRadius: 10, padding: '13px 15px' })
const prioBtn = (): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '10px 13px', border: `0.5px solid ${C.borde}`, borderRadius: 8, background: '#fff', cursor: 'pointer', width: '100%', marginBottom: 8, fontFamily: 'inherit' })
const pTxt = (): React.CSSProperties => ({ fontSize: 13, color: C.gris, lineHeight: 1.65, margin: 0, textAlign: 'left' })

// UI-15 — renderiza **negrita** real de las narrativas (sin mostrar los asteriscos).
function Rich({ children }: { children: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**'))
    ? <strong key={i} style={{ color: C.tinta }}>{p.slice(2, -2)}</strong>
    : <span key={i}>{p}</span>)}</>
}
function Card({ children }: { children: React.ReactNode }) { return <div className="card" style={cardSt()}>{children}</div> }
function CardH({ t, s }: { t: string; s: string }) { return <><div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{t}</div><div style={{ fontSize: 12, color: C.gris, marginBottom: 10 }}>{s}</div></> }
function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} style={{ padding: '7px 14px', borderRadius: 8, border: `0.5px solid ${C.bordeF}`, background: on ? '#eef0f2' : '#fff', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', color: C.tinta, fontWeight: on ? 500 : 400 }}>{children}</button> }
function Kpi({ k, v, u, uColor, small }: { k: string; v: string; u?: string; uColor?: string; small?: boolean }) { return <div style={{ background: '#f1efe8', borderRadius: 8, padding: '11px 13px' }}><div style={{ fontSize: 11.5, color: C.gris }}>{k}</div><div style={{ fontSize: small ? 15 : 19, fontWeight: 500, marginTop: 2 }}>{v}</div>{u && <div style={{ fontSize: 10, color: uColor ?? C.tert }}>{u}</div>}</div> }
function Legend({ items, small }: { items: [string, string][]; small?: boolean }) { return <div style={{ display: 'flex', gap: 16, marginTop: small ? 4 : 8, fontSize: small ? 10.5 : 11, color: C.gris }}>{items.map(([t, c]) => <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 11, height: 3, background: c, borderRadius: 2 }} />{t}</span>)}</div> }
function Sec({ n, t, pill, children }: { n: string; t: string; pill?: string; children: React.ReactNode }) { return <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 500, color: C.gris, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>{n} · {t} {pill && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: '#e6f1fb', color: C.azul, textTransform: 'none', letterSpacing: 0 }}>{pill}</span>}</div>{children}</div> }
function SecBox({ n, t, bg, col, children }: { n: string; t: string; bg: string; col: string; children: React.ReactNode }) { return <div style={{ marginBottom: 16, background: bg, borderRadius: 10, padding: '13px 15px' }}><div style={{ fontSize: 11, fontWeight: 500, color: col, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>{n} · {t}</div>{children}</div> }
function Lbl({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 11, fontWeight: 500, color: C.gris, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</div> }
function Placeholder({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, color: C.tert, lineHeight: 1.6, fontStyle: 'italic' }}>{children}</div> }
