import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { app, auth, db } from '../firebase';

// Clave pública VAPID: Firebase Console → Configuración del proyecto → Cloud Messaging →
// "Certificados push web" → Generar par de claves → copia la clave y pégala aquí.
export const VAPID_KEY = 'BM9BtvFyitU_CttECGvhM1-v3ch6J-Bm3tnZc8PsSRQFQA3wZJAQkQsIZ2hnwapVdzYTJRNxf2Vzhv-XxZ1nS9U';

const TOKEN = 'spa-push-token';
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
const idOf = async t => 'd' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
const device = () => { const u = navigator.userAgent; return /iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Android/.test(u) ? (/Mobile/.test(u) ? 'Celular Android' : 'Tablet Android') : 'Computador'; };

export const pushConfigured = () => VAPID_KEY && !VAPID_KEY.startsWith('PEGA');

// Registra ESTE dispositivo para recibir avisos con la app cerrada. { ok, reason }
export async function enablePush({ ask = true } = {}) {
  try {
    if (!pushConfigured()) return { ok: false, reason: 'config' };
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) return { ok: false, reason: 'unsupported' };
    if (Notification.permission === 'default' && ask) await Notification.requestPermission();
    if (Notification.permission !== 'granted') return { ok: false, reason: 'denied' };
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 5000))]);
    if (!reg) return { ok: false, reason: 'sw' };
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, reason: 'token' };
    const uid = auth.currentUser?.uid;
    if (!uid) return { ok: false, reason: 'auth' };
    if (ls.get(TOKEN) !== token) { // solo escribe si es nuevo o cambió
      await updateDoc(doc(db, 'users', uid), { ['pushTokens.' + await idOf(token)]: { token, dev: device(), at: Date.now() }, pushActive: true });
      ls.set(TOKEN, token);
    }
    return { ok: true };
  } catch (e) {
    console.error('enablePush:', e);
    return { ok: false, reason: 'error' };
  }
}

// Quita ESTE dispositivo (los demás siguen recibiendo avisos)
export async function disablePush() {
  try {
    const token = ls.get(TOKEN), uid = auth.currentUser?.uid;
    if (token && uid) await updateDoc(doc(db, 'users', uid), { ['pushTokens.' + await idOf(token)]: deleteField() });
    ls.del(TOKEN);
    if (await isSupported()) await deleteToken(getMessaging(app));
  } catch (e) { console.error('disablePush:', e); }
}

export const hasPushToken = () => !!ls.get(TOKEN);

// Manda una notificación de prueba a todos tus dispositivos registrados
export async function testPush() {
  const r = await fetch('/api/push-test', { method: 'POST', headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}
