-- Seed: Instrumento TPS v1.0 — 57 ítems originales
-- Aplicar DESPUÉS de 20260524_020_tps_sistema.sql
-- Idempotente: no hace nada si ya existe el instrumento

DO $$
DECLARE q_id uuid;
BEGIN

  -- Salir si ya fue sembrado
  IF EXISTS (SELECT 1 FROM cuestionarios WHERE nombre = 'Instrumento TPS v1.0') THEN
    RAISE NOTICE 'Instrumento TPS ya sembrado. Saltando.';
    RETURN;
  END IF;

  INSERT INTO cuestionarios (nombre, tipo, descripcion, activo)
  VALUES (
    'Instrumento TPS v1.0',
    'psicometrico',
    'Evaluación conductual de 57 ítems. Módulo A: Iniciativa (12, diferencial semántico). Módulo B: Calidez (12, diferencial semántico). Módulo C: Rasgos Comerciales (25, Likert). Módulo D: Juicio Situacional (8, elección forzada).',
    true
  )
  RETURNING id INTO q_id;

  -- ====================================================================
  -- MÓDULO A — Eje de Iniciativa / Assertividad (12 ítems, escala 1–4)
  -- polo_izq = baja iniciativa (score 1), polo_der = alta iniciativa (score 4)
  -- ====================================================================
  INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, opciones) VALUES

  (q_id, 1, 'A01 — Dirección de la reunión', 'escala_4', 'tps_a',
   '{"polo_izq": "Dejo que el prospecto dirija la reunión", "polo_der": "Yo dirijo la reunión desde el inicio"}'::jsonb),

  (q_id, 2, 'A02 — Momento para opinar', 'escala_4', 'tps_a',
   '{"polo_izq": "Escucho primero antes de dar mi opinión", "polo_der": "Doy mi opinión y luego escucho"}'::jsonb),

  (q_id, 3, 'A03 — Apertura a desconocidos', 'escala_4', 'tps_a',
   '{"polo_izq": "Me cuesta abrir contacto con desconocidos", "polo_der": "Abro contacto con desconocidos fácilmente"}'::jsonb),

  (q_id, 4, 'A04 — Decisión bajo incertidumbre', 'escala_4', 'tps_a',
   '{"polo_izq": "Analizo antes de actuar", "polo_der": "Actúo primero y ajusto sobre la marcha"}'::jsonb),

  (q_id, 5, 'A05 — Postura en negociación', 'escala_4', 'tps_a',
   '{"polo_izq": "Cedo en la negociación para mantener armonía", "polo_der": "Mantengo mi posición hasta lograr lo que quiero"}'::jsonb),

  (q_id, 6, 'A06 — Prospección activa', 'escala_4', 'tps_a',
   '{"polo_izq": "Espero que me asignen prospectos", "polo_der": "Busco mis propios prospectos activamente"}'::jsonb),

  (q_id, 7, 'A07 — Expresar desacuerdo', 'escala_4', 'tps_a',
   '{"polo_izq": "Guardo silencio cuando no estoy de acuerdo", "polo_der": "Expreso mi desacuerdo de forma directa"}'::jsonb),

  (q_id, 8, 'A08 — Cierre directo', 'escala_4', 'tps_a',
   '{"polo_izq": "Pedir el cierre directamente me incomoda", "polo_der": "Pido el cierre directamente sin incomodidad"}'::jsonb),

  (q_id, 9, 'A09 — Ritmo de la negociación', 'escala_4', 'tps_a',
   '{"polo_izq": "Dejo que los demás decidan el ritmo", "polo_der": "Yo decido el ritmo de la negociación"}'::jsonb),

  (q_id, 10, 'A10 — Seguimiento al prospecto', 'escala_4', 'tps_a',
   '{"polo_izq": "Espero que el prospecto retome el contacto", "polo_der": "Soy yo quien retoma el contacto"}'::jsonb),

  (q_id, 11, 'A11 — Decisiones grupales', 'escala_4', 'tps_a',
   '{"polo_izq": "Me adapto a las decisiones del grupo sin cuestionarlas", "polo_der": "Propongo alternativas cuando no comparto la decisión"}'::jsonb),

  (q_id, 12, 'A12 — Conducción hacia el cierre', 'escala_4', 'tps_a',
   '{"polo_izq": "Dejo que la conversación fluya naturalmente", "polo_der": "Conduzco activamente la conversación hacia el cierre"}'::jsonb);


  -- ====================================================================
  -- MÓDULO B — Eje de Calidez / Receptividad Emocional (12 ítems, escala 1–4)
  -- polo_izq = orientación a tareas/datos (score 1), polo_der = orientación a personas (score 4)
  -- ====================================================================
  INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, opciones) VALUES

  (q_id, 13, 'B01 — Apertura de reunión', 'escala_4', 'tps_b',
   '{"polo_izq": "Prefiero hablar de datos desde el inicio", "polo_der": "Prefiero conocer a la persona antes de los negocios"}'::jsonb),

  (q_id, 14, 'B02 — Clave del éxito comercial', 'escala_4', 'tps_b',
   '{"polo_izq": "El éxito depende de la propuesta correcta", "polo_der": "El éxito depende de la confianza construida"}'::jsonb),

  (q_id, 15, 'B03 — Respuesta ante problemas del cliente', 'escala_4', 'tps_b',
   '{"polo_izq": "Me enfoco en resolver el problema concreto", "polo_der": "Primero atiendo cómo se siente el cliente"}'::jsonb),

  (q_id, 16, 'B04 — Temas de conversación laboral', 'escala_4', 'tps_b',
   '{"polo_izq": "Prefiero hablar de resultados y tareas", "polo_der": "Disfruto hablar de personas e historias"}'::jsonb),

  (q_id, 17, 'B05 — Distancia con clientes', 'escala_4', 'tps_b',
   '{"polo_izq": "Mantengo distancia profesional con mis clientes", "polo_der": "Mis clientes se vuelven parte de mi círculo cercano"}'::jsonb),

  (q_id, 18, 'B06 — Conversaciones personales', 'escala_4', 'tps_b',
   '{"polo_izq": "Me incomoda cuando la charla se vuelve muy personal", "polo_der": "Disfruto cuando la charla se vuelve personal y cercana"}'::jsonb),

  (q_id, 19, 'B07 — Base para tomar decisiones', 'escala_4', 'tps_b',
   '{"polo_izq": "Decido basado en datos antes que en intuición", "polo_der": "Confío en mi intuición sobre las personas"}'::jsonb),

  (q_id, 20, 'B08 — Argumento emocional vs. lógico', 'escala_4', 'tps_b',
   '{"polo_izq": "El argumento lógico es más importante que el emocional", "polo_der": "Lo emocional es tan importante como lo lógico en ventas"}'::jsonb),

  (q_id, 21, 'B09 — Foco en trabajo en equipo', 'escala_4', 'tps_b',
   '{"polo_izq": "Me enfoco en cumplir mi parte eficientemente", "polo_der": "Invierto tiempo en cuidar la dinámica del equipo"}'::jsonb),

  (q_id, 22, 'B10 — Estilo de comunicación', 'escala_4', 'tps_b',
   '{"polo_izq": "Prefiero mensajes cortos y al punto", "polo_der": "Prefiero mensajes con tono personal y cálido"}'::jsonb),

  (q_id, 23, 'B11 — Memoria de detalles de clientes', 'escala_4', 'tps_b',
   '{"polo_izq": "Me cuesta recordar detalles personales de mis clientes", "polo_der": "Recuerdo detalles personales y los uso en conversaciones"}'::jsonb),

  (q_id, 24, 'B12 — Base de la fidelización', 'escala_4', 'tps_b',
   '{"polo_izq": "La fidelización pasa por la calidad del producto", "polo_der": "La fidelización pasa por la relación construida"}'::jsonb);


  -- ====================================================================
  -- MÓDULO C — Rasgos Comerciales (25 ítems, Likert 1–5)
  -- perfil_hint: '+' = ítem positivo, '-' = ítem negativo (score = 6 - respuesta)
  -- F1 Iniciativa Comercial | F2 Orientación al Cliente
  -- F3 Disciplina de Proceso | F4 Estabilidad bajo Presión | F5 Apertura al Aprendizaje
  -- ====================================================================

  -- F1: Iniciativa Comercial (C01–C05)
  INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, perfil_hint, opciones) VALUES

  (q_id, 25, 'Busco activamente nuevos prospectos sin esperar que lleguen solos.',
   'escala_5', 'tps_c_f1', '+', '{"negativo": false}'::jsonb),

  (q_id, 26, 'Establezco mis propias metas de prospección más allá de las que me asignan.',
   'escala_5', 'tps_c_f1', '+', '{"negativo": false}'::jsonb),

  (q_id, 27, 'Me cuesta mantener una agenda de prospección consistente semana a semana.',
   'escala_5', 'tps_c_f1', '-', '{"negativo": true}'::jsonb),

  (q_id, 28, 'Disfruto el proceso de abrir contacto con personas que no me conocen.',
   'escala_5', 'tps_c_f1', '+', '{"negativo": false}'::jsonb),

  (q_id, 29, 'Prefiero profundizar con clientes actuales antes que abrir nuevos contactos.',
   'escala_5', 'tps_c_f1', '-', '{"negativo": true}'::jsonb),

  -- F2: Orientación al Cliente (C06–C10)
  (q_id, 30, 'Adapto mi forma de comunicarme según lo que percibo del estilo de cada cliente.',
   'escala_5', 'tps_c_f2', '+', '{"negativo": false}'::jsonb),

  (q_id, 31, 'Cuando un cliente tiene un problema, me preocupo más allá de lo estrictamente necesario.',
   'escala_5', 'tps_c_f2', '+', '{"negativo": false}'::jsonb),

  (q_id, 32, 'A veces priorizo cerrar la venta aunque el producto no sea el más adecuado para el cliente.',
   'escala_5', 'tps_c_f2', '-', '{"negativo": true}'::jsonb),

  (q_id, 33, 'Recibo con facilidad las críticas o quejas de clientes y las uso para mejorar.',
   'escala_5', 'tps_c_f2', '+', '{"negativo": false}'::jsonb),

  (q_id, 34, 'Cuando termino una venta, mi atención pasa rápidamente al siguiente prospecto.',
   'escala_5', 'tps_c_f2', '-', '{"negativo": true}'::jsonb),

  -- F3: Disciplina de Proceso (C11–C15)
  (q_id, 35, 'Registro mis actividades y seguimientos en el sistema de forma consistente.',
   'escala_5', 'tps_c_f3', '+', '{"negativo": false}'::jsonb),

  (q_id, 36, 'Cumplo con los compromisos de seguimiento que hago con mis prospectos.',
   'escala_5', 'tps_c_f3', '+', '{"negativo": false}'::jsonb),

  (q_id, 37, 'Tengo pendientes de seguimiento sin resolver que se acumulan con el tiempo.',
   'escala_5', 'tps_c_f3', '-', '{"negativo": true}'::jsonb),

  (q_id, 38, 'Planifico mi semana de trabajo antes de comenzarla.',
   'escala_5', 'tps_c_f3', '+', '{"negativo": false}'::jsonb),

  (q_id, 39, 'Me cuesta mantener mi pipeline de ventas actualizado.',
   'escala_5', 'tps_c_f3', '-', '{"negativo": true}'::jsonb),

  -- F4: Estabilidad bajo Presión (C16–C20)
  (q_id, 40, 'Un rechazo de un prospecto me motiva a entender mejor cómo mejorar mi propuesta.',
   'escala_5', 'tps_c_f4', '+', '{"negativo": false}'::jsonb),

  (q_id, 41, 'Mantengo mi energía y enfoque incluso en semanas de bajo resultado.',
   'escala_5', 'tps_c_f4', '+', '{"negativo": false}'::jsonb),

  (q_id, 42, 'Cuando acumulo varios rechazos seguidos, me cuesta mantener la motivación.',
   'escala_5', 'tps_c_f4', '-', '{"negativo": true}'::jsonb),

  (q_id, 43, 'Puedo separar los resultados de ventas de mi valoración personal como profesional.',
   'escala_5', 'tps_c_f4', '+', '{"negativo": false}'::jsonb),

  (q_id, 44, 'Las situaciones de alta presión o cuota me generan ansiedad que afecta mi rendimiento.',
   'escala_5', 'tps_c_f4', '-', '{"negativo": true}'::jsonb),

  -- F5: Apertura al Aprendizaje (C21–C25)
  (q_id, 45, 'Busco activamente feedback de mis gerentes y pares para mejorar mi forma de vender.',
   'escala_5', 'tps_c_f5', '+', '{"negativo": false}'::jsonb),

  (q_id, 46, 'Cuando una táctica no funciona, pruebo enfoques distintos.',
   'escala_5', 'tps_c_f5', '+', '{"negativo": false}'::jsonb),

  (q_id, 47, 'Prefiero hacer lo que sé que funciona antes que probar cosas nuevas.',
   'escala_5', 'tps_c_f5', '-', '{"negativo": true}'::jsonb),

  (q_id, 48, 'Dedico tiempo a estudiar temas relacionados con ventas fuera del horario de trabajo.',
   'escala_5', 'tps_c_f5', '+', '{"negativo": false}'::jsonb),

  (q_id, 49, 'Me resulta difícil cambiar mi forma de trabajar cuando ya tengo una rutina establecida.',
   'escala_5', 'tps_c_f5', '-', '{"negativo": true}'::jsonb);


  -- ====================================================================
  -- MÓDULO D — Juicio Situacional (8 escenarios, elección forzada)
  -- D1–D7: opciones mapeadas a perfil E/S/R/A
  -- D8 (especial): opción "backup" = señal de alta necesidad de aprobación
  -- ====================================================================
  INSERT INTO preguntas (cuestionario_id, orden, texto, tipo_respuesta, dimension_target, opciones) VALUES

  (q_id, 50,
   'Estás a punto de entrar a tu primera reunión con un prospecto que no te conoce. ¿Cómo abres la reunión?',
   'alternativas', 'tps_d',
   '[{"perfil":"E","label":"Establezco de entrada de qué se trata la reunión y cuál es el objetivo concreto."},{"perfil":"S","label":"Cuento una historia o caso conocido para generar conexión inmediata."},{"perfil":"R","label":"Pregunto primero cómo está el prospecto y qué está pasando en su empresa."},{"perfil":"A","label":"Hago una pregunta técnica que demuestre que investigué antes de llegar."}]'::jsonb),

  (q_id, 51,
   'Tu prospecto más avanzado lleva tres semanas postergando la decisión final con excusas distintas. ¿Qué haces?',
   'alternativas', 'tps_d',
   '[{"perfil":"E","label":"Le digo directamente que necesito una respuesta esta semana para seguir avanzando."},{"perfil":"S","label":"Lo llamo para conversar y le cuento que otros colegas suyos ya están disfrutando los resultados."},{"perfil":"R","label":"Le pregunto qué le preocupa o qué lo está frenando, y espero que me lo cuente."},{"perfil":"A","label":"Le preparo un resumen comparativo con los puntos acordados y los pendientes por resolver."}]'::jsonb),

  (q_id, 52,
   'Un prospecto te dice que recibió una propuesta de un competidor con precio 20% menor. ¿Qué haces?',
   'alternativas', 'tps_d',
   '[{"perfil":"E","label":"Le pregunto directamente: ¿Qué necesitas de mi parte para cerrar hoy con nosotros?"},{"perfil":"S","label":"Le cuento el caso de un cliente que eligió la opción más barata y luego volvió con nosotros."},{"perfil":"R","label":"Le pido que me cuente qué valoró de la propuesta del competidor antes de responder."},{"perfil":"A","label":"Desgloso punto por punto la diferencia de valor y le presento los números comparados."}]'::jsonb),

  (q_id, 53,
   'El día antes de una presentación importante hay tensión entre tú y un colega que también participa. ¿Cómo lo manejas?',
   'alternativas', 'tps_d',
   '[{"perfil":"E","label":"Le digo que por hoy dejamos el tema personal afuera y nos enfocamos en ganar la cuenta."},{"perfil":"S","label":"Lo invito a conversar, me intereso por cómo está y buscamos hacer las paces antes de presentar."},{"perfil":"R","label":"Me acerco, reconozco que hubo tensión y le digo que me importa que estemos bien como equipo."},{"perfil":"A","label":"Propongo que cada uno clarifique su rol en la presentación para evitar superposiciones."}]'::jsonb),

  (q_id, 54,
   'Ya avanzado el proceso, el prospecto introduce una objeción de precio que nunca mencionó antes. ¿Cómo respondes?',
   'alternativas', 'tps_d',
   '[{"perfil":"E","label":"Entiendo que el precio importa. Dime: si resolvemos eso, ¿cerramos hoy?"},{"perfil":"S","label":"Le muestro cómo este producto le funcionó a alguien en exactamente su situación."},{"perfil":"R","label":"Le pregunto qué parte del valor no quedó clara para él o ella."},{"perfil":"A","label":"Revisamos juntos la estructura de costos y comparamos con el retorno esperado a 12 meses."}]'::jsonb),

  (q_id, 55,
   'Tuviste tu mejor mes de producción. ¿Cómo lo vives?',
   'alternativas', 'tps_d',
   '[{"perfil":"E","label":"Analizo qué hice diferente y establezco eso como mi nuevo mínimo estándar."},{"perfil":"S","label":"Lo comparto con mi equipo o red: me interesa que todos sepan lo que logré."},{"perfil":"R","label":"Agradezco a los clientes que confiaron en mí. El resultado fue de todos."},{"perfil":"A","label":"Reviso mis registros para entender exactamente qué factores explican el resultado."}]'::jsonb),

  (q_id, 56,
   'Un prospecto te hace una pregunta técnica compleja que no sabes responder en el momento. ¿Qué haces?',
   'alternativas', 'tps_d',
   '[{"perfil":"E","label":"Le digo que no tengo ese dato ahora pero que le confirmo antes de las 24 horas."},{"perfil":"S","label":"Digo que es una excelente pregunta y lo involucro en buscar la respuesta juntos."},{"perfil":"R","label":"Confieso que no manejo ese nivel de detalle y le pregunto a quién debería involucrar."},{"perfil":"A","label":"Le pido que me formule la pregunta por escrito para darle una respuesta rigurosa y documentada."}]'::jsonb),

  -- D8: ítem especial — opción "backup" detecta alta necesidad de aprobación
  (q_id, 57,
   'Un prospecto rechaza tu propuesta con tono muy crítico, cuestionando si entendiste sus necesidades. ¿Cómo reaccionas?',
   'alternativas', 'tps_d8',
   '[{"perfil":"sano","label":"Con calma le pido que me indique exactamente qué faltó para ajustar la propuesta."},{"perfil":"backup","label":"Me disculpo de inmediato, le digo que tiene razón y que voy a rehacer todo desde cero para no decepcionarlo."},{"perfil":"sano","label":"Le agradezco la retroalimentación y le pido 10 minutos para escuchar qué esperaba."},{"perfil":"sano","label":"Le pido que señale exactamente en qué punto la propuesta no reflejó sus necesidades."}]'::jsonb);

  RAISE NOTICE 'Instrumento TPS v1.0 sembrado correctamente. cuestionario_id: %', q_id;

END $$;
