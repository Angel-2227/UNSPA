import { useMemo, useState } from 'react';
import Modal from './Modal';
import { norm, typeClass } from '../lib/plan';

const ST = { completed: '✓ vista', current: '▶ cursando', pending: 'pendiente' };

// Panel "Homologar con la otra carrera" para una materia
export function HomologPanel({ dbl, subject }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState('');
  const link = dbl.linkOf(subject.id);
  const otherName = dbl.names[dbl.otherKey];
  const options = useMemo(() => {
    if (!open) return [];
    const taken = new Set(dbl.links.flatMap(l => [l.main, l.second]));
    const mine = norm(subject.name), list = [];
    Object.entries(dbl.other.studyPlan || {}).forEach(([sem, s]) => (s.subjects || []).forEach(x => {
      if (taken.has(x.id) || (q && !norm(x.name).includes(norm(q)))) return;
      list.push({ x, sem, same: norm(x.name) === mine, status: dbl.eff.get(x.id) || s.status });
    }));
    return list.sort((a, b) => (b.same - a.same) || (a.sem - b.sem)).slice(0, 80);
  }, [open, q, dbl, subject.name]);
  if (!dbl.enabled) return null;
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>🔁 Homologación con {otherName}</div>
      {link ? <>
        <div className="hm-linked"><strong>{link.partner.subject.name}</strong><span>{dbl.names[link.partner.career]} · Sem. {link.partner.sem} · {link.partner.subject.credits} cr · {ST[dbl.eff.get(link.partner.subject.id)] || 'pendiente'}</span></div>
        <p className="hm-note">Es la misma materia en las dos carreras: si la apruebas en una, queda vista en la otra (cuenta créditos, no nota).</p>
        <button className="btn btn-danger btn-sm" onClick={() => dbl.removeLink(link.linkId)}>Quitar homologación</button>
      </> : <>
        {!open ? <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>🔁 Homologar con {otherName}…</button> : <>
          <input className="form-control" autoFocus placeholder={`🔍 Buscar en ${otherName}...`} value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <div className="hm-list">{!options.length ? <p className="hm-note">Sin materias disponibles.</p> : options.map(o => (
            <button key={o.x.id} className="hm-opt" onClick={() => { dbl.addLink(subject.id, o.x.id); setOpen(false); }}>
              <span className="hm-opt-name">{o.same && <span className="hm-same">mismo nombre</span>}{o.x.name}</span>
              <span className="hm-opt-meta"><span className={'type-badge ' + typeClass(o.x.type)}>{o.x.type}</span> Sem. {o.sem} · {o.x.credits} cr · {ST[o.status] || 'pendiente'}</span>
            </button>))}</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>Cancelar</button>
        </>}
      </>}
    </div>
  );
}

export function HomologModal({ dbl, subject, onClose }) {
  return <Modal title={subject.name} subtitle={`${subject.credits} créditos · ${subject.type}`} onClose={onClose}><HomologPanel dbl={dbl} subject={subject} /></Modal>;
}

// Coincidencias automáticas por nombre
export function SuggestModal({ dbl, onClose }) {
  const [sel, setSel] = useState(() => new Set(dbl.suggestions.map(s => s.main)));
  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const apply = () => { dbl.addMany(dbl.suggestions.filter(s => sel.has(s.main))); onClose(); };
  return (
    <Modal title="Homologaciones sugeridas" subtitle="Materias con el mismo nombre en las dos carreras" onClose={onClose}>
      {!dbl.suggestions.length ? <p>No hay coincidencias nuevas.</p> : <>
        <div className="hm-list">{dbl.suggestions.map(s => (
          <label key={s.main} className="hm-opt hm-check"><input type="checkbox" checked={sel.has(s.main)} onChange={() => toggle(s.main)} />
            <span className="hm-opt-name">{s.name}<span className="hm-opt-meta">{dbl.names.main} sem. {s.mainSem} ↔ {dbl.names.second} sem. {s.secondSem}</span></span></label>))}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}><button className="btn btn-success" disabled={!sel.size} onClick={apply}>✅ Homologar {sel.size}</button><button className="btn btn-secondary" onClick={onClose}>Cancelar</button></div>
      </>}
    </Modal>
  );
}

// Selector de carrera (principal / segunda)
export function CareerSwitch({ dbl }) {
  return (
    <div className="career-switch">
      {['main', 'second'].map(k => <button key={k} className={dbl.active === k ? 'active' : ''} onClick={() => dbl.setCareer(k)}><span className="career-switch-tag">{k === 'main' ? 'Principal' : 'Segunda'}</span><span className="career-switch-name">{dbl.names[k]}</span></button>)}
    </div>
  );
}

// Tarjeta de avance de la doble titulación (Resumen)
export function DoubleCard({ dbl }) {
  const [sug, setSug] = useState(false);
  return (
    <div className="dbl-card">
      <div className="dbl-head"><h3>🎓 Doble titulación</h3>
        {dbl.suggestions.length > 0 && <button className="btn btn-warning btn-sm" onClick={() => setSug(true)}>✨ {dbl.suggestions.length} homologación{dbl.suggestions.length !== 1 ? 'es' : ''} sugerida{dbl.suggestions.length !== 1 ? 's' : ''}</button>}</div>
      <div className="dbl-grid">{['main', 'second'].map(k => {
        const s = dbl.summ[k];
        return (
          <div key={k} className={'dbl-col' + (dbl.active === k ? ' active' : '')} onClick={() => dbl.setCareer(k)}>
            <div className="dbl-name">{s.name}<span className="career-switch-tag">{k === 'main' ? 'Principal' : 'Segunda'}</span></div>
            {!s.hasPlan ? <p className="hm-note">Aún sin plan: cárgalo con el CSV (menú ⚙️ → Cargar CSV).</p> : <>
              <div className="progress-bar"><div className="progress-fill" style={{ width: Math.min(100, s.pct) + '%' }} /></div>
              <div className="dbl-line"><strong>{s.done}</strong> / {s.req} créditos · {s.pct}%{s.cur > 0 && <span> · {s.cur} cursando</span>}</div>
              <div className="dbl-line">Libre elección: <strong>{s.leDone}</strong> / {s.leReq || '—'} cr{s.leCur > 0 && <span> (+{s.leCur} cursando)</span>}</div>
              <div className="dbl-line dbl-level">{s.allDone ? '🎉 Plan completo' : s.level ? <>Primer semestre con materias por ver: <strong>{s.level}</strong></> : ''}</div>
            </>}
          </div>);
      })}</div>
      <p className="hm-note">Los créditos de una materia homologada cuentan en las dos carreras. El "semestre" es aproximado: solo mira cuál es el primero con materias sin ver.</p>
      {sug && <SuggestModal dbl={dbl} onClose={() => setSug(false)} />}
    </div>
  );
}
