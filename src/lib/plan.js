export const uid = () => Date.now() + Math.random().toString(36).slice(2, 11);

export const TYPES = ['DISCIPLINAR OBLIGATORIA', 'DISCIPLINAR OPTATIVA', 'FUNDAMENTACIÓN OBLIGATORIA', 'FUNDAMENTACIÓN OPTATIVA', 'LIBRE ELECCIÓN', 'TRABAJO DE GRADO', 'NIVELACIÓN'];
export const STATUS = { completed: 'Completado', current: 'Cursando', pending: 'Pendiente', available: 'Disponible' };

export const typeClass = t => 'type-' + (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ de /g, ' ').replace(/ /g, '-');

// Normaliza para comparar nombres (sin tildes ni signos)
export const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim();

// Fecha local en formato YYYY-MM-DD (toISOString usa UTC y en Colombia "hoy" cambiaba a las 7 pm)
export const todayStr = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export const mapPlan = (plan, fn) => Object.fromEntries(Object.entries(plan).map(([k, s]) => [k, { ...s, subjects: (s.subjects || []).map(fn) }]));
export const planCredits = s => (s.subjects || []).reduce((a, x) => a + (+x.credits || 0), 0);
export const typesOf = (config, extra = []) => [...new Set([...TYPES, ...Object.keys(config?.creditsByType || {}), ...extra.filter(Boolean)])];

// Formato de CSV del SIA que ya usabas. Si reimportas, se conservan los ids, código, profesor, grupo
// y estado de cada semestre de las materias que ya existían (así no se rompen horarios ni prerrequisitos).
export function parseCSV(rows, prev = {}, defaultStatus = 'completed') {
  const old = {};
  Object.values(prev).forEach(s => (s.subjects || []).forEach(x => { if (!old[norm(x.name)]) old[norm(x.name)] = x; }));
  const plan = {}, types = {};
  let cur = 0, total = 0;
  for (const r of rows) {
    if (r[1] && r[1].includes('TOTAL DE CRÉDITOS EXIGIDOS AL ESTUDIANTE')) { const p = parseInt(r[2]); if (!isNaN(p)) total = p; break; }
  }
  for (const r of rows) {
    if (r[1] && r[1].includes('Periodo académico')) {
      const m = r[1].match(/Periodo académico (\d+)/);
      if (m) { cur = +m[1]; plan[cur] = { subjects: [], status: prev[cur]?.status || defaultStatus }; }
    } else if (cur > 0 && r[1] && r[2] && r[3] && !r[1].includes('ASIGNATURAS INSCRITAS') && !r[1].includes('Total Créditos')) {
      const credits = parseInt(r[3]) || parseInt(r[2]) || 0;
      if (credits > 0 && r[1].trim()) {
        const type = (r[2] || '').trim() || 'DISCIPLINAR OBLIGATORIA', o = old[norm(r[1])];
        plan[cur].subjects.push({ id: o?.id || uid(), name: r[1].trim(), type, credits, code: o?.code || '', professor: o?.professor || '', group: o?.group || '' });
        types[type] = (types[type] || 0) + credits;
      }
    }
  }
  Object.keys(plan).forEach(k => { if (!plan[k].subjects.length) delete plan[k]; });
  if (!total) total = Object.values(plan).reduce((a, s) => a + planCredits(s), 0);
  return { plan, total, types };
}

// Exporta con el mismo formato que parseCSV entiende
export function exportCSV(plan, config) {
  const rows = [['', 'TOTAL DE CRÉDITOS EXIGIDOS AL ESTUDIANTE', config.totalCredits || 0, '']];
  Object.keys(plan).map(Number).sort((a, b) => a - b).forEach(n => {
    rows.push(['', `Periodo académico ${n}`, '', ''], ['', 'ASIGNATURAS INSCRITAS', 'Tipología', 'Créditos']);
    plan[n].subjects.forEach(s => rows.push(['', s.name, s.type, s.credits]));
    rows.push(['', `Total Créditos Semestre ${n}`, '', planCredits(plan[n])], ['', '', '', '']);
  });
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(['\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `plan_estudios_${config.programName || 'carrera'}_${new Date().toISOString().split('T')[0]}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
}
