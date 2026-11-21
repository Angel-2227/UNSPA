import { useEffect, useRef, useState } from 'react';
import { ChevronDown, List, Network, FileText, Minus, Plus, Maximize2, Link2, Pin, Repeat2, CircleCheck, PlayCircle, Upload, Trash2, TriangleAlert, ClipboardList, X, Loader2 } from 'lucide-react';
import { PageHeader, Seg, Menu, Empty, toast } from '../ui.jsx';
import Modal from './Modal';
import CpModal from './CpModal';
import { findCp } from '../lib/cp';
import { HomologPanel } from './Homolog';

const COLORS = {
  'DISCIPLINAR OBLIGATORIA': ['#e3f2fd', '#1976d2'], 'DISCIPLINAR OPTATIVA': ['#e8f5e9', '#388e3c'],
  'FUNDAMENTACIÓN OBLIGATORIA': ['#fff8e1', '#f9a825'], 'FUNDAMENTACIÓN OPTATIVA': ['#fce4ec', '#e91e63'],
  'LIBRE ELECCIÓN': ['#f3e5f5', '#7b1fa2'], 'TRABAJO DE GRADO': ['#e8eaf6', '#3f51b5'], 'NIVELACIÓN': ['#fff3e0', '#ff6f00']
};
const CW = 176, CH = 82, GAP = 32, CG = 10, HH = 48, PAD = 16;
const HEAD = { completed: '#2e7d32', current: '#f9a825', pending: '#90a4ae' };

function Generated({ data, update, dbl, mode, zoom, setZoom, scroller, fitRef }) {
  const { studyPlan: plan, contenidoProgramatico: cp = [], mallaPrereqs: pre = {} } = data;
  const [info, setInfo] = useState(null), [target, setTarget] = useState(null);
  const [shut, setShut] = useState({});
  const nums = Object.keys(plan).filter(n => plan[n].subjects?.length).sort((a, b) => a - b);
  if (!nums.length) return <Empty icon={ClipboardList} title="No hay materias cargadas"><p>Carga tu plan (CSV) desde <strong>Mi plan</strong> primero.</p></Empty>;

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
    <div className="prereq-panel">
      <div className="prereq-title"><Link2 />Prerrequisitos en la malla</div>
      {(pre[info] || []).length ? (pre[info] || []).map(p => <span key={p} className="pre-chip">{nameOf(p)}</span>) : <span className="muted-sm">Sin prerrequisitos asignados.</span>}
      <div className="form-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => { setTarget(info); setInfo(null); }}><Plus />Agregar prerrequisito</button>
        {(pre[info] || []).length > 0 && <button className="btn btn-danger btn-sm" onClick={() => { removeAll(info); setInfo(null); }}><Trash2 />Quitar prerrequisitos</button>}
      </div>
      {sub && <HomologPanel dbl={dbl} subject={sub} />}
    </div>);

  fitRef.current = () => setZoom(Math.min(1.2, Math.max(.3, ((scroller.current?.clientWidth || W) - 4) / W)));
  const stCls = st => (st === 'completed' ? ' mgl-card--completed' : st === 'current' ? ' mgl-card--current' : '');

  return (
    <>
      {mode === 'list' ? (
        <div className="mgl">{nums.map(n => {
          const sem = plan[n], closed = shut[n];
          return (
            <div key={n} className="mgl-sem">
              <div className="mgl-head" style={{ background: HEAD[sem.status] || HEAD.pending }} onClick={() => setShut({ ...shut, [n]: !closed })}>
                <span>Semestre {n} · {sem.subjects.length} materias</span><span>{sem.subjects.reduce((a, x) => a + x.credits, 0)} cr<ChevronDown className={'mgl-chev' + (closed ? '' : ' open')} /></span>
              </div>
              {!closed && <div className="mgl-grid">{sem.subjects.map(sb => {
                const [bg, bd] = COLORS[sb.type] || COLORS['DISCIPLINAR OBLIGATORIA'];
                return (
                  <div key={sb.id} className={'mgl-card' + stCls(dbl.eff.get(sb.id) || sem.status)} onClick={() => click(sb.id)} style={{ '--tc-bg': bg, '--tc-border': bd, outline: target === sb.id ? '3px dashed #e91e63' : undefined }}>
                    <div className="mgl-card-name">{(dbl.eff.get(sb.id) || sem.status) === 'completed' ? <CircleCheck className="mgc-st" /> : (dbl.eff.get(sb.id) || sem.status) === 'current' ? <PlayCircle className="mgc-st" /> : null}{sb.name}</div>
                    <div className="mgl-card-foot"><span className="mgc-cr-badge">{sb.credits} cr</span><span className="mgl-type">{sb.type}</span></div>
                    {(() => { const lk = dbl.linkOf(sb.id); return lk && <div className="mgl-hm"><Repeat2 />{lk.partner.subject.name} · {dbl.names[lk.partner.career]}</div>; })()}
                    {(pre[sb.id] || []).length > 0 && <div className="mgl-pre"><Pin />{(pre[sb.id] || []).map(nameOf).join(', ')}</div>}
                  </div>);
              })}</div>}
            </div>);
        })}</div>
      ) : (
      <div className="mgc-scroll-container" ref={scroller}><div style={{ width: W * zoom, height: Hh * zoom, position: 'relative' }}><div id="mallaGeneradaContainer" style={{ position: 'relative', width: W, height: Hh, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
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
          const [bg, bd] = COLORS[s.type] || COLORS['DISCIPLINAR OBLIGATORIA'], st = dbl.eff.get(id) || plan[sem].status, lk = dbl.linkOf(id);
          return (
            <div key={id} className={'mgc-card' + (st === 'completed' ? ' mgc-card--completed' : st === 'current' ? ' mgc-card--current' : '')} onClick={() => click(id)}
              title={`${s.name} · ${s.type} · ${s.credits} créditos`} style={{ left: l, top: t, width: CW, height: CH, '--tc-bg': bg, '--tc-border': bd, outline: target === id ? '3px dashed #e91e63' : undefined }}>
              <div className="mgc-card-name">{st === 'completed' ? <CircleCheck className="mgc-st" /> : st === 'current' ? <PlayCircle className="mgc-st" /> : null}{s.name.length > 44 ? s.name.slice(0, 42) + '…' : s.name}</div>
              <div className="mgc-card-footer"><span className="mgc-cr-badge">{s.credits} cr</span>{(pre[id] || []).length > 0 && <span className="mgc-prereq-badge"><Pin />{pre[id].length}</span>}{lk && <span className="mgc-prereq-badge mgc-hm-badge" title={lk.partner.subject.name}><Repeat2 /></span>}<span className="mgc-type-abbr">{s.type.split(' ').map(w => w[0]).join('')}</span></div>
            </div>);
        })}
      </div></div></div>
      )}
      {target && <div className="target-bar"><Link2 /><span>Toca la materia que es <strong>prerrequisito</strong> de «{nameOf(target)}»</span><button onClick={() => setTarget(null)}><X />Cancelar</button></div>}
      {sub && (cpItem ? <CpModal item={cpItem} onClose={() => setInfo(null)}><PrereqPanel /></CpModal> :
        <Modal title={sub.name} onClose={() => setInfo(null)}><p style={{ color: 'var(--text-secondary)' }}>{sub.credits} créditos · {sub.type} · Sem. {pos[info].sem}</p><PrereqPanel /></Modal>)}
    </>
  );
}

function PdfViewer({ data, update }) {
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
    } catch (e2) { console.error(e2); toast('Error al subir el PDF: ' + e2.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="mg-pdfbar">
        <label className="btn btn-secondary btn-sm">{busy ? <Loader2 className="spin" /> : <Upload />}{busy ? 'Subiendo…' : url ? 'Reemplazar PDF' : 'Cargar PDF de mi malla'}<input type="file" accept=".pdf" hidden onChange={upload} disabled={busy} /></label>
        {data.mallaPdfFileName && <span className="mg-pdfname"><FileText />{data.mallaPdfFileName}</span>}
        {url && <button className="btn btn-danger-soft btn-sm" onClick={() => confirm('¿Quitar el PDF cargado?') && update({ mallaPdfURL: null, mallaPdfFileName: null })}><Trash2 />Quitar</button>}
        <span className="grow" />
        <div className="mg-zoom">
          <button aria-label="Alejar" onClick={() => setScale(s => Math.max(.5, s - .25))}><Minus /></button><span>{Math.round(scale * 100)}%</span>
          <button aria-label="Acercar" onClick={() => setScale(s => Math.min(4, s + .25))}><Plus /></button><button aria-label="Ajustar al ancho" onClick={fit}><Maximize2 /></button>
        </div>
      </div>
      <div className="malla-canvas-wrapper" ref={wrap}>
        {!url ? <div className="malla-error"><FileText /><p>Aún no has cargado tu malla curricular (PDF).</p></div>
          : err ? <div className="malla-error"><TriangleAlert /><p>{err}</p></div>
          : !doc ? <div className="malla-loading"><div className="malla-spinner" /><span>Cargando PDF…</span></div>
          : <div className="malla-canvas-stack"><canvas ref={cv} /></div>}
      </div>
    </>
  );
}

export default function Malla({ data, update, user, dbl }) {
  const [mode, setMode] = useState(() => (window.innerWidth < 900 ? 'list' : 'map')), [zoom, setZoom] = useState(1);
  const scroller = useRef(), fitRef = useRef();
  const plan = data.studyPlan;
  let d = 0, c = 0, t = 0;
  Object.values(plan).forEach(s => s.subjects.forEach(x => { t++; const st = dbl.eff.get(x.id) || s.status; if (st === 'completed') d++; else if (st === 'current') c++; }));
  const types = [...new Set(Object.values(plan).flatMap(s => s.subjects.map(x => x.type)))];
  const Z = v => setZoom(z => Math.min(1.6, Math.max(.3, +(z + v).toFixed(2))));
  return (
    <>
      <PageHeader title="Malla curricular" subtitle={`${d} completadas · ${c} en curso · ${t - d - c} pendientes`}>
        <Menu items={[{ icon: Trash2, label: 'Borrar todos los prerrequisitos', danger: true, hidden: mode === 'pdf', onClick: () => confirm('¿Borrar todos los prerrequisitos?') && update({ mallaPrereqs: {} }) }]} />
      </PageHeader>

      <div className="mg-bar">
        <Seg value={mode} onChange={setMode} options={[{ value: 'list', label: 'Lista', icon: List }, { value: 'map', label: 'Mapa', icon: Network }, { value: 'pdf', label: 'Mi PDF', icon: FileText }]} />
        {mode === 'map' && <div className="mg-zoom">
          <button aria-label="Alejar" onClick={() => Z(-.1)}><Minus /></button><span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Acercar" onClick={() => Z(.1)}><Plus /></button><button aria-label="Ajustar" onClick={() => fitRef.current?.()}><Maximize2 /></button>
        </div>}
      </div>

      {mode !== 'pdf' && <div className="malla-legend">
        <span className="malla-legend-item"><i className="malla-legend-dot completed" />Completada</span>
        <span className="malla-legend-item"><i className="malla-legend-dot current" />En curso</span>
        <span className="malla-legend-item"><i className="malla-legend-dot" style={{ background: 'rgba(144,164,174,.35)', borderColor: '#90a4ae' }} />Pendiente</span>
        <span className="malla-legend-sep" />
        {types.map(x => <span key={x} className="malla-legend-item malla-legend-type"><i className="malla-legend-dot" style={{ background: (COLORS[x]?.[1] || '#90a4ae') + '33', borderColor: COLORS[x]?.[1] || '#90a4ae' }} />{x}</span>)}
      </div>}
      {mode === 'pdf' ? <PdfViewer data={data} update={update} /> : <Generated data={data} update={update} dbl={dbl} mode={mode} zoom={zoom} setZoom={setZoom} scroller={scroller} fitRef={fitRef} />}
    </>
  );
}
