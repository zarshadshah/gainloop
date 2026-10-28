// Gainloop service worker.
// Network first: when you're online you always get the latest files you deployed,
// and a copy is kept so the app still opens offline.
const CACHE = 'gainloop-v11';

// The page itself is kept as './' only: some hosts (Cloudflare Pages) send /index.html on to /
const SHELL = [
  './',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/util.js',
  './js/units.js',
  './js/calc.js',
  './js/plan.js',
  './js/meals.js',
  './js/engine.js',
  './js/store.js',
  './js/charts.js',
  './js/download.js',
  './js/health.js',
  './js/search.js',
  './js/pantry.js',
  './js/track.js',
  './js/ai.js',
  './js/wellness.js',
  './js/load.js',
  './js/parq.js',
  './js/strength.js',
  './js/data/exercises.js',
  './js/data/foods.js',
  './js/data/guides.js',
  './js/data/pictures.js',
  './fonts/barlow-latin-400-normal.woff2',
  './fonts/barlow-latin-500-normal.woff2',
  './fonts/barlow-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-700-normal.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // one missing file shouldn't stop the app installing
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gainloop-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

// Browsers won't open a page from a saved copy that arrived through a redirect,
// so a page that did gets a fresh, redirect-free copy
async function forPage(response) {
  if (!response || !response.redirected) return response;
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request), 4000);
    if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    const isPage = request.mode === 'navigate';
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return isPage ? forPage(hit) : hit;
    if (isPage) {
      const shell = await cache.match('./');
      if (shell) return forPage(shell);
    }
    return Response.error();
  }
}

// The app asks for exercise pictures to be kept for offline use (see warmPictures in app.js)
self.addEventListener('message', (event) => {
  const { type, urls } = event.data || {};
  if (type !== 'warm' || !Array.isArray(urls)) return;
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of urls.slice(0, 400)) {
        if (typeof url !== 'string' || !url.startsWith('img/')) continue;
        try {
          if (!(await cache.match(url))) await cache.add(url);
        } catch {
          // offline or missing: it's fetched normally next time
        }
      }
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // the AI helper always goes to the network, and is never kept
  if (url.pathname.includes('/api/')) return;
  event.respondWith(networkFirst(request));
});
