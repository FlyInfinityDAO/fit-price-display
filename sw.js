// ============================================
// FLY INFINITY DAO - Service Worker
// ============================================

const CACHE_NAME = 'fly-infinity-v2';
const STATIC_CACHE = 'fly-infinity-static-v2';
const DYNAMIC_CACHE = 'fly-infinity-dynamic-v2';

// ===== فایل‌های اصلی که همیشه کش می‌شوند =====
const STATIC_FILES = [
  '/',
  '/index.html',
  '/dapp.html',
  '/compare.html',
  '/transactions.html',
  '/privacy.html',
  '/warnings.html',
  '/faq.html',
  '/whitepaper.html',
  '/audit.html',
  '/what-is-fit.html',
  '/offline.html',
  '/lang.js',
  '/logo.png',
  '/background-desktop.png',
  '/background-mobile.png'
];

// ===== فایل‌های خارجی (CDN) =====
const EXTERNAL_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ===== فایل‌های JSON (داده‌ها) =====
const DATA_FILES = [
  '/price-history.json',
  '/price-history-table.json',
  '/crypto-cache.json',
  '/trading-volume.json',
  '/airdrop-stats.json'
];

// ===== نصب سرویس ورکر =====
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static files...');
        return cache.addAll([...STATIC_FILES, ...EXTERNAL_FILES]);
      })
      .then(() => {
        return caches.open(DYNAMIC_CACHE);
      })
      .then(cache => {
        console.log('[SW] Caching data files...');
        return cache.addAll(DATA_FILES);
      })
      .then(() => {
        console.log('[SW] All files cached!');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Cache error:', error);
      })
  );
});

// ===== فعال‌سازی سرویس ورکر =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Now ready to handle fetches!');
        return self.clients.claim();
      })
  );
});

// ===== مدیریت درخواست‌ها =====
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // ===== درخواست‌های API (CoinGecko) - همیشه از شبکه =====
  if (url.hostname === 'api.coingecko.com') {
    event.respondWith(fetch(request));
    return;
  }
  
  // ===== درخواست‌های RPC (BNB Chain) - همیشه از شبکه =====
  if (url.hostname === 'bsc-dataseed.binance.org') {
    event.respondWith(fetch(request));
    return;
  }
  
  // ===== درخواست‌های فایل‌های JSON - استراتژی شبکه سپس کش =====
  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // ===== درخواست‌های فایل‌های استاتیک =====
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // اگر در کش موجود بود، برگردان و در پس‌زمینه به‌روزرسانی کن
            fetch(request)
              .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                  caches.open(DYNAMIC_CACHE)
                    .then(cache => cache.put(request, networkResponse));
                }
              })
              .catch(() => {});
            return cachedResponse;
          }
          
          // اگر در کش نبود، از شبکه دریافت کن
          return fetch(request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(DYNAMIC_CACHE)
                  .then(cache => cache.put(request, networkResponse.clone()));
              }
              return networkResponse;
            })
            .catch(() => {
              // اگر شبکه هم در دسترس نبود، صفحه آفلاین
              return caches.match('/offline.html');
            });
        })
    );
  }
});

// ===== استراتژی Network First (برای JSON) =====
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network failed, using cache for:', request.url);
  }
  
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // اگر هیچ‌کدام در دسترس نبود، یک پاسخ خالی برگردان
  return new Response(JSON.stringify({ error: 'Offline' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ===== مدیریت نوتیفیکیشن‌ها (برای آینده) =====
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body || 'Fly Infinity Update',
    icon: '/logo.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Fly Infinity DAO', options)
  );
});

// ===== کلیک روی نوتیفیکیشن =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
