import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { crearRouterPlanificacion } from '../../http/crearRouterPlanificacion.mjs';
import { crearServicioPlanificacion } from '../../aplicacion/crearServicioPlanificacion.mjs';
import { crearRepositorioEnMemoria } from '../../datos/crearRepositorioEnMemoria.mjs';
import { crearProveedorSimulado } from '../../demo/proveedor-simulado.mjs';
import { actoresDemo, obtenerEvaluacion, obtenerCatalogo, tieneAsignacion, obtenerHistorialEjecutado } from '../../demo/fixtures/index.mjs';

async function servidor(t, { proveedor = crearProveedorSimulado() } = {}) {
  const servicio = crearServicioPlanificacion({ proveedor, repo: crearRepositorioEnMemoria(), obtenerEvaluacion, obtenerCatalogo, tieneAsignacion, obtenerHistorialEjecutado, reloj: () => '2026-11-21T10:00:00.000Z' });
  const app = express();
  app.use('/api/v1', crearRouterPlanificacion({ servicio, resolverActor: async (req) => req.get('x-actor') ? actoresDemo[req.get('x-actor')] : undefined }));
  app.post('/api/v1/ruta-ajena', express.json(), (req, res) => res.json({ recibido: req.body }));
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  t.after(() => new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, { actor = 'entrenadoraEva', ...options } = {}) => fetch(`${base}${path}`, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(actor ? { 'x-actor': actor } : {}), ...options.headers } });
  return { request };
}
const json = (x) => JSON.stringify(x);

test('recorrido V1→editar→aprobar→reorganizar→atleta sigue en V1→aprobar V2 e historial V1', async (t) => {
  const { request } = await servidor(t);
  let r = await request('/api/v1/atletas/A1/planes', { method: 'POST', body: json({ origen: 'IA', evaluacionId: 'EV1' }) });
  assert.equal(r.status, 201); let v1 = await r.json(); assert.equal(v1.versionId, 'V1'); assert.equal(v1.estado, 'borrador'); assert.equal(v1.origen, 'DeepSeek');
  const item = v1.dias[0].items.find((x) => x.ejercicioId === 'E2'); assert.equal(item.descansoSegundos, 90);
  r = await request('/api/v1/planes/V1', { method: 'PATCH', body: json({ revisionEsperada: 1, cambios: { items: [{ itemId: item.itemId, descansoSegundos: 60 }] } }) });
  v1 = await r.json(); assert.equal(r.status, 200); assert.equal(v1.revision, 2); assert.equal(v1.dias[0].items.find((x) => x.ejercicioId === 'E2').descansoSegundos, 60);
  r = await request('/api/v1/planes/V1/aprobacion', { method: 'POST', body: json({ revisionEsperada: 2 }) }); assert.equal(r.status, 200); assert.equal((await r.json()).plan.estado, 'vigente');
  r = await request('/api/v1/me/rutina?fecha=2026-11-23', { actor: 'atletaEva' }); assert.equal((await r.json()).plan.versionId, 'V1');
  r = await request('/api/v1/planes/V1/reorganizaciones', { method: 'POST', body: json({ motivo: 'Regreso con tres días', ausencia: true, disponibilidadRegreso: [1, 4, 6] }) });
  assert.equal(r.status, 201); const v2 = (await r.json()).plan; assert.equal(v2.versionId, 'V2'); assert.equal(v2.estado, 'borrador'); assert.equal(v2.versionBaseId, 'V1'); assert.equal(v2.dias.flatMap((d) => d.items).some((x) => x.descansoSegundos === 60), true);
  r = await request('/api/v1/me/rutina?fecha=2026-11-23', { actor: 'atletaEva' }); assert.equal((await r.json()).plan.versionId, 'V1');
  r = await request('/api/v1/planes/V2/aprobacion', { method: 'POST', body: json({ revisionEsperada: 1 }) }); assert.equal(r.status, 200);
  r = await request('/api/v1/planes/V1'); assert.equal((await r.json()).estado, 'historica');
  r = await request('/api/v1/me/rutina?fecha=2026-11-23', { actor: 'atletaEva' }); assert.equal((await r.json()).plan.versionId, 'V2');
});

test('deniega actor ausente antes de parsear; parser malformado, límite y revisión vieja', async (t) => {
  const { request } = await servidor(t);
  let r = await request('/api/v1/atletas/A1/planes', { actor: null, method: 'POST', body: '{' }); assert.equal(r.status, 401);
  r = await request('/api/v1/atletas/A1/planes', { method: 'POST', body: '{' }); assert.equal(r.status, 422);
  r = await request('/api/v1/atletas/A1/planes', { method: 'POST', body: json({ origen: 'IA', evaluacionId: 'EV1', nota: 'x'.repeat(70_000) }) }); assert.equal(r.status, 422);
  r = await request('/api/v1/atletas/A1/planes', { method: 'POST', body: json({ origen: 'IA', evaluacionId: 'EV1', atletaId: 'A2' }) }); assert.equal(r.status, 422);
  r = await request('/api/v1/atletas/A1/planes', { method: 'POST', body: json({ origen: 'IA', evaluacionId: 'EV_INCOMPLETA' }) }); assert.equal(r.status, 422); assert.equal((await r.json()).codigo, 'DATOS_PENDIENTES');
  r = await request('/api/v1/atletas/A1/planes', { method: 'POST', body: json({ origen: 'IA', evaluacionId: 'EV1' }) });
  const p = await r.json(); const item = p.dias[0].items.find((x) => x.ejercicioId === 'E2');
  await request(`/api/v1/planes/${p.versionId}`, { method: 'PATCH', body: json({ revisionEsperada: 1, cambios: { items: [{ itemId: item.itemId, descansoSegundos: 60 }] } }) });
  r = await request(`/api/v1/planes/${p.versionId}/aprobacion`, { method: 'POST', body: json({ revisionEsperada: 1 }) }); assert.equal(r.status, 409); assert.equal((await r.json()).revisionActual, 2);
});

test('aislamiento, manual, ausencia incompleta y ruta ajena montada junto al router', async (t) => {
  const { request } = await servidor(t);
  let r = await request('/api/v1/atletas/A2/planes', { method: 'POST', body: json({ origen: 'IA', evaluacionId: 'EV1' }) }); assert.equal(r.status, 404);
  r = await request('/api/v1/atletas/A1/planes', { method: 'POST', body: json({ origen: 'manual', evaluacionId: 'EV1', dias: [{ diaSemana: 1, items: [{ ejercicioId: 'E1', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'Dosis manual basada en nivel observado.', criterioId: 'CR1', datosUtilizados: ['nivel'] }] }, { diaSemana: 4, items: [{ ejercicioId: 'E2', orden: 1, series: 2, objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60, explicacion: 'Dosis manual basada en nivel observado.', criterioId: 'CR2', datosUtilizados: ['nivel'] }] }] }) });
  assert.equal(r.status, 201); assert.equal((await r.json()).origen, 'manual');
  r = await request('/api/v1/planes/V1/aprobacion', { method: 'POST', body: json({ revisionEsperada: 1 }) }); assert.equal(r.status, 200);
  r = await request('/api/v1/planes/V1/reorganizaciones', { method: 'POST', body: json({ motivo: 'Ausencia', ausencia: true }) }); assert.equal(r.status, 422); assert.deepEqual((await r.json()).camposPendientes, ['disponibilidadRegreso']);
  r = await request('/api/v1/ruta-ajena', { actor: null, method: 'POST', body: json({ identidad: 'passthrough' }) }); assert.deepEqual(await r.json(), { recibido: { identidad: 'passthrough' } });
  r = await request('/api/v1/planes/V1', { actor: 'entrenadorAjeno' }); assert.equal(r.status, 404);
  r = await request('/api/v1/me/rutina?fecha=2026-11-23', { actor: 'atletaOtroGimnasio' }); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { estado: 'sin_plan' });
});
