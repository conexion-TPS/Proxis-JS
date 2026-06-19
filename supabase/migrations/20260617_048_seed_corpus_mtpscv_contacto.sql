-- Migración 048 — Seed corpus MTPSCV, escenario CONTACTO (16 celdas)
-- Idempotente: WHERE NOT EXISTS por titulo. El contacto es NODO (fuente de referidos), no prospecto.
-- perfil = tipo del asesor (id_tipo ERRIM). tags = solo tipo_interlocutor.

-- Asesor ENERGÉTICO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','contacto','prospeccion','energetico × energetico (contacto)',
'DINÁMICA: dos perfiles de empuje y control; la conversación puede volverse pulseada por liderar el intercambio. Energía alta, sintonía rápida si hay respeto mutuo.
RIESGO (baja integración): compiten por quién dirige; el contacto siente que el asesor solo quiere "usarlo" para llegar a otros y no deriva.
FORMA RESUELTA (alta integración): el asesor modula cediendo protagonismo, plantea la derivación como intercambio entre pares con beneficio mutuo. Caso: en una cámara de comercio, propone "te presento a dos clientes míos del rubro y tú me conectas con tu red; ganamos los dos"; el contacto deriva.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × energetico (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','contacto','prospeccion','energetico × reflexivo (contacto)',
'DINÁMICA: el asesor empuja a la acción; el contacto reflexivo quiere entender antes de comprometer su nombre en una derivación.
RIESGO (baja integración): el asesor apura el pedido de referidos; el reflexivo, que cuida su reputación, se resguarda y no presenta a nadie.
FORMA RESUELTA (alta integración): el asesor baja el ritmo, explica con qué criterio trabaja y por qué cuidaría al referido. Caso: pide a un contador metódico que la derive; primero le muestra cómo atiende, sin presión, hasta que el contador confía y la presenta.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × reflexivo (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','contacto','prospeccion','energetico × relacional (contacto)',
'DINÁMICA: el asesor va al grano; el contacto relacional necesita vínculo y calidez antes de abrir su círculo.
RIESGO (baja integración): el asesor trata la relación como trámite ("¿a quién me puedes presentar?") y el relacional se siente usado.
FORMA RESUELTA (alta integración): el asesor invierte primero en el vínculo y deja que la derivación surja de la confianza. Caso: conoce a una contacto cálida en un grupo de padres del colegio; en vez de pedir referidos de entrada, construye amistad y ella termina recomendándolo espontáneamente.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × relacional (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'energetico','interaccion_tipos','contacto','prospeccion','energetico × magnetico (contacto)',
'DINÁMICA: dos altas energías; conectan rápido y con entusiasmo, pueden encender buena química social.
RIESGO (baja integración): mucha chispa y poca concreción; se entusiasman, prometen presentaciones y nada se concreta.
FORMA RESUELTA (alta integración): el asesor aprovecha la química pero aterriza un acuerdo concreto. Caso: se caen muy bien en un evento; antes de irse, el asesor fija fecha y nombre puntual de la persona a presentar, convirtiendo el entusiasmo en una cita real.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='energetico × magnetico (contacto)');

-- Asesor REFLEXIVO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','contacto','prospeccion','reflexivo × energetico (contacto)',
'DINÁMICA: el asesor quiere explicar bien su propuesta de valor; el contacto enérgico quiere el punto y la acción ya.
RIESGO (baja integración): el asesor da contexto de más; el enérgico se impacienta y corta.
FORMA RESUELTA (alta integración): el asesor sintetiza su pedido en una frase y propone un paso concreto. Caso: resuelve en "necesito una presentación con el gerente de tu cliente; ¿me la haces esta semana?". El enérgico, que valora la concisión, acepta.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × energetico (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','contacto','prospeccion','reflexivo × reflexivo (contacto)',
'DINÁMICA: dos perfiles cautos; conversación sólida y de confianza, pero lenta para llegar a la acción.
RIESGO (baja integración): ambos analizan tanto que la derivación nunca se concreta; queda en "lo voy a pensar".
FORMA RESUELTA (alta integración): el asesor introduce un cierre suave con plazo. Caso: propone "te paso una ficha de una página con cómo trabajo; si te hace sentido, me presentas a alguien la próxima semana". El marco claro destraba.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × reflexivo (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','contacto','prospeccion','reflexivo × relacional (contacto)',
'DINÁMICA: el asesor aporta rigor; el contacto relacional aporta calidez. Buena base si el asesor no se vuelve frío.
RIESGO (baja integración): el asesor responde con datos donde el relacional esperaba calor humano; el vínculo no prende.
FORMA RESUELTA (alta integración): el asesor envuelve su rigor en interés genuino por la persona. Caso: antes de hablar de negocios, se interesa de verdad por su familia y su trabajo, y la derivación llega por confianza.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × relacional (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'reflexivo','interaccion_tipos','contacto','prospeccion','reflexivo × magnetico (contacto)',
'DINÁMICA: el asesor es medido; el contacto magnético es expansivo y veloz. Ritmos opuestos.
RIESGO (baja integración): el asesor aburre al magnético con detalle; el magnético desconecta y no recuerda derivar.
FORMA RESUELTA (alta integración): el asesor sube energía y pinta el beneficio con una imagen, no con datos. Caso: resume en "imagina poder decirle a tus amigos que tú les conseguiste el mejor respaldo"; el magnético se entusiasma y conecta.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='reflexivo × magnetico (contacto)');

-- Asesor RELACIONAL
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','contacto','prospeccion','relacional × energetico (contacto)',
'DINÁMICA: el asesor construye vínculo; el contacto enérgico quiere eficiencia. Riesgo de desfase de ritmo.
RIESGO (baja integración): el asesor alarga la charla; el enérgico lo lee como pérdida de tiempo y no deriva.
FORMA RESUELTA (alta integración): el asesor mantiene calidez pero va directo al pedido. Caso: tras un saludo cálido y breve, dice "te seré concreta: ¿a quién de tu equipo le serviría esto?". El enérgico aprecia la franqueza.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × energetico (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','contacto','prospeccion','relacional × reflexivo (contacto)',
'DINÁMICA: el asesor cálido y el contacto cauto pueden generar confianza profunda y duradera.
RIESGO (baja integración): la calidez sin sustancia incomoda al reflexivo, que quiere saber con qué criterio trabaja antes de poner su nombre.
FORMA RESUELTA (alta integración): el asesor suma a su calidez algún dato concreto que dé seguridad. Caso: acompaña su trato amable con un ejemplo verificable de cómo resolvió un siniestro; el contacto reflexivo, tranquilo, la deriva.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × reflexivo (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','contacto','prospeccion','relacional × relacional (contacto)',
'DINÁMICA: dos perfiles de vínculo; sintonía cálida y natural, conversación agradable.
RIESGO (baja integración): tanta armonía que nadie quiere "molestar" pidiendo la derivación; queda todo en lo afectivo.
FORMA RESUELTA (alta integración): el asesor convierte el vínculo en un pedido amable y explícito. Caso: sin romper el clima, dice "me encantaría ayudar a alguien cercano tuyo como te ayudaría a ti, ¿se te ocurre quién?".',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × relacional (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'relacional','interaccion_tipos','contacto','prospeccion','relacional × magnetico (contacto)',
'DINÁMICA: el asesor cálido y el contacto magnético comparten orientación a las personas; clima muy positivo.
RIESGO (baja integración): el magnético promete presentaciones por entusiasmo y luego no cumple; el relacional no insiste por no incomodar.
FORMA RESUELTA (alta integración): el asesor capitaliza el entusiasmo con un compromiso concreto y amable. Caso: aprovecha el momento para agendar juntos, ahí mismo, el mensaje al referido.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='relacional × magnetico (contacto)');

-- Asesor MAGNÉTICO
INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','contacto','prospeccion','magnetico × energetico (contacto)',
'DINÁMICA: dos altas asertividades; encuentro chispeante y veloz.
RIESGO (baja integración): el magnético quiere brillar y el enérgico quiere dirigir; chocan por el centro de la escena y el enérgico se va.
FORMA RESUELTA (alta integración): el magnético pone su carisma al servicio del contacto, no de sí mismo. Caso: lo hace quedar bien ("con tu red y mi servicio, tú vas a ser quien les resolvió la vida"); el enérgico deriva con gusto.',
ARRAY['energetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × energetico (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','contacto','prospeccion','magnetico × reflexivo (contacto)',
'DINÁMICA: el asesor seduce con visión; el contacto reflexivo desconfía del exceso de entusiasmo.
RIESGO (baja integración): el carisma sin sustancia activa la cautela del reflexivo, que no pone su nombre en juego.
FORMA RESUELTA (alta integración): el magnético baja el volumen y respalda su entusiasmo con un dato verificable. Caso: modera su efusividad ante un contador cauto y le muestra una cifra concreta de respaldo; el contador, tranquilo, lo deriva.',
ARRAY['reflexivo'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × reflexivo (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','contacto','prospeccion','magnetico × relacional (contacto)',
'DINÁMICA: ambos orientados a personas; conexión emocional rápida y cálida.
RIESGO (baja integración): el magnético arrolla con energía a un relacional más pausado, que se siente abrumado.
FORMA RESUELTA (alta integración): el magnético baja revoluciones y escucha al ritmo del otro. Caso: modera su intensidad con una contacto cálida y reservada, le da espacio, y ella —"ya cómoda—" lo recomienda en su círculo.',
ARRAY['relacional'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × relacional (contacto)');

INSERT INTO public.knowledge_base_conductual (perfil, categoria, escenario, etapa_ciclo, titulo, contenido, tags, fuente, completitud)
SELECT 'magnetico','interaccion_tipos','contacto','prospeccion','magnetico × magnetico (contacto)',
'DINÁMICA: dos carismas; la conversación es pura energía y simpatía mutua.
RIESGO (baja integración): puro show, cero concreción; se elogian, se entusiasman y ninguno aterriza una derivación.
FORMA RESUELTA (alta integración): el asesor toma la responsabilidad de concretar. Caso: dos perfiles magnéticos se divierten en un evento; el asesor, antes de despedirse, convierte el entusiasmo en un compromiso puntual con fecha y nombre, para que la chispa no se evapore.',
ARRAY['magnetico'],'corpus_mtpscv',100
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_conductual WHERE titulo='magnetico × magnetico (contacto)');
