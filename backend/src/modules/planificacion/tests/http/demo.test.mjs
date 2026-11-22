import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { crearAplicacionDemo, iniciarServidorDemo } from '../../demo/servidor.mjs';
import { idsDemoUuid } from '../../demo/fixtures/index.mjs';

test('demo identifica modo simulado, alias y bearer; modo real rechaza placeholders', async (t) => {
  const app = crearAplicacionDemo({ env: { PLANIFICACION_PROVEEDOR: 'simulado' } });
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  t.after(() => new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;
  let response = await fetch(`${base}/api/v1/atletas/A1/planes`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Demo-Actor': 'entrenadoraEva' }, body: JSON.stringify({ origen: 'IA', evaluacionId: 'EV1' }) });
  assert.equal(response.status, 201); assert.equal(response.headers.get('x-planificacion-demo'), 'modo-simulado; datos-ficticios');
  response = await fetch(`${base}/api/v1/me/rutina?fecha=2026-11-23`, { headers: { authorization: 'Bearer demo-atleta-eva' } });
  assert.equal(response.status, 200);
  response = await fetch(`${base}/api/v1/me/rutina?fecha=2026-11-23`, { headers: { 'X-Demo-Actor': '__proto__' } }); assert.equal(response.status, 401);
  assert.throws(() => crearAplicacionDemo({ env: { PLANIFICACION_PROVEEDOR: 'real', DEEPSEEK_API_KEY: 'replace-with-your-key', DEEPSEEK_MODEL: 'model' } }), /requiere/);
  assert.throws(() => crearAplicacionDemo({ env: { PLANIFICACION_PROVEEDOR: 'real', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'model-name' } }), /requiere/);
  assert.doesNotThrow(() => crearAplicacionDemo({ env: { PLANIFICACION_PROVEEDOR: 'real', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'test-model' } }));
});

test('servidor demo arranca en loopback con puerto efímero', async () => {
  const server = await iniciarServidorDemo({ env: { PORT: '0', PLANIFICACION_PROVEEDOR: 'simulado' } });
  try {
    assert.equal(server.address().address, '127.0.0.1');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/me/rutina?fecha=2026-11-23`, { headers: { 'X-Demo-Actor': 'atletaEva' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-planificacion-demo'), 'modo-simulado; datos-ficticios');
  } finally { await new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); }
});

test('servidor demo propaga EADDRINUSE sin dejar un listener huérfano', async () => {
  const ocupado = createServer();
  await new Promise((resolve, reject) => { ocupado.once('error', reject); ocupado.listen(0, '127.0.0.1', resolve); });
  const port = ocupado.address().port;
  try {
    await assert.rejects(iniciarServidorDemo({ env: { PORT: String(port), PLANIFICACION_PROVEEDOR: 'simulado' } }), (error) => error?.code === 'EADDRINUSE');
    assert.equal(ocupado.listening, true);
  } finally {
    await new Promise((resolve, reject) => ocupado.close((error) => error ? reject(error) : resolve()));
  }
});

test('modo uuid ejecuta el recorrido completo V1->V2 con guardas y CORS loopback estricto', async (t) => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const app = crearAplicacionDemo({ env: { PLANIFICACION_PROVEEDOR: 'simulado', PLANIFICACION_IDS: 'uuid' } });
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  t.after(() => new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  // Preflight loopback vs origen externo
  const preflightOk = await fetch(`${base}/me/rutina?fecha=2026-11-23`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
  });
  assert.equal(preflightOk.status, 204);
  assert.equal(preflightOk.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const reqExterno = await fetch(`${base}/me/rutina?fecha=2026-11-23`, {
    headers: { Origin: 'https://externo.example', Authorization: 'Bearer demo-atleta-eva' },
  });
  assert.equal(reqExterno.headers.get('access-control-allow-origin'), null);

  // Sin token -> 401
  const sinToken = await fetch(`${base}/me/rutina?fecha=2026-11-23`);
  assert.equal(sinToken.status, 401);

  // Eva crea V1
  const resV1 = await fetch(`${base}/atletas/${idsDemoUuid.atletaEva}/planes`, {
    method: 'POST',
    headers: { Authorization: 'Bearer demo-entrenadora-eva', 'content-type': 'application/json' },
    body: JSON.stringify({ origen: 'IA', evaluacionId: idsDemoUuid.evaluacionEva }),
  });
  assert.equal(resV1.status, 201);
  assert.equal(resV1.headers.get('x-planificacion-demo'), 'modo-simulado; datos-ficticios; ids-uuid');
  const v1 = await resV1.json();
  assert.match(v1.versionId, uuid);
  const itemE2 = v1.dias[0].items.find((i) => i.ejercicioId === idsDemoUuid.ejercicioE2);
  const diaIds = v1.dias.map((d) => d.diaId);
  const itemIds = v1.dias.flatMap((d) => d.items.map((i) => i.itemId));

  // Eva edita V1 y conserva diaId/itemId
  const resPatch = await fetch(`${base}/planes/${v1.versionId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer demo-entrenadora-eva', 'content-type': 'application/json' },
    body: JSON.stringify({ revisionEsperada: 1, cambios: { items: [{ itemId: itemE2.itemId, descansoSegundos: 60 }], proximaRevision: '2026-12-20' } }),
  });
  assert.equal(resPatch.status, 200);
  const v1Edit = await resPatch.json();
  assert.equal(v1Edit.revision, 2);
  assert.equal(v1Edit.proximaRevision, '2026-12-20');
  assert.deepEqual(v1Edit.dias.map((d) => d.diaId), diaIds);
  assert.deepEqual(v1Edit.dias.flatMap((d) => d.items.map((i) => i.itemId)), itemIds);

  // Conflicto 409 y Ana 403
  const resConf = await fetch(`${base}/planes/${v1.versionId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer demo-entrenadora-eva', 'content-type': 'application/json' },
    body: JSON.stringify({ revisionEsperada: 1, cambios: { items: [{ itemId: itemE2.itemId, descansoSegundos: 45 }] } }),
  });
  assert.equal(resConf.status, 409);
  assert.equal((await resConf.json()).revisionActual, 2);

  const resAnaAprobar = await fetch(`${base}/planes/${v1.versionId}/aprobacion`, {
    method: 'POST',
    headers: { Authorization: 'Bearer demo-atleta-eva', 'content-type': 'application/json' },
    body: JSON.stringify({ revisionEsperada: 2 }),
  });
  assert.equal(resAnaAprobar.status, 403);

  // Eva aprueba V1, Ana consulta V1
  assert.equal((await fetch(`${base}/planes/${v1.versionId}/aprobacion`, {
    method: 'POST',
    headers: { Authorization: 'Bearer demo-entrenadora-eva', 'content-type': 'application/json' },
    body: JSON.stringify({ revisionEsperada: 2 }),
  })).status, 200);

  let rutinaAna = await (await fetch(`${base}/me/rutina?fecha=2026-11-23`, { headers: { Authorization: 'Bearer demo-atleta-eva' } })).json();
  assert.equal(rutinaAna.plan.versionId, v1.versionId);

  // Eva crea V2; Ana sigue viendo V1 hasta aprobación
  const resV2 = await fetch(`${base}/planes/${v1.versionId}/reorganizaciones`, {
    method: 'POST',
    headers: { Authorization: 'Bearer demo-entrenadora-eva', 'content-type': 'application/json' },
    body: JSON.stringify({ motivo: 'Regreso con tres días', ausencia: true, disponibilidadRegreso: [1, 4, 6] }),
  });
  assert.equal(resV2.status, 201);
  const v2 = (await resV2.json()).plan;
  assert.match(v2.versionId, uuid);
  assert.equal(v2.versionBaseId, v1.versionId);

  rutinaAna = await (await fetch(`${base}/me/rutina?fecha=2026-11-23`, { headers: { Authorization: 'Bearer demo-atleta-eva' } })).json();
  assert.equal(rutinaAna.plan.versionId, v1.versionId);

  assert.equal((await fetch(`${base}/planes/${v2.versionId}/aprobacion`, {
    method: 'POST',
    headers: { Authorization: 'Bearer demo-entrenadora-eva', 'content-type': 'application/json' },
    body: JSON.stringify({ revisionEsperada: 1 }),
  })).status, 200);

  rutinaAna = await (await fetch(`${base}/me/rutina?fecha=2026-11-23`, { headers: { Authorization: 'Bearer demo-atleta-eva' } })).json();
  assert.equal(rutinaAna.plan.versionId, v2.versionId);
  const v1Hist = await (await fetch(`${base}/planes/${v1.versionId}`, { headers: { Authorization: 'Bearer demo-entrenadora-eva' } })).json();
  assert.equal(v1Hist.estado, 'historica');
});
