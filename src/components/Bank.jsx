import { useMemo, useState } from 'react';
import { Plus, Search, BookOpen, Pencil, Trash2, Upload, Library, ListPlus, Loader2 } from 'lucide-react';
import CpModal from './CpModal';
import SubjectModal from './SubjectModal';
import { PageHeader, Menu, Empty, toast } from '../ui.jsx';
import { uid, typeClass, mapPlan, TYPES, norm } from '../lib/plan';
import { parseCP, findCp } from '../lib/cp';
import { ensureGrades, renameGrade } from '../lib/grades';

const short = (t, n = 110) => (t.length > n ? t.slice(0, n) + '…' : t);

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
    toast(form.subject ? 'Materia actualizada' : 'Materia creada');
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
      if (!parsed.length) return toast('No se encontraron asignaturas. Revisa los encabezados: Código, Nombre, Créditos, Tipología, Descripción, Contenido, Semestre, UAB.', 'error');
      update({ contenidoProgramatico: parsed });
      toast(`${parsed.length} asignaturas del programa cargadas`);
    } catch (err) { toast('Error al leer el archivo: ' + err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Banco de materias" subtitle={`${bank.length} materias${cp.length ? ` · ${cp.length} en el programa` : ''}`}>
        <button className="btn btn-primary" onClick={() => setForm({})}><Plus /><span>Nueva materia</span></button>
        <Menu items={[{ icon: busy ? Loader2 : Upload, label: cp.length ? 'Reemplazar programa (CSV)' : 'Cargar programa (CSV)', file: { accept: '.csv', onChange: loadCP } }]} />
      </PageHeader>

      <div className="search search-block"><Search /><input placeholder="Buscar por nombre o tipología…" value={q} onChange={e => setQ(e.target.value)} /></div>

      {!list.length && !unassigned.length && <Empty icon={Library} title={q ? 'Sin resultados' : 'Tu banco está vacío'}>{q ? <p>Prueba con otro término.</p> : <p>Se llena solo al importar tu plan, o puedes crear materias a mano.</p>}</Empty>}

      <div className="bank-grid">
        {list.map(s => {
          const c = findCp(cp, s), n = semOf(s);
          return (
            <article key={s.id} className="bank-card">
              <div className="bank-top">
                <span className={'type-badge ' + typeClass(s.type)}>{s.type}</span>
                <span className={'pill ' + (n ? 'pill-blue' : '')}>{n ? `Sem. ${n}` : 'Sin semestre'}</span>
              </div>
              <h3>{s.name}</h3>
              <div className="bank-meta">{s.credits} créditos{s.code && <> · <span className="mono">{s.code}</span></>}</div>
              {c?.description && <p className="bank-desc">{short(c.description)}</p>}
              <div className="bank-actions">
                <button className="btn btn-secondary btn-sm" disabled={!c} title={c ? 'Ver programa' : 'Sin programa cargado'} onClick={() => c && setView(c)}><BookOpen />Programa</button>
                <span className="grow" />
                <button className="icon-btn" aria-label="Editar" title="Editar" onClick={() => setForm({ subject: s })}><Pencil /></button>
                <button className="icon-btn danger" aria-label="Eliminar" title="Eliminar" onClick={() => del(s)}><Trash2 /></button>
              </div>
            </article>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <section className="bank-extra">
          <h3><ListPlus />En el programa pero sin agregar al banco <span className="pill">{unassigned.length}</span></h3>
          <div className="bank-grid">
            {unassigned.map((c, i) => (
              <article key={i} className="bank-card bank-card-dashed">
                <div className="bank-top"><span className={'type-badge ' + typeClass(c.type)}>{c.type || '—'}</span></div>
                <h3>{c.name}</h3>
                <div className="bank-meta">{c.credits || '?'} créditos{c.code && <> · <span className="mono">{c.code}</span></>}</div>
                {c.description && <p className="bank-desc">{short(c.description)}</p>}
                <div className="bank-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setView(c)}><BookOpen />Programa</button>
                  <span className="grow" />
                  <button className="btn btn-primary btn-sm" onClick={() => update({ subjectBank: [...bank, { id: uid(), name: c.name, type: TYPES.includes(c.type) ? c.type : TYPES[0], credits: parseInt(c.credits) || 0, code: c.code || '', group: '', professor: '' }] })}><Plus />Al banco</button>
                </div>
              </article>))}
          </div>
        </section>
      )}

      {view && <CpModal item={view} onClose={() => setView(null)} />}
      {form && <SubjectModal subject={form.subject} config={config} onClose={() => setForm(null)} onSave={save} />}
    </>
  );
}
