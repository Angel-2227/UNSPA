import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import Modal from './Modal';
import SubjectModal from './SubjectModal';
import { ScheduleViewer } from './Schedule';
import { parseCSV, exportCSV, uid, typeClass, STATUS, planCredits, todayStr, norm } from '../lib/plan';
import { overallAvg, ensureGrades, gColor, moveGrade, renameGrade } from '../lib/grades';

const blankSem = { subjects: [], status: 'pending' };

export default function Overview({ data, update, user, focus, goTasks, toggleTheme, logout }) {
  const { studyPlan: plan, config, subjectBank: bank = [], schedules = [], acadTasks: tasks = [] } = data;
  const [open, setOpen] = useState(null);           // acordeón: un semestre abierto a la vez
  const [addTo, setAddTo] = useState(null);         // modal "agregar materia al semestre"
  const [editing, setEditing] = useState(null);     // { sem, subject }
  const [viewSch, setViewSch] = useState(false);
  const [fab, setFab] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [moving, setMoving] = useState(null);       // { from, idx }
  const [q, setQ] = useState('');

  const nums = Object.keys(plan).sort((a, b) => a - b);
  const g = useMemo(() => ensureGrades(plan, data.gradesData || {}, bank), [plan, data.gradesData, bank]);
  let done = 0, cur = 0;
  nums.forEach(n => { if (plan[n].status === 'completed') done += planCredits(plan[n]); if (plan[n].status === 'current') cur += planCredits(plan[n]); });
  const total = config.totalCredits || 1;
  const avg = overallAvg(plan, g);

  // Tareas
  const pend = tasks.filter(t => !t.done), today = todayStr();
  const urgent = pend.filter(t => t.priority === 1).length, overdue = pend.filter(t => t.due && t.due < today).length, dueToday = pend.filter(t => t.due === today).length;

  useEffect(() => {
    if (!focus) return;
    setOpen(String(focus.n));
    const t = setTimeout(() => document.getElementById('semester-' + focus.n)?.scrollIntoView({ behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
  }, [focus]);
  useEffect(() => { const k = e => e.key === 'Escape' && setFab(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);

  const patchSem = (n, p) => update({ studyPlan: { ...plan, [n]: { ...plan[n], ...p } } });
  const inPlan = name => Object.values(plan).some(s => s.subjects.some(x => norm(x.name) === norm(name)));

  function addSubject(n, b) {
    const { horariosInfo, ...s } = b;
    patchSem(n, { subjects: [...plan[n].subjects, s] });
    setAddTo(null);
  }
  function removeSubject(n, i) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta materia del semestre?')) return;
    patchSem(n, { subjects: plan[n].subjects.filter((_, j) => j !== i) });
  }
  function moveSub(from, i, to) {
    const s = plan[from].subjects[i];
    update({
      studyPlan: { ...plan, [from]: { ...plan[from], subjects: plan[from].subjects.filter((_, j) => j !== i) }, [to]: { ...(plan[to] || blankSem), subjects: [...(plan[to]?.subjects || []), s] } },
      gradesData: moveGrade(g, from, to, s.name)
    });
    setMoving(null); setMoveMode(false);
  }
  function saveSubject(old, s) { // edita en el plan y en el banco (por id o nombre) y conserva las notas si cambia el nombre
    const match = x => x.id === old.id || x.name === old.name;
    const merge = x => ({ ...x, ...s, id: x.id });
    update({
      studyPlan: Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, { ...v, subjects: v.subjects.map(x => (match(x) ? merge(x) : x)) }])),
      subjectBank: bank.map(x => (match(x) ? merge(x) : x)),
      gradesData: renameGrade(g, old.name, s.name)
    });
    setEditing(null);
  }
  function addSemester() {
    const all = nums.map(Number), empty = all.filter(n => !plan[n].subjects?.length);
    let n;
    if (empty.length) { n = empty[0]; alert(`Activando Semestre ${n} (estaba vacío)`); }
    else { n = all.length ? Math.max(...all) + 1 : 1; update({ studyPlan: { ...plan, [n]: { ...blankSem } } }); }
    setOpen(String(n));
    setTimeout(() => confirm(`¿Deseas añadir una materia al Semestre ${n}?`) && setAddTo(String(n)), 100);
  }
  function onCSV(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    Papa.parse(f, { header: false, complete: ({ data: rows }) => {
      const { plan: np, total: t, types } = parseCSV(rows, plan);
      if (!Object.keys(np).length) return alert('No se encontraron semestres en el CSV.');
      if (nums.length && !confirm('Esto reemplaza tu plan actual (conserva las notas y los datos de las materias que ya existían). ¿Continuar?')) return;
      const names = new Set(bank.map(s => norm(s.name))), nb = [...bank];
      Object.values(np).forEach(s => s.subjects.forEach(x => { if (!names.has(norm(x.name))) { names.add(norm(x.name)); nb.push({ ...x, id: uid() }); } }));
      update({ studyPlan: np, subjectBank: nb, config: { ...config, totalCredits: t, creditsByType: types, programName: config.programName || 'Plan de Estudios', university: config.university || 'Universidad' } });
    } });
  }

  function headerClick(n) {
    if (moveMode && moving && String(moving.from) !== String(n)) {
      const s = plan[moving.from].subjects[moving.idx];
      if (confirm(`¿Mover "${s.name}" del Semestre ${moving.from} al Semestre ${n}?`)) moveSub(moving.from, moving.idx, n);
      return;
    }
    setOpen(open === n ? null : n);
  }
  const startMove = (n, i) => { setMoveMode(true); setMoving({ from: n, idx: i }); setOpen(n); };
  const toggleMove = () => { setMoveMode(m => !m); setMoving(null); setFab(false); };

  const stat = (v, l, cls, style) => <div className="stat-card"><div className={'stat-number ' + (cls || '')} style={style}>{v}</div><div className="stat-label">{l}</div></div>;
  const none = <em style={{ color: 'var(--text-secondary)' }}>—</em>;
  const lastSchedule = [...schedules].reverse().find(s => !s.archived) || schedules[schedules.length - 1];
  const fabItem = (icon, label, onClick, extra) => <button className="fab-menu-item" onClick={() => { onClick?.(); setFab(false); }} {...extra}><span className="fab-item-icon">{icon}</span><span className="fab-item-label">{label}</span></button>;

  return (
    <>
      <div className="header-bar overview-header-bar">
        <div className="overview-title-block"><h2>Plan de Estudios</h2><p className="text-secondary">{config.programName || 'Plan de Estudios'} - {config.university || 'Universidad'}</p></div>
        <div className="overview-fab-wrapper">
          <button className={'overview-fab-btn' + (fab ? ' is-open' : '')} onClick={() => setFab(!fab)} aria-label="Acciones" title="Acciones">
            <span className="fab-icon">{fab ? '✕' : '⚙️'}</span>
          </button>
          <div className={'overview-fab-menu' + (fab ? ' is-open' : '')}>
            <label className="fab-menu-item" style={{ cursor: 'pointer' }}>
              <span className="fab-item-icon">📁</span><span className="fab-item-label">Cargar CSV</span>
              <input type="file" accept=".csv" hidden onChange={e => { onCSV(e); setFab(false); }} />
            </label>
            {fabItem('📥', 'Exportar', () => exportCSV(plan, config))}
            {fabItem('🌓', 'Cambiar tema', toggleTheme)}
            {fabItem('➕', 'Nuevo Semestre', addSemester)}
            <button className="fab-menu-item" onClick={toggleMove}><span className="fab-item-icon">{moveMode ? '❌' : '🔄'}</span><span className="fab-item-label">{moveMode ? 'Cancelar mover' : 'Mover Materias'}</span></button>
            <a href="https://cronograma-26-1.pages.dev/" className="fab-menu-item" target="_blank" rel="noreferrer" onClick={() => setFab(false)}><span className="fab-item-icon">📅</span><span className="fab-item-label">Consulta Cronograma</span></a>
            <div className="fab-menu-divider" />
            <div className="fab-menu-user">
              <div className="fab-user-row">
                {user.photoURL && <img src={user.photoURL} alt="" className="fab-user-avatar" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                <div className="fab-user-details"><span className="fab-user-name">{user.displayName || user.email || 'Usuario'}</span><button onClick={logout} className="fab-user-logout">Cerrar sesión</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {fab && <div className="fab-overlay is-open" onClick={() => setFab(false)} />}

      {lastSchedule && <button className="btn btn-primary" style={{ marginBottom: 12 }} onClick={() => setViewSch(true)}>📅 Ver Mi Horario</button>}

      <div className="stats-summary">
        {stat(config.totalCredits || 0, 'Total Requeridos', 'total')}
        {stat(done, 'Completados', 'completed')}
        {stat(cur, 'Cursando', 'current')}
        {stat(Math.max(0, total - done - cur), 'Pendientes', 'pending')}
        {stat(Math.round((done / total) * 100) + '%', 'Progreso', '', { color: 'var(--unal-blue)' })}
        {stat(avg !== null ? avg.toFixed(2) : 'N/A', 'Promedio', '', { color: avg !== null ? gColor(avg) : 'var(--text-secondary)', fontSize: avg !== null ? undefined : '1rem' })}
        <div className="stat-card" onClick={goTasks} style={{ cursor: 'pointer' }} title="Ver Tareas">
          <div className="stat-number" style={{ color: 'var(--unal-green)' }}>{pend.length}</div>
          <div className="stat-label">Tareas Pendientes</div>
          <div className="tasks-stat-sub" style={{ fontSize: '.72rem', marginTop: 4, lineHeight: 1.4, minHeight: 18 }}>
            {urgent + overdue + dueToday === 0 ? <span style={{ color: 'var(--text-secondary)' }}>Sin pendientes urgentes</span> : <>
              {urgent > 0 && <span style={{ color: 'var(--unal-red)' }}>🔥 {urgent} urgente{urgent > 1 ? 's' : ''}</span>}
              {overdue > 0 && <>{urgent > 0 && ' · '}<span style={{ color: '#e65100' }}>⚠️ {overdue} vencida{overdue > 1 ? 's' : ''}</span></>}
              {dueToday > 0 && <>{urgent + overdue > 0 && ' · '}<span style={{ color: 'var(--unal-green)' }}>📅 {dueToday} hoy</span></>}</>}
          </div>
        </div>
      </div>

      <div className={'semesters-grid' + (moveMode ? ' move-mode' : '')}>
        {moveMode && <div className="move-instructions" style={{ gridColumn: '1 / -1' }}>📋 Modo Mover Materias: Haz clic en 🔄 de una materia para seleccionarla, luego haz clic en el encabezado del semestre destino.</div>}
        {!nums.length && (
          <div className="no-data" style={{ gridColumn: '1 / -1' }}>
            <h3>Bienvenido al Sistema de Planificación Académica</h3><p>Importa tu archivo CSV para comenzar (menú ⚙️ → Cargar CSV)</p>
            <p style={{ marginTop: 12 }}>El sistema detectará automáticamente:</p>
            <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: 8 }}><li>Total de créditos del plan</li><li>Materias y sus tipologías</li><li>Distribución por semestres</li></ul>
          </div>)}
        {nums.map(n => {
          const s = plan[n], isOpen = open === n;
          return (
            <div key={n} id={'semester-' + n} className={'semester-card ' + (s.status || 'pending')}>
              <div className="semester-header" onClick={() => headerClick(n)}>
                <div>
                  <div className="semester-title"><span className={'semester-status status-' + (s.status || 'pending')}>{STATUS[s.status] || 'Pendiente'}</span>Semestre {n}</div>
                  <div className="semester-summary">{s.subjects.length} materias • {planCredits(s)} créditos</div>
                </div>
                <div className="semester-controls">
                  <select className="btn btn-sm" value={s.status} onClick={e => e.stopPropagation()} onChange={e => patchSem(n, { status: e.target.value })}>
                    <option value="pending">Pendiente</option><option value="current">Cursando</option><option value="completed">Completado</option>
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setAddTo(n); }}>+ Agregar</button>
                  <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); if (confirm(s.subjects.length ? `¿Estás seguro de eliminar el Semestre ${n}? Tiene ${s.subjects.length} materias que se perderán.` : `¿Eliminar el Semestre ${n}?`)) { const p = { ...plan }; delete p[n]; update({ studyPlan: p }); } }}>🗑️</button>
                  <span className={'semester-toggle' + (isOpen ? ' expanded' : '')}>{isOpen ? '▼' : '▶'}</span>
                </div>
              </div>
              <div className={'semester-content' + (isOpen ? ' expanded' : '')} style={isOpen ? { maxHeight: 'none' } : null}>
                <div className="semester-body">
                  {!s.subjects.length ? <div className="no-data" style={{ margin: 0 }}><p>No hay materias en este semestre</p></div> :
                    <div className="subjects-cards-mobile">
                      {s.subjects.map((sub, i) => (
                        <div key={sub.id} className="subject-card-mobile" style={moving && String(moving.from) === n && moving.idx === i ? { background: 'var(--unal-yellow)' } : null}>
                          <div className="subject-card-header"><h4>{sub.name}</h4><span className={'type-badge ' + typeClass(sub.type)}>{sub.type}</span></div>
                          <div className="subject-card-body">
                            <div className="subject-card-info">
                              <div className="info-item"><label>Créditos:</label><strong>{sub.credits}</strong></div>
                              <div className="info-item"><label>Código:</label><span className="subject-field-text">{sub.code || none}</span></div>
                              <div className="info-item"><label>Profesor:</label><span className="subject-field-text">{sub.professor || none}</span></div>
                              <div className="info-item"><label>Grupo:</label><span className="subject-field-text">{sub.group || none}</span></div>
                            </div>
                            <div className="subject-card-actions">
                              <button className="btn btn-primary btn-sm" onClick={() => setEditing({ sem: n, subject: sub })}>✏️ Editar</button>
                              <button className="btn btn-danger btn-sm" onClick={() => removeSubject(n, i)}>🗑️ Eliminar</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => startMove(n, i)}>🔄 Mover</button>
                            </div>
                          </div>
                        </div>))}
                    </div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {addTo && (() => {
        const avail = bank.filter(b => !inPlan(b.name) && (!q || norm(b.name).includes(norm(q))));
        return (
          <Modal title={`Agregar materia al Semestre ${addTo}`} onClose={() => { setAddTo(null); setQ(''); }}>
            <input className="form-control" style={{ marginBottom: 12 }} placeholder="🔍 Buscar en el banco..." value={q} onChange={e => setQ(e.target.value)} />
            {!bank.filter(b => !inPlan(b.name)).length ? <p>Todas las materias del banco ya están asignadas a semestres. Crea una nueva en el Banco de Materias.</p>
              : !avail.length ? <p>Sin resultados.</p>
              : avail.map(b => (
                <div key={b.id} className="subject-item" onClick={() => { addSubject(addTo, b); setQ(''); }}>
                  <div className="subject-info"><h4>{b.name}</h4><p>{b.type} • {b.credits} créditos</p></div><span>➕</span>
                </div>))}
          </Modal>);
      })()}
      {editing && <SubjectModal subject={editing.subject} config={config} onClose={() => setEditing(null)} onSave={s => saveSubject(editing.subject, s)} />}
      {viewSch && lastSchedule && <ScheduleViewer data={data} schedule={lastSchedule} onClose={() => setViewSch(false)} />}
    </>
  );
}
