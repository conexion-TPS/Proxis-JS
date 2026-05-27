import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

// Vercel firma los webhooks con HMAC-SHA1 usando el webhook secret configurado
function verifySignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = createHmac('sha1', secret).update(rawBody).digest('hex')
  return expected === signature
}

// Mapea el tipo de evento Vercel a un estado legible
function mapEstado(tipo: string): string {
  if (tipo.includes('succeeded') || tipo.includes('ready'))   return 'succeeded'
  if (tipo.includes('error')     || tipo.includes('failed'))  return 'error'
  if (tipo.includes('canceled'))                               return 'canceled'
  if (tipo.includes('created')   || tipo.includes('building')) return 'building'
  return tipo
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verificar firma si hay secret configurado
  const secret = process.env.VERCEL_WEBHOOK_SECRET
  if (secret) {
    const sig = req.headers.get('x-vercel-signature') ?? ''
    if (!verifySignature(secret, rawBody, sig)) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const tipo      = String(payload.type ?? '')
  const estado    = mapEstado(tipo)
  const dep       = (payload.payload as Record<string, unknown> | undefined) ?? {}
  const depObj    = (dep.deployment as Record<string, unknown> | undefined) ?? {}
  const project   = (dep.project   as Record<string, unknown> | undefined) ?? {}

  const meta       = (depObj.meta as Record<string, unknown> | undefined) ?? {}
  const url        = String(depObj.url        ?? depObj.inspectorUrl ?? '')
  const rama       = String(meta['githubCommitRef'] ?? depObj.name ?? project.name ?? '')
  const commit_sha = String(meta['githubCommitSha'] ?? '')
  const mensaje    = String(depObj.readyState ?? depObj.errorMessage ?? tipo)

  const sb = supabaseAdmin()
  await sb.from('deployment_log').insert({
    plataforma: 'vercel',
    estado,
    url:         url        || null,
    rama:        rama       || null,
    commit_sha:  commit_sha || null,
    mensaje:     mensaje    || null,
    detalles:    payload,
  })

  // Si el deploy falló, también registrar en error_log para que cerebro lo detecte
  if (estado === 'error') {
    const buildError = String(
      (dep.build as Record<string, unknown> | undefined)?.err
      ?? depObj.errorMessage
      ?? 'Build failure'
    )
    await sb.from('error_log').insert({
      componente: 'vercel',
      severidad:  'error',
      mensaje:    `Deploy fallido: ${mensaje}`,
      detalles:   { tipo, url, rama, commit_sha, buildError },
    })
  }

  return NextResponse.json({ ok: true })
}
