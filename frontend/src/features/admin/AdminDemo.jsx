import { useMemo, useState } from 'react';
import Brand from '../../components/Brand.jsx';
import './admin.css';

const SECTIONS = [
  ['overview', 'Resumen'],
  ['trainers', 'Entrenadores'],
  ['clients', 'Clientes'],
  ['assignments', 'Asignaciones'],
  ['subscriptions', 'Suscripciones'],
  ['comments', 'Comentarios'],
  ['machines', 'Máquinas y reportes'],
];

const DEMO_PEOPLE = [
  { role: 'Entrenadora', name: 'Eva', relation: 'Entrenadora del caso ficticio de Ana' },
  { role: 'Cliente', name: 'Ana', relation: 'Cliente ficticia acompañada por Eva' },
];

const METRICS = [
  ['Asistencia', 'Registro de visitas y periodo reportado'],
  ['Ocupación', 'Capacidad y periodo de medición'],
  ['Rendimiento de entrenadores', 'Indicadores y periodo definidos por el proyecto'],
  ['Estado de máquinas', 'Inventario y reportes vigentes'],
];

function PendingPanel({ title, description }) {
  return <section className="surface-card admin-pending-panel">
    <span className="pending-chip">Pendiente de integración</span>
    <h2>{title}</h2>
    <p>{description}</p>
    <small>Las rutas administrativas aún no están verificadas como desplegadas. Esta vista demo no lee ni guarda datos.</small>
  </section>;
}

function PendingForm({ title, description, children, action }) {
  return <section className="surface-card admin-pending-panel">
    <span className="pending-chip">Pendiente de despliegue del backend</span>
    <h2>{title}</h2>
    <p>{description}</p>
    <form className="admin-preview-form" onSubmit={event => event.preventDefault()}>
      <fieldset disabled aria-describedby="adminFormStatus">{children}<button className="button button--dark" type="submit">{action}</button></fieldset>
      <small id="adminFormStatus">Formulario de referencia deshabilitado. No envía ni guarda datos.</small>
    </form>
  </section>;
}

function PersonList({ kind, query }) {
  const matches = DEMO_PEOPLE.filter(person => person.role === kind && `${person.name} ${person.relation}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  return <>
    {matches.length ? <div className="admin-person-list">{matches.map(person => <article className="surface-card admin-person-card" key={person.name}>
      <div className="admin-avatar" aria-hidden="true">{person.name[0]}</div>
      <div><span className="eyebrow">{person.role} · dato ficticio</span><h2>{person.name}</h2><p>{person.relation}</p></div>
      <button className="button button--outline" type="button" disabled>Ficha pendiente de contrato</button>
    </article>)}</div> : <div className="surface-card admin-empty"><h2>Sin coincidencias</h2><p>No hay otros registros disponibles en la demostración.</p></div>}
    <p className="admin-demo-note">Eva y Ana son los únicos perfiles de ejemplo disponibles en el frontend. No representan registros reales del gimnasio.</p>
  </>;
}

function Overview() {
  return <>
    <section className="admin-metric-grid" aria-label="Indicadores administrativos pendientes">
      {METRICS.map(([name, context]) => <article className="surface-card admin-metric-card" key={name}>
        <span className="eyebrow">Indicador · {name}</span>
        <strong>Pendiente</strong>
        <span>Periodo: pendiente de definición</span>
        <p>{context}. Valor pendiente de contrato y fuente de datos.</p>
      </article>)}
    </section>
    <section className="admin-overview-lower">
      <div className="surface-card admin-intro-card"><span className="eyebrow">Vista general</span><h2>Una operación clara, con datos confirmados.</h2><p>Los indicadores y acciones se habilitarán cuando el backend despliegue las rutas administrativas y valide sus permisos.</p><svg viewBox="0 0 160 26" aria-hidden="true"><path d="M3 16c18-8 28 6 44-1s26-6 41 0 25 4 39-2 22 0 30 1" /></svg></div>
      <PendingPanel title="Actividad administrativa" description="Los registros de entrenadores, clientes, suscripciones e incidencias aún no están conectados." />
    </section>
  </>;
}

export default function AdminDemo({ onExit }) {
  const [section, setSection] = useState('overview');
  const [query, setQuery] = useState('');
  const activeSection = SECTIONS.find(([key]) => key === section)?.[1] || 'Resumen';
  const searchLabel = section === 'trainers' ? 'Buscar entrenadora' : 'Buscar cliente';
  const pageContent = useMemo(() => {
    if (section === 'overview') return <Overview />;
    if (section === 'trainers' || section === 'clients') return null;
    if (section === 'assignments') return <PendingForm title="Asignar entrenador y atleta" description="Vista preparada para POST /api/v1/admin/asignaciones. El servidor resolverá el gimnasio del administrador autenticado; el formulario no incluye gimnasioId." action="Crear asignación">
      <label>Entrenador ID<input name="entrenadorId" /></label><label>Atleta ID<input name="atletaId" /></label>
    </PendingForm>;
    if (section === 'subscriptions') return <PendingForm title="Gestionar suscripción" description="Vista preparada para GET, POST y PATCH /api/v1/admin/suscripciones. No se muestran precios, cobros ni reglas de renovación." action="Registrar suscripción">
      <label>Cliente<input name="cliente" /></label><label>Plan<input name="plan" /></label><label>Inicio de vigencia<input name="inicioVigencia" type="date" /></label><label>Fin de vigencia<input name="finVigencia" type="date" /></label><label>Estado<select name="estado"><option>activa</option><option>pendiente</option><option>vencida</option><option>cancelada</option></select></label>
    </PendingForm>;
    if (section === 'comments') return <PendingPanel title="Comentarios enviados a administración" description="Vista preparada para GET /api/v1/admin/comentarios y PATCH /api/v1/admin/comentarios/:comentarioId. Solo se representarán los estados nuevo, leído y atendido; no se mostrarán conversaciones privadas completas ni respuestas inventadas." />;
    return <PendingPanel title="Máquinas y reportes" description="Inventario, ocupación, asistencia consolidada, métricas agregadas y reportes de máquinas quedan para una fase posterior; no se generan cifras ni acciones operativas." />;
  }, [section, query]);

  return <div className="admin-demo-shell">
    <header className="admin-header"><Brand compact /><div className="admin-header-copy"><span className="eyebrow">Olimpyc Fit · administración</span><strong>Panel principal</strong></div><span className="admin-demo-badge">Modo interfaz demo · sin autenticación</span><button className="button button--outline" type="button" onClick={onExit}>Volver</button></header>
    <main className="admin-main">
      <section className="admin-page-heading"><div><span className="eyebrow">Gestión del gimnasio</span><h1>{activeSection}</h1><p>Interfaz de revisión administrativa. Las operaciones requieren contratos y autorización del backend.</p></div><span className="admin-demo-note">Ningún cambio se guarda</span></section>
      <nav className="admin-section-nav" aria-label="Secciones administrativas">{SECTIONS.map(([key, label]) => <button type="button" key={key} className={section === key ? 'is-active' : ''} aria-current={section === key ? 'page' : undefined} onClick={() => { setSection(key); setQuery(''); }}>{label}</button>)}</nav>
      {(section === 'trainers' || section === 'clients') && <>
        <label className="admin-search">{searchLabel}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre" /></label>
        <div className="admin-members-layout"><PersonList kind={section === 'trainers' ? 'Entrenadora' : 'Cliente'} query={query} />
          <PendingForm title="Registrar miembro" description="Vista preparada para GET/POST /api/v1/admin/miembros y PATCH /api/v1/admin/miembros/:miembroId. La clave temporal, si el servidor la devuelve, se mostrará una sola vez." action="Crear miembro">
            <label>Rol<select name="rol"><option>entrenador</option><option>atleta</option></select></label><label>Nombre<input name="nombre" /></label><label>Alias visible<input name="aliasVisible" /></label><label>Correo electrónico<input name="email" type="email" /></label><label>Contraseña temporal (opcional)<input name="passwordTemporal" type="password" autoComplete="new-password" /></label>
          </PendingForm>
        </div>
      </>}
      <div className="admin-content" aria-live="polite">{pageContent}</div>
      <p className="admin-integrity-note"><strong>Modo demostración.</strong> No hay autenticación administrativa, métricas reales, persistencia ni conexión con Supabase en este panel.</p>
    </main>
  </div>;
}
