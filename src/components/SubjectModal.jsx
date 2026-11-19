import { useState } from 'react';
import Modal from './Modal';
import { typesOf } from '../lib/plan';

// Formulario de materia compartido por el Resumen y el Banco
export default function SubjectModal({ subject, config, onSave, onClose }) {
  const [v, setV] = useState({ name: '', type: 'DISCIPLINAR OBLIGATORIA', credits: 3, code: '', group: '', professor: '', ...(subject || {}) });
  const set = (k, val) => setV(x => ({ ...x, [k]: val }));
  const types = typesOf(config, [v.type]);
  const F = (k, label, type = 'text', extra = {}) => (
    <div className="form-group"><label className="form-label">{label}</label>
      <input className="form-control" type={type} value={v[k] ?? ''} onChange={e => set(k, e.target.value)} {...extra} /></div>);
  return (
    <Modal id="subjectModal" title={subject ? 'Editar Materia' : 'Nueva Materia'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); onSave({ ...v, name: v.name.trim(), credits: parseInt(v.credits) || 0 }); }}>
        {F('name', 'Nombre de la Materia', 'text', { required: true, autoFocus: true })}
        <div className="form-row">
          <div className="form-group"><label className="form-label">Tipología</label>
            <select className="form-control" value={v.type} onChange={e => set('type', e.target.value)}>{types.map(t => <option key={t}>{t}</option>)}</select></div>
          {F('credits', 'Créditos', 'number', { min: 0, max: 12, required: true })}
        </div>
        <div className="form-row">{F('code', 'Código')}{F('group', 'Grupo', 'text', { placeholder: 'ej: 1, 2, 3...' })}</div>
        {F('professor', 'Profesor')}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-success">💾 Guardar</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>❌ Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}
