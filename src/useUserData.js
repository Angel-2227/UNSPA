import { useEffect, useRef, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const EMPTY = {
  studyPlan: {}, subjectBank: [], config: { programName: '', university: '', totalCredits: 0, creditsByType: {} },
  gradesData: {}, schedules: [], currentPeriodConfig: { period: '', startDate: '', endDate: '' },
  horariosData: [], mallaPrereqs: {}, mallaMarks: {}, contenidoProgramatico: [], acadTasks: [], homologaciones: []
};

// Garantiza la forma de los datos aunque en la nube falte algo o venga incompleto (evita pantallas en blanco)
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
function normalizePlan(p) {
  return Object.fromEntries(Object.entries(obj(p)).filter(([, s]) => s && typeof s === 'object').map(([k, s]) => [k, { ...s, status: s.status || 'pending', subjects: Array.isArray(s.subjects) ? s.subjects.filter(x => x && typeof x === 'object') : [] }]));
}
function normalize(d) {
  const out = { ...d, studyPlan: normalizePlan(d.studyPlan), config: { ...EMPTY.config, ...obj(d.config) }, gradesData: obj(d.gradesData), mallaPrereqs: obj(d.mallaPrereqs), mallaMarks: obj(d.mallaMarks) };
  ['subjectBank', 'schedules', 'horariosData', 'contenidoProgramatico', 'acadTasks', 'homologaciones'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  out.currentPeriodConfig = { ...EMPTY.currentPeriodConfig, ...obj(d.currentPeriodConfig) };
  if (d.doble) out.doble = { ...d.doble, studyPlan: normalizePlan(d.doble.studyPlan), config: { ...EMPTY.config, ...obj(d.doble.config) }, subjectBank: Array.isArray(d.doble.subjectBank) ? d.doble.subjectBank : [], gradesData: obj(d.doble.gradesData), mallaPrereqs: obj(d.doble.mallaPrereqs) };
  return out;
}

// Mismo documento users/{uid} de siempre, con los mismos nombres de campos.
// - Se escucha en tiempo real (cambios desde otro dispositivo/pestaña se reflejan solos).
// - Solo se escriben los campos que cambian y se REEMPLAZAN completos (updateDoc), así
//   borrar un semestre, un prerrequisito, etc. sí se borra en la nube (con setDoc+merge no pasaba).
export function useUserData(user) {
  const [data, setData] = useState(null);
  const dirty = useRef({});
  const ref = useRef(null); // copia síncrona de los datos (permite actualizar con función sin leer estados viejos)
  const timer = useRef();

  useEffect(() => {
    const docRef = doc(db, 'users', user.uid);
    return onSnapshot(docRef, snap => {
      if (snap.metadata.hasPendingWrites) return; // eco de nuestra propia escritura
      const remote = snap.exists() ? snap.data() : {};
      const prev = ref.current, merged = normalize({ ...EMPTY, ...remote });
      if (prev) Object.keys(dirty.current).forEach(k => { merged[k] = prev[k]; }); // no pisar cambios locales sin enviar
      ref.current = merged; setData(merged);
    }, err => { console.error('onSnapshot:', err); if (!ref.current) { ref.current = { ...EMPTY }; setData(ref.current); } });
  }, [user.uid]);

  const flush = useCallback(async () => {
    const p = dirty.current;
    if (!Object.keys(p).length) return;
    dirty.current = {};
    const docRef = doc(db, 'users', user.uid);
    const payload = JSON.parse(JSON.stringify(p)); // elimina `undefined`, que Firestore no acepta
    try {
      await updateDoc(docRef, { ...payload, lastUpdated: serverTimestamp() });
    } catch (e) {
      if (e.code === 'not-found') {
        try { await setDoc(docRef, { ...payload, lastUpdated: serverTimestamp() }, { merge: true }); return; } catch (e2) { e = e2; }
      }
      console.error('Error guardando en Firestore:', e);
      dirty.current = { ...p, ...dirty.current }; // reintentar en el próximo cambio
    }
  }, [user.uid]);

  // update({campo: valor}) o update(datosActuales => ({campo: valor}))
  const update = useCallback(patchOrFn => {
    const base = ref.current || { ...EMPTY };
    const patch = typeof patchOrFn === 'function' ? patchOrFn(base) : patchOrFn;
    ref.current = { ...base, ...patch }; setData(ref.current);
    Object.assign(dirty.current, patch);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }, [flush]);

  const discard = useCallback(() => { clearTimeout(timer.current); dirty.current = {}; }, []);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => { removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [flush]);

  return { data, update, discard };
}
