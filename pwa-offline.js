/* Fly Infinity — offline registration and reconnect refresh, loaded by every app page. */
(() => {
  "use strict";
  if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;

  const script = document.currentScript;
  if (!script || !script.src) return;
  const appBase = new URL("./", script.src);
  const workerUrl = new URL("sw.js", appBase).href;

  // Load the shared pulsing brand neon on every Fly Infinity page.
  const brandNeon = document.createElement("link");
  brandNeon.rel = "stylesheet";
  brandNeon.href = new URL("pwa-brand-neon.css?v=20261116-neon2", appBase).href;
  document.head.appendChild(brandNeon);

  let wasOffline = !navigator.onLine;
  let reloadAfterUpdate = false;

  navigator.serviceWorker.register(workerUrl, {scope: appBase.pathname})
    .catch(error => console.warn("[Fly Infinity PWA] Offline support registration failed:", error));

  window.addEventListener("offline", () => { wasOffline = true; });
  window.addEventListener("online", () => {
    if (!wasOffline) return;
    wasOffline = false;
    reloadAfterUpdate = true;
    navigator.serviceWorker.ready.then(registration => {
      const worker = navigator.serviceWorker.controller || registration.active;
      if (worker) worker.postMessage({type:"FI_CHECK_UPDATES"});
      else registration.update();
    }).catch(() => {});
  });

  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data && event.data.type === "FI_CONTENT_UPDATED" &&
        event.data.ready && reloadAfterUpdate && navigator.onLine) {
      reloadAfterUpdate = false;
      location.reload();
    }
  });
})();
