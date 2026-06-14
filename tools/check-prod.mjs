#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// check-prod.mjs — Chequeo de salud de producción de Proxis.
//
// Para qué: si el lunes la app "se siente lenta" o no carga, corré esto y te
// dice en una pantalla si el problema es la PLATAFORMA (Vercel/la app) o tu
// RED/DNS LOCAL (router, ISP, caché) — que es lo que pasó el sábado.
//
// Cómo correrlo:  node tools/check-prod.mjs
//   (no instala nada; solo necesita Node. No toca producción: solo lee.)
// ════════════════════════════════════════════════════════════════════════

import { promises as dns } from 'node:dns'
import https from 'node:https'
import tls from 'node:tls'

// — Lo que chequeamos. El dominio "bonito" por el que entran los equipos, y el
//   .vercel.app directo (sin DNS propio) para distinguir plataforma vs DNS local.
const DOMINIO = 'proxis.theprecisionselling.com'
const VERCEL = 'proxis.vercel.app'
const TIMEOUT_MS = 15000
const SSL_DIAS_ALERTA = 15 // avisar si al certificado le quedan menos de esto

// — helpers de impresión —
const OK = '✅'
const WARN = '⚠️'
const FAIL = '❌'
const linea = (s = '') => console.log(s)
const titulo = (s) => { linea(); linea('── ' + s + ' ' + '─'.repeat(Math.max(0, 56 - s.length))) }

// Pide la home por HTTPS y devuelve { status, ms } o { error }.
// Cualquier status (incluso 3xx/4xx) significa que el servidor RESPONDIÓ;
// un error/timeout significa que NO respondió (que es la señal que importa).
function pedirHttp(host) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const req = https.get(
      { host, path: '/', method: 'GET', timeout: TIMEOUT_MS, headers: { 'user-agent': 'proxis-check-prod' } },
      (res) => {
        const ms = Date.now() - t0
        res.resume() // drenar para liberar el socket
        resolve({ status: res.statusCode, ms, servidor: res.headers['server'] })
      },
    )
    req.on('timeout', () => { req.destroy(); resolve({ error: `timeout (>${TIMEOUT_MS / 1000}s)` }) })
    req.on('error', (e) => resolve({ error: e.code || e.message }))
  })
}

// Abre TLS y lee el certificado: emisor + días que le quedan.
function chequearSsl(host) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: TIMEOUT_MS },
      () => {
        const cert = socket.getPeerCertificate()
        socket.end()
        if (!cert || !cert.valid_to) return resolve({ error: 'sin certificado' })
        const dias = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000)
        const emisor = (cert.issuer && (cert.issuer.O || cert.issuer.CN)) || 'desconocido'
        resolve({ dias, emisor, vence: cert.valid_to })
      },
    )
    socket.on('timeout', () => { socket.destroy(); resolve({ error: `timeout (>${TIMEOUT_MS / 1000}s)` }) })
    socket.on('error', (e) => resolve({ error: e.code || e.message }))
  })
}

async function main() {
  linea()
  linea('  CHEQUEO DE SALUD — PROXIS PRODUCCIÓN')
  linea('  ' + new Date().toLocaleString())

  const avisos = [] // se llena con strings de problemas

  // ── 1. DNS ──────────────────────────────────────────────────────────────
  titulo('1. DNS del dominio')
  try {
    // dns.lookup = el MISMO resolver del sistema operativo que usa el navegador
    // (getaddrinfo). Es lo que de verdad experimenta el equipo. No usamos
    // dns.resolve4 (c-ares) porque en Windows puede dar ECONNREFUSED aunque el
    // navegador resuelva bien → falsa alarma.
    const ips = await dns.lookup(DOMINIO, { all: true })
    linea(`   ${OK} ${DOMINIO} resuelve correctamente`)
    linea(`      IPs: ${ips.map((r) => r.address).join(', ')}`)
    // Mejor esfuerzo (no crítico): mostrar a dónde apunta el CNAME, si se puede.
    try {
      const c = await dns.resolveCname(DOMINIO)
      if (c[0]) {
        linea(`      apunta a: ${c[0]}`)
        if (!c[0].includes('vercel')) {
          avisos.push(`El dominio NO apunta a Vercel (apunta a ${c[0]}) — revisá la config de DNS.`)
          linea(`   ${WARN} esperábamos un destino de Vercel`)
        }
      }
    } catch { /* CNAME no consultable desde esta red; el lookup de arriba ya confirmó que resuelve */ }
  } catch (e) {
    avisos.push(`El dominio ${DOMINIO} NO resuelve por DNS (${e.code || e.message}). Suele ser DNS/red local: probá otra red o reiniciá el router.`)
    linea(`   ${FAIL} ${DOMINIO} no resuelve (${e.code || e.message})`)
  }

  // ── 2. HTTP: dominio Y .vercel.app por separado ──────────────────────────
  titulo('2. ¿Responden los sitios?')
  const rDom = await pedirHttp(DOMINIO)
  const rVer = await pedirHttp(VERCEL)
  const domResponde = !rDom.error
  const verResponde = !rVer.error
  const domOk = rDom.status === 200

  linea(`   Dominio  (${DOMINIO}):`)
  linea(rDom.error ? `      ${FAIL} no responde — ${rDom.error}` : `      ${domOk ? OK : WARN} HTTP ${rDom.status} en ${rDom.ms}ms`)
  linea(`   Vercel   (${VERCEL}):`)
  linea(rVer.error ? `      ${FAIL} no responde — ${rVer.error}` : `      ${rVer.status === 200 ? OK : WARN} HTTP ${rVer.status} en ${rVer.ms}ms`)

  // Diagnóstico — el corazón del script.
  if (domOk) {
    linea(`   ${OK} El dominio carga bien.`)
  } else if (!domResponde && verResponde) {
    avisos.push('El DOMINIO no responde pero la PLATAFORMA (Vercel) SÍ → el problema es de DNS/red LOCAL, no de la app. Probá desde otra red (datos del celular), reiniciá el router, o esperá unos minutos: suele resolverse solo. La app está sana.')
  } else if (!domResponde && !verResponde) {
    avisos.push('NI el dominio NI Vercel responden → casi seguro es tu CONEXIÓN A INTERNET. Verificá tu red. (Si tu internet anda bien y aun así fallan los dos, recién ahí sospechá de Vercel.)')
  } else if (domResponde && !domOk) {
    avisos.push(`El dominio responde pero con código HTTP ${rDom.status} (no 200) → puede ser un error de la app/deploy. Avisá al equipo técnico con ese número.`)
  }

  // ── 3. SSL ────────────────────────────────────────────────────────────────
  titulo('3. Certificado SSL (candado)')
  const ssl = await chequearSsl(DOMINIO)
  if (ssl.error) {
    avisos.push(`No se pudo leer el certificado SSL (${ssl.error}). Si el dominio tampoco responde arriba, es lo mismo: DNS/red local.`)
    linea(`   ${FAIL} no se pudo verificar — ${ssl.error}`)
  } else if (ssl.dias < 0) {
    avisos.push(`El certificado SSL VENCIÓ hace ${-ssl.dias} días → avisá YA al equipo técnico.`)
    linea(`   ${FAIL} VENCIDO hace ${-ssl.dias} días (emisor: ${ssl.emisor})`)
  } else if (ssl.dias < SSL_DIAS_ALERTA) {
    avisos.push(`Al certificado SSL le quedan solo ${ssl.dias} días. Normalmente Vercel lo renueva solo, pero si no, avisá al equipo técnico.`)
    linea(`   ${WARN} vence pronto: ${ssl.dias} días (emisor: ${ssl.emisor})`)
  } else {
    linea(`   ${OK} válido, le quedan ${ssl.dias} días (emisor: ${ssl.emisor})`)
  }

  // ── Veredicto ─────────────────────────────────────────────────────────────
  titulo('RESULTADO')
  if (avisos.length === 0) {
    linea(`   ${OK} TODO OK — el dominio carga, la plataforma responde y el SSL está vigente.`)
    linea()
    process.exit(0)
  }
  linea(`   ${WARN} REVISÁ ESTO:`)
  avisos.forEach((a, i) => linea(`      ${i + 1}. ${a}`))
  linea()
  process.exit(1)
}

main().catch((e) => { console.error(FAIL + ' error inesperado:', e); process.exit(2) })
