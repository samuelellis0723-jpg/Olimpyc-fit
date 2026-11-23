import express from 'express';
import { crearRouterPlanificacion } from '../modules/planificacion/http/crearRouterPlanificacion.mjs';
import { crearServicioPlanificacion } from '../modules/planificacion/aplicacion/crearServicioPlanificacion.mjs';
import { crearProveedorDeepSeek } from '../modules/planificacion/proveedores/crearProveedorDeepSeek.mjs';
import { crearProveedorSimulado } from '../modules/planificacion/demo/proveedor-simulado.mjs';
import { ErrorPlanificacion } from '../modules/planificacion/dominio/errores.mjs';
import { crearRouterOperacion } from './crearRouterOperacion.js';
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

function resolverProveedorAlArrancar() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey && String(apiKey).trim()) {
    return {
      proveedor: crearProveedorDeepSeek({
        apiKey: String(apiKey).trim(),
        model: process.env.DEEPSEEK_MODEL,
      }),
      modeloProveedor: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  }

  return {
    proveedor: crearProveedorSimulado(),
    modeloProveedor: 'simulado',
  };
}

export function montarPlanificacionApi(app, { limiteBody = '1mb' } = {}) {
  app.use(express.json({ limit: limiteBody }));

  const repo = crearRepositorioPlanificacionSupabase();
  const { proveedor, modeloProveedor } = resolverProveedorAlArrancar();

  const servicio = crearServicioPlanificacion({
    proveedor,
    repo,
    obtenerEvaluacion,
    obtenerCatalogo,
    tieneAsignacion,
    obtenerHistorialEjecutado,
    reloj: () => new Date().toISOString(),
    modeloProveedor,
  });

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

  const router = crearRouterPlanificacion({ servicio, resolverActor });
  app.use('/api/v1', router);
  app.use('/api/v1', crearRouterOperacion());

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