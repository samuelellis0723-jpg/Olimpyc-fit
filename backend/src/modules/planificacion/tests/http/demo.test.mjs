import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { crearAplicacionDemo, iniciarServidorDemo } from '../../demo/servidor.mjs';

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
