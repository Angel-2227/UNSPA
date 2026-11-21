import { useMemo, useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { Save, Plus, Trash2, GraduationCap, Sun, Moon, LogOut, TriangleAlert, CircleCheck, Hash, CalendarDays, User, BookMarked, Palette, UserCircle2 } from 'lucide-react';
import { db } from '../firebase';
import Modal from './Modal';
import { PageHeader, Seg, toast } from '../ui.jsx';
import { typeClass, STATUS, typesOf } from '../lib/plan';

export default function Settings({ data, update, user, discard, dbl, theme, toggleTheme, logout }) {
  const { studyPlan: plan, subjectBank: bank = [], config } = data;
  const [f, setF] = useState({ programName: config.programName || '', university: config.university || '', totalCredits: config.totalCredits || 0, freeElectiveCredits: config.freeElectiveCredits || 0 });
  const [name2, setName2] = useState('');
  const [typ, setTyp] = useState(null);
  const types = typesOf(config, Object.values(plan).flatMap(s => s.subjects.map(x => x.type)));

  const stats = useMemo(() => {
    const st = Object.fromEntries(types.map(t => [t, { credits: 0, count: 0, doneCredits: 0, doneCount: 0 }]));
    Object.values(plan).forEach(s => s.subjects.forEach(x => {
      const e = st[x.type]; if (!e) return;
      e.credits += x.credits; e.count++;
      if ((dbl.eff.get(x.id) || s.status) === 'completed') { e.doneCredits += x.credits; e.doneCount++; }
    }));
    return st;
  }, [plan, types.join()]); // eslint-disable-line

  const rows = t => {
    const r = [];
    Object.entries(plan).forEach(([n, s]) => s.subjects.forEach(x => x.type === t && r.push({ ...x, semester: n, status: dbl.eff.get(x.id) || s.status })));
    bank.forEach(b => b.type === t && !Object.values(plan).some(s => s.subjects.some(x => x.name === b.name)) && r.push({ ...b, semester: 'No asignado', status: 'available' }));
    return r;
  };
  async function reset() {
    if (!confirm('¿Estás seguro de que quieres reiniciar todo el sistema? Esta acción no se puede deshacer.')) return;
    discard();
    try { await deleteDoc(doc(db, 'users', user.uid)); } catch (e) { console.error(e); }
    localStorage.clear(); location.reload();
  }

  const modalRows = typ ? rows(typ) : [];
  const order = { current: 0, pending: 1, available: 2, completed: 3 };
  const sorted = [...modalRows].sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2));
  const totC = modalRows.reduce((s, x) => s + x.credits, 0), doneC = modalRows.filter(x => x.status === 'completed').reduce((s, x) => s + x.credits, 0);
  const doneN = modalRows.filter(x => x.status === 'completed').length, pct = totC ? Math.round((doneC / totC) * 100) : 0;

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Programa, tipologías, doble titulación y cuenta" />

      <section className="card set-card">
        <h2 className="card-title"><BookMarked />Programa</h2>
        <div className="form-group"><label className="form-label">Nombre del programa</label><input className="form-control" placeholder="ej: Diseño Gráfico" value={f.programName} onChange={e => setF({ ...f, programName: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Universidad</label><input className="form-control" placeholder="Tu universidad" value={f.university} onChange={e => setF({ ...f, university: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Créditos requeridos</label><input type="number" className="form-control" value={f.totalCredits} onChange={e => setF({ ...f, totalCredits: e.target.value })} /></div>
        </div>
        <div className="form-group"><label className="form-label">Créditos de libre elección exigidos</label><input type="number" className="form-control narrow" value={f.freeElectiveCredits} onChange={e => setF({ ...f, freeElectiveCredits: e.target.value })} />
          <p className="hint">Se usa en el avance de la doble titulación (ej: 30). Si lo dejas en 0, se suman las materias de libre elección del plan.</p></div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={() => { update({ config: { ...config, ...f, totalCredits: parseInt(f.totalCredits) || 0, freeElectiveCredits: parseInt(f.freeElectiveCredits) || 0 } }); toast('Configuración guardada'); }}><Save />Guardar cambios</button>
        </div>
      </section>

      <section className="card set-card">
        <h2 className="card-title"><Palette />Apariencia y cuenta</h2>
        <div className="set-row">
          <div><strong>Tema</strong><span>Claro u oscuro</span></div>
          <Seg value={theme} onChange={v => v !== theme && toggleTheme()} options={[{ value: 'light', label: 'Claro', icon: Sun }, { value: 'dark', label: 'Oscuro', icon: Moon }]} />
        </div>
        <div className="set-row">
          <div className="set-user">
            {user.photoURL ? <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <UserCircle2 />}
            <div><strong>{user.displayName || 'Usuario'}</strong><span>{user.email}</span></div>
          </div>
          <button className="btn btn-secondary" onClick={logout}><LogOut />Cerrar sesión</button>
        </div>
      </section>

      <section className="card set-card">
        <h2 className="card-title">Distribución por tipologías</h2>
        <p className="hint">Toca una tipología para ver sus asignaturas.</p>
        <div className="typologies-grid">{types.map(t => {
          const s = stats[t]; if (!s.count) return null;
          const pc = s.credits - s.doneCredits, pn = s.count - s.doneCount, p = s.credits ? Math.round((s.doneCredits / s.credits) * 100) : 0, complete = pc === 0;
          return (
            <button key={t} className={'typology-card' + (complete ? ' typology-card--complete' : '')} onClick={() => setTyp(t)}>
              <div className="typology-name"><span className={'type-badge ' + typeClass(t)}>{t}</span></div>
              <div className="typology-progress-bar"><div className={'typology-progress-fill ' + typeClass(t)} style={{ width: p + '%' }} /></div>
              <div className="typology-stats">
                <div><div className="typology-credits">{s.doneCredits}<span>/{s.credits}</span></div><div className="typology-count">créditos cursados</div></div>
                <div className={'typology-pending' + (complete ? ' typology-pending--done' : '')}>
                  {complete ? <><CircleCheck /><div>¡Completo!</div></>
                    : <><div className="typology-pending-num">{pc}</div><div className="typology-count">créd. pendientes</div><div className="typology-count">({pn} mat.)</div></>}
                </div>
              </div>
            </button>);
        })}</div>
      </section>

      <section className="card set-card">
        <h2 className="card-title"><GraduationCap />Doble titulación</h2>
        {!dbl.enabled ? <>
          <p className="hint">Agrega una segunda carrera con su propio plan, malla y notas. Podrás homologar materias entre las dos (por ejemplo, la libre elección de una con materias de la otra) y verlas como vistas en ambas.</p>
          <div className="inline-form">
            <input className="form-control" placeholder="Nombre de la segunda carrera (ej: Administración de Empresas)" value={name2} onChange={e => setName2(e.target.value)} />
            <button className="btn btn-primary" onClick={() => name2.trim() ? (dbl.activate(name2.trim()), dbl.setCareer('second'), toast('Segunda carrera creada. Carga su plan desde Mi plan → menú ⋮ → Cargar plan.', 'info')) : toast('Escribe el nombre de la carrera.', 'error')}><Plus />Activar</button>
          </div>
        </> : <>
          <p>Segunda carrera: <strong>{dbl.names.second}</strong> · {dbl.links.length} homologación{dbl.links.length !== 1 ? 'es' : ''}.</p>
          <p className="hint">Cambia de carrera con el selector de la parte superior. Cada carrera tiene su propia configuración (nombre, créditos, libre elección).</p>
          <button className="btn btn-danger-soft" onClick={() => confirm(`¿Quitar la segunda carrera "${dbl.names.second}"? Se borran su plan, notas y homologaciones. Tu carrera principal no se toca.`) && (dbl.setCareer('main'), dbl.deactivate())}><Trash2 />Quitar segunda carrera</button>
        </>}
      </section>

      <section className="card set-card danger-zone">
        <h2 className="card-title"><TriangleAlert />Zona de peligro</h2>
        <div className="set-row">
          <div><strong>Reiniciar el sistema</strong><span>Borra tu plan, notas, horarios y tareas de la nube y de este dispositivo. No se puede deshacer.</span></div>
          <button className="btn btn-danger-soft" onClick={reset}><Trash2 />Reiniciar</button>
        </div>
      </section>

      {typ && <Modal id="typologySubjectsModal" title={typ} onClose={() => setTyp(null)} wide={760}>
        {!modalRows.length ? <p className="muted">No hay materias de esta tipología.</p> : <>
          <div className="typo-modal-summary">
            <div className="typo-summary-row">
              <div className="typo-summary-stat"><span className="typo-summary-num">{doneC}<span className="typo-summary-total">/{totC}</span></span><span className="typo-summary-label">créditos cursados</span></div>
              <div className="typo-summary-stat typo-summary-stat--pending"><span className="typo-summary-num">{totC - doneC}</span><span className="typo-summary-label">créditos pendientes</span></div>
              <div className="typo-summary-stat"><span className="typo-summary-num">{modalRows.length - doneN}<span className="typo-summary-total">/{modalRows.length}</span></span><span className="typo-summary-label">materias pendientes</span></div>
            </div>
            <div className="typo-progress-bar"><div className={'typo-progress-fill ' + typeClass(typ)} style={{ width: pct + '%' }} /></div>
            <div className="typo-pct">{pct}% completado</div>
          </div>
          <div className="typo-subjects-grid">{sorted.map((x, i) => (
            <div key={i} className={'typo-subject-card typo-subject-card--' + x.status}>
              <div className="typo-subject-header"><span className="typo-subject-name">{x.name}</span><span className="typo-subject-credits">{x.credits} cr.</span></div>
              <div className="typo-subject-meta">{x.code && <span className="typo-meta-item"><Hash />{x.code}</span>}<span className="typo-meta-item"><CalendarDays />Sem. {x.semester}</span>{x.professor && <span className="typo-meta-item"><User />{x.professor}</span>}</div>
              <div className="typo-subject-status"><span className={'type-badge status-' + x.status}>{STATUS[x.status]}</span></div>
            </div>))}</div>
        </>}
      </Modal>}
    </>
  );
}
