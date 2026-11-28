const VERSION = 'osn-studio-v6';
const CORE = ['./', 'index.html', 'style.css?v=5', 'app.js?v=5', 'jszip.min.js', 'cover.png', 'minimal.png', 'crest.png', 'favicon.png',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.json'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* app files: always ask the server first (so the page, app.js and style.css never come from different versions);
   the cache is only the offline / slow-network fallback */
function networkFirst(req) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 5000);
  return fetch(req, { signal: ctrl.signal, cache: 'no-cache' })
    .then(res => { clearTimeout(t); if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })
    .catch(() => { clearTimeout(t); return caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())); });
}

/* Google fonts: cached copy first, refreshed in the background */
function staleWhileRevalidate(req) {
  return caches.open(VERSION).then(cache => cache.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || net.then(res => res || Response.error());
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) e.respondWith(networkFirst(req));
  else if (FONT_HOSTS.includes(u.hostname)) e.respondWith(staleWhileRevalidate(req));
});
