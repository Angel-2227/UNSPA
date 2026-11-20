import { useMemo, useState } from 'react';
import { ensureGrades, subjectAvg, semAvg, overallAvg, missingSems, needed, gClass, gColor, gEmoji, gid, has_, gradeKey } from '../lib/grades';

const chip = (v, l) => v == null ? null
  : v > 5 ? <span key={l} className="gn-chip gn-chip-impossible">{l} → imposible 😞</span>
  : v < 0 ? <span key={l} className="gn-chip gn-chip-done">{l} → ya está ✓</span>
  : <span key={l} className="gn-chip">{l} → <strong>{v.toFixed(2)}</strong></span>;
const f2 = v => (v === null ? '—' : v.toFixed(2));

// Componente de nivel superior (si se define dentro de Grades, los inputs pierden el foco en cada tecla)
function Card({ sem, sub, e, isOpen, toggle, edit }) {
  const k = gradeKey(sub.name);
  if (e.type === 'pass_fail') {
    const pf = e.passFail;
    return (
      <div className="gn-card pf-card"><div className="gn-card-top">
        <div><div className="gn-sub-name">{sub.name}</div><div className="gn-sub-meta">{sub.credits} cr · Solo aprobado/reprobado</div></div>
        <select className={'gn-pf-select ' + (pf === 'approved' ? 'pf-yes' : pf === 'failed' ? 'pf-no' : '')} value={pf || ''} onChange={ev => edit(sem, k, x => { x.passFail = ev.target.value || null; })}>
          <option value="">— Sin registrar —</option><option value="approved">✅ Aprobado</option><option value="failed">❌ Reprobado</option>
        </select>
      </div></div>
    );
  }
  const avg = subjectAvg(e), tw = e.components.reduce((s, c) => s + +c.weight, 0), warn = Math.abs(tw - 100) > 0.5;
  const partial = e.components.some(c => !has_(c));
  const setC = (id, fn) => edit(sem, k, x => { fn(x.components.find(c => c.id === id)); });
  return (
    <div className="gn-card">
      <div className="gn-card-top gn-card-toggle" onClick={ev => { if (ev.target.closest('input, select, button, textarea')) return; toggle(); }}>
        <div className="gn-card-top-left"><div className="gn-sub-name">{sub.name}</div><div className="gn-sub-meta">{sub.credits} cr · {sub.type}</div></div>
        <div className="gn-card-top-right">
          <div className={'gn-avg-big ' + gClass(avg)}>{f2(avg)}</div>
          <div className="gn-avg-label">{avg !== null ? gEmoji(avg) + (partial ? ' parcial' : ' promedio') : 'sin notas'}</div>
          <span className="gn-expand-icon">{isOpen ? '▼' : '▶'}</span>
        </div>
      </div>
      {isOpen && <div className="gn-card-body open">
        <div className="gn-comps-header"><span>Corte</span><span>Peso</span><span>Nota</span><span>Aporte</span><span></span></div>
        {e.components.map(c => {
          const filled = has_(c), val = filled ? Math.min(5, Math.max(0, +c.grade)) : null;
          return (
            <div className="gn-comp-row" key={c.id}>
              <input className="gn-in gn-in-name" value={c.name} placeholder="Nombre" onChange={ev => setC(c.id, x => { x.name = ev.target.value; })} />
              <div className="gn-weight-wrap"><input className="gn-in gn-in-weight" type="number" min="0" max="100" step="1" value={c.weight} onChange={ev => setC(c.id, x => { x.weight = Math.min(100, Math.max(0, +ev.target.value || 0)); })} /><span className="gn-pct">%</span></div>
              <input className={'gn-in gn-in-grade ' + (filled ? gClass(val) : '')} type="number" min="0" max="5" step="0.01" placeholder="—" value={filled ? c.grade : ''} onChange={ev => setC(c.id, x => { x.grade = ev.target.value === '' ? null : Math.min(5, Math.max(0, +ev.target.value)); })} />
              <span className="gn-contrib">{filled ? ((val * c.weight) / 100).toFixed(3) : '—'}</span>
              <button className="gn-del-comp" title="Eliminar corte" onClick={() => e.components.length > 1 ? edit(sem, k, x => { x.components = x.components.filter(z => z.id !== c.id); }) : alert('Debe haber al menos 1 corte.')}>×</button>
            </div>
          );
        })}
        <div className="gn-totals-row">
          <span className="gn-totals-label">Total</span>
          <span className={'gn-totals-weight ' + (warn ? 'gn-warn' : 'gn-ok')}>{tw.toFixed(0)}%{warn ? ' ⚠️' : ' ✓'}</span><span></span>
          <span className={'gn-totals-avg ' + gClass(avg)}>{avg !== null ? avg.toFixed(3) : '—'}</span><span></span>
        </div>
        <div className="gn-card-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => edit(sem, k, x => { const used = x.components.reduce((s, c) => s + +c.weight, 0); x.components.push({ id: gid(), name: `Corte ${x.components.length + 1}`, weight: Math.max(0, Math.round(100 - used)), grade: null }); })}>＋ Agregar corte</button>
          <div className="gn-chips">{(needed(e, 3) !== null || avg !== null) && <><span className="gn-chips-label">Para llegar a:</span>{chip(needed(e, 3), '3.0')}{chip(needed(e, 3.5), '3.5')}{chip(needed(e, 4), '4.0')}</>}</div>
        </div>
      </div>}
    </div>
  );
}

export default function Grades({ data, update }) {
  const plan = data.studyPlan, bank = data.subjectBank || [];
  const g = useMemo(() => ensureGrades(plan, data.gradesData || {}, bank), [plan, data.gradesData, bank]);
  const [openSem, setOpenSem] = useState({}), [openCard, setOpenCard] = useState({});
  const edit = (sem, key, fn) => { const e = structuredClone(g[sem][key]); fn(e); update({ gradesData: { ...g, [sem]: { ...g[sem], [key]: e } } }); };
  const overall = overallAvg(plan, g), missing = missingSems(plan, g);
  const nums = Object.keys(plan).filter(n => plan[n].subjects?.length).sort((a, b) => a - b);

  return (
    <>
      <div className="header-bar"><div className="header-controls"><div>
        <h2 style={{ marginBottom: 4 }}>Notas por Semestre</h2>
        <p className="text-secondary" style={{ fontSize: '.85rem' }}>Registra tus notas · Calcula promedios · Simula resultados</p></div></div></div>

      {!nums.length ? <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}><div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div><p style={{ fontWeight: 500 }}>No hay materias cargadas todavía.</p><p style={{ fontSize: '.85rem', marginTop: '.5rem' }}>Importa tu plan de estudios desde el <strong>Resumen General</strong> para comenzar a registrar notas.</p></div> : <>
        <div className="gn-banner">
          <div className="gn-banner-left">
            <div className="gn-banner-label">Promedio acumulado</div>
            <div className={'gn-banner-value ' + gClass(overall)}>{f2(overall)}</div>
            <div className="gn-banner-sub">ponderado por créditos {gEmoji(overall)}</div>
            {missing > 0 && <div className="gn-banner-warn">⚠️ {missing} semestre(s) completado(s) sin notas completas</div>}
          </div>
          <div className="gn-banner-bar-wrap">
            <div className="gn-banner-bar-labels"><span>0</span><span>1</span><span>2</span><span className="gn-min-mark">3 mín</span><span>4</span><span>5</span></div>
            <div className="gn-banner-track"><div className="gn-min-line" /><div className="gn-banner-fill" style={{ width: overall !== null ? (overall / 5) * 100 + '%' : 0, background: gColor(overall) }} /></div>
          </div>
        </div>
        {nums.map(n => {
          const s = plan[n], a = semAvg(plan, g, n), isOpen = openSem[n] ?? s.status === 'current';
          return (
            <div key={n} className={'gn-sem-block ' + s.status}>
              <div className={'gn-sem-header' + (s.status === 'current' ? ' gn-sem-header--current' : '')} onClick={() => setOpenSem({ ...openSem, [n]: !isOpen })}>
                <div className="gn-sem-left"><span className={'semester-status status-' + s.status}>{{ completed: 'Completado', current: 'Cursando', pending: 'Pendiente' }[s.status] || 'Pendiente'}</span><span className="gn-sem-title">Semestre {n}</span><span className="gn-sem-count">{s.subjects.length} materias</span></div>
                <div className="gn-sem-right"><span className={'gn-sem-avg ' + gClass(a)}>{a !== null ? 'Promedio ' + a.toFixed(2) : 'Sin notas'}</span><span className="gn-chevron">{isOpen ? '▼' : '▶'}</span></div>
              </div>
              {isOpen && <div className="gn-sem-body open"><div className="gn-cards-grid">
                {s.subjects.map(sub => <Card key={sub.id} sem={n} sub={sub} e={g[n][gradeKey(sub.name)]} isOpen={!!openCard[sub.id]} toggle={() => setOpenCard(o => ({ ...o, [sub.id]: !o[sub.id] }))} edit={edit} />)}
              </div></div>}
            </div>
          );
        })}
      </>}
    </>
  );
}
