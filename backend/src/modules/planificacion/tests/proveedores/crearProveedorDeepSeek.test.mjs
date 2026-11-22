import test from 'node:test';
import assert from 'node:assert/strict';
import { crearProveedorDeepSeek } from '../../proveedores/crearProveedorDeepSeek.mjs';
import { ErrorPlanificacion } from '../../dominio/errores.mjs';

const contexto = {
  perfil: {
    referenciaAtleta: 'ATLETA-DEMO',
    fecha: '2026-11-21',
    modalidad: 'presencial',
    objetivo: 'fuerza general',
    diasDisponibles: [1, 4],
    nivel: 'inicial',
    restricciones: [],
    mediciones: [],
    publicaciones: [{ dato: 'observación inicial', fuente: 'entrenador' }],
    notaPrivada: 'NO ENVIAR NOTA PRIVADA',
  },
  catalogo: {
    catalogoVersion: 'CAT1',
    gimnasioId: 'GIMNASIO-PRIVADO',
    ejercicios: [{
      ejercicioId: 'E1', nombre: 'Banco', grupoMuscular: 'pecho', estaciones: ['B1'],
      restriccionesIncompatibles: [],
      dosis: {
        series: { min: 2, max: 4 },
        objetivoPorSerie: { unidad: 'repeticiones', min: 6, max: 12 },
        descansoSegundos: { min: 30, max: 120 },
      },
      privateId: 'NO ENVIAR ID PRIVADO',
    }],
    criterios: [{
      criterioId: 'CR1', ejercicioId: 'E1', version: '1', texto: 'Técnica controlada',
      procedencia: 'entrenador', estado: 'aprobado', revisorId: 'R1', revisadoEn: '2026-11-20',
      secreto: 'NO ENVIAR',
    }],
  },
  historialEjecutado: [{
    fecha: '2026-11-19', estado: 'completa', diaSemana: 4, ejercicioIds: ['E1'],
    sesionId: 'NO ENVIAR ID DE SESION', actorId: 'NO ENVIAR ACTOR',
  }],
  versionBase: {
    versionId: 'V1',
    gimnasioId: 'NO ENVIAR GIMNASIO',
    dias: [{
      diaId: 'D1', diaSemana: 1,
      items: [{
        itemId: 'IT1', ejercicioId: 'E1', orden: 1, series: 3,
        objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' }, descansoSegundos: 60,
        explicacion: 'Base', criterioId: 'CR1', datosUtilizados: ['objetivo'],
        actorId: 'NO ENVIAR',
      }],
    }],
  },
};

function propuesta(explicacion = 'Se adapta al objetivo y al nivel declarados.') {
  return {
    tipo: 'propuesta',
    dias: [{
      diaSemana: 1,
      items: [{
        ejercicioId: 'E1', orden: 1, series: 3,
        objetivoPorSerie: { cantidad: 10, unidad: 'repeticiones' },
        descansoSegundos: 60, explicacion, criterioId: 'CR1', datosUtilizados: ['objetivo', 'nivel'],
      }],
    }],
    aclaraciones: [],
  };
}

function respuestaJson(payload, finishReason = 'stop') {
  return {
    ok: true,
    json: async () => ({ choices: [{ finish_reason: finishReason, message: { content: JSON.stringify(payload) } }] }),
  };
}

function proveedor(fetchImpl, opciones = {}) {
  return crearProveedorDeepSeek({ apiKey: 'clave-secreta-de-prueba', model: 'deepseek-chat', fetchImpl, ...opciones });
}

async function assertErrorProveedor(promise, codigo) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ErrorPlanificacion);
    assert.equal(error.status, 503);
    assert.equal(error.codigo, codigo);
    assert.doesNotMatch(error.message, /clave-secreta|NO ENVIAR/);
    return true;
  });
}

test('generar envía JSON mode, ejemplo del contrato y solo el contexto proyectado', async () => {
  let request;
  const api = proveedor(async (url, init) => {
    request = { url, ...init, json: JSON.parse(init.body) };
    return respuestaJson(propuesta());
  });

  const result = await api.generar(contexto, {});

  assert.deepEqual(result, propuesta());
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, 'Bearer clave-secreta-de-prueba');
  assert.deepEqual(request.json.response_format, { type: 'json_object' });
  assert.match(request.json.messages[0].content, /json/);
  assert.match(request.json.messages[0].content, /aclaraciones/);
  assert.match(request.json.messages[0].content, /todos los días efectivos/);
  assert.match(request.json.messages[0].content, /criterio aprobado, dosis y restricciones/);
  assert.equal(request.json.max_tokens, 4096);
  const serialized = request.json.messages[1].content;
  for (const privado of ['NO ENVIAR', 'GIMNASIO-PRIVADO', 'notaPrivada', 'sesionId', 'actorId', 'privateId', 'secreto']) {
    assert.equal(serialized.includes(privado), false, `no debe proyectar ${privado}`);
  }
  assert.match(serialized, /observación inicial/);
  const proyectado = JSON.parse(serialized).contexto;
  assert.equal(proyectado.catalogo.catalogoVersion, 'CAT1');
  assert.equal(Object.hasOwn(proyectado.catalogo.criterios[0], 'revisorId'), false);
});

test('reorganizar conserva la explicación obligatoria y la solicitud normalizada', async () => {
  let payload;
  const salida = { tipo: 'propuesta', dias: propuesta().dias, explicacion: 'Se distribuye la rutina en los tres días de regreso.' };
  const api = proveedor(async (_url, init) => {
    payload = JSON.parse(init.body);
    return respuestaJson(salida);
  });

  const result = await api.reorganizar(contexto, {
    motivo: 'Regreso con tres días', disponibilidad: [1, 4, 6], ausencia: true,
  });

  assert.deepEqual(result, salida);
  assert.deepEqual(JSON.parse(payload.messages[1].content).solicitud, {
    motivo: 'Regreso con tres días', disponibilidad: [1, 4, 6], ausencia: true,
  });
});

test('enumera referencias elegibles según el contexto proyectado en generar y reorganizar', async () => {
  const contextoEV1 = {
    ...contexto,
    perfil: { ...contexto.perfil, nivel: '', observacion: '', restricciones: [], mediciones: [] },
    historialEjecutado: [],
  };
  const prompts = [];
  const salidaEV1 = propuesta();
  salidaEV1.dias[0].items[0].datosUtilizados = ['objetivo'];
  const api = proveedor(async (_url, init) => {
    prompts.push(init.body);
    const reorganizacion = JSON.parse(init.body).messages[1].content.includes('"operacion":"reorganizar"');
    const salida = reorganizacion
      ? { tipo: 'propuesta', dias: salidaEV1.dias, explicacion: 'Se ajusta a los días indicados.' }
      : salidaEV1;
    return respuestaJson(salida);
  });

  await api.generar(contextoEV1, {});
  await api.reorganizar(contextoEV1, { motivo: 'Cambio de horario', disponibilidad: [1, 4] });

  for (const body of prompts) {
    const messages = JSON.parse(body).messages;
    assert.match(messages[0].content, /referencias elegibles del contexto proyectado: \["objetivo"\]/);
    assert.match(messages[0].content, /al menos una referencia elegible.*sin duplicados/);
    assert.match(messages[0].content, /Disponibilidad, ausencia, motivo, versionBase.*nunca deben aparecer en datosUtilizados/);
  }
});

test('rechaza referencias no elegibles en datosUtilizados aunque el resto de la propuesta sea válido', async (t) => {
  for (const referencia of ['disponibilidad', 'mediciones', 'versionBase']) {
    await t.test(referencia, async () => {
      const salida = propuesta();
      salida.dias[0].items[0].datosUtilizados = [referencia];
      await assertErrorProveedor(proveedor(async () => respuestaJson(salida)).generar(contexto, {}), 'RESPUESTA_PROVEEDOR_INVALIDA');
    });
  }
});

test('acepta una aclaración con la forma exacta del contrato', async () => {
  const aclaracion = {
    tipo: 'aclaracion', pregunta: '¿Cuál es la medida pendiente?', camposPendientes: ['mediciones'],
  };
  const api = proveedor(async () => respuestaJson(aclaracion));
  assert.deepEqual(await api.generar(contexto, {}), aclaracion);
});

test('rechaza solicitud con forma incorrecta antes de llamar a la red', async () => {
  let llamadas = 0;
  const api = proveedor(async () => { llamadas += 1; return respuestaJson(propuesta()); });
  await assert.rejects(api.generar(contexto, { evaluacionId: 'EV1' }), TypeError);
  await assert.rejects(api.reorganizar(contexto, { motivo: 'X', disponibilidad: [1], actorId: 'T1' }), TypeError);
  assert.equal(llamadas, 0);
});

test('blanco, JSON truncado y respuesta estructurada incorrecta son 503 inválidos', async (t) => {
  const casos = [
    ['contenido en blanco', { choices: [{ finish_reason: 'stop', message: { content: '   ' } }] }],
    ['JSON truncado', { choices: [{ finish_reason: 'length', message: { content: '{"tipo":"propuesta"' } }] }],
    ['estructura inválida', { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ tipo: 'propuesta', dias: [], aclaraciones: [], extra: 1 }) } }] }],
  ];
  for (const [nombre, body] of casos) {
    await t.test(nombre, async () => {
      await assertErrorProveedor(proveedor(async () => ({ ok: true, json: async () => body }))
        .generar(contexto, {}), 'RESPUESTA_PROVEEDOR_INVALIDA');
    });
  }
});

test('timeout cubre la lectura del cuerpo y cancela fetch', async () => {
  let signal;
  const api = proveedor(async (_url, init) => {
    signal = init.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  }, { timeoutMs: 15 });

  await assertErrorProveedor(api.generar(contexto, {}), 'PROVEEDOR_NO_DISPONIBLE');
  assert.equal(signal.aborted, true);
});

test('error HTTP y fallo de transporte no exponen respuesta ni clave', async (t) => {
  await t.test('HTTP', async () => {
    await assertErrorProveedor(proveedor(async () => ({ ok: false, status: 401, text: async () => 'clave-secreta-de-prueba' }))
      .generar(contexto, {}), 'PROVEEDOR_NO_DISPONIBLE');
  });
  await t.test('red', async () => {
    await assertErrorProveedor(proveedor(async () => { throw new Error('clave-secreta-de-prueba'); })
      .generar(contexto, {}), 'PROVEEDOR_NO_DISPONIBLE');
  });
  await t.test('envelope HTTP JSON inválido', async () => {
    await assertErrorProveedor(proveedor(async () => ({ ok: true, json: async () => ({ error: 'clave-secreta-de-prueba' }) }))
      .generar(contexto, {}), 'RESPUESTA_PROVEEDOR_INVALIDA');
  });
});
