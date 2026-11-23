import { useEffect, useMemo, useState } from 'react';
import Brand from '../../components/Brand.jsx';
import { UUID_DEMO_EXERCISES, UUID_PLANNING_DEMO } from '../../mocks/uuidPlanningDemo.js';
import { planService } from '../../services/planService.js';
import './trainer.css';
import './trainerUuidDemo.css';

const DAYS = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };

function requirePlan(value, expectedVersionId) {
  const plan = value?.plan && typeof value.plan === 'object' ? value.plan : value;
  if (!plan || typeof plan.versionId !== 'string' || !Number.isInteger(plan.revision) || !Array.isArray(plan.dias) || typeof plan.estado !== 'string') {
    throw new Error('La API devolvió una respuesta sin versionId, revision, estado o días válidos. No se actualizó el estado visible.');
  }
  if (expectedVersionId && plan.versionId !== expectedVersionId) {
    throw new Error('La API devolvió una versión distinta de la solicitada. Recarga la versión antes de continuar.');
  }
  return plan;
}

function dayName(day) {
  return DAYS[day] || `Día ${day}`;
}

function exerciseLabel(exerciseId) {
  const known = UUID_DEMO_EXERCISES[exerciseId];
  return known ? `${known.code} · ${known.name}` : `Ejercicio ${exerciseId || 'pendiente'}`;
}

function PlanSummary({ plan }) {
  return <section className="surface-card uuid-plan-card">
    <div className="card-heading">
      <div><span className="eyebrow">Versión UUID · revision {plan.revision}</span><h3>{plan.estado === 'vigente' ? 'Rutina vigente' : plan.estado === 'historica' ? 'Versión anterior' : 'Borrador de Eva'}</h3></div>
      <span className={plan.estado === 'vigente' ? 'approved-chip' : 'pending-chip'}>{plan.estado}</span>
    </div>
    <p className="uuid-plan-id">versionId: <code>{plan.versionId}</code></p>
    {plan.versionBaseId && <p className="uuid-plan-id">Basada en: <code>{plan.versionBaseId}</code></p>}
    {plan.motivo && <p className="uuid-plan-copy">Motivo registrado: {plan.motivo}</p>}
    <div className="uuid-days-list">
      {plan.dias.map(day => <article key={day.diaId || `${plan.versionId}-${day.diaSemana}`}>
        <h4>{dayName(day.diaSemana)}</h4>
        {day.items?.length ? <ol>{[...day.items].sort((a, b) => a.orden - b.orden).map(item => <li key={item.itemId}>
          <strong>{exerciseLabel(item.ejercicioId)}</strong>
          <span>{item.series} series · {item.objetivoPorSerie?.cantidad ?? 'Pendiente'} {item.objetivoPorSerie?.unidad || ''} · descanso {item.descansoSegundos ?? 'Pendiente'} s</span>
          {item.explicacion && <small>{item.explicacion}</small>}
        </li>)}</ol> : <p className="uuid-plan-copy">No hay ejercicios en este día según la respuesta recibida.</p>}
      </article>)}
    </div>
    {plan.proximaRevision && <p className="uuid-plan-copy">Próxima revisión: {plan.proximaRevision}</p>}
  </section>;
}

function PlanEditor({ plan, saving, onSave }) {
  const items = useMemo(() => plan.dias.flatMap(day => day.items.map(item => ({ ...item, diaSemana: day.diaSemana }))), [plan]);
  const [itemId, setItemId] = useState(items[0]?.itemId || '');
  const [rest, setRest] = useState('');
  const [series, setSeries] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('repeticiones');
  const [explanation, setExplanation] = useState('');
  const [reviewDate, setReviewDate] = useState(plan.proximaRevision || '');
  const selectedItem = items.find(item => item.itemId === itemId) || items[0];

  useEffect(() => {
    if (!selectedItem) return;
    setItemId(selectedItem.itemId);
    setRest(String(selectedItem.descansoSegundos ?? ''));
    setSeries(String(selectedItem.series ?? ''));
    setTarget(String(selectedItem.objetivoPorSerie?.cantidad ?? ''));
    setUnit(selectedItem.objetivoPorSerie?.unidad || 'repeticiones');
    setExplanation(selectedItem.explicacion || '');
  }, [selectedItem?.itemId, plan.revision]);

  useEffect(() => setReviewDate(plan.proximaRevision || ''), [plan.versionId, plan.revision]);

  function submit(event) {
    event.preventDefault();
    if (!selectedItem || !Number.isInteger(Number(series)) || Number(series) < 1 || !Number.isInteger(Number(target)) || Number(target) < 1 || !Number.isInteger(Number(rest)) || Number(rest) < 0) return;
    onSave(plan, {
      items: [{
        itemId: selectedItem.itemId,
        descansoSegundos: Number(rest),
        series: Number(series),
        objetivoPorSerie: { cantidad: Number(target), unidad: unit },
        explicacion: explanation.trim() || selectedItem.explicacion,
      }],
      ...(reviewDate ? { proximaRevision: reviewDate } : {}),
    });
  }

  if (plan.estado !== 'borrador') return null;
  return <form className="surface-card uuid-editor" onSubmit={submit}>
    <div><span className="eyebrow">Edición con control de revisión</span><h3>Editar borrador</h3></div>
    {items.length ? <>
      <label>Ejercicio del borrador
        <select value={itemId} onChange={event => setItemId(event.target.value)}>
          {items.map(item => <option key={item.itemId} value={item.itemId}>{dayName(item.diaSemana)} · {exerciseLabel(item.ejercicioId)}</option>)}
        </select>
      </label>
      <div className="uuid-form-grid">
        <label>Series<input inputMode="numeric" type="number" min="1" step="1" required value={series} onChange={event => setSeries(event.target.value)} /></label>
        <label>Objetivo por serie<input inputMode="numeric" type="number" min="1" step="1" required value={target} onChange={event => setTarget(event.target.value)} /></label>
        <label>Unidad<select value={unit} onChange={event => setUnit(event.target.value)}><option value="repeticiones">Repeticiones</option><option value="segundos">Segundos</option></select></label>
        <label>Descanso (segundos)<input inputMode="numeric" type="number" min="0" step="1" required value={rest} onChange={event => setRest(event.target.value)} /></label>
      </div>
      <label>Indicación registrada<input value={explanation} onChange={event => setExplanation(event.target.value)} /></label>
      <label>Próxima revisión (opcional)<input type="date" value={reviewDate} onChange={event => setReviewDate(event.target.value)} /></label>
      <button className="button button--dark" type="submit" disabled={saving}>{saving ? 'Enviando cambio…' : `Guardar revisión ${plan.revision}`}</button>
    </> : <p className="uuid-plan-copy">El servidor no devolvió ejercicios editables para este borrador.</p>}
    <p className="uuid-demo-caption">Al guardar se envía `revisionEsperada` del servidor. Si hay un conflicto, vuelve a cargar antes de reintentar.</p>
  </form>;
}

function ErrorNotice({ error, onReload }) {
  if (!error) return null;
  return <section className="uuid-error" role="alert" aria-live="assertive">
    <strong>{error.codigo || 'No se confirmó la operación'}{error.status ? ` · HTTP ${error.status}` : ''}</strong>
    <p>{error.message}</p>
    {Array.isArray(error.camposPendientes) && error.camposPendientes.length > 0 && <div><span>Datos pendientes:</span><ul>{error.camposPendientes.map(field => <li key={field}>{field}</li>)}</ul></div>}
    {Number.isInteger(error.revisionActual) && <p>La revisión actual del servidor es {error.revisionActual}.</p>}
    {error.retryVersionId && <button type="button" className="button button--outline" onClick={() => onReload(error.retryVersionId, error.retrySlot)}>Recargar versión antes de continuar</button>}
  </section>;
}

export default function TrainerUuidDemo({ onExit }) {
  const [v1, setV1] = useState(null);
  const [v2, setV2] = useState(null);
  const [v2Differences, setV2Differences] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState(UUID_PLANNING_DEMO.reorganizationReason);
  const [returnDays, setReturnDays] = useState([...UUID_PLANNING_DEMO.days]);

  async function loadVersion(versionId, slot, reportError = true) {
    if (!versionId || busy) return;
    setBusy(`load-${slot}`);
    if (reportError) setError(null);
    try {
      const plan = requirePlan(await planService.getPlan(versionId), versionId);
      if (slot === 'v1') setV1(plan);
      else setV2(plan);
      setNotice('Versión recargada desde el servidor de demo.');
      return plan;
    } catch (caught) {
      if (reportError) setError(Object.assign(caught, { retryVersionId: versionId, retrySlot: slot }));
      return null;
    } finally { setBusy(''); }
  }

  async function createV1() {
    setBusy('create-v1'); setError(null); setNotice('');
    try {
      const created = requirePlan(await planService.createAiDraft(UUID_PLANNING_DEMO.athleteId, UUID_PLANNING_DEMO.completeAssessmentId));
      if (created.estado !== 'borrador') throw new Error('El servidor no devolvió V1 como borrador. No se marcó como aprobado.');
      setV1(created);
      setNotice('El servidor confirmó el borrador inicial. Consultando ahora su versionId y revision actuales.');
      const current = requirePlan(await planService.getPlan(created.versionId), created.versionId);
      setV1(current);
    } catch (caught) {
      setError(caught);
    } finally { setBusy(''); }
  }

  async function saveEdits(plan, changes) {
    setBusy(`edit-${plan.versionId}`); setError(null); setNotice('');
    try {
      const updated = requirePlan(await planService.updateDraft(plan.versionId, plan.revision, changes), plan.versionId);
      if (updated.revision <= plan.revision || updated.estado !== 'borrador') throw new Error('La API no confirmó una nueva revisión de borrador. Se conserva la versión anterior en pantalla.');
      if (plan.versionId === v1?.versionId) setV1(updated);
      if (plan.versionId === v2?.versionId) setV2(updated);
      setNotice(`El servidor confirmó la revisión ${updated.revision} del borrador.`);
    } catch (caught) {
      setError(Object.assign(caught, { retryVersionId: plan.versionId, retrySlot: plan.versionId === v1?.versionId ? 'v1' : 'v2' }));
    } finally { setBusy(''); }
  }

  async function approve(plan, slot) {
    setBusy(`approve-${slot}`); setError(null); setNotice('');
    try {
      const result = await planService.approvePlan(plan.versionId, plan.revision);
      const approved = requirePlan(result?.plan, plan.versionId);
      if (approved.estado !== 'vigente') throw new Error('La API no confirmó la transición a vigente. El plan no se muestra como aprobado.');
      if (slot === 'v1') setV1(approved);
      else {
        setV2(approved);
        if (result.anterior) setV1(requirePlan(result.anterior, v1?.versionId));
        else if (v1?.versionId) setV1(requirePlan(await planService.getPlan(v1.versionId), v1.versionId));
      }
      setNotice(`El servidor confirmó la aprobación de ${slot.toUpperCase()} como versión vigente.`);
    } catch (caught) {
      setError(Object.assign(caught, { retryVersionId: plan.versionId, retrySlot: slot }));
    } finally { setBusy(''); }
  }

  async function createV2() {
    if (!v1 || v1.estado !== 'vigente') return;
    setBusy('create-v2'); setError(null); setNotice('');
    try {
      const result = await planService.reorganizeDraft(v1.versionId, {
        motivo: reason.trim(),
        ausencia: true,
        disponibilidadRegreso: returnDays,
      });
      const plan = requirePlan(result?.plan);
      if (plan.estado !== 'borrador' || plan.versionBaseId !== v1.versionId) throw new Error('La API no confirmó un nuevo borrador basado en V1. No se presenta como versión publicada.');
      setV2(plan);
      setV2Differences(result.diferencias || plan.diferencias || null);
      setNotice('El servidor creó V2 como borrador. Ana conserva V1 hasta que Eva apruebe V2.');
    } catch (caught) {
      setError(Object.assign(caught, { retryVersionId: v1.versionId, retrySlot: 'v1' }));
    } finally { setBusy(''); }
  }

  function toggleReturnDay(day, checked) {
    setReturnDays(current => checked ? [...new Set([...current, day])].sort((a, b) => a - b) : current.filter(value => value !== day));
  }

  const busyPlanId = busy.startsWith('edit-') || busy.startsWith('approve-') ? busy.split('-').slice(1).join('-') : '';

  return <div className="trainer-portal-shell uuid-trainer-shell">
    <header className="trainer-portal-header">
      <Brand compact />
      <div className="uuid-portal-title"><strong>Planificación de Ana</strong><span>Eva · demo de API UUID</span></div>
      <div className="trainer-portal-actions"><span className="trainer-demo-tag">Modo demo local · memoria</span><button className="signout-button" type="button" onClick={onExit}>Salir</button></div>
    </header>
    <main className="trainer-desktop-page uuid-planning-page">
      <section className="trainer-page-heading">
        <div><span className="eyebrow">Panel de planificación · datos ficticios</span><h1>Planes de Ana</h1><p>Eva crea, revisa y aprueba las versiones en el servicio local de planificación.</p></div>
        <span className="trainer-demo-tag">Reinicio del servidor demo borra sus datos en memoria</span>
      </section>
      <section className="uuid-context-grid">
        <article className="surface-card"><span className="eyebrow">Atleta de prueba</span><h2>Ana</h2><code>{UUID_PLANNING_DEMO.athleteId}</code></article>
        <article className="surface-card"><span className="eyebrow">Evaluación completa</span><code>{UUID_PLANNING_DEMO.completeAssessmentId}</code><p>Identificadores ficticios definidos por la guía de integración.</p></article>
      </section>
      <section className="surface-card uuid-steps-card">
        <div className="card-heading"><h2>Flujo V1 → V2</h2><span>Respuesta de la API requerida para cada transición</span></div>
        <div className="uuid-step-buttons">
          <button type="button" className="button button--dark" onClick={createV1} disabled={Boolean(busy) || Boolean(v1)}>{busy === 'create-v1' ? 'Creando borrador…' : v1 ? 'V1 creada' : 'Crear borrador V1'}</button>
          {v1 && <button type="button" className="button button--outline" onClick={() => loadVersion(v1.versionId, 'v1')} disabled={Boolean(busy)}>{busy === 'load-v1' ? 'Consultando…' : 'Consultar V1 en servidor'}</button>}
        </div>
        <p className="uuid-demo-caption">La petición usa `origen: IA`; el servidor de demo entrega ejercicios ficticios. El token de Eva se adjunta solo en esta sesión local y no se guarda en almacenamiento del navegador.</p>
      </section>

      <ErrorNotice error={error} onReload={loadVersion} />
      {notice && <p className="uuid-success" role="status" aria-live="polite">{notice}</p>}

      {v1 && <div className="uuid-plan-grid">
        <div className="uuid-plan-column">
          <PlanSummary plan={v1} />
          <PlanEditor plan={v1} saving={busy === `edit-${v1.versionId}`} onSave={saveEdits} />
          {v1.estado === 'borrador' && <button type="button" className="button button--dark uuid-full-button" onClick={() => approve(v1, 'v1')} disabled={Boolean(busy)}>{busy === 'approve-v1' ? 'Esperando confirmación…' : `Aprobar V1 · revisión ${v1.revision}`}</button>}
          {v1.estado === 'vigente' && <p className="uuid-success">V1 está vigente según la respuesta recibida del servidor.</p>}
          {v1.estado === 'historica' && <p className="uuid-demo-caption">V1 quedó histórica después de que el servidor confirmó la aprobación de V2.</p>}
        </div>
        <div className="uuid-plan-column">
          <section className="surface-card uuid-reorganization">
            <div><span className="eyebrow">Reorganización documentada</span><h3>Preparar V2 desde V1</h3></div>
            <label>Motivo<input value={reason} onChange={event => setReason(event.target.value)} required /></label>
            <fieldset><legend>Días disponibles al regresar</legend><div className="uuid-day-options">{[1, 2, 3, 4, 5, 6, 7].map(day => <label key={day}><input type="checkbox" checked={returnDays.includes(day)} onChange={event => toggleReturnDay(day, event.target.checked)} />{dayName(day)}</label>)}</div></fieldset>
            <p className="uuid-demo-caption">Se envía ausencia y disponibilidad de regreso. Si falta un dato, se muestra la aclaración del servidor y no se crea V2.</p>
            <button type="button" className="button button--outline uuid-full-button" onClick={createV2} disabled={!v1 || v1.estado !== 'vigente' || !reason.trim() || returnDays.length === 0 || Boolean(busy)}>{busy === 'create-v2' ? 'Solicitando reorganización…' : 'Crear V2 como borrador'}</button>
          </section>
          {v2 && <>
            <button type="button" className="button button--outline uuid-full-button" onClick={() => loadVersion(v2.versionId, 'v2')} disabled={Boolean(busy)}>{busy === 'load-v2' ? 'Consultando V2…' : 'Consultar V2 en servidor'}</button>
            <PlanSummary plan={v2} />
            {v2Differences && <section className="surface-card uuid-differences">
              <span className="eyebrow">Diferencias devueltas por la API</span><h3>V1 → V2</h3>
              {['mantenidos', 'movidos', 'agregados', 'retirados'].map(key => <div key={key}><strong>{key[0].toUpperCase() + key.slice(1)}</strong>{Array.isArray(v2Differences[key]) && v2Differences[key].length ? <ul>{v2Differences[key].map((item, index) => <li key={`${key}-${index}`}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>)}</ul> : <p>Sin elementos reportados.</p>}</div>)}
              {v2Differences.explicacion && <p>{v2Differences.explicacion}</p>}
            </section>}
            {!v2Differences && <p className="uuid-demo-caption" role="status">La respuesta del servidor no incluyó diferencias de V1 a V2.</p>}
            <PlanEditor plan={v2} saving={busy === `edit-${v2.versionId}`} onSave={saveEdits} />
            {v2.estado === 'borrador' && <button type="button" className="button button--dark uuid-full-button" onClick={() => approve(v2, 'v2')} disabled={Boolean(busy)}>{busy === 'approve-v2' ? 'Esperando confirmación…' : `Aprobar V2 · revisión ${v2.revision}`}</button>}
            {v2.estado === 'vigente' && <p className="uuid-success">El servidor confirmó V2 vigente. Ana verá esta versión al volver a consultar su rutina.</p>}
          </>}
        </div>
      </div>}
      {!v1 && <section className="surface-card uuid-empty"><h2>Aún no se ha solicitado V1</h2><p>Al crear el borrador se enviarán a la API local el UUID de Ana y el UUID de evaluación documentados.</p></section>}
      {busyPlanId && <p className="uuid-demo-caption" role="status">Esperando confirmación del servicio; la versión mostrada aún no se ha actualizado.</p>}
    </main>
  </div>;
}
