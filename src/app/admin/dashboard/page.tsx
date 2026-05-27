'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

const NAV_CARDS = [
  { href: '/admin/prompts',       icon: '✍️', title: 'Prompts',              desc: 'Edita y versiona plantillas de mensajes por trigger. Previsualiza con asesores reales.',                   badge: 'Mensajes' },
  { href: '/admin/triggers',      icon: '⚡',  title: 'Triggers',             desc: 'Umbrales, cooldowns y estado activo/inactivo de cada trigger de automatización.',                          badge: 'Mensajes' },
  { href: '/admin/review',        icon: '🔍', title: 'Revisión',             desc: 'Audita mensajes enviados. Marca 👍/👎 y reescribe para mejorar el modelo.',                                 badge: 'Mensajes' },
  { href: '/admin/perfil',        icon: '🧩', title: 'Perfiles',             desc: 'Calibra el perfil ontológico-conductual de cada asesor con chat IA y resumen automático.',               badge: 'IA Coach' },
  { href: '/admin/hipotesis',     icon: '💡', title: 'Hipótesis IA',         desc: 'Valida hipótesis generadas por el motor. Aprueba propuestas de conocimiento y gestiona vacíos.',         badge: 'IA Coach' },
  { href: '/admin/senales',       icon: '📡', title: 'Señales',              desc: 'Timeline de señales comportamentales capturadas. Cobertura de dimensiones por asesor.',                  badge: 'IA Coach' },
  { href: '/admin/cuestionarios', icon: '📝', title: 'Cuestionarios',        desc: 'Diseña cuestionarios psicométricos y micro-capturas. Ve respuestas por asesor.',                         badge: 'IA Coach' },
  { href: '/admin/conocimiento',  icon: '🧬', title: 'Conocimiento conductual', desc: 'Base de conocimiento Merrill-Reid + TPS + ciclo de 7 pasos. Completitud por perfil.',                badge: 'IA Coach' },
  { href: '/admin/knowledge',     icon: '🧠', title: 'Base KB',              desc: 'Fichas de contexto libre para enriquecer prompts. Embeddings vectoriales opcionales.',                   badge: 'Contexto' },
  { href: '/admin/sailor',        icon: '⛵', title: 'Sailor App',           desc: 'Feed de mensajes en app móvil. Tokens push, conversaciones y estadísticas de apertura.',                 badge: 'Sailor' },
  { href: '/admin/analytics',     icon: '📊', title: 'Analytics',            desc: 'Mensajes por trigger, feedback por asesor, evolución temporal de métricas.',                            badge: 'Reportes' },
]

type SbStatus = 'loading' | 'ok' | 'error'

interface SystemStatus {
  gemini: boolean
  resend: boolean
  cron: Array<{ jobname: string; schedule: string; active: boolean; last_run: string | null; last_status: string | null }>
  signals: { pending: number; total: number }
  triggers: { active: number; paused: number }
  messages: { last24h: number; last7d: number }
  cuestionarios: { tps_preguntas: number }
  cerebro: { checked_at: string; estado_global: string; alertas: number; metricas: Record<string, number> } | null
  deployments: Array<{ estado: string; url: string | null; rama: string | null; commit_sha: string | null; mensaje: string | null; created_at: string }>
  errores: { recientes: Array<{ componente: string; severidad: string; mensaje: string; created_at: string }>; total_7d: number }
  integridad: {
    asesores_activos: number; sin_perfil: number; sin_metas: number
    triggers_activos: number; triggers_sin_prompt: number
    detalle_sin_perfil: string[]; detalle_sin_prompt: string[]
  } | null
  pipeline: {
    ultimo_reporte_hace_horas: number | null
    reacciones_14d: number; mensajes_14d: number; sailor_sin_leer_viejos: number
  } | null
  reparaciones: Array<{
    tipo_alerta: string; accion: string; exito: boolean; detalle: string; created_at: string
  }>
}

export default function AdminDashboard() {
  const [sbStatus,   setSbStatus]   = useState<SbStatus>('loading')
  const [sys,        setSys]        = useState<SystemStatus | null>(null)
  const [sysLoading, setSysLoading] = useState(true)
  const [lastCheck,  setLastCheck]  = useState<string>('')
  const isDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('proxis-dev'))

  const runChecks = useCallback(async () => {
    setSysLoading(true)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Supabase connectivity
    fetch(`${url}/rest/v1/trigger_config?limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then(r => setSbStatus(r.ok ? 'ok' : 'error'))
      .catch(() => setSbStatus('error'))

    // Full system status
    try {
      const r = await fetch('/api/admin/status')
      const d: SystemStatus = await r.json()
      setSys(d)
      setLastCheck(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch {
      /* silent */
    } finally {
      setSysLoading(false)
    }
  }, [])

  useEffect(() => { runChecks() }, [runChecks])

  const sbColor = sbStatus === 'ok' ? '#1a9e4a' : sbStatus === 'error' ? '#b03a3a' : '#a8691a'
  const sbGlow  = sbStatus === 'ok' ? '0 0 0 3px rgba(26,158,74,0.15)' : sbStatus === 'error' ? '0 0 0 3px rgba(176,58,58,0.15)' : '0 0 0 3px rgba(168,105,26,0.15)'

  return (
    <div style={{ padding: '40px 36px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#0b0a09', marginBottom: 4 }}>
            Panel de administración
          </h1>
          <p style={{ fontSize: 13, color: '#4a4844' }}>
            Gestiona prompts, triggers, mensajes y base de conocimiento del sistema IA.
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={sysLoading}
          style={{ padding: '8px 16px', background: '#f5f3ef', border: '1px solid #e8e6e3', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: sysLoading ? 'default' : 'pointer', fontFamily: 'inherit', color: '#4a4844', opacity: sysLoading ? 0.6 : 1 }}
        >
          {sysLoading ? 'Verificando…' : 'Actualizar estado'}
        </button>
      </div>

      {/* ── SYSTEM HEALTH PANEL ─────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e3', borderRadius: 14, padding: '20px 24px', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a8885' }}>
            Estado del sistema
          </div>
          {lastCheck && (
            <div style={{ fontSize: 11, color: '#c8c6c3', fontFamily: 'var(--font-mono), monospace' }}>
              Última verificación: {lastCheck}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>

          {/* Supabase */}
          <HealthCard
            label="Supabase"
            status={sbStatus === 'ok' ? 'ok' : sbStatus === 'error' ? 'error' : 'loading'}
            value={sbStatus === 'ok' ? 'Conectado' : sbStatus === 'error' ? 'Error de conexión' : 'Verificando…'}
            sub={isDev ? 'proxis-dev' : 'producción'}
          />

          {/* Gemini */}
          <HealthCard
            label="Gemini API"
            status={sys === null ? 'loading' : sys.gemini ? 'ok' : 'error'}
            value={sys === null ? '…' : sys.gemini ? 'Respondiendo' : 'Sin respuesta'}
            sub="gemini-2.5-flash"
          />

          {/* Resend */}
          <HealthCard
            label="Resend Email"
            status={sys === null ? 'loading' : sys.resend ? 'ok' : 'warn'}
            value={sys === null ? '…' : sys.resend ? 'Clave configurada' : 'Clave no encontrada'}
            sub="proxis@theprecisionselling.com"
          />

          {/* Señales pendientes */}
          <HealthCard
            label="Señales pendientes"
            status={sys === null ? 'loading' : (sys.signals.pending > 50 ? 'warn' : 'ok')}
            value={sys === null ? '…' : `${sys.signals.pending} sin procesar`}
            sub={sys ? `${sys.signals.total} total` : ''}
          />

          {/* Triggers */}
          <HealthCard
            label="Triggers"
            status={sys === null ? 'loading' : (sys.triggers.active > 0 ? 'ok' : 'warn')}
            value={sys === null ? '…' : `${sys.triggers.active} activos`}
            sub={sys ? `${sys.triggers.paused} pausados` : ''}
          />

          {/* Mensajes 24h */}
          <HealthCard
            label="Mensajes enviados"
            status={sys === null ? 'loading' : 'ok'}
            value={sys === null ? '…' : `${sys.messages.last24h} (24h)`}
            sub={sys ? `${sys.messages.last7d} esta semana` : ''}
          />

          {/* Cuestionario TPS */}
          <HealthCard
            label="Instrumento TPS"
            status={sys === null ? 'loading' : (sys.cuestionarios.tps_preguntas >= 57 ? 'ok' : sys.cuestionarios.tps_preguntas > 0 ? 'warn' : 'error')}
            value={sys === null ? '…' : `${sys.cuestionarios.tps_preguntas} / 57 preguntas`}
            sub={sys?.cuestionarios.tps_preguntas === 57 ? 'Completo' : 'Revisar seed'}
          />

          {/* Integridad: asesores sin perfil */}
          {(() => {
            const ig = sys?.integridad
            const sinPerfil = ig?.sin_perfil ?? 0
            const sinPrompt = ig?.triggers_sin_prompt ?? 0
            const total = sinPerfil + sinPrompt
            return (
              <HealthCard
                label="Integridad de datos"
                status={sys === null ? 'loading' : total === 0 ? 'ok' : sinPrompt > 0 ? 'error' : 'warn'}
                value={sys === null ? '…' : total === 0 ? 'Todo consistente' : `${total} inconsistencia${total > 1 ? 's' : ''}`}
                sub={total === 0 ? `${ig?.asesores_activos ?? 0} asesores · ${ig?.triggers_activos ?? 0} triggers` : [sinPerfil ? `${sinPerfil} sin perfil` : '', sinPrompt ? `${sinPrompt} trigger sin prompt` : ''].filter(Boolean).join(' · ')}
              />
            )
          })()}

          {/* Pipeline de entrada */}
          {(() => {
            const pl = sys?.pipeline
            const horas: number | null = pl?.ultimo_reporte_hace_horas ?? null
            const pipStatus: HealthStatus = sys === null ? 'loading'
              : horas === null ? 'warn'
              : horas > 120 ? 'error'
              : horas > 72 ? 'warn'
              : 'ok'
            const label = horas === null ? 'Sin reportes'
              : horas > 24 ? `Último: hace ${Math.round(horas / 24)}d`
              : `Último: hace ${Math.round(horas)}h`
            return (
              <HealthCard
                label="Pipeline de entrada"
                status={pipStatus}
                value={sys === null ? '…' : label}
                sub={pl ? `${pl.reacciones_14d} reacciones · ${pl.sailor_sin_leer_viejos} sin leer >7d` : ''}
              />
            )
          })()}

          {/* Último deploy */}
          {(() => {
            const last = sys?.deployments?.[0]
            const depStatus: HealthStatus = sys === null ? 'loading' : !last ? 'warn' : last.estado === 'succeeded' ? 'ok' : last.estado === 'error' ? 'error' : 'warn'
            return (
              <HealthCard
                label="Último deploy"
                status={depStatus}
                value={sys === null ? '…' : !last ? 'Sin datos (webhook pendiente)' : last.estado === 'succeeded' ? 'Exitoso' : last.estado === 'error' ? 'Falló' : last.estado}
                sub={last ? `${last.rama ?? 'main'} — ${new Date(last.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Configura webhook Vercel'}
              />
            )
          })()}

          {/* Errores runtime */}
          {(() => {
            const total = sys?.errores?.total_7d ?? 0
            return (
              <HealthCard
                label="Errores runtime (7d)"
                status={sys === null ? 'loading' : total === 0 ? 'ok' : total <= 3 ? 'warn' : 'error'}
                value={sys === null ? '…' : total === 0 ? 'Sin errores' : `${total} error${total > 1 ? 'es' : ''}`}
                sub={sys?.errores?.recientes?.[0]?.componente ?? (total === 0 ? 'Edge functions OK' : '')}
              />
            )
          })()}

          {/* Cerebro */}
          {(() => {
            const cb = sys?.cerebro
            const cbStatus: HealthStatus = sys === null ? 'loading' : !cb ? 'warn' : cb.estado_global === 'saludable' ? 'ok' : cb.estado_global === 'degradado' ? 'warn' : 'error'
            return (
              <HealthCard
                label="Cerebro IA"
                status={cbStatus}
                value={sys === null ? '…' : !cb ? 'Sin reporte' : cb.estado_global.charAt(0).toUpperCase() + cb.estado_global.slice(1)}
                sub={cb ? `${cb.alertas} alerta${cb.alertas !== 1 ? 's' : ''} — ${new Date(cb.checked_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Corre diario a las 6am'}
              />
            )
          })()}

        </div>

        {/* Cron jobs */}
        {sys && sys.cron && sys.cron.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #f0ede8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 10 }}>
              Edge Functions — Cron Jobs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sys.cron.map((job) => {
                const ok = job.active && job.last_status !== 'failed'
                return (
                  <div key={job.jobname} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <Dot status={!job.active ? 'warn' : ok ? 'ok' : 'error'} />
                    <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: '#4a4844', minWidth: 200 }}>
                      {job.jobname}
                    </span>
                    <span style={{ color: '#8a8885' }}>{job.schedule}</span>
                    <span style={{ marginLeft: 'auto', color: job.last_run ? '#8a8885' : '#c8c6c3', fontSize: 11 }}>
                      {job.last_run
                        ? `Último run: ${new Date(job.last_run).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                        : 'Sin ejecuciones registradas'}
                    </span>
                    {job.last_status && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: job.last_status === 'succeeded' ? '#e6f3ed' : '#fbe9e9', color: job.last_status === 'succeeded' ? '#1f6f56' : '#b03a3a' }}>
                        {job.last_status}
                      </span>
                    )}
                  </div>
                )
              })}
              {/* proxis-researcher — manual, no cron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <Dot status="ok" />
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: '#4a4844', minWidth: 200 }}>
                  proxis-researcher
                </span>
                <span style={{ color: '#8a8885' }}>manual (desde Hipótesis)</span>
              </div>
            </div>
          </div>
        )}

        {/* Deployments recientes */}
        {sys && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #f0ede8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885', marginBottom: 10 }}>
              Deployments Vercel (últimos 5)
            </div>
            {!sys.deployments?.length ? (
              <div style={{ fontSize: 12, color: '#c8c6c3', fontStyle: 'italic' }}>
                Sin datos — el webhook Vercel registrará builds a partir de ahora
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sys.deployments.map((dep, i) => {
                  const ok = dep.estado === 'succeeded'
                  const err = dep.estado === 'error'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <Dot status={ok ? 'ok' : err ? 'error' : 'warn'} />
                      <span style={{ fontWeight: 600, minWidth: 80, color: ok ? '#1a9e4a' : err ? '#b03a3a' : '#a8691a' }}>
                        {dep.estado}
                      </span>
                      <span style={{ color: '#4a4844' }}>{dep.rama ?? 'main'}</span>
                      {dep.commit_sha && (
                        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: '#8a8885' }}>
                          {dep.commit_sha.slice(0, 7)}
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', color: '#8a8885', fontSize: 11 }}>
                        {new Date(dep.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Inconsistencias de datos */}
        {sys?.integridad && (sys.integridad.sin_perfil > 0 || sys.integridad.triggers_sin_prompt > 0 || sys.integridad.sin_metas > 0) && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #f0ede8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a8691a', marginBottom: 10 }}>
              Inconsistencias de datos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sys.integridad.triggers_sin_prompt > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '7px 10px', background: '#fbe9e9', borderRadius: 6, border: '1px solid #f0b8b8' }}>
                  <Dot status="error" />
                  <span style={{ color: '#b03a3a', fontWeight: 600 }}>Triggers sin prompt:</span>
                  <span style={{ color: '#4a4844' }}>{sys.integridad.detalle_sin_prompt.join(', ')}</span>
                </div>
              )}
              {sys.integridad.sin_perfil > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '7px 10px', background: '#fdf4e6', borderRadius: 6, border: '1px solid #f5d9a0' }}>
                  <Dot status="warn" />
                  <span style={{ color: '#a8691a', fontWeight: 600 }}>Sin tps_perfiles:</span>
                  <span style={{ color: '#4a4844' }}>{sys.integridad.detalle_sin_perfil.join(', ')}</span>
                </div>
              )}
              {sys.integridad.sin_metas > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '7px 10px', background: '#fdf4e6', borderRadius: 6, border: '1px solid #f5d9a0' }}>
                  <Dot status="warn" />
                  <span style={{ color: '#a8691a', fontWeight: 600 }}>Sin metas:</span>
                  <span style={{ color: '#4a4844' }}>{sys.integridad.sin_metas} asesor(es)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Auto-reparaciones recientes */}
        {sys && sys.reparaciones?.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #f0ede8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1a9e4a', marginBottom: 10 }}>
              Auto-reparaciones del sistema
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sys.reparaciones.map((rep, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12,
                  padding: '8px 10px', borderRadius: 6, border: '1px solid',
                  background: rep.exito ? '#f0faf4' : '#fbe9e9',
                  borderColor: rep.exito ? '#c3e8d0' : '#f0b8b8',
                }}>
                  <Dot status={rep.exito ? 'ok' : 'error'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, fontWeight: 700, color: rep.exito ? '#1f6f56' : '#b03a3a' }}>
                        {rep.tipo_alerta}
                      </span>
                      <span style={{ fontSize: 10, color: '#8a8885' }}>
                        {new Date(rep.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ color: '#4a4844', fontSize: 11 }}>{rep.detalle}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errores recientes */}
        {sys && sys.errores?.recientes?.length > 0 && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #f0ede8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b03a3a', marginBottom: 10 }}>
              Errores de runtime (últimos 7 días)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sys.errores.recientes.map((err, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, padding: '8px 10px', background: '#fbe9e9', borderRadius: 6, border: '1px solid #f0b8b8' }}>
                  <Dot status="error" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, fontWeight: 700, color: '#b03a3a' }}>
                        {err.componente}
                      </span>
                      <span style={{ fontSize: 10, color: '#8a8885' }}>
                        {new Date(err.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ color: '#4a4844', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {err.mensaje}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Nav cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 40 }}>
        {NAV_CARDS.map(card => (
          <NavCard key={card.href} {...card} />
        ))}
      </div>

      <style>{`
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

type HealthStatus = 'ok' | 'warn' | 'error' | 'loading'

const STATUS_COLORS: Record<HealthStatus, { dot: string; bg: string; border: string; text: string }> = {
  ok:      { dot: '#1a9e4a', bg: '#f0faf4', border: '#c3e8d0', text: '#1a9e4a' },
  warn:    { dot: '#a8691a', bg: '#fdf4e6', border: '#f5d9a0', text: '#a8691a' },
  error:   { dot: '#b03a3a', bg: '#fbe9e9', border: '#f0b8b8', text: '#b03a3a' },
  loading: { dot: '#c8c6c3', bg: '#f5f3ef', border: '#e8e6e3', text: '#8a8885' },
}

function Dot({ status }: { status: HealthStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0,
      animation: status === 'loading' ? 'pulseDot 1.2s infinite' : 'none',
      display: 'inline-block',
    }} />
  )
}

function HealthCard({ label, status, value, sub }: { label: string; status: HealthStatus; value: string; sub?: string }) {
  const c = STATUS_COLORS[status]
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Dot status={status} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8885' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0b0a09' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#8a8885', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function NavCard({ href, icon, title, desc, badge }: typeof NAV_CARDS[0]) {
  return (
    <Link href={href} style={{
      background: '#fff', border: '1px solid #e8e6e3',
      borderRadius: 14, padding: 24, textDecoration: 'none', color: 'inherit',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.18s',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement
      el.style.borderColor = '#0b0a09'
      el.style.boxShadow = '0 8px 24px rgba(11,10,9,0.08)'
      el.style.transform = 'translateY(-2px)'
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement
      el.style.borderColor = '#e8e6e3'
      el.style.boxShadow = 'none'
      el.style.transform = 'none'
    }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: '#f5f3ef',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#8a8885', lineHeight: 1.5 }}>{desc}</div>
      <div style={{
        marginTop: 'auto',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: '#8a8885', paddingTop: 12, borderTop: '1px solid #f0ede8',
      }}>
        <ClockIcon />
        {badge}
      </div>
    </Link>
  )
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8e6e3',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#8a8885', marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontSize: mono ? 11 : 13, color: '#0b0a09', fontWeight: 500,
        wordBreak: 'break-all',
        fontFamily: mono ? 'var(--font-mono), monospace' : 'inherit',
      }}>{value}</div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 3v2l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
