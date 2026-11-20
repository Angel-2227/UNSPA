// Las notas se guardan en gradesData[semestre][clave], donde la clave es el NOMBRE normalizado de la materia
// (igual que la versión actual). Las entradas antiguas indexadas por id se migran solas.
const PF = ['ingles', 'catedra', 'nacional de inducci', 'trabajo de grado'];

export const gradeKey = s => (s || '').toLowerCase()
  .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u').trim();

export const gid = () => '_' + Math.random().toString(36).slice(2, 9);
export const has_ = c => c.grade !== null && c.grade !== undefined && c.grade !== '';
const n5 = v => Math.min(5, Math.max(0, +v));

export function defaultEntry(sub) {
  const n = gradeKey(sub.name);
  if (PF.some(k => n.includes(gradeKey(k))) || sub.type === 'TRABAJO DE GRADO') return { type: 'pass_fail', passFail: null };
  return { type: 'graded', components: [
    { id: 'c1', name: 'Corte 1', weight: 33, grade: null },
    { id: 'c2', name: 'Corte 2', weight: 33, grade: null },
    { id: 'c3', name: 'Corte 3', weight: 34, grade: null }] };
}

// Devuelve gradesData completo (sin mutar), con una entrada por cada materia del plan y migrando ids → nombres
export function ensureGrades(plan, g = {}, bank = []) {
  const idToKey = {}, allKeys = new Set();
  Object.values(plan).forEach(s => (s.subjects || []).forEach(x => { idToKey[x.id] = gradeKey(x.name); allKeys.add(gradeKey(x.name)); }));
  bank.forEach(b => { if (!idToKey[b.id]) idToKey[b.id] = gradeKey(b.name); });
  const out = {};
  Object.entries(g || {}).forEach(([sem, semData]) => {
    if (!semData || typeof semData !== 'object') return;
    const n = {};
    Object.entries(semData).forEach(([k, e]) => { if (allKeys.has(k)) n[k] = e; });
    Object.entries(semData).forEach(([k, e]) => {
      if (allKeys.has(k)) return;
      const m = idToKey[k];
      if (m) { if (!n[m]) n[m] = e; } else n[k] = e;
    });
    out[sem] = n;
  });
  Object.entries(plan).forEach(([sem, s]) => {
    out[sem] = { ...(out[sem] || {}) };
    (s.subjects || []).forEach(sub => {
      const k = gradeKey(sub.name), exp = defaultEntry(sub), e = out[sem][k];
      if (!e || e.type !== exp.type) out[sem][k] = exp;
    });
  });
  return out;
}

export const entryOf = (g, sem, sub) => g?.[sem]?.[gradeKey(sub.name)];

// display=true: divide entre los pesos con nota ("promedio parcial"); false: aporte real ÷100 (cortes sin nota = 0)
export function subjectAvg(e, display = true) {
  if (!e || e.type === 'pass_fail') return null;
  const f = (e.components || []).filter(has_);
  if (!f.length) return null;
  const num = f.reduce((s, c) => s + n5(c.grade) * +c.weight, 0);
  if (display) { const w = f.reduce((s, c) => s + +c.weight, 0); return w ? num / w : null; }
  return num / 100;
}
export function semAvg(plan, g, n) {
  let w = 0, c = 0;
  (plan[n]?.subjects || []).forEach(s => { const a = subjectAvg(entryOf(g, n, s), false); if (a !== null) { w += a * s.credits; c += s.credits; } });
  return c ? w / c : null;
}
// Solo semestres completados cuentan para el acumulado
export function overallAvg(plan, g) {
  let w = 0, c = 0;
  Object.keys(plan).forEach(n => {
    if (plan[n].status !== 'completed') return;
    plan[n].subjects.forEach(s => { const a = subjectAvg(entryOf(g, n, s), false); if (a !== null) { w += a * s.credits; c += s.credits; } });
  });
  return c ? w / c : null;
}
export function missingSems(plan, g) {
  return Object.keys(plan).filter(n => plan[n].status === 'completed' &&
    plan[n].subjects.some(s => { const e = entryOf(g, n, s); return e && e.type !== 'pass_fail' && subjectAvg(e) === null; })).length;
}
export function needed(e, t) {
  if (!e || e.type === 'pass_fail') return null;
  const cs = e.components || [], d = cs.filter(has_);
  const pend = cs.filter(c => !has_(c)).reduce((s, c) => s + +c.weight, 0);
  if (pend <= 0) return null;
  const dw = d.reduce((s, c) => s + +c.weight, 0), dv = d.reduce((s, c) => s + n5(c.grade) * +c.weight, 0);
  return (t * (dw + pend) - dv) / pend;
}
// Mueve las notas de una materia cuando cambia de semestre
export function moveGrade(g, from, to, name) {
  const k = gradeKey(name), e = g?.[from]?.[k];
  if (!e) return g;
  const src = { ...g[from] }; delete src[k];
  return { ...g, [from]: src, [to]: { ...(g[to] || {}), [k]: e } };
}
// Renombra la clave de notas cuando se cambia el nombre de una materia
export function renameGrade(g, oldName, newName) {
  const a = gradeKey(oldName), b = gradeKey(newName);
  if (a === b) return g;
  const out = {};
  Object.entries(g || {}).forEach(([sem, d]) => { out[sem] = { ...d }; if (d[a] && !d[b]) { out[sem][b] = d[a]; delete out[sem][a]; } });
  return out;
}

export const gClass = g => g == null ? '' : g >= 4.5 ? 'gn-excel' : g >= 4 ? 'gn-good' : g >= 3.5 ? 'gn-ok' : g >= 3 ? 'gn-pass' : 'gn-fail';
export const gColor = g => g == null ? '#adb5bd' : g >= 4.5 ? '#2e7d32' : g >= 4 ? '#388e3c' : g >= 3.5 ? '#f9a825' : g >= 3 ? '#ffa000' : '#d32f2f';
export const gEmoji = g => g == null ? '' : g >= 4.5 ? '🏆' : g >= 4 ? '⭐' : g >= 3.5 ? '✅' : g >= 3 ? '⚠️' : '❌';
