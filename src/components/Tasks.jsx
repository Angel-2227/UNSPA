import { useEffect, useRef, useState } from 'react';
import { todayStr } from '../lib/plan';
import { semLabel } from '../lib/double';

const PRIO = { 1: { label: 'Urgente', icon: '🔥' }, 2: { label: 'Alta', icon: '⚡' }, 3: { label: 'Media', icon: '📘' }, 4: { label: 'Baja', icon: '🌿' } };
const TTL = 30 * 24 * 60 * 60 * 1000; // las completadas se borran a los 30 días
const genId = () => 'tk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fmtDue(s) {
  if (!s) return null;
  const days = Math.ceil((new Date(s + 'T23:59:59') - new Date()) / 86400000);
  if (days < 0) return { label: `Venció hace ${Math.abs(days)}d`, cls: 'overdue' };
  if (days === 0) return { label: 'Hoy 🔔', cls: 'today' };
  if (days === 1) return { label: 'Mañana', cls: 'soon' };
  if (days <= 5) return { label: `En ${days} días`, cls: 'soon' };
  return { label: new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }), cls: '' };
}

function TaskModal({ task, subjects, onSave, onClose, label }) {
  const [f, setF] = useState({ title: '', description: '', subjectId: '', priority: 2, due: '', ...(task || {}) });
  const [err, setErr] = useState(false), ref = useRef();
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 300); const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => { clearTimeout(t); removeEventListener('keydown', k); }; }, [onClose]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <div id="tkModal" className="open" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="tk-modal-sheet">
        <div className="tk-modal-handle" />
        <div className="tk-modal-title">{task ? '✏️ Editar tarea' : '📝 Nueva tarea'}</div>
        <div className="tk-form-group"><label className="tk-label">Título <span style={{ color: 'var(--unal-red)' }}>*</span></label>
          <input ref={ref} className="tk-input" style={err ? { borderColor: '#ef5350' } : null} placeholder="ej: Parcial 2 capítulos 4-7" maxLength={120} autoComplete="off" value={f.title} onChange={e => { set('title', e.target.value); setErr(false); }} /></div>
        <div className="tk-form-group"><label className="tk-label">Materia</label>
          <select className="tk-select" value={f.subjectId || ''} onChange={e => set('subjectId', e.target.value)}>
            <option value="">— Sin materia específica —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({label(s.semester)})</option>)}</select></div>
        <div className="tk-form-group"><label className="tk-label">Prioridad</label>
          <div className="tk-priority-grid">{[1, 2, 3, 4].map(p => <div key={p} className={'tk-prio-option' + (f.priority === p ? ' selected-prio' : '')} data-value={p} onClick={() => set('priority', p)}><span className="tk-prio-icon">{PRIO[p].icon}</span><span className="tk-prio-label">{PRIO[p].label}</span></div>)}</div></div>
        <div className="tk-form-group"><label className="tk-label">Fecha límite (opcional)</label>
          <input className="tk-input" type="date" min={todayStr()} value={f.due || ''} onChange={e => set('due', e.target.value)} /></div>
        <div className="tk-form-group"><label className="tk-label">Descripción / notas (opcional)</label>
          <textarea className="tk-textarea" placeholder="Detalles, páginas, recursos..." value={f.description || ''} onChange={e => set('description', e.target.value)} /></div>
        <div className="tk-modal-actions">
          <button className="tk-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="tk-btn-save" onClick={() => { if (!f.title.trim()) { setErr(true); ref.current?.focus(); return; } onSave({ ...f, title: f.title.trim(), description: (f.description || '').trim() }); }}>{task ? '💾 Guardar cambios' : '➕ Agregar tarea'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Tasks({ data, update }) {
  const tasks = data.acadTasks || [], plan = data.studyPlan || {};
  const [filter, setFilter] = useState('all'), [sort, setSort] = useState('priority'), [showDone, setShowDone] = useState(false);
  const [modal, setModal] = useState(null), [groups, setGroups] = useState({}), [fx, setFx] = useState({}), [toast, setToast] = useState('');
  const tt = useRef();
  const say = m => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(''), 2800); };
  const save = list => update({ acadTasks: list });

  // Auto-limpieza de completadas > 30 días
  useEffect(() => {
    const keep = tasks.filter(t => !t.done || (t.doneAt || 0) > Date.now() - TTL);
    if (keep.length !== tasks.length) update({ acadTasks: keep });
    // eslint-disable-next-line
  }, []);

  // Materias del semestre actual (si no hay, todas)
  let subjects = [];
  Object.entries(plan).forEach(([n, s]) => { if (s.status === 'current') s.subjects.forEach(x => subjects.push({ id: x.id, name: x.name, semester: n })); });
  if (!subjects.length) Object.entries(plan).forEach(([n, s]) => s.subjects.forEach(x => subjects.push({ id: x.id, name: x.name, semester: n })));
  const allSubjects = {};
  Object.entries(plan).forEach(([n, s]) => s.subjects.forEach(x => { allSubjects[x.id] = { id: x.id, name: x.name, semester: n }; }));

  const today = todayStr(), pending = tasks.filter(t => !t.done);
  const stats = { total: pending.length, urgent: pending.filter(t => t.priority === 1).length, dueToday: pending.filter(t => t.due === today).length, overdue: pending.filter(t => t.due && t.due < today).length, done: tasks.length - pending.length };

  let vis = pending.filter(t => filter === 'today' ? t.due === today : ['1', '2', '3', '4'].includes(filter) ? String(t.priority) === filter : true);
  const cmpDue = (a, b) => (a.due && b.due ? new Date(a.due) - new Date(b.due) : a.due ? -1 : b.due ? 1 : 0);
  vis = [...vis].sort((a, b) => {
    if (sort === 'priority') return a.priority - b.priority || cmpDue(a, b) || b.createdAt - a.createdAt;
    if (sort === 'due') return cmpDue(a, b) || a.priority - b.priority;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const doneTasks = tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  const grouped = {};
  vis.forEach(t => { const k = t.subjectId || '__general__'; (grouped[k] ||= { subject: allSubjects[k] || { id: k, name: k === '__general__' ? 'General' : 'Materia eliminada', semester: '' }, tasks: [] }).tasks.push(t); });
  const entries = Object.entries(grouped);

  const toggle = t => {
    if (!t.done) {
      setFx(x => ({ ...x, [t.id]: 'checking' }));
      setTimeout(() => { save(tasks.map(x => (x.id === t.id ? { ...x, done: true, doneAt: Date.now() } : x))); setFx(x => ({ ...x, [t.id]: null })); say('✅ Tarea completada · Se borrará en 30 días'); }, 350);
    } else { save(tasks.map(x => (x.id === t.id ? { ...x, done: false, doneAt: null } : x))); say('↩️ Tarea restaurada'); }
  };
  const del = t => { setFx(x => ({ ...x, [t.id]: 'vanishing' })); setTimeout(() => { save(tasks.filter(x => x.id !== t.id)); setFx(x => ({ ...x, [t.id]: null })); }, 300); };
  const onSave = f => {
    if (modal.task) { save(tasks.map(t => (t.id === modal.task.id ? { ...t, ...f } : t))); say('✏️ Tarea actualizada'); }
    else { save([{ id: genId(), ...f, priority: +f.priority, done: false, doneAt: null, createdAt: Date.now() }, ...tasks]); say('✅ Tarea agregada'); }
    setModal(null);
  };

  const Card = ({ t, isDone }) => {
    const due = fmtDue(t.due), p = PRIO[t.priority] || PRIO[3];
    return (
      <div className={'tk-task-card' + (t.done ? ' done' : '') + (fx[t.id] === 'vanishing' ? ' vanishing' : '')} data-priority={t.priority}>
        <div className={'tk-check' + (t.done ? ' checked' : '') + (fx[t.id] === 'checking' ? ' checking' : '')} onClick={() => toggle(t)} title={t.done ? 'Marcar como pendiente' : 'Marcar como completada'}>{t.done ? '✓' : ''}</div>
        <div className="tk-task-body">
          <div className="tk-task-title">{t.title}</div>
          <div className="tk-task-meta"><span className="tk-priority-badge" data-priority={t.priority}>{p.icon} {p.label}</span>{due && <span className={'tk-due-badge ' + due.cls}>📅 {due.label}</span>}</div>
          {t.description && <div className="tk-task-desc">{t.description}</div>}
        </div>
        {!isDone && <div className="tk-task-actions">
          <button className="tk-icon-btn" title="Editar" onClick={() => setModal({ task: t })}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
          <button className="tk-icon-btn delete" title="Eliminar" onClick={() => del(t)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg></button>
        </div>}
      </div>
    );
  };
  const chip = (k, label, dot) => <button className={'tk-filter-chip' + (filter === k ? ' active' : '')} onClick={() => setFilter(k)}>{dot && <span className="tk-chip-dot" style={{ background: dot }} />} {label}</button>;

  return (
    <>
      <div className="header-bar"><div className="header-controls"><div>
        <h2 style={{ marginBottom: 4 }}>Mis Tareas</h2>
        <p className="text-secondary" style={{ fontSize: '.85rem' }}>Organiza tus entregas · Prioridades · Auto-limpieza a los 30 días</p></div></div></div>

      <div className="tk-summary-bar">
        <div className={'tk-summary-pill' + (stats.urgent > 0 ? ' urgent' : '')}>🔥 <strong>{stats.urgent}</strong> urgentes</div>
        <div className={'tk-summary-pill' + (stats.dueToday > 0 ? ' today' : '')}>📅 <strong>{stats.dueToday}</strong> para hoy</div>
        {stats.overdue > 0 && <div className="tk-summary-pill urgent">⚠️ <strong>{stats.overdue}</strong> vencida{stats.overdue > 1 ? 's' : ''}</div>}
        <div className="tk-summary-pill">✅ <strong>{stats.done}</strong> completada{stats.done !== 1 ? 's' : ''}</div>
      </div>
      <div className="tk-topbar">
        <div className="tk-topbar-left">
          <button className={'tk-filter-chip' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>Todas <span style={{ fontSize: '.72rem', opacity: .8 }}>{stats.total}</span></button>
          {chip('1', 'Urgente', '#ef5350')}{chip('2', 'Alta', '#ffa000')}{chip('3', 'Media', '#1976d2')}{chip('today', '📅 Hoy')}
        </div>
        <button className="tk-add-btn" onClick={() => setModal({ task: null })}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Nueva tarea</button>
      </div>
      <div className="tk-sort-bar"><span className="tk-sort-label">Ordenar:</span>
        {[['priority', 'Prioridad'], ['due', 'Fecha límite'], ['created', 'Recientes']].map(([k, l]) => <button key={k} className={'tk-sort-chip' + (sort === k ? ' active' : '')} onClick={() => setSort(k)}>{l}</button>)}</div>

      <div>
        {!entries.length ? <div className="tk-empty"><span className="tk-empty-icon">📝</span><h3>{filter === 'today' ? 'Ninguna tarea para hoy 🎉' : 'Sin tareas pendientes'}</h3><p>{filter !== 'all' && 'Prueba otro filtro o '}Toca <strong>Nueva tarea</strong> para agregar una.</p></div>
          : entries.map(([key, { subject, tasks: ts }], idx) => {
            const isOpen = key in groups ? groups[key] : idx < 4;
            return (
              <div key={key} className="tk-subject-group">
                <div className="tk-subject-header" onClick={() => setGroups({ ...groups, [key]: !isOpen })}>
                  <div className="tk-subject-title">📚 {subject.name}{subject.semester && <span className="tk-subject-sem">{semLabel(data, subject.semester)}</span>}</div>
                  <div className="tk-subject-meta"><span className={'tk-task-count' + (ts.some(t => t.priority === 1) ? ' has-urgent' : '')}>{ts.length} tarea{ts.length !== 1 ? 's' : ''}</span><span className={'tk-subject-chevron' + (isOpen ? ' open' : '')}>▶</span></div>
                </div>
                <div className={'tk-task-list' + (isOpen ? ' open' : '')}>{ts.map(t => <Card key={t.id} t={t} />)}</div>
              </div>);
          })}
      </div>

      {doneTasks.length > 0 && <div className="tk-done-section">
        <button className="tk-done-toggle" onClick={() => setShowDone(!showDone)}>{showDone ? '▼' : '▶'} Completadas ({doneTasks.length}) — se borran automáticamente a los 30 días</button>
        <div className={'tk-done-list' + (showDone ? ' open' : '')}>{doneTasks.map(t => <Card key={t.id} t={t} isDone />)}</div>
      </div>}

      {modal && <TaskModal label={k => semLabel(data, k)} task={modal.task} subjects={subjects} onSave={onSave} onClose={() => setModal(null)} />}
      <div className={'tk-toast' + (toast ? ' show' : '')}>{toast}</div>
    </>
  );
}
