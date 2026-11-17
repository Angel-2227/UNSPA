import { norm } from './plan';

export const DAYS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
export const DAY_BY_INDEX = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
export const COLORS = ['#2e7d32', '#1565c0', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#558b2f', '#4527a0', '#00838f'];

export const canonDay = d => DAYS.find(x => norm(x) === norm(d)) || null;
const parseT = t => { const [h, m] = String(t).split(':'); return { h: parseInt(h) || 0, m: parseInt(m) || 0 }; };
export const startMin = t => { const { h, m } = parseT(t); return h * 60 + m; };
export const startHour = t => parseT(t).h;
export const endHour = t => { const { h, m } = parseT(t); return m > 0 ? h + 1 : h; };

// Los grupos/horarios salen del JSON de horarios (data.horariosData); si no está, de lo guardado antes en la materia
export function groupsFor(data, subject) {
  if (!subject) return [];
  const n = norm(subject.name);
  const h = (data.horariosData || []).find(x => norm(x.nombre) === n);
  if (h?.grupos?.length) return h.grupos;
  if (subject.horariosInfo?.length) return subject.horariosInfo;
  const b = (data.subjectBank || []).find(x => x.id === subject.id || norm(x.name) === n);
  return b?.horariosInfo?.length ? b.horariosInfo : [];
}

export function findSubject(data, id) {
  for (const s of Object.values(data.studyPlan || {})) { const f = (s.subjects || []).find(x => x.id === id); if (f) return f; }
  return (data.subjectBank || []).find(x => x.id === id) || null;
}

// { subjectId: groupIdx } → bloques de clase listos para dibujar
export function buildBlocks(data, selection) {
  const blocks = [];
  Object.entries(selection || {}).forEach(([id, idx], i) => {
    const subject = findSubject(data, id);
    const grupo = subject && groupsFor(data, subject)[idx];
    if (!grupo) return;
    (grupo.horarios || []).forEach(h => {
      const dia = canonDay(h.dia);
      if (!dia) return;
      blocks.push({ id, subject, grupo, dia, inicio: h.inicio, fin: h.fin, sH: startHour(h.inicio), eH: Math.max(endHour(h.fin), startHour(h.inicio) + 1), color: COLORS[i % COLORS.length] });
    });
  });
  return blocks;
}

// Solo los días con clase y solo el rango de horas donde hay clase
export function layout(blocks) {
  if (!blocks.length) return { days: DAYS, hours: Array.from({ length: 14 }, (_, i) => 7 + i) };
  const used = new Set(blocks.map(b => b.dia));
  const min = Math.min(...blocks.map(b => b.sH)), max = Math.max(...blocks.map(b => b.eH));
  return { days: DAYS.filter(d => used.has(d)), hours: Array.from({ length: max - min }, (_, i) => min + i) };
}

export function conflicts(blocks) {
  const seen = {}, bad = new Set();
  blocks.forEach(b => { for (let h = b.sH; h < b.eH; h++) { const k = b.dia + '-' + h; if (seen[k] && seen[k] !== b.id) bad.add(k); seen[k] = seen[k] || b.id; } });
  return bad;
}
export const hasConflict = (b, bad) => { for (let h = b.sH; h < b.eH; h++) if (bad.has(b.dia + '-' + h)) return true; return false; };
export const shortProf = n => { if (!n) return ''; const p = n.trim().split(' '); return p.length <= 2 ? n : `${p[0]} ${p[p.length - 1]}`; };
