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
  v_dia_ids uuid[] := '{}';
  v_item jsonb;
  v_item_id uuid;
  v_item_ids uuid[];
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
    for v_dia in select * from jsonb_array_elements(p_dias)
    loop
      v_dia_id := coalesce(nullif(v_dia->>'id', '')::uuid, gen_random_uuid());
      v_dia_ids := array_append(v_dia_ids, v_dia_id);

      insert into public.dias_plan (
        id, version_id, indice_semanal, dia_programado, etiqueta
      )
      values (
        v_dia_id,
        p_plan_id,
        (v_dia->>'indice_semanal')::int,
        v_dia->>'dia_programado',
        v_dia->>'etiqueta'
      )
      on conflict (id) do update set
        version_id = excluded.version_id,
        indice_semanal = excluded.indice_semanal,
        dia_programado = excluded.dia_programado,
        etiqueta = excluded.etiqueta;

      v_item_ids := '{}';

      if jsonb_typeof(v_dia->'items') = 'array' then
        v_orden := 0;
        for v_item in select * from jsonb_array_elements(v_dia->'items')
        loop
          v_orden := v_orden + 1;
          v_item_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
          v_item_ids := array_append(v_item_ids, v_item_id);

          insert into public.items_plan (
            id, dia_id, ejercicio_id, criterio_id, orden, series,
            unidad_objetivo, objetivo_por_serie, descanso_seg,
            motivo_visible, carga, unidad_carga, calentamiento
          )
          values (
            v_item_id,
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
          )
          on conflict (id) do update set
            dia_id = excluded.dia_id,
            ejercicio_id = excluded.ejercicio_id,
            criterio_id = excluded.criterio_id,
            orden = excluded.orden,
            series = excluded.series,
            unidad_objetivo = excluded.unidad_objetivo,
            objetivo_por_serie = excluded.objetivo_por_serie,
            descanso_seg = excluded.descanso_seg,
            motivo_visible = excluded.motivo_visible,
            carga = excluded.carga,
            unidad_carga = excluded.unidad_carga,
            calentamiento = excluded.calentamiento;
        end loop;
      end if;

      delete from public.items_plan
      where dia_id = v_dia_id
        and (v_item_ids is null or not (id = any(v_item_ids)));
    end loop;

    delete from public.dias_plan
    where version_id = p_plan_id
      and (v_dia_ids is null or not (id = any(v_dia_ids)));
  end if;

  v_nueva_revision := v_plan.revision + 1;

  update public.versiones_plan
  set
    revision = v_nueva_revision,
    motivo_cambio = coalesce(p_motivo_cambio, motivo_cambio),
    actualizado_en = now()
  where id = p_plan_id;

  return jsonb_build_object(
    'versionId', p_plan_id,
    'revision', v_nueva_revision
  );
end;
$$;
