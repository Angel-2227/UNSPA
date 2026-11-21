// Utilidades para hablar con Google (Firestore + FCM) desde Cloudflare con una cuenta de servicio.
// Variable necesaria: FIREBASE_SERVICE_ACCOUNT (el JSON completo de la cuenta de servicio de Firebase).
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pemToBuf = pem => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0)).buffer;

export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export function parseSA(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT no es un JSON de cuenta de servicio válido');
  return sa;
}

let cache = { token: null, exp: 0 };
export async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (cache.token && cache.exp - 60 > now) return cache.token;
  const head = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64u(enc.encode(JSON.stringify({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging'
  })));
  const key = await crypto.subtle.importKey('pkcs8', pemToBuf(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${claim}`));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64u(sig)}` })
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('No se pudo obtener el token de Google: ' + JSON.stringify(d).slice(0, 200));
  cache = { token: d.access_token, exp: now + (d.expires_in || 3600) };
  return cache.token;
}

export const fsBase = sa => `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

// Firestore REST devuelve valores "tipados"; esto los vuelve JSON normal
export function fromFs(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  return null;
}
export const docToObj = d => Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFs(v)]));
export const uidOf = d => d.name.split('/').pop();

// Envía una notificación "solo datos": el service worker de la app la dibuja
export async function sendPush(sa, access, token, { title, body, tag, url = '/' }) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, data: { title, body, tag: tag || '', url }, webpush: { headers: { Urgency: 'high', TTL: '900' } } } })
  });
  if (r.ok) return { ok: true };
  const t = await r.text(); let code = '';
  try { const e = JSON.parse(t).error; code = e?.details?.find(x => x.errorCode)?.errorCode || e?.status || ''; } catch {}
  return { ok: false, status: r.status, code, gone: r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' || code === 'NOT_FOUND', detail: t.slice(0, 200) };
}

// Borra del documento del usuario un token que ya no sirve (app desinstalada, permiso revocado…)
export async function removeToken(sa, access, uid, id) {
  await fetch(`${fsBase(sa)}/users/${uid}?updateMask.fieldPaths=pushTokens.${id}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: {} })
  });
}
