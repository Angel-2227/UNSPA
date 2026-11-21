import { buildBlocks, DAYS, DAY_BY_INDEX, startMin } from './schedule';

// Horario vigente = el más reciente que no esté archivado
export const activeSchedule = (schedules = []) => [...schedules].reverse().find(s => !s.archived) || null;

// Todas las clases del horario (ordenadas por día y hora), con su salón/edificio
export function sessions(data, schedule) {
  if (!schedule) return [];
  return buildBlocks(data, schedule.subjects, schedule.rooms)
    .sort((a, b) => DAYS.indexOf(a.dia) - DAYS.indexOf(b.dia) || startMin(a.inicio) - startMin(b.inicio));
}

// Próxima vez que ocurre una clase (esta semana o la siguiente) respecto a `now`
export function occurrence(b, now) {
  const base = new Date(now); base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + ((DAY_BY_INDEX.indexOf(b.dia) - now.getDay() + 7) % 7));
  const start = new Date(base), end = new Date(base);
  start.setMinutes(startMin(b.inicio)); end.setMinutes(startMin(b.fin));
  if (end <= now) { start.setDate(start.getDate() + 7); end.setDate(end.getDate() + 7); }
  return { start, end };
}

// { current: clase en curso | null, next: la siguiente clase | null }
export function nextClass(blocks, now) {
  let current = null, next = null;
  blocks.forEach(b => {
    const item = { ...b, ...occurrence(b, now) };
    if (item.start <= now && now < item.end) current = item;
    else if (!next || item.start < next.start) next = item;
  });
  return { current, next };
}

const hm = d => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
export function whenLabel(start, now) {
  const a = new Date(now), b = new Date(start); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 864e5), day = DAY_BY_INDEX[start.getDay()].toLowerCase();
  return `${diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : day[0].toUpperCase() + day.slice(1)} ${hm(start)}`;
}
export function inText(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `en ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return h < 24 ? `en ${h} h${r ? ` ${r} min` : ''}` : '';
}
