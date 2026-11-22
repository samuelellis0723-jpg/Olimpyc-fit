import { supabase } from '../db/supabase.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function esUuid(valor) {
  return typeof valor === 'string' && UUID_REGEX.test(valor);
}

function normalizarDiaIso(valor) {
  if (typeof valor === 'number' && valor >= 1 && valor <= 7) return valor;
  const mapa = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    sábado: 6,
    domingo: 7,
  };
  const clave = String(valor ?? '').trim().toLowerCase();
  return mapa[clave] ?? 1;
}

function crearErrorDominio(status, codigo, mensaje, extra = {}) {
  const err = new Error(mensaje);
  err.status = status;
  err.codigo = codigo;
  Object.assign(err, extra);
  return err;
}

async function hidratarPlanDesdeFila(filaVersion) {
  if (!filaVersion) return null;

  const { data: diasRows, error: diasErr } = await supabase
    .from('dias_plan')
    .select('id, indice_semanal, dia_programado, etiqueta')
    .eq('version_id', filaVersion.id)
    .order('indice_semanal', { ascending: true });

  if (diasErr) throw diasErr;

  const diaIds = (diasRows ?? []).map((d) => d.id);
  let itemsRows = [];

  if (diaIds.length > 0) {
    const { data: itemsData, error: itemsErr } = await supabase
      .from('items_plan')
      .select('*')
      .in('dia_id', diaIds)
      .order('orden', { ascending: true });

    if (itemsErr) throw itemsErr;
    itemsRows = itemsData ?? [];
  }

  const itemsPorDia = new Map();
  for (const it of itemsRows) {
    const lista = itemsPorDia.get(it.dia_id) ?? [];
    lista.push({
      itemId: it.id,
      ejercicioId: it.ejercicio_id,
      orden: it.orden,
      series: it.series,
      objetivoPorSerie: {
        cantidad: Number(it.objetivo_por_serie ?? 10),
        unidad: it.unidad_objetivo === 'segundos' ? 'segundos' : 'repeticiones',
      },
      descansoSegundos: Number(it.descanso_seg ?? 60),
      explicacion: it.motivo_visible ?? '',
      criterioId: it.criterio_id ?? '',
      datosUtilizados: ['objetivo'],
    });
    itemsPorDia.set(it.dia_id, lista);
  }

  return {
    versionId: filaVersion.id,
    ...(filaVersion.version_base_id ? { versionBaseId: filaVersion.version_base_id } : {}),
    gimnasioId: filaVersion.gimnasio_id,
    atletaId: filaVersion.atleta_id,
    evaluacionId: filaVersion.evaluacion_id,
    origen: filaVersion.origen === 'DeepSeek' ? 'DeepSeek' : 'manual',
    estado: filaVersion.estado,
    revision: Number(filaVersion.revision ?? 1),
    catalogoVersion: filaVersion.version_catalogo ?? 'v1',
    dias: (diasRows ?? []).map((d) => ({
      diaId: d.id,
      diaSemana: normalizarDiaIso(d.indice_semanal ?? d.dia_programado),
      items: itemsPorDia.get(d.id) ?? [],
    })),
    creadoEn: filaVersion.creado_en,
    ...(filaVersion.proxima_revision ? { proximaRevision: filaVersion.proxima_revision } : {}),
    ...(filaVersion.motivo_cambio ? { motivo: filaVersion.motivo_cambio } : {}),
    ...(filaVersion.aprobado_por_id
      ? {
          aprobacion: {
            aprobadorId: filaVersion.aprobado_por_id,
            fecha: filaVersion.aprobado_en ?? filaVersion.creado_en,
          },
        }
      : {}),
  };
}

export function crearRepositorioPlanificacionSupabase() {
  async function obtenerPorId({ gimnasioId, versionId }) {
    let query = supabase
      .from('versiones_plan')
      .select('*')
      .eq('gimnasio_id', gimnasioId);

    query = esUuid(versionId)
      ? query.eq('id', versionId)
      : query.eq('codigo_ref', versionId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return hidratarPlanDesdeFila(data);
  }

  async function obtenerVigente({ gimnasioId, atletaId }) {
    const { data, error } = await supabase
      .from('versiones_plan')
      .select('*')
      .eq('gimnasio_id', gimnasioId)
      .eq('atleta_id', atletaId)
      .eq('estado', 'vigente')
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return hidratarPlanDesdeFila(data);
  }

  async function crearBorrador({ gimnasioId, atletaId, plan }) {
    const versionBaseId = plan.versionBaseId ?? null;

    if (versionBaseId) {
      const { data: baseRow, error: baseErr } = await supabase
        .from('versiones_plan')
        .select('id, estado')
        .eq('id', versionBaseId)
        .eq('gimnasio_id', gimnasioId)
        .maybeSingle();

      if (baseErr) throw baseErr;
      if (!baseRow || baseRow.estado !== 'vigente') {
        throw crearErrorDominio(
          409,
          'BASE_NO_VIGENTE',
          'La versión base de reorganización ya no está vigente'
        );
      }
    }

    const { data: insertada, error: insErr } = await supabase
      .from('versiones_plan')
      .insert({
        gimnasio_id: gimnasioId,
        atleta_id: atletaId,
        evaluacion_id: plan.evaluacionId,
        version_base_id: versionBaseId,
        estado: 'borrador',
        origen: plan.origen === 'DeepSeek' ? 'DeepSeek' : 'manual',
        revision: 1,
        version_catalogo: plan.catalogoVersion ?? 'v1',
        motivo_cambio: plan.motivo ?? null,
        proxima_revision: plan.proximaRevision ?? null,
      })
      .select('*')
      .single();

    if (insErr) throw insErr;

    for (const dia of plan.dias ?? []) {
      const diaSemana = normalizarDiaIso(dia.diaSemana);
      const { data: diaInsertado, error: diaErr } = await supabase
        .from('dias_plan')
        .insert({
          version_id: insertada.id,
          indice_semanal: diaSemana,
          dia_programado: String(diaSemana),
          etiqueta: `Día ${diaSemana}`,
        })
        .select('id')
        .single();

      if (diaErr) throw diaErr;

      if (Array.isArray(dia.items) && dia.items.length > 0) {
        const filasItems = dia.items.map((item, idx) => ({
          dia_id: diaInsertado.id,
          ejercicio_id: item.ejercicioId,
          criterio_id: item.criterioId || null,
          orden: Number(item.orden ?? idx + 1),
          series: Number(item.series ?? 1),
          unidad_objetivo: item.objetivoPorSerie?.unidad ?? 'repeticiones',
          objetivo_por_serie: Number(item.objetivoPorSerie?.cantidad ?? 10),
          descanso_seg: Number(item.descansoSegundos ?? 60),
          motivo_visible: item.explicacion ?? null,
        }));

        const { error: itemsErr } = await supabase.from('items_plan').insert(filasItems);
        if (itemsErr) throw itemsErr;
      }
    }

    return hidratarPlanDesdeFila(insertada);
  }

  async function guardarRevision({ gimnasioId, versionId, revisionEsperada, cambios = {} }) {
    const actual = await obtenerPorId({ gimnasioId, versionId });
    if (!actual) {
      throw crearErrorDominio(404, 'NO_ENCONTRADO', 'Plan no encontrado');
    }

    const diasPayload = Array.isArray(cambios.dias)
      ? cambios.dias.map((d) => ({
          indice_semanal: normalizarDiaIso(d.diaSemana),
          dia_programado: String(normalizarDiaIso(d.diaSemana)),
          etiqueta: `Día ${normalizarDiaIso(d.diaSemana)}`,
          items: (d.items ?? []).map((it, idx) => ({
            ejercicio_id: it.ejercicioId,
            criterio_id: it.criterioId || null,
            orden: Number(it.orden ?? idx + 1),
            series: Number(it.series ?? 1),
            unidad_objetivo: it.objetivoPorSerie?.unidad ?? 'repeticiones',
            objetivo_por_serie: Number(it.objetivoPorSerie?.cantidad ?? 10),
            descanso_seg: Number(it.descansoSegundos ?? 60),
            motivo_visible: it.explicacion ?? null,
          })),
        }))
      : null;

    const { error: rpcErr } = await supabase.rpc('guardar_revision_plan', {
      p_plan_id: actual.versionId,
      p_revision_esperada: Number(revisionEsperada),
      p_dias: diasPayload,
      p_motivo_cambio: cambios.motivo ?? null,
    });

    if (rpcErr) {
      const msg = String(rpcErr.message ?? '');
      if (msg.includes('CONFLICTO_REVISION_ESPERADA')) {
        throw crearErrorDominio(409, 'REVISION_CONFLICTIVA', 'Conflicto de revisión', {
          revisionActual: actual.revision,
        });
      }
      if (msg.includes('VERSION_BASE_NO_VIGENTE')) {
        throw crearErrorDominio(409, 'BASE_NO_VIGENTE', 'La versión base ya no está vigente');
      }
      if (msg.includes('PLAN_NO_ENCONTRADO')) {
        throw crearErrorDominio(404, 'NO_ENCONTRADO', 'Plan no encontrado');
      }
      throw rpcErr;
    }

    if (cambios.proximaRevision !== undefined) {
      const { error: proxErr } = await supabase
        .from('versiones_plan')
        .update({ proxima_revision: cambios.proximaRevision })
        .eq('id', actual.versionId)
        .eq('gimnasio_id', gimnasioId);

      if (proxErr) throw proxErr;
    }

    return obtenerPorId({ gimnasioId, versionId: actual.versionId });
  }

  async function aprobar({ gimnasioId, versionId, revisionEsperada, aprobadorId }) {
    const actual = await obtenerPorId({ gimnasioId, versionId });
    if (!actual) {
      throw crearErrorDominio(404, 'NO_ENCONTRADO', 'Plan no encontrado');
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('aprobar_version_plan', {
      p_plan_id: actual.versionId,
      p_revision_esperada: Number(revisionEsperada),
      p_aprobado_por_id: aprobadorId,
    });

    if (rpcErr) {
      const msg = String(rpcErr.message ?? '');
      if (msg.includes('CONFLICTO_REVISION_ESPERADA')) {
        throw crearErrorDominio(409, 'REVISION_CONFLICTIVA', 'Conflicto de revisión', {
          revisionActual: actual.revision,
        });
      }
      if (msg.includes('VERSION_BASE_NO_VIGENTE')) {
        throw crearErrorDominio(409, 'BASE_NO_VIGENTE', 'La versión base ya no está vigente');
      }
      if (msg.includes('PLAN_NO_ENCONTRADO')) {
        throw crearErrorDominio(404, 'NO_ENCONTRADO', 'Plan no encontrado');
      }
      throw rpcErr;
    }

    const planActualizado = await obtenerPorId({ gimnasioId, versionId: actual.versionId });
    const anteriorId = rpcData?.anterior_version_id ?? null;
    const anterior = anteriorId
      ? await obtenerPorId({ gimnasioId, versionId: anteriorId })
      : null;

    return {
      plan: planActualizado,
      anterior,
    };
  }

  return {
    obtenerPorId,
    obtenerVigente,
    crearBorrador,
    guardarRevision,
    aprobar,
  };
}