const CACHE_NAME = "pulso-shell-v8";
const APP_SHELL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([APP_SHELL, "/manifest.webmanifest"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const replacingLegacyShell = keys.includes("pulso-shell-v7");
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();

      // The v7 shell was cache-first and its client cannot detect this update.
      if (replacingLegacyShell) {
        const windows = await self.clients.matchAll({ type: "window" });
        await Promise.all(
          windows.map((client) => client.navigate(client.url).catch(() => undefined))
        );
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    const isPublicCacheable =
      url.pathname === "/api/hazards" || url.pathname === "/api/reports";
    if (!isPublicCacheable) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy));
          }
          return response;
        })
        .catch(() => caches.match(APP_SHELL))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
