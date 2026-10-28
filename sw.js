// Service Worker — stratégie network-first + versionning auto
const VERSION = "v4.0-2026-10-28";
const CACHE = `doe-matabiau-${VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./viewer.html",
  "./styles.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // data.json et requêtes GitHub : toujours réseau direct (pas de cache)
  if (url.pathname.endsWith("data.json") || url.hostname.includes("github")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Pour tout le reste (HTML/CSS/JS) : network-first, fallback cache si offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Mettre à jour le cache en arrière-plan
        if (res.ok && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Permettre à la page de forcer le skip waiting (via postMessage)
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
