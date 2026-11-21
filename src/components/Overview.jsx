import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import {
  Plus, Upload, Download, CalendarDays, ClipboardList, ListChecks, ChevronDown, Pencil, Trash2, Repeat2, MoveRight,
  Hash, User, Users, Flame, TriangleAlert, CalendarClock, FileSpreadsheet, Search, Link2, CircleCheck, PlayCircle, Circle
} from 'lucide-react';
import Modal from './Modal';
import SubjectModal from './SubjectModal';
import { HomologModal, DoubleCard } from './Homolog';
import { ScheduleViewer } from './Schedule';
import { Ring, PageHeader, Menu, Empty, toast } from '../ui.jsx';
import { parseCSV, exportCSV, uid, typeClass, STATUS, planCredits, todayStr, norm } from '../lib/plan';
import { overallAvg, ensureGrades, gColor, moveGrade, renameGrade } from '../lib/grades';

const blankSem = { subjects: [], status: 'pending' };
const SIco = { completed: CircleCheck, current: PlayCircle, pending: Circle };

export default function Overview({ data, update, dbl, viewData, goTasks, goGrades }) {
  const { studyPlan: plan, config, subjectBank: bank = [], schedules = [], acadTasks: tasks = [] } = data;
  const [open, setOpen] = useState(null);           // acordeón: un semestre abierto a la vez
  const [addTo, setAddTo] = useState(null);         // modal "agregar materia al semestre"
  const [editing, setEditing] = useState(null);     // { sem, subject }
  const [viewSch, setViewSch] = useState(false);
  const [moving, setMoving] = useState(null);       // { from, idx } → selector de semestre destino
  const [q, setQ] = useState('');
  const [homol, setHomol] = useState(null);

  const nums = Object.keys(plan).sort((a, b) => a - b);
  const g = useMemo(() => ensureGrades(plan, data.gradesData || {}, bank), [plan, data.gradesData, bank]);
  let done = 0, cur = 0;
  // Estado efectivo por materia: cuenta lo homologado con la otra carrera
  nums.forEach(n => plan[n].subjects.forEach(x => { const st = dbl.eff.get(x.id) || plan[n].status; if (st === 'completed') done += +x.credits || 0; else if (st === 'current') cur += +x.credits || 0; }));
  const total = config.totalCredits || 1;
  const pending = Math.max(0, total - done - cur);
  const pct = Math.round((done / total) * 100);
  const avg = overallAvg(plan, g);

  // Tareas
  const pend = tasks.filter(t => !t.done), today = todayStr();
  const urgent = pend.filter(t => t.priority === 1).length, overdue = pend.filter(t => t.due && t.due < today).length, dueToday = pend.filter(t => t.due === today).length;

  const patchSem = (n, p) => update({ studyPlan: { ...plan, [n]: { ...plan[n], ...p } } });
  const inPlan = name => Object.values(plan).some(s => s.subjects.some(x => norm(x.name) === norm(name)));

  function addSubject(n, b) {
    const { horariosInfo, ...s } = b;
    patchSem(n, { subjects: [...plan[n].subjects, s] });
    setAddTo(null); setQ('');
    toast(`«${b.name}» agregada al semestre ${n}`);
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
    setMoving(null); setOpen(String(to));
    toast(`«${s.name}» movida al semestre ${to}`);
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
    toast('Materia actualizada');
  }
  function addSemester() {
    const all = nums.map(Number), empty = all.filter(n => !plan[n].subjects?.length);
    let n;
    if (empty.length) n = empty[0];
    else { n = all.length ? Math.max(...all) + 1 : 1; update({ studyPlan: { ...plan, [n]: { ...blankSem } } }); }
    setOpen(String(n)); setAddTo(String(n));
  }
  function deleteSemester(n) {
    const s = plan[n];
    if (!confirm(s.subjects.length ? `¿Estás seguro de eliminar el Semestre ${n}? Tiene ${s.subjects.length} materias que se perderán.` : `¿Eliminar el Semestre ${n}?`)) return;
    const p = { ...plan }; delete p[n];
    const ids = new Set(s.subjects.map(x => x.id));
    const pre = Object.fromEntries(Object.entries(data.mallaPrereqs || {}).filter(([k]) => !ids.has(k)).map(([k, v]) => [k, v.filter(x => !ids.has(x))]));
    update({ studyPlan: p, mallaPrereqs: pre });
  }
  function onCSV(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    Papa.parse(f, { header: false, complete: ({ data: rows }) => {
      const { plan: np, total: t, types } = parseCSV(rows, plan, dbl.active === 'second' ? 'pending' : 'completed');
      if (!Object.keys(np).length) return toast('No se encontraron semestres en el CSV.', 'error');
      if (nums.length && !confirm('Esto reemplaza tu plan actual (conserva las notas y los datos de las materias que ya existían). ¿Continuar?')) return;
      const names = new Set(bank.map(s => norm(s.name))), nb = [...bank];
      Object.values(np).forEach(s => s.subjects.forEach(x => { if (!names.has(norm(x.name))) { names.add(norm(x.name)); nb.push({ ...x, id: uid() }); } }));
      update({ studyPlan: np, subjectBank: nb, config: { ...config, totalCredits: t, creditsByType: types, programName: config.programName || 'Plan de Estudios', university: config.university || 'Universidad' } });
      toast('Plan de estudios importado');
    } });
  }

  const lastSchedule = [...schedules].reverse().find(s => !s.archived) || schedules[schedules.length - 1];
  const csvItem = { icon: Upload, label: 'Cargar plan (CSV)', file: { accept: '.csv', onChange: onCSV } };

  return (
    <>
      <PageHeader title="Mi plan" subtitle={`${config.programName || 'Plan de estudios'} · ${config.university || 'Universidad'}`}>
        <button className="btn btn-primary" onClick={addSemester}><Plus /><span>Nuevo semestre</span></button>
        <Menu items={[
          { icon: CalendarDays, label: 'Ver mi horario', onClick: () => setViewSch(true), hidden: !lastSchedule },
          csvItem,
          { icon: Download, label: 'Exportar plan (CSV)', onClick: () => exportCSV(plan, config), hidden: !nums.length }
        ]} />
      </PageHeader>

      {/* ── Avance ── */}
      <section className="hero card">
        <Ring pct={pct} size={128} stroke={11}><b>{pct}%</b><small>completado</small></Ring>
        <div className="hero-body">
          <div className="hero-title">Avance de créditos<span>{done} de {config.totalCredits || 0}</span></div>
          <div className="hero-bar" aria-hidden="true">
            <i className="seg-done" style={{ width: (done / total) * 100 + '%' }} />
            <i className="seg-cur" style={{ width: (cur / total) * 100 + '%' }} />
          </div>
          <div className="hero-legend">
            <div><i className="dot dot-done" /><strong>{done}</strong><span>Completados</span></div>
            <div><i className="dot dot-cur" /><strong>{cur}</strong><span>Cursando</span></div>
            <div><i className="dot dot-pend" /><strong>{pending}</strong><span>Pendientes</span></div>
          </div>
        </div>
      </section>

      <div className="tiles">
        <button className="tile" onClick={goGrades}>
          <span className="tile-ico"><ClipboardList /></span>
          <span className="tile-label">Promedio acumulado</span>
          <span className="tile-value" style={{ color: avg !== null ? gColor(avg) : 'var(--text-secondary)' }}>{avg !== null ? avg.toFixed(2) : '—'}</span>
          <span className="tile-sub">{avg !== null ? 'Ponderado por créditos' : 'Aún sin notas registradas'}</span>
        </button>
        <button className="tile" onClick={goTasks}>
          <span className="tile-ico"><ListChecks /></span>
          <span className="tile-label">Tareas pendientes</span>
          <span className="tile-value">{pend.length}</span>
          <span className="tile-sub">
            {urgent + overdue + dueToday === 0 ? 'Sin pendientes urgentes' : <>
              {urgent > 0 && <span className="tile-chip c-red"><Flame />{urgent}</span>}
              {overdue > 0 && <span className="tile-chip c-orange"><TriangleAlert />{overdue}</span>}
              {dueToday > 0 && <span className="tile-chip c-green"><CalendarClock />{dueToday} hoy</span>}</>}
          </span>
        </button>
        {lastSchedule && (
          <button className="tile" onClick={() => setViewSch(true)}>
            <span className="tile-ico"><CalendarDays /></span>
            <span className="tile-label">Mi horario</span>
            <span className="tile-value tile-value-sm">{lastSchedule.name}</span>
            <span className="tile-sub">{Object.keys(lastSchedule.subjects || {}).length} materia{Object.keys(lastSchedule.subjects || {}).length !== 1 ? 's' : ''} · toca para ver</span>
          </button>
        )}
      </div>

      {dbl.enabled && <DoubleCard dbl={dbl} />}

      {/* ── Semestres ── */}
      {!nums.length ? (
        <Empty icon={FileSpreadsheet} title="Importa tu plan de estudios">
          <p>Carga el CSV de tu historia académica y el sistema detecta solo los créditos, las materias, sus tipologías y los semestres.</p>
          <label className="btn btn-primary"><Upload />Cargar plan (CSV)<input type="file" accept=".csv" hidden onChange={onCSV} /></label>
        </Empty>
      ) : (
        <div className="sem-list">
          {nums.map(n => {
            const s = plan[n], isOpen = open === n, st = s.status || 'pending', SI = SIco[st];
            return (
              <article key={n} id={'semester-' + n} className={'sem sem-' + st + (isOpen ? ' is-open' : '')}>
                <div className="sem-head" onClick={() => setOpen(isOpen ? null : n)} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(isOpen ? null : n))} aria-expanded={isOpen}>
                  <span className="sem-ico"><SI /></span>
                  <div className="sem-title">
                    <strong>Semestre {n}</strong>
                    <span>{s.subjects.length} materia{s.subjects.length !== 1 ? "s" : ""} · {planCredits(s)} créditos</span>
                  </div>
                  <div className="sem-controls" onClick={e => e.stopPropagation()}>
                    <select className="select-sm" aria-label="Estado del semestre" value={st} onChange={e => patchSem(n, { status: e.target.value })}>
                      <option value="pending">Pendiente</option><option value="current">Cursando</option><option value="completed">Completado</option>
                    </select>
                    <button className="icon-btn" title="Agregar materia" aria-label="Agregar materia" onClick={() => setAddTo(n)}><Plus /></button>
                    <button className="icon-btn danger" title="Eliminar semestre" aria-label="Eliminar semestre" onClick={() => deleteSemester(n)}><Trash2 /></button>
                  </div>
                  <ChevronDown className="sem-chev" />
                </div>
                {isOpen && (
                  <div className="sem-body">
                    {!s.subjects.length ? (
                      <div className="sem-empty"><p>Este semestre aún no tiene materias.</p><button className="btn btn-primary btn-sm" onClick={() => setAddTo(n)}><Plus />Agregar materia</button></div>
                    ) : s.subjects.map((sub, i) => {
                      const lk = dbl.linkOf(sub.id), es = dbl.eff.get(sub.id) || st;
                      return (
                        <div key={sub.id} className="sub-row">
                          <div className="sub-main">
                            <div className="sub-name">{sub.name}{es === 'completed' && st !== 'completed' && <span className="sub-seen">vista</span>}</div>
                            <div className="sub-meta">
                              <span className={'type-badge ' + typeClass(sub.type)}>{sub.type}</span>
                              <span className="sub-cr">{sub.credits} cr.</span>
                              {sub.code && <span><Hash />{sub.code}</span>}
                              {sub.professor && <span><User />{sub.professor}</span>}
                              {sub.group && <span><Users />Grupo {sub.group}</span>}
                            </div>
                            {lk && <div className="hm-chip"><Link2 />{lk.partner.subject.name} · {dbl.names[lk.partner.career]} (Sem. {lk.partner.sem})</div>}
                          </div>
                          <div className="sub-actions">
                            <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => setEditing({ sem: n, subject: sub })}><Pencil /></button>
                            {dbl.enabled && <button className="icon-btn" title="Homologar" aria-label="Homologar" onClick={() => setHomol(sub)}><Repeat2 /></button>}
                            <button className="icon-btn" title="Mover a otro semestre" aria-label="Mover a otro semestre" onClick={() => setMoving({ from: n, idx: i })}><MoveRight /></button>
                            <button className="icon-btn danger" title="Eliminar" aria-label="Eliminar" onClick={() => removeSubject(n, i)}><Trash2 /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ── Agregar materia desde el banco ── */}
      {addTo && (() => {
        const free = bank.filter(b => !inPlan(b.name)), avail = free.filter(b => !q || norm(b.name).includes(norm(q)));
        return (
          <Modal title={`Agregar al semestre ${addTo}`} subtitle="Elige una materia de tu banco" onClose={() => { setAddTo(null); setQ(''); }}>
            <div className="search"><Search /><input placeholder="Buscar en el banco…" autoFocus value={q} onChange={e => setQ(e.target.value)} /></div>
            {!free.length ? <p className="muted">Todas las materias del banco ya están asignadas a semestres. Crea una nueva en el Banco de materias.</p>
              : !avail.length ? <p className="muted">Sin resultados.</p>
              : <div className="pick-list">{avail.map(b => (
                <button key={b.id} className="pick" onClick={() => addSubject(addTo, b)}>
                  <div><strong>{b.name}</strong><span><span className={'type-badge ' + typeClass(b.type)}>{b.type}</span> {b.credits} créditos</span></div><Plus />
                </button>))}</div>}
          </Modal>);
      })()}

      {/* ── Mover materia ── */}
      {moving && (() => {
        const sub = plan[moving.from]?.subjects[moving.idx];
        if (!sub) return null;
        const targets = [...nums.filter(n => n !== String(moving.from)), String((nums.length ? Math.max(...nums.map(Number)) : 0) + 1)];
        return (
          <Modal title="Mover materia" subtitle={`«${sub.name}» · desde el semestre ${moving.from}`} onClose={() => setMoving(null)}>
            <div className="pick-list">{targets.map(n => {
              const isNew = !plan[n];
              return (
                <button key={n} className="pick" onClick={() => moveSub(moving.from, moving.idx, n)}>
                  <div><strong>{isNew ? `Nuevo semestre ${n}` : `Semestre ${n}`}</strong>{!isNew && <span>{plan[n].subjects.length} materias · {STATUS[plan[n].status] || 'Pendiente'}</span>}</div><MoveRight />
                </button>);
            })}</div>
          </Modal>);
      })()}

      {editing && <SubjectModal subject={editing.subject} config={config} onClose={() => setEditing(null)} onSave={s => saveSubject(editing.subject, s)} />}
      {homol && <HomologModal dbl={dbl} subject={homol} onClose={() => setHomol(null)} />}
      {viewSch && lastSchedule && <ScheduleViewer data={viewData || data} schedule={lastSchedule} onClose={() => setViewSch(false)} />}
    </>
  );
}
