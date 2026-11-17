/* Fly Infinity offline-first PWA service worker.
 * Same-origin pages/assets are pre-cached; live APIs remain network-dependent.
 */
"use strict";

const CACHE_PREFIX = "fly-infinity-pwa-";
const CACHE_VERSION = "v8";
const SHELL_CACHE = CACHE_PREFIX + CACHE_VERSION;
const SCOPE_URL = self.registration.scope;
const PRECACHE_URLS = [
  "./airdrop-stats.json",
  "./ambient-motion.css",
  "./android-app/app/src/main/res/drawable-nodpi/fly_infinity_logo.png",
  "./audit.html",
  "./background-desktop.png",
  "./background-mobile.png",
  "./backup-privacy.html",
  "./backup-terms.html",
  "./card-hover.css",
  "./card-hover.js",
  "./compare.html",
  "./crypto-cache.json",
  "./dapp-buy-fit.html",
  "./dapp-gift.html",
  "./dapp-ownership.html",
  "./dapp-sell-fit.html",
  "./dapp.html",
  "./dapp/ar.json",
  "./dapp/en.json",
  "./dapp/es.json",
  "./dapp/fa.json",
  "./dapp/pt.json",
  "./dapp/ru.json",
  "./dapp/tr.json",
  "./dapp/zh.json",
  "./ecosystem-dashboard.js",
  "./ecosystem-visual.js",
  "./faq.html",
  "./fly-ai/css/fly-ai.css",
  "./fly-ai/index.html",
  "./fly-ai/js/app.js",
  "./fly-ai/js/config.js",
  "./fly-ai/js/i18n.js",
  "./games/backgammon/css/backgammon.css",
  "./games/backgammon/index.html",
  "./games/backgammon/js/backgammon-engine.js",
  "./games/backgammon/js/backgammon.js",
  "./games/chess-arena/css/chess-arena.css",
  "./games/chess-arena/index.html",
  "./games/chess-arena/js/chess-arena.js",
  "./games/chess-arena/js/language.js",
  "./games/fi-neon-games.css",
  "./games/fi-snakes-ui-theme.css",
  "./games/hokm/css/hokm-neon-theme.css",
  "./games/hokm/css/hokm.css",
  "./games/hokm/engine/hokm-engine.js",
  "./games/hokm/index.html",
  "./games/hokm/js/hokm-android-scroll.js",
  "./games/hokm/js/hokm-neon-ambient.js",
  "./games/hokm/js/hokm-online.js",
  "./games/hokm/js/hokm-play.js",
  "./games/hokm/js/hokm-wallet-bridge.js",
  "./games/hokm/js/hokm.js",
  "./games/index.html",
  "./games/ludo/css/ludo.css",
  "./games/ludo/index.html",
  "./games/ludo/js/ludo-engine.js",
  "./games/ludo/js/ludo-mobile-scroll.js",
  "./games/ludo/js/ludo.js",
  "./games/ludo/package.json",
  "./games/shared-language-menu.js",
  "./games/shared-neon-ambient.js",
  "./games/snakes-and-ladders/css/snakes.css",
  "./games/snakes-and-ladders/index.html",
  "./games/snakes-and-ladders/js/snakes-engine.js",
  "./games/snakes-and-ladders/js/snakes-mobile-scroll.js",
  "./games/snakes-and-ladders/js/snakes.js",
  "./holders-data.json",
  "./index.html",
  "./lang.js",
  "./lang/audit/ar.json",
  "./lang/audit/en.json",
  "./lang/audit/es.json",
  "./lang/audit/fa.json",
  "./lang/audit/pt.json",
  "./lang/audit/ru.json",
  "./lang/audit/tr.json",
  "./lang/audit/zh.json",
  "./lang/compare/ar.json",
  "./lang/compare/en.json",
  "./lang/compare/es.json",
  "./lang/compare/fa.json",
  "./lang/compare/pt.json",
  "./lang/compare/ru.json",
  "./lang/compare/tr.json",
  "./lang/compare/zh.json",
  "./lang/dapp/ar.json",
  "./lang/dapp/en.json",
  "./lang/dapp/es.json",
  "./lang/dapp/fa.json",
  "./lang/dapp/pt.json",
  "./lang/dapp/ru.json",
  "./lang/dapp/tr.json",
  "./lang/dapp/zh.json",
  "./lang/faq/ar.json",
  "./lang/faq/en.json",
  "./lang/faq/es.json",
  "./lang/faq/fa.json",
  "./lang/faq/pt.json",
  "./lang/faq/ru.json",
  "./lang/faq/tr.json",
  "./lang/faq/zh.json",
  "./lang/index/ar.json",
  "./lang/index/en.json",
  "./lang/index/es.json",
  "./lang/index/fa.json",
  "./lang/index/pt.json",
  "./lang/index/ru.json",
  "./lang/index/tr.json",
  "./lang/index/zh.json",
  "./lang/next-projects/ar.json",
  "./lang/next-projects/en.json",
  "./lang/next-projects/es.json",
  "./lang/next-projects/fa.json",
  "./lang/next-projects/pt.json",
  "./lang/next-projects/ru.json",
  "./lang/next-projects/tr.json",
  "./lang/next-projects/zh.json",
  "./lang/privacy/ar.json",
  "./lang/privacy/en.json",
  "./lang/privacy/es.json",
  "./lang/privacy/fa.json",
  "./lang/privacy/pt.json",
  "./lang/privacy/ru.json",
  "./lang/privacy/tr.json",
  "./lang/privacy/zh.json",
  "./lang/profit-simulator/ar.json",
  "./lang/profit-simulator/en.json",
  "./lang/profit-simulator/es.json",
  "./lang/profit-simulator/fa.json",
  "./lang/profit-simulator/pt.json",
  "./lang/profit-simulator/ru.json",
  "./lang/profit-simulator/tr.json",
  "./lang/profit-simulator/zh.json",
  "./lang/transactions/ar.json",
  "./lang/transactions/en.json",
  "./lang/transactions/es.json",
  "./lang/transactions/fa.json",
  "./lang/transactions/pt.json",
  "./lang/transactions/ru.json",
  "./lang/transactions/tr.json",
  "./lang/transactions/zh.json",
  "./lang/warnings/ar.json",
  "./lang/warnings/en.json",
  "./lang/warnings/es.json",
  "./lang/warnings/fa.json",
  "./lang/warnings/pt.json",
  "./lang/warnings/ru.json",
  "./lang/warnings/tr.json",
  "./lang/warnings/zh.json",
  "./lang/what-is-fit/ar.json",
  "./lang/what-is-fit/en.json",
  "./lang/what-is-fit/es.json",
  "./lang/what-is-fit/fa.json",
  "./lang/what-is-fit/pt.json",
  "./lang/what-is-fit/ru.json",
  "./lang/what-is-fit/tr.json",
  "./lang/what-is-fit/zh.json",
  "./lang/whitepaper/ar.json",
  "./lang/whitepaper/en.json",
  "./lang/whitepaper/es.json",
  "./lang/whitepaper/fa.json",
  "./lang/whitepaper/pt.json",
  "./lang/whitepaper/ru.json",
  "./lang/whitepaper/tr.json",
  "./lang/whitepaper/zh.json",
  "./logo.png",
  "./manifest.webmanifest",
  "./next-projects.html",
  "./package.json",
  "./price-calculator.html",
  "./price-history-table.json",
  "./price-history.json",
  "./privacy.html",
  "./profit-simulator.html",
  "./ps.html",
  "./pwa-icon-192.png",
  "./pwa-icon-512.png",
  "./pwa-icon.svg",
  "./pwa-install.js",
  "./pwa-offline.js",
  "./pwa-brand-neon.css",
  "./pwa-shell.css",
  "./sidebar-motion.css",
  "./site-navigation.js",
  "./trading-volume-progress.json",
  "./trading-volume.json",
  "./transactions.html",
  "./update-airdrop.js",
  "./update-cache.js",
  "./update-price.js",
  "./update-trading-volume.js",
  "./wallet-connect.js",
  "./wallet-ui.css",
  "./wallet-ui.js",
  "./walletconnect-bridge.js",
  "./warnings.html",
  "./what-is-fit.html",
  "./whitepaper.html"
];

function absoluteUrl(path) {
  return new URL(path, SCOPE_URL).href;
}

async function cacheOne(cache, path) {
  const url = absoluteUrl(path);
  try {
    const response = await fetch(url, {cache: "reload"});
    if (response && response.ok) {
      await cache.put(url, response.clone());
      return true;
    }
  } catch (_) {}
  return false;
}

async function precacheAll() {
  const cache = await caches.open(SHELL_CACHE);
  let cursor = 0;
  let successful = 0;
  const worker = async () => {
    while (cursor < PRECACHE_URLS.length) {
      const path = PRECACHE_URLS[cursor++];
      if (await cacheOne(cache, path)) successful++;
    }
  };
  await Promise.all(Array.from({length: 6}, () => worker()));
  return successful;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    await precacheAll();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await cache.match(request, {ignoreSearch: true});
    if (cached) return cached;
    const home = await cache.match(absoluteUrl("./index.html"), {ignoreSearch: true});
    if (home) return home;
    return new Response("Fly Infinity is offline. Open a page once while online to make it available offline.", {
      status: 503,
      headers: {"Content-Type":"text/plain; charset=utf-8"}
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);

  // Match the complete URL first, including its query string. Versioned
  // assets (for example app.js?v=2) must not be satisfied by an older
  // app.js?v=1 entry from Cache Storage.
  const cachedExact = await cache.match(request);

  const update = fetch(request).then(response => {
    if (response && response.ok) {
      return cache.put(request, response.clone()).then(() => response);
    }
    return response;
  }).catch(() => null);

  // Keep the normal stale-while-revalidate behavior for an exact URL match.
  if (cachedExact) {
    update.catch(() => {});
    return cachedExact;
  }

  // A newly versioned URL is not in the precache. Wait for its network
  // response instead of returning a different version from the old cache.
  const freshResponse = await update;
  if (freshResponse) return freshResponse;

  // Ignore the query string only as an offline fallback, never as the
  // preferred response while the network is available.
  const offlineFallback = await cache.match(request, {ignoreSearch: true});
  return offlineFallback || new Response("", {status: 504});
}

async function networkFirstData(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    const cached = await cache.match(request, {ignoreSearch: true});
    return cached || new Response(JSON.stringify({offline:true, message:"Offline: showing saved data where available."}), {
      status: 503, headers: {"Content-Type":"application/json; charset=utf-8"}
    });
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const scope = new URL(SCOPE_URL);
  if (url.origin !== scope.origin) {
    if (/^(https?:)$/.test(url.protocol) && /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif)(?:$|\?)/i.test(url.href)) {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }
  if (!url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (/\.json$/i.test(url.pathname)) {
    event.respondWith(networkFirstData(request));
    return;
  }

  if (["script","style","image","font","worker"].includes(request.destination) ||
      /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("message", event => {
  if (!event.data || event.data.type !== "FI_CHECK_UPDATES") return;
  event.waitUntil((async () => {
    const refreshed = await precacheAll();
    const cache = await caches.open(SHELL_CACHE);
    const home = await cache.match(absoluteUrl("./index.html"), {ignoreSearch: true});
    const clients = await self.clients.matchAll({type:"window", includeUncontrolled:true});
    for (const client of clients) {
      client.postMessage({type:"FI_CONTENT_UPDATED", refreshed, ready:!!home});
    }
  })());
});
