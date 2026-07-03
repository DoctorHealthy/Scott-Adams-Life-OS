// Life OS service worker. Minimal, offline-tolerant shell. Never caches
// cross-origin (Supabase, Gemini) or non-GET requests, so live data stays live.
// Includes a push handler as the seam for M10 phone notifications.

const CACHE = "lifeos-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([OFFLINE_URL, "/icon-192.png"]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Supabase/Gemini alone

  // App shell navigations: network-first, fall back to cache, then offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Static build assets and images: cache-first (they are content-hashed).
  if (
    url.pathname.startsWith("/_next/") ||
    /\.(png|svg|ico|css|js|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});

// ---- push notifications (M10 seam; harmless until a push is sent) ----
self.addEventListener("push", (event) => {
  let data = { title: "Life OS", body: "", url: "/today" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload; keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Life OS", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: data.url || "/today",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((wins) => {
      const open = wins.find((w) => w.url.includes(target));
      if (open) return open.focus();
      return self.clients.openWindow(target);
    })
  );
});
