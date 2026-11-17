import { ensureGrades, subjectAvg, semAvg, overallAvg, entryOf } from './grades';
import { groupsFor } from './schedule';
const r3 = v => (v === null ? null : +v.toFixed(3));

// Contexto que recibe el asistente (mismo formato que usaba el Worker)
export function buildContext(d) {
  const plan = d.studyPlan || {}, bank = d.subjectBank || [], g = ensureGrades(plan, d.gradesData || {}, bank);
  let done = 0, cur = 0;
  const nums = Object.keys(plan).sort((a, b) => a - b);
  const semesters = nums.map(n => {
    const cr = plan[n].subjects.reduce((s, x) => s + x.credits, 0);
    if (plan[n].status === 'completed') done += cr;
    if (plan[n].status === 'current') cur += cr;
    return { number: n, status: plan[n].status, subjects: plan[n].subjects.map(s => ({ name: s.name, credits: s.credits, type: s.type, code: s.code || '', professor: s.professor || '', group: s.group || '' })) };
  });
  const total = d.config?.totalCredits || 1;
  const semestersSummary = nums.map(n => ({
    semester: n, status: plan[n].status, semesterAverage: r3(semAvg(plan, g, n)),
    subjects: plan[n].subjects.map(s => {
      const e = entryOf(g, n, s);
      if (e.type === 'pass_fail') return { name: s.name, credits: s.credits, type: 'pass_fail', status: e.passFail || 'sin registrar' };
      const a = subjectAvg(e);
      return { name: s.name, credits: s.credits, type: 'graded', average: r3(a), approved: a === null ? null : a >= 3,
        components: e.components.map(c => ({ name: c.name, weight: +c.weight, grade: c.grade === '' || c.grade === undefined ? null : c.grade })) };
    })
  }));
  // Horarios solo de las materias que se pueden planificar (semestre cursando o pendiente), para no inflar el mensaje
  const planable = new Set();
  Object.values(plan).forEach(s => { if (s.status !== 'completed') s.subjects.forEach(x => planable.add(x.name)); });
  const subjectBank = bank.map(s => ({ name: s.name, credits: s.credits, type: s.type, code: s.code || '', horariosInfo: planable.has(s.name) ? groupsFor(d, s) : [] }));
  return {
    programName: d.config?.programName || 'No especificado', university: d.config?.university || 'No especificada', totalCredits: d.config?.totalCredits || 0,
    completedCredits: done, currentCredits: cur, pendingCredits: Math.max(0, total - done - cur),
    progressPercentage: Math.round((done / total) * 100), currentPeriod: d.currentPeriodConfig?.period || '',
    semesters, subjectBank,
    schedules: (d.schedules || []).map(s => ({ name: s.name, period: s.period, subjects: s.subjects })),
    mallaMarks: d.mallaMarks || {},
    grades: { overallAverage: r3(overallAvg(plan, g)), semestersSummary },
    contenidoProgramatico: (d.contenidoProgramatico || []).length ? d.contenidoProgramatico.map(s => ({
      code: s.code, name: s.name, credits: s.credits, type: s.type, semester: s.semester,
      description: (s.description || '').slice(0, 160), contentSummary: (s.content || '').slice(0, 140) })) : null,
    _ui_hint: 'El chat renderiza markdown completo: **negrita**, *cursiva*, tablas (| col | col |), listas (- item), ## títulos. Usa tablas cuando compares materias, notas o créditos. Sé conciso.'
  };
}
