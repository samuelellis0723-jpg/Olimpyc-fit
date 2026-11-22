-- 1. Catálogo: dosis permitidas y restricciones (valores de muestra ficticios)
alter table public.ejercicios
  add column if not exists dosis_permitidas jsonb not null default '{}'::jsonb,
  add column if not exists restricciones_json jsonb not null default '{}'::jsonb;

update public.ejercicios
set
  dosis_permitidas = jsonb_build_object(
    'es_ficticio', true,
    'etiqueta_muestra', 'FICTICIO_DEMO_NO_CLINICO',
    'series_min', 1,
    'series_max', 4,
    'repeticiones_min', 6,
    'repeticiones_max', 15,
    'descanso_seg_min', 30,
    'descanso_seg_max', 120,
    'unidades_permitidas', jsonb_build_array('repeticiones')
  ),
  restricciones_json = jsonb_build_object(
    'es_ficticio', true,
    'etiqueta_muestra', 'FICTICIO_DEMO_NO_CLINICO',
    'requiere_revision_tecnica', true,
    'observaciones_ficticias', jsonb_build_array('Muestra ficticia para pruebas de contrato y validación')
  )
where codigo in ('E1', 'E2');

-- 2. Guardar revisión atómica con CAS sobre revision_esperada
-- Parámetros: p_plan_id uuid, p_revision_esperada int, p_dias jsonb, p_motivo_cambio text
-- Retorno: jsonb { plan_id, revision, version_catalogo }
-- Errores: PLAN_NO_ENCONTRADO (P0002), PLAN_HISTORICO_NO_EDITABLE (P0001),
--          CONFLICTO_REVISION_ESPERADA (40001), VERSION_BASE_NO_VIGENTE (P0001)
create or replace function public.guardar_revision_plan(
  p_plan_id uuid,
  p_revision_esperada int,
  p_dias jsonb default null,
  p_motivo_cambio text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_plan public.versiones_plan%rowtype;
  v_base_estado text;
  v_nueva_revision int;
  v_dia jsonb;
  v_dia_id uuid;
  v_item jsonb;
  v_orden int;
begin
  select * into v_plan
  from public.versiones_plan
  where id = p_plan_id
  for update;

  if not found then
    raise exception 'PLAN_NO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if v_plan.estado = 'historica' then
    raise exception 'PLAN_HISTORICO_NO_EDITABLE' using errcode = 'P0001';
  end if;

  if v_plan.revision <> p_revision_esperada then
    raise exception 'CONFLICTO_REVISION_ESPERADA' using errcode = '40001';
  end if;

  if v_plan.version_base_id is not null then
    select estado into v_base_estado
    from public.versiones_plan
    where id = v_plan.version_base_id;

    if v_base_estado is distinct from 'vigente' then
      raise exception 'VERSION_BASE_NO_VIGENTE' using errcode = 'P0001';
    end if;
  end if;

  if p_dias is not null then
    delete from public.dias_plan where version_id = p_plan_id;

    for v_dia in select * from jsonb_array_elements(p_dias)
    loop
      insert into public.dias_plan (version_id, indice_semanal, dia_programado, etiqueta)
      values (
        p_plan_id,
        (v_dia->>'indice_semanal')::int,
        v_dia->>'dia_programado',
        v_dia->>'etiqueta'
      )
      returning id into v_dia_id;

      if jsonb_typeof(v_dia->'items') = 'array' then
        v_orden := 0;
        for v_item in select * from jsonb_array_elements(v_dia->'items')
        loop
          v_orden := v_orden + 1;
          insert into public.items_plan (
            dia_id, ejercicio_id, criterio_id, orden, series,
            unidad_objetivo, objetivo_por_serie, descanso_seg,
            motivo_visible, carga, unidad_carga, calentamiento
          )
          values (
            v_dia_id,
            (v_item->>'ejercicio_id')::uuid,
            nullif(v_item->>'criterio_id', '')::uuid,
            coalesce((v_item->>'orden')::int, v_orden),
            (v_item->>'series')::int,
            coalesce(nullif(v_item->>'unidad_objetivo', ''), 'repeticiones'),
            (v_item->>'objetivo_por_serie')::int,
            coalesce((v_item->>'descanso_seg')::int, 60),
            v_item->>'motivo_visible',
            nullif(v_item->>'carga', '')::numeric,
            nullif(v_item->>'unidad_carga', ''),
            nullif(v_item->>'calentamiento', '')
          );
        end loop;
      end if;
    end loop;
  end if;

  v_nueva_revision := v_plan.revision + 1;

  update public.versiones_plan
  set
    revision = v_nueva_revision,
    motivo_cambio = coalesce(p_motivo_cambio, motivo_cambio)
  where id = p_plan_id;

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'revision', v_nueva_revision,
    'version_catalogo', v_plan.version_catalogo
  );
end;
$$;

-- 3. Aprobar y publicar versión atómicamente (archiva versión vigente previa)
-- Parámetros: p_plan_id uuid, p_revision_esperada int, p_aprobado_por_id uuid
-- Retorno: jsonb { plan_id, atleta_id, anterior_version_id, estado, revision, version_catalogo }
-- Errores: PLAN_NO_ENCONTRADO (P0002), PLAN_HISTORICO_NO_APROBABLE (P0001),
--          CONFLICTO_REVISION_ESPERADA (40001), VERSION_BASE_NO_VIGENTE (P0001)
create or replace function public.aprobar_version_plan(
  p_plan_id uuid,
  p_revision_esperada int,
  p_aprobado_por_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_plan public.versiones_plan%rowtype;
  v_base_estado text;
  v_anterior_id uuid;
begin
  select * into v_plan
  from public.versiones_plan
  where id = p_plan_id
  for update;

  if not found then
    raise exception 'PLAN_NO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if v_plan.estado = 'vigente' then
    return jsonb_build_object(
      'plan_id', v_plan.id,
      'atleta_id', v_plan.atleta_id,
      'estado', v_plan.estado,
      'revision', v_plan.revision,
      'version_catalogo', v_plan.version_catalogo
    );
  end if;

  if v_plan.estado = 'historica' then
    raise exception 'PLAN_HISTORICO_NO_APROBABLE' using errcode = 'P0001';
  end if;

  if v_plan.revision <> p_revision_esperada then
    raise exception 'CONFLICTO_REVISION_ESPERADA' using errcode = '40001';
  end if;

  if v_plan.version_base_id is not null then
    select estado into v_base_estado
    from public.versiones_plan
    where id = v_plan.version_base_id;

    if v_base_estado is distinct from 'vigente' then
      raise exception 'VERSION_BASE_NO_VIGENTE' using errcode = 'P0001';
    end if;
  end if;

  select id into v_anterior_id
  from public.versiones_plan
  where atleta_id = v_plan.atleta_id
    and estado = 'vigente'
    and id <> p_plan_id
  for update;

  if v_anterior_id is not null then
    update public.versiones_plan
    set estado = 'historica'
    where id = v_anterior_id;
  end if;

  update public.versiones_plan
  set
    estado = 'vigente',
    aprobado_por_id = p_aprobado_por_id,
    aprobado_en = now()
  where id = p_plan_id;

  return jsonb_build_object(
    'plan_id', v_plan.id,
    'atleta_id', v_plan.atleta_id,
    'anterior_version_id', v_anterior_id,
    'estado', 'vigente',
    'revision', v_plan.revision,
    'version_catalogo', v_plan.version_catalogo
  );
end;
$$;