import { useEffect, useState } from 'react';
import Brand from '../components/Brand.jsx';
import OnboardingFlow from '../features/onboarding/OnboardingFlow.jsx';
import ClientExperience from '../features/client/ClientExperience.jsx';
import TrainerLogin from '../features/trainer/TrainerLogin.jsx';
import { DEMO_CLIENT, DEMO_REQUESTS } from '../mocks/demoData.js';
import { attendanceService } from '../services/planService.js';

function getStoredSession() {
  try {
    const raw = localStorage.getItem('olimpyc-fit:demo-session') || sessionStorage.getItem('olimpyc-fit:demo-session');
    return raw && localStorage.getItem('olimpyc-fit:onboarding:DEMO-A1') === 'true' ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function App() {
  const [session, setSession] = useState(getStoredSession);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [queue, setQueue] = useState([...DEMO_REQUESTS]);
  const [approvedDays, setApprovedDays] = useState([1, 4]);
  const [approvedVersion, setApprovedVersion] = useState('V1');
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  function navigate(path) {
    window.history.pushState({}, '', path);
    setPathname(path);
  }

  if (pathname === '/entrenador' || pathname.startsWith('/entrenador/')) return <TrainerLogin onBackToClient={() => navigate('/')} />;
  if (!session) return <OnboardingFlow
    onAuthenticated={() => setSession(getStoredSession() || { profileId: DEMO_CLIENT.id })}
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
    const existingIndex = pending.findIndex(item => item.solicitudId === 'DEMO-Q1' || item.solicitudId.startsWith('DEMO-HELP-'));
    if (existingIndex >= 0) return existingIndex + 1;

    const turnNumber = pending.length + 1;
    const requestId = `DEMO-HELP-${Date.now()}`;
    const receivedAt = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    setQueue(current => [...current, {
      solicitudId: requestId,
      atleta: DEMO_CLIENT.fullName,
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
    <ClientExperience clientProfile={DEMO_CLIENT} approvedDays={approvedDays} approvedVersion={approvedVersion} setNotice={setNotice} onRequestHelp={requestClientHelp} />
  </div>;
}
