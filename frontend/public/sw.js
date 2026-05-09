// ─── LyvStreem Service Worker ─────────────────────────────────────────────────
// Version: bump this to force cache refresh on deploy
const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `lyvstreem-static-${CACHE_VERSION}`;
const API_CACHE     = `lyvstreem-api-${CACHE_VERSION}`;
const IMAGE_CACHE   = `lyvstreem-images-${CACHE_VERSION}`;

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing LyvStreem Service Worker');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating LyvStreem Service Worker');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== API_CACHE && key !== IMAGE_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategies ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, socket.io, paystack
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.pathname.startsWith('/socket.io')) return;
  if (url.hostname.includes('paystack')) return;
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // API calls — network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, 60));
    return;
  }

  // Images — cache first
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico)$/i)) {
    event.respondWith(cacheFirstWithNetwork(request, IMAGE_CACHE));
    return;
  }

  // JS/CSS/fonts — stale while revalidate
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // HTML navigation — network first, fallback to cached index.html (SPA)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match('/index.html') ||
          caches.match('/')
        )
    );
    return;
  }

  // Default: stale while revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ── Strategy helpers ──────────────────────────────────────────────────────────

// Network first, cache fallback with optional TTL (seconds)
async function networkFirstWithCache(request, cacheName, ttlSeconds = 0) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      // Store with timestamp header for TTL
      const headers = new Headers(clone.headers);
      headers.append('sw-fetched-at', Date.now().toString());
      const cachedResponse = new Response(await clone.blob(), { status: clone.status, headers });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      const fetchedAt = cached.headers.get('sw-fetched-at');
      if (!fetchedAt || !ttlSeconds || (Date.now() - parseInt(fetchedAt)) < ttlSeconds * 1000) {
        return cached;
      }
    }
    // Offline API fallback
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Cache first, network fallback
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

// Stale while revalidate
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      caches.open(cacheName).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);
  return cached || fetchPromise;
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'LyvStreem', body: event.data.text() }; }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    image: data.image || '',
    vibrate: [200, 100, 200],
    tag: data.tag || 'lyvstreem-notification',
    renotify: true,
    data: { url: data.url || '/', ...data },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'LyvStreem', options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Background sync (for offline gift/message queuing) ───────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
  if (event.tag === 'sync-gifts') {
    event.waitUntil(syncPendingGifts());
  }
});

async function syncPendingMessages() {
  // IDB-stored offline messages would be sent here
  console.log('[SW] Syncing pending messages');
}
async function syncPendingGifts() {
  console.log('[SW] Syncing pending gifts');
}

// ── Periodic background sync (refresh live stream data) ──────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-streams') {
    event.waitUntil(
      fetch('/api/streams/live?limit=6')
        .then(r => r.json())
        .then(data => {
          self.clients.matchAll().then(clients =>
            clients.forEach(client => client.postMessage({ type: 'STREAMS_UPDATED', data }))
          );
        })
        .catch(() => {})
    );
  }
});

console.log('[SW] LyvStreem Service Worker loaded ✅');
