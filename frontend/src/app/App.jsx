import { useEffect, useState } from 'react';
import Brand from '../components/Brand.jsx';
import OnboardingFlow from '../features/onboarding/OnboardingFlow.jsx';
import ClientExperience from '../features/client/ClientExperience.jsx';
import TrainerLogin from '../features/trainer/TrainerLogin.jsx';
import TrainerPortal from '../features/trainer/TrainerPortal.jsx';
import TrainerUuidDemo from '../features/trainer/TrainerUuidDemo.jsx';
import TrainerLiveClients from '../features/trainer/TrainerLiveClients.jsx';
import { DEMO_CLIENT, DEMO_REQUESTS } from '../mocks/demoData.js';
import { attendanceService, planService } from '../services/planService.js';
import { useAuth } from './providers/AuthProvider.jsx';
import AdminDemo from '../features/admin/AdminDemo.jsx';

function getStoredSession() {
  for (const raw of [localStorage.getItem('olimpyc-fit:demo-session'), sessionStorage.getItem('olimpyc-fit:demo-session')]) {
    if (!raw) continue;
    try {
      const stored = JSON.parse(raw);
      if (stored?.profileId === DEMO_CLIENT.id && localStorage.getItem('olimpyc-fit:onboarding:DEMO-A1') === 'true') return stored;
    } catch { /* Ignora sesiones demo malformadas y muestra el acceso. */ }
  }
  return null;
}

function DemoApplication() {
  const [session, setSession] = useState(getStoredSession);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [clients, setClients] = useState([DEMO_CLIENT]);
  const [trainerClientId, setTrainerClientId] = useState(DEMO_CLIENT.id);
  const [plansByClient, setPlansByClient] = useState({ [DEMO_CLIENT.id]: { hasPlan: true, approvedDays: [1, 4], approvedVersion: 'V1', approvedRoutineDays: null } });
  const [draftsByClient, setDraftsByClient] = useState({});
  const [trainerDataByClient, setTrainerDataByClient] = useState({ [DEMO_CLIENT.id]: { profile: {}, attendance: [], records: [] } });
  const [queue, setQueue] = useState([...DEMO_REQUESTS]);
  const [notice, setNotice] = useState('');
  const trainerClient = clients.find(client => client.id === trainerClientId) || DEMO_CLIENT;
  const trainerRoster = clients.map(({ id, fullName, trainerName }) => ({ id, fullName, trainerName, plan: plansByClient[id] || { hasPlan: false, approvedVersion: 'Pendiente' } }));
  const selectedTrainerClient = { id: trainerClient.id, fullName: trainerClient.fullName, trainerName: trainerClient.trainerName, isDemo: trainerClient.isDemo };
  const trainerPlan = plansByClient[trainerClient.id] || { hasPlan: false, approvedDays: [], approvedVersion: 'Pendiente' };
  const activeClient = clients.find(client => client.id === session?.profileId) || DEMO_CLIENT;
  const activeClientPlan = plansByClient[activeClient.id] || { hasPlan: false, approvedDays: [], approvedVersion: 'Pendiente' };
  const trainerDraft = draftsByClient[trainerClient.id] || null;
  const trainerData = trainerDataByClient[trainerClient.id] || { profile: {}, attendance: [], records: [] };

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  function navigate(path) {
    window.history.pushState({}, '', path);
    setPathname(path);
  }

  if (pathname === '/administracion/demo' && import.meta.env.DEV) {
    return <AdminDemo onExit={() => navigate('/')} />;
  }

  if (pathname === '/administracion' || pathname.startsWith('/administracion/')) {
    return <main className="onboarding-shell">
      <header className="app-header"><Brand compact /><span className="header-kicker">ADMINISTRACIÓN</span></header>
      <section className="onboarding-content" aria-labelledby="adminAccessTitle">
        <span className="eyebrow">Acceso bloqueado</span>
        <h1 id="adminAccessTitle">El panel administrativo aún no está conectado.</h1>
        <p className="lead">No se puede verificar una sesión Supabase ni confirmar el rol administrador desde este frontend. Por seguridad, esta ruta no muestra datos administrativos.</p>
        <p className="demo-notice">Integración pendiente: la identidad se consulta mediante GET /api/v1/auth/me. El panel administrativo y sus rutas aún no están disponibles en el backend desplegado.</p>
        <a className="button button--dark" href="/">Ir al acceso principal</a>
      </section>
    </main>;
  }

  function addDemoClient({ fullName, nationalId }) {
    const normalizedId = nationalId.replace(/\D/g, '');
    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    if (!cleanName || !normalizedId) return { error: 'Ingresa el nombre y la cédula asociados al registro.' };
    if (clients.some(client => client.nationalId === normalizedId)) return { error: 'Ya existe una persona de demostración con esa cédula.' };
    const client = { id: `DEMO-A-${Date.now()}-${clients.length}`, fullName: cleanName, nationalId: normalizedId, trainerName: 'Eva', isDemo: true };
    setClients(current => [...current, client]);
    setPlansByClient(current => ({ ...current, [client.id]: { hasPlan: false, approvedDays: [], approvedVersion: 'Pendiente' } }));
    setTrainerDataByClient(current => ({ ...current, [client.id]: { profile: {}, attendance: [], records: [] } }));
    setTrainerClientId(client.id);
    setNotice(`${client.fullName} se agregó solo a esta demostración local. No se guardó en el servidor.`);
    return { client };
  }

  function updateTrainerPlan(field, value) {
    setPlansByClient(current => ({
      ...current,
      [trainerClient.id]: { ...(current[trainerClient.id] || { hasPlan: false, approvedDays: [], approvedVersion: 'Pendiente', approvedRoutineDays: null }), [field]: value },
    }));
  }

  function updateTrainerDraft(updater) {
    setDraftsByClient(current => ({
      ...current,
      [trainerClient.id]: typeof updater === 'function' ? updater(current[trainerClient.id] || null) : updater,
    }));
  }

  function updateTrainerData(field, updater) {
    setTrainerDataByClient(current => {
      const data = current[trainerClient.id] || { profile: {}, attendance: [], records: [] };
      return {
        ...current,
        [trainerClient.id]: {
          ...data,
          [field]: typeof updater === 'function' ? updater(data[field]) : updater,
        },
      };
    });
  }

  if (pathname === '/entrenador/demo') {
    if (import.meta.env.DEV) return <TrainerPortal
      clients={trainerRoster}
      selectedClient={selectedTrainerClient}
      onSelectClient={setTrainerClientId}
      onAddClient={addDemoClient}
      hasApprovedPlan={trainerPlan.hasPlan}
      approvedDays={trainerPlan.approvedDays}
      approvedVersion={trainerPlan.approvedVersion}
      approvedRoutineDays={trainerPlan.approvedRoutineDays}
      setApprovedDays={value => updateTrainerPlan('approvedDays', value)}
      setApprovedVersion={value => updateTrainerPlan('approvedVersion', value)}
      setApprovedRoutineDays={value => updateTrainerPlan('approvedRoutineDays', value)}
      setHasApprovedPlan={value => updateTrainerPlan('hasPlan', value)}
      draft={trainerDraft}
      setDraft={updateTrainerDraft}
      profileData={trainerData.profile}
      attendanceRecords={trainerData.attendance}
      assessmentRecords={trainerData.records}
      onSaveProfile={value => updateTrainerData('profile', value)}
      onAddAttendance={value => updateTrainerData('attendance', current => [...(current || []), value])}
      onAddAssessment={value => updateTrainerData('records', current => [...(current || []), value])}
      onUpdateAssessment={value => updateTrainerData('records', current => (current || []).map(record => record.id === value.id ? value : record))}
      onDeleteAttendance={id => updateTrainerData('attendance', current => (current || []).filter(record => record.id !== id))}
      onDeleteAssessment={id => updateTrainerData('records', current => (current || []).filter(record => record.id !== id))}
      onApproveDemoRoutine={({ days, version }) => {
        if (!selectedTrainerClient.isDemo || !days.every(day => day.demo === true && day.items.every(item => item.demo === true))) return;
        updateTrainerPlan('hasPlan', true);
        updateTrainerPlan('approvedDays', days.map(day => day.diaSemana));
        updateTrainerPlan('approvedVersion', version);
        updateTrainerPlan('approvedRoutineDays', days);
      }}
      queue={queue}
      onAttend={markAttended}
      setNotice={setNotice}
      onExitDemo={() => navigate('/entrenador')}
    />;
    return <TrainerLogin onBackToClient={() => navigate('/')} />;
  }
  if (pathname === '/entrenador/uuid-demo') {
    if (planService.isUuidDemoAvailable()) return <TrainerUuidDemo onExit={() => navigate('/entrenador')} />;
    return <TrainerLogin apiDemoMessage="La demo UUID está desactivada. Inicia Vite en desarrollo con VITE_API_MODE=uuid-demo, la base local y los tokens ficticios documentados." onBackToClient={() => navigate('/')} />;
  }
  if (pathname === '/entrenador' || pathname.startsWith('/entrenador/')) return <TrainerLogin
    demoAvailable={import.meta.env.DEV}
    apiDemoAvailable={planService.isUuidDemoAvailable()}
    onOpenDemo={() => navigate('/entrenador/demo')}
    onOpenApiDemo={() => navigate('/entrenador/uuid-demo')}
    onBackToClient={() => navigate('/')}
  />;
  if (!session) return <OnboardingFlow
    clients={clients}
    onAuthenticated={client => setSession({ profileId: client?.id || DEMO_CLIENT.id })}
  />;

  async function markAttended(id) {
    try {
      const result = id.startsWith('DEMO-')
        ? { demo: true }
        : await attendanceService.markAttended(id);
      setQueue(current => current.map(item => item.solicitudId === id ? { ...item, estado: 'atendida' } : item));
      setNotice(result.demo ? 'Atención marcada solo en esta demostración; no se envió al servidor.' : 'Solicitud atendida.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  function requestClientHelp() {
    const pending = queue.filter(item => item.estado === 'pendiente');
    const existingIndex = pending.findIndex(item => item.atleta === activeClient.fullName && (item.solicitudId === 'DEMO-Q1' || item.solicitudId.startsWith('DEMO-HELP-')));
    if (existingIndex >= 0) return existingIndex + 1;

    const turnNumber = pending.length + 1;
    const requestId = `DEMO-HELP-${Date.now()}`;
    const receivedAt = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    setQueue(current => [...current, {
      solicitudId: requestId,
      atleta: activeClient.fullName,
      ejercicio: 'No especificado',
      estacion: 'No especificada',
      receivedAt,
      estado: 'pendiente',
      demo: true,
    }]);
    return turnNumber;
  }

  function signOut() {
    localStorage.removeItem('olimpyc-fit:demo-session');
    sessionStorage.removeItem('olimpyc-fit:demo-session');
    setSession(null);
  }

  return <div className="app-shell app-shell--mobile">
    <header className="app-header app-header--signed-in">
      <Brand compact />
      <button className="signout-button" onClick={signOut}>Salir</button>
    </header>
    {notice && <div className="global-notice" role="status">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button></div>}
    <ClientExperience clientProfile={activeClient} hasApprovedPlan={activeClientPlan.hasPlan} approvedDays={activeClientPlan.approvedDays} approvedVersion={activeClientPlan.approvedVersion} approvedRoutineDays={activeClientPlan.approvedRoutineDays} setNotice={setNotice} onRequestHelp={requestClientHelp} />
  </div>;
}

function AccessStatus({ title, description, error, onRetry, onSignOut, onBack }) {
  return <main className="onboarding-shell">
    <header className="app-header"><Brand compact /><span className="header-kicker">OLIMpyC FIT · ACCESO</span></header>
    <section className="onboarding-content" aria-live="polite">
      <span className="eyebrow">{title}</span>
      <h1>{description}</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {onRetry && <button className="button button--dark" type="button" onClick={onRetry}>Reintentar verificación</button>}
        {onSignOut && <button className="button button--outline" type="button" onClick={onSignOut}>Cerrar sesión</button>}
        {onBack && <a className="button button--outline" href="/">Volver al acceso</a>}
      </div>
    </section>
  </main>;
}

function SupabaseApplication({ auth }) {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  function navigate(path) {
    window.history.pushState({}, '', path);
    setPathname(path);
  }

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    const target = auth.role === 'atleta' ? '/' : auth.role === 'entrenador' ? '/entrenador' : '/administracion';
    if (pathname === '/' || pathname === '/entrenador' || pathname === '/administracion') {
      if (pathname !== target) navigate(target);
    }
  }, [auth.status, auth.role, pathname]);

  if (pathname === '/administracion/demo' && import.meta.env.DEV) {
    return <AdminDemo onExit={() => navigate('/')} />;
  }

  if (auth.status === 'loading' || auth.status === 'authenticating' || auth.status === 'verifying') {
    return <AccessStatus title="Verificando sesión" description="Espera mientras confirmamos tu identidad y tu rol con el servidor." />;
  }

  if (auth.status === 'identity-error' || auth.status === 'unknown-role') {
    return <AccessStatus title="No se pudo verificar el acceso" description="No abrimos una interfaz protegida." error={auth.error} onRetry={() => auth.retryIdentity()} onSignOut={() => auth.signOut()} />;
  }

  if (auth.status !== 'authenticated') {
    return <OnboardingFlow authMode="supabase" onSupabaseLogin={auth.signIn} />;
  }

  if (auth.role === 'atleta') {
    return <div className="app-shell app-shell--mobile">
      <header className="app-header app-header--signed-in"><Brand compact /><button className="signout-button" type="button" onClick={() => auth.signOut()}>Salir</button></header>
      <ClientExperience clientProfile={{ isDemo: false }} hasApprovedPlan={false} approvedDays={[]} approvedVersion="Pendiente" setNotice={() => {}} onRequestHelp={() => null} />
    </div>;
  }

  if (auth.role === 'entrenador') {
    return <TrainerLiveClients onSignOut={() => auth.signOut()} />;
  }

  if (auth.role === 'administrador') {
    return <AccessStatus title="Pendiente de integración administrativa" description="El servidor confirmó el rol administrador. Las rutas administrativas todavía no están disponibles en el backend desplegado, así que no se muestran datos ni acciones del panel." onSignOut={() => auth.signOut()} />;
  }

  return <AccessStatus title="Acceso no disponible" description="El rol no permite abrir una interfaz en esta aplicación." onSignOut={() => auth.signOut()} />;
}

export default function App() {
  const auth = useAuth();
  if (auth.incomplete || auth.invalidUrl) {
    return <AccessStatus title={auth.invalidUrl ? 'URL de Supabase inválida' : 'Configuración incompleta'} description={auth.invalidUrl ? 'Revisa VITE_SUPABASE_URL. No cambiaremos al modo demo mientras la configuración real sea inválida.' : 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY juntas. No cambiaremos al modo demo mientras falte una de ellas.'} />;
  }
  if (auth.configured && planService.getApiMode() === 'uuid-demo') {
    return <AccessStatus title="Configuración incompatible" description="Supabase Auth y la demo UUID deben ejecutarse por separado. Quita VITE_API_MODE=uuid-demo para usar la sesión real; no se enviarán tokens ficticios a esta sesión." />;
  }
  if (auth.configured) return <SupabaseApplication auth={auth} />;
  return <DemoApplication />;
}
