-- ============================================================================
-- F2d — Activar el recordatorio mensual de captura de ingreso (trigger_config).
-- Proyecto: proxis_dev (mkqgbmwmvypcjzlxidsm). Lo ejecuta TPS. Idempotente.
-- El disparo vive en proxis-monitor (procesarCapturaIngresoMensual): el primer lunes,
-- emaila a cada supervisor con asesores sin el ingreso de M-1 informado. Este INSERT solo
-- registra/activa el trigger (igual que los demás de trigger_config).
-- ============================================================================

INSERT INTO trigger_config (trigger_id, activo, cooldown_dias, descripcion, asunto)
SELECT
  'captura-ingreso-mensual',
  true,
  20,
  'Recordatorio al supervisor (primer lunes) para informar el ingreso del mes cerrado de su equipo.',
  'Cierre de mes: informa el ingreso de tu equipo'
WHERE NOT EXISTS (
  SELECT 1 FROM trigger_config WHERE trigger_id = 'captura-ingreso-mensual'
);

-- ── VERIFICACIÓN ──
-- SELECT trigger_id, activo, cooldown_dias FROM trigger_config WHERE trigger_id = 'captura-ingreso-mensual';

-- ── REVERSIÓN ──
-- DELETE FROM trigger_config WHERE trigger_id = 'captura-ingreso-mensual';
