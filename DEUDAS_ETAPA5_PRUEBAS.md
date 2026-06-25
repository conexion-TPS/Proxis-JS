# DEUDAS TÉCNICAS — Etapa 5 (prueba de sistema)

Registro de hallazgos de la sesión de prueba controlador. No para resolver
ahora; seguimiento posterior.

## Merrill-Reid (IP) — 3 apariciones vivas en producción
Marco que TPS decidió evitar por riesgo de IP; sigue presente en rutas activas.

- **MR-1 — Generación del cuestionario "Tu lectura":** `proxis-observacion` arma
  la pregunta mapeando las 3 opciones a perfiles Merrill-Reid (E/S/R/A).
- **MR-2 — Persistencia en `behavioral_signals.perfil_hint`:** se guarda la letra
  Merrill-Reid de la opción elegida por el supervisor.
- **MR-3 — Chat asesor↔Sailor:** `/api/sailor/chat` lee `perfil_dominante` y arma
  "Energético/Sociable/Relacional/Reflexivo" como contexto del prompt de Gemini.
  No expone la letra al asesor, pero el marco entra al prompt.

Patrón común: en los envíos (MR-3, y proxis-accion) la protección de datos
sensibles/jerga es SOLO por prompt (REGLAS_MENTOR), no estructural (no pasa por
proyectarPerfilParaSupervisor).

## Feed de Sailor (sailor_messages)
- **RLS admin_only bloquea lectura del asesor.** Resuelto vía endpoint
  server-side service_role + JWT de Sailor (/api/sailor/feed y carga del detalle).
  La policy admin_only se mantiene.
- **Mantenimiento manual de la tabla solo por service_role.** El SQL Editor del
  dashboard (sin JWT admin) NO puede borrar/editar filas: la RLS las hace
  invisibles. Limpiezas/correcciones futuras requieren service_role.
- **Evolución del feed (post-MVP):** hoy carga al abrir/refrescar (sin realtime).
  Hoja de ruta: A (actual) → polling → realtime autenticado / push. Requiere
  migrar el login de Sailor a JWT firmados con el secreto de Supabase.

## /admin/sailor — contador de réplicas roto
Las respuestas del asesor se guardan con `origen='asesora'` (con "a"); el código
cuenta réplicas con `origen==='asesor'` (sin "a"). El texto SÍ se ve en el hilo,
pero el contador marca 0. Ajuste fácil: corregir el literal a 'asesora'.

## Aislamiento de instituciones
- **Imrbrasil:** se apagó `ia_activa=false` para aislar la prueba. Decisión de
  TPS: NO se restaura (queda apagada; descartada esa reversión).
- **Antecedente:** Jack Lemmon (Imrbrasil, real) recibió una acción trigger
  manual el 2-jun (no solo cron). Confirma que el flujo de acciones manuales se
  usó sobre institución real antes de esta prueba.

## Acción elegida por el LLM (relación con H10)
El `accion_tipo` de cada hipótesis (trigger/ajuste_dimension/escalar_supervisor/
ninguna) lo decide el LLM en cada corrida, sin regla fija → no reproducible, no
auditable. Es material de calibración H10 (no resolver ahora).
