-- Fase 6: Columna eje + cuestionarios onboarding y micro
-- Idempotente

-- 1. Columna eje en preguntas (assertividad | sociabilidad | null)
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS eje text;

-- 2. Cuestionario de onboarding corto (14 ítems SJT)
DO $$
DECLARE q_ob uuid;
DECLARE q_mc uuid;
BEGIN

  /* ── Onboarding ──────────────────────────────────────────────────── */
  IF EXISTS (SELECT 1 FROM cuestionarios WHERE nombre = 'Onboarding TPS — Estilo comercial') THEN
    RAISE NOTICE 'Onboarding ya sembrado. Saltando.';
  ELSE

    INSERT INTO cuestionarios (nombre, tipo, descripcion, activo) VALUES (
      'Onboarding TPS — Estilo comercial',
      'onboarding',
      '14 preguntas de estilo comercial (7 iniciativa + 7 calidez). Produce perfil Merrill-Reid inicial.',
      true
    ) RETURNING id INTO q_ob;

    -- Eje assertividad (7 ítems, escala 1-4 de bajo a alto)
    INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, eje, opciones) VALUES

    (q_ob, 1,
     'Cuando entras a una primera reunión de negocios, ¿qué haces primero?',
     'escala_4', 'perfil_conductual_notas', null, 'assertividad',
     '{"labels": ["Escucho y espero que la otra persona tome la iniciativa", "Hago preguntas para entender la situación", "Propongo el tema y voy midiendo la respuesta", "Tomo la iniciativa y conduzco la reunión desde el comienzo"]}'::jsonb),

    (q_ob, 2,
     'Un proceso de negociación lleva semanas sin avanzar. ¿Qué haces?',
     'escala_4', 'perfil_conductual_notas', null, 'assertividad',
     '{"labels": ["Espero a que la otra parte retome el contacto", "Envío un mensaje consultando cómo siguen", "Propongo concretamente una reunión para destrabar", "Pongo un plazo claro y lo comunico directamente"]}'::jsonb),

    (q_ob, 3,
     'Al trabajar en equipo, ¿qué rol asumes más fácilmente?',
     'escala_4', 'perfil_conductual_notas', null, 'assertividad',
     '{"labels": ["Apoyo las decisiones del grupo sin cuestionar", "Aporto ideas cuando me lo piden", "Propongo alternativas y busco consenso", "Tomo el liderazgo y propongo la dirección"]}'::jsonb),

    (q_ob, 4,
     'Cuando tienes una idea que crees que puede mejorar algo, ¿qué haces?',
     'escala_4', 'perfil_conductual_notas', null, 'assertividad',
     '{"labels": ["La guardo hasta estar muy seguro/a", "La comparto solo si alguien me pregunta", "La menciono con cuidado buscando feedback", "La comparto de inmediato sin necesidad de aprobación previa"]}'::jsonb),

    (q_ob, 5,
     'En una negociación donde el otro lado presiona, ¿cuál es tu postura natural?',
     'escala_4', 'perfil_conductual_notas', null, 'assertividad',
     '{"labels": ["Tiendo a ceder para mantener la relación", "Busco un punto medio que funcione para todos", "Mantengo mis condiciones pero con apertura al diálogo", "Mantengo mi posición hasta lograr lo que necesito"]}'::jsonb),

    (q_ob, 6,
     '¿Al final de una reunión, quién suele proponer el próximo paso?',
     'escala_4', 'perfil_conductual_notas', null, 'assertividad',
     '{"labels": ["La otra persona casi siempre lo propone", "Generalmente esperamos que surja naturalmente", "Yo lo propongo cuando parece el momento correcto", "Soy yo quien concluye con un próximo paso concreto"]}'::jsonb),

    (q_ob, 7,
     'Cuando ves que alguien está tomando una decisión que consideras equivocada, ¿qué haces?',
     'escala_4', 'perfil_conductual_notas', null, 'assertividad',
     '{"labels": ["Me adapto a la decisión sin comentar", "Lo menciono solo si me preguntan", "Comparto mi punto de vista con tacto", "Lo señalo directamente aunque no sea bienvenido"]}'::jsonb),

    -- Eje sociabilidad (7 ítems, escala 1-4 de bajo a alto)

    (q_ob, 8,
     'Al conocer a alguien nuevo por trabajo, ¿qué te interesa saber primero?',
     'escala_4', 'perfil_conductual_notas', null, 'sociabilidad',
     '{"labels": ["Qué hace y qué resultados busca", "Su experiencia y trayectoria profesional", "Su contexto y qué lo motivó a tomar la reunión", "Cómo es como persona, más allá del rol profesional"]}'::jsonb),

    (q_ob, 9,
     '¿Cómo describes tu relación ideal con tus clientes?',
     'escala_4', 'perfil_conductual_notas', null, 'sociabilidad',
     '{"labels": ["Clara y profesional: cada uno en su rol", "Cordial y respetuosa, con límites definidos", "Cercana, con espacio para lo personal", "Como una amistad genuina que también es negocio"]}'::jsonb),

    (q_ob, 10,
     'Al escribir un mensaje de seguimiento a un cliente, ¿qué estilo prefieres?',
     'escala_4', 'perfil_conductual_notas', null, 'sociabilidad',
     '{"labels": ["Breve y directo al punto del negocio", "Breve pero con un saludo cordial", "Con algo personal antes del motivo del mensaje", "Con tono cálido, como una conversación entre conocidos"]}'::jsonb),

    (q_ob, 11,
     'Cuando un cliente o colega está pasando por un momento difícil personal, ¿qué haces?',
     'escala_4', 'perfil_conductual_notas', null, 'sociabilidad',
     '{"labels": ["Me enfoco en resolver el problema concreto", "Reconozco la situación y ofrezco apoyo si lo necesitan", "Pregunto cómo está y dejo espacio para que hable", "Me involucro genuinamente y lo acompaño en el proceso"]}'::jsonb),

    (q_ob, 12,
     '¿Cómo tomas decisiones importantes en el trabajo?',
     'escala_4', 'perfil_conductual_notas', null, 'sociabilidad',
     '{"labels": ["Con datos, análisis y hechos concretos", "Combinando datos con experiencia pasada", "Balanceando los números con mi lectura de las personas", "Confiando principalmente en mi intuición sobre las personas"]}'::jsonb),

    (q_ob, 13,
     'En una conversación de trabajo que se prolonga y se vuelve más personal, ¿qué sientes?',
     'escala_4', 'perfil_conductual_notas', null, 'sociabilidad',
     '{"labels": ["Prefiero redirigirla al tema de trabajo", "La acepto pero busco volver al punto", "La disfruto, me ayuda a conectar mejor", "La valoro mucho, así es como construyo confianza"]}'::jsonb),

    (q_ob, 14,
     '¿Cómo prefieres motivar a otras personas?',
     'escala_4', 'perfil_conductual_notas', null, 'sociabilidad',
     '{"labels": ["Con metas claras y métricas de desempeño", "Con reconocimiento de logros concretos", "Con feedback personalizado y espacio para crecer", "Con conexión personal y cuidando cómo se sienten"]}'::jsonb);

    RAISE NOTICE 'Onboarding cuestionario creado: %', q_ob;
  END IF;

  /* ── Micro-cuestionario ──────────────────────────────────────────── */
  IF EXISTS (SELECT 1 FROM cuestionarios WHERE nombre = 'Micro-preguntas TPS') THEN
    RAISE NOTICE 'Micro cuestionario ya sembrado. Saltando.';
  ELSE

    INSERT INTO cuestionarios (nombre, tipo, descripcion, activo) VALUES (
      'Micro-preguntas TPS',
      'micro',
      '15 preguntas cortas para captura inmanente. 3 por dimensión del perfil.',
      true
    ) RETURNING id INTO q_mc;

    INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, opciones) VALUES

    -- identidad_vendedora (3 ítems)
    (q_mc, 1,
     '¿Cuándo fue la última vez que sentiste que "eres bueno en esto" de vender?',
     'alternativas', 'identidad_vendedora',
     '{"items": [{"valor": "esta_semana", "label": "Esta semana"}, {"valor": "hace_tiempo", "label": "Hace varias semanas"}, {"valor": "no_recuerdo", "label": "No lo recuerdo bien"}]}'::jsonb),

    (q_mc, 2,
     'Cuando alguien te pregunta a qué te dedicas, ¿cómo te describes a ti mismo?',
     'alternativas', 'identidad_vendedora',
     '{"items": [{"valor": "vendedor", "label": "Soy vendedor/asesor de ventas"}, {"valor": "ayudo", "label": "Ayudo a las personas a tomar buenas decisiones"}, {"valor": "otro", "label": "Uso una descripción diferente según el contexto"}]}'::jsonb),

    (q_mc, 3,
     '¿Te identificas con la idea de que "las ventas son una profesión"?',
     'si_no', 'identidad_vendedora', null),

    -- relacion_prospeccion (3 ítems)
    (q_mc, 4,
     '¿Cómo describirías tu relación con la prospección esta semana?',
     'alternativas', 'relacion_prospeccion',
     '{"items": [{"valor": "fluida", "label": "Fluida — contacté sin pensarlo demasiado"}, {"valor": "forzada", "label": "Forzada — me costó pero lo hice"}, {"valor": "evitada", "label": "La evité más de lo que debería"}]}'::jsonb),

    (q_mc, 5,
     'Cuando piensas en contactar a alguien que no te conoce, ¿qué sientes primero?',
     'alternativas', 'relacion_prospeccion',
     '{"items": [{"valor": "curiosidad", "label": "Curiosidad — me pregunto cómo será"}, {"valor": "tension", "label": "Tensión — preferiría no tener que hacerlo"}, {"valor": "neutro", "label": "Neutral — es parte del trabajo"}]}'::jsonb),

    (q_mc, 6,
     '¿Has tenido contacto con un prospecto nuevo en los últimos 3 días hábiles?',
     'si_no', 'relacion_prospeccion', null),

    -- modelos_mentales (3 ítems)
    (q_mc, 7,
     '¿Qué crees que diferencia a un asesor que cierra consistentemente de uno que no?',
     'alternativas', 'modelos_mentales',
     '{"items": [{"valor": "tecnica", "label": "Dominar la técnica de venta"}, {"valor": "relaciones", "label": "Construir relaciones genuinas"}, {"valor": "volumen", "label": "Prospectar más volumen"}]}'::jsonb),

    (q_mc, 8,
     '¿Crees que tu resultado de este mes depende principalmente de ti?',
     'si_no', 'modelos_mentales', null),

    (q_mc, 9,
     'Cuando un prospecto dice "no", ¿qué te dice eso sobre ti como vendedor?',
     'alternativas', 'modelos_mentales',
     '{"items": [{"valor": "nada", "label": "Nada — los rechazos son parte del proceso"}, {"valor": "algo", "label": "Algo — puede indicar que debo ajustar mi enfoque"}, {"valor": "mucho", "label": "Mucho — me hace replantear si lo estoy haciendo bien"}]}'::jsonb),

    -- relacion_feedback (3 ítems)
    (q_mc, 10,
     '¿Cuándo fue la última vez que pediste feedback sobre tu forma de vender?',
     'alternativas', 'relacion_feedback',
     '{"items": [{"valor": "reciente", "label": "Esta semana o la pasada"}, {"valor": "mes", "label": "En el último mes"}, {"valor": "mucho", "label": "Hace más de un mes"}]}'::jsonb),

    (q_mc, 11,
     'Cuando tu gerente te hace una observación crítica sobre tu trabajo, ¿qué haces primero?',
     'alternativas', 'relacion_feedback',
     '{"items": [{"valor": "escucho", "label": "Escucho y busco entender la observación"}, {"valor": "defiendo", "label": "Explico mi perspectiva o contexto"}, {"valor": "incomoda", "label": "Me cuesta, aunque luego lo proceso"}]}'::jsonb),

    (q_mc, 12,
     '¿Sueles buscar retroalimentación de tus propios clientes después de una venta o presentación?',
     'si_no', 'relacion_feedback', null),

    -- contexto_situacional (3 ítems)
    (q_mc, 13,
     '¿Cómo describirías tu semana comercial en términos de energía?',
     'alternativas', 'contexto_situacional',
     '{"items": [{"valor": "alta", "label": "Alta — con impulso y enfoque"}, {"valor": "normal", "label": "Normal — dentro de lo esperado"}, {"valor": "baja", "label": "Baja — sin mucha energía para prospectar"}]}'::jsonb),

    (q_mc, 14,
     '¿Hay algo fuera del trabajo que esté afectando tu rendimiento esta semana?',
     'si_no', 'contexto_situacional', null),

    (q_mc, 15,
     'Si tuvieras que describir el mayor obstáculo para tu resultado este mes, ¿cuál sería?',
     'alternativas', 'contexto_situacional',
     '{"items": [{"valor": "prospectos", "label": "Me faltan prospectos suficientes"}, {"valor": "cierres", "label": "Tengo prospectos pero me cuesta cerrar"}, {"valor": "tiempo", "label": "No tengo suficiente tiempo para vender"}, {"valor": "motivacion", "label": "Me falta motivación o energía"}]}'::jsonb);

    RAISE NOTICE 'Micro cuestionario creado: %', q_mc;
  END IF;

END $$;
