import { useEffect } from 'react';
import { X } from 'lucide-react';

let locks = 0;
// Ventana modal: centrada en escritorio y "hoja inferior" en celular (ver design.css)
export default function Modal({ id, title, subtitle, onClose, children, wide, z }) {
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    if (!locks++) document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', k); if (!--locks) document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div id={id} className="mdl-backdrop" style={z ? { zIndex: z } : null} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="mdl" style={wide ? { '--mdl-w': wide + 'px' } : null} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="mdl-grab" />
        <div className="mdl-head">
          <div className="mdl-titles"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X /></button>
        </div>
        <div className="mdl-body">{children}</div>
      </div>
    </div>
  );
}
