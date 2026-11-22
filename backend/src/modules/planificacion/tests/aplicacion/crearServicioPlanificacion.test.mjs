import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioPlanificacion } from '../../aplicacion/crearServicioPlanificacion.mjs';
import { crearRepositorioEnMemoria } from '../../datos/crearRepositorioEnMemoria.mjs';
import { crearProveedorSimulado } from '../../demo/proveedor-simulado.mjs';
import { evaluacionEva, evaluacionEvaIncompleta, catalogoDemo, actoresDemo, obtenerEvaluacion, obtenerCatalogo, tieneAsignacion, obtenerHistorialEjecutado } from '../../demo/fixtures/index.mjs';

const actor = actoresDemo.entrenadoraEva;
function servicio({ proveedor = crearProveedorSimulado(), repo = crearRepositorioEnMemoria(), evaluaciones = [evaluacionEva], informarOperacion, asignacion = tieneAsignacion, catalogos = obtenerCatalogo, historial = obtenerHistorialEjecutado } = {}) {
  return { repo, service: crearServicioPlanificacion({ proveedor, repo, obtenerEvaluacion: async ({ gimnasioId, atletaId, evaluacionId }) => {
    const e = evaluaciones.find((x) => x.evaluacionId === evaluacionId && x.gimnasioId === gimnasioId && x.atletaId === atletaId);
    return e && structuredClone(e);
  }, obtenerCatalogo: catalogos, tieneAsignacion: asignacion, obtenerHistorialEjecutado: historial, reloj: () => '2026-11-21T10:00:00.000Z', informarOperacion }) };
}

test('genera borrador con contexto anonimizado y callback de observabilidad', async () => {
  let visto; let evento;
  const { service } = servicio({ proveedor: crearProveedorSimulado({ generar: async (ctx) => { visto = ctx; return crearProveedorSimulado().generar(ctx, {}); } }), informarOperacion: (e) => { evento = e; } });
  const plan = await service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  assert.equal(plan.estado, 'borrador'); assert.equal(plan.origen, 'DeepSeek');
  assert.match(visto.perfil.referenciaAtleta, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(visto).includes('A1'), false);
  assert.equal(Object.hasOwn(visto, 'actor'), false);
  assert.equal(Object.hasOwn(visto.perfil, 'usuarioId'), false);
  assert.deepEqual(Object.keys(visto.versionBase ?? {}), []);
  assert.equal(evento.operacion, 'generar'); assert.equal(evento.resultado, 'borrador');
});

test('la proyección elimina campos extra sensibles y un callback asíncrono fallido no bloquea', async () => {
  let visto;
  const evaluacion = { ...structuredClone(evaluacionEva), notaPrivada: 'secreto', mediciones: [{ variable: 'peso', estado: 'medida', valor: 70, unidad: 'kg', origen: 'báscula', fecha: '2026-11-21', notaPrivada: 'oculta' }], publicaciones: [{ dato: 'objetivo comunicado', fuente: 'atleta', correo: 'privado@example.test' }] };
  const { service } = servicio({ evaluaciones: [evaluacion], proveedor: crearProveedorSimulado({ generar: async (ctx) => { visto = ctx; return crearProveedorSimulado().generar(ctx, {}); } }), informarOperacion: async () => { throw new Error('telemetría'); } });
  await service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  assert.equal(JSON.stringify(visto).includes('privado'), false);
  assert.equal(JSON.stringify(visto).includes('secreto'), false);
  assert.equal(Object.hasOwn(visto.perfil.mediciones[0], 'notaPrivada'), false);
  assert.equal(Object.hasOwn(visto.perfil.publicaciones[0], 'correo'), false);
});

test('manual evita proveedor y rechaza evaluación incompleta', async () => {
  let llamadas = 0;
  const proveedor = { generar: async () => { llamadas++; }, reorganizar: async () => { llamadas++; } };
  const { service } = servicio({ proveedor, evaluaciones: [evaluacionEva, evaluacionEvaIncompleta] });
  const manual = await service.crearBorradorManual(actor, { atletaId: 'A1', evaluacionId: 'EV1', dias: [{ diaSemana: 1, items: [{ ejercicioId: 'E1', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'Dosis inicial por nivel observado.', criterioId: 'CR1', datosUtilizados: ['nivel'] }] }, { diaSemana: 4, items: [{ ejercicioId: 'E2', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 90, explicacion: 'Dosis inicial por nivel observado.', criterioId: 'CR2', datosUtilizados: ['nivel'] }] }] });
  assert.equal(manual.origen, 'manual');
  await assert.rejects(service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV_INCOMPLETA' }), (e) => e.status === 422);
  assert.equal(llamadas, 0);
});

test('roles y asignación ocultan recursos ajenos', async () => {
  const { service } = servicio();
  await assert.rejects(service.generarBorrador(actoresDemo.atletaEva, { atletaId: 'A1', evaluacionId: 'EV1' }), (e) => e.status === 403);
  await assert.rejects(service.generarBorrador(actor, { atletaId: 'A2', evaluacionId: 'EV1' }), (e) => e.status === 404);
});

test('salida de proveedor inválida se convierte en 503 sin almacenar', async () => {
  const repo = crearRepositorioEnMemoria();
  const { service } = servicio({ repo, proveedor: crearProveedorSimulado({ respuestaGenerar: { tipo: 'propuesta', dias: [], aclaraciones: [] } }) });
  await assert.rejects(service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' }), (e) => e.status === 503 && e.codigo === 'RESPUESTA_PROVEEDOR_INVALIDA');
  assert.equal(await repo.obtenerVigente({ gimnasioId: 'G1', atletaId: 'A1' }), undefined);
});

test('edita descanso a 60, aprueba V1 y conserva V1 al crear V2', async () => {
  const { service } = servicio();
  let v1 = await service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  const e2 = v1.dias[0].items.find((i) => i.ejercicioId === 'E2');
  v1 = await service.editarBorrador(actor, { versionId: v1.versionId, revisionEsperada: 1, cambios: { items: [{ itemId: e2.itemId, descansoSegundos: 60 }] } });
  assert.equal(v1.revision, 2); assert.equal(e2.itemId, v1.dias[0].items.find((i) => i.ejercicioId === 'E2').itemId);
  await service.aprobarBorrador(actor, { versionId: v1.versionId, revisionEsperada: 2 });
  const v2 = await service.reorganizarBorrador(actor, { versionId: v1.versionId, motivo: 'Regreso con tres días', ausencia: true, disponibilidadRegreso: [1, 4, 6] });
  assert.equal(v2.plan.versionBaseId, v1.versionId); assert.equal(v2.plan.estado, 'borrador');
  assert.equal(v2.plan.dias.flatMap((d) => d.items).some((i) => i.descansoSegundos === 60), true);
  assert.equal((await service.obtenerPlan(actor, { versionId: v1.versionId })).estado, 'vigente');
  assert.equal(v2.diferencias.explicacion.includes('60'), true);
});

test('una base que cambia mientras el proveedor espera no produce V2', async () => {
  const repo = crearRepositorioEnMemoria();
  let release;
  const espera = new Promise((resolve) => { release = resolve; });
  const { service } = servicio({ repo, proveedor: crearProveedorSimulado({ reorganizar: async (ctx, solicitud) => { await espera; return crearProveedorSimulado().reorganizar(ctx, solicitud); } }) });
  const v1 = await service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  await service.aprobarBorrador(actor, { versionId: v1.versionId, revisionEsperada: 1 });
  const pendiente = service.reorganizarBorrador(actor, { versionId: v1.versionId, motivo: 'cambio', disponibilidad: [1, 4] });
  await new Promise((resolve) => setImmediate(resolve));
  // The base is already published; force a concurrent V2 approval to replace it.
  const nuevo = await repo.crearBorrador({ gimnasioId: 'G1', atletaId: 'A1', plan: { gimnasioId: 'G1', atletaId: 'A1', evaluacionId: 'EV1', origen: 'manual', catalogoVersion: catalogoDemo.catalogoVersion, dias: v1.dias, creadoEn: '2026-11-21T10:00:00Z' } });
  await repo.aprobar({ gimnasioId: 'G1', versionId: nuevo.versionId, revisionEsperada: 1, aprobadorId: 'T1', fecha: '2026-11-21T11:00:00Z' });
  release();
  await assert.rejects(pendiente, (e) => e.status === 409 && e.codigo === 'BASE_NO_VIGENTE');
});

test('V2 que cita historial ejecutado se puede editar y aprobar con el mismo snapshot', async () => {
  const proveedorBase = crearProveedorSimulado();
  const proveedor = {
    generar: (...args) => proveedorBase.generar(...args),
    async reorganizar(ctx) {
      return { tipo: 'propuesta', explicacion: 'Se conserva el bloque con referencia al historial.', dias: ctx.versionBase.dias.map((d) => ({ diaSemana: d.diaSemana, items: d.items.map(({ itemId, ...it }) => ({ ...it, datosUtilizados: [...new Set([...it.datosUtilizados, 'historialEjecutado'])] })) })) };
    },
  };
  const { service } = servicio({ proveedor });
  const v1 = await service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  await service.aprobarBorrador(actor, { versionId: v1.versionId, revisionEsperada: 1 });
  const { plan: v2 } = await service.reorganizarBorrador(actor, { versionId: v1.versionId, motivo: 'Mantener actividad', disponibilidad: [1, 4] });
  const originalId = v2.dias[0].items[0].itemId;
  const editado = await service.editarBorrador(actor, { versionId: v2.versionId, revisionEsperada: 1, cambios: { items: [{ itemId: originalId, descansoSegundos: 60 }] } });
  assert.equal(editado.revision, 2);
  assert.equal(editado.dias[0].items[0].itemId, originalId);
  const aprobado = await service.aprobarBorrador(actor, { versionId: v2.versionId, revisionEsperada: 2 });
  assert.equal(aprobado.plan.estado, 'vigente');
  assert.equal(aprobado.anterior.versionId, v1.versionId);
});

test('un borrador sin catálogo original no se aprueba ni desplaza la versión vigente', async () => {
  let oculto = false;
  const catalogos = async ({ gimnasioId, catalogoVersion }) => oculto && catalogoVersion
    ? undefined : obtenerCatalogo({ gimnasioId, catalogoVersion });
  const { service } = servicio({ catalogos });
  const v1 = await service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  await service.aprobarBorrador(actor, { versionId: v1.versionId, revisionEsperada: 1 });
  const { plan: v2 } = await service.reorganizarBorrador(actor, { versionId: v1.versionId, motivo: 'Cambiar disponibilidad', disponibilidad: [1, 4] });
  oculto = true;
  await assert.rejects(service.aprobarBorrador(actor, { versionId: v2.versionId, revisionEsperada: 1 }), (e) => e.status === 409 && e.codigo === 'CATALOGO_NO_DISPONIBLE');
  assert.equal((await service.obtenerPlan(actor, { versionId: v1.versionId })).estado, 'vigente');
});

test('PATCH con revisión string o lista items vacía sin fecha devuelve 422', async () => {
  const { service } = servicio();
  const plan = await service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  await assert.rejects(service.editarBorrador(actor, { versionId: plan.versionId, revisionEsperada: '1', cambios: { proximaRevision: '2026-12-20' } }), (e) => e.status === 422);
  await assert.rejects(service.editarBorrador(actor, { versionId: plan.versionId, revisionEsperada: 1, cambios: { items: [] } }), (e) => e.status === 422);
});

test('asignación revocada durante la espera bloquea también una aclaración del proveedor', async () => {
  let asignado = true; let release;
  const espera = new Promise((resolve) => { release = resolve; });
  const proveedorBase = crearProveedorSimulado();
  const proveedor = { generar: async () => { await espera; return { tipo: 'aclaracion', pregunta: 'Aclare', camposPendientes: ['objetivo'] }; }, reorganizar: (...args) => proveedorBase.reorganizar(...args) };
  const { service } = servicio({ proveedor, asignacion: async () => asignado });
  const operacion = service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  await new Promise((resolve) => setImmediate(resolve));
  asignado = false; release();
  await assert.rejects(operacion, (e) => e.status === 404);
});

test('rutina exige fecha ISO estricta y solo devuelve el día publicado', async () => {
  const { service } = servicio();
  const v1 = await service.generarBorrador(actor, { atletaId: 'A1', evaluacionId: 'EV1' });
  await service.aprobarBorrador(actor, { versionId: v1.versionId, revisionEsperada: 1 });
  assert.equal((await service.obtenerRutina(actoresDemo.atletaEva, { fecha: '2026-11-23' })).estado, 'disponible');
  await assert.rejects(service.obtenerRutina(actoresDemo.atletaEva, { fecha: '2026-02-30' }), (e) => e.status === 422);
});
