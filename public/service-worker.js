const C = 'spa-unal-v4';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(n => n !== C).map(n => caches.delete(n)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(C).then(x => x.put(r, c)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('/')))
  );
});

// ── Notificaciones push (avisos de clase) ──
// El servidor manda un mensaje "solo datos" { title, body, tag, url }; aquí se dibuja la notificación.
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { try { p = { data: { body: e.data.text() } }; } catch {} }
  const d = p.data || p.notification || p;
  e.waitUntil(self.registration.showNotification(d.title || 'Aviso de clase', {
    body: d.body || '', tag: d.tag || undefined, icon: '/img/icon-192.png', badge: '/img/icon-192.png', data: { url: d.url || '/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => 'focus' in c);
    return w ? w.focus() : clients.openWindow(url);
  }));
});
