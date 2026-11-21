// POST /api/push-test (con el token de sesión de Firebase) → manda una notificación de prueba a TUS dispositivos
import { json, parseSA, getAccessToken, fsBase, docToObj, sendPush, removeToken } from '../_lib/google.js';

export async function onRequestPost({ request, env }) {
  try {
    const idToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!idToken || !env.FIREBASE_API_KEY) return json({ error: 'No autorizado' }, 401);
    const v = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
    });
    const uid = v.ok && (await v.json())?.users?.[0]?.localId;
    if (!uid) return json({ error: 'No autorizado' }, 401);

    const sa = parseSA(env), access = await getAccessToken(sa);
    const r = await fetch(`${fsBase(sa)}/users/${uid}?mask.fieldPaths=pushTokens`, { headers: { Authorization: `Bearer ${access}` } });
    if (!r.ok) return json({ error: 'firestore', detail: (await r.text()).slice(0, 200) }, 502);
    const tokens = Object.entries(docToObj(await r.json()).pushTokens || {}).filter(([, t]) => t && t.token);
    const out = { devices: tokens.length, sent: 0, errors: [] };
    for (const [id, t] of tokens) {
      const s = await sendPush(sa, access, t.token, { title: 'Prueba de avisos', body: 'Si ves esto, te avisaré antes de cada clase.', tag: 'test-' + Date.now() });
      if (s.ok) out.sent++; else { out.errors.push(`${t.dev || id}: ${s.code || s.status}`); if (s.gone) await removeToken(sa, access, uid, id); }
    }
    return json(out);
  } catch (e) {
    console.error(e);
    return json({ error: String(e.message || e) }, 500);
  }
}
