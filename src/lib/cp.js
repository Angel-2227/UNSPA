import Papa from 'papaparse';
export const cpNorm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// CSV de contenido programático. Corrección: "Descripción" ya no se confunde con "Créditos" (ambos contienen "cr").
export function parseCP(text) {
  return new Promise((res, rej) => Papa.parse(text, { header: false, skipEmptyLines: false, error: rej, complete: ({ data: rows }) => {
    if (!rows || rows.length < 2) return res([]);
    let hi = -1, m = {};
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i].map(cpNorm);
      if (row.some(c => c.includes('odigo') || c === 'code')) {
        hi = i;
        row.forEach((c, j) => {
          if (c.includes('odigo') || c === 'code') m.code = j;
          else if (c.includes('ombre')) m.name = j;
          else if (c.includes('escri')) m.description = j;
          else if (c.includes('edit')) m.credits = j;
          else if (c.includes('polog') || c.includes('tipo')) m.type = j;
          else if (c.includes('onten')) m.content = j;
          else if (c.includes('emes')) m.semester = j;
          else if (c.includes('nidad') || c.includes('uab') || c.includes('escue')) m.uab = j;
        });
        break;
      }
    }
    if (hi < 0) { hi = 0; m = { code: 0, name: 1, credits: 2, type: 3, description: 4, content: 5, semester: 6, uab: 7 }; }
    const g = (r, k) => (m[k] != null ? (r[m[k]] || '').toString().trim() : '');
    const out = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c || !c.toString().trim())) continue;
      const o = { code: g(r, 'code'), name: g(r, 'name'), credits: g(r, 'credits'), type: g(r, 'type'), description: g(r, 'description'), content: g(r, 'content'), semester: g(r, 'semester'), uab: g(r, 'uab') };
      if (o.name || o.code) out.push(o);
    }
    res(out);
  } }));
}
export const findCp = (cp, s) => (cp || []).find(c => cpNorm(c.name) === cpNorm(s.name) || (s.code && c.code && s.code.trim().toLowerCase() === c.code.trim().toLowerCase())) || null;
