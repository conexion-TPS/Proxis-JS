// supabase/functions/_shared/email-sailor.ts
// Renderiza el correo de notificación al ASESOR con la plantilla activa
// (email_templates tipo='notificacion_sailor'): saludo + contexto + el mensaje +
// nota "no responder" + botón al feed. Lo usan proxis-accion (trigger) y
// proxis-monitor para que esos correos dejen de ser texto plano sin contexto.
// Si no hay fila de plantilla, cae a un fallback con el mismo formato.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fallback(nombre: string, previewHtml: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8e6e3"><div style="background:#0b0a09;padding:24px 28px"><div style="font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Proxis Coach</div><div style="font-size:20px;font-weight:800;color:#fff">Hola, ${nombre}</div></div><div style="padding:28px"><p style="font-size:15px;color:#4a4844;line-height:1.6;margin:0 0 20px">Tu coach de Proxis (Sailor Mentor) te dejó un nuevo mensaje:</p><div style="background:#f5f3ef;border-radius:12px;padding:16px 18px;border-left:3px solid #cbf135;margin-bottom:24px"><p style="font-size:14px;color:#0b0a09;line-height:1.6;margin:0">${previewHtml}</p></div><a href="https://sailor-front-ten.vercel.app/feed" style="display:block;background:#cbf135;color:#0b0a09;text-decoration:none;text-align:center;font-weight:800;font-size:15px;padding:14px;border-radius:10px">Ver mensaje completo →</a><p style="font-size:12px;color:#8a8885;line-height:1.5;margin:18px 0 0;text-align:center">Este correo no recibe respuestas; responde dentro de la app.</p></div></div></body></html>`
}

// deno-lint-ignore no-explicit-any
export async function renderSailorEmailHtml(sb: any, asesor: string, mensaje: string): Promise<string> {
  const nombre = escapeHtml((asesor.split(' ')[0] || asesor))
  const previewHtml = escapeHtml(mensaje).replace(/\n/g, '<br>')
  const { data: tpl } = await sb.from('email_templates')
    .select('cuerpo_html').eq('tipo', 'notificacion_sailor').eq('activo', true).maybeSingle()
  if (!tpl?.cuerpo_html) return fallback(nombre, previewHtml)
  return (tpl.cuerpo_html as string).replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) =>
    k === 'nombre' ? nombre : k === 'preview_mensaje' ? previewHtml : `{{${k}}}`)
}
