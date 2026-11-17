import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import CpModal from './CpModal';
import { findCp } from '../lib/cp';

const COLORS = {
  'DISCIPLINAR OBLIGATORIA': ['#e3f2fd', '#1976d2'], 'DISCIPLINAR OPTATIVA': ['#e8f5e9', '#388e3c'],
  'FUNDAMENTACIÓN OBLIGATORIA': ['#fff8e1', '#f9a825'], 'FUNDAMENTACIÓN OPTATIVA': ['#fce4ec', '#e91e63'],
  'LIBRE ELECCIÓN': ['#f3e5f5', '#7b1fa2'], 'TRABAJO DE GRADO': ['#e8eaf6', '#3f51b5'], 'NIVELACIÓN': ['#fff3e0', '#ff6f00']
};
const CW = 176, CH = 82, GAP = 32, CG = 10, HH = 48, PAD = 16;
const HEAD = { completed: '#2e7d32', current: '#f9a825', pending: '#90a4ae' };

function Generated({ data, update }) {
  const { studyPlan: plan, contenidoProgramatico: cp = [], mallaPrereqs: pre = {} } = data;
  const [info, setInfo] = useState(null), [target, setTarget] = useState(null);
  const nums = Object.keys(plan).filter(n => plan[n].subjects?.length).sort((a, b) => a - b);
  if (!nums.length) return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}><div style={{ fontSize: '3rem' }}>📋</div><h3>No hay materias cargadas</h3><p>Carga tu CSV desde Resumen General primero.</p></div>;

  const pos = {}, W = nums.length * (CW + GAP) - GAP + PAD * 2;
  const Hh = HH + Math.max(...nums.map(n => plan[n].subjects.length)) * (CH + CG) + PAD * 2;
  nums.forEach((n, c) => plan[n].subjects.forEach((s, i) => { pos[s.id] = { l: PAD + c * (CW + GAP), t: PAD + HH + i * (CH + CG), sem: n, s }; }));
  const nameOf = id => pos[id]?.s.name || id;

  const click = id => {
    if (target) {
      if (id !== target) { const cur = pre[target] || []; if (!cur.includes(id)) update({ mallaPrereqs: { ...pre, [target]: [...cur, id] } }); }
      setTarget(null); return;
    }
    setInfo(id);
  };
  const removeAll = id => { const p = { ...pre }; delete p[id]; update({ mallaPrereqs: p }); };
  const sub = info && pos[info]?.s, cpItem = sub && findCp(cp, sub);
  const PrereqPanel = () => (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>🔗 Prerrequisitos en la malla</div>
      {(pre[info] || []).length ? (pre[info] || []).map(p => <span key={p} style={{ display: 'inline-block', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '2px 8px', margin: '2px 3px 2px 0', fontSize: '.78rem' }}>{nameOf(p)}</span>) : <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>Sin prerrequisitos asignados.</span>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => { setTarget(info); setInfo(null); }}>🔗 + Agregar prereq</button>
        {(pre[info] || []).length > 0 && <button className="btn btn-danger btn-sm" onClick={() => { removeAll(info); setInfo(null); }}>🗑 Quitar prereqs</button>}
      </div>
    </div>);

  return (
    <>
      <div className="mgc-scroll-container"><div id="mallaGeneradaContainer" style={{ position: 'relative', width: W, height: Hh }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1, overflow: 'visible' }} width={W} height={Hh}>
          <defs><marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#e91e63" opacity=".85" /></marker></defs>
          {Object.entries(pre).flatMap(([t, srcs]) => srcs.map(sId => {
            const a = pos[sId], b = pos[t]; if (!a || !b) return null;
            const x1 = a.l + CW, y1 = a.t + CH / 2, x2 = b.l, y2 = b.t + CH / 2, dx = Math.abs(x2 - x1) * .45;
            return <path key={sId + t} d={`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`} stroke="#e91e63" strokeWidth="1.8" fill="none" opacity=".75" markerEnd="url(#arr)" />;
          }))}
        </svg>
        {nums.map((n, c) => (
          <div key={n} style={{ position: 'absolute', left: PAD + c * (CW + GAP), top: PAD, width: CW, background: HEAD[plan[n].status] || HEAD.pending, color: '#fff', borderRadius: '8px 8px 0 0', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', fontWeight: 700, zIndex: 2 }}>
            <span>Semestre {n}</span><span style={{ opacity: .9 }}>{plan[n].subjects.reduce((s, x) => s + x.credits, 0)} cr</span>
          </div>))}
        {Object.entries(pos).map(([id, { l, t, sem, s }]) => {
          const [bg, bd] = COLORS[s.type] || COLORS['DISCIPLINAR OBLIGATORIA'], st = plan[sem].status;
          return (
            <div key={id} className={'mgc-card' + (st === 'completed' ? ' mgc-card--completed' : st === 'current' ? ' mgc-card--current' : '')} onClick={() => click(id)}
              title={`${s.name} · ${s.type} · ${s.credits} créditos`} style={{ left: l, top: t, width: CW, height: CH, '--tc-bg': bg, '--tc-border': bd, outline: target === id ? '3px dashed #e91e63' : undefined }}>
              <div className="mgc-card-name">{st === 'completed' ? '✓ ' : st === 'current' ? '▶ ' : ''}{s.name.length > 44 ? s.name.slice(0, 42) + '…' : s.name}</div>
              <div className="mgc-card-footer"><span className="mgc-cr-badge">{s.credits} cr</span>{(pre[id] || []).length > 0 && <span className="mgc-prereq-badge">📌{pre[id].length}</span>}<span className="mgc-type-abbr">{s.type.split(' ').map(w => w[0]).join('')}</span></div>
            </div>);
        })}
      </div></div>
      {target && <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1a237e', color: '#fff', padding: '10px 20px', borderRadius: 24, zIndex: 1000, fontSize: '.85rem', fontWeight: 600 }}>
        🔗 Haz clic en la materia que es <strong>prerrequisito</strong> de «{nameOf(target)}» <button onClick={() => setTarget(null)} style={{ marginLeft: 12, background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', padding: '3px 10px', borderRadius: 12, cursor: 'pointer' }}>✕ Cancelar</button></div>}
      {sub && (cpItem ? <CpModal item={cpItem} onClose={() => setInfo(null)}><PrereqPanel /></CpModal> :
        <Modal title={sub.name} onClose={() => setInfo(null)}><p style={{ color: 'var(--text-secondary)' }}>{sub.credits} créditos · {sub.type} · Sem. {pos[info].sem}</p><PrereqPanel /></Modal>)}
    </>
  );
}

function PdfViewer({ data, update, user }) {
  const url = data.mallaPdfURL, [doc, setDoc] = useState(null), [err, setErr] = useState(''), [scale, setScale] = useState(1), [busy, setBusy] = useState(false);
  const cv = useRef(), wrap = useRef();
  useEffect(() => {
    let off = false; setDoc(null); setErr('');
    if (!url) return;
    (async () => {
      try {
        const mod = await import('pdfjs-dist/build/pdf'); const pdfjs = mod.getDocument ? mod : mod.default;
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default;
        const buf = await (await fetch(url)).arrayBuffer();
        const d = await pdfjs.getDocument({ data: buf }).promise;
        if (!off) setDoc(d);
      } catch (e) { console.error(e); if (!off) setErr('Error al leer el PDF. Intenta cargarlo de nuevo.'); }
    })();
    return () => { off = true; };
  }, [url]);
  useEffect(() => {
    if (!doc) return; let task;
    doc.getPage(1).then(p => { const dpr = window.devicePixelRatio || 1, vp = p.getViewport({ scale: scale * dpr }), c = cv.current; if (!c) return; c.width = vp.width; c.height = vp.height; c.style.width = Math.round(vp.width / dpr) + 'px'; c.style.height = Math.round(vp.height / dpr) + 'px'; task = p.render({ canvasContext: c.getContext('2d'), viewport: vp }); });
    return () => task?.cancel?.();
  }, [doc, scale]);
  const fit = () => doc?.getPage(1).then(p => setScale((wrap.current.clientWidth - 40) / p.getViewport({ scale: 1 }).width));
  async function upload(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f); fd.append('upload_preset', 'malla_pdf'); // presets unsigned no permiten overwrite/public_id
      const r = await fetch('https://api.cloudinary.com/v1_1/dlzdelkc2/raw/upload', { method: 'POST', body: fd });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.error?.message || 'Cloudinary ' + r.status); }
      update({ mallaPdfURL: (await r.json()).secure_url, mallaPdfFileName: f.name });
    } catch (e2) { console.error(e2); alert('Error al subir el PDF: ' + e2.message); } finally { setBusy(false); }
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <label className="btn btn-secondary" style={{ fontSize: '.82rem' }}>{busy ? '⏳ Subiendo...' : '📂 Cargar PDF de mi malla'}<input type="file" accept=".pdf" hidden onChange={upload} disabled={busy} /></label>
        {data.mallaPdfFileName && <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>📄 {data.mallaPdfFileName}</span>}
        {url && <button className="btn btn-danger btn-sm" onClick={() => confirm('¿Quitar el PDF cargado?') && update({ mallaPdfURL: null, mallaPdfFileName: null })}>🗑 Quitar</button>}
      </div>
      <div className="malla-toolbar"><div className="malla-toolbar-group">
        <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ZOOM:</span>
        <button className="malla-tool-btn" onClick={() => setScale(s => Math.max(.5, s - .25))}>−</button><span className="malla-zoom-label">{Math.round(scale * 100)}%</span>
        <button className="malla-tool-btn" onClick={() => setScale(s => Math.min(4, s + .25))}>+</button><button className="malla-tool-btn" onClick={fit}>⊡ Ajustar</button>
      </div></div>
      <div className="malla-canvas-wrapper" ref={wrap}>
        {!url ? <div className="malla-error"><div style={{ fontSize: '3rem' }}>📄</div><p>Aún no has cargado tu malla curricular (PDF).</p></div>
          : err ? <div className="malla-error">⚠️ {err}</div>
          : !doc ? <div className="malla-loading"><div className="malla-spinner" /><span>Cargando PDF...</span></div>
          : <div className="malla-canvas-stack"><canvas ref={cv} /></div>}
      </div>
    </>
  );
}

export default function Malla({ data, update, user }) {
  const [tab, setTab] = useState('gen');
  const plan = data.studyPlan;
  let d = 0, c = 0, t = 0;
  Object.values(plan).forEach(s => s.subjects.forEach(() => { t++; if (s.status === 'completed') d++; else if (s.status === 'current') c++; }));
  const types = [...new Set(Object.values(plan).flatMap(s => s.subjects.map(x => x.type)))];
  return (
    <>
      <div className="header-bar"><div className="header-controls">
        <div><h2 style={{ marginBottom: 4 }}>Malla Curricular</h2><p className="text-secondary" style={{ fontSize: '.85rem' }}>El estado se toma automáticamente de tu plan · Asigna prerrequisitos con clic en una materia</p></div>
        <span className="malla-stats-bar">✅ {d} completadas  •  ▶ {c} en curso  •  {t - d - c} pendientes</span>
      </div></div>
      <div className="malla-tabs">
        <button className={'malla-tab' + (tab === 'gen' ? ' active' : '')} onClick={() => setTab('gen')}>🗺️ Malla Generada</button>
        <button className={'malla-tab' + (tab === 'pdf' ? ' active' : '')} onClick={() => setTab('pdf')}>📄 Mi PDF (referencia)</button>
      </div>
      {tab === 'gen' ? <>
        <div className="malla-toolbar">
          <div className="malla-toolbar-group"><div className="malla-legend">
            <div className="malla-legend-item"><div className="malla-legend-dot completed" /><span>Completada</span></div>
            <div className="malla-legend-item"><div className="malla-legend-dot current" /><span>En curso</span></div>
            <div className="malla-legend-item"><div className="malla-legend-dot" style={{ background: 'rgba(144,164,174,.35)', borderColor: '#90a4ae' }} /><span>Pendiente</span></div>
            {types.map(x => <div key={x} className="malla-legend-item"><div className="malla-legend-dot" style={{ background: (COLORS[x]?.[1] || '#90a4ae') + '33', borderColor: COLORS[x]?.[1] || '#90a4ae' }} /><span>{x}</span></div>)}
          </div></div>
          <div className="malla-toolbar-group" style={{ borderRight: 'none' }}>
            <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>Clic en una materia para ver detalles y asignar prerrequisitos</span>
            <button className="btn btn-sm btn-danger" onClick={() => confirm('¿Borrar todos los prerrequisitos?') && update({ mallaPrereqs: {} })}>🗑 Borrar prereqs</button>
          </div>
        </div>
        <Generated data={data} update={update} />
      </> : <PdfViewer data={data} update={update} user={user} />}
    </>
  );
}
