import { useEffect, useMemo, useState } from 'react';
import { planService } from '../../services/planService.js';

const DAY_NAMES = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };

function planFrom(response, expectedVersionId) {
  const plan = response?.plan && typeof response.plan === 'object' ? response.plan : response;
  if (!plan || typeof plan.versionId !== 'string' || !Number.isInteger(plan.revision) || typeof plan.estado !== 'string' || !Array.isArray(plan.dias)) {
    throw new Error('El servidor devolvió un plan con formato inesperado. No se actualizará la ficha.');
  }
  if (expectedVersionId && plan.versionId !== expectedVersionId) throw new Error('El servidor devolvió otra versión. Recarga el plan antes de continuar.');
  if (plan.dias.some(day => typeof day.diaId !== 'string' || !Array.isArray(day.items) || day.items.some(item => typeof item.itemId !== 'string'))) {
    throw new Error('La respuesta del plan no contiene los identificadores de día y ejercicio esperados. No se editará esta versión.');
  }
  return plan;
}

function displayError(error) {
  const messages = {
    401: 'La sesión Supabase expiró o no está autenticada. Vuelve a iniciar sesión.',
    403: 'El servidor rechazó el permiso para administrar este plan.',
    404: 'No se encontró la versión o la evaluación seleccionada.',
    409: error?.codigo === 'REVISION_CONFLICTIVA'
      ? `El plan cambió en el servidor. Revisión actual: ${Number.isInteger(error.revisionActual) ? error.revisionActual : 'no informada'}. Recarga antes de reintentar.`
      : 'El servidor reportó un conflicto. Recarga la versión antes de reintentar.',
    422: Array.isArray(error?.camposPendientes) && error.camposPendientes.length
      ? `Faltan datos requeridos por el servidor: ${error.camposPendientes.join(', ')}.`
      : 'El servidor rechazó los datos del plan. Revisa la evaluación y el contenido requerido.',
  };
  return messages[error?.status] || error?.message || 'No se pudo completar la operación.';
}

function PlanCard({ plan, active, busy, onSelect, onReload, onApprove, onEdit }) {
  const [itemId, setItemId] = useState('');
  const [series, setSeries] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('repeticiones');
  const [rest, setRest] = useState('');
  const [explanation, setExplanation] = useState('');
  const items = useMemo(() => plan.dias.flatMap(day => day.items.map(item => ({ ...item, diaId: day.diaId, diaSemana: day.diaSemana }))), [plan]);
  const selectedItem = items.find(item => item.itemId === itemId) || items[0];

  useEffect(() => {
    if (!selectedItem) return;
    setItemId(selectedItem.itemId);
    setSeries(String(selectedItem.series ?? ''));
    setTarget(String(selectedItem.objetivoPorSerie?.cantidad ?? ''));
    setUnit(selectedItem.objetivoPorSerie?.unidad || 'repeticiones');
    setRest(String(selectedItem.descansoSegundos ?? ''));
    setExplanation(selectedItem.explicacion || '');
  }, [selectedItem?.itemId, plan.revision]);

  function chooseItem(value) {
    setItemId(value);
    const found = items.find(item => item.itemId === value);
    if (!found) return;
    setSeries(String(found.series ?? ''));
    setTarget(String(found.objetivoPorSerie?.cantidad ?? ''));
    setUnit(found.objetivoPorSerie?.unidad || 'repeticiones');
    setRest(String(found.descansoSegundos ?? ''));
    setExplanation(found.explicacion || '');
  }

  function submitEdit(event) {
    event.preventDefault();
    if (!selectedItem || !Number.isInteger(Number(series)) || Number(series) < 1 || !Number.isInteger(Number(target)) || Number(target) < 1 || !Number.isInteger(Number(rest)) || Number(rest) < 0) return;
    onEdit(plan, {
      items: [{
        itemId: selectedItem.itemId,
        descansoSegundos: Number(rest),
        series: Number(series),
        objetivoPorSerie: { cantidad: Number(target), unidad },
        ...(explanation.trim() ? { explicacion: explanation.trim() } : {}),
      }],
    });
  }

  return <article className={`surface-card trainer-plan-card${active ? ' is-active' : ''}`}>
    <header className="trainer-plan-card__heading"><div><span className="eyebrow">Plan · revisión {plan.revision}</span><h3>{plan.estado === 'vigente' ? 'Versión vigente' : plan.estado === 'historica' ? 'Versión histórica' : 'Borrador'}</h3><code>{plan.versionId}</code></div><span className={`trainer-plan-state trainer-plan-state--${plan.estado}`}>{plan.estado}</span></header>
    <div className="trainer-plan-actions"><button className="button button--outline" type="button" onClick={() => onSelect(plan.versionId)} disabled={active}>Ver esta versión</button><button className="button button--outline" type="button" onClick={() => onReload(plan.versionId)} disabled={Boolean(busy)}>Recargar del servidor</button></div>
    <div className="trainer-plan-days">{plan.dias.map(day => <section key={day.diaId} className="trainer-plan-day"><h4>{DAY_NAMES[day.diaSemana] || `Día ${day.diaSemana}`} <small>{day.diaId}</small></h4>{day.items.length ? <ol>{day.items.map(item => <li key={item.itemId}><strong>{item.nombre || item.ejercicio?.nombre || item.ejercicioId || 'Ejercicio'}</strong><small>{item.series ?? 'Pendiente'} series · {item.objetivoPorSerie?.cantidad ?? 'Pendiente'} {item.objetivoPorSerie?.unidad || ''} · descanso {item.descansoSegundos ?? 'Pendiente'} s</small>{item.explicacion && <small>{item.explicacion}</small>}<code>{item.itemId}</code></li>)}</ol> : <p>Sin ejercicios en los datos recibidos.</p>}</section>)}</div>
    {plan.proximaRevision && <p className="trainer-plan-review">Próxima revisión: {plan.proximaRevision}</p>}
    {active && plan.estado === 'borrador' && <div className="trainer-plan-editor-wrap"><form className="trainer-record-form" onSubmit={submitEdit}><div><span className="eyebrow">Edición con revisión del servidor</span><h4>Editar ejercicio existente</h4><p className="trainer-muted">Se conservan los UUID de día y ejercicio recibidos. Este editor modifica prescripciones de ejercicios existentes.</p></div>
      {items.length ? <>
        <label>Ejercicio<select value={selectedItem?.itemId || ''} onChange={event => chooseItem(event.target.value)}>{items.map(item => <option key={item.itemId} value={item.itemId}>{DAY_NAMES[item.diaSemana] || `Día ${item.diaSemana}`} · {item.nombre || item.ejercicio?.nombre || item.ejercicioId || item.itemId}</option>)}</select></label>
        <div className="trainer-record-grid"><label>Series<input type="number" min="1" step="1" required value={series} onChange={event => setSeries(event.target.value)} /></label><label>Objetivo por serie<input type="number" min="1" step="1" required value={target} onChange={event => setTarget(event.target.value)} /></label><label>Unidad<select value={unit} onChange={event => setUnit(event.target.value)}><option value="repeticiones">Repeticiones</option><option value="segundos">Segundos</option></select></label><label>Descanso (segundos)<input type="number" min="0" step="1" required value={rest} onChange={event => setRest(event.target.value)} /></label><label className="trainer-record-grid__wide">Indicación<input value={explanation} onChange={event => setExplanation(event.target.value)} /></label></div>
        <button className="button button--dark" type="submit" disabled={Boolean(busy)}>{busy ? 'Enviando…' : `Guardar cambios · revisión ${plan.revision}`}</button>
      </> : <p className="trainer-muted">El servidor no devolvió ejercicios editables en este borrador.</p>}
    </form><button className="button button--dark trainer-plan-approve" type="button" onClick={() => onApprove(plan)} disabled={Boolean(busy)}>{busy ? 'Esperando confirmación…' : `Aprobar versión · revisión ${plan.revision}`}</button></div>}
  </article>;
}

export default function TrainerLivePlanning({ client, evaluations, evaluationStatus }) {
  const [evaluationId, setEvaluationId] = useState('');
  const [plans, setPlans] = useState([]);
  const [activeVersionId, setActiveVersionId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(null);
  const selectedEvaluation = evaluations.find(item => item.evaluacionId === evaluationId) || evaluations[0] || null;
  const hasCurrentPlan = plans.some(plan => plan.estado === 'vigente');

  async function createDraft() {
    if (!client?.atletaId || !selectedEvaluation?.evaluacionId) return;
    setBusy('create'); setError(null); setNotice(''); setConflict(null);
    try {
      // El contrato de dias para origen manual no está disponible; usar el origen IA documentado por planService evita inventar su esquema.
      const response = await planService.createAiDraft(client.atletaId, selectedEvaluation.evaluacionId);
      const created = planFrom(response);
      if (created.estado !== 'borrador') throw new Error('La respuesta de creación no confirmó un borrador. No se presentará como guardado.');
      setPlans(current => [created, ...current.filter(plan => plan.versionId !== created.versionId)]);
      setActiveVersionId(created.versionId);
      setNotice('El servidor confirmó el borrador. Consultando la versión actual…');
      try {
        const current = planFrom(await planService.getPlan(created.versionId), created.versionId);
        setPlans(previous => previous.map(plan => plan.versionId === current.versionId ? current : plan));
        setNotice('Borrador consultado y confirmado por el servidor.');
      } catch (refreshError) {
        setError({ ...refreshError, message: `El borrador fue confirmado por el servidor, pero no se pudo recargar su versión: ${displayError(refreshError)}` });
      }
    } catch (caught) { setError(caught); }
    finally { setBusy(''); }
  }

  async function reload(versionId) {
    setBusy(`reload:${versionId}`); setError(null); setNotice(''); setConflict(null);
    try {
      const current = planFrom(await planService.getPlan(versionId), versionId);
      setPlans(previous => previous.map(plan => plan.versionId === current.versionId ? current : plan));
      setNotice(`Versión ${current.versionId} recargada del servidor (revisión ${current.revision}).`);
    } catch (caught) { setError(caught); }
    finally { setBusy(''); }
  }

  async function save(plan, changes) {
    setBusy(`save:${plan.versionId}`); setError(null); setNotice(''); setConflict(null);
    try {
      await planService.updateDraft(plan.versionId, plan.revision, changes);
      const updated = planFrom(await planService.getPlan(plan.versionId), plan.versionId);
      if (updated.estado !== 'borrador' || updated.revision <= plan.revision) throw new Error('El servidor no confirmó una nueva revisión de borrador. Se conserva la vista anterior.');
      setPlans(previous => previous.map(item => item.versionId === updated.versionId ? updated : item));
      setNotice(`El servidor confirmó la revisión ${updated.revision} del borrador.`);
    } catch (caught) {
      setError(caught);
      if (caught?.status === 409 || caught?.codigo === 'REVISION_CONFLICTIVA') setConflict(plan.versionId);
    } finally { setBusy(''); }
  }

  async function approve(plan) {
    setBusy(`approve:${plan.versionId}`); setError(null); setNotice(''); setConflict(null);
    try {
      await planService.approvePlan(plan.versionId, plan.revision);
      const approved = planFrom(await planService.getPlan(plan.versionId), plan.versionId);
      if (approved.estado !== 'vigente') throw new Error('La solicitud respondió, pero la consulta no confirmó el estado vigente. Ana no verá esta versión como publicada desde esta interfaz.');
      setPlans(previous => previous.map(item => item.versionId === approved.versionId ? approved : item));
      setNotice('El servidor confirmó la aprobación. Ana consultará la versión vigente mediante su consulta diaria.');
    } catch (caught) {
      setError(caught);
      if (caught?.status === 409 || caught?.codigo === 'REVISION_CONFLICTIVA') setConflict(plan.versionId);
    } finally { setBusy(''); }
  }

  return <section className="trainer-live-planning" aria-labelledby="livePlanningTitle">
    <div className="trainer-subsection-heading"><div><span className="eyebrow">Planes del servidor</span><h2 id="livePlanningTitle">Planificación</h2></div></div>
    {evaluationStatus === 'loading' && <p className="trainer-muted" role="status">Carga las evaluaciones para crear un borrador asociado a una evaluación real.</p>}
    {evaluationStatus === 'error' && <p className="trainer-muted">La lista de evaluaciones no está disponible; no se puede iniciar un plan sin una evaluación seleccionada.</p>}
    {evaluationStatus === 'empty' && <p className="trainer-muted">No hay evaluaciones del servidor. Registra una evaluación antes de crear un plan.</p>}
    {evaluationStatus === 'success' && <div className="trainer-plan-create"><label>Evaluación asociada<select value={selectedEvaluation?.evaluacionId || ''} onChange={event => setEvaluationId(event.target.value)}>{evaluations.map(evaluation => <option key={evaluation.evaluacionId} value={evaluation.evaluacionId}>{evaluation.fecha ? `${evaluation.fecha.slice(0, 10)} · ` : ''}{evaluation.modalidad || 'Evaluación'} · {evaluation.objetivo || 'Objetivo pendiente'}</option>)}</select></label><p className="trainer-muted">Se crea un borrador con origen IA asociado a la evaluación seleccionada. Para el origen manual falta confirmar el esquema de `dias`.</p><button className="button button--dark" type="button" onClick={createDraft} disabled={Boolean(busy) || !selectedEvaluation?.evaluacionId || hasCurrentPlan}>{busy === 'create' ? 'Creando borrador…' : hasCurrentPlan ? 'Nueva versión requiere reorganización' : 'Crear borrador'}</button>{hasCurrentPlan && <p className="trainer-muted">Ya existe una versión vigente. Crear otra versión requiere el contrato de reorganización; la acción permanece bloqueada.</p>}</div>}
    {error && <section className="trainer-live-state trainer-live-state--error" role="alert"><h3>{error.codigo || (error.status ? `Error HTTP ${error.status}` : 'No se confirmó la operación')}</h3><p>{displayError(error)}</p>{Number.isInteger(error.revisionActual) && <p>Revisión actual informada por el servidor: {error.revisionActual}.</p>}{conflict && <button className="button button--outline" type="button" onClick={() => reload(conflict)} disabled={Boolean(busy)}>Recargar revisión antes de reintentar</button>}</section>}
    {notice && <p className="trainer-record-success" role="status" aria-live="polite">{notice}</p>}
    {plans.length === 0 && evaluationStatus === 'success' && <p className="trainer-muted">No hay versiones consultadas en esta sesión. Usa “Crear borrador” para obtener un `versionId` real del servidor.</p>}
    {plans.length > 0 && <div className="trainer-live-plan-list">{plans.map(plan => <PlanCard key={plan.versionId} plan={plan} active={activeVersionId === plan.versionId} busy={busy} onSelect={setActiveVersionId} onReload={reload} onApprove={approve} onEdit={save} />)}</div>}
    <aside className="trainer-plan-reorg-blocked"><strong>Reorganización V2 pendiente de contrato</strong><p>No se habilitó la creación de V2: falta el esquema completo del cuerpo de reorganización en `backend/src/modules/planificacion/CONTRATOS.md`. La interfaz no enviará una solicitud con campos supuestos.</p></aside>
  </section>;
}
