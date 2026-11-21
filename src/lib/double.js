import { uid, norm } from './plan';

// ─────────────────────────────────────────────────────────────────────────────
// Doble titulación
//  • Carrera principal = campos de siempre (studyPlan, subjectBank, config, gradesData, mallaPrereqs).
//  • Segunda carrera   = d.doble = { config, studyPlan, subjectBank, gradesData, mallaPrereqs }.
//  • Homologaciones    = d.homologaciones = [{ id, main: idMateriaPrincipal, second: idMateriaSegunda }]
//    Un enlace significa "es la misma materia cursada": cuenta en las dos carreras (créditos, no nota).
// ─────────────────────────────────────────────────────────────────────────────
const RANK = { pending: 0, current: 1, completed: 2 };
const PER_CAREER = ['studyPlan', 'subjectBank', 'config', 'gradesData', 'mallaPrereqs', 'mallaPdfURL', 'mallaPdfFileName', 'contenidoProgramatico'];
export const LE = 'LIBRE ELECCIÓN';

export const careerName = (d, key) => (key === 'second' ? d.doble?.config?.programName : d.config?.programName) || (key === 'second' ? 'Segunda carrera' : 'Carrera principal');

// Vista de UNA carrera con la misma forma que usan todas las pantallas
export function careerData(d, key) {
  if (key !== 'second' || !d.doble) return d;
  const s = d.doble;
  return { ...d, studyPlan: s.studyPlan || {}, subjectBank: s.subjectBank || [], config: s.config || { programName: '', university: '', totalCredits: 0, creditsByType: {} }, gradesData: s.gradesData || {}, mallaPrereqs: s.mallaPrereqs || {},
    mallaPdfURL: s.mallaPdfURL || null, mallaPdfFileName: s.mallaPdfFileName || null, contenidoProgramatico: s.contenidoProgramatico || [] };
}
export const careerUpdate = (update, key) => patch => {
  if (key !== 'second') return update(patch);
  update(prev => {
    const root = {}, sec = { ...(prev.doble || {}) };
    Object.entries(typeof patch === 'function' ? patch(prev) : patch).forEach(([k, v]) => { if (PER_CAREER.includes(k)) sec[k] = v; else root[k] = v; });
    return { ...root, doble: sec };
  });
};

// Vista combinada (para Horarios, Tareas y Cronogramas): semestres de la 2ª carrera con clave "B1", "B2"...
export function mergedData(d) {
  if (!d.doble) return d;
  const plan = { ...d.studyPlan };
  Object.entries(d.doble.studyPlan || {}).forEach(([k, v]) => { plan['B' + k] = v; });
  return { ...d, studyPlan: plan, subjectBank: [...(d.subjectBank || []), ...(d.doble.subjectBank || [])], __second: careerName(d, 'second') };
}
export const mergedUpdate = update => patch => update(prev => {
  const p = { ...(typeof patch === 'function' ? patch(prev) : patch) };
  if (!prev.doble) return p;
  let sec = null;
  if (p.studyPlan) {
    const main = {}, s2 = {};
    Object.entries(p.studyPlan).forEach(([k, v]) => { if (/^B\d+$/.test(k)) s2[k.slice(1)] = v; else main[k] = v; });
    p.studyPlan = main; sec = { ...(sec || prev.doble), studyPlan: s2 };
  }
  if (p.subjectBank) {
    const ids = new Set((prev.doble.subjectBank || []).map(b => b.id));
    sec = { ...(sec || prev.doble), subjectBank: p.subjectBank.filter(b => ids.has(b.id)) };
    p.subjectBank = p.subjectBank.filter(b => !ids.has(b.id));
  }
  if (sec) p.doble = sec;
  return p;
});
export const semLabel = (d, k) => (/^B\d+$/.test(String(k)) ? `${(d.__second || 'Segunda carrera').slice(0, 16)} · Sem. ${String(k).slice(1)}` : `Sem. ${k}`);

// ── Estados efectivos ──
export function indexSubjects(d) {
  const m = new Map();
  Object.entries(d.studyPlan || {}).forEach(([sem, s]) => (s.subjects || []).forEach(x => m.set(x.id, { career: 'main', sem, subject: x, status: s.status || 'pending' })));
  Object.entries(d.doble?.studyPlan || {}).forEach(([sem, s]) => (s.subjects || []).forEach(x => m.set(x.id, { career: 'second', sem, subject: x, status: s.status || 'pending' })));
  return m;
}
export const validLinks = (d, idx) => (d.homologaciones || []).filter(l => idx.has(l.main) && idx.has(l.second));
// Estado de cada materia = el mejor entre el de su semestre y el de la materia con la que está homologada
export function effStatus(d, idx = indexSubjects(d)) {
  const eff = new Map();
  idx.forEach((v, id) => eff.set(id, v.status));
  validLinks(d, idx).forEach(l => {
    const a = idx.get(l.main), b = idx.get(l.second);
    const best = (RANK[a.status] ?? 0) >= (RANK[b.status] ?? 0) ? a.status : b.status;
    eff.set(l.main, best); eff.set(l.second, best);
  });
  return eff;
}

export function summary(d, key, eff) {
  const cd = careerData(d, key), plan = cd.studyPlan || {}, cfg = cd.config || {};
  let done = 0, cur = 0, all = 0, le = 0, leDone = 0, leCur = 0;
  Object.values(plan).forEach(s => (s.subjects || []).forEach(x => {
    const st = eff.get(x.id) || s.status, c = +x.credits || 0;
    all += c; if (st === 'completed') done += c; else if (st === 'current') cur += c;
    if (x.type === LE) { le += c; if (st === 'completed') leDone += c; else if (st === 'current') leCur += c; }
  }));
  const req = cfg.totalCredits || all, nums = Object.keys(plan).filter(n => plan[n].subjects?.length).sort((a, b) => a - b);
  let level = null;
  for (const n of nums) if (plan[n].subjects.some(x => (eff.get(x.id) || plan[n].status) !== 'completed')) { level = +n; break; }
  return { name: careerName(d, key), done, cur, req, pct: req ? Math.round((done / req) * 100) : 0, pending: Math.max(0, req - done - cur),
    leReq: cfg.freeElectiveCredits || le, leDone, leCur, level, allDone: level === null && nums.length > 0, hasPlan: nums.length > 0 };
}

// Coincidencias por nombre entre carreras que aún no están homologadas
export function suggestLinks(d) {
  const idx = indexSubjects(d), links = validLinks(d, idx);
  const usedM = new Set(links.map(l => l.main)), usedS = new Set(links.map(l => l.second));
  const sec = new Map();
  Object.entries(d.doble?.studyPlan || {}).forEach(([sem, s]) => (s.subjects || []).forEach(x => { const k = norm(x.name); if (!usedS.has(x.id) && !sec.has(k)) sec.set(k, { x, sem }); }));
  const out = [];
  Object.entries(d.studyPlan || {}).forEach(([sem, s]) => (s.subjects || []).forEach(x => {
    if (usedM.has(x.id)) return;
    const m = sec.get(norm(x.name));
    if (m) { out.push({ main: x.id, second: m.x.id, name: x.name, mainSem: sem, secondSem: m.sem }); sec.delete(norm(x.name)); }
  }));
  return out;
}

// Contexto de doble titulación que reciben las pantallas
export function makeDbl(d, update, act, eff, setCareer) {
  const enabled = !!d.doble, idx = indexSubjects(d), links = validLinks(d, idx), other = act === 'main' ? 'second' : 'main';
  const names = { main: careerName(d, 'main'), second: careerName(d, 'second') };
  const sides = (mine, theirs) => (act === 'main' ? { main: mine, second: theirs } : { main: theirs, second: mine });
  return {
    enabled, active: act, otherKey: other, eff, idx, links, names, setCareer,
    other: enabled ? careerData(d, other) : null,
    summ: enabled ? { main: summary(d, 'main', eff), second: summary(d, 'second', eff) } : null,
    suggestions: enabled ? suggestLinks(d) : [],
    linkOf: id => { const l = links.find(x => x.main === id || x.second === id); if (!l) return null; return { linkId: l.id, partner: idx.get(l.main === id ? l.second : l.main) }; },
    addLink: (mine, theirs) => { const { main, second } = sides(mine, theirs); update(p => ({ homologaciones: [...(p.homologaciones || []).filter(l => l.main !== main && l.second !== second), { id: uid(), main, second }] })); },
    addMany: pairs => update(p => { const m = new Set(pairs.map(x => x.main)), s = new Set(pairs.map(x => x.second)); return { homologaciones: [...(p.homologaciones || []).filter(l => !m.has(l.main) && !s.has(l.second)), ...pairs.map(x => ({ id: uid(), main: x.main, second: x.second }))] }; }),
    removeLink: id => update(p => ({ homologaciones: (p.homologaciones || []).filter(l => l.id !== id) })),
    activate: name => update(() => ({ doble: { config: { programName: name, university: d.config?.university || '', totalCredits: 0, creditsByType: {}, freeElectiveCredits: 0 }, studyPlan: {}, subjectBank: [], gradesData: {}, mallaPrereqs: {} } })),
    deactivate: () => update(() => ({ doble: null, homologaciones: [] }))
  };
}
