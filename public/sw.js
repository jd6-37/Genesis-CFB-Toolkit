// The site's service worker (PWA): pages work offline once visited, and the app shell loads fast.
// - Pages (navigations): network first, the cached copy when offline, else the cached homepage.
// - Built files (/assets/*, hashed names): cache first.
// - Media, fonts, icons, roster data: the cached copy at once, refreshed in the background.
// - Never cached: /api/*, videos (range requests), other sites.
// Bump VERSION to drop every old cache.
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`, ASSETS = `assets-${VERSION}`, FILES = `files-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  const keep = [PAGES, ASSETS, FILES];
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || /\.(mp4|webm)$/.test(url.pathname) || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (/^\/(media|icons|data)\//.test(url.pathname) || /\.(woff2?|png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(caches.open(FILES).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
