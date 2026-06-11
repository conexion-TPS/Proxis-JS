# MAPEO — Pipeline de IA (7 funciones)
### Flujo completo: disparadores, tablas puente y salidas — 11-Jun-2026
> Fuente: inventario solo-lectura del código (supabase/functions/ + src/). Complemento de DEUDAS_CAPA_IA.md.
> Hallazgo estructural clave: el pipeline se conecta POR TABLAS, no por llamadas directas → la migración a persona_id (D1) debe hacerse por CADENA (escritor y lector de cada tabla puente migran coordinados), no función por función aislada.

## 1. Conexiones DIRECTAS (función → función, vía `${SB_URL}/functions/v1/...`)

**Única función que invoca a otras: `proxis-cerebro`.** Ninguna de las otras 6 hace fetch a una función hermana.

**a) Auto-reparación** (`repararInvocarAnalyzer`, líneas ~797-803):
- `proxis-cerebro → proxis-analyzer` · `POST` · payload `{ triggered_by: 'proxis-cerebro-auto-repair' }`.
- **Condición:** que el cron diario levante alguna alerta de tipo `pipeline_stall`, `cron_vacio` o `analyzer_no_procesa`, y que no se haya intentado esa reparación ≥3 veces en 24h (`repair_log`).

**b) Arnés de canarios** (`invokeFn`, solo con `{run_canaries:true}`):
| Canario | Llama a | Payload | Condición |
|---|---|---|---|
| A2 | `proxis-signals` | `{ asesor: '__canary__' }` | siempre (no usa IA) |
| A8 | `proxis-informes` | `{ dry_run: true }` | siempre (no usa IA) |
| A3 | `proxis-analyzer` | `{ asesor: '__canary__' }` | solo si A1 (sonda Gemini) pasó |
| A4 | `proxis-researcher?gap_id=…` | `{}` | solo si A1 pasó |
| A5 | `proxis-observacion` | `{ asesor: '__canary__' }` | solo si A1 pasó |
| A7 | `proxis-accion` | `{ deduction_id, dry_run: true }` | solo si A1 pasó |

> Nota: `proxis-informes` se invoca aquí pero **su archivo no existe** en `supabase/functions/` (no encontrado en código).

---

## 2. Conexiones POR DATOS (tabla puente: salida de A = entrada de B)

| Tabla puente | Escribe | Lee |
|---|---|---|
| **behavioral_signals** | proxis-signals; proxis-monitor (burnout/pregunta_enviada); `/api/equipo/observacion` POST (fuente='supervisor') | **proxis-analyzer** (procesada=false); proxis-researcher; proxis-cerebro |
| **deductions_log** | proxis-analyzer (hipótesis) | proxis-monitor (`hipotesis_acumuladas`); proxis-observacion (menor confianza); proxis-accion (por id); proxis-signals (count → señal `hipotesis_acumuladas`); proxis-cerebro |
| **knowledge_gaps** | proxis-analyzer; `/api/admin/knowledge/investigar-gap` (→en_investigacion); proxis-cerebro (auto-repair) | **proxis-researcher** (estado='en_investigacion') |
| **knowledge_proposals** | proxis-researcher | *(aprobación humana en admin)* → `knowledge_base_conductual` → leída por proxis-analyzer y proxis-researcher |
| **asesor_perfil** | proxis-analyzer (nivel_riesgo, progresión, resumen) | proxis-monitor (`riesgo_elevado`, perfil_resumen); proxis-signals (→ señales `riesgo_elevado`/`progresion_hito`); proxis-observacion; proxis-researcher; proxis-cerebro |
| **tps_perfiles** | proxis-analyzer (tps_progress); proxis-cerebro (auto-repair) | proxis-monitor (bloque perfil TPS); proxis-cerebro (integridad) |
| **message_log** | proxis-monitor; proxis-accion (`hipotesis-accion`/`-escalar`) | proxis-analyzer (correlación reacción→mensaje); proxis-monitor (cooldown); proxis-cerebro (coherencia acciones↔entregas) |
| **sailor_messages** | proxis-monitor; proxis-accion | proxis-signals (dias_sin_mensaje); proxis-cerebro (sin leer >7d) |
| **trigger_efectividad** | proxis-monitor; proxis-analyzer | proxis-cerebro (checkEfectividad) |
| **error_log / gemini_usage** | todas (vía ai-client + handlers) | proxis-cerebro (fallos IA, cuota, uso) |

**Cadena central del pipeline:**
`reportes/contactos/ingresos/metas` → **signals** → `behavioral_signals` → **analyzer** → `deductions_log`/`knowledge_gaps`/`asesor_perfil` → **monitor**/**accion** (mensajes) y **researcher** (propuestas) y **observacion** (preguntas). La reacción del asesor/supervisor vuelve a `behavioral_signals` → **analyzer** (lazo cerrado).

---

## 3. Conexiones DESDE FUERA

**Crons** (según comentario de cabecera de cada función; las definiciones reales de `cron.job` **no están en el repo** — `proxis-cerebro` referencia los jobnames `proxis-monitor`, `proxis-analyzer-weekly`, `proxis-cerebro-diario`):
| Función | Cron (cabecera) | [tipo] |
|---|---|---|
| proxis-signals | `0 6 * * *` (diario 06:00 UTC → 03:00 Chile) | [CRON] |
| proxis-monitor | `0 8 * * 1,3` (lun y mié) — pasada principal | [CRON] |
| proxis-monitor | modo `{only_reminders:true}` "pensado para cron diario" — **cron no encontrado en código** | [CRON?] |
| proxis-analyzer | `0 22 * * 0` (domingo 22:00 UTC) | [CRON] |
| proxis-cerebro | `0 9 * * *` (diario 09:00 UTC → 06:00 Chile) | [CRON] |
| proxis-observacion | sin cron | — |
| proxis-researcher | sin cron | — |
| proxis-accion | sin cron | — |

**Desde la capa Next.js (`src/`):**
| Función | Invocada por | Payload | Disparo | [tipo] |
|---|---|---|---|---|
| proxis-observacion | `GET /api/equipo/observacion` (portal equipo, `verifyEquipoToken`) | `{ asesor }` | supervisor abre/expande un asesor | [HTTP] |
| proxis-analyzer | `POST /api/admin/procesar-senales` | `{ triggered_by:'admin-senales' }` | admin "Procesar ahora" | [MANUAL] |
| proxis-researcher | `POST /api/admin/knowledge/investigar-gap` (marca gap→en_investigacion, luego `?gap_id`); y fetch directo desde `/admin/hipotesis` (page.tsx:190) | `?gap_id=…` | admin "Investigar" | [MANUAL] |
| proxis-accion | `POST /api/admin/ejecutar-accion` | `{ deduction_id }` | admin "Ejecutar acción" (`/admin/hipotesis`) | [MANUAL] |
| proxis-cerebro | `POST /api/admin/canarios` | `{ run_canaries:true, triggered_by:'admin-canarios' }` | admin "Correr canarios" | [MANUAL] |

**Sin invocación desde `src/` (no encontrada en código):** `proxis-monitor` y `proxis-signals` (solo cron / canario A2). `proxis-informes` (solo canario A8). `/api/admin/status` solo **lee** `cron.job` por nombre, no invoca.

**Salidas externas:** emails vía Resend (asesor, supervisor, admin `ADMIN_EMAIL`), mensajes en `sailor_messages` (app Sailor), notificaciones al panel `/admin`.

---

## 4. Línea de tiempo semanal (horarios UTC; entre paréntesis Chile UTC-3)

```
DOM  22:00 (19:00)  proxis-analyzer   [CRON]  señales → hipótesis
LUN  06:00 (03:00)  proxis-signals    [CRON]  bitácora → señales
     08:00 (05:00)  proxis-monitor    [CRON]  pasada principal (triggers → mensajes)
     09:00 (06:00)  proxis-cerebro    [CRON]  salud + auto-reparaciones
MAR  06:00          proxis-signals    [CRON]
     09:00          proxis-cerebro    [CRON]
MIÉ  06:00          proxis-signals    [CRON]
     08:00          proxis-monitor    [CRON]  pasada principal
     09:00          proxis-cerebro    [CRON]
JUE  06:00          proxis-signals    [CRON]
     09:00          proxis-cerebro    [CRON]
VIE  06:00          proxis-signals    [CRON]
     09:00          proxis-cerebro    [CRON]
SÁB  06:00          proxis-signals    [CRON]
     09:00          proxis-cerebro    [CRON]

DIARIO sin horario en código: proxis-monitor {only_reminders} (recordatorios TPS / sin-valorar) — cron no encontrado
ON-DEMAND (cualquier momento): proxis-observacion [HTTP] · proxis-analyzer/researcher/accion [MANUAL] · proxis-cerebro {run_canaries} [MANUAL]
```

> `proxis-signals` (lun) escribe señales **antes** del `proxis-monitor` (lun 08:00) y del `proxis-analyzer` que corrió la noche del domingo: el orden semanal es analyzer (dom) → signals (lun 06) → monitor (lun 08). No hay garantía de orden inferida más allá de las horas declaradas.

---

## 5. Diagrama ASCII del pipeline

```
 ENTRADAS                          FUNCIONES                       TABLAS PUENTE                 SALIDAS
─────────────────────────────────────────────────────────────────────────────────────────────────────────

 bitácora real            ┌────────────────────┐
 (reportes, contactos, ──▶│ proxis-signals[CRON]│──▶ behavioral_signals ─┐
  ingresos, metas)        └────────────────────┘    (procesada=false)    │
                                                                          ▼
 supervisor (portal)      ┌──────────────────────┐                ┌───────────────────────┐
   GET /api/equipo/  ────▶│ proxis-observacion   │   pregunta ──▶ │  proxis-analyzer[CRON] │
   observacion [HTTP]     │ [HTTP]               │   (al portal)  │  (+[HTTP] admin/canary)│
                          └──────────────────────┘                └───────────┬───────────┘
   respuesta supervisor ─────────▶ behavioral_signals(fuente='supervisor') ───┘   │
                                                                                   │ escribe
              ┌────────────────────────────────────────────────────────────┬──────┴──────┬───────────────┐
              ▼                                ▼                             ▼             ▼               ▼
       deductions_log                   knowledge_gaps               asesor_perfil   tps_perfiles   trigger_efectividad
        (hipótesis)                          │                       (riesgo/prog.)        │
          │   │   │                          ▼                             │              │
          │   │   │                 ┌───────────────────────┐              │              │
          │   │   │   admin ───────▶│ proxis-researcher      │──▶ knowledge_proposals ──▶ (aprob. humana)
          │   │   │  "Investigar"   │ [MANUAL]               │                      └─▶ knowledge_base_conductual
          │   │   │   [MANUAL]      └───────────────────────┘
          │   │   │
          │   │   └───────────────▶┌───────────────────────┐
          │   │   admin "Ejecutar  │ proxis-accion [MANUAL] │──▶ email asesor/supervisor + sailor_messages
          │   │   acción"          └───────────────────────┘    + message_log (hipotesis-accion/-escalar)
          │   │
          │   └────(count)────▶ proxis-signals  (señal hipotesis_acumuladas)
          ▼
   ┌────────────────────┐
   │ proxis-monitor     │  lee metas/reportes/contactos/ingresos/perfil/tps/deductions/prompts…
   │ [CRON lun+mié]     │──▶ message_log + sailor_messages + trigger_efectividad
   └────────────────────┘──▶ EMAIL asesor (coaching) · EMAIL supervisor (doble disparo) · EMAIL admin (internos)
                          └─▶ behavioral_signals (burnout / pregunta_enviada)  ──┐ (re-alimenta analyzer)
                                                                                 │
   reacción del asesor/supervisor ───────────▶ behavioral_signals ◀─────────────┘  (LAZO CERRADO)

 ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
 │ proxis-cerebro [CRON diario 09:00]  — supervisa todo lo anterior (no produce coaching)          │
 │  · lee ~21 tablas (signals, deductions, message_log, error_log, gemini_usage, cron.job, …)      │
 │  · escribe system_health_log · repair_log · canary_log · error_log                              │
 │  · AUTO-REPARA → invoca proxis-analyzer [HTTP] {triggered_by:auto-repair}                        │
 │                → inserta tps_perfiles/metas default, marca behavioral_signals, resetea gaps      │
 │  · [MANUAL] {run_canaries} → invoca signals/analyzer/researcher/observacion/accion/informes      │
 │  · SALIDA: EMAIL de salud a ADMIN_EMAIL                                                          │
 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Constataciones (no inferencias):** el único actor que llama a otras funciones por HTTP es `proxis-cerebro` (auto-repair + canarios). Los enlaces "normales" del pipeline son **por tabla**, no por llamada directa. `proxis-monitor` y `proxis-signals` no se invocan desde `src/`. Los horarios de cron salen de comentarios de cabecera; las definiciones reales de `cron.job` y el cron diario de recordatorios de `proxis-monitor` **no están en el código del repo**.
