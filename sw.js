// Budgetplaner CHF – Offline-Speicher für das Programm (nicht für die Budgetdaten)
// Bei jeder neuen Version die Nummer erhöhen, damit alte Zwischenspeicher gelöscht werden.
const VERSION = "budget-5.0";

const APP_FILES = ["./", "./index.html", "./pc.html"];
const LIBS = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap"
];
// Diese Adressen werden zwischengespeichert, alle anderen (Anmeldung, Datenbank) gehen immer direkt ins Internet
const CACHE_HOSTS = ["www.gstatic.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Einzeln laden: Wenn eine Datei fehlt, funktioniert der Rest trotzdem
    await Promise.all([...APP_FILES, ...LIBS].map(url =>
      fetch(url, {cache: "reload"}).then(r => { if(r.ok || r.type === "opaque") return cache.put(url, r); }).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Programmdateien: zuerst Internet (damit Updates sofort ankommen), ohne Verbindung aus dem Zwischenspeicher
async function networkFirst(request){
  const cache = await caches.open(VERSION);
  try{
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(request, {signal: controller.signal});
    clearTimeout(timer);
    if(response.ok) cache.put(request, response.clone());
    return response;
  }catch(e){
    const cached = await cache.match(request, {ignoreSearch: true});
    if(cached) return cached;
    const url = new URL(request.url);
    const fallback = url.pathname.endsWith("pc.html") ? "./pc.html" : "./index.html";
    return (await cache.match(fallback)) || Response.error();
  }
}

// Bibliotheken und Schriften: aus dem Zwischenspeicher, im Hintergrund aktualisieren
async function cacheFirst(request){
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(r => { if(r.ok || r.type === "opaque") cache.put(request, r.clone()); return r; }).catch(() => null);
  return cached || (await refresh) || Response.error();
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if(request.method !== "GET") return;
  const url = new URL(request.url);
  if(url.origin === self.location.origin){
    if(request.mode === "navigate" || /\.html?$/.test(url.pathname) || url.pathname.endsWith("/")) event.respondWith(networkFirst(request));
    return;
  }
  if(CACHE_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(request));
});
