import { useState } from 'react';
import Brand from '../../components/Brand.jsx';
import TrainerDesktop from './TrainerDesktop.jsx';
import TrainerMobile from './TrainerMobile.jsx';
import './trainer.css';

export default function TrainerPortal({ clients, selectedClient, onSelectClient, onAddClient, hasApprovedPlan, approvedDays, approvedVersion, approvedRoutineDays, draft, setDraft, profileData, attendanceRecords, assessmentRecords, onSaveProfile, onAddAttendance, onAddAssessment, onUpdateAssessment, onDeleteAttendance, onDeleteAssessment, onApproveDemoRoutine, queue, onAttend, setNotice, onExitDemo }) {
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
    <TrainerDesktop active={section === 'dashboard'} clients={clients} selectedClient={selectedClient} onSelectClient={onSelectClient} onAddClient={onAddClient} hasApprovedPlan={hasApprovedPlan} approvedDays={approvedDays} approvedVersion={approvedVersion} approvedRoutineDays={approvedRoutineDays} draft={draft} setDraft={setDraft} profileData={profileData} attendanceRecords={attendanceRecords} assessmentRecords={assessmentRecords} onSaveProfile={onSaveProfile} onAddAttendance={onAddAttendance} onAddAssessment={onAddAssessment} onUpdateAssessment={onUpdateAssessment} onDeleteAttendance={onDeleteAttendance} onDeleteAssessment={onDeleteAssessment} onApproveDemoRoutine={onApproveDemoRoutine} queue={queue} onAttend={onAttend} setNotice={setNotice} />
    <div hidden={section !== 'requests'}><TrainerMobile queue={queue} onAttend={onAttend} /></div>
  </div>;
}
