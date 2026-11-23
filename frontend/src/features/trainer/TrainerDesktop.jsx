import { useEffect, useMemo, useState } from 'react';
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

function exerciseSummary(items) {
  return items?.length
    ? items.map(item => `${item.nombre || item.name || 'Ejercicio local'} · ${item.equipo || item.equipment || 'equipo pendiente'}`).join(' / ')
    : 'Ejercicios pendientes de asignación';
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const ASSESSMENT_FORM_CONFIG = {
  'Flexibilidad y movilidad': { nameLabel: 'Prueba o movimiento evaluado', namePlaceholder: 'Escribe la prueba registrada', unitPlaceholder: 'Grados, cm u otra unidad registrada', side: true },
  'Estabilidad y fuerza base': { nameLabel: 'Prueba registrada', namePlaceholder: 'Escribe la prueba registrada', unitPlaceholder: 'Segundos, repeticiones u otra unidad', area: ['Estabilidad', 'Fuerza base', 'Sin especificar'] },
  'Proporciones y longitudes corporales': { nameLabel: 'Detalle de la medición', namePlaceholder: 'Agrega el detalle si hace falta', unitPlaceholder: 'Unidad registrada', area: ['Proporción corporal', 'Longitud de brazos', 'Longitud de fémur', 'Otro dato registrado'] },
  'Características del cuello': { nameLabel: 'Característica o medición registrada', namePlaceholder: 'Describe el dato registrado', unitPlaceholder: 'Unidad, si corresponde' },
  'Composición corporal e InBody': { nameLabel: 'Indicador registrado', namePlaceholder: 'Escribe el indicador del reporte', unitPlaceholder: 'Unidad indicada en el reporte', area: ['Peso', 'Porcentaje de grasa', 'Masa muscular', 'Otro indicador del reporte'] },
};

function AssessmentEntryForm({ category, record, onChange, onSubmit, onCancel }) {
  const config = ASSESSMENT_FORM_CONFIG[category] || {};
  return <form className="trainer-record-form assessment-inline-form" onChange={onChange} onSubmit={onSubmit}>
    <input type="hidden" name="category" value={category} />
    {config.area && <label>{category === 'Composición corporal e InBody' ? 'Tipo de dato del reporte' : category === 'Proporciones y longitudes corporales' ? 'Tipo de medición' : 'Enfoque evaluado'}<select name="area" required defaultValue={record?.area || ''}><option value="" disabled>Selecciona una opción</option>{config.area.map(option => <option key={option}>{option}</option>)}</select></label>}
    <label>{config.nameLabel || 'Dato registrado'}<input name="name" defaultValue={record?.name || ''} placeholder={config.namePlaceholder || 'Escribe el dato registrado'} required /></label>
    {config.side && <label>Lado evaluado<select name="side" defaultValue={record?.side || ''}><option value="">No especificado</option><option>Izquierdo</option><option>Derecho</option><option>Bilateral</option></select></label>}
    <label>Resultado registrado<input name="value" defaultValue={record?.value || ''} placeholder="Ingresa el resultado" required /></label>
    <label>Unidad<input name="unit" defaultValue={record?.unit || ''} placeholder={config.unitPlaceholder || 'Unidad registrada'} /></label>
    <label>Fecha del registro<input name="date" type="date" defaultValue={record?.date || localDate()} required /></label>
    <label>Origen del dato<input name="source" defaultValue={record?.source || ''} placeholder="Ej. evaluación presencial" required /></label>
    <label className="trainer-form-wide">Notas de la evaluación<textarea name="notes" defaultValue={record?.notes || ''} rows="2" /></label>
    <div className="trainer-form-actions trainer-form-wide"><button className="button button--dark" type="submit">{record ? 'Actualizar registro demo' : 'Guardar registro demo'}</button><button className="button button--outline" type="button" onClick={onCancel}>Cancelar</button></div>
  </form>;
}

const blankExercise = () => ({ nombre: '', grupoMuscular: '', equipo: '', series: '', objetivo: '', unidad: 'repeticiones', descansoSegundos: '', carga: '', unidadCarga: '', explicacion: '', imagePreviewUrl: '', videoPreviewUrl: '', mediaType: '', imageAlt: '', imageFileName: '' });

export default function TrainerDesktop({ active = true, clients = [], selectedClient, onSelectClient, onAddClient, hasApprovedPlan, approvedDays, approvedVersion, approvedRoutineDays, draft, setDraft, profileData = {}, attendanceRecords = [], assessmentRecords = [], onSaveProfile, onAddAttendance, onAddAssessment, onUpdateAssessment, onDeleteAttendance, onDeleteAssessment, onApproveDemoRoutine, queue = [], onAttend, setNotice }) {
  const [section, setSection] = useState('overview');
  const [draftDays, setDraftDays] = useState([1, 4, 6]);
  const [draftExercisesByDay, setDraftExercisesByDay] = useState({});
  const [draftFocusByDay, setDraftFocusByDay] = useState({});
  const [exerciseForm, setExerciseForm] = useState(blankExercise);
  const [pendingMediaUrl, setPendingMediaUrl] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [exerciseFormDay, setExerciseFormDay] = useState(null);
  const [editingExerciseId, setEditingExerciseId] = useState(null);
  const [exerciseFormDirty, setExerciseFormDirty] = useState(false);
  const [routineDirty, setRoutineDirty] = useState(false);
  const [routineMessage, setRoutineMessage] = useState('');
  const [profileDraft, setProfileDraft] = useState({ goal: '', trainingDuration: '', cycleProgress: '', observations: '' });
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [assessmentMessage, setAssessmentMessage] = useState('');
  const [attendanceFormDirty, setAttendanceFormDirty] = useState(false);
  const [assessmentFormDirty, setAssessmentFormDirty] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [assessmentCategoryPreset, setAssessmentCategoryPreset] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [clientFormMessage, setClientFormMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingRequests = useMemo(() => queue.filter(item => item.estado === 'pendiente' && item.atleta === selectedClient?.fullName), [queue, selectedClient?.fullName]);
  const todayIso = new Date().getDay() || 7;
  const sessionToday = approvedDays.includes(todayIso);
  const comparisonDays = draft?.versionBaseDays || approvedDays;
  const comparisonVersion = draft?.versionBaseId?.replace('DEMO-', '') || null;
  const canApproveDraft = Boolean(draft?.dias?.length && draft.dias.every(day => day.items.length > 0) && draft.demo === true && !routineDirty && !exerciseFormDirty);

  useEffect(() => {
    setProfileDraft({
      goal: profileData?.goal || '',
      trainingDuration: profileData?.trainingDuration || '',
      cycleProgress: profileData?.cycleProgress || '',
      observations: profileData?.observations || '',
    });
    setProfileDirty(false);
    setProfileMessage('');
  }, [selectedClient?.id]);

  useEffect(() => {
    setDraftDays(draft?.dias?.map(day => day.diaSemana) || (hasApprovedPlan ? [...approvedDays] : []));
    setDraftExercisesByDay(Object.fromEntries((draft?.dias || []).map(day => [day.diaSemana, day.items.map(item => ({ ...item }))])));
    setDraftFocusByDay(Object.fromEntries((draft?.dias || []).map(day => [day.diaSemana, day.enfoque || ''])));
    setEditing(false);
    setExerciseFormDay(null);
    setExerciseForm(blankExercise());
    setExerciseFormDirty(false);
    setRoutineDirty(false);
  }, [selectedClient?.id]);

  async function createDraft() {
    setBusy(true);
    try {
      const initialDays = hasApprovedPlan ? [...approvedDays] : [];
      const proposal = { versionId: `DEMO-V${Date.now()}`, versionBaseId: hasApprovedPlan ? `DEMO-${approvedVersion}` : null, estado: 'borrador', revision: 1, origen: 'manual', diferencias: { explicacion: 'Borrador local creado por Eva.' }, demo: true };
      setDraftDays(initialDays);
      setDraftExercisesByDay({});
      setDraftFocusByDay({});
      const history = [...(draft?.historialDemo || []), ...(draft ? [draft] : [])];
      setDraft({ ...proposal, historialDemo: history, versionBaseDays: [...approvedDays], versionBaseRoutineDays: approvedRoutineDays, dias: initialDays.map((diaSemana, index) => ({ diaId: `DEMO-${selectedClient.id}-${index + 1}`, diaSemana, items: [] })) });
      setEditing(true);
      setRoutineDirty(false);
      setNotice('Borrador local preparado. No se guarda en el backend ni se sincroniza con Ana.');
    } catch (error) {
      setNotice(error.message);
    } finally { setBusy(false); }
  }

  function saveDraftDays() {
    if (!draft || draft.estado !== 'borrador' || draftDays.length === 0) return;
    const existingDays = new Map(draft.dias.map(day => [day.diaSemana, day]));
    const days = draftDays.map((diaSemana, index) => {
      const existing = existingDays.get(diaSemana);
      const items = (draftExercisesByDay[diaSemana] || existing?.items || []).map((item, itemIndex) => ({ ...item, orden: itemIndex + 1 }));
      return existing ? { ...existing, enfoque: draftFocusByDay[diaSemana] || existing.enfoque || '', items, demo: true } : { diaId: `DEMO-${selectedClient.id}-${draft.versionId}-${diaSemana}`, diaSemana, enfoque: draftFocusByDay[diaSemana] || '', items, demo: true };
    });
    setDraft(current => ({
      ...current,
      revision: current.revision + 1,
      dias: days,
      demo: true,
      diferencias: { ...current.diferencias, explicacion: 'Edición ficticia local; no se ha consultado el catálogo compartido.' },
    }));
    setEditing(false);
    setRoutineDirty(false);
    setRoutineMessage('Borrador actualizado en esta demostración local.');
    setNotice('Borrador actualizado localmente. No se guardó en el backend ni se sincronizó con Ana.');
  }

  function toggleDraftDay(day, enabled) {
    if (!enabled) {
      const currentItems = draftExercisesByDay[day] || draft?.dias.find(item => item.diaSemana === day)?.items || [];
      if (currentItems.length && !window.confirm(`Quitar ${DAY_LABELS[day]} eliminará sus ejercicios del borrador. ¿Continuar?`)) return;
    }
    setDraftDays(current => enabled
      ? (current.includes(day) ? current : [...current, day].sort((a, b) => a - b))
      : current.filter(value => value !== day));
    setRoutineDirty(true);
    if (!enabled) {
      setDraftExercisesByDay(current => { const next = { ...current }; delete next[day]; return next; });
      setDraftFocusByDay(current => { const next = { ...current }; delete next[day]; return next; });
    }
  }

  function beginEditingDraft() {
    setDraftDays(draft.dias.map(day => day.diaSemana));
    setDraftExercisesByDay(Object.fromEntries(draft.dias.map(day => [day.diaSemana, day.items.map(item => ({ ...item }))])));
    setDraftFocusByDay(Object.fromEntries(draft.dias.map(day => [day.diaSemana, day.enfoque || ''])));
    setEditing(true);
    setRoutineDirty(false);
  }

  function closeDraftEditor() {
    if ((routineDirty || exerciseFormDirty) && !window.confirm('Descartar los cambios sin guardar de este borrador?')) return;
    if (routineDirty || exerciseFormDirty) resetUnsavedChanges();
    setEditing(false);
  }

  function openExerciseForm(day, exercise = null) {
    setExerciseFormDay(day);
    setEditingExerciseId(exercise?.itemId || null);
    setExerciseForm(exercise ? {
      nombre: exercise.nombre || '', grupoMuscular: exercise.grupoMuscular || '', equipo: exercise.equipo || '',
      series: exercise.series ?? '', objetivo: exercise.objetivoPorSerie?.cantidad ?? '', unidad: exercise.objetivoPorSerie?.unidad || 'repeticiones',
      descansoSegundos: exercise.descansoSegundos ?? '', carga: exercise.carga?.valor ?? '', unidadCarga: exercise.carga?.unidad || '', explicacion: exercise.explicacion || '',
      imagePreviewUrl: exercise.imagePreviewUrl || '', videoPreviewUrl: exercise.videoPreviewUrl || '', mediaType: exercise.mediaType || '', imageAlt: exercise.imageAlt || '', imageFileName: exercise.imageFileName || '',
    } : blankExercise());
    setPendingMediaUrl(null);
    setPhotoError('');
    setExerciseFormDirty(false);
  }

  function selectExerciseMedia(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!mediaType) { setPhotoError('Selecciona una imagen o un video compatible.'); return; }
    const sizeLimit = mediaType === 'image' ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > sizeLimit) { setPhotoError(`El archivo supera el límite de ${mediaType === 'image' ? '5 MB' : '25 MB'}.`); return; }
    if (pendingMediaUrl) URL.revokeObjectURL(pendingMediaUrl);
    const previewUrl = URL.createObjectURL(file);
    setPendingMediaUrl(previewUrl);
    setExerciseForm(current => ({ ...current, imagePreviewUrl: mediaType === 'image' ? previewUrl : '', videoPreviewUrl: mediaType === 'video' ? previewUrl : '', mediaType, imageAlt: '', imageFileName: file.name }));
    setExerciseFormDirty(true);
    setPhotoError('');
  }

  function removeExerciseMedia() {
    if (pendingMediaUrl) URL.revokeObjectURL(pendingMediaUrl);
    setPendingMediaUrl(null);
    setExerciseForm(current => ({ ...current, imagePreviewUrl: '', videoPreviewUrl: '', mediaType: '', imageAlt: '', imageFileName: '' }));
    setExerciseFormDirty(true);
    setPhotoError('');
  }

  function closeExerciseForm() {
    if (exerciseFormDirty && !window.confirm('Descartar los cambios de este ejercicio?')) return;
    if (pendingMediaUrl) URL.revokeObjectURL(pendingMediaUrl);
    setPendingMediaUrl(null);
    setExerciseFormDay(null);
    setEditingExerciseId(null);
    setExerciseForm(blankExercise());
    setExerciseFormDirty(false);
  }

  function saveExercise(event) {
    event.preventDefault();
    const day = exerciseFormDay;
    if (!day || !exerciseForm.nombre.trim() || !exerciseForm.grupoMuscular.trim() || !exerciseForm.equipo.trim() || !Number(exerciseForm.series) || !Number(exerciseForm.objetivo)) return;
    if ((exerciseForm.carga && !exerciseForm.unidadCarga.trim()) || (!exerciseForm.carga && exerciseForm.unidadCarga.trim())) {
      setRoutineMessage('Indica el valor y la unidad de carga juntos, o deja ambos pendientes.');
      return;
    }
    if (exerciseForm.mediaType === 'image' && exerciseForm.imagePreviewUrl && !exerciseForm.imageAlt.trim()) {
      setPhotoError('Agrega un texto alternativo para la foto.');
      return;
    }
    setDraftExercisesByDay(current => {
      const existing = current[day] || draft?.dias.find(item => item.diaSemana === day)?.items || [];
      const itemId = editingExerciseId || `LOCAL-${selectedClient?.id}-${Date.now()}`;
      const item = {
        itemId, ejercicioId: itemId, orden: existing.length + 1, nombre: exerciseForm.nombre.trim(),
        grupoMuscular: exerciseForm.grupoMuscular.trim(), equipo: exerciseForm.equipo.trim(), series: Number(exerciseForm.series),
        objetivoPorSerie: { cantidad: Number(exerciseForm.objetivo), unidad: exerciseForm.unidad },
        ...(exerciseForm.descansoSegundos !== '' ? { descansoSegundos: Number(exerciseForm.descansoSegundos) } : {}),
        ...(exerciseForm.carga !== '' ? { carga: { valor: Number(exerciseForm.carga), unidad: exerciseForm.unidadCarga.trim() } } : {}),
        explicacion: exerciseForm.explicacion.trim(), catalogo: 'Ejercicio local ficticio · no confirmado', demo: true,
        ...(exerciseForm.mediaType === 'image' && exerciseForm.imagePreviewUrl ? { imagePreviewUrl: exerciseForm.imagePreviewUrl, imageAlt: exerciseForm.imageAlt.trim(), imageFileName: exerciseForm.imageFileName, mediaType: 'image' } : {}),
        ...(exerciseForm.mediaType === 'video' && exerciseForm.videoPreviewUrl ? { videoPreviewUrl: exerciseForm.videoPreviewUrl, imageFileName: exerciseForm.imageFileName, mediaType: 'video' } : {}),
      };
      const nextItems = editingExerciseId ? existing.map(previous => previous.itemId === editingExerciseId ? item : previous) : [...existing, item];
      return { ...current, [day]: nextItems.map((entry, index) => ({ ...entry, orden: index + 1 })) };
    });
    setPendingMediaUrl(null);
    setRoutineDirty(true);
    setExerciseFormDay(null);
    setEditingExerciseId(null);
    setExerciseForm(blankExercise());
    setExerciseFormDirty(false);
    setRoutineMessage('Ejercicio incluido en los cambios pendientes del borrador local.');
  }

  function moveExercise(day, index, direction) {
    setDraftExercisesByDay(current => {
      const items = [...(current[day] || draft?.dias.find(item => item.diaSemana === day)?.items || [])];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= items.length) return current;
      [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      return { ...current, [day]: items.map((item, order) => ({ ...item, orden: order + 1 })) };
    });
    setRoutineDirty(true);
  }

  function removeExercise(day, exercise) {
    if (!window.confirm(`Eliminar “${exercise.nombre}” del borrador?`)) return;
    setDraftExercisesByDay(current => {
      const items = current[day] || draft?.dias.find(item => item.diaSemana === day)?.items || [];
      return { ...current, [day]: items.filter(item => item.itemId !== exercise.itemId).map((item, order) => ({ ...item, orden: order + 1 })) };
    });
    setRoutineDirty(true);
  }

  function approveDraft() {
    if (!draft || draft.estado !== 'borrador' || !canApproveDraft) return;
    if (!window.confirm(`Aprobar esta rutina ficticia para que se refleje en la interfaz demo de ${selectedClient?.fullName}? No se guardará en el backend.`)) return;
    const persistedDays = draftDays.map(diaSemana => ({ diaSemana, diaId: `DEMO-${draft.versionId}-${diaSemana}`, enfoque: draftFocusByDay[diaSemana] || '', items: (draftExercisesByDay[diaSemana] || []).map((item, order) => ({ ...item, orden: order + 1 })), demo: true }));
    setDraft(current => ({ ...current, estado: 'aprobada-demo', dias: persistedDays, aprobacion: { aprobadorId: 'DEMO-EVA', fecha: new Date().toISOString() } }));
    onApproveDemoRoutine?.({ days: persistedDays, version: draft.versionId.replace('DEMO-', '') });
    setNotice(`Rutina aprobada dentro del modo demo y visible para la sesión demo de ${selectedClient?.fullName}. No se guardó en el backend.`);
  }

  function markRejected() {
    setDraft(current => current ? { ...current, estado: 'rechazado-demo' } : current);
    setNotice('Rechazo mostrado solo en la demostración; V1 continúa vigente.');
  }

  function saveProfile(event) {
    event.preventDefault();
    const clean = Object.fromEntries(Object.entries(profileDraft).map(([key, value]) => [key, value.trim()]));
    if (!Object.values(clean).some(Boolean)) {
      setProfileMessage('Completa al menos un dato antes de guardar.');
      return;
    }
    onSaveProfile?.(clean);
    setProfileDirty(false);
    setProfileMessage('Datos actualizados en el modo demo local.');
  }

  function discardProfileChanges() {
    if (!window.confirm('Descartar los cambios sin guardar del perfil?')) return;
    setProfileDraft({ goal: profileData?.goal || '', trainingDuration: profileData?.trainingDuration || '', cycleProgress: profileData?.cycleProgress || '', observations: profileData?.observations || '' });
    setProfileDirty(false);
    setProfileMessage('Cambios descartados.');
  }

  function hasUnsavedChanges() {
    return profileDirty || attendanceFormDirty || assessmentFormDirty || routineDirty || exerciseFormDirty;
  }

  function resetUnsavedChanges() {
    setProfileDraft({ goal: profileData?.goal || '', trainingDuration: profileData?.trainingDuration || '', cycleProgress: profileData?.cycleProgress || '', observations: profileData?.observations || '' });
    setProfileDirty(false);
    setAttendanceFormDirty(false);
    setAssessmentFormDirty(false);
    setEditingAssessmentId(null);
    setAssessmentCategoryPreset('');
    setDraftDays(draft?.dias?.map(day => day.diaSemana) || (hasApprovedPlan ? [...approvedDays] : []));
    setDraftExercisesByDay(Object.fromEntries((draft?.dias || []).map(day => [day.diaSemana, day.items.map(item => ({ ...item }))])));
    setDraftFocusByDay(Object.fromEntries((draft?.dias || []).map(day => [day.diaSemana, day.enfoque || ''])));
    setExerciseForm(blankExercise());
    setExerciseFormDay(null);
    setEditingExerciseId(null);
    setExerciseFormDirty(false);
    if (pendingMediaUrl) URL.revokeObjectURL(pendingMediaUrl);
    setPendingMediaUrl(null);
    setRoutineDirty(false);
    setEditing(false);
  }

  function goToSection(nextSection) {
    if (nextSection === section) return;
    if (hasUnsavedChanges()) {
      if (!window.confirm('Hay cambios sin guardar. ¿Descartarlos y cambiar de sección?')) return;
      resetUnsavedChanges();
    }
    setSection(nextSection);
  }

  function selectClient(clientId) {
    if (clientId === selectedClient?.id) return;
    if (hasUnsavedChanges()) {
      if (!window.confirm('Hay cambios sin guardar. ¿Descartarlos y abrir otra ficha?')) return;
      resetUnsavedChanges();
    }
    onSelectClient(clientId);
    setSection('overview');
  }

  function submitAttendance(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entry = { id: `DEMO-ATT-${Date.now()}`, type: String(form.get('type')), date: String(form.get('date')), time: String(form.get('time')), status: String(form.get('status')), note: String(form.get('note') || '').trim(), demo: true };
    if (!entry.type || !entry.date || !entry.time || !entry.status) { setAttendanceMessage('Completa fecha, hora, tipo y estado.'); return; }
    onAddAttendance?.(entry);
    event.currentTarget.reset();
    setAttendanceFormDirty(false);
    setAttendanceMessage('Registro añadido solo a esta demostración.');
  }

  function submitAssessment(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const entry = { id: editingAssessmentId || `DEMO-REC-${Date.now()}`, category: String(form.get('category')), area: String(form.get('area') || '').trim(), side: String(form.get('side') || '').trim(), name: String(form.get('name')).trim(), value: String(form.get('value')).trim(), unit: String(form.get('unit') || '').trim(), date: String(form.get('date')), source: String(form.get('source')).trim(), notes: String(form.get('notes') || '').trim(), status: 'Registrado · demostración local', demo: true };
    if (![entry.category, entry.name, entry.value, entry.date, entry.source].every(Boolean)) { setAssessmentMessage('Completa categoría, dato, resultado, fecha y origen.'); return; }
    if (editingAssessmentId) onUpdateAssessment?.(entry);
    else onAddAssessment?.(entry);
    event.currentTarget.reset();
    setEditingAssessmentId(null);
    setAssessmentCategoryPreset('');
    setAssessmentFormDirty(false);
    setAssessmentMessage(editingAssessmentId ? 'Evaluación actualizada solo en esta demostración.' : 'Evaluación o medida añadida solo a esta demostración.');
  }

  function editAssessment(record) {
    if (assessmentFormDirty && !window.confirm('Descartar los cambios sin guardar del formulario?')) return;
    setEditingAssessmentId(record.id);
    setAssessmentCategoryPreset(record.category);
    setAssessmentFormDirty(false);
    setAssessmentMessage('Editando el registro seleccionado.');
  }

  function beginAssessmentEntry(category) {
    if (assessmentFormDirty && !window.confirm('Descartar los cambios sin guardar del formulario?')) return;
    setEditingAssessmentId(null);
    setAssessmentCategoryPreset(category);
    setAssessmentFormDirty(false);
    setAssessmentMessage(`Ingresa los datos registrados en “${category}”.`);
  }

  function cancelAssessmentEdit() {
    if (assessmentFormDirty && !window.confirm('Descartar los cambios de esta evaluación?')) return;
    setEditingAssessmentId(null);
    setAssessmentCategoryPreset('');
    setAssessmentFormDirty(false);
    setAssessmentMessage('Edición cancelada.');
  }

  function addClient(event) {
    event.preventDefault();
    if (hasUnsavedChanges()) {
      if (!window.confirm('Hay cambios sin guardar. ¿Descartarlos y agregar otra ficha?')) return;
      resetUnsavedChanges();
    }
    const result = onAddClient?.({ fullName: newClientName, nationalId: newClientId });
    if (result?.error) {
      setClientFormMessage(result.error);
      return;
    }
    setClientFormMessage('Registro agregado localmente. Usa el mismo nombre y cédula en el acceso de cliente.');
    setNewClientName('');
    setNewClientId('');
    setSection('overview');
  }

  const tabItems = [['overview', 'Resumen'], ['routine', 'Rutinas'], ['attendance', 'Ingresos y asistencia'], ['assessment', 'Evaluaciones y medidas']];

  return <main className="trainer-desktop-page" hidden={!active}>
    <section className="trainer-page-heading">
      <div><span className="eyebrow">Panel de gestión deportiva · demostración</span><h1>Buen día, Eva.</h1><p>Seguimiento de tus clientes asignados y revisión de sus planes.</p></div>
      <span className="trainer-demo-tag">Modo demo: borradores ocultos; la aprobación se refleja solo en la interfaz demo del cliente seleccionado, nunca en el backend</span>
    </section>

    <section className="trainer-metrics-grid" aria-label="Resumen del panel">
      <article className="trainer-metric-card"><span>Personas registradas</span><strong>{clients.length}</strong><small>Registros ficticios locales</small></article>
      <article className="trainer-metric-card trainer-metric-card--review"><span>Rutinas por revisar</span><strong>{draft?.estado === 'borrador' ? '1' : '0'}</strong><small>{draft?.estado === 'borrador' ? 'Borrador pendiente' : 'Sin borradores pendientes'}</small></article>
      <article className="trainer-metric-card"><span>Sesión de hoy</span><strong>{hasApprovedPlan ? (sessionToday ? 'Asignada' : 'Sin sesión') : 'Pendiente'}</strong><small>{DAY_LABELS[todayIso]} · {hasApprovedPlan ? `plan ${approvedVersion}` : 'sin plan aprobado'}</small></article>
      <article className="trainer-metric-card trainer-metric-card--alerts"><span>Solicitudes pendientes</span><strong>{pendingRequests.length}</strong><small>Cola de asistencia local demo</small></article>
    </section>

    {pendingRequests[0] && <section className="trainer-assistance-banner">
      <div><span className="eyebrow">Solicitud de asistencia · turno 1</span><h2>{pendingRequests[0].atleta} necesita ayuda</h2><p>Ejercicio: {pendingRequests[0].ejercicio} · Estación: {pendingRequests[0].estacion} · Solo demostración local.</p></div>
      <button className="button button--dark" type="button" onClick={() => onAttend?.(pendingRequests[0].solicitudId)}>Marcar como atendida</button>
    </section>}

    <div className="trainer-dashboard-grid">
      <aside className="trainer-sidebar surface-card">
        <div className="card-heading"><h2>Mis clientes</h2><span>{clients.length} · demo local</span></div>
        <div className="trainer-client-list">{clients.map(client => <button key={client.id} className={`athlete-option ${selectedClient?.id === client.id ? 'is-active' : ''}`} type="button" aria-current={selectedClient?.id === client.id ? 'true' : undefined} onClick={() => selectClient(client.id)}><span className="avatar avatar--small" aria-hidden="true">{client.fullName.charAt(0)}</span><span><strong>{client.fullName}</strong><small>Entrenadora: {client.trainerName || 'Pendiente'} · {client.plan?.hasPlan ? `Rutina ${client.plan.approvedVersion}` : 'Plan pendiente'}</small></span><span aria-hidden="true">›</span></button>)}</div>
        <form className="trainer-new-client-form" onSubmit={addClient}>
          <h3>Agregar persona · demo local</h3>
          <label>Nombre y apellidos<input value={newClientName} onChange={event => setNewClientName(event.target.value)} autoComplete="off" required /></label>
          <label>Cédula asociada al registro<input value={newClientId} onChange={event => setNewClientId(event.target.value)} inputMode="numeric" pattern="[0-9]+" autoComplete="off" required /></label>
          {clientFormMessage && <p className="trainer-access-message" role="status">{clientFormMessage}</p>}
          <button className="button button--outline" type="submit">Agregar registro de demostración</button>
          <small>El nuevo registro queda en memoria mientras esta página siga abierta; no se envía ni se guarda en el servidor.</small>
        </form>
      </aside>

      <div className="trainer-main-column">
        <section className="surface-card athlete-summary"><div><span className="eyebrow">Ficha de atleta · caso ficticio</span><h2>{selectedClient?.fullName}</h2><p>Entrenadora asignada: {selectedClient?.trainerName || 'Pendiente'} · información de solo lectura para la cliente.</p></div><span className={hasApprovedPlan ? 'approved-chip' : 'pending-chip'}>{hasApprovedPlan ? `Rutina ${approvedVersion} vigente` : 'Plan pendiente de registro'}</span></section>
        <nav className="trainer-section-tabs" aria-label={`Secciones de la ficha de ${selectedClient?.fullName || 'cliente'}`}>
          {tabItems.map(([id, title]) => <button type="button" key={id} className={section === id ? 'is-active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => goToSection(id)}>{title}</button>)}
        </nav>

        {section === 'overview' && <div className="trainer-info-grid">
          <section className="surface-card trainer-record-section"><div className="card-heading"><h2>Perfil de entrenamiento</h2><span className="pending-chip">Datos demo</span></div><dl className="pending-fields">{[['Objetivo', profileData?.goal], ['Tiempo entrenando', profileData?.trainingDuration], ['Progreso del ciclo', profileData?.cycleProgress], ['Observaciones', profileData?.observations]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Pendiente'}</dd></div>)}</dl><form className="trainer-record-form" onSubmit={saveProfile}><label>Objetivo de entrenamiento<input value={profileDraft.goal} onChange={event => { setProfileDraft(current => ({ ...current, goal: event.target.value })); setProfileDirty(true); }} /></label><label>Tiempo entrenando<input value={profileDraft.trainingDuration} onChange={event => { setProfileDraft(current => ({ ...current, trainingDuration: event.target.value })); setProfileDirty(true); }} placeholder="Ej. 6 meses" /></label><label>Progreso del ciclo<input value={profileDraft.cycleProgress} onChange={event => { setProfileDraft(current => ({ ...current, cycleProgress: event.target.value })); setProfileDirty(true); }} /></label><label className="trainer-form-wide">Observaciones de entrenamiento<textarea rows="2" value={profileDraft.observations} onChange={event => { setProfileDraft(current => ({ ...current, observations: event.target.value })); setProfileDirty(true); }} /></label><div className="trainer-form-actions trainer-form-wide"><button className="button button--dark" type="submit">Guardar datos demo</button>{profileDirty && <button className="button button--outline" type="button" onClick={discardProfileChanges}>Descartar cambios</button>}</div>{profileMessage && <p className="trainer-form-message trainer-form-wide" role="status">{profileMessage}</p>}</form></section>
          <section className="surface-card"><div className="card-heading"><h2>Plan vigente</h2><span className={hasApprovedPlan ? 'approved-chip' : 'pending-chip'}>{hasApprovedPlan ? `${approvedVersion} · demo` : 'Pendiente de registro'}</span></div><p className="plan-days">{hasApprovedPlan ? dayNames(approvedDays).join(' · ') : 'Pendiente de asignación'}</p><p className="inline-note">{hasApprovedPlan ? `La rutina aprobada indica ${approvedDays.length} días de entrenamiento por semana. Los ejercicios de la prescripción aparecen cuando estén registrados.` : 'Esta persona aún no tiene un plan aprobado en la demostración.'}</p><button className="button button--dark" type="button" onClick={() => goToSection('routine')}>Revisar rutinas</button></section>
          <section className="surface-card"><div className="card-heading"><h2>Evaluación actual</h2><span className="pending-chip">{assessmentRecords.length ? `${assessmentRecords.length} registros demo` : 'Pendiente'}</span></div><p className="trainer-pending-copy">{assessmentRecords.length ? 'Consulta y administra los registros de evaluación en la sección de medidas.' : 'Aún no hay evaluaciones o medidas registradas.'}</p><button className="button button--outline" type="button" onClick={() => goToSection('assessment')}>Abrir evaluaciones</button></section>
        </div>}

        {section === 'routine' && <section className="surface-card trainer-routine-section">
          <div className="card-heading"><div><span className="eyebrow">Planificación supervisada</span><h2>Rutinas de {selectedClient?.fullName}</h2></div><span className={hasApprovedPlan ? 'approved-chip' : 'pending-chip'}>{hasApprovedPlan ? `Vigente: ${approvedVersion}` : 'Sin rutina aprobada'}</span></div>
          {hasApprovedPlan
            ? <div className="trainer-current-plan"><span>Rutina aprobada</span><strong>{dayNames(approvedDays).join(' · ')}</strong>{approvedRoutineDays?.length ? approvedRoutineDays.map(day => <small key={day.diaId}>{DAY_LABELS[day.diaSemana]}{day.enfoque ? ` · ${day.enfoque}` : ''}: {exerciseSummary(day.items)}</small>) : <small>Los ejercicios asignados y sus prescripciones están pendientes de registro.</small>}</div>
            : <p className="inline-note">Esta persona todavía no tiene una rutina; puedes preparar un plan inicial de demostración.</p>}
          {draft && <section className="comparison-card trainer-version-card">
            <div className="card-heading"><div><span className="eyebrow">Revisión · versión de demostración</span><h3>{draft.versionBaseId ? `${comparisonVersion} frente a ${draft.versionId.replace('DEMO-', '')}` : `Plan inicial ${draft.versionId.replace('DEMO-', '')}`}</h3></div><span className={draft.estado === 'borrador' ? 'pending-chip' : draft.estado === 'rechazado-demo' ? 'rejected-chip' : 'approved-chip'}>{draft.estado === 'borrador' ? `Borrador · revisión ${draft.revision}` : draft.estado === 'rechazado-demo' ? 'Rechazada en demo · no publicada' : 'Aprobada en demo · reflejada en cliente demo'}</span></div>
            <div className="version-comparison"><article><span>{comparisonVersion || 'Sin versión base'} · rutina actual</span><strong>{draft.versionBaseId ? dayNames(comparisonDays).join(' · ') : 'Sin rutina anterior'}</strong>{(draft.versionBaseRoutineDays || approvedRoutineDays)?.map(day => <small key={day.diaId}>{DAY_LABELS[day.diaSemana]}{day.enfoque ? ` · ${day.enfoque}` : ''}: {exerciseSummary(day.items)}</small>)}<small>Al aprobar, la rutina local se refleja en la interfaz demo del cliente; no se guarda en backend.</small></article><div className="comparison-arrow" aria-hidden="true">→</div><article className={draft.estado === 'borrador' ? 'draft-version' : ''}><span>{draft.versionId.replace('DEMO-', '')} · {draft.estado}</span><strong>{dayNames((draft.estado === 'borrador' ? draftDays : draft.dias.map(day => day.diaSemana))).join(' · ') || 'Días pendientes'}</strong>{(draft.estado === 'borrador' ? draftDays.map(day => ({ diaSemana: day, items: draftExercisesByDay[day] || draft.dias.find(item => item.diaSemana === day)?.items || [] })) : draft.dias).map(day => <small key={day.diaSemana}>{DAY_LABELS[day.diaSemana]}{day.enfoque ? ` · ${day.enfoque}` : ''}: {exerciseSummary(day.items)}</small>)}</article></div>
            {draft.estado === 'borrador' && <div className="draft-actions"><button className="button button--outline" type="button" onClick={() => editing ? closeDraftEditor() : beginEditingDraft()}>{editing ? 'Cerrar edición' : 'Editar días y ejercicios'}</button><button className="button button--outline" type="button" onClick={markRejected}>Marcar rechazada · demo</button><button className="button button--outline" type="button" onClick={() => { if (window.confirm('Descartar este borrador local?')) { setDraft(null); resetUnsavedChanges(); setEditing(false); setRoutineMessage(''); } }}>Descartar borrador</button><button className="button button--dark" type="button" disabled={!canApproveDraft} onClick={approveDraft}>Aprobar · demo</button></div>}
            {draft.estado === 'borrador' && !canApproveDraft && <p className="inline-note">Agrega y guarda al menos un ejercicio en cada día para habilitar la aprobación de demostración.</p>}
            {routineMessage && <p className="trainer-form-message" role="status">{routineMessage}</p>}
            {editing && draft.estado === 'borrador' && <div className="draft-editor"><h3>Editar borrador de rutina</h3><p>Los ejercicios creados aquí son ficticios locales; no pertenecen al catálogo confirmado y no se envían a la API.</p><div className="day-checkboxes">{Object.entries(DAY_LABELS).map(([day, label]) => <label key={day}><input type="checkbox" checked={draftDays.includes(Number(day))} onChange={event => toggleDraftDay(Number(day), event.target.checked)} />{label}</label>)}</div>{draftDays.map(day => { const items = draftExercisesByDay[day] || draft.dias.find(item => item.diaSemana === day)?.items || []; return <fieldset className="draft-day-exercises" key={day}><legend>{DAY_LABELS[day]} · ejercicios locales</legend><label className="trainer-form-wide">Enfoque de la sesión<input value={draftFocusByDay[day] || ''} onChange={event => { setDraftFocusByDay(current => ({ ...current, [day]: event.target.value })); setRoutineDirty(true); }} placeholder="Pendiente de definir" /></label>{items.map((exercise, index) => <article className="local-exercise-row" key={exercise.itemId}><div><strong>{exercise.nombre}</strong><span>{exercise.grupoMuscular} · {exercise.equipo}</span>{exercise.imagePreviewUrl && <img className="exercise-row-photo" src={exercise.imagePreviewUrl} alt={exercise.imageAlt || `Foto de ${exercise.nombre}`} />}{exercise.videoPreviewUrl && <video className="exercise-row-photo" src={exercise.videoPreviewUrl} muted loop playsInline controls aria-label={`Video de ${exercise.nombre}`} />}<small>{exercise.explicacion || 'Motivo pendiente'}</small><small>{exercise.series} × {exercise.objetivoPorSerie?.cantidad} {exercise.objetivoPorSerie?.unidad} · descanso {exercise.descansoSegundos ? `${exercise.descansoSegundos} s` : 'pendiente'} · carga {exercise.carga ? `${exercise.carga.valor} ${exercise.carga.unidad}` : 'pendiente'}</small><small className="local-catalog-warning">Ficticio local · no confirmado por catálogo</small></div><div className="local-exercise-actions"><button type="button" className="button button--outline" aria-label={`Mover ${exercise.nombre} arriba`} disabled={index === 0} onClick={() => moveExercise(day, index, -1)}>↑</button><button type="button" className="button button--outline" aria-label={`Mover ${exercise.nombre} abajo`} disabled={index === items.length - 1} onClick={() => moveExercise(day, index, 1)}>↓</button><button type="button" className="button button--outline" onClick={() => openExerciseForm(day, exercise)}>Editar</button><button type="button" className="button button--outline" onClick={() => removeExercise(day, exercise)}>Eliminar</button></div></article>)}<button type="button" className="button button--outline local-add-exercise" onClick={() => openExerciseForm(day)}>Agregar ejercicio local</button>{exerciseFormDay === day && <form className="trainer-record-form local-exercise-form" onSubmit={saveExercise}>
                <label>Nombre<input required value={exerciseForm.nombre} onChange={event => { setExerciseForm(current => ({ ...current, nombre: event.target.value })); setExerciseFormDirty(true); }} /></label><label>Grupo muscular<input required value={exerciseForm.grupoMuscular} onChange={event => { setExerciseForm(current => ({ ...current, grupoMuscular: event.target.value })); setExerciseFormDirty(true); }} /></label><label>Equipo o estación<input required value={exerciseForm.equipo} onChange={event => { setExerciseForm(current => ({ ...current, equipo: event.target.value })); setExerciseFormDirty(true); }} /></label><label>Series<input required type="number" min="1" step="1" value={exerciseForm.series} onChange={event => { setExerciseForm(current => ({ ...current, series: event.target.value })); setExerciseFormDirty(true); }} /></label><label>Objetivo por serie<input required type="number" min="1" step="1" value={exerciseForm.objetivo} onChange={event => { setExerciseForm(current => ({ ...current, objetivo: event.target.value })); setExerciseFormDirty(true); }} /></label><label>Unidad del objetivo<select value={exerciseForm.unidad} onChange={event => { setExerciseForm(current => ({ ...current, unidad: event.target.value })); setExerciseFormDirty(true); }}><option value="repeticiones">Repeticiones</option><option value="segundos">Segundos</option></select></label><label>Descanso (segundos)<input type="number" min="0" step="1" value={exerciseForm.descansoSegundos} onChange={event => { setExerciseForm(current => ({ ...current, descansoSegundos: event.target.value })); setExerciseFormDirty(true); }} placeholder="Pendiente" /></label><label>Carga<input type="number" min="0" step="any" value={exerciseForm.carga} onChange={event => { setExerciseForm(current => ({ ...current, carga: event.target.value })); setExerciseFormDirty(true); }} placeholder="Pendiente" /></label><label>Unidad de carga<input value={exerciseForm.unidadCarga} onChange={event => { setExerciseForm(current => ({ ...current, unidadCarga: event.target.value })); setExerciseFormDirty(true); }} placeholder="kg, lb…" /></label><label className="trainer-form-wide">Motivo o explicación visible<textarea rows="2" value={exerciseForm.explicacion} onChange={event => { setExerciseForm(current => ({ ...current, explicacion: event.target.value })); setExerciseFormDirty(true); }} /></label><section className="trainer-form-wide exercise-photo-editor"><label>Foto o video del ejercicio<input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={selectExerciseMedia} /></label><small>Vista previa local demo. Imagen: máximo 5 MB. Video: máximo 25 MB. No se guarda al recargar.</small>{exerciseForm.imagePreviewUrl && <div className="exercise-photo-preview"><img src={exerciseForm.imagePreviewUrl} alt={exerciseForm.imageAlt || "Vista previa pendiente de texto alternativo"} /><label>Texto alternativo de la foto<input required value={exerciseForm.imageAlt} onChange={event => { setExerciseForm(current => ({ ...current, imageAlt: event.target.value })); setExerciseFormDirty(true); setPhotoError(''); }} placeholder="Describe brevemente la imagen" /></label><button className="button button--outline" type="button" onClick={removeExerciseMedia}>Quitar medio</button></div>}{exerciseForm.videoPreviewUrl && <div className="exercise-photo-preview"><video src={exerciseForm.videoPreviewUrl} controls muted loop playsInline preload="metadata" aria-label={`Video del ejercicio ${exerciseForm.nombre || 'seleccionado'}`} /><button className="button button--outline" type="button" onClick={removeExerciseMedia}>Quitar medio</button></div>}{photoError && <p className="trainer-form-message" role="alert">{photoError}</p>}</section><p className="trainer-form-message trainer-form-wide" role="note">Este ejercicio es solo demostrativo. No se puede presentar como validado por el catálogo compartido.</p><div className="trainer-form-actions trainer-form-wide"><button className="button button--dark" type="submit">{editingExerciseId ? 'Actualizar ejercicio local' : 'Añadir ejercicio local'}</button><button className="button button--outline" type="button" onClick={closeExerciseForm}>Cancelar</button></div>
              </form>}</fieldset>; })}<div className="trainer-form-actions"><button className="button button--dark" type="button" disabled={!draftDays.length} onClick={saveDraftDays}>Guardar borrador local</button></div></div>}
            <p className="demo-notice">Modo demo: los borradores quedan ocultos al cliente. Al aprobar, se reflejan solo en su interfaz de demostración; nada se guarda en el backend.</p>
          </section>}
          {draft?.historialDemo?.length > 0 && <section className="surface-card trainer-record-section"><div className="card-heading"><h3>Versiones anteriores · demo</h3><span className="pending-chip">Solo local</span></div><ul className="trainer-record-list">{[...draft.historialDemo].reverse().map(version => <li key={version.versionId}><div><strong>{version.versionId.replace('DEMO-', '')} · {version.estado}</strong><span>{dayNames(version.dias?.map(day => day.diaSemana)).join(' · ') || 'Días pendientes'} · {version.dias?.reduce((total, day) => total + (day.items?.length || 0), 0) || 0} ejercicios</span></div></li>)}</ul></section>}
          {(!draft || draft.estado !== 'borrador') && <section className="empty-proposal"><h3>{draft ? 'Crear otra propuesta local' : hasApprovedPlan ? 'Prepara una propuesta' : 'Prepara un plan inicial'}</h3><p>Los ejercicios del catálogo compartido aún no están integrados. Puedes crear ejercicios ficticios para revisar el editor; no afectan la rutina de Ana.</p><button className="button button--dark" type="button" disabled={busy} onClick={createDraft}>{busy ? 'Preparando…' : 'Crear borrador · demo'}</button><small>El borrador se conserva en memoria mientras siga abierta esta demostración.</small></section>}
        </section>}

        {section === 'attendance' && <section className="surface-card trainer-record-section">
          <div className="card-heading"><div><span className="eyebrow">Control de ingresos</span><h2>Asistencia de {selectedClient?.fullName}</h2></div><span className="pending-chip">Registro demo local</span></div>
          <form key={selectedClient?.id} className="trainer-record-form" onChange={() => setAttendanceFormDirty(true)} onSubmit={submitAttendance}>
            <label>Tipo de registro<select name="type" required defaultValue=""><option value="" disabled>Seleccionar</option><option>Asistencia</option><option>Visita al gimnasio</option></select></label>
            <label>Fecha<input name="date" type="date" defaultValue={localDate()} required /></label>
            <label>Hora<input name="time" type="time" defaultValue={new Date().toTimeString().slice(0, 5)} required /></label>
            <label>Estado<select name="status" required defaultValue=""><option value="" disabled>Seleccionar estado</option><option>Asistió</option><option>No asistió</option><option>Visita registrada</option></select></label>
            <label className="trainer-form-wide">Nota breve<textarea name="note" rows="2" placeholder="Opcional" /></label>
            <button className="button button--dark" type="submit">Registrar en modo demo</button>
            {attendanceMessage && <p className="trainer-form-message trainer-form-wide" role="status">{attendanceMessage}</p>}
          </form>
          <div className="trainer-empty-history"><h3>Historial de asistencia y visitas</h3>{attendanceRecords.length ? <ul className="trainer-record-list">{[...attendanceRecords].reverse().map(record => <li key={record.id}><div><strong>{record.type} · {record.status}</strong><span>{record.date} · {record.time}</span>{record.note && <small>{record.note}</small>}</div><button type="button" className="button button--outline" onClick={() => { if (window.confirm('Eliminar este registro local de asistencia?')) onDeleteAttendance?.(record.id); }}>Eliminar</button></li>)}</ul> : <p>Pendiente. Aún no se han registrado visitas en esta demostración.</p>}</div>
          <p className="demo-notice">Estos registros solo viven en el estado local de la demostración.</p>
        </section>}

        {section === 'assessment' && <section className="trainer-record-section">
          <div className="surface-card trainer-assessment-intro"><div><span className="eyebrow">Seguimiento del proceso</span><h2>Evaluaciones y medidas de {selectedClient?.fullName}</h2><p>Registra solo datos disponibles y su procedencia. No son diagnósticos médicos.</p></div><span className="pending-chip">{assessmentRecords.length ? `${assessmentRecords.length} entradas demo` : 'Pendiente'}</span></div>
          <div className="trainer-measurement-grid">
            {MEASUREMENT_GROUPS.map(group => {
              const records = assessmentRecords.filter(record => record.category === group);
              const selectedRecord = assessmentRecords.find(record => record.id === editingAssessmentId && record.category === group);
              return <article className="surface-card trainer-measurement-card" key={group}>
                <h3>{group}</h3>
                {records.length ? <ul className="trainer-measure-history">{[...records].reverse().map(record => <li key={record.id}>
                  <strong>{record.name}: {record.value}{record.unit ? ` ${record.unit}` : ''}</strong>
                  {record.area && <span>Tipo: {record.area}</span>}{record.side && <span>Lado: {record.side}</span>}
                  <span>Fecha: {record.date} · Origen: {record.source}</span>{record.notes && <small>{record.notes}</small>}
                  <button type="button" className="button button--outline measurement-edit-button" onClick={() => editAssessment(record)}>Editar evaluación</button>
                </li>)}</ul> : <><strong>Pendiente de medición</strong><p>Aún no hay datos registrados en esta categoría.</p></>}
                <button type="button" className="button button--outline measurement-edit-button" onClick={() => beginAssessmentEntry(group)}>{records.length ? 'Añadir otro registro' : 'Registrar medición'}</button>
                {assessmentCategoryPreset === group && <AssessmentEntryForm key={`${group}-${editingAssessmentId || 'new'}`} category={group} record={selectedRecord} onChange={() => setAssessmentFormDirty(true)} onSubmit={submitAssessment} onCancel={cancelAssessmentEdit} />}
              </article>;
            })}
          </div>          <section className="surface-card trainer-record-editor">            <div className="trainer-empty-history"><h3>Historial completo</h3>{assessmentRecords.length ? <ul className="trainer-record-list">{[...assessmentRecords].reverse().map(record => <li key={record.id}><div><strong>{record.category} · {record.name}</strong><span>{record.value} {record.unit} · {record.date} · {record.source}</span>{record.notes && <small>{record.notes}</small>}</div><div className="local-exercise-actions"><button type="button" className="button button--outline" onClick={() => editAssessment(record)}>Editar</button><button type="button" className="button button--outline" onClick={() => { if (window.confirm('Eliminar esta medida o evaluación local?')) onDeleteAssessment?.(record.id); }}>Eliminar</button></div></li>)}</ul> : <p>Pendiente. No hay registros anteriores.</p>}</div>
          </section>
          <p className="demo-notice">Los valores agregados son datos que Eva introduce para probar esta interfaz; no se sincronizan con el perfil de cliente.</p>
        </section>}
      </div>
    </div>
  </main>;
}
