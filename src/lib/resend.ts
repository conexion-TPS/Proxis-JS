import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_KEY)

const FROM = 'Proxis Coach <proxis@theprecisionselling.com>'

export async function sendNotificacionSailor(params: {
  to: string
  asesor: string
  preview: string
}) {
  return resend.emails.send({
    from:    FROM,
    to:      params.to,
    subject: 'Tienes un mensaje de tu coach',
    html:    templateNotificacion(params.asesor, params.preview),
  })
}

export async function sendResumenSemanal(params: {
  to: string
  asesor: string
  semana: string
  mensajes: number
  senales: number
  perfil: string | null
}) {
  return resend.emails.send({
    from:    FROM,
    to:      params.to,
    subject: `Tu resumen semanal — ${params.semana}`,
    html:    templateResumen(params),
  })
}

function templateNotificacion(asesor: string, preview: string) {
  const nombre = asesor.split(' ')[0]
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e6e3">
  <div style="background:#0b0a09;padding:24px 28px">
    <div style="font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Proxis Coach</div>
    <div style="font-size:20px;font-weight:800;color:#fff">Hola, ${nombre}</div>
  </div>
  <div style="padding:28px">
    <p style="font-size:15px;color:#4a4844;line-height:1.6;margin:0 0 20px">
      Tu coach tiene un nuevo mensaje para ti:
    </p>
    <div style="background:#f5f3ef;border-radius:12px;padding:16px 18px;border-left:3px solid #cbf135;margin-bottom:24px">
      <p style="font-size:14px;color:#0b0a09;line-height:1.6;margin:0">
        ${preview.slice(0, 200)}${preview.length > 200 ? '…' : ''}
      </p>
    </div>
    <a href="https://sailor-front-ten.vercel.app/feed"
       style="display:block;background:#cbf135;color:#0b0a09;text-decoration:none;text-align:center;font-weight:800;font-size:15px;padding:14px;border-radius:10px">
      Ver mensaje completo →
    </a>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #f0ede8">
    <p style="font-size:11px;color:#b0aeab;margin:0;text-align:center">
      Proxis · The Precision Selling · <a href="https://theprecisionselling.com" style="color:#b0aeab">theprecisionselling.com</a>
    </p>
  </div>
</div>
</body></html>`
}

function templateResumen(p: {
  asesor: string; semana: string; mensajes: number; senales: number; perfil: string | null
}) {
  const nombre = p.asesor.split(' ')[0]
  const perfilTexto = p.perfil ?? 'Pendiente evaluación'
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e6e3">
  <div style="background:#0b0a09;padding:24px 28px">
    <div style="font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Proxis Coach · Resumen</div>
    <div style="font-size:20px;font-weight:800;color:#fff">${nombre}, tu semana en resumen</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px">${p.semana}</div>
  </div>
  <div style="padding:28px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
      <div style="background:#f5f3ef;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#0b0a09">${p.mensajes}</div>
        <div style="font-size:11px;color:#8a8885;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em">Mensajes del coach</div>
      </div>
      <div style="background:#f5f3ef;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:#0b0a09">${p.senales}</div>
        <div style="font-size:11px;color:#8a8885;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em">Señales capturadas</div>
      </div>
    </div>
    <div style="background:#f5f3ef;border-radius:12px;padding:16px 18px;margin-bottom:24px">
      <div style="font-size:11px;color:#8a8885;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Perfil conductual</div>
      <div style="font-size:15px;font-weight:700;color:#0b0a09">${perfilTexto}</div>
    </div>
    <a href="https://sailor-front-ten.vercel.app/feed"
       style="display:block;background:#cbf135;color:#0b0a09;text-decoration:none;text-align:center;font-weight:800;font-size:15px;padding:14px;border-radius:10px">
      Ver tu feed →
    </a>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #f0ede8">
    <p style="font-size:11px;color:#b0aeab;margin:0;text-align:center">
      Proxis · The Precision Selling · <a href="https://theprecisionselling.com" style="color:#b0aeab">theprecisionselling.com</a>
    </p>
  </div>
</div>
</body></html>`
}
