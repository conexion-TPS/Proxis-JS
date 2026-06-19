-- Reconciliación 2b (esquema) — knowledge_base_conductual: escenario + CHECKs ampliados
-- Habilita el corpus MTPSCV (escenarios contacto/prospecto/cliente/supervisor,
-- categoria 'interaccion_tipos', etapa_ciclo 'coaching'). Idempotente/defensiva.
-- Reproduce el estado vivo de mkqgbmwm. UTF-8 limpio (mantiene 'protocolo_intervención').
-- Debe correr ANTES de los seeds 047-050.

-- 1) Columna escenario
ALTER TABLE knowledge_base_conductual ADD COLUMN IF NOT EXISTS escenario text;

ALTER TABLE knowledge_base_conductual
  DROP CONSTRAINT IF EXISTS knowledge_base_conductual_escenario_check;
ALTER TABLE knowledge_base_conductual
  ADD CONSTRAINT knowledge_base_conductual_escenario_check
    CHECK (escenario IN ('contacto','prospecto','cliente','supervisor') OR escenario IS NULL);

-- 2) categoria: 13 originales + 'interaccion_tipos'
ALTER TABLE knowledge_base_conductual
  DROP CONSTRAINT IF EXISTS knowledge_base_conductual_categoria_check;
ALTER TABLE knowledge_base_conductual
  ADD CONSTRAINT knowledge_base_conductual_categoria_check
    CHECK (categoria IN (
      'fortaleza','debilidad','tactica_cliente','ciclo_7pasos',
      'backup_style','colision_espejo','diagnostico_perceptual',
      'cierre','pregunta_interna','sales_dna','ruta_desarrollo',
      'variable_situacional','protocolo_intervención','interaccion_tipos'
    ));

-- 3) etapa_ciclo: 7 originales + 'coaching'
ALTER TABLE knowledge_base_conductual
  DROP CONSTRAINT IF EXISTS knowledge_base_conductual_etapa_ciclo_check;
ALTER TABLE knowledge_base_conductual
  ADD CONSTRAINT knowledge_base_conductual_etapa_ciclo_check
    CHECK (etapa_ciclo IN (
      'prospeccion','pre_contacto','acercamiento','presentacion',
      'objeciones','cierre','seguimiento','coaching'
    ) OR etapa_ciclo IS NULL);
