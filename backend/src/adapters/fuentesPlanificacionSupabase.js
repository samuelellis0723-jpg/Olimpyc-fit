import { supabaseAdmin } from '../db/supabase.js';

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
    'miércoles': 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    'sábado': 6,
    domingo: 7,
  };
  const clave = String(valor ?? '').trim().toLowerCase();
  return mapa[clave] ?? 1;
}

function mapearDisponibilidadSemanalADias(cantidad) {
  const n = Number(cantidad);
  if (n === 1) return [1];
  if (n === 2) return [1, 4];
  if (n === 3) return [1, 3, 5];
  if (n === 4) return [1, 2, 4, 5];
  if (n === 5) return [1, 2, 3, 4, 5];
  if (n === 6) return [1, 2, 3, 4, 5, 6];
  if (n >= 7) return [1, 2, 3, 4, 5, 6, 7];
  return [1, 4];
}

export async function obtenerEvaluacion({ gimnasioId, atletaId, evaluacionId }) {
  let query = supabaseAdmin
    .from('evaluaciones')
    .select(
      'id, codigo_ref, gimnasio_id, atleta_id, autor_id, fecha, modalidad, objetivo, disponibilidad_semanal, nivel_observado, estado_nivel, restricciones, creado_en'
    )
    .eq('gimnasio_id', gimnasioId)
    .eq('atleta_id', atletaId);

  query = esUuid(evaluacionId)
    ? query.eq('id', evaluacionId)
    : query.eq('codigo_ref', evaluacionId);

  const { data: ev, error } = await query.maybeSingle();
  if (error) throw error;
  if (!ev) return null;

  const { data: mediciones, error: medError } = await supabaseAdmin
    .from('mediciones')
    .select('*')
    .eq('evaluacion_id', ev.id);

  if (medError) throw medError;

  const fechaIso = String(ev.fecha ?? ev.creado_en ?? '').slice(0, 10);
  const restriccionesLista = ev.restricciones
    ? String(ev.restricciones)
        .split(/[,;\n]+/)
        .map((r) => r.trim())
        .filter(Boolean)
    : [];

  const publicaciones = [];
  if (ev.nivel_observado) {
    publicaciones.push({
      dato: `nivel observado: ${ev.nivel_observado}`,
      fuente: 'entrenador',
    });
  }

  return {
    evaluacionId: ev.id,
    gimnasioId: ev.gimnasio_id,
    atletaId: ev.atleta_id,
    autorId: ev.autor_id,
    fecha: fechaIso,
    modalidad: ev.modalidad ?? 'gimnasio',
    objetivo: ev.objetivo ?? 'acondicionamiento',
    diasDisponibles: mapearDisponibilidadSemanalADias(ev.disponibilidad_semanal),
    ...(ev.nivel_observado ? { nivel: ev.nivel_observado } : {}),
    restricciones: restriccionesLista,
    publicaciones,
    mediciones: (mediciones ?? []).map((m) => ({
      variable: m.variable ?? m.nombre ?? 'medicion',
      estado: m.estado === 'pendiente' ? 'pendiente' : 'medida',
      ...(typeof m.valor === 'number' ? { valor: m.valor } : {}),
      ...(m.unidad ? { unidad: m.unidad } : {}),
      origen: m.origen ?? 'evaluacion',
      fecha: String(m.fecha ?? fechaIso).slice(0, 10),
    })),
  };
}

export async function obtenerCatalogo({ gimnasioId, catalogoVersion } = {}) {
  let queryEj = supabaseAdmin
    .from('ejercicios')
    .select('*')
    .eq('activo', true);

  if (catalogoVersion) {
    queryEj = queryEj.eq('version_catalogo', catalogoVersion);
  }

  const { data: ejerciciosRows, error: ejError } = await queryEj;
  if (ejError) throw ejError;

  const versionResuelta =
    catalogoVersion || ejerciciosRows?.[0]?.version_catalogo || 'v1';

  const { data: criteriosRows, error: critError } = await supabaseAdmin
    .from('criterios')
    .select('*')
    .eq('version', versionResuelta)
    .eq('estado_revision', 'aprobado');

  if (critError) throw critError;

  return {
    catalogoVersion: versionResuelta,
    ejercicios: (ejerciciosRows ?? []).map((e) => {
      const dosis = e.dosis_permitidas ?? {};
      const restr = e.restricciones_json ?? {};
      const unidadObj =
        dosis.unidad_objetivo === 'segundos' ? 'segundos' : 'repeticiones';

      return {
        ejercicioId: e.id,
        nombre: e.nombre,
        grupoMuscular: e.grupo_muscular ?? 'general',
        estaciones: Array.isArray(e.estaciones_permitidas)
          ? e.estaciones_permitidas
          : [],
        restriccionesIncompatibles: Array.isArray(restr.restricciones_incompatibles)
          ? restr.restricciones_incompatibles
          : [],
        dosis: {
          series: {
            min: Number(dosis.series_min ?? 1),
            max: Number(dosis.series_max ?? 4),
          },
          objetivoPorSerie: {
            unidad: unidadObj,
            min: Number(dosis.repeticiones_min ?? 6),
            max: Number(dosis.repeticiones_max ?? 15),
          },
          descansoSegundos: {
            min: Number(dosis.descanso_seg_min ?? 30),
            max: Number(dosis.descanso_seg_max ?? 120),
          },
        },
      };
    }),
    criterios: (criteriosRows ?? []).map((c) => ({
      criterioId: c.id,
      ejercicioId: c.ejercicio_id,
      version: c.version,
      texto: c.texto,
      procedencia: c.fuente ?? 'catalogo_profesional',
      estado: 'aprobado',
      revisorId: c.revisor_id ?? 'sistema',
      revisadoEn: c.fecha_revision ?? new Date().toISOString(),
    })),
  };
}

export async function obtenerHistorialEjecutado({ gimnasioId, atletaId }) {
  const { data: sesionesRows, error } = await supabaseAdmin
    .from('sesiones')
    .select('id, inicio_utc, estado, dia_id, dias_plan(dia_programado, indice_semanal), series(item_id, items_plan(ejercicio_id))')
    .eq('gimnasio_id', gimnasioId)
    .eq('atleta_id', atletaId)
    .in('estado', ['activa', 'completa', 'parcial']);

  if (error) throw error;

  return (sesionesRows ?? []).map((s) => {
    const diaRef =
      s.dias_plan?.indice_semanal ?? s.dias_plan?.dia_programado ?? 1;

    return {
      fecha: String(s.inicio_utc ?? '').slice(0, 10),
      estado: s.estado,
      diaSemana: normalizarDiaIso(diaRef),
      ejercicioIds: [
        ...new Set(
          (s.series ?? []).map((sr) => sr.items_plan?.ejercicio_id).filter(Boolean)
        ),
      ],
    };
  });
}
