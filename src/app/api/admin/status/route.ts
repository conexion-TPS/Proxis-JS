import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    gemini: !!process.env.GEMINI_KEY,
    resend: !!process.env.RESEND_KEY,
  })
}
