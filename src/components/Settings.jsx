import { useMemo, useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import Modal from './Modal';
import { TYPES, typeClass, STATUS, typesOf } from '../lib/plan';

export default function Settings({ data, update, user, discard, dbl }) {
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
      <div className="header-bar"><h2>Configuración del Sistema</h2></div>
      <div style={{ background: 'var(--bg-primary)', padding: 24, borderRadius: 12, boxShadow: 'var(--shadow-light)', border: '1px solid var(--border-color)', marginBottom: 24 }}>
        <div className="form-group"><label className="form-label">Nombre del Programa</label><input className="form-control" placeholder="ej: Diseño Gráfico" value={f.programName} onChange={e => setF({ ...f, programName: e.target.value })} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Total de Créditos Requeridos</label><input type="number" className="form-control" value={f.totalCredits} onChange={e => setF({ ...f, totalCredits: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Universidad</label><input className="form-control" placeholder="Tu Universidad" value={f.university} onChange={e => setF({ ...f, university: e.target.value })} /></div>
        </div>
        <div className="form-group"><label className="form-label">Créditos de libre elección exigidos</label><input type="number" className="form-control" style={{ maxWidth: 220 }} value={f.freeElectiveCredits} onChange={e => setF({ ...f, freeElectiveCredits: e.target.value })} />
          <p style={{ fontSize: '.76rem', color: 'var(--text-secondary)', marginTop: 4 }}>Se usa en el avance de la doble titulación (ej: 30). Si lo dejas en 0, se suman las materias de libre elección del plan.</p></div>
        <div className="form-group" style={{ marginTop: 24 }}>
          <button className="btn btn-success" onClick={() => { update({ config: { ...config, ...f, totalCredits: parseInt(f.totalCredits) || 0, freeElectiveCredits: parseInt(f.freeElectiveCredits) || 0 } }); alert('✅ Configuración guardada correctamente'); }}>💾 Guardar Configuración</button>
          <button className="btn btn-danger" style={{ marginLeft: 12 }} onClick={reset}>🗑️ Reiniciar Sistema</button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-primary)', padding: 24, borderRadius: 12, boxShadow: 'var(--shadow-light)', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: 20, color: 'var(--unal-green)' }}>Distribución por Tipologías</h3>
        <h5 style={{ marginBottom: 20 }}>(Hacer click para ver las asignaturas)</h5>
        <div className="typologies-grid">{types.map(t => {
          const s = stats[t]; if (!s.count) return null;
          const pc = s.credits - s.doneCredits, pn = s.count - s.doneCount, p = s.credits ? Math.round((s.doneCredits / s.credits) * 100) : 0, complete = pc === 0;
          return (
            <div key={t} className={'typology-card' + (complete ? ' typology-card--complete' : '')} onClick={() => setTyp(t)}>
              <div className="typology-name"><span className={'type-badge ' + typeClass(t)} style={{ display: 'inline-block', marginBottom: 6 }}>{t}</span></div>
              <div className="typology-progress-bar"><div className={'typology-progress-fill ' + typeClass(t)} style={{ width: p + '%' }} /></div>
              <div className="typology-stats">
                <div><div className="typology-credits">{s.doneCredits}<span style={{ fontSize: '.85rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/{s.credits}</span></div><div className="typology-count">créditos cursados</div></div>
                <div className={'typology-pending' + (complete ? ' typology-pending--done' : '')}>
                  {complete ? <><span style={{ fontSize: '1.3rem' }}>✅</span><div style={{ fontSize: '.72rem', marginTop: 2 }}>¡Completo!</div></>
                    : <><div className="typology-pending-num">{pc}</div><div className="typology-count">créd. pendientes</div><div className="typology-count" style={{ marginTop: 2 }}>({pn} mat.)</div></>}
                </div>
              </div>
            </div>);
        })}</div>
      </div>

      <div style={{ background: 'var(--bg-primary)', padding: 24, borderRadius: 12, boxShadow: 'var(--shadow-light)', border: '1px solid var(--border-color)', marginTop: 24 }}>
        <h3 style={{ marginBottom: 8, color: 'var(--unal-green)' }}>🎓 Doble titulación</h3>
        {!dbl.enabled ? <>
          <p style={{ fontSize: '.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>Agrega una segunda carrera con su propio plan, malla y notas. Podrás homologar materias entre las dos (por ejemplo, la libre elección de una con materias de la otra) y verlas como vistas en ambas.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="form-control" style={{ maxWidth: 320 }} placeholder="Nombre de la segunda carrera (ej: Administración de Empresas)" value={name2} onChange={e => setName2(e.target.value)} />
            <button className="btn btn-success" onClick={() => name2.trim() ? (dbl.activate(name2.trim()), dbl.setCareer('second'), alert('✅ Segunda carrera creada. Ahora estás viendo esa carrera: carga su plan desde Resumen → menú ⚙️ → Cargar CSV.')) : alert('Escribe el nombre de la carrera.')}>➕ Activar</button>
          </div>
        </> : <>
          <p style={{ fontSize: '.88rem', marginBottom: 12 }}>Segunda carrera: <strong>{dbl.names.second}</strong> · {dbl.links.length} homologación{dbl.links.length !== 1 ? 'es' : ''}.</p>
          <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Cambia de carrera con el selector de la parte superior. Cada carrera tiene su propia configuración (nombre, créditos, libre elección).</p>
          <button className="btn btn-danger" onClick={() => confirm(`¿Quitar la segunda carrera "${dbl.names.second}"? Se borran su plan, notas y homologaciones. Tu carrera principal no se toca.`) && (dbl.setCareer('main'), dbl.deactivate())}>🗑️ Quitar segunda carrera</button>
        </>}
      </div>

      {typ && <Modal id="typologySubjectsModal" title={typ} onClose={() => setTyp(null)}>
        {!modalRows.length ? <div className="no-data"><p>No hay materias de esta tipología</p></div> : <>
          <div className="typo-modal-summary">
            <div className="typo-summary-row">
              <div className="typo-summary-stat"><span className="typo-summary-num">{doneC}<span className="typo-summary-total">/{totC}</span></span><span className="typo-summary-label">créditos cursados</span></div>
              <div className="typo-summary-stat typo-summary-stat--pending"><span className="typo-summary-num">{totC - doneC}</span><span className="typo-summary-label">créditos pendientes</span></div>
              <div className="typo-summary-stat"><span className="typo-summary-num">{modalRows.length - doneN}<span className="typo-summary-total">/{modalRows.length}</span></span><span className="typo-summary-label">materias pendientes</span></div>
            </div>
            <div className="typo-progress-bar"><div className={'typo-progress-fill ' + typeClass(typ)} style={{ width: pct + '%' }} /></div>
            <div style={{ textAlign: 'right', fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{pct}% completado</div>
          </div>
          <div className="typo-subjects-grid">{sorted.map((x, i) => (
            <div key={i} className={'typo-subject-card typo-subject-card--' + x.status}>
              <div className="typo-subject-header"><span className="typo-subject-name">{x.name}</span><span className="typo-subject-credits">{x.credits} cr.</span></div>
              <div className="typo-subject-meta">{x.code && <span className="typo-meta-item">🔢 {x.code}</span>}<span className="typo-meta-item">📅 Sem. {x.semester}</span>{x.professor && <span className="typo-meta-item">👤 {x.professor}</span>}</div>
              <div className="typo-subject-status"><span className={'type-badge status-' + x.status}>{STATUS[x.status]}</span></div>
            </div>))}</div>
        </>}
      </Modal>}
    </>
  );
}
