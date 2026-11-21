import { MapPin } from 'lucide-react';
import Modal from './Modal';
import { typeClass } from '../lib/plan';
const box = (t, c, color) => c && (
  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, marginBottom: 14, borderLeft: `4px solid ${color}` }}>
    <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>{t}</div>
    <p style={{ fontSize: '.88rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{c}</p>
  </div>);

export default function CpModal({ item, onClose, children }) {
  return (
    <Modal title={item.name} onClose={onClose} wide={720}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center', fontSize: '.82rem', color: 'var(--text-secondary)' }}>
        <span className={'type-badge ' + typeClass(item.type)}>{item.type || 'Sin tipología'}</span>
        {item.code && <span>Código: <strong>{item.code}</strong></span>}
        {item.credits && <span>{item.credits} créditos</span>}
        {item.semester && item.semester !== 'N/A' && <span>Semestre {item.semester}</span>}
      </div>
      {box('Descripción', item.description, 'var(--unal-green)')}
      {box('Contenido programático', item.content, 'var(--unal-blue)')}
      {!item.description && !item.content && <p style={{ color: 'var(--text-secondary)' }}>Sin descripción ni contenido cargado.</p>}
      {item.uab && <p className="cp-uab"><MapPin />{item.uab}</p>}
      {children}
    </Modal>
  );
}
