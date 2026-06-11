# DEUDAS — Capa de IA (edge functions)
### Registro de hallazgos del inventario (solo lectura) — 11-Jun-2026
> Fuente: inventario de las 8 funciones en supabase/functions/ (las 6 conocidas + proxis-signals + _shared/ai-client.ts).
> Estas deudas NO bloquean el merge del porting de lectura /app (las pantallas no tocan estas funciones).
> Se abordan como frente propio antes de que la IA opere sobre los equipos reales (Fase 2).

## D1 — 🔴 ESTRUCTURAL: toda la capa de IA usa nombre de asesor como llave
Las 7 funciones del pipeline (proxis-signals, proxis-analyzer, proxis-monitor, proxis-observacion, proxis-researcher, proxis-accion, proxis-cerebro) consultan y escriben por `asesor` (texto). Ninguna usa `persona_id`/`institucion_id`. Contradice el cimiento de Fase 0 (§4 de DISENO_CONSOLIDACION.md: el nombre no es llave). La IA es tenant-ciega: un homónimo entre Zurich y Consorcio mezclaría personas. Migración a `persona_id` requerida antes de operar en producción con equipos reales.

## D2 — Divergencia repo↔BD: proxis-informes no está versionada
proxis-cerebro invoca proxis-informes (canario A8, dry-run), pero el archivo NO existe en supabase/functions/. Mismo patrón que la RPC org_subtree (desplegada en BD, no versionada). Extraer su definición desde Supabase y versionarla en el repo.

Ampliación tras el mapeo: las definiciones reales de cron.job tampoco están versionadas en el repo (los horarios solo constan en comentarios de cabecera). El cron diario de recordatorios de proxis-monitor (modo only_reminders) no aparece en código — existe el modo, no consta el disparador.

## D3 — Migración a Groq INCOMPLETA: dos llamadas Gemini directas vigentes
proxis-researcher (callGemini → gemini-2.5-flash) y la sonda A1 de proxis-cerebro llaman Gemini directo, sin pasar por _shared/ai-client.ts. Corrige el registro previo que daba la migración por completa. Migrar ambas a ai-client (Groq→OpenRouter) o decidir explícitamente que queden en Gemini.

## D4 — proxis-cerebro escribe datos reales en auto-reparaciones
Las auto-reparaciones insertan tps_perfiles y metas default, y actualizan behavioral_signals y knowledge_gaps — todo por nombre, sin persona_id/institucion_id. Riesgo: ensuciar el modelo consolidado de proxis_dev con filas sin llaves. Congelar o adaptar las auto-reparaciones antes de la conmutación (Fase 3).

## D5 — proxis-signals existe y no estaba documentada
Cron diario 0 6 * * *; lee metas/reportes/contactos/ingresos/asesor_perfil/sailor_messages/deductions_log y escribe behavioral_signals. Es la ENTRADA del pipeline. Incorporarla a toda planificación de la capa de IA (el pipeline son 7 funciones, no 6). También por nombre (incluida en D1).

## D6 — Hardcodes operativos menores
- ADMIN_EMAIL con fallback hardcodeado: hpoblete@imrbrasil.com (proxis-cerebro).
- URLs hardcodeadas a proxis-dev-admin.vercel.app (proxis-monitor) — quedarán obsoletas al unificar Vercel (Fase 3).
- Modelos hardcodeados: gemini-2.5-flash (researcher + sonda A1).
- Sin nombres de personas reales ni empresas (zurich/consorcio/vina) hardcodeados en estas funciones, salvo el ADMIN_EMAIL.

## D7 — Recordatorio vigente (de DISENO_CONSOLIDACION.md)
Las keys GROQ_KEY/OPENROUTER_KEY NO están en el deploy proxis-js (el del dominio real). Agregar antes de que la IA opere en producción.

## Orden tentativo de resolución (a confirmar tras el mapeo del pipeline)
1. D5/D2 (completar el mapa: versionar lo que falta) → 2. D1 (migración a persona_id, función por función según el flujo) → 3. D3 (unificar proveedor) → 4. D4 (auto-reparaciones) → 5. D6/D7 (al unificar Vercel, Fase 3).
