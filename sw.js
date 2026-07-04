// Ember service worker
// Strategy:
//  - App shell (HTML/manifest/icons): cached on install, served cache-first.
//  - CDN assets (WebLLM library + wasm): runtime cache-first so the app boots offline
//    after the first online run. The model WEIGHTS are cached separately by WebLLM
//    itself (Cache Storage / IndexedDB), so we don't try to manage those here.

const SHELL_CACHE = "ember-e6f450bda5";
const RUNTIME_CACHE = "ember-runtime-v1";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./app.AE3LSQRJ.js",
  "./styles.NEBAWWLC.css",
  "./worker.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon-180.png",
  "./icons/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigation requests -> serve the cached shell, fall back to network.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((cached) => cached || fetch(request))
    );
    return;
  }

  // Same-origin shell -> cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Cross-origin (CDN: jsDelivr / esm.run / huggingface, etc.) -> cache-first,
  // then populate the runtime cache. Opaque responses are fine for replay.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        // Only cache successful or opaque responses.
        if (response && (response.ok || response.type === "opaque")) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Offline and not cached: let the request fail naturally.
        return cached || Response.error();
      }
    })
  );
});
