import express from 'express';
import { ErrorPlanificacion } from '../adapters/errorPlanificacion.js';
import {
  resolverActorDesdeToken,
  tieneAsignacion,
} from '../adapters/identidadSupabase.js';
import {
  obtenerEvaluacion,
  obtenerCatalogo,
  obtenerHistorialEjecutado,
} from '../adapters/fuentesPlanificacionSupabase.js';
import { crearRepositorioPlanificacionSupabase } from '../adapters/repositorioPlanificacionSupabase.js';

async function cargarModuloPlanificacionSiExiste() {
  try {
    const [
      { crearRouterPlanificacion },
      { crearServicioPlanificacion },
      { crearProveedorDeepSeek },
      { crearProveedorSimulado },
    ] = await Promise.all([
      import('../../../src/modules/planificacion/http/crearRouterPlanificacion.mjs'),
      import('../../../src/modules/planificacion/aplicacion/crearServicioPlanificacion.mjs'),
      import('../../../src/modules/planificacion/proveedores/crearProveedorDeepSeek.mjs'),
      import('../../../src/modules/planificacion/demo/proveedor-simulado.mjs'),
    ]);

    return {
      disponible: true,
      crearRouterPlanificacion,
      crearServicioPlanificacion,
      crearProveedorDeepSeek,
      crearProveedorSimulado,
    };
  } catch {
    return { disponible: false };
  }
}

export function montarPlanificacionApi(app, { limiteBody = '1mb' } = {}) {
  app.use(express.json({ limit: limiteBody }));

  const repo = crearRepositorioPlanificacionSupabase();

  async function resolverActor(req) {
    const authHeader = req.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    const token = match ? match[1].trim() : null;

    try {
      return await resolverActorDesdeToken(token);
    } catch (err) {
      throw new ErrorPlanificacion({
        status: 401,
        codigo: 'NO_AUTENTICADO',
        mensaje: err?.message || 'No autenticado',
      });
    }
  }

  const router = express.Router();
  let inicializado = false;

  async function asegurarRouter(req, res, next) {
    if (inicializado) return next();

    const mod = await cargarModuloPlanificacionSiExiste();
    if (mod.disponible) {
      const usaDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
      const proveedor = usaDeepSeek
        ? mod.crearProveedorDeepSeek({
            apiKey: process.env.DEEPSEEK_API_KEY,
            model: process.env.DEEPSEEK_MODEL,
          })
        : mod.crearProveedorSimulado();

      const servicio = mod.crearServicioPlanificacion({
        proveedor,
        repo,
        obtenerEvaluacion,
        obtenerCatalogo,
        tieneAsignacion,
        obtenerHistorialEjecutado,
        reloj: () => new Date().toISOString(),
        modeloProveedor: usaDeepSeek
          ? process.env.DEEPSEEK_MODEL || 'deepseek-chat'
          : 'simulado',
      });

      const subRouter = mod.crearRouterPlanificacion({ servicio, resolverActor });
      router.use(subRouter);
    } else {
      router.get('/me/rutina', async (r, _res, nextErr) => {
        try {
          await resolverActor(r);
          _res.status(200).json({ estado: 'sin_plan' });
        } catch (e) {
          nextErr(e);
        }
      });
    }

    inicializado = true;
    return next();
  }

  router.use(asegurarRouter);
  app.use('/api/v1', router);

  app.use((err, _req, res, _next) => {
    const statusPermitidos = [401, 403, 404, 409, 422, 503];
    const status = statusPermitidos.includes(Number(err?.status))
      ? Number(err.status)
      : 503;

    const codigo =
      err?.codigo ||
      (status === 401
        ? 'NO_AUTENTICADO'
        : status === 403
          ? 'SIN_PERMISO'
          : status === 404
            ? 'NO_ENCONTRADO'
            : status === 409
              ? 'REVISION_CONFLICTIVA'
              : status === 422
                ? 'SOLICITUD_INVALIDA'
                : 'PROVEEDOR_NO_DISPONIBLE');

    const payload = {
      codigo,
      mensaje:
        status === 503 && !err?.codigo
          ? 'Error interno de servicio'
          : err?.message || 'Error en la operación',
    };

    if (Array.isArray(err?.camposPendientes)) {
      payload.camposPendientes = err.camposPendientes;
    }
    if (err?.revisionActual !== undefined) {
      payload.revisionActual = err.revisionActual;
    }

    res.status(status).json(payload);
  });
}