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
