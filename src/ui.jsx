import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, MoreVertical, X } from 'lucide-react';

/* ── Toasts globales (reemplazan a los alert) ───────────────────────────── */
const bus = new EventTarget();
export const toast = (msg, kind = 'ok') => bus.dispatchEvent(new CustomEvent('toast', { detail: { msg, kind, id: Math.random() } }));

export function Toaster() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const on = e => {
      const t = e.detail;
      setList(l => [...l.slice(-2), t]);
      setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), 3400);
    };
    bus.addEventListener('toast', on);
    return () => bus.removeEventListener('toast', on);
  }, []);
  const ICON = { ok: CheckCircle2, error: AlertCircle, info: Info };
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => {
        const I = ICON[t.kind] || Info;
        return (
          <div key={t.id} className={'toast toast-' + t.kind}>
            <I /><span>{t.msg}</span>
            <button aria-label="Cerrar" onClick={() => setList(l => l.filter(x => x.id !== t.id))}><X /></button>
          </div>
        );
      })}
    </div>
  );
}

/* ── Cabecera de página ─────────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="ph">
      <div className="ph-text"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {children && <div className="ph-actions">{children}</div>}
    </header>
  );
}

/* ── Control segmentado ─────────────────────────────────────────────────── */
export function Seg({ value, onChange, options, className = '' }) {
  return (
    <div className={'seg ' + className} role="tablist">
      {options.map(o => {
        const I = o.icon;
        return (
          <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
            {I && <I />}<span>{o.label}</span>{o.badge != null && <em>{o.badge}</em>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Menú desplegable (⋮) ───────────────────────────────────────────────── */
// items: { icon, label, onClick, danger, hidden, file: { accept, onChange } }
export function Menu({ items, icon: Icon = MoreVertical, label = 'Más acciones', text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const off = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const list = items.filter(i => !i.hidden);
  return (
    <div className="menu" ref={ref}>
      <button className={text ? 'btn btn-secondary' : 'icon-btn'} aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen(!open)}><Icon />{text && <span>{text}</span>}</button>
      {open && (
        <div className="menu-pop" role="menu">
          {list.map((it, i) => {
            const I = it.icon;
            if (it.divider) return <div key={i} className="menu-div" />;
            const inner = <>{I && <I />}<span>{it.label}</span></>;
            return it.file
              ? <label key={i} className="menu-item" role="menuitem">{inner}<input type="file" hidden accept={it.file.accept} onChange={e => { it.file.onChange(e); setOpen(false); }} /></label>
              : <button key={i} role="menuitem" className={'menu-item' + (it.danger ? ' danger' : '')} onClick={() => { it.onClick?.(); setOpen(false); }}>{inner}</button>;
          })}
        </div>
      )}
    </div>
  );
}

/* ── Estado vacío ───────────────────────────────────────────────────────── */
export function Empty({ icon: Icon, title, children, compact }) {
  return (
    <div className={'empty' + (compact ? ' empty-compact' : '')}>
      {Icon && <div className="empty-ico"><Icon /></div>}
      <h3>{title}</h3>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

/* ── Anillo de progreso ─────────────────────────────────────────────────── */
export function Ring({ pct = 0, size = 112, stroke = 10, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.min(100, Math.max(0, pct));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * p) / 100} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}
