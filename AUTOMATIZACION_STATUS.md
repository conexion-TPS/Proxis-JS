# AUTOMATIZACION_STATUS — Compromisos legales (Ley N° 21.719)

Estado de los 17 compromisos legales automatizados (spec doc 7, Fase 2).
Generado: 2026-06-02. Repo frontend/API: `conexion-TPS/Proxis-JS` (proxis-next).
Migraciones/funciones SQL: `Proxis-main` (aplicadas a dev por Management API).

Base transversal:
- **Log legal centralizado**: tabla `legal_event_log` + helper `logLegalEvent()` en [src/lib/legal.ts](src/lib/legal.ts) (calcula `chain_hash` encadenado; nunca lanza).
- **Hashing**: `sha256()` / `hashIp()` — ningún ID ni IP en texto plano en los logs.
- **Días hábiles chilenos**: `calcular_dias_habiles()` (SQL) + `businessDaysBetween()` / `addChileanBusinessDays()` (JS) sobre la tabla `feriados_chile` (editable; equivale a `chilean_holidays`).

---

## Ítem 1 — Envío de copia de Términos al aceptar
Estado: NUEVO
Ubicación: [src/app/api/legal/route.ts](src/app/api/legal/route.ts) `POST` → `sendLegalEmail()`; enlace estable [src/app/legal/[tipo]/page.tsx](src/app/legal/[tipo]/page.tsx)
Cron: —
Notas: envía copia con enlace estable a la versión exacta antes de cerrar el registro; loguea `TERMS_COPY_SENT`.

## Ítem 2 — Registro auditable de consentimiento
Estado: IMPLEMENTADO (reforzado)
Ubicación: [src/app/api/privacy/consent/route.ts](src/app/api/privacy/consent/route.ts) `POST`; tabla `consentimiento_historial` + `legal_event_log`
Cron: —
Notas: `actor_id_hash` (SHA-256 del asesor) e `ip_hash` en metadata; opción A/B, GRANT/REVOKE, versión y canal. Casillas no premarcadas en Sailor ([app/perfil/page.tsx](../sailor-front/app/perfil/page.tsx) `ConsentRow`, default off).

## Ítem 3 — Anonimización irreversible al solicitar baja
Estado: IMPLEMENTADO
Ubicación: RPC `anonimizar_asesor()` (transacción atómica, Proxis-main migr 049/050) invocado desde [src/app/api/privacy/delete-account/route.ts](src/app/api/privacy/delete-account/route.ts)
Cron: —
Notas: esquema real → el nexo es el texto `asesor`. `anonymized_profiles` SIN FK a identidad; borra ~18 tablas + identidad; conserva `legal_aceptaciones` (retención legal). Rollback automático si falla. Logs `ACCOUNT_DELETION_REQUESTED` + `ANONYMIZATION_COMPLETED`/`FAILED`.

## Ítem 4 — Log de auditoría inmutable por anonimización
Estado: IMPLEMENTADO
Ubicación: tabla `anonymization_audit_log` (RLS insert-only) escrita dentro de `anonimizar_asesor()`
Cron: —
Notas: `event_hash = sha256(asesor||ts||'ANONYMIZATION')` (el id original no se almacena), `verification_checksum`, `reidentification_check`. RLS sin UPDATE/DELETE (verificado: anon UPDATE/DELETE → 0 filas).

## Ítem 5 — Email de confirmación tras anonimización
Estado: IMPLEMENTADO
Ubicación: `sendEliminacionCuenta()` en [src/lib/resend.ts](src/lib/resend.ts), llamado tras completar el proceso
Cron: —
Notas: email capturado ANTES del borrado; incluye qué se suprimió/anonimizó y el `event_hash`.

## Ítem 6 — Procesamiento de revocaciones de consentimiento
Estado: IMPLEMENTADO
Ubicación: [src/app/api/privacy/consent/route.ts](src/app/api/privacy/consent/route.ts) `POST` (estado=revocado)
Cron: —
Notas: nuevo registro REVOKE (no modifica anteriores) + flag inmediato en `asesor_credentials` + email de confirmación + `CONSENT_REVOKED`.

## Ítem 7 — Alerta al admin por fallo de anonimización
Estado: IMPLEMENTADO
Ubicación: [src/app/api/privacy/delete-account/route.ts](src/app/api/privacy/delete-account/route.ts) (rama de error)
Cron: —
Notas: audit `FAILED` + `ANONYMIZATION_FAILED`/`VERIFICATION_FAILED` + email al admin (`PRIVACY_ADMIN_EMAIL`) + solicitud `pendiente` (PENDING_RETRY). Badge de fallos en el panel B.

## Ítem 8 — Notificación de cambios de subencargados
Estado: NUEVO
Ubicación: [src/app/api/admin/privacy/subprocessors/route.ts](src/app/api/admin/privacy/subprocessors/route.ts); tabla `subencargados`
Cron: —
Notas: vigencia = +15 días hábiles; email a clientes (piloto: canal de privacidad) con derecho a objetar; `SUBPROCESSOR_CHANGE_NOTIFIED`. UI de panel pendiente (API operativa).

## Ítem 9 — Certificación de supresión al término de contrato
Estado: NUEVO
Ubicación: [src/app/api/admin/privacy/contract-termination/route.ts](src/app/api/admin/privacy/contract-termination/route.ts)
Cron: —
Notas: anonimiza a todos los asesores de la institución (loop `anonimizar_asesor`), genera certificación con hash y datos de Futura, email al contacto; `CONTRACT_TERMINATED` + `SUPPRESSION_CERTIFIED`. PDF = impresión de la certificación.

## Ítem 10 — Registro de brecha con contador de 72 horas
Estado: IMPLEMENTADO
Ubicación: [src/app/api/admin/privacy/breaches/route.ts](src/app/api/admin/privacy/breaches/route.ts) + panel E [src/app/admin/privacy/page.tsx](src/app/admin/privacy/page.tsx)
Cron: —
Notas: contador 72h (verde>48 / amarillo 24-48 / rojo<24) en el dashboard; email al registrar; `SECURITY_BREACH_REGISTERED` (CRITICAL), `BREACH_NOTIFIED_APDP` al notificar.

## Ítem 11 — Seguimiento plazo ARCOP+ (30 días hábiles)
Estado: NUEVO
Ubicación: [src/app/api/cron/legal-daily/route.ts](src/app/api/cron/legal-daily/route.ts)
Cron: `1 0 * * *` (consolidado)
Notas: recalcula y persiste `days_remaining` por solicitud abierta; el panel A muestra semáforo.

## Ítem 12 — Alerta de vencimiento próximo ARCOP+
Estado: NUEVO
Ubicación: [src/app/api/cron/legal-daily/route.ts](src/app/api/cron/legal-daily/route.ts)
Cron: `1 0 * * *`
Notas: ≤8 días hábiles → email al responsable; ≤3 → escala al admin; log riesgo HIGH.

## Ítem 13 — Solicitud ARCOP+ vencida sin resolución
Estado: NUEVO
Ubicación: [src/app/api/cron/legal-daily/route.ts](src/app/api/cron/legal-daily/route.ts)
Cron: `1 0 * * *`
Notas: `days_remaining < 0` → `ARCOP_REQUEST_OVERDUE` (CRITICAL) + email crítico; no exime de resolver.

## Ítem 14 — Recordatorio anual de aceptación (supervisores)
Estado: NUEVO
Ubicación: [src/app/api/cron/legal-daily/route.ts](src/app/api/cron/legal-daily/route.ts); columnas `org_usuarios.ultima_aceptacion_at` / `acceso_bloqueado`
Cron: `1 0 * * *`
Notas: última aceptación >365d → email; >380d → `acceso_bloqueado=true` + `SUPERVISOR_REACCEPTANCE`. La marca se refresca en `/api/legal` al aceptar.

## Ítem 15 — Notificación de cambios en Términos (15 días hábiles)
Estado: NUEVO
Ubicación: [src/app/api/admin/privacy/publish-terms/route.ts](src/app/api/admin/privacy/publish-terms/route.ts); UI [src/app/admin/legal/page.tsx](src/app/admin/legal/page.tsx) `publicar()`
Cron: —
Notas: resumen de cambios obligatorio; vigencia = +15 días hábiles; email a usuarios; `TERMS_VERSION_PUBLISHED` + `TERMS_CHANGE_NOTIFIED`. (Refinamiento futuro: que el LegalGate respete `vigente_desde` para activación diferida; hoy la aceptación se exige de inmediato, criterio más estricto.)

## Ítem 16 — Verificación de no-reidentificación
Estado: IMPLEMENTADO
Ubicación: dentro de `anonimizar_asesor()` (chequeo multi-tabla de residuo) + logs `VERIFICATION_PASSED`/`FAILED`
Cron: —
Notas: suma de residuos en behavioral_signals, message_log, asesor_perfil, tps_perfiles, asesor_credentials → si >0, RAISE EXCEPTION (rollback). `reidentification_check` queda en el audit.

## Ítem 17 — Log legal centralizado y reportes
Estado: NUEVO
Ubicación: tabla `legal_event_log` (RLS insert-only, sin SELECT/UPDATE/DELETE para anon — verificado); helper [src/lib/legal.ts](src/lib/legal.ts) `logLegalEvent()`; endpoint [src/app/api/admin/privacy/audit-report/route.ts](src/app/api/admin/privacy/audit-report/route.ts)
Cron: —
Notas: `chain_hash` encadenado por inserción; conectado a los 16 ítems. Endpoint restringido por `x-admin-key`, filtros fecha/tipo, métricas del período, salida JSON o HTML imprimible (PDF), y se auto-registra (`AUDIT_REPORT_GENERATED`). Botón en el panel C.

---

## Verificación global

FASE 1 — Documentos legales:
- [x] "Proxis" no es sujeto jurídico en ningún documento
- [x] Preámbulo con distinción Futura/Proxis en los 6 archivos
- [x] Sin variantes de "estilos de venta"
- [x] Sin taxonomía interna del método TPS expuesta
- [x] Encabezados y nombres de producto intactos

FASE 2 — Automatización:
- [x] Los 17 ítems implementados o verificados
- [x] `legal_event_log` con RLS correcta (sin UPDATE/DELETE; sin SELECT para anon)
- [x] `logLegalEvent()` conectado a todos los ítems
- [x] `anonymization_audit_log` con RLS insert-only
- [x] `anonymized_profiles` sin FK hacia identidad
- [x] Cron consolidado registrado en `vercel.json` (ítems 11-14) — `1 0 * * *`
- [x] Endpoint `/api/admin/privacy/audit-report` operativo
- [x] `calcular_dias_habiles()` / `businessDaysBetween()` implementadas (feriados chilenos)
- [x] Sin PII en texto plano en los logs (IDs e IP hasheados con SHA-256)
- [x] `chain_hash` calculado en cada inserción
- [x] `AUTOMATIZACION_STATUS.md` generado

## Pendientes / deuda explícita
- Validación por abogado(a) habilitado(a) antes de uso productivo.
- RBAC real ADMIN/PRIVACY_OFFICER + middleware (hoy gate por clave admin; `audit-report` exige `x-admin-key`). Atado a pendiente de seguridad #3.
- Notificación de subencargados/términos a "empresas cliente": en el piloto va al canal de privacidad; producción requiere contactos de privacidad por institución.
- `CRON_SECRET` opcional para proteger `/api/cron/legal-daily` (hoy permitido si no está seteado, igual que el resto del proyecto).
- Migraciones 043/049/050 + RPC: aplicar a prod al promover.
