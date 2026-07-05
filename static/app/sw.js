// Service worker : cache du shell de l'appli uniquement (cache-first sur /app/).
// Incrémenter CACHE à chaque modification des fichiers de l'appli.

const CACHE = "tlc-app-v1";
const SHELL = [
  "/app/",
  "/app/app.css",
  "/app/app.js",
  "/app/auth.js",
  "/app/github.js",
  "/app/images.js",
  "/app/db.js",
  "/app/manifest.webmanifest",
  "/app/icons/icon-192.png",
  "/app/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Ne jamais intercepter les API externes ni le reste du site.
  if (url.origin !== location.origin || !url.pathname.startsWith("/app/")) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
    )
  );
});
