import { redirect } from 'next/navigation'

// Plataforma legacy APAGADA (2026-06-15): /plataforma redirige a /app.
//
// Redirect del lado SERVIDOR: responde antes de renderizar nada, así que los
// scripts legacy (plataforma-core.js / plataforma-app.js / compensacion/*) NUNCA
// se cargan y el cliente Supabase de Viña ni se instancia.
//
// El código legacy se CONSERVA, inerte, para limpieza futura con expertos:
//   - public/plataforma-core.js, public/plataforma-app.js
//   - public/compensacion/**, public/signal-capture.js, public/cuestionario-player.js
//   - el contenido anterior de esta página vive en el historial de git.
// NO borrar esos assets aquí.

export default function PlataformaPage() {
  redirect('/app')
}
