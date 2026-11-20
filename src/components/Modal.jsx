import { useEffect } from 'react';

// Modal con el mismo marcado/estilos del original (.modal > .modal-content)
export default function Modal({ id, title, subtitle, onClose, children, wide, z }) {
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div id={id} className="modal" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2vh 0', zIndex: z }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={wide ? { maxWidth: wide } : null}>
        <div className="modal-header">
          <div><h3 className="modal-title">{title}</h3>{subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '.8rem', marginTop: 4 }}>{subtitle}</p>}</div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
