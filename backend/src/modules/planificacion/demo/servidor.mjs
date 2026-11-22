import express from 'express';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { crearRouterPlanificacion, crearServicioPlanificacion, crearRepositorioEnMemoria, crearProveedorDeepSeek, crearProveedorSimulado } from '../index.mjs';
import { crearAdaptadoresDemo } from './fixtures/index.mjs';

const tokenPorAlias = Object.freeze({ entrenadoraEva: 'demo-entrenadora-eva', entrenadorAjeno: 'demo-entrenador-ajeno', atletaEva: 'demo-atleta-eva', atletaOtroGimnasio: 'demo-atleta-otro-gimnasio' });
const esPlaceholder = (x) => !x?.trim() || /^(replace|your[-_ ]|changeme|placeholder|model$|model[-_ ]name$|api[-_ ]key$|<|\$\{)/i.test(x.trim());
const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function crearAplicacionDemo({ env = process.env, proveedorForzado } = {}) {
  const modo = proveedorForzado ?? env.PLANIFICACION_PROVEEDOR ?? 'simulado';
  if (!['simulado', 'real'].includes(modo)) throw new Error('PLANIFICACION_PROVEEDOR debe ser simulado o real.');
  const modoIds = env.PLANIFICACION_IDS ?? 'codigos';
  if (!['codigos', 'uuid'].includes(modoIds)) throw new Error('PLANIFICACION_IDS debe ser codigos o uuid.');
  const { actores, obtenerEvaluacion, obtenerCatalogo, tieneAsignacion, obtenerHistorialEjecutado } = crearAdaptadoresDemo({ modoIds });
  const aliases = Object.freeze({
    entrenadoraEva: actores.entrenadoraEva,
    entrenadorAjeno: actores.entrenadorAjeno,
    atletaEva: actores.atletaEva,
    atletaOtroGimnasio: actores.atletaOtroGimnasio,
  });
  const proveedor = modo === 'simulado' ? crearProveedorSimulado() : (() => {
    if (esPlaceholder(env.DEEPSEEK_API_KEY) || esPlaceholder(env.DEEPSEEK_MODEL)) throw new Error('El modo real requiere DEEPSEEK_API_KEY y DEEPSEEK_MODEL configurados.');
    return crearProveedorDeepSeek({ apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL });
  })();
  const repo = crearRepositorioEnMemoria({ formatoVersionId: modoIds === 'uuid' ? 'uuid' : 'secuencial' });
  const servicio = crearServicioPlanificacion({ proveedor, repo, obtenerEvaluacion, obtenerCatalogo, tieneAsignacion, obtenerHistorialEjecutado,
    modeloProveedor: modo === 'simulado' ? 'simulado (salida de origen DeepSeek)' : env.DEEPSEEK_MODEL,
    informarOperacion(evento) {
      const permitido = { operacion: evento.operacion, modeloProveedor: evento.modeloProveedor, catalogoVersion: evento.catalogoVersion,
        versionesCriterios: evento.versionesCriterios, evaluacionId: evento.evaluacionId,
        ...(evento.versionBaseId ? { versionBaseId: evento.versionBaseId } : {}), resultado: evento.resultado,
        ...(evento.codigoError ? { codigoError: evento.codigoError } : {}) };
      process.stdout.write(`[planificacion] ${JSON.stringify(permitido)}\n`);
    },
  });
  async function resolverActor(req) {
    const bearer = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const alias = req.get('x-demo-actor') ?? Object.keys(tokenPorAlias).find((key) => tokenPorAlias[key] === bearer);
    return Object.hasOwn(aliases, alias) ? aliases[alias] : undefined;
  }
  const cabeceraDemo = (modo === 'simulado' ? 'modo-simulado; datos-ficticios' : 'modo-real; identidad-demo; almacenamiento-en-memoria')
    + (modoIds === 'uuid' ? '; ids-uuid' : '');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Planificacion-Demo', cabeceraDemo);
    const origin = req.get('origin');
    if (origin && LOOPBACK_ORIGIN.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Demo-Actor');
      res.setHeader('Access-Control-Expose-Headers', 'X-Planificacion-Demo');
      if (req.method === 'OPTIONS') return res.status(204).end();
    }
    return next();
  });
  app.use('/api/v1', crearRouterPlanificacion({ servicio, resolverActor }));
  return app;
}

export async function iniciarServidorDemo({ env = process.env } = {}) {
  const app = crearAplicacionDemo({ env });
  const modoIds = env.PLANIFICACION_IDS ?? 'codigos';
  const port = env.PORT === undefined ? 3001 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT debe ser un puerto válido entre 0 y 65535.');
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
  const address = server.address();
  process.stdout.write(`Planificación demo escuchando en http://127.0.0.1:${address.port} (${env.PLANIFICACION_PROVEEDOR ?? 'simulado'}, ids: ${modoIds}).\n`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await iniciarServidorDemo();
