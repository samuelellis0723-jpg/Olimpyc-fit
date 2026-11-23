import { useCallback, useEffect, useState } from 'react';
import Brand from '../../components/Brand.jsx';
import { planService } from '../../services/planService.js';
import TrainerLivePlanning from './TrainerLivePlanning.jsx';
import TrainerLiveAssistanceQueue from './TrainerLiveAssistanceQueue.jsx';
import './trainerLive.css';

const measurementOrigins = ['observado', 'autorreportado', 'externo', 'sin_evaluar'];
const measurementStates = ['medido', 'pendiente'];
const evaluationFields = ['modalidad', 'objetivo', 'disponibilidadSemanal', 'nivelObservado', 'estadoNivel', 'restricciones', 'notas', 'proximaRevision', 'observacionesPrivadas'];

function isAssignedClient(value) {
  return value && typeof value === 'object'
    && typeof value.asignacionId === 'string' && value.asignacionId.length > 0
    && typeof value.atletaId === 'string' && value.atletaId.length > 0
    && typeof value.fechaInicio === 'string'
    && typeof value.nombre === 'string'
    && typeof value.aliasVisible === 'string';
}

function formatDate(value) {
  if (!value) return 'Pendiente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date);
}

function displayed(value) {
  return value === null || value === undefined || value === '' ? 'Pendiente de registro' : String(value);
}

function errorMessage(error, operation) {
  const statusMessages = {
    401: 'La sesión no está autenticada o expiró. Vuelve a iniciar sesión.',
    403: 'Tu cuenta no tiene permiso para consultar o modificar este registro.',
    404: 'No se encontró el cliente o la evaluación solicitada. Actualiza la ficha.',
    422: 'El servidor rechazó los datos. Revisa los campos obligatorios y sus formatos.',
  };
  return statusMessages[error?.status] || error?.message || `No se pudo ${operation}.`;
}

function EvaluationForm({ initial = {}, onSubmit, onCancel, busy, mode }) {
  const [values, setValues] = useState(() => ({
    modalidad: initial.modalidad || '',
    objetivo: initial.objetivo || '',
    disponibilidadSemanal: initial.disponibilidadSemanal ?? '',
    nivelObservado: initial.nivelObservado || '',
    estadoNivel: initial.estadoNivel || 'pendiente',
    restricciones: initial.restricciones || '',
    notas: initial.notas || '',
    proximaRevision: initial.proximaRevision || '',
    observacionesPrivadas: initial.observacionesPrivadas || '',
  }));
  const [validation, setValidation] = useState('');
  const [touched, setTouched] = useState(() => new Set());

  function update(field, value) {
    setValues(current => ({ ...current, [field]: value }));
    setTouched(current => new Set(current).add(field));
  }
  function submit(event) {
    event.preventDefault();
    const availability = values.disponibilidadSemanal === '' ? null : Number(values.disponibilidadSemanal);
    if (!values.modalidad.trim() || !values.objetivo.trim()) return setValidation('Modalidad y objetivo son obligatorios.');
    if (availability !== null && (!Number.isInteger(availability) || availability < 1 || availability > 7)) return setValidation('La disponibilidad semanal debe ser un número entero entre 1 y 7, o quedar vacía.');
    if (!['observado', 'pendiente'].includes(values.estadoNivel)) return setValidation('Selecciona un estado de nivel válido.');
    if (values.estadoNivel === 'observado' && !values.nivelObservado.trim()) return setValidation('Ingresa el nivel observado o cambia su estado a pendiente.');
    if (mode === 'edit' && touched.size === 0) return setValidation('Modifica al menos un campo antes de guardar.');
    setValidation('');
    const payload = {
      modalidad: values.modalidad.trim(),
      objetivo: values.objetivo.trim(),
      disponibilidadSemanal: availability,
      nivelObservado: values.nivelObservado.trim() || null,
      estadoNivel: values.estadoNivel,
      restricciones: values.restricciones.trim() || null,
      notas: values.notas.trim() || null,
      proximaRevision: values.proximaRevision || null,
      observacionesPrivadas: values.observacionesPrivadas.trim() || null,
    };
    onSubmit(mode === 'edit' ? Object.fromEntries(Object.entries(payload).filter(([field]) => touched.has(field))) : payload);
  }

  return <form className="trainer-record-form" onSubmit={submit} noValidate>
    <div className="trainer-record-form__heading"><div><span className="eyebrow">{mode === 'edit' ? 'Edición parcial' : 'Nuevo registro'}</span><h3>{mode === 'edit' ? 'Editar evaluación' : 'Registrar evaluación'}</h3></div></div>
    <div className="trainer-record-grid">
      <label>Modalidad *<input required value={values.modalidad} onChange={event => update('modalidad', event.target.value)} /></label>
      <label>Objetivo *<input required value={values.objetivo} onChange={event => update('objetivo', event.target.value)} /></label>
      <label>Disponibilidad semanal (1–7)<input type="number" min="1" max="7" step="1" value={values.disponibilidadSemanal} onChange={event => update('disponibilidadSemanal', event.target.value)} /></label>
      <label>Estado del nivel<select value={values.estadoNivel} onChange={event => update('estadoNivel', event.target.value)}><option value="pendiente">Pendiente</option><option value="observado">Observado</option></select></label>
      <label>Nivel observado<input value={values.nivelObservado} onChange={event => update('nivelObservado', event.target.value)} /></label>
      <label>Próxima revisión<input type="date" value={values.proximaRevision?.slice?.(0, 10) || ''} onChange={event => update('proximaRevision', event.target.value || null)} /></label>
      <label className="trainer-record-grid__wide">Restricciones<textarea rows="2" value={values.restricciones} onChange={event => update('restricciones', event.target.value)} /></label>
      <label className="trainer-record-grid__wide">Notas<textarea rows="3" value={values.notas} onChange={event => update('notas', event.target.value)} /></label>
      <label className="trainer-record-grid__wide">Observaciones privadas de Eva<textarea rows="3" value={values.observacionesPrivadas} onChange={event => update('observacionesPrivadas', event.target.value)} /><small>Solo visibles en esta interfaz autorizada de entrenadora.</small></label>
    </div>
    {validation && <p className="trainer-record-error" role="alert">{validation}</p>}
    <div className="trainer-record-actions"><button className="button button--dark" type="submit" disabled={busy}>{busy ? 'Enviando…' : mode === 'edit' ? 'Guardar cambios' : 'Registrar evaluación'}</button><button className="button button--outline" type="button" onClick={onCancel} disabled={busy}>Cancelar</button></div>
  </form>;
}

function MeasurementForm({ onSubmit, onCancel, busy }) {
  const [values, setValues] = useState({ variable: '', origen: 'observado', estado: 'medido', valor: '', unidad: '', fuente: '' });
  const [validation, setValidation] = useState('');
  function update(field, value) { setValues(current => ({ ...current, [field]: value })); }
  function submit(event) {
    event.preventDefault();
    if (!values.variable.trim()) return setValidation('Indica la variable que se midió.');
    if (!measurementOrigins.includes(values.origen) || !measurementStates.includes(values.estado)) return setValidation('Selecciona un origen y estado válidos.');
    if (values.estado === 'medido' && (!values.valor.trim() || !values.unidad.trim())) return setValidation('Para una medición realizada, el valor y la unidad son obligatorios.');
    setValidation('');
    onSubmit({ variable: values.variable.trim(), origen: values.origen, estado: values.estado, valor: values.estado === 'medido' ? values.valor.trim() : null, unidad: values.estado === 'medido' ? values.unidad.trim() : null, fuente: values.fuente.trim() || null });
  }
  return <form className="trainer-record-form" onSubmit={submit} noValidate>
    <div className="trainer-record-form__heading"><div><span className="eyebrow">Historial</span><h3>Agregar medición</h3></div></div>
    <div className="trainer-record-grid">
      <label>Variable *<input value={values.variable} onChange={event => update('variable', event.target.value)} placeholder="Nombre de la variable" /></label>
      <label>Estado<select value={values.estado} onChange={event => update('estado', event.target.value)}><option value="medido">Medido</option><option value="pendiente">Pendiente</option></select></label>
      <label>Origen<select value={values.origen} onChange={event => update('origen', event.target.value)}>{measurementOrigins.map(origin => <option key={origin} value={origin}>{origin.replace('_', ' ')}</option>)}</select></label>
      {values.estado === 'medido' && <><label>Valor *<input value={values.valor} onChange={event => update('valor', event.target.value)} /></label><label>Unidad *<input value={values.unidad} onChange={event => update('unidad', event.target.value)} /></label></>}
      <label className="trainer-record-grid__wide">Fuente<input value={values.fuente} onChange={event => update('fuente', event.target.value)} /></label>
    </div>
    {validation && <p className="trainer-record-error" role="alert">{validation}</p>}
    <div className="trainer-record-actions"><button className="button button--dark" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Registrar medición'}</button><button className="button button--outline" type="button" onClick={onCancel} disabled={busy}>Cancelar</button></div>
  </form>;
}

function EvaluationCard({ evaluation, onEdit, onAddMeasurement, busy }) {
  const [editing, setEditing] = useState(false);
  const [addingMeasurement, setAddingMeasurement] = useState(false);
  const measurements = Array.isArray(evaluation.mediciones) ? evaluation.mediciones : [];
  return <article className="surface-card trainer-evaluation-card">
    <header className="trainer-evaluation-card__header"><div><span className="eyebrow">Evaluación · {formatDate(evaluation.fecha)}</span><h3>{displayed(evaluation.modalidad)}</h3></div><button className="button button--outline" type="button" onClick={() => { setEditing(value => !value); setAddingMeasurement(false); }}>{editing ? 'Cerrar edición' : 'Editar'}</button></header>
    <dl className="trainer-evaluation-facts">
      <div><dt>Objetivo</dt><dd>{displayed(evaluation.objetivo)}</dd></div>
      <div><dt>Disponibilidad semanal</dt><dd>{evaluation.disponibilidadSemanal ? `${evaluation.disponibilidadSemanal} días` : 'Pendiente de registro'}</dd></div>
      <div><dt>Nivel</dt><dd>{evaluation.estadoNivel === 'observado' ? displayed(evaluation.nivelObservado) : 'Pendiente de registro'}</dd></div>
      <div><dt>Próxima revisión</dt><dd>{formatDate(evaluation.proximaRevision)}</dd></div>
      <div className="trainer-evaluation-facts__wide"><dt>Restricciones</dt><dd>{displayed(evaluation.restricciones)}</dd></div>
      <div className="trainer-evaluation-facts__wide"><dt>Notas</dt><dd>{displayed(evaluation.notas)}</dd></div>
      <div className="trainer-evaluation-facts__wide"><dt>Observaciones privadas · Eva</dt><dd>{displayed(evaluation.observacionesPrivadas)}</dd></div>
    </dl>
    <section className="trainer-measurements" aria-label="Historial de mediciones"><div className="trainer-subsection-heading"><h4>Mediciones</h4><button type="button" className="trainer-text-button" onClick={() => { setAddingMeasurement(value => !value); setEditing(false); }}>{addingMeasurement ? 'Cerrar' : 'Agregar medición'}</button></div>
      {measurements.length === 0 ? <p className="trainer-muted">No hay mediciones registradas para esta evaluación.</p> : <ol className="trainer-measurement-list">{measurements.map((measurement, index) => <li key={`${evaluation.evaluacionId}-measurement-${index}`}><div><strong>{displayed(measurement.variable)}</strong><span>{measurement.estado === 'medido' ? `${displayed(measurement.valor)} ${displayed(measurement.unidad)}` : 'Pendiente de medición'}</span></div><small>{formatDate(measurement.fecha)} · Origen: {displayed(measurement.origen)} · Fuente: {displayed(measurement.fuente)}</small></li>)}</ol>}
    </section>
    {editing && <EvaluationForm initial={evaluation} mode="edit" busy={busy} onCancel={() => setEditing(false)} onSubmit={changes => onEdit(evaluation.evaluacionId, changes, () => setEditing(false))} />}
    {addingMeasurement && <MeasurementForm busy={busy} onCancel={() => setAddingMeasurement(false)} onSubmit={measurement => onAddMeasurement(evaluation.evaluacionId, measurement, () => setAddingMeasurement(false))} />}
  </article>;
}

export default function TrainerLiveClients({ onSignOut }) {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [status, setStatus] = useState('loading');
  const [evaluationStatus, setEvaluationStatus] = useState('idle');
  const [error, setError] = useState('');
  const [evaluationError, setEvaluationError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [evaluationRetry, setEvaluationRetry] = useState(0);
  const [showNewEvaluation, setShowNewEvaluation] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading'); setError('');
    planService.getAssignedClients().then(result => {
      if (!Array.isArray(result?.clientes) || !result.clientes.every(isAssignedClient)) throw new Error('El servidor devolvió una lista de clientes con un formato inesperado.');
      if (active) { setClients(result.clientes); setStatus(result.clientes.length ? 'success' : 'empty'); }
    }).catch(caught => { if (active) { setError(errorMessage(caught, 'cargar la lista de clientes')); setStatus('error'); } });
    return () => { active = false; };
  }, [retry]);

  const loadEvaluations = useCallback(async client => {
    if (!client?.atletaId) return;
    setEvaluationStatus('loading'); setEvaluationError('');
    try {
      const result = await planService.getEvaluations(client.atletaId);
      if (!Array.isArray(result?.evaluaciones) || result.evaluaciones.some(item => !item || typeof item !== 'object' || typeof item.evaluacionId !== 'string' || !Array.isArray(item.mediciones))) {
        throw new Error('El servidor devolvió evaluaciones con un formato inesperado.');
      }
      setEvaluations(result.evaluaciones);
      setEvaluationStatus(result.evaluaciones.length ? 'success' : 'empty');
    } catch (caught) {
      setEvaluationError(errorMessage(caught, 'consultar las evaluaciones'));
      setEvaluationStatus('error');
    }
  }, []);

  useEffect(() => { if (selectedClient) loadEvaluations(selectedClient); }, [selectedClient, evaluationRetry, loadEvaluations]);

  async function submitAction(action, successText) {
    setBusy(true); setNotice(''); setEvaluationError('');
    try {
      await action();
      setNotice(successText);
      await loadEvaluations(selectedClient);
      return true;
    } catch (caught) {
      setEvaluationError(errorMessage(caught, 'guardar los cambios'));
      return false;
    } finally { setBusy(false); }
  }

  async function createEvaluation(payload) {
    const saved = await submitAction(() => planService.createEvaluation(selectedClient.atletaId, payload), 'La evaluación recibió confirmación del servidor.');
    if (saved) setShowNewEvaluation(false);
  }
  async function updateEvaluation(evaluacionId, payload, close) {
    const partial = Object.fromEntries(Object.entries(payload).filter(([key]) => evaluationFields.includes(key)));
    const saved = await submitAction(() => planService.updateEvaluation(evaluacionId, partial), 'Los cambios de evaluación recibieron confirmación del servidor.');
    if (saved) close();
  }
  async function addMeasurement(evaluacionId, payload, close) {
    const saved = await submitAction(() => planService.addMeasurements(evaluacionId, payload), 'La medición recibió confirmación del servidor.');
    if (saved) close();
  }

  return <div className="trainer-portal-shell trainer-live-shell">
    <header className="trainer-portal-header"><Brand compact /><div className="trainer-live-header-copy"><strong>Panel de entrenadora</strong><span>Clientes y evaluaciones · datos del servidor</span></div><div className="trainer-portal-actions"><span className="trainer-live-badge">Sesión verificada</span><button className="signout-button" type="button" onClick={onSignOut}>Salir</button></div></header>
    <main className="trainer-desktop-page trainer-live-page">
      <TrainerLiveAssistanceQueue />
      {selectedClient ? <>
        <div className="trainer-page-heading trainer-detail-heading"><div><button type="button" className="trainer-text-button" onClick={() => { setSelectedClient(null); setEvaluations([]); setNotice(''); }}>← Volver a clientes</button><span className="eyebrow">Ficha de cliente asignado</span><h1>{selectedClient.aliasVisible || selectedClient.nombre}</h1><p>Nombre registrado: {selectedClient.nombre} · Asignada desde {formatDate(selectedClient.fechaInicio)}</p></div><button className="button button--outline" type="button" onClick={() => setEvaluationRetry(value => value + 1)} disabled={evaluationStatus === 'loading'}>{evaluationStatus === 'loading' ? 'Actualizando…' : 'Actualizar evaluaciones'}</button></div>
        {notice && <p className="trainer-record-success" role="status" aria-live="polite">{notice}</p>}
        {evaluationError && <section className="trainer-live-state trainer-live-state--error" role="alert"><h2>No se completó la operación</h2><p>{evaluationError}</p>{evaluationStatus === 'error' && <button className="button button--outline" type="button" onClick={() => setEvaluationRetry(value => value + 1)}>Reintentar consulta</button>}</section>}
        <section className="trainer-evaluation-section"><div className="trainer-subsection-heading"><div><span className="eyebrow">Historial de cliente</span><h2>Evaluaciones y mediciones</h2></div><button className="button button--dark" type="button" onClick={() => setShowNewEvaluation(value => !value)}>{showNewEvaluation ? 'Cerrar formulario' : 'Nueva evaluación'}</button></div>
          {showNewEvaluation && <EvaluationForm busy={busy} mode="create" onCancel={() => setShowNewEvaluation(false)} onSubmit={createEvaluation} />}
          {evaluationStatus === 'loading' && <section className="surface-card trainer-live-state" role="status" aria-live="polite"><span className="eyebrow">Consultando</span><h2>Cargando historial</h2><p>Esperando la respuesta del servidor.</p></section>}
          {evaluationStatus === 'error' && !evaluationError && <section className="surface-card trainer-live-state trainer-live-state--error" role="alert"><h2>No se pudo cargar el historial</h2><button className="button button--dark" type="button" onClick={() => setEvaluationRetry(value => value + 1)}>Reintentar</button></section>}
          {evaluationStatus === 'empty' && <section className="surface-card trainer-live-state" role="status"><h2>Sin evaluaciones registradas</h2><p>El servidor no devolvió evaluaciones para este cliente.</p></section>}
          {evaluationStatus === 'success' && <div className="trainer-evaluation-list">{evaluations.map(evaluation => <EvaluationCard key={evaluation.evaluacionId} evaluation={evaluation} busy={busy} onEdit={updateEvaluation} onAddMeasurement={addMeasurement} />)}</div>}
        </section>
        <TrainerLivePlanning client={selectedClient} evaluations={evaluations} evaluationStatus={evaluationStatus} />
      </> : <>
        <div className="trainer-page-heading"><div><span className="eyebrow">Olimpyc Fit · Eva</span><h1>Mis clientes</h1><p>Selecciona una asignación recibida del servidor para consultar su ficha.</p></div><button className="button button--outline" type="button" onClick={() => setRetry(value => value + 1)} disabled={status === 'loading'}>{status === 'loading' ? 'Actualizando…' : 'Actualizar lista'}</button></div>
        {status === 'loading' && <section className="surface-card trainer-live-state" role="status" aria-live="polite"><span className="eyebrow">Consultando</span><h2>Cargando clientes asignados</h2><p>Esperando la respuesta de la API.</p></section>}
        {status === 'error' && <section className="surface-card trainer-live-state trainer-live-state--error" role="alert"><span className="eyebrow">No se confirmó la consulta</span><h2>No se pudo cargar la lista</h2><p>{error}</p><button className="button button--dark" type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></section>}
        {status === 'empty' && <section className="surface-card trainer-live-state" role="status"><span className="eyebrow">Sin asignaciones</span><h2>No hay clientes asignados</h2><p>Cuando el servidor registre una asignación, aparecerá aquí.</p></section>}
        {status === 'success' && <section className="trainer-live-client-grid" aria-label="Clientes asignados">{clients.map(client => <article className="surface-card trainer-live-client-card" key={client.asignacionId}><div className="trainer-live-avatar" aria-hidden="true">{client.aliasVisible.trim().charAt(0) || client.nombre.trim().charAt(0) || '•'}</div><div className="trainer-live-client-copy"><span className="eyebrow">Asignación activa</span><h2>{client.aliasVisible.trim() || client.nombre}</h2><p>Nombre registrado: {client.nombre}</p><small>Desde {formatDate(client.fechaInicio)}</small><button className="button button--dark trainer-client-open" type="button" onClick={() => { setNotice(''); setEvaluationError(''); setSelectedClient(client); }}>Abrir ficha</button></div></article>)}</section>}
      </>}
    </main>
  </div>;
}
