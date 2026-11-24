// Lift Log service worker: caches the app so it opens offline, and shows the "rest over" push notifications.
const V = "liftlog-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates arrive), cache as the offline fallback. Database calls are never cached.
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).hostname.endsWith("supabase.co")) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)).catch(() => { }); }
    return res;
  }).catch(() => caches.match(r).then(m => m || caches.match("./index.html"))));
});

// iOS requires every push to show a notification.
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (x) { d = { title: "Lift Log", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Lift Log", {
    body: d.body || "", tag: d.tag || "lift", renotify: true, icon: "./icons/icon-192.png", data: { url: "./" },
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
