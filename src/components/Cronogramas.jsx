import { useCallback, useEffect, useMemo, useState } from 'react';
import { GraduationCap, Folder, X, CalendarDays, Download, Search, ChevronDown, ChevronUp, Plus, ArrowLeft, Users, BookOpen, User, Save, Check, Merge, RefreshCw, TriangleAlert, FolderOpen, Layers } from 'lucide-react';
import { PageHeader, Empty, toast } from '../ui.jsx';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import Modal from './Modal';
import { cdb, ensureCronoAuth, slugify, parseArchivo, categoriaDe, CAT_NAMES } from '../lib/cronogramas';
import { applyHorarios } from '../lib/schedule';
import { norm } from '../lib/plan';

const errText = e => `${e.code || e.message}`;

function Folders({ items, icon, meta, onOpen, onDelete, empty }) {
  if (!items.length) return <Empty icon={FolderOpen} title={empty} />;
  return (
    <div className="cr-folders">{items.map(it => (
      <div key={it.id} className="cr-folder" onClick={() => onOpen(it)}>
        <button className="cr-folder-del" title="Eliminar" aria-label="Eliminar" onClick={e => { e.stopPropagation(); onDelete(it); }}><X /></button>
        <div className="cr-folder-icon">{icon}</div>
        <div className="cr-folder-name">{it.nombre || it.id}</div>
        <div className="cr-folder-meta">{meta(it)}</div>
      </div>))}
    </div>
  );
}

function Visor({ sem, onApply }) {
  const [q, setQ] = useState(''), [cat, setCat] = useState('all'), [shut, setShut] = useState({}), [open, setOpen] = useState({});
  const materias = sem.materias || [];
  const grupos = materias.reduce((s, m) => s + m.grupos.length, 0);
  const present = CAT_NAMES.filter(c => materias.some(m => categoriaDe(m.nombre) === c));
  const ql = norm(q);
  const vis = materias.filter(m => (cat === 'all' || categoriaDe(m.nombre) === cat) &&
    (!ql || norm(m.codigo).includes(ql) || norm(m.nombre).includes(ql) || m.grupos.some(g => norm(g.profesor).includes(ql))));
  const by = {};
  vis.forEach(m => (by[categoriaDe(m.nombre)] ||= []).push(m));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(materias, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `horarios_${slugify(sem.nombre || sem.id)}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="cr-toolbar">
        <div className="cr-stats"><BookOpen /><strong>{materias.length}</strong> materias<Users /><strong>{grupos}</strong> grupos</div>
        <div className="cr-toolbar-actions">
          <button className="btn btn-primary" onClick={onApply}><CalendarDays />Usar en mis horarios</button>
          <button className="btn btn-secondary" onClick={exportJson}><Download />Exportar JSON</button>
        </div>
      </div>
      <div className="search search-block"><Search /><input placeholder="Buscar por código, materia o profesor…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="cr-chips">
        {['all', ...present].map(c => <button key={c} className={'cr-chip' + (cat === c ? ' active' : '')} onClick={() => setCat(c)}>{c === 'all' ? 'Todas' : c}</button>)}
      </div>
      {!vis.length ? <Empty compact icon={Search} title="No se encontraron materias" /> : Object.entries(by).map(([c, ms]) => (
        <div key={c} className="cr-section">
          <div className="cr-section-head" onClick={() => setShut({ ...shut, [c]: !shut[c] })}>
            <span>{c} <span className="cr-count">{ms.length}</span></span>{shut[c] ? <ChevronDown className="flip" /> : <ChevronDown />}
          </div>
          {!shut[c] && <div className="cr-cards">{ms.map(m => {
            const k = m.codigo + m.nombre, isOpen = !!open[k];
            return (
              <div key={k} className={'cr-card' + (isOpen ? ' open' : '')}>
                <div className="cr-card-head" onClick={() => setOpen({ ...open, [k]: !isOpen })}>
                  <div><div className="cr-card-name">{m.nombre}</div><span className="cr-code">{m.codigo}</span> <span className="cr-meta">{m.grupos.length} grupo{m.grupos.length !== 1 ? 's' : ''}</span></div>
                  {isOpen ? <ChevronUp className="cr-chev" /> : <ChevronDown className="cr-chev" />}
                </div>
                {isOpen && <div className="cr-groups">{m.grupos.map((g, i) => (
                  <div key={i} className="cr-group">
                    <div className="cr-group-title">Grupo {g.numero}</div>
                    {g.horarios.map((h, j) => <div key={j} className="cr-slot"><span className="cr-day">{h.dia}</span><span>{h.inicio}{h.fin ? ' - ' + h.fin : ''}</span></div>)}
                    <div className="cr-prof"><User />{g.profesor || 'Por asignar'}</div>
                  </div>))}</div>}
              </div>);
          })}</div>}
        </div>))}
    </>
  );
}

export default function Cronogramas({ data, update, goSchedule }) {
  const [state, setState] = useState({ status: 'loading', err: '' });
  const [carreras, setCarreras] = useState([]), [semestres, setSemestres] = useState([]);
  const [carrera, setCarrera] = useState(null), [sem, setSem] = useState(null);
  const [mCarrera, setMCarrera] = useState(false), [mSem, setMSem] = useState(false), [choice, setChoice] = useState(false);
  const [name, setName] = useState(''), [file, setFile] = useState(null), [msg, setMsg] = useState({ t: '', k: '' });

  const fail = e => { console.error(e); setState({ status: 'error', err: errText(e) }); };
  const loadCarreras = useCallback(async () => {
    setState({ status: 'loading', err: '' });
    try {
      await ensureCronoAuth();
      const s = await getDocs(query(collection(cdb, 'carreras'), orderBy('creadoEn', 'desc')));
      setCarreras(s.docs.map(d => ({ id: d.id, ...d.data() }))); setState({ status: 'ok', err: '' });
    } catch (e) { fail(e); }
  }, []);
  const loadSemestres = useCallback(async id => {
    setState({ status: 'loading', err: '' });
    try {
      const s = await getDocs(query(collection(cdb, 'carreras', id, 'semestres'), orderBy('creadoEn', 'desc')));
      setSemestres(s.docs.map(d => ({ id: d.id, ...d.data() }))); setState({ status: 'ok', err: '' });
    } catch (e) { fail(e); }
  }, []);
  useEffect(() => { loadCarreras(); }, [loadCarreras]);

  const openCarrera = c => { setCarrera(c); setSem(null); loadSemestres(c.id); };
  const back = () => { if (sem) setSem(null); else { setCarrera(null); loadCarreras(); } };
  async function openSem(s) {
    try { const d = await getDoc(doc(cdb, 'carreras', carrera.id, 'semestres', s.id)); if (!d.exists()) { toast('Ese semestre ya no existe.', 'error'); return loadSemestres(carrera.id); } setSem({ id: d.id, ...d.data() }); }
    catch (e) { toast('No se pudo abrir el semestre: ' + errText(e), 'error'); }
  }
  async function delCarrera(c) {
    if (!confirm(`¿Eliminar la carrera "${c.nombre}" y todos sus semestres? Esta acción no se puede deshacer.`)) return;
    try {
      const ss = await getDocs(collection(cdb, 'carreras', c.id, 'semestres'));
      await Promise.all(ss.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(cdb, 'carreras', c.id)); loadCarreras();
    } catch (e) { toast('No se pudo eliminar: ' + errText(e), 'error'); }
  }
  async function delSem(s) {
    if (!confirm(`¿Eliminar el semestre "${s.nombre || s.id}"? Esta acción no se puede deshacer.`)) return;
    try { await deleteDoc(doc(cdb, 'carreras', carrera.id, 'semestres', s.id)); loadSemestres(carrera.id); } catch (e) { toast('No se pudo eliminar: ' + errText(e), 'error'); }
  }
  async function saveCarrera() {
    const n = name.trim();
    if (!n) return setMsg({ t: 'Escribe un nombre.', k: 'error' });
    try { await setDoc(doc(cdb, 'carreras', slugify(n)), { nombre: n, creadoEn: serverTimestamp() }, { merge: true }); setMCarrera(false); loadCarreras(); }
    catch (e) { setMsg({ t: 'Error al guardar: ' + e.message, k: 'error' }); }
  }
  async function saveSem() {
    const n = name.trim();
    if (!n) return setMsg({ t: 'Escribe un nombre para el semestre (ej: 2026-2).', k: 'error' });
    if (!file) return setMsg({ t: 'Selecciona un archivo .csv o .xlsx.', k: 'error' });
    setMsg({ t: 'Leyendo y procesando el archivo...', k: 'loading' });
    try {
      const ms = await parseArchivo(file);
      if (!ms.length) return setMsg({ t: 'No se encontraron materias. Revisa que el archivo tenga columnas de código, materia, grupo, día y horas.', k: 'error' });
      setMsg({ t: 'Guardando...', k: 'loading' });
      const tg = ms.reduce((s, m) => s + m.grupos.length, 0);
      await setDoc(doc(cdb, 'carreras', carrera.id, 'semestres', slugify(n)), { nombre: n, creadoEn: serverTimestamp(), materias: ms, totalMaterias: ms.length, totalGrupos: tg, archivoOriginalNombre: file.name });
      setMsg({ t: `Guardado: ${ms.length} materias, ${tg} grupos.`, k: 'ok' });
      setTimeout(() => { setMSem(false); loadSemestres(carrera.id); }, 800);
    } catch (e) { console.error(e); setMsg({ t: 'Error al procesar o guardar: ' + e.message, k: 'error' }); }
  }
  function apply(mode) {
    setChoice(false);
    const r = applyHorarios(data, update, sem.materias || [], mode);
    toast(`${r.total} materias en tus horarios (${r.found} coinciden con tu banco)`); goSchedule();
  }
  const hasHorarios = (data.horariosData || []).length > 0;

  const crumbs = <span className="cr-crumbs">{carrera ? <><b>{carrera.nombre}</b>{sem && <> / {sem.nombre || sem.id}</>}</> : 'Elige una carrera'}</span>;
  return (
    <>
      <PageHeader title="Cronogramas" subtitle={crumbs}>
        {carrera && <button className="btn btn-secondary" onClick={back}><ArrowLeft /><span>Volver</span></button>}
        {!carrera && <button className="btn btn-primary" onClick={() => { setName(''); setMsg({ t: '', k: '' }); setMCarrera(true); }}><Plus /><span>Nueva carrera</span></button>}
        {carrera && !sem && <button className="btn btn-primary" onClick={() => { setName(''); setFile(null); setMsg({ t: '', k: '' }); setMSem(true); }}><Plus /><span>Subir semestre</span></button>}
      </PageHeader>

      {state.status === 'loading' && !sem && <div className="boot boot-inline"><div className="boot-spin" /><span>Cargando…</span></div>}
      {state.status === 'error' && <Empty icon={TriangleAlert} title="No se pudo conectar"><p>({state.err}) Revisa tu conexión y que el login Anónimo esté habilitado en el proyecto cronogramas-general-unal.</p><button className="btn btn-primary" onClick={() => (carrera ? loadSemestres(carrera.id) : loadCarreras())}><RefreshCw />Reintentar</button></Empty>}
      {state.status === 'ok' && !carrera && <Folders items={carreras} icon={<GraduationCap />} meta={() => 'Toca para ver los semestres'} onOpen={openCarrera} onDelete={delCarrera} empty='Aún no has creado ninguna carrera. Usa «Nueva carrera» para empezar.' />}
      {state.status === 'ok' && carrera && !sem && <Folders items={semestres} icon={<Folder />} meta={s => `${s.totalMaterias ?? '-'} materias · ${s.totalGrupos ?? '-'} grupos`} onOpen={openSem} onDelete={delSem} empty='Esta carrera aún no tiene semestres. Usa «Subir semestre».' />}
      {sem && <Visor sem={sem} onApply={() => (hasHorarios ? setChoice(true) : apply('replace'))} />}

      {mCarrera && <Modal title="Nueva carrera" onClose={() => setMCarrera(false)}>
        <div className="form-group"><label className="form-label">Nombre de la carrera</label><input className="form-control" autoFocus placeholder="ej: Diseño Gráfico" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveCarrera()} /></div>
        {msg.t && <div className={'cr-msg ' + msg.k}>{msg.t}</div>}
        <div className="form-actions"><button className="btn btn-primary" onClick={saveCarrera}><Save />Guardar</button><button className="btn btn-secondary" onClick={() => setMCarrera(false)}>Cancelar</button></div>
      </Modal>}
      {mSem && <Modal title="Subir nuevo semestre" onClose={() => setMSem(false)}>
        <div className="form-group"><label className="form-label">Nombre del semestre</label><input className="form-control" autoFocus placeholder="ej: 2026-2" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Archivo (.csv o .xlsx)</label><input className="form-control" type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files[0] || null)} />
          <p className="hint">Debe tener columnas como Código, Asignatura, Grupo, Día, Hora Inicio, Hora Final y Docente (en cualquier orden).</p></div>
        {msg.t && <div className={'cr-msg ' + msg.k}>{msg.t}</div>}
        <div className="form-actions"><button className="btn btn-primary" onClick={saveSem} disabled={msg.k === 'loading'}><Save />Procesar y guardar</button><button className="btn btn-secondary" onClick={() => setMSem(false)}>Cancelar</button></div>
      </Modal>}
      {choice && <Modal title="Usar en mi planificador" onClose={() => setChoice(false)}>
        <p className="muted" style={{ marginBottom: 16 }}>Ya tienes <strong>{(data.horariosData || []).length}</strong> materias con horarios cargadas. ¿Qué quieres hacer con las de <strong>{sem?.nombre}</strong>?</p>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={() => apply('merge')}><Layers />Combinar (doble programa)</button>
          <button className="btn btn-secondary" onClick={() => apply('replace')}><RefreshCw />Reemplazar</button>
          <button className="btn btn-secondary" onClick={() => setChoice(false)}>Cancelar</button>
        </div>
        <p className="hint">Combinar conserva lo ya cargado y agrega o actualiza las materias de este cronograma por nombre.</p>
      </Modal>}
    </>
  );
}
