import { NextRequest, NextResponse } from 'next/server'
import { procesarRecordatorios } from '@/lib/cuestionario-recordatorios'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}` || req.nextUrl.searchParams.get('key') === secret
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const resultado = await procesarRecordatorios()
  return NextResponse.json({ ok: true, ...resultado })
}
