import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorPlanificacion } from '../../dominio/errores.mjs';
import {
  copiarPlan, validarBorrador, validarCatalogo, validarEvaluacion,
  validarSolicitudGenerar, validarSolicitudReorganizar,
} from '../../dominio/validaciones.mjs';

const evaluacion = () => ({
  evaluacionId: 'EV1', gimnasioId: 'G1', atletaId: 'A1', autorId: 'T1', fecha: '2026-11-21',
  modalidad: 'presencial', objetivo: 'acondicionamiento', diasDisponibles: [1, 4], nivel: 'inicial',
  restricciones: [], publicaciones: [{ dato: 'observación inicial', fuente: 'entrenador' }], mediciones: [],
});
const catalogo = () => ({
  catalogoVersion: 'CAT1',
  ejercicios: ['E1', 'E2'].map((ejercicioId) => ({ ejercicioId, nombre: ejercicioId, grupoMuscular: 'general', estaciones: ['A'], restriccionesIncompatibles: [], dosis: { series: { min: 1, max: 5 }, objetivoPorSerie: { unidad: 'repeticiones', min: 1, max: 20 }, descansoSegundos: { min: 0, max: 300 } } })),
  criterios: ['E1', 'E2'].map((ejercicioId) => ({ criterioId: `C${ejercicioId}`, ejercicioId, version: '1', texto: 'Criterio revisado', procedencia: 'Revisión profesional', estado: 'aprobado', revisorId: 'T1', revisadoEn: '2026-11-20T12:00:00Z' })),
});
const contexto = () => ({ perfil: { referenciaAtleta: 'anon-1', fecha: '2026-11-21', modalidad: 'presencial', objetivo: 'acondicionamiento', diasDisponibles: [1, 4], nivel: 'inicial', restricciones: [], mediciones: [], publicaciones: [{ dato: 'observación inicial', fuente: 'entrenador' }] }, catalogo: catalogo(), historialEjecutado: [] });
const borrador = () => ({ tipo: 'propuesta', aclaraciones: [], dias: [1, 4].map((diaSemana, i) => ({ diaSemana, items: [{ ejercicioId: `E${i + 1}`, orden: 1, series: 3, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'Se relaciona con el objetivo registrado.', criterioId: `CE${i + 1}`, datosUtilizados: ['objetivo'] }] })) });

test('valida evaluación EV1 sin InBody y conserva fechas válidas sin normalizar', () => {
  const e = evaluacion();
  assert.deepEqual(validarEvaluacion(e), e);
  assert.throws(() => validarEvaluacion({ ...e, fecha: '2026-02-30' }), ErrorPlanificacion);
  assert.throws(() => validarEvaluacion({ ...e, publicaciones: [{ dato: 'x', fuente: 'privada' }] }), /publicaciones/);
});

test('valida catálogo y propuesta completa para lunes y jueves', () => {
  assert.deepEqual(validarCatalogo(catalogo()), catalogo());
  const propuesta = borrador();
  assert.deepEqual(validarBorrador(propuesta, contexto()), propuesta);
  assert.notStrictEqual(validarBorrador(propuesta, contexto()), propuesta);
});

test('rechaza días, ejercicios, criterios, unidades, dosis y restricciones incompatibles', () => {
  const badDay = borrador(); badDay.dias[0].diaSemana = 2;
  assert.throws(() => validarBorrador(badDay, contexto()), /días ISO esperados/);
  const badExercise = borrador(); badExercise.dias[0].items[0].ejercicioId = 'E99';
  assert.throws(() => validarBorrador(badExercise, contexto()), /ejercicioId inexistente/);
  const badCriterion = borrador(); badCriterion.dias[0].items[0].criterioId = 'CE2';
  assert.throws(() => validarBorrador(badCriterion, contexto()), /criterioId inválido/);
  const badUnit = borrador(); badUnit.dias[0].items[0].objetivoPorSerie.unidad = 'kg';
  assert.throws(() => validarBorrador(badUnit, contexto()), /unidad fuera de límites/);
  const badDose = borrador(); badDose.dias[0].items[0].series = 99;
  assert.throws(() => validarBorrador(badDose, contexto()), /series fuera de límites/);
  const ctx = contexto(); ctx.perfil.restricciones = ['rodilla']; ctx.catalogo.ejercicios[0].restriccionesIncompatibles = ['rodilla'];
  assert.throws(() => validarBorrador(borrador(), ctx), /incompatible/);
});

test('reporta campos pendientes y rechaza regreso ausente', () => {
  assert.throws(() => validarEvaluacion({ ...evaluacion(), diasDisponibles: undefined }), (e) => e.status === 422 && e.codigo === 'DATOS_PENDIENTES' && e.camposPendientes.includes('diasDisponibles'));
  assert.throws(() => validarSolicitudReorganizar({ motivo: 'ausencia', ausencia: true }), (e) => e.status === 422 && e.camposPendientes[0] === 'disponibilidadRegreso' && /regresar/.test(e.mensaje));
  assert.deepEqual(validarSolicitudReorganizar({ motivo: 'regreso', ausencia: true, disponibilidadRegreso: [1, 4, 6] }), { motivo: 'regreso', ausencia: true, disponibilidadRegreso: [1, 4, 6] });
  assert.deepEqual(validarSolicitudGenerar({ evaluacionId: 'EV1' }), { evaluacionId: 'EV1' });
});

test('solicitudes inválidas y copias defensivas', () => {
  assert.throws(() => validarSolicitudGenerar({ evaluacionId: 'EV1', atletaId: 'A1' }), /campos no permitidos/);
  assert.throws(() => validarSolicitudReorganizar({ motivo: 'cambio', disponibilidad: [1, 1] }), /repetir/);
  const plan = { versionId: 'V1', dias: [{ diaSemana: 1 }] };
  const copia = copiarPlan(plan); copia.dias[0].diaSemana = 2;
  assert.equal(plan.dias[0].diaSemana, 1);
  const err = new ErrorPlanificacion({ status: 422, codigo: 'DATOS_PENDIENTES', mensaje: 'Falta', camposPendientes: ['x'] });
  assert.equal(err.name, 'ErrorPlanificacion');
  assert.notStrictEqual(err.camposPendientes, ['x']);
});
