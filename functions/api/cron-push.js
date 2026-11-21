// GET /api/cron-push?key=CRON_SECRET → lo llama un cron externo cada minuto.
// Lee los usuarios con avisos activos, y manda una notificación push a TODOS sus dispositivos
// registrados cuando falten <= 15 min para una clase (una sola vez por clase y día).
import { json, parseSA, getAccessToken, fsBase, docToObj, uidOf, sendPush, removeToken } from '../_lib/google.js';
import { localNow, dueEntries } from '../_lib/due.js';

const same = (a = '', b = '') => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

export async function onRequest({ request, env }) {
  try {
    const key = new URL(request.url).searchParams.get('key') || request.headers.get('x-cron-key') || '';
    if (!env.CRON_SECRET || !same(key, env.CRON_SECRET)) return json({ error: 'forbidden' }, 403);

    const sa = parseSA(env), access = await getAccessToken(sa), auth = { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' };
    const q = await fetch(`${fsBase(sa)}:runQuery`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'users' }],
        select: { fields: ['classAgenda', 'classAgendaTz', 'pushTokens', 'pushSent'].map(fieldPath => ({ fieldPath })) },
        where: { fieldFilter: { field: { fieldPath: 'pushActive' }, op: 'EQUAL', value: { booleanValue: true } } },
        limit: 500
      } })
    });
    if (!q.ok) return json({ error: 'firestore', detail: (await q.text()).slice(0, 300) }, 502);
    const docs = (await q.json()).filter(x => x.document).map(x => x.document);

    const report = { users: docs.length, sent: 0, failed: 0, removed: 0 };
    for (const d of docs) {
      const u = docToObj(d), uid = uidOf(d), now = localNow(u.classAgendaTz || 'America/Bogota');
      const due = dueEntries(u.classAgenda, now, u.pushSent || {}), tokens = Object.entries(u.pushTokens || {}).filter(([, t]) => t && t.token);
      if (!due.length || !tokens.length) continue;
      const sent = Object.fromEntries(Object.keys(u.pushSent || {}).filter(k => k.startsWith(now.date + '|')).map(k => [k, true]));
      for (const e of due) {
        let ok = false;
        for (const [id, t] of tokens) {
          const r = await sendPush(sa, access, t.token, { title: e.title, body: e.body, tag: e.key });
          if (r.ok) { ok = true; report.sent++; } else { report.failed++; console.error('FCM', uid, id, r.status, r.code, r.detail); if (r.gone) { await removeToken(sa, access, uid, id); report.removed++; } }
        }
        if (ok) sent[e.key] = true;
      }
      // Recuerda lo ya enviado hoy para no repetir el aviso en el siguiente minuto
      await fetch(`${fsBase(sa)}/users/${uid}?updateMask.fieldPaths=pushSent`, {
        method: 'PATCH', headers: auth,
        body: JSON.stringify({ fields: { pushSent: { mapValue: { fields: Object.fromEntries(Object.keys(sent).map(k => [k, { booleanValue: true }])) } } } })
      });
    }
    return json(report);
  } catch (e) {
    console.error(e);
    return json({ error: String(e.message || e) }, 500);
  }
}
