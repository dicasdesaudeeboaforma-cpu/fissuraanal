/* =====================================================
   Service Worker — cache do "casco" do app (shell)
   O conteúdo do guia funciona offline; as chamadas de
   login/acesso (Supabase) sempre vão à rede.
   ===================================================== */

var CACHE_NAME = 'fissura-anal-v4';

var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './vendor/supabase.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') { return; }

  var url = new URL(req.url);

  // Só tratamos requisições do próprio app. Supabase e outros
  // domínios passam direto pela rede (nunca ficam em cache).
  if (url.origin !== self.location.origin) { return; }

  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return response;
      }).catch(function () {
        if (req.mode === 'navigate') { return caches.match('./index.html'); }
      });

      return cached || network;
    })
  );
});
