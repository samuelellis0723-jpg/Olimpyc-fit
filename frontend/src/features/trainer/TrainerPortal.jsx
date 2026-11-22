import { useState } from 'react';
import Brand from '../../components/Brand.jsx';
import TrainerDesktop from './TrainerDesktop.jsx';
import TrainerMobile from './TrainerMobile.jsx';
import './trainer.css';

export default function TrainerPortal({ approvedDays, approvedVersion, setApprovedDays, setApprovedVersion, draft, setDraft, queue, onAttend, setNotice, onExitDemo }) {
  const [section, setSection] = useState('dashboard');
  return <div className="trainer-portal-shell">
    <header className="trainer-portal-header">
      <Brand compact />
      <nav className="trainer-portal-nav" aria-label="Navegación del entrenador">
        <button type="button" className={section === 'dashboard' ? 'is-active' : ''} aria-current={section === 'dashboard' ? 'page' : undefined} onClick={() => setSection('dashboard')}>Panel</button>
        <button type="button" className={section === 'requests' ? 'is-active' : ''} aria-current={section === 'requests' ? 'page' : undefined} onClick={() => setSection('requests')}>Solicitudes ({queue.filter(item => item.estado === 'pendiente').length})</button>
      </nav>
      <div className="trainer-portal-actions"><span className="trainer-demo-tag">Modo demostración</span><button type="button" className="signout-button" onClick={onExitDemo}>Salir</button></div>
    </header>
    {section === 'dashboard'
      ? <TrainerDesktop approvedDays={approvedDays} approvedVersion={approvedVersion} setApprovedDays={setApprovedDays} setApprovedVersion={setApprovedVersion} draft={draft} setDraft={setDraft} queue={queue} onAttend={onAttend} setNotice={setNotice} />
      : <TrainerMobile queue={queue} onAttend={onAttend} />}
  </div>;
}
