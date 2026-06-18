-- Reconciliación 2a — Dimensión tps_c_adapt en preguntas (Equilibrio Adaptativo)
-- 1) Reasignaciones de ítems existentes (idempotentes: re-aplicar deja igual valor).
-- 2) Seed de los 7 ítems AD (orden 58-64) con guarda WHERE NOT EXISTS por
--    (cuestionario_id, orden) — `preguntas` no tiene UNIQUE, ON CONFLICT no aplica.
-- Cuestionario destino: 849848b4-7be4-4e0c-8702-b22843b1adfb
-- Cierra brecha repo↔base. UTF-8 limpio.

-- ── 1) Reasignaciones (idempotentes por naturaleza) ─────────────────────────
-- C06 → tps_c_adapt
UPDATE preguntas SET dimension_target = 'tps_c_adapt'
  WHERE id = '12b99ddd-d810-45fa-a3f3-73853b4387f1';
-- C09 → tps_c_f5
UPDATE preguntas SET dimension_target = 'tps_c_f5'
  WHERE id = '5f1d0e41-be02-4e48-a484-2e9ceea88a96';

-- ── 2) Seed AD01-AD07 (orden 58-64). Guarda: no inserta si ya existe el orden ─
-- C06 (orden 30) NO se re-inserta: ya existe y se reasigna arriba vía UPDATE.

INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones)
SELECT '849848b4-7be4-4e0c-8702-b22843b1adfb', 58,
       'Cuando noto a mitad de reunión que mi forma de explicar no está conectando con el cliente, cambio de enfoque sobre la marcha.',
       'escala_5', 'tps_c_adapt', '+', '{"negativo": false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM preguntas
  WHERE cuestionario_id = '849848b4-7be4-4e0c-8702-b22843b1adfb' AND orden = 58);

INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones)
SELECT '849848b4-7be4-4e0c-8702-b22843b1adfb', 59,
       'Me cuesta cambiar mi manera de presentar una vez que ya empecé con un cliente.',
       'escala_5', 'tps_c_adapt', '-', '{"negativo": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM preguntas
  WHERE cuestionario_id = '849848b4-7be4-4e0c-8702-b22843b1adfb' AND orden = 59);

INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones)
SELECT '849848b4-7be4-4e0c-8702-b22843b1adfb', 60,
       'Con un cliente que pide datos y cifras uso un estilo distinto del que uso con uno que prefiere conversar y conocerme primero.',
       'escala_5', 'tps_c_adapt', '+', '{"negativo": false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM preguntas
  WHERE cuestionario_id = '849848b4-7be4-4e0c-8702-b22843b1adfb' AND orden = 60);

INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones)
SELECT '849848b4-7be4-4e0c-8702-b22843b1adfb', 61,
       'Tiendo a usar el mismo método de venta que mejor me funciona, sin importar cómo sea el cliente.',
       'escala_5', 'tps_c_adapt', '-', '{"negativo": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM preguntas
  WHERE cuestionario_id = '849848b4-7be4-4e0c-8702-b22843b1adfb' AND orden = 61);

INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones)
SELECT '849848b4-7be4-4e0c-8702-b22843b1adfb', 62,
       'Antes o al inicio de una reunión, busco señales de cómo es el cliente (cómo habla, qué prioriza) para decidir cómo encararlo.',
       'escala_5', 'tps_c_adapt', '+', '{"negativo": false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM preguntas
  WHERE cuestionario_id = '849848b4-7be4-4e0c-8702-b22843b1adfb' AND orden = 62);

INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones)
SELECT '849848b4-7be4-4e0c-8702-b22843b1adfb', 63,
       'La última vez que un cliente no respondió bien a mi forma de presentar, probé un enfoque diferente en vez de insistir con el mismo.',
       'escala_5', 'tps_c_adapt', '+', '{"negativo": false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM preguntas
  WHERE cuestionario_id = '849848b4-7be4-4e0c-8702-b22843b1adfb' AND orden = 63);

INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones)
SELECT '849848b4-7be4-4e0c-8702-b22843b1adfb', 64,
       'Tengo básicamente una sola forma de vender, y me siento incómodo saliéndome de ella.',
       'escala_5', 'tps_c_adapt', '-', '{"negativo": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM preguntas
  WHERE cuestionario_id = '849848b4-7be4-4e0c-8702-b22843b1adfb' AND orden = 64);
