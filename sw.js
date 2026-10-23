/* Dictionario Neolatino — service worker.
 *
 * Makes the site installable as an app and usable without a connection.
 *
 *   the page and the site's own files   network first, so an upload shows up at once;
 *                                        the saved copy only when there is no connection
 *   api/ and other sites                never touched (the dictionary keeps its own copy
 *   (Google Sheets, Wiktionary…)        of the sheet in the browser)
 *
 * When the site's files change, nothing here has to change: the ?v= in index.html
 * already gives every new upload new addresses.
 */
const CACHE = "neolatino-v1";
const scope = new URL(self.registration.scope);

// at install: the page and every file it links to (styles.css?v=…, app.js?v=…, icons…)
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(new Request(scope.href, { cache: "no-cache" }));
      if (response.ok) {
        const html = await response.clone().text();
        await cache.put(scope.href, response);
        const files = new Set(["manifest.json", "favicon.svg", "icons/icon-192.png", "icons/icon-512.png"]);
        for (const match of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) files.add(match[1]);
        // one by one: a missing file must not stop the install
        await Promise.all([...files].map((file) => cache.add(new URL(file, scope).href).catch(() => undefined)));
      }
    } catch {
      // offline while installing: the files are saved as they are used
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith("api/") || path === "sw.js") return;
  if (request.mode === "navigate") {
    // the app is one page (the rest is after #): other pages go straight to the network
    if (path === "" || path === "index.html") event.respondWith(page(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(scope.href, response.clone());
    return response;
  } catch {
    return (await cache.match(scope.href)) || Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await keepLatest(cache, request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

/** Save a file, forgetting older versions of it (app.js?v=old when app.js?v=new arrives). */
async function keepLatest(cache, request, response) {
  const url = new URL(request.url);
  if (url.search) {
    for (const old of await cache.keys()) {
      const oldUrl = new URL(old.url);
      if (oldUrl.pathname === url.pathname && oldUrl.search !== url.search) await cache.delete(old);
    }
  }
  await cache.put(request, response);
}
