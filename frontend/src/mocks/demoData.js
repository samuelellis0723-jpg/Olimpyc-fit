export const DEMO_WARNING = 'Usa datos ficticios. No ingreses información real de salud.';

export const DEMO_CLIENT = Object.freeze({
  id: 'DEMO-A1',
  fullName: 'Ana',
  nationalId: '1023456789',
  trainerName: 'Eva',
  isDemo: true,
});

export const DEMO_EXERCISES = Object.freeze([
  { exerciseId: 'DEMO-E1', code: 'E1', name: 'Remo sentado', group: 'Pendiente de confirmar en catálogo' },
  { exerciseId: 'DEMO-E2', code: 'E2', name: 'Levantarse de un banco', group: 'Pendiente de confirmar en catálogo' },
]);

export const DEMO_APPROVED_PLAN = Object.freeze({
  versionId: 'DEMO-V1',
  gimnasioId: 'DEMO-G1',
  atletaId: 'DEMO-A1',
  estado: 'vigente',
  revision: 1,
  origen: 'manual',
  dias: Object.freeze([
    { diaId: 'DEMO-D1', diaSemana: 1, items: Object.freeze([]) },
    { diaId: 'DEMO-D2', diaSemana: 4, items: Object.freeze([]) },
  ]),
  demo: true,
});

export const DEMO_REORGANIZATION = Object.freeze({
  versionId: 'DEMO-V2',
  versionBaseId: 'DEMO-V1',
  gimnasioId: 'DEMO-G1',
  atletaId: 'DEMO-A1',
  estado: 'borrador',
  revision: 1,
  origen: 'manual',
  dias: Object.freeze([
    { diaId: 'DEMO-D1-V2', diaSemana: 1, items: Object.freeze([]) },
    { diaId: 'DEMO-D2-V2', diaSemana: 4, items: Object.freeze([]) },
    { diaId: 'DEMO-D3-V2', diaSemana: 6, items: Object.freeze([]) },
  ]),
  diferencias: Object.freeze({
    mantenidos: [],
    movidos: [],
    agregados: [],
    retirados: [],
    explicacion: 'La propuesta demo agrega disponibilidad para el sábado. Falta registrar los ejercicios del borrador.',
  }),
  demo: true,
});

export const DEMO_REQUESTS = Object.freeze([
  Object.freeze({
    solicitudId: 'DEMO-Q1',
    atleta: 'Ana',
    ejercicio: 'Ejercicio sin indicar',
    estacion: 'Pendiente de registro',
    receivedAt: '09:41',
    estado: 'pendiente',
    demo: true,
  }),
]);

export const SIMULATED_MONDAY_FOCUS = Object.freeze({
  title: 'Rutina de brazos',
  note: 'Dato simulado para mostrar la interfaz. No está registrado ni aprobado por Eva.',
});
