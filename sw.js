/* Service worker: lets the site open instantly and work offline.
   Bump VERSION when you change the files listed in SHELL. */
const VERSION = "v1";
const CACHE = "tawbah-stories-" + VERSION;
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "articles.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Try the network first so new articles show up; use the saved copy when offline.
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

// Show the saved copy straight away and refresh it in the background.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Fonts used by the pages.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Anything else on another website (GitHub API, translation service) goes straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || url.pathname.endsWith("/articles.json")) {
    event.respondWith(networkFirst(request, "index.html"));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
