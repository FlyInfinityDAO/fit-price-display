/* Fly Infinity PWA service worker.
   Deliberately network-only: no page or asset caching, to avoid stale wallet/game code. */
"use strict";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
