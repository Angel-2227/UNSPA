import { useEffect, useMemo, useState } from 'react';
import { Upload, Plus, Pencil, Archive, ArchiveRestore, Eye, Trash2, FolderOpen, Folder, CalendarDays, Search, User, ChevronDown, ChevronRight, TriangleAlert, Check, Save, Clock, Library, Pin, CalendarRange, Settings2, MapPin } from 'lucide-react';
import { PageHeader, Menu, Empty, toast } from '../ui.jsx';
import Modal from './Modal';
import { norm, mapPlan, uid } from '../lib/plan';
import { semLabel } from '../lib/double';
import { DAY_BY_INDEX, applyHorarios, groupsFor, findSubject, buildBlocks, layout, conflicts, hasConflict, shortProf, startMin, canonDay, roomKey, roomText } from '../lib/schedule';

const useNow = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  return now;
};
const nowText = now => `${DAY_BY_INDEX[now.getDay()]}, ${now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
const isNowIn = (b, now) => canonDay(DAY_BY_INDEX[now.getDay()]) === b.dia && now.getHours() * 60 + now.getMinutes() >= startMin(b.inicio) && now.getHours() * 60 + now.getMinutes() < startMin(b.fin);

// ── Visor del horario guardado: solo los días con clase y solo las horas donde hay clase ──
export function ScheduleViewer({ data, schedule, onClose, update }) {
  const now = useNow(), [editRooms, setEditRooms] = useState(false);
  const blocks = useMemo(() => buildBlocks(data, schedule.subjects, schedule.rooms), [data, schedule]);
  const missing = blocks.filter(b => !roomText(b)).length;
  const { days, hours } = layout(blocks);
  const today = canonDay(DAY_BY_INDEX[now.getDay()]);
  const base = hours[0];
  return (
    <Modal id="currentScheduleModal" title={schedule.name} subtitle={nowText(now)} onClose={onClose} wide={1200}>
      <div id="currentScheduleContent">
        {update && blocks.length > 0 && (
          <div className="rooms-bar">
            <button className="btn btn-secondary btn-sm" onClick={() => setEditRooms(true)}><MapPin />Editar salones</button>
            {missing > 0 && <span className="muted">{missing} clase{missing !== 1 ? 's' : ''} sin salón</span>}
          </div>)}
        <div className="schedule-grid-wrapper">
          <div className="schedule-grid-viewer" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(90px, 1fr))`, minWidth: 56 + days.length * 90 }}>
            <div className="schedule-cell-viewer header scv-corner" style={{ gridRow: 1, gridColumn: 1 }} />
            {days.map((d, c) => (
              <div key={d} className="schedule-cell-viewer header" style={{ gridRow: 1, gridColumn: c + 2 }}>
                {d}
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
                {roomText(b) && <div className="class-block-room">{roomText(b)}</div>}
                <div className="class-block-prof">{shortProf(b.grupo.profesor)}</div>
              </div>))}
          </div>
        </div>
        {!blocks.length && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>Este horario no tiene clases con horario disponible (¿cargaste el archivo de horarios?).</p>}
      </div>
      {editRooms && <RoomsModal data={data} schedule={schedule} blocks={blocks} update={update} onClose={() => setEditRooms(false)} />}
    </Modal>
  );
}

// ── Editor de salón y edificio por clase (una fila por materia y día) ──
function RoomsModal({ data, schedule, blocks, update, onClose }) {
  const rows = useMemo(() => { // una entrada por materia + día
    const seen = new Map();
    blocks.forEach(b => { const k = roomKey(b.id, b.dia); if (!seen.has(k)) seen.set(k, { k, b, hours: [] }); seen.get(k).hours.push(`${b.inicio}–${b.fin}`); });
    return [...seen.values()];
  }, [blocks]);
  const [vals, setVals] = useState(() => Object.fromEntries(rows.map(r => [r.k, { edificio: r.b.edificio || '', salon: r.b.salon || '' }])));
  const bySubject = useMemo(() => rows.reduce((a, r) => { (a[r.b.id] ||= []).push(r); return a; }, {}), [rows]);
  const known = useMemo(() => [...new Set((data.schedules || []).flatMap(s => Object.values(s.rooms || {}).map(r => r.edificio)).concat(Object.values(vals).map(v => v.edificio)).filter(Boolean))], [data.schedules, vals]);
  const set = (k, f, v) => setVals(x => ({ ...x, [k]: { ...x[k], [f]: v } }));
  const copyAll = list => setVals(x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, list.some(r => r.k === k) ? { ...x[list[0].k] } : v])));

  function save() {
    const rooms = {};
    Object.entries(vals).forEach(([k, v]) => { const e = v.edificio.trim(), s = v.salon.trim(); if (e || s) rooms[k] = { edificio: e, salon: s }; });
    update(prev => ({ schedules: (prev.schedules || []).map(x => (x.id === schedule.id ? { ...x, rooms } : x)) }));
    toast('Salones guardados');
    onClose();
  }

  return (
    <Modal id="roomsModal" z={1200} title="Salón y edificio" subtitle={schedule.name} onClose={onClose}>
      <datalist id="edificios-conocidos">{known.map(e => <option key={e} value={e} />)}</datalist>
      {Object.values(bySubject).map(list => (
        <div key={list[0].b.id} className="rooms-subject">
          <h4><span>{list[0].b.subject.name}</span>
            {list.length > 1 && <button className="btn btn-secondary btn-sm" onClick={() => copyAll(list)}>Mismo salón todos los días</button>}
          </h4>
          {list.map(r => (
            <div key={r.k} className="rooms-row">
              <div className="rooms-day">{r.b.dia}<small>{r.hours.join(', ')}</small></div>
              <input className="form-control" list="edificios-conocidos" placeholder="Edificio (ej: 404)" value={vals[r.k].edificio} onChange={e => set(r.k, 'edificio', e.target.value)} />
              <input className="form-control" placeholder="Salón (ej: 212)" value={vals[r.k].salon} onChange={e => set(r.k, 'salon', e.target.value)} />
            </div>))}
        </div>))}
      <div className="form-actions">
        <button className="btn btn-primary" onClick={save}><Save />Guardar salones</button>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
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
      {bad.size > 0 && <div className="conflict-warning"><TriangleAlert />Hay conflictos de horario entre las materias seleccionadas</div>}
      <div className="schedule-preview-grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div className="spg-cell spg-corner" style={{ gridRow: 1, gridColumn: 1 }} />
        {days.map((d, c) => <div key={d} className={'spg-cell spg-header' + (d === today ? ' spg-today' : '')} style={{ gridRow: 1, gridColumn: c + 2 }}>{days.length <= 3 ? d : d.substring(0, 3)}</div>)}
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
              <span className={'sem-badge ' + (isOther ? 'other-sem' : 'current-sem')}>{isOther ? semLabel(data, s.semester) : `${semLabel(data, s.semester)} • Cursando`}</span>
              <span>{s.credits} créditos</span>{s.code && <span style={{ opacity: .7 }}>{s.code}</span>}
            </div>
          </div>
          <ChevronDown className={'expand-icon' + (open ? ' expanded' : '')} />
        </div>
        <div className={'group-selector' + (open ? ' visible' : '')}>
          {gs.map(({ g, i }) => (
            <div key={i} className={'group-option' + (selected[s.id] === i ? ' selected' : '')} onClick={e => { e.stopPropagation(); pick(s, i, isOther); }}>
              <strong>Grupo {g.numero}</strong><small><User />{g.profesor || 'Por asignar'}</small>
              <small><Clock />{(g.horarios || []).map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ')}</small>
            </div>))}
        </div>
      </div>
    );
  };

  function save() {
    if (!name.trim()) return toast('Debes darle un nombre al horario', 'error');
    const sch = { id: init.id || uid(), name: name.trim(), period: pc.period || '', subjects: { ...selected }, createdAt: new Date().toISOString() };
    const old = schedules.find(x => x.id === init.id);
    const list = init.id ? schedules.map(x => (x.id === init.id ? { ...old, ...sch, createdAt: old?.createdAt || sch.createdAt } : x)) : [...schedules, sch];
    const set = {};
    Object.entries(selected).forEach(([id, i]) => { const s = findSubject(data, id), g = s && groupsFor(data, s)[i]; if (g) set[id] = { name: s.name, group: String(g.numero), professor: g.profesor }; });
    const apply = x => { const m = set[x.id] || Object.values(set).find(v => norm(v.name) === norm(x.name)); return m ? { ...x, group: m.group, professor: m.professor } : x; };
    update({ schedules: list, studyPlan: mapPlan(plan, apply), subjectBank: bank.map(apply) });
    toast('Horario guardado');
    onClose();
  }

  return (
    <Modal id="scheduleModal" title={init.id ? 'Editar horario' : 'Nuevo horario'} onClose={onClose} wide={900}>
      <div className="schedule-filters">
        <div className="search"><Search /><input placeholder="Materia" value={fS} onChange={e => setFS(e.target.value)} /></div>
        <div className="search"><User /><input placeholder="Profesor" value={fP} onChange={e => setFP(e.target.value)} /></div>
        <div className="search"><Clock /><input placeholder="Horario (ej: LUNES, 7:00)" value={fH} onChange={e => setFH(e.target.value)} /></div>
      </div>
      <div id="scheduleBuilder">
        <div className="form-group"><label className="form-label">Nombre del horario</label><input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="Mi horario 2026-1" /></div>
        <h4 className="sec-title">Selecciona materias y grupos</h4>
        <div id="subjectSelector">
          {!cur.length && !other.length ? <Empty compact icon={CalendarRange} title="No hay materias con horarios"><p>Carga el archivo de horarios (o usa un cronograma) al menos una vez.</p></Empty> : <>
            {cur.length ? <><div className="sem-section-label"><Library />Materias del semestre actual</div>{cur.map(s => <Card key={s.id} s={s} />)}</>
              : <div className="sem-section-label" style={{ opacity: .6 }}>Sin materias con horario para el semestre marcado como "Cursando"</div>}
            {other.length > 0 && <>
              <div className="other-sems-toggle" onClick={() => setShowOther(!showOther)}>{showOther ? <ChevronDown /> : <ChevronRight />} Ver otras materias ({other.length} de semestres pendientes)</div>
              {showOther && <div><div className="sem-section-label other"><Library />Otras materias disponibles<span className="sem-section-note">Agregarlas actualizará su semestre en la malla</span></div>{other.map(s => <Card key={s.id} s={s} isOther />)}</div>}
            </>}
          </>}
        </div>
        <div className="preview-wrap"><h4 className="sec-title">Vista previa</h4><Preview data={data} selected={selected} /></div>
      </div>
      <div className="form-actions form-actions-sticky">
        <button className="btn btn-primary" onClick={save}><Save />Guardar horario</button>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
      </div>
      {sync && <Modal id="syncConfirmModal" z={1200} title="Agregar materia de otro semestre" onClose={() => setSync(null)}>
        <p className="muted">Estás agregando <strong>{sync.s.name}</strong> ({semLabel(data, sync.s.semester)}) al horario actual. Esto <strong>marcará ese semestre como «Cursando»</strong> en tu malla.</p>
        <div className="note-box"><Pin />Grupo {sync.s.groups[sync.i].numero} · {sync.s.groups[sync.i].profesor}<br />{(sync.s.groups[sync.i].horarios || []).map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ')}</div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={confirmSync}><Check />Confirmar y agregar</button>
          <button className="btn btn-secondary" onClick={() => setSync(null)}>Cancelar</button>
        </div>
      </Modal>}
    </Modal>
  );
}

export default function Schedule({ data, update, goCronos }) {
  const { schedules = [], currentPeriodConfig: pc = {}, studyPlan: plan, subjectBank: bank = [], horariosData = [] } = data;
  const [form, setForm] = useState({ period: pc.period || '', startDate: pc.startDate || '', endDate: pc.endDate || '' });
  const [editPeriod, setEditPeriod] = useState(false);
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
        const r = applyHorarios(data, update, hd, 'replace');
        toast(`${r.total} materias cargadas (${r.found} coinciden con tu banco)`);
      } catch (err) { toast('Error al cargar el archivo: ' + err.message, 'error'); }
    };
    r.readAsText(f);
  }
  const create = () => { if (!hasAny) return toast('Primero carga el archivo de horarios o usa un cronograma.', 'error'); setBuilder({ id: null, name: `Horario ${pc.period || ''}`.trim(), selected: {} }); };
  const edit = s => { if (!hasAny) return toast('Para editar el horario necesitas cargar el archivo de horarios.', 'error'); setBuilder({ id: s.id, name: s.name, selected: { ...s.subjects } }); };
  const patch = (id, p) => update({ schedules: schedules.map(s => (s.id === id ? { ...s, ...p } : s)) });
  const archive = s => confirm(`¿Archivar el horario "${s.name}" en semestres anteriores?`) && patch(s.id, { archived: true, archivedAt: new Date().toISOString() });
  const unarchive = s => { const { archived, archivedAt, ...rest } = s; update({ schedules: schedules.map(x => (x.id === s.id ? rest : x)) }); };
  const del = s => confirm('¿Eliminar este horario permanentemente?') && update({ schedules: schedules.filter(x => x.id !== s.id) });
  const group = list => list.reduce((a, s) => { (a[s.period || 'Sin periodo'] ||= []).push(s); return a; }, {});

  const Card = ({ s, arch }) => {
    const n = Object.keys(s.subjects || {}).length;
    return (
      <div className={'schedule-card' + (arch ? ' schedule-card-archived' : '')}>
        <div className="sch-main">
          <h3>{s.name}</h3>
          <p>{n} materia{n !== 1 ? 's' : ''}{s.period ? ` · ${s.period}` : ''}{arch && s.archivedAt && ` · archivado el ${new Date(s.archivedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`}</p>
        </div>
        <div className="sch-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setView(s)}><Eye /><span>Ver</span></button>
          {!arch && <button className="icon-btn" title="Editar" aria-label="Editar" onClick={() => edit(s)}><Pencil /></button>}
          {!arch ? <button className="icon-btn" title="Archivar" aria-label="Archivar" onClick={() => archive(s)}><Archive /></button>
            : <button className="icon-btn" title="Restaurar" aria-label="Restaurar" onClick={() => unarchive(s)}><ArchiveRestore /></button>}
          <button className="icon-btn danger" title="Eliminar" aria-label="Eliminar" onClick={() => del(s)}><Trash2 /></button>
        </div>
      </div>);
  };
  const active = schedules.filter(s => !s.archived), archived = schedules.filter(s => s.archived);

  return (
    <>
      <PageHeader title="Mis horarios" subtitle={pc.period ? `Periodo ${pc.period}${pc.startDate ? ` · ${pc.startDate} → ${pc.endDate || '…'}` : ''}` : 'Arma y guarda tu horario del semestre'}>
        <button className="btn btn-primary" onClick={create}><Plus /><span>Nuevo horario</span></button>
        <Menu items={[
          { icon: Upload, label: 'Cargar horarios (JSON)', file: { accept: '.json,.js', onChange: onFile } },
          { icon: FolderOpen, label: 'Ver cronogramas', onClick: goCronos, hidden: !goCronos },
          { icon: Settings2, label: 'Editar periodo académico', onClick: () => setEditPeriod(!editPeriod) }
        ]} />
      </PageHeader>

      {editPeriod && <section className="card period-card">
        <h2 className="card-title"><CalendarRange />Periodo académico</h2>
        <div className="form-row form-row-3">
          <div className="form-group"><label className="form-label">Periodo</label><input className="form-control" placeholder="2026-1" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Inicio</label><input type="date" className="form-control" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Fin</label><input type="date" className="form-control" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
        </div>
        <div className="form-actions"><button className="btn btn-primary" onClick={() => { update({ currentPeriodConfig: form }); setEditPeriod(false); toast('Periodo guardado'); }}><Save />Guardar periodo</button><button className="btn btn-secondary" onClick={() => setEditPeriod(false)}>Cancelar</button></div>
      </section>}

      {!schedules.length ? <Empty icon={CalendarDays} title="Aún no tienes horarios">
        <p>{hasAny ? 'Crea tu primer horario eligiendo materias y grupos.' : 'Primero carga las materias con sus horarios: desde un cronograma o con un archivo JSON.'}</p>
        {hasAny ? <button className="btn btn-primary" onClick={create}><Plus />Nuevo horario</button> : <button className="btn btn-primary" onClick={goCronos}><FolderOpen />Ver cronogramas</button>}
      </Empty> : <>
        {!active.length ? <Empty compact icon={CalendarDays} title="No hay horarios para el semestre actual" />
          : Object.entries(group(active)).map(([p, list]) => <div key={p}>
            <div className="semester-folder-header active-folder"><FolderOpen /><span className="folder-title">Semestre actual · {p}</span><span className="folder-badge">{list.length}</span></div>
            {list.map(s => <Card key={s.id} s={s} />)}</div>)}
        {archived.length > 0 && <div>
          <div className="semester-folder-header archived-folder" role="button" tabIndex={0} onClick={() => setShowArch(!showArch)}>
            <Archive /><span className="folder-title">Semestres anteriores</span><span className="folder-badge">{archived.length}</span>{showArch ? <ChevronDown /> : <ChevronRight />}</div>
          {showArch && <div id="archivedContent">{Object.entries(group(archived)).map(([p, list]) => <div key={p}><div className="archived-period-label">{p}</div>{list.map(s => <Card key={s.id} s={s} arch />)}</div>)}</div>}
        </div>}
      </>}

      {builder && <Builder data={data} update={update} init={builder} onClose={() => setBuilder(null)} />}
      {view && <ScheduleViewer data={data} update={update} schedule={schedules.find(x => x.id === view.id) || view} onClose={() => setView(null)} />}
    </>
  );
}
