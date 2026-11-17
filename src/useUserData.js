import { useEffect, useRef, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const EMPTY = {
  studyPlan: {}, subjectBank: [], config: { programName: '', university: '', totalCredits: 0, creditsByType: {} },
  gradesData: {}, schedules: [], currentPeriodConfig: { period: '', startDate: '', endDate: '' },
  horariosData: [], mallaPrereqs: {}, mallaMarks: {}, contenidoProgramatico: [], acadTasks: []
};

// Mismo documento users/{uid} de siempre, con los mismos nombres de campos.
// - Se escucha en tiempo real (cambios desde otro dispositivo/pestaña se reflejan solos).
// - Solo se escriben los campos que cambian y se REEMPLAZAN completos (updateDoc), así
//   borrar un semestre, un prerrequisito, etc. sí se borra en la nube (con setDoc+merge no pasaba).
export function useUserData(user) {
  const [data, setData] = useState(null);
  const dirty = useRef({});
  const timer = useRef();

  useEffect(() => {
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(ref, snap => {
      if (snap.metadata.hasPendingWrites) return; // eco de nuestra propia escritura
      const remote = snap.exists() ? snap.data() : {};
      setData(prev => {
        const merged = { ...EMPTY, ...remote };
        if (prev) Object.keys(dirty.current).forEach(k => { merged[k] = prev[k]; }); // no pisar cambios locales sin enviar
        return merged;
      });
    }, err => { console.error('onSnapshot:', err); setData(d => d || { ...EMPTY }); });
  }, [user.uid]);

  const flush = useCallback(async () => {
    const p = dirty.current;
    if (!Object.keys(p).length) return;
    dirty.current = {};
    const ref = doc(db, 'users', user.uid);
    const payload = JSON.parse(JSON.stringify(p)); // elimina `undefined`, que Firestore no acepta
    try {
      await updateDoc(ref, { ...payload, lastUpdated: serverTimestamp() });
    } catch (e) {
      if (e.code === 'not-found') {
        try { await setDoc(ref, { ...payload, lastUpdated: serverTimestamp() }, { merge: true }); return; } catch (e2) { e = e2; }
      }
      console.error('Error guardando en Firestore:', e);
      dirty.current = { ...p, ...dirty.current }; // reintentar en el próximo cambio
    }
  }, [user.uid]);

  const update = useCallback(patch => {
    setData(d => ({ ...d, ...patch }));
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
