import { randomUUID } from "node:crypto";
import { ErrorPlanificacion } from "../dominio/errores.mjs";

const copia = (valor) => valor === undefined ? undefined : structuredClone(valor);

function errorPlan(status, codigo, mensaje, detalles = {}) {
  return new ErrorPlanificacion({ status, codigo, mensaje, ...detalles });
}

function noEncontrado() {
  return errorPlan(404, "NO_ENCONTRADO", "El plan no existe.");
}

function revisionConflictiva(revisionActual) {
  return errorPlan(409, "REVISION_CONFLICTIVA", "El plan cambió; recarga la revisión actual.", { revisionActual });
}

function baseNoVigente(revisionActual) {
  return errorPlan(409, "BASE_NO_VIGENTE", "La versión base ya no está vigente.", { revisionActual });
}

/** Repositorio temporal para desarrollo. Todas las comparaciones y escrituras
 * ocurren en el mismo tramo síncrono, antes de devolver el resultado.
 */
export function crearRepositorioEnMemoria({ formatoVersionId = "secuencial" } = {}) {
  if (!["secuencial", "uuid"].includes(formatoVersionId)) {
    throw new TypeError("formatoVersionId debe ser 'secuencial' o 'uuid'.");
  }
  const planesPorGimnasio = new Map();
  const contadoresPorGimnasio = new Map();

  const planesDelGimnasio = (gimnasioId) => {
    let planes = planesPorGimnasio.get(gimnasioId);
    if (!planes) {
      planes = new Map();
      planesPorGimnasio.set(gimnasioId, planes);
    }
    return planes;
  };

  const buscar = ({ gimnasioId, versionId }) => planesPorGimnasio.get(gimnasioId)?.get(versionId);

  const baseVigente = (plan) => {
    if (!plan.versionBaseId) return true;
    const base = buscar({ gimnasioId: plan.gimnasioId, versionId: plan.versionBaseId });
    return Boolean(base && base.atletaId === plan.atletaId && base.estado === "vigente");
  };

  return {
    obtenerPorId({ gimnasioId, versionId }) {
      return copia(buscar({ gimnasioId, versionId }));
    },

    obtenerVigente({ gimnasioId, atletaId }) {
      const encontrado = [...(planesPorGimnasio.get(gimnasioId)?.values() ?? [])]
        .find((plan) => plan.atletaId === atletaId && plan.estado === "vigente");
      return copia(encontrado);
    },

    crearBorrador({ gimnasioId, atletaId, plan }) {
      const { aprobacion: _aprobacion, ...entrada } = copia(plan);
      if (entrada.versionBaseId) {
        const base = buscar({ gimnasioId, versionId: entrada.versionBaseId });
        if (!base || base.atletaId !== atletaId || base.estado !== "vigente") throw baseNoVigente(base?.revision);
      }

      let versionId;
      if (formatoVersionId === "uuid") {
        versionId = randomUUID();
      } else {
        const siguiente = (contadoresPorGimnasio.get(gimnasioId) ?? 0) + 1;
        versionId = `V${siguiente}`;
        contadoresPorGimnasio.set(gimnasioId, siguiente);
      }
      const planes = planesDelGimnasio(gimnasioId);
      const guardado = {
        ...entrada,
        versionId,
        gimnasioId,
        atletaId,
        estado: "borrador",
        revision: 1,
      };
      planes.set(versionId, guardado);
      return copia(guardado);
    },

    guardarRevision({ gimnasioId, versionId, revisionEsperada, cambios }) {
      const actual = buscar({ gimnasioId, versionId });
      if (!actual) throw noEncontrado();
      if (actual.estado !== "borrador") throw errorPlan(409, "REVISION_CONFLICTIVA", "Solo se puede editar un borrador.", { revisionActual: actual.revision });
      if (actual.revision !== revisionEsperada) throw revisionConflictiva(actual.revision);

      const editado = {
        ...actual,
        ...(cambios.dias === undefined ? {} : { dias: copia(cambios.dias) }),
        ...(cambios.proximaRevision === undefined ? {} : { proximaRevision: cambios.proximaRevision }),
        revision: actual.revision + 1,
      };
      planesDelGimnasio(gimnasioId).set(versionId, editado);
      return copia(editado);
    },

    aprobar({ gimnasioId, versionId, revisionEsperada, aprobadorId, fecha }) {
      const actual = buscar({ gimnasioId, versionId });
      if (!actual) throw noEncontrado();
      if (actual.estado !== "borrador") throw errorPlan(409, "REVISION_CONFLICTIVA", "Solo se puede aprobar un borrador.", { revisionActual: actual.revision });
      if (actual.revision !== revisionEsperada) throw revisionConflictiva(actual.revision);
      if (!baseVigente(actual)) {
        const base = buscar({ gimnasioId, versionId: actual.versionBaseId });
        throw baseNoVigente(base?.revision);
      }

      const anterior = [...planesDelGimnasio(gimnasioId).values()]
        .find((plan) => plan.atletaId === actual.atletaId && plan.estado === "vigente");
      const nuevoAnterior = anterior ? { ...anterior, estado: "historica" } : null;
      const aprobado = {
        ...actual,
        estado: "vigente",
        aprobacion: { aprobadorId, fecha },
      };

      // Commit síncrono: no hay punto de intercalado entre verificar y publicar.
      if (anterior) planesDelGimnasio(gimnasioId).set(anterior.versionId, nuevoAnterior);
      planesDelGimnasio(gimnasioId).set(versionId, aprobado);
      return { plan: copia(aprobado), anterior: copia(nuevoAnterior) };
    },
  };
}
