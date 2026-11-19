import { useMemo, useState } from 'react';
import CpModal from './CpModal';
import SubjectModal from './SubjectModal';
import { uid, typeClass, mapPlan, TYPES, norm } from '../lib/plan';
import { parseCP, findCp } from '../lib/cp';
import { ensureGrades, renameGrade } from '../lib/grades';

const short = (t, n = 100) => (t.length > n ? t.slice(0, n) + '…' : t);
const pill = { fontSize: '.75rem', padding: '2px 7px', borderRadius: 10, marginLeft: 6 };

export default function Bank({ data, update }) {
  const { studyPlan: plan, subjectBank: bank = [], contenidoProgramatico: cp = [], config } = data;
  const [q, setQ] = useState(''), [form, setForm] = useState(null), [view, setView] = useState(null), [busy, setBusy] = useState(false);
  const ql = q.toLowerCase();
  const semOf = s => Object.keys(plan).find(n => plan[n].subjects.some(x => x.id === s.id || x.name === s.name));
  const list = bank.filter(s => s.name.toLowerCase().includes(ql) || s.type.toLowerCase().includes(ql));
  const unassigned = cp.filter(c => (!ql || norm(c.name).includes(norm(ql)) || (c.code || '').toLowerCase().includes(ql)) && !bank.some(s => norm(s.name) === norm(c.name) || (s.code && c.code && s.code === c.code)));
  const g = useMemo(() => ensureGrades(plan, data.gradesData || {}, bank), [plan, data.gradesData, bank]);

  function save(s) {
    if (!form.subject) update({ subjectBank: [...bank, { ...s, id: uid() }] });
    else {
      const old = form.subject, match = x => x.id === old.id || x.name === old.name, merge = x => ({ ...x, ...s, id: x.id });
      update({ subjectBank: bank.map(x => (match(x) ? merge(x) : x)), studyPlan: mapPlan(plan, x => (match(x) ? merge(x) : x)), gradesData: renameGrade(g, old.name, s.name) });
    }
    setForm(null);
  }
  function del(s) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta materia del banco?')) return;
    const p = Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, { ...v, subjects: v.subjects.filter(x => x.name !== s.name && x.id !== s.id) }]));
    update({ subjectBank: bank.filter(x => x.id !== s.id), studyPlan: p });
  }
  async function loadCP(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const parsed = await parseCP(await f.text());
      if (!parsed.length) return alert('⚠️ No se encontraron asignaturas en el CSV (revisa los encabezados: Código, Nombre, Créditos, Tipología, Descripción, Contenido, Semestre, UAB).');
      update({ contenidoProgramatico: parsed });
      alert(`✅ ${parsed.length} asignaturas cargadas.`);
    } catch (err) { alert('❌ Error al leer el archivo: ' + err.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="header-bar"><div className="header-controls">
        <h2>Banco de Materias</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={() => setForm({})}>➕ Nueva Materia</button>
          <label className="btn btn-primary btn-sm">{busy ? '⏳ Procesando...' : '📖 Cargar programa'}<input type="file" accept=".csv" hidden onChange={loadCP} disabled={busy} /></label>
        </div>
      </div></div>
      <input className="form-control" style={{ maxWidth: 400, marginBottom: 20 }} placeholder="🔍 Buscar materias..." value={q} onChange={e => setQ(e.target.value)} />
      <div className="subjects-bank" style={{ maxHeight: 'none', background: 'var(--bg-primary)' }}>
        {!list.length && !unassigned.length && <div className="no-data"><p>No se encontraron materias</p></div>}
        {list.map(s => {
          const c = findCp(cp, s), n = semOf(s);
          return (
            <div key={s.id} className="subject-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div className="subject-info">
                  <h4>{s.name} {n ? <span style={{ ...pill, background: 'var(--unal-blue)', color: '#fff' }}>Sem. {n}</span> : <span style={{ ...pill, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>Sin semestre</span>}</h4>
                  <p><span className={'type-badge ' + typeClass(s.type)}>{s.type}</span> • {s.credits} créditos{s.code && <> • <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{s.code}</span></>}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                  <button className="btn btn-secondary btn-sm" title={c ? 'Ver programa' : 'Sin programa cargado'} style={c ? null : { opacity: .4, cursor: 'default' }} onClick={() => c && setView(c)}>📖</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setForm({ subject: s })}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(s)}>🗑️</button>
                </div>
              </div>
              {c?.description && <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{short(c.description)}</p>}
            </div>
          );
        })}
        {unassigned.length > 0 && <div style={{ marginTop: 18, paddingTop: 14, borderTop: '2px dashed var(--border-color)' }}>
          <p style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: 10, fontWeight: 600 }}>📋 En el programa pero sin agregar al banco ({unassigned.length})</p>
          {unassigned.map((c, i) => (
            <div key={i} className="subject-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, opacity: .85, borderStyle: 'dashed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div className="subject-info"><h4>{c.name} <span style={{ fontSize: '.72rem', background: '#fff3cd', color: '#856404', padding: '2px 7px', borderRadius: 10, marginLeft: 6 }}>No en banco</span></h4>
                  <p><span className={'type-badge ' + typeClass(c.type)}>{c.type || '—'}</span> • {c.credits || '?'} créditos{c.code && <> • <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>{c.code}</span></>}</p></div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                  <button className="btn btn-secondary btn-sm" title="Ver programa" onClick={() => setView(c)}>📖</button>
                  <button className="btn btn-success btn-sm" title="Agregar al banco" onClick={() => update({ subjectBank: [...bank, { id: uid(), name: c.name, type: TYPES.includes(c.type) ? c.type : TYPES[0], credits: parseInt(c.credits) || 0, code: c.code || '', group: '', professor: '' }] })}>➕</button>
                </div>
              </div>
              {c.description && <p style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{short(c.description)}</p>}
            </div>))}
        </div>}
      </div>
      {view && <CpModal item={view} onClose={() => setView(null)} />}
      {form && <SubjectModal subject={form.subject} config={config} onClose={() => setForm(null)} onSave={save} />}
    </>
  );
}
