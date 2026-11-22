import { useMemo, useState } from 'react';
import { planService } from '../../services/planService.js';
import './trainer.css';

const DAY_LABELS = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };
const MEASUREMENT_GROUPS = [
  'Flexibilidad y movilidad',
  'Estabilidad y fuerza base',
  'Proporciones y longitudes corporales',
  'Características del cuello',
  'Composición corporal e InBody',
];

function dayNames(days) {
  return (days || []).map(day => DAY_LABELS[day] || `Día ${day}`);
}

export default function TrainerDesktop({ approvedDays, approvedVersion, setApprovedDays, setApprovedVersion, draft, setDraft, queue = [], onAttend, setNotice }) {
  const [section, setSection] = useState('overview');
  const [draftDays, setDraftDays] = useState([1, 4, 6]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);
  const pendingRequests = useMemo(() => queue.filter(item => item.estado === 'pendiente'), [queue]);
  const todayIso = new Date().getDay() || 7;
  const sessionToday = approvedDays.includes(todayIso);

  async function createDraft() {
    setBusy(true);
    try {
      const proposal = await planService.createDemoReorganization();
      setDraft({ ...proposal, dias: draftDays.map((diaSemana, index) => ({ diaId: `DEMO-D${index + 1}-V2`, diaSemana, items: [] })) });
      setRejected(false);
      setNotice('Borrador de demostración preparado en esta interfaz. V1 sigue vigente; no se guardó en el servidor.');
    } catch (error) {
      setNotice(error.message);
    } finally { setBusy(false); }
  }

  function saveDraftDays() {
    if (!draft || draft.estado !== 'borrador' || draftDays.length === 0) return;
    setDraft(current => ({
      ...current,
      revision: current.revision + 1,
      dias: draftDays.map((diaSemana, index) => ({ diaId: `DEMO-D${index + 1}-V2`, diaSemana, items: [] })),
      diferencias: { ...current.diferencias, explicacion: 'Edición local de demostración; los ejercicios por día están pendientes.' },
    }));
    setRejected(false);
    setEditing(false);
    setNotice('Cambios visibles solo en la demostración; no se guardaron en el servidor.');
  }

  function toggleDraftDay(day, enabled) {
    setDraftDays(current => enabled
      ? (current.includes(day) ? current : [...current, day].sort((a, b) => a - b))
      : current.filter(value => value !== day));
  }

  function approveDraft() {
    if (!draft || draft.estado !== 'borrador') return;
    const newDays = draft.dias.map(day => day.diaSemana);
    setApprovedDays(newDays);
    setApprovedVersion(draft.versionId.replace('DEMO-', ''));
    setDraft(current => ({ ...current, estado: 'vigente', aprobacion: { aprobadorId: 'DEMO-EVA', fecha: new Date().toISOString() } }));
    setNotice('Aprobación simulada en el frontend. La rutina de demostración se actualizó solo en esta sesión.');
  }

  function markRejected() {
    setRejected(true);
    setNotice('Rechazo mostrado solo en la demostración; V1 continúa vigente.');
  }

  function showNotConnected(event, recordName) {
    event.preventDefault();
    setNotice(`${recordName}: interfaz preparada, pero no existe integración disponible. No se guardaron datos.`);
  }

  const tabItems = [['overview', 'Resumen'], ['routine', 'Rutinas'], ['attendance', 'Ingresos y asistencia'], ['assessment', 'Evaluaciones y medidas']];

  return <main className="trainer-desktop-page">
    <section className="trainer-page-heading">
      <div><span className="eyebrow">Panel de gestión deportiva · demostración</span><h1>Buen día, Eva.</h1><p>Seguimiento de tus clientes asignados y revisión de sus planes.</p></div>
      <span className="trainer-demo-tag">Datos ficticios · Ana es tu única cliente demo</span>
    </section>

    <section className="trainer-metrics-grid" aria-label="Resumen del panel">
      <article className="trainer-metric-card"><span>Clientes asignados</span><strong>1</strong><small>Ana · demostración</small></article>
      <article className="trainer-metric-card trainer-metric-card--review"><span>Rutinas por revisar</span><strong>{draft?.estado === 'borrador' ? '1' : '0'}</strong><small>{draft?.estado === 'borrador' ? 'Borrador pendiente' : 'Sin borradores pendientes'}</small></article>
      <article className="trainer-metric-card"><span>Sesión de hoy</span><strong>{sessionToday ? 'Asignada' : 'Sin sesión'}</strong><small>{DAY_LABELS[todayIso]} · plan {approvedVersion}</small></article>
      <article className="trainer-metric-card trainer-metric-card--alerts"><span>Solicitudes pendientes</span><strong>{pendingRequests.length}</strong><small>Cola de asistencia local demo</small></article>
    </section>

    {pendingRequests[0] && <section className="trainer-assistance-banner">
      <div><span className="eyebrow">Solicitud de asistencia · turno 1</span><h2>{pendingRequests[0].atleta} necesita ayuda</h2><p>Ejercicio: {pendingRequests[0].ejercicio} · Estación: {pendingRequests[0].estacion} · Solo demostración local.</p></div>
      <button className="button button--dark" type="button" onClick={() => onAttend?.(pendingRequests[0].solicitudId)}>Marcar como atendida</button>
    </section>}

    <div className="trainer-dashboard-grid">
      <aside className="trainer-sidebar surface-card">
        <div className="card-heading"><h2>Mis clientes</h2><span>1 asignada · demo</span></div>
        <button className="athlete-option is-active" type="button" aria-current="true" onClick={() => setSection('overview')}><span className="avatar avatar--small" aria-hidden="true">A</span><span><strong>Ana</strong><small>Entrenadora: Eva · rutina {approvedVersion}</small></span><span aria-hidden="true">›</span></button>
        <p className="inline-note">No hay servicio conectado para cargar otros clientes asignados.</p>
      </aside>

      <div className="trainer-main-column">
        <section className="surface-card athlete-summary"><div><span className="eyebrow">Ficha de atleta · caso ficticio</span><h2>Ana</h2><p>Entrenadora asignada: Eva · información de solo lectura para la cliente.</p></div><span className="approved-chip">Rutina {approvedVersion} vigente</span></section>
        <nav className="trainer-section-tabs" aria-label="Secciones de la ficha de Ana">
          {tabItems.map(([id, title]) => <button type="button" key={id} className={section === id ? 'is-active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{title}</button>)}
        </nav>

        {section === 'overview' && <div className="trainer-info-grid">
          <section className="surface-card"><div className="card-heading"><h2>Perfil de entrenamiento</h2><span className="pending-chip">Datos pendientes</span></div><dl className="pending-fields"><div><dt>Objetivo</dt><dd>Pendiente de registro</dd></div><div><dt>Tiempo entrenando</dt><dd>Pendiente de registro</dd></div><div><dt>Progreso del ciclo</dt><dd>Pendiente de registro</dd></div><div><dt>Observaciones</dt><dd>Pendiente de registro</dd></div></dl></section>
          <section className="surface-card"><div className="card-heading"><h2>Plan vigente</h2><span className="approved-chip">{approvedVersion} · aprobado en demo</span></div><p className="plan-days">{dayNames(approvedDays).join(' · ')}</p><p className="inline-note">La rutina aprobada indica {approvedDays.length} días de entrenamiento por semana. Los ejercicios de la prescripción aparecen cuando estén registrados.</p><button className="button button--dark" type="button" onClick={() => setSection('routine')}>Revisar rutinas</button></section>
          <section className="surface-card"><div className="card-heading"><h2>Evaluación actual</h2><span className="pending-chip">Pendiente de registro</span></div><p className="trainer-pending-copy">Resultados, fechas y observaciones relacionados con el entrenamiento aparecerán aquí al registrarse.</p><button className="button button--outline" type="button" onClick={() => setSection('assessment')}>Abrir evaluaciones</button></section>
        </div>}

        {section === 'routine' && <section className="surface-card trainer-routine-section">
          <div className="card-heading"><div><span className="eyebrow">Planificación supervisada</span><h2>Rutinas de Ana</h2></div><span className="approved-chip">Vigente: {approvedVersion}</span></div>
          <div className="trainer-current-plan"><span>Rutina aprobada</span><strong>{dayNames(approvedDays).join(' · ')}</strong><small>Los ejercicios asignados y sus prescripciones están pendientes de registro.</small></div>
          {draft && <section className="comparison-card trainer-version-card">
            <div className="card-heading"><div><span className="eyebrow">Comparación de versiones</span><h3>V1 frente a {draft.versionId.replace('DEMO-', '')}</h3></div><span className={draft.estado === 'borrador' ? (rejected ? 'rejected-chip' : 'pending-chip') : 'approved-chip'}>{draft.estado === 'borrador' ? (rejected ? 'Rechazado · demo' : `Borrador · revisión ${draft.revision}`) : 'Vigente · demo local'}</span></div>
            <div className="version-comparison"><article><span>V1 · {draft.estado === 'vigente' ? 'histórica' : 'vigente'}</span><strong>Lunes · Jueves</strong><small>{draft.estado === 'vigente' ? 'Versión anterior conservada.' : 'Vigente hasta aprobar otra rutina.'}</small></article><div className="comparison-arrow" aria-hidden="true">→</div><article className={draft.estado === 'borrador' ? 'draft-version' : ''}><span>{draft.versionId.replace('DEMO-', '')} · {draft.estado}</span><strong>{dayNames(draft.dias.map(day => day.diaSemana)).join(' · ')}</strong><small>Propuesta ficticia para revisar el flujo; sin ejercicios por día.</small></article></div>
            {draft.estado === 'borrador' && <div className="draft-actions"><button className="button button--outline" type="button" onClick={() => setEditing(value => !value)}>{editing ? 'Cerrar edición' : 'Editar borrador'}</button>{rejected ? <button className="button button--outline" type="button" onClick={() => setRejected(false)}>Revisar de nuevo</button> : <><button className="button button--outline" type="button" onClick={markRejected}>Rechazar</button><button className="button button--dark" type="button" onClick={approveDraft}>Aprobar · demo</button></>}</div>}
            {editing && draft.estado === 'borrador' && <div className="draft-editor"><h3>Días propuestos</h3><div className="day-checkboxes">{Object.entries(DAY_LABELS).map(([day, label]) => <label key={day}><input type="checkbox" checked={draftDays.includes(Number(day))} onChange={event => toggleDraftDay(Number(day), event.target.checked)} />{label}</label>)}</div><button className="button button--dark" type="button" onClick={saveDraftDays}>Actualizar borrador local</button></div>}
            <p className="demo-notice">Cambios y aprobación locales de demostración; no se guardaron en el servidor.</p>
          </section>}
          {!draft && <section className="empty-proposal"><h3>Prepara una propuesta</h3><p>La propuesta se abrirá como borrador. V1 seguirá vigente hasta una aprobación explícita.</p><button className="button button--dark" type="button" disabled={busy} onClick={createDraft}>{busy ? 'Preparando…' : 'Crear borrador · demo'}</button><small>La interfaz usa únicamente el caso ficticio disponible.</small></section>}
        </section>}

        {section === 'attendance' && <section className="surface-card trainer-record-section">
          <div className="card-heading"><div><span className="eyebrow">Control de ingresos</span><h2>Asistencia de Ana</h2></div><span className="pending-chip">Registro no conectado</span></div>
          <form className="trainer-record-form" onSubmit={event => showNotConnected(event, 'Asistencia')}>
            <label>Fecha de asistencia<input type="date" /></label>
            <label>Estado<select defaultValue=""><option value="" disabled>Seleccionar estado</option><option>Asistió</option><option>No asistió</option></select></label>
            <label className="trainer-form-wide">Nota breve<textarea rows="3" placeholder="Opcional" /></label>
            <button className="button button--dark" type="submit">Preparar registro</button>
          </form>
          <div className="trainer-empty-history"><h3>Historial de asistencia</h3><p>Pendiente de registro. El formulario aún no guarda información.</p></div>
        </section>}

        {section === 'assessment' && <section className="trainer-record-section">
          <div className="surface-card trainer-assessment-intro"><div><span className="eyebrow">Seguimiento del proceso</span><h2>Evaluaciones y medidas</h2><p>Los valores reales de Ana están pendientes. No se muestran datos clínicos ficticios.</p></div><span className="pending-chip">Pendiente de registro</span></div>
          <div className="trainer-measurement-grid">{MEASUREMENT_GROUPS.map(group => <article className="surface-card trainer-measurement-card" key={group}><h3>{group}</h3><strong>Pendiente de medición</strong><p>Valor, unidad, fecha y origen aparecerán al registrarse.</p><p className="trainer-history-note">Historial anterior: pendiente de registro.</p></article>)}</div>
          <section className="surface-card trainer-record-editor"><div className="card-heading"><h2>Registrar evaluación o medida</h2><span className="pending-chip">Solo interfaz</span></div>
            <form className="trainer-record-form" onSubmit={event => showNotConnected(event, 'Evaluación o medida')}>
              <label>Dato a registrar<input name="recordName" placeholder="Ej. peso" /></label>
              <label>Valor<input name="recordValue" inputMode="decimal" /></label>
              <label>Unidad<input name="recordUnit" placeholder="Unidad" /></label>
              <label>Fecha<input name="recordDate" type="date" /></label>
              <label>Origen<input name="recordSource" placeholder="Origen de la medición" /></label>
              <label className="trainer-form-wide">Observaciones<textarea name="recordNotes" rows="3" /></label>
              <button className="button button--dark" type="submit">Preparar registro</button>
            </form>
          </section>
        </section>}
      </div>
    </div>
  </main>;
}
