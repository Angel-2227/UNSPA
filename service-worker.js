const CACHE_NAME = 'spa-unal-v3';

// Assets que se cachean en la instalación (shell de la app)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/estilos/estilos.css',
  '/scripts/script.js',
  '/assets/manifest.json',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/favicon-32x32.png',
  '/img/favicon-16x16.png'
];

// Dominios que NUNCA deben pasar por el service worker
const BYPASS_PATTERNS = [
  'chrome-extension://',
  'firebase',
  'firestore',
  'googleapis.com',
  'gstatic.com',
  'firebaseapp.com',
  'cdnjs.cloudflare.com'
];

// ============================================
// INSTALACIÓN — pre-cachear el shell de la app
// ============================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando v3...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-cacheando assets críticos');
        // addAll falla si cualquier recurso no existe; usamos add individual con catch
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] No se pudo cachear ${url}:`, err))
          )
        );
      })
      .then(() => {
        console.log('[SW] Instalación completa');
        // Activar inmediatamente sin esperar a que cierren las pestañas anteriores
        return self.skipWaiting();
      })
  );
});

// ============================================
// ACTIVACIÓN — limpiar cachés viejos
// ============================================
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Eliminando caché viejo:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => {
        console.log('[SW] Activación completa, tomando control');
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH — estrategia diferenciada por tipo de recurso
// ============================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // 1. Dejar pasar sin interceptar:
  //    - Métodos que no sean GET
  //    - Firebase, Firestore, Google APIs, CDNs externos
  //    - Extensiones de Chrome
  const shouldBypass =
    request.method !== 'GET' ||
    BYPASS_PATTERNS.some(pattern => url.includes(pattern));

  if (shouldBypass) return;

  // 2. Para navegación (HTML): Network First
  //    → Siempre intenta la red para tener el HTML más reciente.
  //    → Si no hay red, sirve el index.html cacheado (funciona como SPA offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Actualizar la caché con la versión fresca
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          console.log('[SW] Sin red, sirviendo index.html desde caché');
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 3. Para assets estáticos (CSS, JS, imágenes, fuentes): Cache First
  //    → Responde desde caché si existe (rápido).
  //    → Si no está en caché, va a la red y guarda el resultado.
  //    → Si falla la red y no hay caché, falla silenciosamente.
  const isStaticAsset =
    url.includes('/estilos/') ||
    url.includes('/scripts/') ||
    url.includes('/img/') ||
    url.includes('/assets/') ||
    /\.(css|js|png|jpg|jpeg|svg|ico|woff2?|ttf)(\?.*)?$/.test(url);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return networkResponse;
        }).catch(() => {
          console.warn('[SW] Asset no disponible en red ni caché:', url);
        });
      })
    );
    return;
  }

  // 4. Para cualquier otra petición: Network First con fallback a caché
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});