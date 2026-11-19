(function () {
  "use strict";
  // Test-only wallet gate bypass. It is active only on this exact Pages preview
  // hostname and only with the explicit hokmTest=1 query parameter.
  if (location.hostname !== "qa-hokm-current-main-20261119.fly-hokm-preview.pages.dev") return;
  if (new URLSearchParams(location.search).get("hokmTest") !== "1") return;
  const auth = {
    wallet: "0x0000000000000000000000000000000000000001",
    tier: 2,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    sessionToken: "qa-solo-only-no-server-session"
  };
  window.hokmAuthState = auth;
  window.dispatchEvent(new CustomEvent("hokm:authenticated", { detail: auth }));
  console.info("[Hokm QA] Isolated solo test access enabled on preview only.");
})();