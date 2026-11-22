import { useEffect, useState } from 'react';
import Brand from '../components/Brand.jsx';
import OnboardingFlow from '../features/onboarding/OnboardingFlow.jsx';
import ClientExperience from '../features/client/ClientExperience.jsx';
import TrainerLogin from '../features/trainer/TrainerLogin.jsx';
import TrainerPortal from '../features/trainer/TrainerPortal.jsx';
import { DEMO_CLIENT, DEMO_REQUESTS } from '../mocks/demoData.js';
import { attendanceService } from '../services/planService.js';

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

export default function App() {
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
  if (pathname === '/entrenador' || pathname.startsWith('/entrenador/')) return <TrainerLogin
    demoAvailable={import.meta.env.DEV}
    onOpenDemo={() => navigate('/entrenador/demo')}
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
