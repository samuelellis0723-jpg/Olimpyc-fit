import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actoresDemo, catalogoDemo, evaluacionEva, evaluacionEvaIncompleta,
  fixturesDemo, historialEjecutadoEva, obtenerCatalogo, obtenerEvaluacion,
  obtenerHistorialEjecutado, tieneAsignacion,
} from '../../demo/fixtures/index.mjs';
import { crearProveedorSimulado } from '../../demo/proveedor-simulado.mjs';
import { ErrorPlanificacion } from '../../dominio/errores.mjs';
import { validarBorrador, validarCatalogo, validarEvaluacion } from '../../dominio/validaciones.mjs';

function contexto(evaluacion = evaluacionEva) {
  return {
    perfil: {
      referenciaAtleta: 'DEMO-ATLETA-1', fecha: evaluacion.fecha, modalidad: evaluacion.modalidad,
      objetivo: evaluacion.objetivo, diasDisponibles: [...evaluacion.diasDisponibles],
      ...(evaluacion.nivel ? { nivel: evaluacion.nivel } : {}),
      ...(evaluacion.observacion ? { observacion: evaluacion.observacion } : {}),
      restricciones: [...evaluacion.restricciones], mediciones: structuredClone(evaluacion.mediciones),
      publicaciones: structuredClone(evaluacion.publicaciones),
    },
    catalogo: structuredClone(catalogoDemo), historialEjecutado: structuredClone(historialEjecutadoEva),
  };
}

test('fixtures son ficticios, async, aislados y respetan gimnasio, asignación y versión de catálogo', async () => {
  assert.equal(actoresDemo.entrenadoraEva.usuarioId, 'T1');
  assert.equal(actoresDemo.entrenadorAjeno.usuarioId, 'T2');
  assert.equal(actoresDemo.atletaOtroGimnasio.gimnasioId, 'G2');
  assert.equal('token' in actoresDemo.entrenadoraEva, false);
  assert.equal((await obtenerEvaluacion({ gimnasioId: 'G1', atletaId: 'A1', evaluacionId: 'EV1' })).autorId, 'T1');
  assert.equal(await obtenerEvaluacion({ gimnasioId: 'G2', atletaId: 'A1', evaluacionId: 'EV1' }), undefined);
  assert.equal(await obtenerEvaluacion({ gimnasioId: 'G1', atletaId: 'A2', evaluacionId: 'EV1' }), undefined);
  assert.equal(await obtenerEvaluacion({ gimnasioId: 'G1', atletaId: 'A1', evaluacionId: 'EV_INCOMPLETA' }).then((x) => x.evaluacionId), 'EV_INCOMPLETA');
  assert.equal(await obtenerCatalogo({ gimnasioId: 'G2' }), undefined);
  assert.equal(await obtenerCatalogo({ gimnasioId: 'G1', catalogoVersion: 'CAT-OTRA' }), undefined);
  assert.equal((await obtenerCatalogo({ gimnasioId: 'G1', catalogoVersion: 'CAT-DEMO-1' })).catalogoVersion, 'CAT-DEMO-1');
  assert.equal(await tieneAsignacion({ gimnasioId: 'G1', entrenadorId: 'T2', atletaId: 'A1' }), false);
  assert.equal(await tieneAsignacion({ gimnasioId: 'G1', entrenadorId: 'T1', atletaId: 'A1' }), true);
  assert.deepEqual(await obtenerHistorialEjecutado({ gimnasioId: 'G2', atletaId: 'A1' }), []);
  const copia = await obtenerEvaluacion({ gimnasioId: 'G1', atletaId: 'A1', evaluacionId: 'EV1' });
  copia.publicaciones[0].dato = 'alterado';
  assert.equal((await obtenerEvaluacion({ gimnasioId: 'G1', atletaId: 'A1', evaluacionId: 'EV1' })).publicaciones[0].dato, 'objetivo comunicado en la evaluación');
  assert.equal(fixturesDemo.evaluacion.evaluacionId, 'EV1');
});

test('evaluación y catálogo ficticios pasan validación profesional', () => {
  assert.equal(validarEvaluacion(evaluacionEva).evaluacionId, 'EV1');
  assert.equal(validarCatalogo(catalogoDemo).criterios[1].ejercicioId, 'E2');
  assert.deepEqual(evaluacionEva.diasDisponibles, [1, 4]);
  assert.deepEqual(evaluacionEva.mediciones, []); // InBody no se inventa.
});

test('proveedor simulado genera respuestas válidas de dos y tres días y aclara faltantes', async () => {
  const proveedor = crearProveedorSimulado(fixturesDemo);
  const dosDiasCtx = contexto();
  const generada = await proveedor.generar(dosDiasCtx, {});
  assert.equal(generada.tipo, 'propuesta');
  assert.deepEqual(generada.dias.map((d) => d.diaSemana), [1, 4]);
  assert.equal(validarBorrador(generada, dosDiasCtx).dias[0].items[1].ejercicioId, 'E2');
  assert.match(generada.dias[0].items[1].explicacion, /nivel observado.*no se recibió InBody/i);

  const tresDiasCtx = contexto({ ...structuredClone(evaluacionEva), diasDisponibles: [1, 4, 6] });
  const tresDias = await proveedor.generar(tresDiasCtx, {});
  assert.deepEqual(tresDias.dias.map((d) => d.diaSemana), [1, 4, 6]);
  assert.equal(validarBorrador(tresDias, tresDiasCtx).tipo, 'propuesta');

  const faltante = contexto(evaluacionEvaIncompleta);
  const aclaracion = await proveedor.generar(faltante, {});
  assert.deepEqual(aclaracion, { tipo: 'aclaracion', pregunta: '¿Cuál es el objetivo de entrenamiento?', camposPendientes: ['objetivo'] });
});

test('reorganizar traslada E2 al sábado, conserva descanso 60 y explica volumen semanal constante', async () => {
  const ctx = contexto({ ...structuredClone(evaluacionEva), diasDisponibles: [1, 4, 6] });
  ctx.versionBase = {
    versionId: 'V1',
    dias: [
      { diaId: 'D1', diaSemana: 1, items: [
        { itemId: 'I1', ejercicioId: 'E1', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'Nivel observado.', criterioId: 'CR1', datosUtilizados: ['nivel'] },
        { itemId: 'IBANCO', ejercicioId: 'E2', orden: 2, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'Banco según nivel observado.', criterioId: 'CR2', datosUtilizados: ['nivel'] },
      ] },
      { diaId: 'D4', diaSemana: 4, items: [{ itemId: 'I2', ejercicioId: 'E1', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'Nivel observado.', criterioId: 'CR1', datosUtilizados: ['nivel'] }] },
    ],
  };
  const proveedor = crearProveedorSimulado(fixturesDemo);
  const respuesta = await proveedor.reorganizar(ctx, { motivo: 'Regreso con tres días', disponibilidad: [1, 4, 6], ausencia: true });
  assert.deepEqual(respuesta.dias.map((d) => d.diaSemana), [1, 4, 6]);
  const bancoSabado = respuesta.dias[2].items.find((i) => i.ejercicioId === 'E2');
  assert.ok(bancoSabado);
  assert.equal(bancoSabado.descansoSegundos, 60);
  assert.equal(bancoSabado.series, 2);
  assert.match(respuesta.explicacion, /total semanal no cambia/i);
  assert.match(respuesta.explicacion, /no se agregan compensaciones/i);
  assert.equal(validarBorrador(respuesta, ctx).tipo, 'propuesta');
  await assert.rejects(proveedor.reorganizar(ctx, { motivo: 'x', disponibilidad: [1, 8] }), TypeError);
});

test('aplicación de dominio debe rechazar propuesta simulada con ejercicio o criterio no elegible', async () => {
  const ctx = contexto();
  const proveedor = crearProveedorSimulado({ respuestaGenerar: {
    tipo: 'propuesta', dias: [{ diaSemana: 1, items: [{ ejercicioId: 'NO-EXISTE', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'No elegible.', criterioId: 'CR1', datosUtilizados: ['nivel'] }] }, { diaSemana: 4, items: [{ ejercicioId: 'E1', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'Nivel observado.', criterioId: 'CR1', datosUtilizados: ['nivel'] }] }], aclaraciones: [],
  } });
  const propuesta = await proveedor.generar(ctx, {});
  assert.throws(() => validarBorrador(propuesta, ctx), ErrorPlanificacion);
});
