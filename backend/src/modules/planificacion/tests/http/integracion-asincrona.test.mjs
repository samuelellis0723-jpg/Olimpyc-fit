import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { crearRouterPlanificacion } from '../../http/crearRouterPlanificacion.mjs';
import { crearServicioPlanificacion } from '../../aplicacion/crearServicioPlanificacion.mjs';
import { ErrorPlanificacion } from '../../dominio/errores.mjs';

const ids = {
  gym: '00000000-0000-4000-8000-000000000001',
  coach: '00000000-0000-4000-8000-000000000002',
  athlete: '00000000-0000-4000-8000-000000000003',
  other: '00000000-0000-4000-8000-000000000004',
  evaluation: '00000000-0000-4000-8000-000000000005',
  exercise1: '00000000-0000-4000-8000-000000000006',
  exercise2: '00000000-0000-4000-8000-000000000007',
  criterion1: '00000000-0000-4000-8000-000000000008',
  criterion2: '00000000-0000-4000-8000-000000000009',
  catalog: '00000000-0000-4000-8000-000000000010',
  version1: '00000000-0000-4000-8000-000000000011',
  version2: '00000000-0000-4000-8000-000000000012',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actor = { usuarioId: ids.coach, gimnasioId: ids.gym, rol: 'entrenador' };
const athleteActor = { usuarioId: ids.athlete, gimnasioId: ids.gym, rol: 'atleta' };
const otherActor = { usuarioId: ids.other, gimnasioId: ids.gym, rol: 'entrenador' };
const evaluation = {
  evaluacionId: ids.evaluation, gimnasioId: ids.gym, atletaId: ids.athlete, autorId: ids.coach,
  fecha: '2026-11-21', modalidad: 'presencial', objetivo: 'constancia', diasDisponibles: [1, 4],
  nivel: 'inicial observado', restricciones: [], publicaciones: [{ dato: 'constancia', fuente: 'atleta' }], mediciones: [],
};
const catalog = {
  catalogoVersion: ids.catalog,
  ejercicios: [ids.exercise1, ids.exercise2].map((ejercicioId) => ({ ejercicioId, nombre: 'Ejercicio', grupoMuscular: 'piernas', estaciones: ['banco'], restriccionesIncompatibles: [], dosis: { series: { min: 1, max: 4 }, objetivoPorSerie: { unidad: 'repeticiones', min: 6, max: 15 }, descansoSegundos: { min: 30, max: 180 } } })),
  criterios: [ids.criterion1, ids.criterion2].map((criterioId, i) => ({ criterioId, ejercicioId: i ? ids.exercise2 : ids.exercise1, version: '1', texto: 'Criterio revisado de demostración.', procedencia: 'equipo', estado: 'aprobado', revisorId: ids.coach, revisadoEn: '2026-11-20T12:00:00.000Z' })),
};
const propuesta = (ctx) => ({ tipo: 'propuesta', aclaraciones: [], dias: ctx.perfil.diasDisponibles.map((diaSemana, i) => ({ diaSemana, items: [{ ejercicioId: ids.exercise1, orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 90, explicacion: 'Dosis ligada al objetivo registrado.', criterioId: ids.criterion1, datosUtilizados: ['objetivo'] }, ...(i === 0 ? [{ ejercicioId: ids.exercise2, orden: 2, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 90, explicacion: 'Dosis ligada al objetivo registrado.', criterioId: ids.criterion2, datosUtilizados: ['objetivo'] }] : [])] })) });

function conflict(codigo = 'REVISION_CONFLICTIVA', mensaje = 'Conflicto de escritura.') {
  return new ErrorPlanificacion({ status: 409, codigo, mensaje, revisionActual: 2 });
}
function crearRepo({ falloCrear = false, falloGuardar = false, falloAprobar = false, desplazarBase = false } = {}) {
  const planes = new Map(); let nextVersion = 0; let vigente; let rechazado;
  return {
    planes,
    obtenerRechazado() { return structuredClone(rechazado); },
    async obtenerPorId({ gimnasioId, versionId }) { const p = planes.get(versionId); return p?.gimnasioId === gimnasioId ? structuredClone(p) : undefined; },
    async obtenerVigente({ gimnasioId, atletaId }) { const p = vigente && planes.get(vigente); return p?.gimnasioId === gimnasioId && p.atletaId === atletaId ? structuredClone(p) : undefined; },
    async crearBorrador({ gimnasioId, atletaId, plan }) {
      assert.equal(gimnasioId, ids.gym); assert.equal(atletaId, ids.athlete);
      for (const d of plan.dias) { assert.match(d.diaId, uuid); for (const item of d.items) assert.match(item.itemId, uuid); }
      if (falloCrear) throw conflict();
      if (desplazarBase && plan.versionBaseId) {
        rechazado = structuredClone(plan);
        assert.ok(planes.has(ids.version2), 'el borrador concurrente debe existir antes del rechazo');
        if (vigente && planes.has(vigente)) planes.set(vigente, { ...planes.get(vigente), estado: 'historica' });
        planes.set(ids.version2, { ...planes.get(ids.version2), estado: 'vigente' }); vigente = ids.version2;
        throw conflict('BASE_NO_VIGENTE', 'La base ya se desplazó.');
      }
      const versionId = ++nextVersion === 1 ? ids.version1 : ids.version2;
      const guardado = structuredClone({ ...plan, versionId }); planes.set(versionId, guardado); return structuredClone(guardado);
    },
    async guardarRevision({ gimnasioId, versionId, revisionEsperada, cambios }) {
      if (falloGuardar) throw conflict();
      const p = planes.get(versionId);
      if (!p || p.gimnasioId !== gimnasioId || p.revision !== revisionEsperada || p.estado !== 'borrador') throw conflict();
      const updated = { ...p, ...structuredClone(cambios), revision: p.revision + 1 }; planes.set(versionId, updated); return structuredClone(updated);
    },
    async aprobar({ gimnasioId, versionId, revisionEsperada, aprobadorId, fecha }) {
      if (falloAprobar) throw conflict();
      const p = planes.get(versionId);
      if (!p || p.gimnasioId !== gimnasioId || p.estado !== 'borrador' || p.revision !== revisionEsperada) throw conflict();
      let anterior = vigente && planes.has(vigente) ? { ...planes.get(vigente), estado: 'historica' } : null;
      if (anterior) planes.set(vigente, structuredClone(anterior));
      const updated = { ...p, estado: 'vigente', aprobacion: { aprobadorId, fecha } }; planes.set(versionId, updated); vigente = versionId;
      return { plan: structuredClone(updated), anterior };
    },
  };
}

async function harness(t, options = {}) {
  const repo = options.repo ?? crearRepo(options);
  const proveedor = {
    async generar(ctx) { return propuesta(ctx); },
    async reorganizar(ctx) { assert.ok(ctx.versionBase); const { aclaraciones: _aclaraciones, ...respuesta } = propuesta(ctx); return { ...respuesta, explicacion: 'Redistribución revisable conservando referencias.' }; },
  };
  let asignaciones = 0, evaluaciones = 0, catalogos = 0, historiales = 0, actores = 0;
  const servicio = crearServicioPlanificacion({ proveedor, repo,
    async obtenerEvaluacion(args) { evaluaciones++; assert.deepEqual(args, { gimnasioId: ids.gym, atletaId: ids.athlete, evaluacionId: ids.evaluation }); return structuredClone(evaluation); },
    async obtenerCatalogo(args) { catalogos++; if (args.catalogoVersion) assert.equal(args.catalogoVersion, ids.catalog); return structuredClone(catalog); },
    async tieneAsignacion(args) { asignaciones++; return args.gimnasioId === ids.gym && args.entrenadorId === ids.coach && args.atletaId === ids.athlete; },
    async obtenerHistorialEjecutado(args) { historiales++; assert.deepEqual(args, { gimnasioId: ids.gym, atletaId: ids.athlete }); return []; },
    reloj: () => '2026-11-21T10:00:00.000Z',
  });
  const app = express();
  app.use('/api/v1', crearRouterPlanificacion({ servicio, async resolverActor(req) { actores++; return req.get('x-actor') === 'athlete' ? athleteActor : req.get('x-actor') === 'other' ? otherActor : actor; } }));
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    const onError = (error) => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError); server.once('listening', onListening); server.listen(0, '127.0.0.1');
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())));
  const request = (path, { actor: who = 'coach', ...init } = {}) => fetch(`${base}${path}`, { ...init, headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), 'x-actor': who, ...init.headers } });
  return { request, repo, counts: () => ({ asignaciones, evaluaciones, catalogos, historiales, actores }) };
}
const json = JSON.stringify;

test('router, servicio y repositorio asíncrono completan el flujo UUID y conservan referencias históricas', async (t) => {
  const { request, repo, counts } = await harness(t);
  let r = await request(`/api/v1/atletas/${ids.athlete}/planes`, { method: 'POST', body: json({ origen: 'IA', evaluacionId: ids.evaluation }) });
  assert.equal(r.status, 201); let v1 = await r.json(); assert.equal(v1.versionId, ids.version1); assert.equal(v1.catalogoVersion, ids.catalog); assert.equal(v1.estado, 'borrador');
  const item = v1.dias[0].items[1]; assert.match(item.itemId, uuid);
  r = await request(`/api/v1/planes/${v1.versionId}`); assert.equal(r.status, 200); assert.equal((await r.json()).versionId, ids.version1);
  r = await request(`/api/v1/planes/${v1.versionId}`, { method: 'PATCH', body: json({ revisionEsperada: 1, cambios: { items: [{ itemId: item.itemId, descansoSegundos: 60 }] } }) }); assert.equal(r.status, 200); v1 = await r.json(); assert.equal(v1.revision, 2);
  r = await request(`/api/v1/planes/${v1.versionId}/aprobacion`, { method: 'POST', body: json({ revisionEsperada: 2 }) }); assert.equal(r.status, 200); let approval = await r.json(); assert.equal(approval.plan.aprobacion.aprobadorId, ids.coach); assert.equal(approval.anterior, null);
  r = await request('/api/v1/me/rutina?fecha=2026-11-23', { actor: 'athlete' }); assert.equal((await r.json()).plan.versionId, ids.version1);
  r = await request(`/api/v1/planes/${ids.version1}/reorganizaciones`, { method: 'POST', body: json({ motivo: 'Regresa a tres días', disponibilidad: [1, 4, 6] }) }); assert.equal(r.status, 201);
  const result = await r.json(); const v2 = result.plan; assert.equal(v2.versionId, ids.version2); assert.equal(v2.versionBaseId, ids.version1); assert.equal(v2.catalogoVersion, ids.catalog); assert.equal(v2.estado, 'borrador');
  const v2ItemIds = new Set(v2.dias.flatMap((d) => d.items.map((i) => i.itemId)));
  assert.ok(result.diferencias.agregados.length > 0);
  assert.ok(result.diferencias.agregados.every((id) => v2ItemIds.has(id)));
  assert.ok(result.diferencias.mantenidos.every((id) => v1.dias.flatMap((d) => d.items).some((i) => i.itemId === id)));
  assert.equal((await (await request('/api/v1/me/rutina?fecha=2026-11-23', { actor: 'athlete' })).json()).plan.versionId, ids.version1);
  r = await request(`/api/v1/planes/${ids.version2}/aprobacion`, { method: 'POST', body: json({ revisionEsperada: 1 }) }); assert.equal(r.status, 200); approval = await r.json(); assert.equal(approval.anterior.versionId, ids.version1); assert.equal(approval.anterior.estado, 'historica');
  assert.equal((await (await request(`/api/v1/planes/${ids.version1}`)).json()).estado, 'historica');
  assert.equal((await (await request('/api/v1/me/rutina?fecha=2026-11-23', { actor: 'athlete' })).json()).plan.versionId, ids.version2);
  assert.ok(Object.values(counts()).every((n) => n > 0)); assert.equal(repo.planes.size, 2);
});

test('mutaciones asíncronas con conflictos de dominio responden 409 y preservan estado', async (t) => {
  for (const accion of ['crear', 'editar', 'aprobar']) {
    const { request, repo } = await harness(t);
    if (accion !== 'crear') {
      const seed = await request(`/api/v1/atletas/${ids.athlete}/planes`, { method: 'POST', body: json({ origen: 'IA', evaluacionId: ids.evaluation }) });
      assert.equal(seed.status, 201);
      if (accion === 'editar') repo.guardarRevision = async () => { throw conflict(); };
      if (accion === 'aprobar') repo.aprobar = async () => { throw conflict(); };
    } else repo.crearBorrador = async () => { throw conflict(); };
    let response;
    if (accion === 'crear') response = await request(`/api/v1/atletas/${ids.athlete}/planes`, { method: 'POST', body: json({ origen: 'IA', evaluacionId: ids.evaluation }) });
    if (accion === 'editar') response = await request(`/api/v1/planes/${ids.version1}`, { method: 'PATCH', body: json({ revisionEsperada: 1, cambios: { items: [{ itemId: (await repo.obtenerPorId({ gimnasioId: ids.gym, versionId: ids.version1 })).dias[0].items[0].itemId, descansoSegundos: 60 }] } }) });
    if (accion === 'aprobar') response = await request(`/api/v1/planes/${ids.version1}/aprobacion`, { method: 'POST', body: json({ revisionEsperada: 1 }) });
    assert.equal(response.status, 409, accion); assert.equal((await response.json()).codigo, 'REVISION_CONFLICTIVA');
    if (repo.planes.has(ids.version1)) assert.equal((await repo.obtenerPorId({ gimnasioId: ids.gym, versionId: ids.version1 })).estado, 'borrador');
    else assert.equal(repo.planes.size, 0);
  }
});

test('la base desplazada antes de persistir la reorganización no crea un segundo borrador', async (t) => {
  const repo = crearRepo({ desplazarBase: true });
  repo.sembrarVersion2Borrador = async () => {
    const base = structuredClone(repo.planes.get(ids.version1));
    repo.planes.set(ids.version2, { ...base, versionId: ids.version2, estado: 'borrador' });
  };
  const { request } = await harness(t, { repo });
  const initial = await request(`/api/v1/atletas/${ids.athlete}/planes`, { method: 'POST', body: json({ origen: 'IA', evaluacionId: ids.evaluation }) }); assert.equal(initial.status, 201);
  await request(`/api/v1/planes/${ids.version1}/aprobacion`, { method: 'POST', body: json({ revisionEsperada: 1 }) });
  await repo.sembrarVersion2Borrador(); const sizeBeforeRejectedCreate = repo.planes.size;
  const response = await request(`/api/v1/planes/${ids.version1}/reorganizaciones`, { method: 'POST', body: json({ motivo: 'Revisar disponibilidad', disponibilidad: [1, 4, 6] }) });
  assert.equal(response.status, 409); assert.equal((await response.json()).codigo, 'BASE_NO_VIGENTE'); assert.equal(repo.planes.size, sizeBeforeRejectedCreate);
  assert.equal((await repo.obtenerPorId({ gimnasioId: ids.gym, versionId: ids.version1 })).estado, 'historica');
  assert.equal((await repo.obtenerVigente({ gimnasioId: ids.gym, atletaId: ids.athlete })).versionId, ids.version2);
  const rejectedItemIds = new Set(repo.obtenerRechazado().dias.flatMap((d) => d.items.map((i) => i.itemId)));
  const storedItemIds = new Set([...repo.planes.values()].flatMap((p) => p.dias.flatMap((d) => d.items.map((i) => i.itemId))));
  assert.ok([...rejectedItemIds].every((id) => !storedItemIds.has(id)));
});

test('dos PATCH con la misma revisión tienen un único ganador async CAS', async (t) => {
  const { request, repo } = await harness(t);
  const created = await request(`/api/v1/atletas/${ids.athlete}/planes`, { method: 'POST', body: json({ origen: 'IA', evaluacionId: ids.evaluation }) });
  const plan = await created.json(); const itemId = plan.dias[0].items[0].itemId;
  const guardar = repo.guardarRevision.bind(repo); let arrived = 0, open;
  const barrier = new Promise((resolve) => { open = resolve; });
  repo.guardarRevision = async (args) => { arrived++; if (arrived === 2) open(); await barrier; return guardar(args); };
  const barrierTimeout = setTimeout(() => open(), 2000);
  const body = json({ revisionEsperada: 1, cambios: { items: [{ itemId, descansoSegundos: 60 }] } });
  const results = await Promise.all([1, 2].map(() => request(`/api/v1/planes/${ids.version1}`, { method: 'PATCH', body })));
  clearTimeout(barrierTimeout); assert.equal(arrived, 2);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 409]);
  const loser = results.find((x) => x.status === 409); assert.equal((await loser.json()).revisionActual, 2);
  assert.equal((await repo.obtenerPorId({ gimnasioId: ids.gym, versionId: ids.version1 })).revision, 2);
});
