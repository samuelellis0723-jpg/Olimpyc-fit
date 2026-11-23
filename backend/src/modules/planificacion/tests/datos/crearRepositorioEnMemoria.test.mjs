import test from "node:test";
import assert from "node:assert/strict";
import { crearRepositorioEnMemoria } from "../../datos/crearRepositorioEnMemoria.mjs";

function plan({ atletaId = "A1", versionBaseId, dias = [] } = {}) {
  return {
    versionBaseId,
    evaluacionId: `EV-${atletaId}`,
    origen: "manual",
    catalogoVersion: "C1",
    dias,
    creadoEn: "2026-11-21T12:00:00.000Z",
  };
}

function crear(repo, atletaId = "A1", opciones = {}) {
  return repo.crearBorrador({ gimnasioId: "G1", atletaId, plan: plan({ atletaId, ...opciones }) });
}

function capturarError(fn) {
  try { fn(); } catch (error) { return error; }
  assert.fail("Se esperaba un error de dominio");
}

test("asigna versiones únicas por gimnasio, no por atleta, y oculta planes de otro scope", () => {
  const repo = crearRepositorioEnMemoria();
  const a1 = repo.crearBorrador({ gimnasioId: "G1", atletaId: "A1", plan: { ...plan(), aprobacion: { aprobadorId: "intruso", fecha: "2026-11-21T12:00:00.000Z" } } });
  const a2 = crear(repo, "A2");
  const otroGimnasio = repo.crearBorrador({ gimnasioId: "G2", atletaId: "A1", plan: plan() });

  assert.equal(a1.versionId, "V1");
  assert.equal(a2.versionId, "V2");
  assert.equal(otroGimnasio.versionId, "V1");
  assert.equal(repo.obtenerPorId({ gimnasioId: "G2", versionId: "V1" }).gimnasioId, "G2");
  assert.equal(repo.obtenerPorId({ gimnasioId: "G1", versionId: "V1" }).atletaId, "A1");
  assert.equal(repo.obtenerPorId({ gimnasioId: "G2", versionId: "V2" }), undefined);
  assert.equal(repo.obtenerPorId({ gimnasioId: "G1", versionId: "no-existe" }), undefined);
  assert.equal(repo.obtenerVigente({ gimnasioId: "G1", atletaId: "A1" }), undefined);
  assert.equal(a1.aprobacion, undefined);
});

test("edita revisión con CAS y rechaza revisión obsoleta sin alterar el borrador", () => {
  const repo = crearRepositorioEnMemoria();
  const borrador = crear(repo);
  const editado = repo.guardarRevision({
    gimnasioId: "G1", versionId: borrador.versionId, revisionEsperada: 1,
    cambios: { dias: [{ diaId: "D1", diaSemana: 1, items: [] }], proximaRevision: "2026-12-20" },
  });
  assert.equal(editado.revision, 2);
  assert.equal(editado.proximaRevision, "2026-12-20");

  const error = capturarError(() => repo.guardarRevision({
    gimnasioId: "G1", versionId: borrador.versionId, revisionEsperada: 1,
    cambios: { dias: [] },
  }));
  assert.equal(error.status, 409);
  assert.equal(error.codigo, "REVISION_CONFLICTIVA");
  assert.equal(error.revisionActual, 2);
  assert.equal(repo.obtenerPorId({ gimnasioId: "G1", versionId: "V1" }).dias[0].diaId, "D1");
});

test("publica V1, conserva V1 mientras V2 está pendiente y luego la deja histórica", () => {
  const repo = crearRepositorioEnMemoria();
  const v1 = crear(repo, "A1", { dias: [{ diaId: "D1", diaSemana: 1, items: [] }] });
  const aprobada1 = repo.aprobar({ gimnasioId: "G1", versionId: v1.versionId, revisionEsperada: 1, aprobadorId: "T1", fecha: "2026-11-21T13:00:00.000Z" });
  assert.equal(aprobada1.plan.estado, "vigente");
  assert.equal(aprobada1.anterior, null);

  const v2 = crear(repo, "A1", { versionBaseId: "V1", dias: [{ diaId: "D2", diaSemana: 4, items: [] }] });
  assert.equal(v2.versionId, "V2");
  assert.equal(v2.versionBaseId, "V1");
  assert.equal(repo.obtenerVigente({ gimnasioId: "G1", atletaId: "A1" }).versionId, "V1");

  const aprobada2 = repo.aprobar({ gimnasioId: "G1", versionId: "V2", revisionEsperada: 1, aprobadorId: "T1", fecha: "2026-11-22T13:00:00.000Z" });
  assert.equal(aprobada2.plan.estado, "vigente");
  assert.equal(aprobada2.anterior.versionId, "V1");
  assert.equal(aprobada2.anterior.estado, "historica");
  assert.equal(repo.obtenerVigente({ gimnasioId: "G1", atletaId: "A1" }).versionId, "V2");
  assert.equal(repo.obtenerPorId({ gimnasioId: "G1", versionId: "V1" }).estado, "historica");
});

test("creación y aprobación de reorganización exigen que la base siga vigente", () => {
  const repo = crearRepositorioEnMemoria();
  const v1 = crear(repo);
  repo.aprobar({ gimnasioId: "G1", versionId: "V1", revisionEsperada: 1, aprobadorId: "T1", fecha: "2026-11-21T13:00:00.000Z" });
  const v2 = crear(repo, "A1", { versionBaseId: "V1" });
  const v3 = crear(repo, "A1", { versionBaseId: "V1" });
  repo.aprobar({ gimnasioId: "G1", versionId: "V2", revisionEsperada: 1, aprobadorId: "T1", fecha: "2026-11-21T14:00:00.000Z" });

  const error = capturarError(() => repo.aprobar({ gimnasioId: "G1", versionId: "V3", revisionEsperada: 1, aprobadorId: "T1", fecha: "2026-11-21T15:00:00.000Z" }));
  assert.equal(error.status, 409);
  assert.equal(error.codigo, "BASE_NO_VIGENTE");
  assert.equal(repo.obtenerVigente({ gimnasioId: "G1", atletaId: "A1" }).versionId, "V2");
  assert.equal(repo.obtenerPorId({ gimnasioId: "G1", versionId: "V3" }).estado, "borrador");

  const errorCreacion = capturarError(() => crear(repo, "A1", { versionBaseId: "V1" }));
  assert.equal(errorCreacion.codigo, "BASE_NO_VIGENTE");
});

test("carreras CAS y aprobación tienen un único ganador; argumentos y resultados son copias", async () => {
  const repo = crearRepositorioEnMemoria();
  const borrador = crear(repo, "A1", { dias: [{ diaId: "D1", diaSemana: 1, items: [] }] });
  const input = [{ diaId: "D2", diaSemana: 2, items: [] }];
  const edit1 = repo.guardarRevision({ gimnasioId: "G1", versionId: "V1", revisionEsperada: 1, cambios: { dias: input } });
  input[0].diaSemana = 7;
  edit1.dias[0].diaSemana = 6;
  assert.equal(repo.obtenerPorId({ gimnasioId: "G1", versionId: "V1" }).dias[0].diaSemana, 2);

  const resultados = await Promise.allSettled([
    Promise.resolve().then(() => repo.guardarRevision({ gimnasioId: "G1", versionId: "V1", revisionEsperada: 2, cambios: { dias: [] } })),
    Promise.resolve().then(() => repo.guardarRevision({ gimnasioId: "G1", versionId: "V1", revisionEsperada: 2, cambios: { dias: [] } })),
  ]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(resultados.filter((r) => r.status === "rejected").length, 1);

  const revision = repo.obtenerPorId({ gimnasioId: "G1", versionId: borrador.versionId }).revision;
  const aprobaciones = await Promise.allSettled([
    Promise.resolve().then(() => repo.aprobar({ gimnasioId: "G1", versionId: "V1", revisionEsperada: revision, aprobadorId: "T1", fecha: "2026-11-21T13:00:00.000Z" })),
    Promise.resolve().then(() => repo.aprobar({ gimnasioId: "G1", versionId: "V1", revisionEsperada: revision, aprobadorId: "T2", fecha: "2026-11-21T13:01:00.000Z" })),
  ]);
  assert.equal(aprobaciones.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(aprobaciones.filter((r) => r.status === "rejected").length, 1);
  const lectura = repo.obtenerVigente({ gimnasioId: "G1", atletaId: "A1" });
  lectura.aprobacion.aprobadorId = "intruso";
  assert.notEqual(repo.obtenerVigente({ gimnasioId: "G1", atletaId: "A1" }).aprobacion.aprobadorId, "intruso");
});

test("soporta formatoVersionId uuid y rechaza formatos inválidos", () => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.throws(() => crearRepositorioEnMemoria({ formatoVersionId: "otro" }), TypeError);

  const repo = crearRepositorioEnMemoria({ formatoVersionId: "uuid" });
  const v1 = repo.crearBorrador({ gimnasioId: "G1", atletaId: "A1", plan: plan() });
  assert.match(v1.versionId, uuid);
  repo.aprobar({ gimnasioId: "G1", versionId: v1.versionId, revisionEsperada: 1, aprobadorId: "T1", fecha: "2026-11-21T13:00:00.000Z" });

  const v2 = repo.crearBorrador({ gimnasioId: "G1", atletaId: "A1", plan: plan({ versionBaseId: v1.versionId }) });
  assert.match(v2.versionId, uuid);
  assert.notEqual(v2.versionId, v1.versionId);
  assert.equal(v2.versionBaseId, v1.versionId);

  const aprobada2 = repo.aprobar({ gimnasioId: "G1", versionId: v2.versionId, revisionEsperada: 1, aprobadorId: "T1", fecha: "2026-11-22T13:00:00.000Z" });
  assert.equal(aprobada2.plan.estado, "vigente");
  assert.equal(aprobada2.anterior.versionId, v1.versionId);
  assert.equal(aprobada2.anterior.estado, "historica");
});
