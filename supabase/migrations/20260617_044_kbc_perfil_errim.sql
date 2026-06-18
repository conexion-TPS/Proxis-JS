-- Reconciliación 2b — CHECK de knowledge_base_conductual.perfil a ERRIM plano
-- El filtro de perfil de analyzer/researcher ahora compara contra id_tipo ERRIM
-- (energetico/reflexivo/relacional/magnetico/integrador/general), traducido vía
-- tipo_catalogo. Reemplaza el CHECK viejo (palabras acentuadas Merrill-Reid).
-- Cierra brecha repo↔base. Idempotente. UTF-8 limpio (sin el carácter corrupto
-- que tenía el CHECK viejo de 'protocolo_intervención' / perfil).

ALTER TABLE knowledge_base_conductual
  DROP CONSTRAINT IF EXISTS knowledge_base_conductual_perfil_check;

ALTER TABLE knowledge_base_conductual
  ADD CONSTRAINT knowledge_base_conductual_perfil_check
    CHECK (perfil IN ('energetico','reflexivo','relacional','magnetico','integrador','general'));
