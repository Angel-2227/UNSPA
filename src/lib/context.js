import { ensureGrades, subjectAvg, semAvg, overallAvg, entryOf } from './grades';
import { groupsFor, buildBlocks, DAYS, startMin, roomText } from './schedule';
import { mergedData, careerData, effStatus, indexSubjects, validLinks, careerName, summary } from './double';
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
  // Doble titulación (si existe): segunda carrera con sus estados efectivos y las homologaciones
  let doble = null;
  if (d.doble) {
    const eff = effStatus(d), idx = indexSubjects(d), c2 = careerData(d, 'second'), sm = summary(d, 'second', eff), sm1 = summary(d, 'main', eff);
    doble = {
      programName: careerName(d, 'second'), totalCredits: sm.req, completedCredits: sm.done, currentCredits: sm.cur, pendingCredits: sm.pending, libreEleccion: { exigidos: sm.leReq, cursados: sm.leDone },
      principal: { completedCredits: sm1.done, currentCredits: sm1.cur, libreEleccion: { exigidos: sm1.leReq, cursados: sm1.leDone } },
      semesters: Object.keys(c2.studyPlan).sort((a, b) => a - b).map(n => ({ number: n, status: c2.studyPlan[n].status, subjects: c2.studyPlan[n].subjects.map(s => ({ name: s.name, credits: s.credits, type: s.type, estado: eff.get(s.id) })) })),
      homologaciones: validLinks(d, idx).map(l => ({ principal: idx.get(l.main).subject.name, segunda: idx.get(l.second).subject.name }))
    };
  }
  // Horario vigente con salón y edificio (para "¿dónde tengo clase hoy?")
  const sch = [...(d.schedules || [])].reverse().find(x => !x.archived);
  const agenda = sch ? buildBlocks(mergedData(d), sch.subjects, sch.rooms)
    .sort((a, b) => DAYS.indexOf(a.dia) - DAYS.indexOf(b.dia) || startMin(a.inicio) - startMin(b.inicio))
    .map(b => `${b.dia} ${b.inicio}-${b.fin} ${b.subject.name}${b.grupo.numero ? ` (G${b.grupo.numero})` : ''} — ${roomText(b) || 'salón sin definir'}`) : [];
  const ahora = new Date().toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return {
    agenda, ahora,
    doble,
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
