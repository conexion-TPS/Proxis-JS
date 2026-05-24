import { NextResponse } from 'next/server'

const ALLOWED = [
  'https://sailor-front-ten.vercel.app',
  'http://localhost:3001',
]

export function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function handleOptions(req: Request) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}
