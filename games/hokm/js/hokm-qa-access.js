(function () {
  "use strict";
  // This test-only identity is restricted to the isolated Cloudflare Pages
  // preview hostname and an explicit query flag. It is never loaded by the
  // production Hokm page or accepted by the production Worker.
  if (location.hostname !== "hokm-fix-layout-261119.fly-hokm-preview.pages.dev") return;
  if (new URLSearchParams(location.search).get("hokmTest") !== "1") return;
  const auth = {
    wallet: "0x0000000000000000000000000000000000000001",
    tier: 2,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    sessionToken: "isolated-preview-only-test-session"
  };
  window.hokmAuthState = auth;
  window.dispatchEvent(new CustomEvent("hokm:authenticated", { detail: auth }));
  console.info("[Hokm QA] Preview-only synthetic access enabled.");
})();
