// Runs once when the Next.js server starts after a deploy.
// Logs the deployment to deployment_log using Vercel's auto-injected env vars.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA
  const branch    = process.env.VERCEL_GIT_COMMIT_REF ?? 'main'
  const depId     = process.env.VERCEL_DEPLOYMENT_ID  ?? process.env.VERCEL_URL ?? ''

  if (!commitSha) return // local dev — skip

  try {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!sbUrl || !sbKey) return

    const res = await fetch(`${sbUrl}/rest/v1/deployment_log`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        plataforma: 'vercel',
        estado:     'succeeded',
        url:        depId  || null,
        rama:       branch || null,
        commit_sha: commitSha,
        mensaje:    'auto-registered on startup',
        detalles:   { source: 'instrumentation', branch, commitSha, depId },
      }),
    })

    if (!res.ok) console.error('[instrumentation] deployment_log insert failed:', res.status)
  } catch (e) {
    console.error('[instrumentation] deployment_log error:', e)
  }
}
