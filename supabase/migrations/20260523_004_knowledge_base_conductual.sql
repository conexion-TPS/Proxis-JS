-- Fase 2.1 — Base de conocimiento conductual estructurada
-- Contiene el corpus Merrill-Reid + TPS + ciclo de 7 pasos + Sales DNA

CREATE TABLE IF NOT EXISTS knowledge_base_conductual (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil            text CHECK (perfil IN ('Energético','Sociable','Relacional','Reflexivo','Integrador','General')),
  categoria         text CHECK (categoria IN (
                      'fortaleza','debilidad','tactica_cliente','ciclo_7pasos',
                      'backup_style','colision_espejo','diagnostico_perceptual',
                      'cierre','pregunta_interna','sales_dna','ruta_desarrollo',
                      'variable_situacional','protocolo_intervención'
                    )),
  etapa_ciclo       text CHECK (etapa_ciclo IN (
                      'prospeccion','pre_contacto','acercamiento','presentacion',
                      'objeciones','cierre','seguimiento'
                    ) OR etapa_ciclo IS NULL),
  contexto          text,                        -- escenario específico de aplicación
  contenido         text NOT NULL,               -- el conocimiento en sí
  regla_inferencia  text,                        -- si X entonces Y — para que la IA razone
  accion_correctiva text,                        -- qué debería hacer el asesor
  fuente            text,                        -- libro, documento interno, experiencia de campo
  completitud       int DEFAULT 50 CHECK (completitud BETWEEN 0 AND 100),
  tags              text[],
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kbc_perfil ON knowledge_base_conductual (perfil);
CREATE INDEX IF NOT EXISTS idx_kbc_categoria ON knowledge_base_conductual (categoria);
CREATE INDEX IF NOT EXISTS idx_kbc_etapa ON knowledge_base_conductual (etapa_ciclo);
