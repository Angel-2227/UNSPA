import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { norm } from './plan';

// El cronograma vive en OTRO proyecto de Firebase (cronogramas-general-unal), con login anónimo.
// Se inicializa como una segunda app para no mezclarlo con la sesión de Google de la SPA.
const cfg = {
  apiKey: 'AIzaSyBuVPiP78-gAV3wSeRyUBdEEpcDTCo1jb0',
  authDomain: 'cronogramas-general-unal.firebaseapp.com',
  projectId: 'cronogramas-general-unal',
  storageBucket: 'cronogramas-general-unal.firebasestorage.app',
  messagingSenderId: '267975306650',
  appId: '1:267975306650:web:a71e05a7f051ecdb331e23'
};
const app = getApps().find(a => a.name === 'cronogramas') || initializeApp(cfg, 'cronogramas');
export const cdb = getFirestore(app);
const cauth = getAuth(app);

let pending;
export function ensureCronoAuth() {
  if (cauth.currentUser) return Promise.resolve();
  if (!pending) pending = new Promise((res, rej) => {
    const off = onAuthStateChanged(cauth, u => { if (u) { off(); res(); } });
    signInAnonymously(cauth).catch(e => { pending = null; rej(e); });
  });
  return pending;
}

export const slugify = t => t.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'x';

const ALIAS = {
  codigo: ['codigo', 'cod', 'cod materia', 'codigo materia', 'codigo asignatura', 'codigo curso'],
  asignatura: ['asignatura', 'materia', 'nombre materia', 'nombre asignatura', 'nombre curso', 'nombre', 'curso'],
  grupo: ['grupo', 'no grupo', 'grupo no', 'numero grupo', 'grupo numero', 'nrc'],
  dia: ['dia'],
  horaInicio: ['hora inicio', 'horainicio', 'inicio', 'hora_inicio', 'hora de inicio'],
  horaFinal: ['hora final', 'horafinal', 'fin', 'hora_final', 'hora fin', 'hora de finalizacion'],
  docente: ['docente', 'profesor', 'docentes', 'profesores', 'docente(s)', 'profesor(es)', 'docente asignado']
};
const nt = v => (v === undefined || v === null ? '' : String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' '));

function detectar(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const fila = rows[i].map(nt), mapa = {};
    for (const [campo, al] of Object.entries(ALIAS)) { const idx = fila.findIndex(c => al.includes(c)); if (idx !== -1) mapa[campo] = idx; }
    if ((mapa.codigo !== undefined || mapa.asignatura !== undefined) && mapa.dia !== undefined) return { fila: i, mapa };
  }
  return null;
}

export function filasAMaterias(rows) {
  const det = detectar(rows);
  if (!det) throw new Error('No reconocí las columnas del archivo. Debe tener encabezados como "Código", "Asignatura", "Grupo", "Día", "Hora Inicio", "Hora Final" y "Docente" (en cualquier orden).');
  const { fila, mapa } = det, get = (r, c) => (mapa[c] !== undefined ? String(r[mapa[c]] ?? '').trim() : '');
  const out = []; let m = null, g = null, last = null;
  for (let i = fila + 1; i < rows.length; i++) {
    const r = rows[i], codigo = get(r, 'codigo'), nombre = get(r, 'asignatura'), gt = get(r, 'grupo'), dia = get(r, 'dia'), doc = get(r, 'docente');
    let hi = get(r, 'horaInicio'), hf = get(r, 'horaFinal');
    if (!codigo && !nombre && !gt && !dia) continue;
    const id = codigo || nombre;
    if (id && (!m || id !== m._id)) { m = { _id: id, codigo: codigo || '—', nombre, grupos: [] }; out.push(m); g = null; }
    if (!m) continue;
    if (gt) { g = { numero: parseInt((gt.match(/\d+/) || ['1'])[0], 10), horarios: [], profesor: doc }; m.grupos.push(g); last = null; }
    if (dia) {
      if (!g) { g = { numero: m.grupos.length + 1, horarios: [], profesor: doc }; m.grupos.push(g); }
      if ((!hi || !hf) && last) { hi = hi || last.inicio; hf = hf || last.fin; }
      const h = { dia, inicio: hi, fin: hf }; g.horarios.push(h); last = h;
    }
    if (doc && g && !g.profesor) g.profesor = doc;
  }
  out.forEach(x => delete x._id);
  return out;
}

// CSV o XLSX → lista de materias (la librería xlsx se carga solo cuando se necesita)
export async function parseArchivo(file) {
  const XLSX = await import('xlsx');
  const csv = file.name.toLowerCase().endsWith('.csv');
  const wb = csv ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return filasAMaterias(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }));
}

// Categorías por nombre. Las conocidas del plan de Diseño Gráfico y "Otras" para el resto (sirve para cualquier carrera)
const CATS = [['Talleres', 'taller'], ['Historia', 'historia'], ['Fundamentos', 'fundamentos'], ['Fotografía', 'fotografia'], ['Énfasis', 'enfasis']];
export const categoriaDe = n => (CATS.find(([, k]) => norm(n).includes(k)) || [null])[0] || 'Otras';
export const CAT_NAMES = [...CATS.map(c => c[0]), 'Otras'];
