import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_KEY)

const FROM = 'Proxis Coach <proxis@theprecisionselling.com>'

function applyVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
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
