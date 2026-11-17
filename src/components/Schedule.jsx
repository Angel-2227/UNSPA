import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { norm, mapPlan, uid } from '../lib/plan';
import { DAY_BY_INDEX, groupsFor, findSubject, buildBlocks, layout, conflicts, hasConflict, shortProf, startMin, canonDay } from '../lib/schedule';

const useNow = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  return now;
};
const nowText = now => `${DAY_BY_INDEX[now.getDay()]}, ${now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
const isNowIn = (b, now) => canonDay(DAY_BY_INDEX[now.getDay()]) === b.dia && now.getHours() * 60 + now.getMinutes() >= startMin(b.inicio) && now.getHours() * 60 + now.getMinutes() < startMin(b.fin);

// ── Visor del horario guardado: solo los días con clase y solo las horas donde hay clase ──
export function ScheduleViewer({ data, schedule, onClose }) {
  const now = useNow();
  const blocks = useMemo(() => buildBlocks(data, schedule.subjects), [data, schedule]);
  const { days, hours } = layout(blocks);
  const today = canonDay(DAY_BY_INDEX[now.getDay()]);
  const base = hours[0];
  return (
    <Modal id="currentScheduleModal" title={schedule.name} subtitle={nowText(now)} onClose={onClose} wide={1200}>
      <div id="currentScheduleContent">
        <div className="schedule-grid-wrapper">
          <div className="schedule-grid-viewer" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(90px, 1fr))`, minWidth: 56 + days.length * 90 }}>
            <div className="schedule-cell-viewer header scv-corner" style={{ gridRow: 1, gridColumn: 1 }} />
            {days.map((d, c) => (
              <div key={d} className="schedule-cell-viewer header" style={{ gridRow: 1, gridColumn: c + 2 }}>
                {d.substring(0, 3)}<span className="scv-day-full">{d.substring(3).toLowerCase()}</span>
                {d === today && <span className="current-day-indicator">HOY</span>}
              </div>))}
            {hours.map((h, r) => (
              <div key={'t' + h} className={'schedule-cell-viewer time' + (h === now.getHours() ? ' current-time' : '')} style={{ gridRow: r + 2, gridColumn: 1 }}>{h}:00</div>))}
            {hours.flatMap((h, r) => days.map((d, c) => <div key={d + h} className="schedule-cell-viewer" style={{ gridRow: r + 2, gridColumn: c + 2 }} />))}
            {blocks.map((b, i) => (
              <div key={i} className={'schedule-cell-viewer class-block' + (isNowIn(b, now) ? ' current-class' : '')}
                style={{ gridRow: `${b.sH - base + 2} / span ${b.eH - b.sH}`, gridColumn: days.indexOf(b.dia) + 2, '--class-color': b.color }}>
                <div className="class-block-name">{b.subject.name}</div>
                <div className="class-block-info">G{b.grupo.numero} · {b.inicio}–{b.fin}</div>
                <div className="class-block-prof">{shortProf(b.grupo.profesor)}</div>
              </div>))}
          </div>
        </div>
        {!blocks.length && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>Este horario no tiene clases con horario disponible (¿cargaste el archivo de horarios?).</p>}
      </div>
    </Modal>
  );
}

// ── Vista previa del constructor ──
function Preview({ data, selected }) {
  const now = useNow();
  const blocks = useMemo(() => buildBlocks(data, selected), [data, selected]);
  const { days, hours } = layout(blocks), bad = useMemo(() => conflicts(blocks), [blocks]);
  const today = canonDay(DAY_BY_INDEX[now.getDay()]), base = hours[0];
  return (
    <div>
      {bad.size > 0 && <div className="conflict-warning">⚠️ Hay conflictos de horario entre las materias seleccionadas</div>}
      <div className="schedule-preview-grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div className="spg-cell spg-corner" style={{ gridRow: 1, gridColumn: 1 }} />
        {days.map((d, c) => <div key={d} className={'spg-cell spg-header' + (d === today ? ' spg-today' : '')} style={{ gridRow: 1, gridColumn: c + 2 }}>{d.substring(0, 3)}<span className="spg-day-full">{d.substring(3)}</span></div>)}
        {hours.map((h, r) => <div key={'t' + h} className={'spg-cell spg-time' + (h === now.getHours() ? ' spg-now' : '')} style={{ gridRow: r + 2, gridColumn: 1 }}>{h}:00</div>)}
        {hours.flatMap((h, r) => days.map((d, c) => <div key={d + h} className={'spg-cell spg-slot' + (bad.has(d + '-' + h) ? ' spg-conflict' : '')} style={{ gridRow: r + 2, gridColumn: c + 2 }} />))}
        {blocks.map((b, i) => (
          <div key={i} className={'spg-cell spg-class' + (isNowIn(b, now) ? ' spg-current-class' : '')}
            style={{ gridRow: `${b.sH - base + 2} / span ${b.eH - b.sH}`, gridColumn: days.indexOf(b.dia) + 2, '--class-color': b.color, boxShadow: hasConflict(b, bad) ? 'inset 0 0 0 2px #c62828' : undefined }}>
            <div className="spg-class-name">{b.subject.name}</div>
            <div className="spg-class-meta">G{b.grupo.numero} · {b.inicio}-{b.fin}</div>
          </div>))}
      </div>
      {!blocks.length && <p className="spg-hint">Selecciona un grupo de una materia para ver la previsualización</p>}
    </div>
  );
}

// ── Constructor (crear / editar) ──
function Builder({ data, update, init, onClose }) {
  const { studyPlan: plan, subjectBank: bank = [], schedules = [], currentPeriodConfig: pc = {} } = data;
  const [name, setName] = useState(init.name), [selected, setSelected] = useState(init.selected);
  const [fS, setFS] = useState(''), [fP, setFP] = useState(''), [fH, setFH] = useState('');
  const [exp, setExp] = useState({}), [showOther, setShowOther] = useState(false), [sync, setSync] = useState(null);

  const cur = [], other = [];
  Object.entries(plan).forEach(([n, s]) => s.subjects.forEach(sub => {
    const groups = groupsFor(data, sub);
    if (!groups.length) return;
    if (s.status === 'current') cur.push({ ...sub, groups, semester: n });
    else if (s.status === 'pending') other.push({ ...sub, groups, semester: n });
  }));

  const gText = g => `grupo ${g.numero} ${g.profesor} ${(g.horarios || []).map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(' ')}`.toLowerCase();
  const visible = s => {
    if (!s.name.toLowerCase().includes(fS.toLowerCase())) return null;
    const gs = s.groups.map((g, i) => ({ g, i })).filter(({ g }) => (!fP || g.profesor?.toLowerCase().includes(fP.toLowerCase())) && (!fH || gText(g).includes(fH.toLowerCase())));
    return gs.length ? gs : null;
  };
  const pick = (s, i, isOther) => {
    if (selected[s.id] === i) { const x = { ...selected }; delete x[s.id]; setSelected(x); return; }
    if (isOther) { setSync({ s, i }); return; }
    setSelected({ ...selected, [s.id]: i });
  };
  const confirmSync = () => {
    update({ studyPlan: { ...plan, [sync.s.semester]: { ...plan[sync.s.semester], status: 'current' } } });
    setSelected({ ...selected, [sync.s.id]: sync.i }); setSync(null);
  };

  const Card = ({ s, isOther }) => {
    const gs = visible(s);
    if (!gs) return null;
    const open = exp[s.id] || fP || fH;
    return (
      <div className={'subject-select-card' + (isOther ? ' other-sem-card' : '') + (open ? ' expanded' : '') + (selected[s.id] !== undefined ? ' selected' : '')} onClick={() => setExp({ ...exp, [s.id]: !exp[s.id] })}>
        <div className="subject-header-info">
          <div>
            <strong>{s.name}</strong>
            <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span className={'sem-badge ' + (isOther ? 'other-sem' : 'current-sem')}>{isOther ? `Sem. ${s.semester}` : `Sem. ${s.semester} • Cursando`}</span>
              <span>{s.credits} créditos</span>{s.code && <span style={{ opacity: .7 }}>{s.code}</span>}
            </div>
          </div>
          <span className={'expand-icon' + (open ? ' expanded' : '')}>▼</span>
        </div>
        <div className={'group-selector' + (open ? ' visible' : '')}>
          {gs.map(({ g, i }) => (
            <div key={i} className={'group-option' + (selected[s.id] === i ? ' selected' : '')} onClick={e => { e.stopPropagation(); pick(s, i, isOther); }}>
              <strong>Grupo {g.numero}</strong><br /><small>👨‍🏫 {g.profesor}</small><br />
              <small>📅 {(g.horarios || []).map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ')}</small>
            </div>))}
        </div>
      </div>
    );
  };

  function save() {
    if (!name.trim()) return alert('⚠️ Debes darle un nombre al horario');
    const sch = { id: init.id || uid(), name: name.trim(), period: pc.period || '', subjects: { ...selected }, createdAt: new Date().toISOString() };
    const old = schedules.find(x => x.id === init.id);
    const list = init.id ? schedules.map(x => (x.id === init.id ? { ...old, ...sch, createdAt: old?.createdAt || sch.createdAt } : x)) : [...schedules, sch];
    const set = {};
    Object.entries(selected).forEach(([id, i]) => { const s = findSubject(data, id), g = s && groupsFor(data, s)[i]; if (g) set[id] = { name: s.name, group: String(g.numero), professor: g.profesor }; });
    const apply = x => { const m = set[x.id] || Object.values(set).find(v => norm(v.name) === norm(x.name)); return m ? { ...x, group: m.group, professor: m.professor } : x; };
    update({ schedules: list, studyPlan: mapPlan(plan, apply), subjectBank: bank.map(apply) });
    alert('✅ Horario guardado correctamente');
    onClose();
  }

  return (
    <Modal id="scheduleModal" title={init.id ? 'Editar horario' : 'Nuevo horario'} onClose={onClose} wide={900}>
      <div className="schedule-filters">
        <input className="form-control" placeholder="🔍 Buscar por materia..." value={fS} onChange={e => setFS(e.target.value)} />
        <input className="form-control" placeholder="👨‍🏫 Buscar por profesor..." value={fP} onChange={e => setFP(e.target.value)} />
        <input className="form-control" placeholder="📅 Buscar por horario (ej: LUNES, 7:00)..." value={fH} onChange={e => setFH(e.target.value)} />
      </div>
      <div id="scheduleBuilder">
        <div style={{ marginBottom: 20 }}><label className="form-label">Nombre del Horario</label><input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="Mi Horario 2026-1" /></div>
        <h4 style={{ marginBottom: 16 }}>Seleccionar Materias</h4>
        <div id="subjectSelector">
          {!cur.length && !other.length ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}><p style={{ marginBottom: 8 }}>No hay materias disponibles con información de horarios.</p><p style={{ fontSize: '.85rem' }}>Asegúrate de haber cargado el archivo de horarios al menos una vez.</p></div> : <>
            {cur.length ? <><div className="sem-section-label">📚 Materias del semestre actual</div>{cur.map(s => <Card key={s.id} s={s} />)}</>
              : <div className="sem-section-label" style={{ opacity: .6 }}>Sin materias con horario para el semestre marcado como "Cursando"</div>}
            {other.length > 0 && <>
              <div className="other-sems-toggle" onClick={() => setShowOther(!showOther)}><span>{showOther ? '▼' : '▶'}</span> Ver otras materias ({other.length} de semestres pendientes)</div>
              {showOther && <div><div className="sem-section-label other">📋 Otras materias disponibles<span style={{ fontSize: '.78rem', fontWeight: 400, opacity: .75, marginLeft: 6 }}>Agregarlas actualizará su semestre en la malla</span></div>{other.map(s => <Card key={s.id} s={s} isOther />)}</div>}
            </>}
          </>}
        </div>
        <div style={{ marginTop: 30 }}><h4 style={{ marginBottom: 16 }}>Vista Previa del Horario</h4><Preview data={data} selected={selected} /></div>
      </div>
      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button className="btn btn-success" onClick={save}>💾 Guardar Horario</button>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
      </div>
      {sync && <div id="syncConfirmModal" className="modal" style={{ display: 'flex', zIndex: 1200 }} onMouseDown={e => e.target === e.currentTarget && setSync(null)}>
        <div className="modal-content" style={{ maxWidth: 460, padding: 28, margin: 'auto' }}>
          <div style={{ marginBottom: 18 }}><h3 style={{ margin: '0 0 8px' }}>Agregar materia de otro semestre</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem', margin: 0 }}>Estás agregando <strong>{sync.s.name}</strong> (Sem. {sync.s.semester}) al horario actual.<br />Esto <strong>marcará ese semestre como "Cursando"</strong> en tu malla.</p></div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, fontSize: '.85rem', marginBottom: 20, color: 'var(--text-secondary)' }}>
            📌 Grupo {sync.s.groups[sync.i].numero} · {sync.s.groups[sync.i].profesor}<br />{(sync.s.groups[sync.i].horarios || []).map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ')}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setSync(null)}>Cancelar</button>
            <button className="btn btn-success" onClick={confirmSync}>✅ Confirmar y agregar</button>
          </div>
        </div>
      </div>}
    </Modal>
  );
}

export default function Schedule({ data, update }) {
  const { schedules = [], currentPeriodConfig: pc = {}, studyPlan: plan, subjectBank: bank = [], horariosData = [] } = data;
  const [form, setForm] = useState({ period: pc.period || '', startDate: pc.startDate || '', endDate: pc.endDate || '' });
  const [builder, setBuilder] = useState(null), [view, setView] = useState(null), [showArch, setShowArch] = useState(false);

  const hasAny = horariosData.length > 0 || Object.values(plan).some(s => s.subjects.some(x => groupsFor(data, x).length)) || bank.some(x => groupsFor(data, x).length);

  function onFile(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        let c = ev.target.result;
        if (f.name.endsWith('.js')) { const m = c.match(/const\s+materias\s*=\s*(\[[\s\S]*\]);?/); if (m) c = m[1]; }
        const hd = JSON.parse(c);
        if (!Array.isArray(hd)) throw new Error('El archivo debe contener una lista de materias');
        const byName = new Map(hd.map(h => [norm(h.nombre), h]));
        let found = 0;
        const strip = ({ horariosInfo, ...x }) => x; // los horarios ahora viven una sola vez, en horariosData
        const nb = bank.map(s => { const h = byName.get(norm(s.name)), x = strip(s); if (h) { found++; if (!x.code) x.code = h.codigo; } return x; });
        const np = mapPlan(plan, s => { const h = byName.get(norm(s.name)), x = strip(s); return h && h.codigo ? { ...x, code: h.codigo } : x; });
        update({ horariosData: hd, subjectBank: nb, studyPlan: np });
        alert(`✅ ${hd.length} materias cargadas correctamente (${found} coinciden con tu banco)`);
      } catch (err) { alert('❌ Error al cargar el archivo: ' + err.message); }
    };
    r.readAsText(f);
  }
  const create = () => { if (!hasAny) return alert('⚠️ Primero debes cargar el archivo de horarios'); setBuilder({ id: null, name: `Horario ${pc.period || ''}`.trim(), selected: {} }); };
  const edit = s => { if (!hasAny) return alert('⚠️ Para editar el horario necesitas cargar el archivo de horarios.'); setBuilder({ id: s.id, name: s.name, selected: { ...s.subjects } }); };
  const patch = (id, p) => update({ schedules: schedules.map(s => (s.id === id ? { ...s, ...p } : s)) });
  const archive = s => confirm(`¿Archivar el horario "${s.name}" en semestres anteriores?`) && patch(s.id, { archived: true, archivedAt: new Date().toISOString() });
  const unarchive = s => { const { archived, archivedAt, ...rest } = s; update({ schedules: schedules.map(x => (x.id === s.id ? rest : x)) }); };
  const del = s => confirm('¿Eliminar este horario permanentemente?') && update({ schedules: schedules.filter(x => x.id !== s.id) });
  const group = list => list.reduce((a, s) => { (a[s.period || 'Sin periodo'] ||= []).push(s); return a; }, {});

  const Card = ({ s, arch }) => {
    const n = Object.keys(s.subjects || {}).length;
    return (
      <div className={'schedule-card' + (arch ? ' schedule-card-archived' : '')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div><h3 style={{ margin: '0 0 4px' }}>{s.name}</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '.85rem' }}>Periodo: {s.period || '—'}{arch && s.archivedAt && ` · Archivado el ${new Date(s.archivedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`}</p></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setView(s)}>👁️ Ver</button>
            {!arch ? <><button className="btn btn-warning btn-sm" onClick={() => edit(s)}>✏️ Editar</button><button className="btn btn-secondary btn-sm" onClick={() => archive(s)}>🗄️ Archivar</button></>
              : <button className="btn btn-secondary btn-sm" onClick={() => unarchive(s)}>📂 Restaurar</button>}
            <button className="btn btn-danger btn-sm" onClick={() => del(s)}>🗑️</button>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '.9rem' }}><strong>{n}</strong> materia{n !== 1 ? 's' : ''} seleccionada{n !== 1 ? 's' : ''}</p>
      </div>);
  };
  const active = schedules.filter(s => !s.archived), archived = schedules.filter(s => s.archived);

  return (
    <>
      <div className="header-bar"><div className="header-controls">
        <h2>Planificador de Horarios</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label className="btn btn-primary">📁 Cargar Horarios JSON<input type="file" accept=".json,.js" hidden onChange={onFile} /></label>
          <button className="btn btn-success" onClick={create}>➕ Nuevo Horario</button>
        </div>
      </div></div>

      <div style={{ background: 'var(--bg-primary)', padding: 24, borderRadius: 12, boxShadow: 'var(--shadow-light)', border: '1px solid var(--border-color)', marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, color: 'var(--unal-green)' }}>Configuración del Periodo Académico</h3>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Periodo (ej: 2026-1)</label><input className="form-control" placeholder="2026-1" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Fecha Inicio</label><input type="date" className="form-control" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Fecha Fin</label><input type="date" className="form-control" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
        </div>
        <button className="btn btn-success" onClick={() => { update({ currentPeriodConfig: form }); alert('✅ Configuración del periodo guardada'); }}>💾 Guardar Periodo</button>
      </div>

      {!schedules.length ? <div className="no-data"><p>No tienes horarios guardados</p></div> : <>
        {!active.length ? <div className="no-data" style={{ marginBottom: 16 }}><p>No hay horarios para el semestre actual</p></div>
          : Object.entries(group(active)).map(([p, list]) => <div key={p}>
            <div className="semester-folder-header active-folder"><span className="folder-icon">📂</span><span className="folder-title">Semestre actual · {p}</span><span className="folder-badge">{list.length} horario{list.length !== 1 ? 's' : ''}</span></div>
            {list.map(s => <Card key={s.id} s={s} />)}</div>)}
        {archived.length > 0 && <div>
          <div className="semester-folder-header archived-folder" style={{ cursor: 'pointer' }} onClick={() => setShowArch(!showArch)}>
            <span className="folder-icon">🗄️</span><span className="folder-title">Semestres anteriores</span><span className="folder-badge">{archived.length} horario{archived.length !== 1 ? 's' : ''}</span><span className="folder-toggle-icon">{showArch ? '▼' : '▶'}</span></div>
          {showArch && <div id="archivedContent">{Object.entries(group(archived)).map(([p, list]) => <div key={p}><div className="archived-period-label">📅 {p}</div>{list.map(s => <Card key={s.id} s={s} arch />)}</div>)}</div>}
        </div>}
      </>}

      {builder && <Builder data={data} update={update} init={builder} onClose={() => setBuilder(null)} />}
      {view && <ScheduleViewer data={data} schedule={view} onClose={() => setView(null)} />}
    </>
  );
}
