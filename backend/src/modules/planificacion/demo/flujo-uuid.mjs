import assert from 'node:assert/strict';
import { iniciarServidorDemo } from './servidor.mjs';
import { idsDemoUuid } from './fixtures/index.mjs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKENS = Object.freeze({
  eva: 'demo-entrenadora-eva',
  ana: 'demo-atleta-eva',
});

async function pedir(baseUrl, path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { status: res.status, headers: res.headers, data };
}

const server = await iniciarServidorDemo({
  env: { PORT: '0', PLANIFICACION_PROVEEDOR: 'simulado', PLANIFICACION_IDS: 'uuid' },
});

try {
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  // 1. Consulta sin token -> 401
  const sinToken = await pedir(baseUrl, '/me/rutina?fecha=2026-11-23');
  assert.equal(sinToken.status, 401);
  assert.equal(sinToken.data.codigo, 'NO_AUTENTICADO');

  // 2. Eva crea borrador V1 con UUID ficticios
  const crearV1 = await pedir(baseUrl, `/atletas/${idsDemoUuid.atletaEva}/planes`, {
    method: 'POST',
    token: TOKENS.eva,
    body: { origen: 'IA', evaluacionId: idsDemoUuid.evaluacionEva },
  });
  assert.equal(crearV1.status, 201);
  assert.equal(crearV1.headers.get('x-planificacion-demo'), 'modo-simulado; datos-ficticios; ids-uuid');
  const v1 = crearV1.data;
  assert.equal(v1.estado, 'borrador');
  assert.match(v1.versionId, UUID_V4);
  const diaIdsV1 = v1.dias.map((d) => d.diaId);
  const itemIdsV1 = v1.dias.flatMap((d) => d.items.map((i) => i.itemId));
  assert.ok(diaIdsV1.every((id) => UUID_V4.test(id)));
  assert.ok(itemIdsV1.every((id) => UUID_V4.test(id)));

  // 3. Eva edita descanso del segundo ejercicio a 60 s y fija proximaRevision
  const itemE2 = v1.dias[0].items.find((i) => i.ejercicioId === idsDemoUuid.ejercicioE2);
  assert.ok(itemE2);
  const editarV1 = await pedir(baseUrl, `/planes/${v1.versionId}`, {
    method: 'PATCH',
    token: TOKENS.eva,
    body: {
      revisionEsperada: 1,
      cambios: {
        items: [{ itemId: itemE2.itemId, descansoSegundos: 60 }],
        proximaRevision: '2026-12-20',
      },
    },
  });
  assert.equal(editarV1.status, 200);
  const v1Editado = editarV1.data;
  assert.equal(v1Editado.revision, 2);
  assert.equal(v1Editado.proximaRevision, '2026-12-20');
  assert.deepEqual(v1Editado.dias.map((d) => d.diaId), diaIdsV1);
  assert.deepEqual(v1Editado.dias.flatMap((d) => d.items.map((i) => i.itemId)), itemIdsV1);

  // 4. Guardas: revisión vieja -> 409; Ana intentando aprobar -> 403
  const patchViejo = await pedir(baseUrl, `/planes/${v1.versionId}`, {
    method: 'PATCH',
    token: TOKENS.eva,
    body: {
      revisionEsperada: 1,
      cambios: { items: [{ itemId: itemE2.itemId, descansoSegundos: 45 }] },
    },
  });
  assert.equal(patchViejo.status, 409);
  assert.equal(patchViejo.data.codigo, 'REVISION_CONFLICTIVA');
  assert.equal(patchViejo.data.revisionActual, 2);

  const aprobarAna = await pedir(baseUrl, `/planes/${v1.versionId}/aprobacion`, {
    method: 'POST',
    token: TOKENS.ana,
    body: { revisionEsperada: 2 },
  });
  assert.equal(aprobarAna.status, 403);
  assert.equal(aprobarAna.data.codigo, 'SIN_PERMISO');

  // 5. Eva aprueba V1
  const aprobarV1 = await pedir(baseUrl, `/planes/${v1.versionId}/aprobacion`, {
    method: 'POST',
    token: TOKENS.eva,
    body: { revisionEsperada: 2 },
  });
  assert.equal(aprobarV1.status, 200);
  assert.equal(aprobarV1.data.plan.estado, 'vigente');
  assert.equal(aprobarV1.data.anterior, null);

  // 6. Ana consulta V1
  const anaV1 = await pedir(baseUrl, '/me/rutina?fecha=2026-11-23', { token: TOKENS.ana });
  assert.equal(anaV1.status, 200);
  assert.equal(anaV1.data.estado, 'disponible');
  assert.equal(anaV1.data.plan.versionId, v1.versionId);

  // 7. Eva crea V2 (reorganización a tres días) y relee diferencias + datosUtilizados
  const crearV2 = await pedir(baseUrl, `/planes/${v1.versionId}/reorganizaciones`, {
    method: 'POST',
    token: TOKENS.eva,
    body: { motivo: 'Regreso con tres días', ausencia: true, disponibilidadRegreso: [1, 4, 6] },
  });
  assert.equal(crearV2.status, 201);
  const v2 = crearV2.data.plan;
  assert.equal(v2.estado, 'borrador');
  assert.equal(v2.versionBaseId, v1.versionId);
  assert.match(v2.versionId, UUID_V4);
  assert.deepEqual(v2.dias.map((d) => d.diaSemana), [1, 4, 6]);

  const releerV2 = await pedir(baseUrl, `/planes/${v2.versionId}`, { token: TOKENS.eva });
  assert.equal(releerV2.status, 200);
  assert.deepEqual(releerV2.data.diferencias, crearV2.data.diferencias);
  assert.deepEqual(
    releerV2.data.dias.flatMap((d) => d.items.map((i) => i.datosUtilizados)),
    v2.dias.flatMap((d) => d.items.map((i) => i.datosUtilizados)),
  );

  // 8. Ana sigue viendo V1 mientras V2 es borrador
  const anaSigueV1 = await pedir(baseUrl, '/me/rutina?fecha=2026-11-23', { token: TOKENS.ana });
  assert.equal(anaSigueV1.status, 200);
  assert.equal(anaSigueV1.data.plan.versionId, v1.versionId);

  // 9. Eva aprueba V2
  const aprobarV2 = await pedir(baseUrl, `/planes/${v2.versionId}/aprobacion`, {
    method: 'POST',
    token: TOKENS.eva,
    body: { revisionEsperada: 1 },
  });
  assert.equal(aprobarV2.status, 200);
  assert.equal(aprobarV2.data.plan.estado, 'vigente');
  assert.equal(aprobarV2.data.anterior.versionId, v1.versionId);
  assert.equal(aprobarV2.data.anterior.estado, 'historica');

  // 10. Ana pasa a ver V2 y V1 queda histórica para Eva
  const anaV2 = await pedir(baseUrl, '/me/rutina?fecha=2026-11-23', { token: TOKENS.ana });
  assert.equal(anaV2.status, 200);
  assert.equal(anaV2.data.estado, 'disponible');
  assert.equal(anaV2.data.plan.versionId, v2.versionId);

  const v1Historica = await pedir(baseUrl, `/planes/${v1.versionId}`, { token: TOKENS.eva });
  assert.equal(v1Historica.status, 200);
  assert.equal(v1Historica.data.estado, 'historica');

  console.log(JSON.stringify({
    modo: 'simulado-uuid-en-memoria',
    sinToken: sinToken.status,
    v1: {
      versionId: v1.versionId,
      revisionTrasEditar: v1Editado.revision,
      proximaRevision: v1Editado.proximaRevision,
      conservaDiaIds: true,
      conservaItemIds: true,
    },
    guardas: {
      revisionVieja: { status: patchViejo.status, revisionActual: patchViejo.data.revisionActual },
      aprobacionAna: aprobarAna.status,
    },
    v2: {
      versionId: v2.versionId,
      versionBaseId: v2.versionBaseId,
      dias: v2.dias.map((d) => d.diaSemana),
      diferenciasConservadas: true,
      datosUtilizadosConservados: true,
    },
    visibilidadAna: {
      trasAprobarV1: anaV1.data.plan.versionId,
      mientrasV2Borrador: anaSigueV1.data.plan.versionId,
      trasAprobarV2: anaV2.data.plan.versionId,
      v1EstadoFinal: v1Historica.data.estado,
    },
  }, null, 2));
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
