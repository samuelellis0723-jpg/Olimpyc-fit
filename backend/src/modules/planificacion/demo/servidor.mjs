import express from 'express';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { crearRouterPlanificacion, crearServicioPlanificacion, crearRepositorioEnMemoria, crearProveedorDeepSeek, crearProveedorSimulado } from '../index.mjs';
import { actoresDemo, obtenerEvaluacion, obtenerCatalogo, tieneAsignacion, obtenerHistorialEjecutado } from './fixtures/index.mjs';

const aliases = Object.freeze({
  entrenadoraEva: actoresDemo.entrenadoraEva,
  entrenadorAjeno: actoresDemo.entrenadorAjeno,
  atletaEva: actoresDemo.atletaEva,
  atletaOtroGimnasio: actoresDemo.atletaOtroGimnasio,
});
const tokenPorAlias = Object.freeze({ entrenadoraEva: 'demo-entrenadora-eva', entrenadorAjeno: 'demo-entrenador-ajeno', atletaEva: 'demo-atleta-eva', atletaOtroGimnasio: 'demo-atleta-otro-gimnasio' });
const esPlaceholder = (x) => !x?.trim() || /^(replace|your[-_ ]|changeme|placeholder|model$|model[-_ ]name$|api[-_ ]key$|<|\$\{)/i.test(x.trim());

export function crearAplicacionDemo({ env = process.env, proveedorForzado } = {}) {
  const modo = proveedorForzado ?? env.PLANIFICACION_PROVEEDOR ?? 'simulado';
  if (!['simulado', 'real'].includes(modo)) throw new Error('PLANIFICACION_PROVEEDOR debe ser simulado o real.');
  const proveedor = modo === 'simulado' ? crearProveedorSimulado() : (() => {
    if (esPlaceholder(env.DEEPSEEK_API_KEY) || esPlaceholder(env.DEEPSEEK_MODEL)) throw new Error('El modo real requiere DEEPSEEK_API_KEY y DEEPSEEK_MODEL configurados.');
    return crearProveedorDeepSeek({ apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL });
  })();
  const repo = crearRepositorioEnMemoria();
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
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Planificacion-Demo', modo === 'simulado' ? 'modo-simulado; datos-ficticios' : 'modo-real; identidad-demo; almacenamiento-en-memoria'); next(); });
  app.use('/api/v1', crearRouterPlanificacion({ servicio, resolverActor }));
  return app;
}

export async function iniciarServidorDemo({ env = process.env } = {}) {
  const app = crearAplicacionDemo({ env });
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
  process.stdout.write(`Planificación demo escuchando en http://127.0.0.1:${address.port} (${env.PLANIFICACION_PROVEEDOR ?? 'simulado'}).\n`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await iniciarServidorDemo();
