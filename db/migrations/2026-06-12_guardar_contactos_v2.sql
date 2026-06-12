-- ════════════════════════════════════════════════════════════════════════
-- guardar_contactos_v2 — RPC transaccional de bitácora v2a (NODOS server-side).
-- Proyecto: proxis_dev (mkqgbmwm). Pegar en el SQL Editor.
-- Calco de plataforma-core.js (versión A) §2-§4, con divergencias aprobadas B1/B2
-- (ver AJUSTES_BITACORA_V2.md). Helpers de similitud replicados EXACTOS al JS,
-- SIN extensiones (normNombre vía translate; levenshtein DP puro en plpgsql).
-- ════════════════════════════════════════════════════════════════════════

-- ── normNombre: lower → quitar tildes (set latino-español) → strip [^a-z0-9 space]
--    → collapse espacios → trim. Byte-idéntico al JS para el universo latino-español.
--    Residual exótico (Latin-Extended fuera del set) anotado en AJUSTES_BITACORA_V2.md.
create or replace function app_norm_nombre(s text) returns text
language sql immutable as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(s, '')),
          'áàâäãéèêëíìîïóòôöõúùûüñç',
          'aaaaaeeeeiiiiooooouuuunc'
        ),
        '[^a-z0-9[:space:]]', '', 'g'
      ),
      '[[:space:]]+', ' ', 'g'
    )
  )
$$;

-- ── levenshtein: DP puro (mismo algoritmo y costo unitario que el JS). Sin fuzzystrmatch.
create or replace function app_levenshtein(a text, b text) returns int
language plpgsql immutable as $$
declare
  m int := char_length(a);
  n int := char_length(b);
  dp int[];
  i int; j int; cost int; prev int; cur int; ca text;
begin
  if m = 0 then return n; end if;
  if n = 0 then return m; end if;
  dp := array(select g from generate_series(0, n) as g);  -- dp[0..n] para i=0
  for i in 1..m loop
    prev := dp[1];      -- dp[i-1][0]
    dp[1] := i;         -- dp[i][0]
    ca := substr(a, i, 1);
    for j in 1..n loop
      cost := case when ca = substr(b, j, 1) then 0 else 1 end;
      cur := least(dp[j+1] + 1, dp[j] + 1, prev + cost);
      prev := dp[j+1];  -- dp[i-1][j] (diagonal del próximo j)
      dp[j+1] := cur;   -- dp[i][j]
    end loop;
  end loop;
  return dp[n+1];
end;
$$;

-- ── similitud (0-1) con boost de primer nombre (calco exacto §1).
create or replace function app_similitud(a text, b text) returns numeric
language plpgsql immutable as $$
declare
  na text := app_norm_nombre(a);
  nb text := app_norm_nombre(b);
  maxlen int; fullsim numeric; fnsim numeric; a0 text; b0 text; fnmax int;
begin
  if na = '' or nb = '' then return 0; end if;
  if na = nb then return 1; end if;
  maxlen := greatest(char_length(na), char_length(nb));
  if maxlen = 0 then return 1; end if;
  fullsim := (maxlen - app_levenshtein(na, nb))::numeric / maxlen;
  a0 := split_part(na, ' ', 1);
  b0 := split_part(nb, ' ', 1);
  if a0 <> '' and b0 <> '' then
    fnmax := greatest(char_length(a0), char_length(b0));
    fnsim := (fnmax - app_levenshtein(a0, b0))::numeric / fnmax;
  else
    fnsim := 0;
  end if;
  if fnsim > 0.8 then
    return greatest(fullsim, fullsim * 0.7 + fnsim * 0.3);
  else
    return fullsim;
  end if;
end;
$$;

create or replace function app_es_similar(a text, b text) returns boolean
language sql immutable as $$ select app_similitud(a, b) >= 0.70 $$;   -- SIMILITUD_THRESHOLD

create or replace function app_es_mismo_exacto(a text, b text) returns boolean
language sql immutable as $$ select app_norm_nombre(a) = app_norm_nombre(b) $$;


-- ════════════════════════════════════════════════════════════════════════
-- RPC transaccional. Una sola transacción (rollback automático ante error).
-- Lock del reporte (FOR UPDATE) → serializa guardados concurrentes (no duplica nodos).
-- ════════════════════════════════════════════════════════════════════════
drop function if exists guardar_contactos_v2(uuid, uuid, uuid, jsonb);
create function guardar_contactos_v2(
  p_persona_id uuid, p_institucion_id uuid, p_reporte_id uuid, p_contactos jsonb
) returns jsonb
language plpgsql as $$
declare
  v_rep record; v_asesor text; v_semana text;
  v_old jsonb; c_el jsonb; rc record; v_nodo record; v_act record; v_prev record;
  v_nombre text; v_vinculo text; v_llamo boolean; v_reunion boolean; v_prosp int;
  v_tipo text; v_norm text; v_created timestamptz; v_is_react boolean;
  v_nodo_count int; v_new_id uuid; v_guardados int := 0;
  nuevos jsonb := '[]'::jsonb; react jsonb := '[]'::jsonb; borrados jsonb := '[]'::jsonb;
begin
  -- 1) lock + validación de pertenencia y confirmado (calco v1)
  select id, persona_id, confirmado, semana_inicio into v_rep
    from reportes where id = p_reporte_id for update;
  if not found then return jsonb_build_object('ok', false, 'status', 404, 'error', 'Reporte no encontrado'); end if;
  if v_rep.persona_id is distinct from p_persona_id then return jsonb_build_object('ok', false, 'status', 403, 'error', 'No autorizado'); end if;
  if v_rep.confirmado then return jsonb_build_object('ok', false, 'status', 409, 'error', 'Semana ya confirmada'); end if;
  v_semana := v_rep.semana_inicio;
  select nombre into v_asesor from persona where id = p_persona_id;

  -- B2: snapshot de created_at de los contactos existentes (norm → MIN created_at) ANTES de borrar
  v_old := coalesce((
    select jsonb_object_agg(nrm, ca) from (
      select app_norm_nombre(nombre) as nrm, min(created_at) as ca
      from contactos where reporte_id = p_reporte_id group by app_norm_nombre(nombre)
    ) t
  ), '{}'::jsonb);

  -- delete-all (calco §1b)
  delete from contactos where reporte_id = p_reporte_id;

  -- reinsert: validaciones (calco B v1) + B2 (created_at conservado) + tipo re-derivado server-side
  for c_el in select jsonb_array_elements(coalesce(p_contactos, '[]'::jsonb)) loop
    v_nombre := btrim(coalesce(c_el->>'nombre', ''));
    if v_nombre = '' then continue; end if;
    v_vinculo := coalesce(c_el->>'vinculo', 'Conocido/a');
    if v_vinculo not in ('Amigo/a','Familiar','Cliente','Conocido/a') then v_vinculo := 'Conocido/a'; end if;
    v_llamo := coalesce((c_el->>'llamo')::boolean, false);
    v_reunion := coalesce((c_el->>'reunion')::boolean, false);
    v_prosp := greatest(0, trunc(coalesce((c_el->>'prospectos')::numeric, 0))::int);
    v_tipo := coalesce(c_el->>'tipo_contacto', 'nuevo');
    v_norm := app_norm_nombre(v_nombre);
    v_created := coalesce((v_old->>v_norm)::timestamptz, now());  -- B2

    -- server decide reactivación (flag cliente = intención). 'activacion_nodo' se preserva.
    if v_tipo = 'activacion_nodo' then
      null;  -- preservar
    else
      v_is_react := exists (
        select 1 from nodos n where n.persona_id = p_persona_id
          and (app_es_mismo_exacto(n.nombre, v_nombre) or app_es_similar(n.nombre, v_nombre))
      ) or exists (
        select 1 from contactos x where x.persona_id = p_persona_id and x.reporte_id <> p_reporte_id
          and app_es_similar(x.nombre, v_nombre)
      );
      v_tipo := case when v_is_react then 'reactivacion' else 'nuevo' end;
    end if;

    insert into contactos (reporte_id, persona_id, institucion_id, asesor, nombre, vinculo, tipo_contacto, llamo, reunion, prospectos, created_at)
    values (p_reporte_id, p_persona_id, p_institucion_id, v_asesor, v_nombre, v_vinculo, v_tipo, v_llamo, v_reunion, v_prosp, v_created);
    v_guardados := v_guardados + 1;
  end loop;

  if v_guardados > 0 then
    update reportes set sin_actividad = false where id = p_reporte_id;  -- calco B
  end if;

  -- conversión / reactivación de nodos (calco §3 con B1)
  for rc in select nombre, vinculo, prospectos from contactos where reporte_id = p_reporte_id and tipo_contacto = 'reactivacion' loop
    v_nombre := rc.nombre; v_prosp := rc.prospectos; v_vinculo := coalesce(rc.vinculo, 'Conocido/a');

    select * into v_nodo from nodos n where n.persona_id = p_persona_id
      and (app_es_mismo_exacto(n.nombre, v_nombre) or app_es_similar(n.nombre, v_nombre)) limit 1;
    if found then
      select * into v_act from activaciones_nodo a where a.nodo_id = v_nodo.id and a.semana_inicio = v_semana limit 1;
      if not found then
        update nodos set activaciones = coalesce(activaciones, 2) + 1,
               total_prospectos = coalesce(total_prospectos, 0) + v_prosp,
               ultima_activacion = v_semana where id = v_nodo.id;
        insert into activaciones_nodo (nodo_id, persona_id, institucion_id, asesor, semana_inicio, prospectos)
        values (v_nodo.id, p_persona_id, p_institucion_id, v_asesor, v_semana, v_prosp);
      else
        if v_prosp <> coalesce(v_act.prospectos, 0) then
          update activaciones_nodo set prospectos = v_prosp where id = v_act.id;
          update nodos set total_prospectos = greatest(0, coalesce(total_prospectos, 0) + (v_prosp - coalesce(v_act.prospectos, 0))),
                 ultima_activacion = v_semana where id = v_nodo.id;
        end if;
      end if;
      react := react || jsonb_build_object('nombre', v_nodo.nombre);
    else
      -- prevOtherWeek: apariciones en otras semanas. B1 → la más antigua (MIN created_at).
      select x.created_at, x.prospectos into v_prev
        from contactos x where x.persona_id = p_persona_id and x.reporte_id <> p_reporte_id
          and app_es_similar(x.nombre, v_nombre)
        order by x.created_at asc limit 1;
      if found then
        select count(*) into v_nodo_count from nodos where persona_id = p_persona_id;
        insert into nodos (persona_id, institucion_id, asesor, nombre, vinculo, fecha_primer_contacto, fecha_conversion, activaciones, total_prospectos, ultima_activacion)
        values (p_persona_id, p_institucion_id, v_asesor, v_nombre, v_vinculo,
                substr(v_prev.created_at::text, 1, 10),   -- B1: MIN(created_at) de las previas
                v_semana, 2,                               -- activaciones = 2 fijo (quirk calcado)
                coalesce(v_prev.prospectos, 0) + v_prosp,  -- total = UNA aparición previa + actual (quirk)
                v_semana)
        returning id into v_new_id;
        insert into activaciones_nodo (nodo_id, persona_id, institucion_id, asesor, semana_inicio, prospectos)
        values (v_new_id, p_persona_id, p_institucion_id, v_asesor, v_semana, v_prosp);
        nuevos := nuevos || jsonb_build_object('nombre', v_nombre, 'numNodo', v_nodo_count + 1);
      end if;
    end if;
  end loop;

  -- limpieza de huérfanos: nodos convertidos ESTA semana cuyo contacto ya no está (calco §4, sin confirmación)
  for v_nodo in select * from nodos where persona_id = p_persona_id and fecha_conversion = v_semana loop
    if not exists (
      select 1 from contactos x where x.reporte_id = p_reporte_id
        and (app_es_similar(x.nombre, v_nodo.nombre) or app_norm_nombre(x.nombre) = app_norm_nombre(v_nodo.nombre))
    ) then
      delete from activaciones_nodo where nodo_id = v_nodo.id;  -- FK primero
      delete from nodos where id = v_nodo.id;
      borrados := borrados || jsonb_build_object('nombre', v_nodo.nombre);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'guardados', v_guardados,
    'nodos_nuevos', nuevos, 'nodos_reactivados', react, 'nodos_borrados', borrados);
end;
$$;
