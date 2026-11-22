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
