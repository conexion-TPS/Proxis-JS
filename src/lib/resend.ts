import { Resend } from 'resend'

// Fallback en build: el constructor de Resend truena si la key falta (rompe el
// `next build` cuando no hay env, p.ej. en CI). En runtime Vercel siempre tiene la real.
// Mismo patrón que src/lib/supabase.ts.
const resend = new Resend(process.env.RESEND_KEY ?? 're_placeholder')

const FROM = 'Proxis Coach <proxis@theprecisionselling.com>'

function applyVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/* Email genérico de cumplimiento legal. Envuelve el cuerpo en el layout estándar. */
export async function sendLegalEmail(params: { to: string; subject: string; bodyHtml: string }) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:sans-serif">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e6e3">
  <div style="background:#0b0a09;padding:20px 28px">
    <div style="font-size:16px;font-weight:800;color:#fff">Proxis · Futura Soluciones Digitales</div>
  </div>
  <div style="padding:28px;color:#2b2926;font-size:14px;line-height:1.65">${params.bodyHtml}
    <p style="margin:20px 0 0;color:#8a8885;font-size:12px">Futura Soluciones Digitales Limitada · RUT 77.662.922-7 · <a href="mailto:privacidad@theprecisionselling.com" style="color:#1a56c4">privacidad@theprecisionselling.com</a></p>
  </div>
</div></body></html>`
  return resend.emails.send({ from: FROM, to: params.to, subject: params.subject, html })
}

export async function sendNotificacionSailor(params: {
  to: string
  asesor: string
  preview: string
  asunto?: string
  cuerpo_html?: string
}) {
  const nombre = params.asesor.split(' ')[0]
  const vars   = { nombre, preview_mensaje: params.preview.slice(0, 200) + (params.preview.length > 200 ? '…' : '') }

  const asunto = applyVars(params.asunto ?? 'Tienes un mensaje de tu coach', vars)
  const html   = params.cuerpo_html
    ? applyVars(params.cuerpo_html, vars)
    : fallbackNotificacion(nombre, params.preview)

  return resend.emails.send({ from: FROM, to: params.to, subject: asunto, html })
}

export async function sendResumenSemanal(params: {
  to: string
  asesor: string
  semana: string
  mensajes: number
  senales: number
  perfil: string | null
  asunto?: string
  cuerpo_html?: string
}) {
  const nombre = params.asesor.split(' ')[0]
  const vars   = {
    nombre,
    semana:         params.semana,
    total_mensajes: String(params.mensajes),
    total_senales:  String(params.senales),
    perfil:         params.perfil ?? 'Pendiente evaluación',
  }

  const asunto = applyVars(params.asunto ?? `Tu resumen semanal — ${params.semana}`, vars)
  const html   = params.cuerpo_html
    ? applyVars(params.cuerpo_html, vars)
    : fallbackResumen(params)

  return resend.emails.send({ from: FROM, to: params.to, subject: asunto, html })
}

export async function sendEliminacionCuenta(params: {
  to: string
  nombre: string
  eventHash: string
}) {
  const nombre = params.nombre.split(' ')[0] || 'Hola'
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:sans-serif">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e6e3">
  <div style="background:#0b0a09;padding:24px 28px">
    <div style="font-size:20px;font-weight:800;color:#fff">Tu cuenta fue eliminada</div>
  </div>
  <div style="padding:28px;color:#2b2926;font-size:14px;line-height:1.65">
    <p style="margin:0 0 16px">Hola ${nombre}, confirmamos que tu cuenta en Proxis fue eliminada de forma permanente.</p>
    <p style="margin:0 0 8px;font-weight:700">Qué ocurrió con tus datos:</p>
    <ul style="margin:0 0 16px;padding-left:20px">
      <li style="margin-bottom:6px"><strong>Datos de identificación</strong> (nombre, correo y datos de contacto): eliminados de forma irreversible.</li>
      <li style="margin-bottom:6px"><strong>Historial de comportamiento y evaluación TPS</strong>: anonimizados de forma irreversible — desvinculados de tu identidad, sin posibilidad de reasociarlos contigo.</li>
      <li style="margin-bottom:6px">Los datos anonimizados se usan internamente para mejorar el servicio, investigación y desarrollo. <strong>No se comparten con terceros.</strong></li>
    </ul>
    <div style="background:#f5f3ef;border-radius:12px;padding:14px 16px;border-left:3px solid #cbf135;margin-bottom:16px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8a8885;margin-bottom:4px">ID de evento de auditoría</div>
      <div style="font-family:monospace;font-size:12px;color:#0b0a09;word-break:break-all">${params.eventHash}</div>
      <div style="font-size:12px;color:#8a8885;margin-top:6px">Conserva este identificador si deseas verificar el proceso ante nosotros o ante la autoridad.</div>
    </div>
    <p style="margin:0;color:#8a8885;font-size:13px">Para cualquier consulta sobre derechos residuales escribe a <a href="mailto:privacidad@theprecisionselling.com" style="color:#1a56c4">privacidad@theprecisionselling.com</a>.</p>
  </div>
</div></body></html>`
  return resend.emails.send({ from: FROM, to: params.to, subject: 'Confirmación de eliminación de tu cuenta Proxis', html })
}

// ── Fallbacks (solo si la DB no devuelve template) ────────────────────────────

function fallbackNotificacion(nombre: string, preview: string) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:sans-serif">
<div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e6e3">
  <div style="background:#0b0a09;padding:24px 28px">
    <div style="font-size:20px;font-weight:800;color:#fff">Hola, ${nombre}</div>
  </div>
  <div style="padding:28px">
    <p style="font-size:15px;color:#4a4844;line-height:1.6;margin:0 0 20px">Tu coach tiene un nuevo mensaje para ti:</p>
    <div style="background:#f5f3ef;border-radius:12px;padding:16px 18px;border-left:3px solid #cbf135;margin-bottom:24px">
      <p style="font-size:14px;color:#0b0a09;line-height:1.6;margin:0">${preview.slice(0, 200)}${preview.length > 200 ? '…' : ''}</p>
    </div>
    <a href="https://sailor-front-ten.vercel.app/feed" style="display:block;background:#cbf135;color:#0b0a09;text-decoration:none;text-align:center;font-weight:800;font-size:15px;padding:14px;border-radius:10px">Ver mensaje completo →</a>
    <p style="font-size:12px;color:#8a8885;line-height:1.5;margin:18px 0 0;text-align:center">Este correo no recibe respuestas; responde dentro de la app.</p>
  </div>
</div></body></html>`
}

function fallbackResumen(p: { asesor: string; semana: string; mensajes: number; senales: number; perfil: string | null }) {
  const nombre = p.asesor.split(' ')[0]
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:sans-serif">
<div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e6e3">
  <div style="background:#0b0a09;padding:24px 28px">
    <div style="font-size:20px;font-weight:800;color:#fff">${nombre}, tu semana en resumen</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px">${p.semana}</div>
  </div>
  <div style="padding:28px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
      <div style="background:#f5f3ef;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#0b0a09">${p.mensajes}</div>
        <div style="font-size:11px;color:#8a8885;margin-top:4px;text-transform:uppercase">Mensajes</div>
      </div>
      <div style="background:#f5f3ef;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#0b0a09">${p.senales}</div>
        <div style="font-size:11px;color:#8a8885;margin-top:4px;text-transform:uppercase">Señales</div>
      </div>
    </div>
    <a href="https://sailor-front-ten.vercel.app/feed" style="display:block;background:#cbf135;color:#0b0a09;text-decoration:none;text-align:center;font-weight:800;font-size:15px;padding:14px;border-radius:10px">Ver tu feed →</a>
  </div>
</div></body></html>`
}
