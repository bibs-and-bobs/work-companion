// Offline support. Network first (so updates show up straight away; `no-cache` makes the browser
// check with the server instead of reusing GitHub Pages' 10-minute HTTP cache),
// falling back to the last cached copy when offline or when the network hangs for more than
// NET_WAIT ms (slow work Wi-Fi / VPN). Every same-origin file is cached as it's fetched,
// so there's no file list to maintain.
const CACHE = 'work-companion-v4';
const NET_WAIT = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const net = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  net.catch(() => {});   // handled below; avoids an "unhandled rejection" when offline
  const cached = () => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
  const slow = new Promise((_, fail) => setTimeout(fail, NET_WAIT));
  e.respondWith(Promise.race([net, slow])
    .catch(async () => (await cached()) ?? net.catch(() => Response.error())));
});

// Clicking a reminder notification brings the app to the front (or opens it).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./#/todo'))));
});
