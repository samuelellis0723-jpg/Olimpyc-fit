import { createClient } from '@supabase/supabase-js';

function crearClienteSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function errorHttp(status, codigo, mensaje, extra = {}) {
  const err = new Error(mensaje);
  err.status = status;
  err.codigo = codigo;
  Object.assign(err, extra);
  return err;
}

export function crearRepositorioOperacionSupabase() {
  const supabase = crearClienteSupabase();

  async function obtenerPerfilActor(usuarioId) {
    const { data, error } = await supabase
      .from('miembros')
      .select('id, gimnasio_id, rol, nombre, alias_visible, codigo_demo')
      .eq('id', usuarioId)
      .maybeSingle();

    if (error) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', error.message);
    if (!data) throw errorHttp(404, 'NO_ENCONTRADO', 'Perfil de miembro no encontrado');

    return {
      usuarioId: data.id,
      gimnasioId: data.gimnasio_id,
      rol: data.rol,
      nombre: data.nombre,
      aliasVisible: data.alias_visible,
    };
  }

  async function listarClientesAsignados({ gimnasioId, entrenadorId }) {
    const { data, error } = await supabase
      .from('asignaciones')
      .select(`
        id,
        fecha_inicio,
        atleta:miembros!asignaciones_atleta_id_fkey (
          id,
          nombre,
          alias_visible,
          rol
        )
      `)
      .eq('gimnasio_id', gimnasioId)
      .eq('entrenador_id', entrenadorId)
      .is('fecha_fin', null)
      .order('fecha_inicio', { ascending: true });

    if (error) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', error.message);

    return (data || [])
      .filter((row) => row.atleta)
      .map((row) => ({
        asignacionId: row.id,
        fechaInicio: row.fecha_inicio,
        atletaId: row.atleta.id,
        nombre: row.atleta.nombre,
        aliasVisible: row.atleta.alias_visible,
      }));
  }

  async function obtenerEntrenadorAsignado({ gimnasioId, atletaId }) {
    const { data, error } = await supabase
      .from('asignaciones')
      .select('entrenador_id')
      .eq('gimnasio_id', gimnasioId)
      .eq('atleta_id', atletaId)
      .is('fecha_fin', null)
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', error.message);
    return data?.entrenador_id || null;
  }

  async function listarEvaluaciones({ gimnasioId, atletaId, incluirPrivadas }) {
    const { data, error } = await supabase
      .from('evaluaciones')
      .select('*')
      .eq('gimnasio_id', gimnasioId)
      .eq('atleta_id', atletaId)
      .order('fecha', { ascending: false });

    if (error) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', error.message);

    const ids = (data || []).map((e) => e.id);
    let medicionesPorEval = new Map();

    if (ids.length > 0) {
      const { data: meds, error: errMeds } = await supabase
        .from('mediciones')
        .select('*')
        .in('evaluacion_id', ids)
        .order('fecha', { ascending: true });

      if (errMeds) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', errMeds.message);

      for (const m of meds || []) {
        const lista = medicionesPorEval.get(m.evaluacion_id) || [];
        lista.push(mapearMedicion(m));
        medicionesPorEval.set(m.evaluacion_id, lista);
      }
    }

    return (data || []).map((ev) =>
      mapearEvaluacion(ev, medicionesPorEval.get(ev.id) || [], incluirPrivadas)
    );
  }

  async function obtenerEvaluacionPorId({ gimnasioId, evaluacionId, incluirPrivadas }) {
    const { data, error } = await supabase
      .from('evaluaciones')
      .select('*')
      .eq('gimnasio_id', gimnasioId)
      .eq('id', evaluacionId)
      .maybeSingle();

    if (error) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', error.message);
    if (!data) throw errorHttp(404, 'NO_ENCONTRADO', 'Evaluación no encontrada');

    const { data: meds, error: errMeds } = await supabase
      .from('mediciones')
      .select('*')
      .eq('evaluacion_id', evaluacionId)
      .order('fecha', { ascending: true });

    if (errMeds) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', errMeds.message);

    return mapearEvaluacion(
      data,
      (meds || []).map(mapearMedicion),
      incluirPrivadas
    );
  }

  async function crearEvaluacion({
    gimnasioId,
    atletaId,
    autorId,
    payload,
  }) {
    const fecha = payload.fecha || new Date().toISOString();

    const { data: creada, error } = await supabase
      .from('evaluaciones')
      .insert({
        gimnasio_id: gimnasioId,
        atleta_id: atletaId,
        autor_id: autorId,
        fecha,
        modalidad: payload.modalidad,
        objetivo: payload.objetivo,
        disponibilidad_semanal: payload.disponibilidadSemanal ?? null,
        nivel_observado: payload.nivelObservado ?? null,
        estado_nivel: payload.estadoNivel || 'observado',
        restricciones: payload.restricciones ?? null,
        observaciones_privadas: payload.observacionesPrivadas ?? null,
        notas: payload.notas ?? null,
        proxima_revision: payload.proximaRevision ?? null,
      })
      .select('*')
      .single();

    if (error) throw errorHttp(422, 'SOLICITUD_INVALIDA', error.message);

    let medicionesCreadas = [];
    if (Array.isArray(payload.mediciones) && payload.mediciones.length > 0) {
      const filas = payload.mediciones.map((m) => ({
        evaluacion_id: creada.id,
        variable: m.variable,
        origen: m.origen || 'observado',
        fecha: m.fecha || fecha,
        estado: m.estado || (m.valor !== undefined && m.valor !== null ? 'medido' : 'pendiente'),
        valor: m.valor ?? null,
        unidad: m.unidad ?? null,
        fuente: m.fuente ?? null,
      }));

      const { data: meds, error: errMeds } = await supabase
        .from('mediciones')
        .insert(filas)
        .select('*');

      if (errMeds) throw errorHttp(422, 'SOLICITUD_INVALIDA', errMeds.message);
      medicionesCreadas = (meds || []).map(mapearMedicion);
    }

    return mapearEvaluacion(creada, medicionesCreadas, true);
  }

  async function actualizarEvaluacion({ gimnasioId, evaluacionId, cambios }) {
    const patch = {};
    if (cambios.modalidad !== undefined) patch.modalidad = cambios.modalidad;
    if (cambios.objetivo !== undefined) patch.objetivo = cambios.objetivo;
    if (cambios.disponibilidadSemanal !== undefined) {
      patch.disponibilidad_semanal = cambios.disponibilidadSemanal;
    }
    if (cambios.nivelObservado !== undefined) {
      patch.nivel_observado = cambios.nivelObservado;
    }
    if (cambios.estadoNivel !== undefined) patch.estado_nivel = cambios.estadoNivel;
    if (cambios.restricciones !== undefined) patch.restricciones = cambios.restricciones;
    if (cambios.observacionesPrivadas !== undefined) {
      patch.observaciones_privadas = cambios.observacionesPrivadas;
    }
    if (cambios.notas !== undefined) patch.notas = cambios.notas;
    if (cambios.proximaRevision !== undefined) {
      patch.proxima_revision = cambios.proximaRevision;
    }

    const { data, error } = await supabase
      .from('evaluaciones')
      .update(patch)
      .eq('gimnasio_id', gimnasioId)
      .eq('id', evaluacionId)
      .select('*')
      .maybeSingle();

    if (error) throw errorHttp(422, 'SOLICITUD_INVALIDA', error.message);
    if (!data) throw errorHttp(404, 'NO_ENCONTRADO', 'Evaluación no encontrada');

    return obtenerEvaluacionPorId({
      gimnasioId,
      evaluacionId,
      incluirPrivadas: true,
    });
  }

  async function registrarMediciones({ evaluacionId, mediciones }) {
    const ahora = new Date().toISOString();
    const filas = mediciones.map((m) => ({
      evaluacion_id: evaluacionId,
      variable: m.variable,
      origen: m.origen || 'observado',
      fecha: m.fecha || ahora,
      estado: m.estado || (m.valor !== undefined && m.valor !== null ? 'medido' : 'pendiente'),
      valor: m.valor ?? null,
      unidad: m.unidad ?? null,
      fuente: m.fuente ?? null,
    }));

    const { data, error } = await supabase
      .from('mediciones')
      .insert(filas)
      .select('*');

    if (error) throw errorHttp(422, 'SOLICITUD_INVALIDA', error.message);
    return (data || []).map(mapearMedicion);
  }

  async function iniciarSesion({
    gimnasioId,
    atletaId,
    versionId,
    diaId,
    itemActivoId = null,
    estacionActual = null,
  }) {
    const { data: version, error: errVer } = await supabase
      .from('versiones_plan')
      .select('id, atleta_id, gimnasio_id, estado')
      .eq('id', versionId)
      .eq('gimnasio_id', gimnasioId)
      .eq('atleta_id', atletaId)
      .maybeSingle();

    if (errVer) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', errVer.message);
    if (!version || version.estado !== 'vigente') {
      throw errorHttp(422, 'SOLICITUD_INVALIDA', 'La versión de plan no existe o no está vigente');
    }

    const { data: sesion, error } = await supabase
      .from('sesiones')
      .insert({
        gimnasio_id: gimnasioId,
        atleta_id: atletaId,
        version_id: versionId,
        dia_id: diaId,
        inicio_utc: new Date().toISOString(),
        estado: 'activa',
        item_activo_id: itemActivoId,
        estacion_actual: estacionActual,
      })
      .select('*')
      .single();

    if (error) throw errorHttp(422, 'SOLICITUD_INVALIDA', error.message);
    return mapearSesion(sesion, []);
  }

  async function obtenerSesionPorId({ gimnasioId, sesionId }) {
    const { data, error } = await supabase
      .from('sesiones')
      .select('*')
      .eq('gimnasio_id', gimnasioId)
      .eq('id', sesionId)
      .maybeSingle();

    if (error) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', error.message);
    if (!data) throw errorHttp(404, 'NO_ENCONTRADO', 'Sesión no encontrada');

    const { data: seriesData, error: errSeries } = await supabase
      .from('series')
      .select('*')
      .eq('sesion_id', sesionId)
      .order('numero_serie', { ascending: true });

    if (errSeries) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', errSeries.message);
    return mapearSesion(data, (seriesData || []).map(mapearSerie));
  }

  async function listarSesionesAtleta({ gimnasioId, atletaId }) {
    const { data, error } = await supabase
      .from('sesiones')
      .select('*')
      .eq('gimnasio_id', gimnasioId)
      .eq('atleta_id', atletaId)
      .order('inicio_utc', { ascending: false })
      .limit(20);

    if (error) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', error.message);
    return (data || []).map((s) => mapearSesion(s, []));
  }

  async function actualizarSesion({ gimnasioId, sesionId, cambios }) {
    const patch = {};
    if (cambios.estado !== undefined) {
      patch.estado = cambios.estado;
      if (['completa', 'parcial'].includes(cambios.estado) && !cambios.finUtc) {
        patch.fin_utc = new Date().toISOString();
      }
    }
    if (cambios.finUtc !== undefined) patch.fin_utc = cambios.finUtc;
    if (cambios.itemActivoId !== undefined) patch.item_activo_id = cambios.itemActivoId;
    if (cambios.estacionActual !== undefined) patch.estacion_actual = cambios.estacionActual;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from('sesiones')
        .update(patch)
        .eq('gimnasio_id', gimnasioId)
        .eq('id', sesionId);

      if (error) throw errorHttp(422, 'SOLICITUD_INVALIDA', error.message);
    }

    if (cambios.serie) {
      const s = cambios.serie;
      const { error: errSerie } = await supabase.from('series').insert({
        sesion_id: sesionId,
        item_id: s.itemId,
        numero_serie: s.numeroSerie,
        instante_utc: s.instanteUtc || new Date().toISOString(),
        repeticiones: s.repeticiones ?? null,
        segundos_realizados: s.segundosRealizados ?? null,
      });

      if (errSerie) throw errorHttp(422, 'SOLICITUD_INVALIDA', errSerie.message);
    }

    return obtenerSesionPorId({ gimnasioId, sesionId });
  }

  async function crearAsistencia({
    gimnasioId,
    atletaId,
    sesionId,
    ejercicioCapturado = null,
    estacionCapturada = null,
  }) {
    const entrenadorId = await obtenerEntrenadorAsignado({ gimnasioId, atletaId });
    if (!entrenadorId) {
      throw errorHttp(422, 'SOLICITUD_INVALIDA', 'El atleta no tiene entrenador asignado activo');
    }

    const { data: pendientes, error: errPend } = await supabase
      .from('asistencias')
      .select('orden_turno')
      .eq('gimnasio_id', gimnasioId)
      .eq('entrenador_id', entrenadorId)
      .eq('estado', 'pendiente')
      .order('orden_turno', { ascending: false })
      .limit(1);

    if (errPend) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', errPend.message);

    const siguienteTurno = (pendientes?.[0]?.orden_turno || 0) + 1;

    const { data, error } = await supabase
      .from('asistencias')
      .insert({
        gimnasio_id: gimnasioId,
        sesion_id: sesionId,
        atleta_id: atletaId,
        entrenador_id: entrenadorId,
        orden_turno: siguienteTurno,
        hora_recibida_utc: new Date().toISOString(),
        estado: 'pendiente',
        ejercicio_capturado: ejercicioCapturado,
        estacion_capturada: estacionCapturada,
        hora_atencion_utc: null,
      })
      .select('*')
      .single();

    if (error) throw errorHttp(422, 'SOLICITUD_INVALIDA', error.message);
    return mapearAsistencia(data);
  }

  async function listarAsistenciasEntrenador({ gimnasioId, entrenadorId }) {
    const { data, error } = await supabase
      .from('asistencias')
      .select(`
        *,
        atleta:miembros!asistencias_atleta_id_fkey (
          id,
          nombre,
          alias_visible
        )
      `)
      .eq('gimnasio_id', gimnasioId)
      .eq('entrenador_id', entrenadorId)
      .order('estado', { ascending: false })
      .order('orden_turno', { ascending: true });

    if (error) throw errorHttp(503, 'PROVEEDOR_NO_DISPONIBLE', error.message);
    return (data || []).map((row) => ({
      ...mapearAsistencia(row),
      atletaNombre: row.atleta?.nombre || null,
      atletaAlias: row.atleta?.alias_visible || null,
    }));
  }

  async function actualizarAsistencia({ gimnasioId, asistenciaId, entrenadorId, estado }) {
    const patch = { estado };
    if (estado === 'atendida') {
      patch.hora_atencion_utc = new Date().toISOString();
    } else if (estado === 'pendiente') {
      patch.hora_atencion_utc = null;
    }

    const { data, error } = await supabase
      .from('asistencias')
      .update(patch)
      .eq('gimnasio_id', gimnasioId)
      .eq('id', asistenciaId)
      .eq('entrenador_id', entrenadorId)
      .select('*')
      .maybeSingle();

    if (error) throw errorHttp(422, 'SOLICITUD_INVALIDA', error.message);
    if (!data) throw errorHttp(404, 'NO_ENCONTRADO', 'Asistencia no encontrada');
    return mapearAsistencia(data);
  }

  return {
    obtenerPerfilActor,
    listarClientesAsignados,
    listarEvaluaciones,
    obtenerEvaluacionPorId,
    crearEvaluacion,
    actualizarEvaluacion,
    registrarMediciones,
    iniciarSesion,
    obtenerSesionPorId,
    listarSesionesAtleta,
    actualizarSesion,
    crearAsistencia,
    listarAsistenciasEntrenador,
    actualizarAsistencia,
  };
}

function mapearEvaluacion(ev, mediciones, incluirPrivadas) {
  const res = {
    evaluacionId: ev.id,
    codigoRef: ev.codigo_ref,
    atletaId: ev.atleta_id,
    autorId: ev.autor_id,
    fecha: ev.fecha,
    modalidad: ev.modalidad,
    objetivo: ev.objetivo,
    disponibilidadSemanal: ev.disponibilidad_semanal,
    nivelObservado: ev.nivel_observado,
    estadoNivel: ev.estado_nivel,
    restricciones: ev.restricciones,
    notas: ev.notas,
    proximaRevision: ev.proxima_revision,
    mediciones,
  };
  if (incluirPrivadas) {
    res.observacionesPrivadas = ev.observaciones_privadas;
  }
  return res;
}

function mapearMedicion(m) {
  return {
    medicionId: m.id,
    evaluacionId: m.evaluacion_id,
    variable: m.variable,
    origen: m.origen,
    fecha: m.fecha,
    estado: m.estado,
    valor: m.valor,
    unidad: m.unidad,
    fuente: m.fuente,
  };
}

function mapearSesion(s, series) {
  return {
    sesionId: s.id,
    codigoRef: s.codigo_ref,
    atletaId: s.atleta_id,
    versionId: s.version_id,
    diaId: s.dia_id,
    inicioUtc: s.inicio_utc,
    finUtc: s.fin_utc,
    estado: s.estado,
    itemActivoId: s.item_activo_id,
    estacionActual: s.estacion_actual,
    series,
  };
}

function mapearSerie(s) {
  return {
    serieId: s.id,
    sesionId: s.sesion_id,
    itemId: s.item_id,
    numeroSerie: s.numero_serie,
    instanteUtc: s.instante_utc,
    repeticiones: s.repeticiones,
    segundosRealizados: s.segundos_realizados,
  };
}

function mapearAsistencia(a) {
  return {
    asistenciaId: a.id,
    codigoRef: a.codigo_ref,
    sesionId: a.sesion_id,
    atletaId: a.atleta_id,
    entrenadorId: a.entrenador_id,
    ordenTurno: a.orden_turno,
    horaRecibidaUtc: a.hora_recibida_utc,
    estado: a.estado,
    ejercicioCapturado: a.ejercicio_capturado,
    estacionCapturada: a.estacion_capturada,
    horaAtencionUtc: a.hora_atencion_utc,
  };
}