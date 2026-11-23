// Extensión local de demostración del perfil. No contiene mediciones clínicas
// ni sustituye información recibida de un servicio real.
export const DEMO_CLIENT_PROFILE_DETAILS = Object.freeze({
  clientId: 'DEMO-A1',
  goal: null,
  trainingDuration: null,
  cycleProgress: null,
  assessments: Object.freeze([
    Object.freeze({ id: 'mobility', title: 'Flexibilidad y movilidad', records: Object.freeze([]) }),
    Object.freeze({ id: 'stability', title: 'Estabilidad y fuerza base', records: Object.freeze([]) }),
    Object.freeze({ id: 'proportions', title: 'Proporciones y longitudes corporales', records: Object.freeze([]) }),
    Object.freeze({ id: 'neck', title: 'Características del cuello', records: Object.freeze([]) }),
    Object.freeze({ id: 'body-composition', title: 'Composición corporal e InBody', records: Object.freeze([]) }),
  ]),
});
