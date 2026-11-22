// Datos sintéticos de demostración. No representan personas ni cuentas reales.
export const evaluacionEva = {
  evaluacionId: 'EV1', gimnasioId: 'G1', atletaId: 'A1', autorId: 'T1',
  fecha: '2026-11-21', modalidad: 'presencial', objetivo: 'acondicionamiento general',
  diasDisponibles: [1, 4], nivel: 'inicial observado',
  observacion: 'La entrenadora observó la técnica inicial durante la sesión de ingreso.',
  restricciones: [],
  publicaciones: [{ dato: 'objetivo comunicado en la evaluación', fuente: 'atleta' }],
  mediciones: [],
};

export const evaluacionEvaIncompleta = {
  ...structuredClone(evaluacionEva), evaluacionId: 'EV_INCOMPLETA',
  objetivo: '', nivel: undefined, observacion: undefined,
};

export const catalogoDemo = {
  catalogoVersion: 'CAT-DEMO-1',
  ejercicios: [
    { ejercicioId: 'E1', nombre: 'Sentadilla a banco', grupoMuscular: 'piernas', estaciones: ['banco'], restriccionesIncompatibles: [], dosis: { series: { min: 1, max: 4 }, objetivoPorSerie: { unidad: 'repeticiones', min: 6, max: 15 }, descansoSegundos: { min: 30, max: 180 } } },
    { ejercicioId: 'E2', nombre: 'Press con mancuernas en banco', grupoMuscular: 'pecho', estaciones: ['banco', 'mancuernas'], restriccionesIncompatibles: [], dosis: { series: { min: 1, max: 4 }, objetivoPorSerie: { unidad: 'repeticiones', min: 6, max: 15 }, descansoSegundos: { min: 30, max: 180 } } },
  ],
  criterios: [
    { criterioId: 'CR1', ejercicioId: 'E1', version: '1', texto: 'Usar banco estable y rango cómodo.', procedencia: 'Guía profesional interna de demostración', estado: 'aprobado', revisorId: 'REV-DEMO', revisadoEn: '2026-11-20T12:00:00Z' },
    { criterioId: 'CR2', ejercicioId: 'E2', version: '1', texto: 'Mantener control del movimiento con mancuernas apropiadas.', procedencia: 'Guía profesional interna de demostración', estado: 'aprobado', revisorId: 'REV-DEMO', revisadoEn: '2026-11-20T12:00:00Z' },
  ],
};

export const actoresDemo = {
  entrenadoraEva: { usuarioId: 'T1', gimnasioId: 'G1', rol: 'entrenador' },
  entrenadorAjeno: { usuarioId: 'T2', gimnasioId: 'G1', rol: 'entrenador' },
  atletaEva: { usuarioId: 'A1', gimnasioId: 'G1', rol: 'atleta' },
  atletaOtroGimnasio: { usuarioId: 'A2', gimnasioId: 'G2', rol: 'atleta' },
};

export const historialEjecutadoEva = [
  { fecha: '2026-11-16', estado: 'completa', diaSemana: 1, ejercicioIds: ['E1'] },
];

const evaluaciones = new Map([
  ['EV1', evaluacionEva], ['EV_INCOMPLETA', evaluacionEvaIncompleta],
]);

export async function obtenerEvaluacion({ gimnasioId, atletaId, evaluacionId }) {
  const evaluacion = evaluaciones.get(evaluacionId);
  if (!evaluacion || evaluacion.gimnasioId !== gimnasioId || evaluacion.atletaId !== atletaId) return undefined;
  return structuredClone(evaluacion);
}

export async function obtenerCatalogo({ gimnasioId, catalogoVersion }) {
  return (
  gimnasioId === 'G1' && (catalogoVersion === undefined || catalogoVersion === catalogoDemo.catalogoVersion)
    ? structuredClone(catalogoDemo) : undefined
  );
}

export async function tieneAsignacion({ gimnasioId, entrenadorId, atletaId }) {
  return (
  gimnasioId === 'G1' && entrenadorId === 'T1' && atletaId === 'A1'
  );
}

export async function obtenerHistorialEjecutado({ gimnasioId, atletaId }) {
  return (
  gimnasioId === 'G1' && atletaId === 'A1' ? structuredClone(historialEjecutadoEva) : []
  );
}

export const fixturesDemo = {
  evaluacion: evaluacionEva,
  evaluacionIncompleta: evaluacionEvaIncompleta,
  catalogo: catalogoDemo,
  actores: actoresDemo,
  historialEjecutado: historialEjecutadoEva,
};

// UUID v4 ficticios deterministas para demo local; no corresponden a cuentas ni tablas reales en Supabase.
export const idsDemoUuid = Object.freeze({
  gimnasioG1: '11111111-1111-4111-8111-111111111111',
  gimnasioG2: '22222222-2222-4222-8222-222222222222',
  entrenadoraEva: '11111111-1111-4111-8111-111111111101',
  entrenadorAjeno: '11111111-1111-4111-8111-111111111102',
  atletaEva: '11111111-1111-4111-8111-111111111103',
  atletaOtroGimnasio: '22222222-2222-4222-8222-222222222204',
  evaluacionEva: '11111111-1111-4111-8111-111111111201',
  evaluacionEvaIncompleta: '11111111-1111-4111-8111-111111111202',
  ejercicioE1: '11111111-1111-4111-8111-111111111301',
  ejercicioE2: '11111111-1111-4111-8111-111111111302',
  criterioCR1: '11111111-1111-4111-8111-111111111401',
  criterioCR2: '11111111-1111-4111-8111-111111111402',
  revisorDemo: '11111111-1111-4111-8111-111111111501',
});

export const evaluacionEvaUuid = {
  ...structuredClone(evaluacionEva),
  evaluacionId: idsDemoUuid.evaluacionEva,
  gimnasioId: idsDemoUuid.gimnasioG1,
  atletaId: idsDemoUuid.atletaEva,
  autorId: idsDemoUuid.entrenadoraEva,
};

export const evaluacionEvaIncompletaUuid = {
  ...structuredClone(evaluacionEvaUuid),
  evaluacionId: idsDemoUuid.evaluacionEvaIncompleta,
  objetivo: '',
  nivel: undefined,
  observacion: undefined,
};

export const catalogoDemoUuid = {
  catalogoVersion: 'v1',
  ejercicios: [
    {
      ejercicioId: idsDemoUuid.ejercicioE1,
      nombre: 'Sentadilla a banco',
      grupoMuscular: 'piernas',
      estaciones: ['banco'],
      restriccionesIncompatibles: [],
      dosis: {
        series: { min: 1, max: 4 },
        objetivoPorSerie: { unidad: 'repeticiones', min: 6, max: 15 },
        descansoSegundos: { min: 30, max: 120 },
      },
    },
    {
      ejercicioId: idsDemoUuid.ejercicioE2,
      nombre: 'Press con mancuernas en banco',
      grupoMuscular: 'pecho',
      estaciones: ['banco', 'mancuernas'],
      restriccionesIncompatibles: [],
      dosis: {
        series: { min: 1, max: 4 },
        objetivoPorSerie: { unidad: 'repeticiones', min: 6, max: 15 },
        descansoSegundos: { min: 30, max: 120 },
      },
    },
  ],
  criterios: [
    {
      criterioId: idsDemoUuid.criterioCR1,
      ejercicioId: idsDemoUuid.ejercicioE1,
      version: 'v1',
      texto: 'Usar banco estable y rango cómodo.',
      procedencia: 'Guía profesional interna de demostración',
      estado: 'aprobado',
      revisorId: idsDemoUuid.revisorDemo,
      revisadoEn: '2026-11-20T12:00:00.000Z',
    },
    {
      criterioId: idsDemoUuid.criterioCR2,
      ejercicioId: idsDemoUuid.ejercicioE2,
      version: 'v1',
      texto: 'Mantener control del movimiento con mancuernas apropiadas.',
      procedencia: 'Guía profesional interna de demostración',
      estado: 'aprobado',
      revisorId: idsDemoUuid.revisorDemo,
      revisadoEn: '2026-11-20T12:00:00.000Z',
    },
  ],
};

export const actoresDemoUuid = {
  entrenadoraEva: { usuarioId: idsDemoUuid.entrenadoraEva, gimnasioId: idsDemoUuid.gimnasioG1, rol: 'entrenador' },
  entrenadorAjeno: { usuarioId: idsDemoUuid.entrenadorAjeno, gimnasioId: idsDemoUuid.gimnasioG1, rol: 'entrenador' },
  atletaEva: { usuarioId: idsDemoUuid.atletaEva, gimnasioId: idsDemoUuid.gimnasioG1, rol: 'atleta' },
  atletaOtroGimnasio: { usuarioId: idsDemoUuid.atletaOtroGimnasio, gimnasioId: idsDemoUuid.gimnasioG2, rol: 'atleta' },
};

export const historialEjecutadoEvaUuid = [
  { fecha: '2026-11-16', estado: 'completa', diaSemana: 1, ejercicioIds: [idsDemoUuid.ejercicioE1] },
];

export const fixturesDemoUuid = {
  ids: idsDemoUuid,
  evaluacion: evaluacionEvaUuid,
  evaluacionIncompleta: evaluacionEvaIncompletaUuid,
  catalogo: catalogoDemoUuid,
  actores: actoresDemoUuid,
  historialEjecutado: historialEjecutadoEvaUuid,
};

const evaluacionesUuid = new Map([
  [idsDemoUuid.evaluacionEva, evaluacionEvaUuid],
  [idsDemoUuid.evaluacionEvaIncompleta, evaluacionEvaIncompletaUuid],
]);

export function crearAdaptadoresDemo({ modoIds = 'codigos' } = {}) {
  if (!['codigos', 'uuid'].includes(modoIds)) {
    throw new Error("modoIds debe ser 'codigos' o 'uuid'.");
  }
  if (modoIds === 'codigos') {
    return {
      actores: actoresDemo,
      obtenerEvaluacion,
      obtenerCatalogo,
      tieneAsignacion,
      obtenerHistorialEjecutado,
    };
  }
  return {
    actores: actoresDemoUuid,
    async obtenerEvaluacion({ gimnasioId, atletaId, evaluacionId }) {
      const evaluacion = evaluacionesUuid.get(evaluacionId);
      if (!evaluacion || evaluacion.gimnasioId !== gimnasioId || evaluacion.atletaId !== atletaId) return undefined;
      return structuredClone(evaluacion);
    },
    async obtenerCatalogo({ gimnasioId, catalogoVersion }) {
      return gimnasioId === idsDemoUuid.gimnasioG1
        && (catalogoVersion === undefined || catalogoVersion === catalogoDemoUuid.catalogoVersion)
        ? structuredClone(catalogoDemoUuid)
        : undefined;
    },
    async tieneAsignacion({ gimnasioId, entrenadorId, atletaId }) {
      return gimnasioId === idsDemoUuid.gimnasioG1
        && entrenadorId === idsDemoUuid.entrenadoraEva
        && atletaId === idsDemoUuid.atletaEva;
    },
    async obtenerHistorialEjecutado({ gimnasioId, atletaId }) {
      return gimnasioId === idsDemoUuid.gimnasioG1 && atletaId === idsDemoUuid.atletaEva
        ? structuredClone(historialEjecutadoEvaUuid)
        : [];
    },
  };
}
