// Qué clases toca avisar ahora (lógica pura, sin red)
export const LEAD = 15; // minutos de anticipación
const DAY = { monday: 'LUNES', tuesday: 'MARTES', wednesday: 'MIÉRCOLES', thursday: 'JUEVES', friday: 'VIERNES', saturday: 'SÁBADO', sunday: 'DOMINGO' };

// Día, fecha y minuto del día en la zona horaria del usuario (Bogotá no tiene horario de verano)
export function localNow(tz = 'America/Bogota', date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map(x => [x.type, x.value]));
  return { day: DAY[p.weekday.toLowerCase()], date: `${p.year}-${p.month}-${p.day}`, nm: (+p.hour % 24) * 60 + +p.minute };
}
const startMin = t => { const [h, m] = String(t).split(':'); return (parseInt(h) || 0) * 60 + (parseInt(m) || 0); };

// agenda: [{ k, dia, inicio, fin, materia, lugar }]; sent: { 'fecha|k': true }
export function dueEntries(agenda, now, sent = {}) {
  const out = [];
  (Array.isArray(agenda) ? agenda : []).forEach(e => {
    if (!e || e.dia !== now.day) return;
    const left = startMin(e.inicio) - now.nm, key = `${now.date}|${e.k}`;
    if (left < 0 || left > LEAD || sent[key]) return;
    out.push({
      key, left,
      title: `${e.materia} ${left <= 0 ? 'empieza ahora' : `empieza en ${left} min`}`,
      body: `${e.lugar || 'Salón sin definir'} · ${e.inicio}${e.fin ? '–' + e.fin : ''}`
    });
  });
  return out;
}
