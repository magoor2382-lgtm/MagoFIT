// service-worker.js — MagoFIT
// Se encarga de cachear el "app shell" para que la app abra al instante
// (incluso sin conexión) y de dejar pasar las llamadas a las APIs
// (OpenAI, Open Food Facts) siempre a la red, ya que esas necesitan datos frescos.

const CACHE_NAME = "magofit-cache-v1";

// Archivos propios de la app que se guardan en caché al instalar el Service Worker.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
];
// Nota: los íconos de la app van incrustados directamente como data URI dentro
// de index.html y manifest.json, así que no hace falta cachear archivos de imagen aparte.

// --- INSTALACIÓN: precachear el app shell ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// --- ACTIVACIÓN: limpiar cachés antiguas de versiones previas ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- FETCH: estrategia según el tipo de recurso ---
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear llamadas a APIs externas de análisis/datos:
  // deben ir siempre a la red para traer información actualizada.
  const isApiCall =
    url.hostname.includes("openai.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("openfoodfacts.org");

  if (isApiCall) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para el resto (app shell, fuentes, CDN de Tailwind/librerías):
  // cache-first con actualización en segundo plano (stale-while-revalidate).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // si no hay red, usar lo cacheado

      return cached || networkFetch;
    })
  );
});
