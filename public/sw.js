// ✨ Moon Dust Service Worker - 完善版
const CACHE_NAME = 'moondust-v2';
const RUNTIME_CACHE = 'moondust-runtime';

// 需要缓存的核心资源
const CORE_ASSETS = [
  '/',
  '/moondust.html',
  '/index.html',
  '/manifest.json'
];

// ── 安装事件 ────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ── 激活事件 ────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ── 网络请求策略 ────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 HTTP(S) 请求
  if (!url.protocol.startsWith('http')) return;

  // 跳过 Chrome 扩展请求
  if (url.protocol === 'chrome-extension:') return;

  // API 请求: Network First (优先网络,失败时用缓存)
  if (url.hostname.includes('themoviedb.org') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('openlibrary.org')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 图片资源: Cache First (优先缓存,节省流量)
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML/CSS/JS: Stale While Revalidate (返回缓存同时更新)
  event.respondWith(staleWhileRevalidate(request));
});

// ✨ Network First 策略
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ✨ Cache First 策略
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);

    // 只缓存成功的响应
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Image unavailable', { status: 404 });
  }
}

// ✨ Stale While Revalidate 策略
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}