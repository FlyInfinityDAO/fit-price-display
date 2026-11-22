(function () {
  "use strict";
  if (window.__FLY_GLOBAL_BOTTOM_NAV__) return;
  window.__FLY_GLOBAL_BOTTOM_NAV__ = true;

  const script = document.currentScript;
  const root = new URL("./", script.src);
  const href = (path) => new URL(path, root).href;
  const items = [
    { id: "dapp", label: "DApp", path: "dapp.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="m4.5 7.7 7.5 4.4 7.5-4.4M12 12v8.5"/></svg>' },
    { id: "media", label: "Media", path: "fly-ai/index.html?studio=media", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>' },
    { id: "dashboard", label: "Dashboard", path: "index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13a9 9 0 1 1 18 0"/><path d="M12 13 17 8M5 18h14"/></svg>' },
    { id: "ai", label: "AI", path: "fly-ai/index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="5"/></svg>' },
    { id: "games", label: "Games", path: "games/index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h12a4 4 0 0 1 3.8 5.2l-1 3.2a2 2 0 0 1-3.2 1l-3-2.4H9.4l-3 2.4a2 2 0 0 1-3.2-1l-1-3.2A4 4 0 0 1 6 9Z"/><path d="M7 12v4m-2-2h4m7-1h.01M18 15h.01"/></svg>' }
  ];

  function currentSection(path) {
    const p = window.location.pathname.toLowerCase();
    if (p.includes("/games/")) return "games";
    if (p.includes("/fly-ai/")) return p.includes("audio-studio-test") || p.includes("image-studio-test") ? "media" : (new URLSearchParams(location.search).get("studio") === "media" ? "media" : "ai");
    if (p.includes("dapp")) return "dapp";
    if (p.endsWith("/") || p.endsWith("/index.html")) return "dashboard";
    return "dashboard";
  }

  function mount() {
    if (!document.body || document.getElementById("fiGlobalBottomNav")) return;
    const nav = document.createElement("nav");
    nav.id = "fiGlobalBottomNav";
    nav.className = "fi-global-bottom-nav";
    nav.setAttribute("aria-label", "Fly Infinity main navigation");
    const active = currentSection();
    items.forEach((item) => {
      const a = document.createElement("a");
      a.className = "fi-bottom-nav-item fi-bottom-nav-" + item.id + (item.id === active ? " is-active" : "");
      a.href = href(item.path);
      a.setAttribute("aria-label", item.label);
      if (item.id === active) a.setAttribute("aria-current", "page");
      a.innerHTML = item.icon + '<span class="fi-bottom-nav-label"></span>';
      a.querySelector("span").textContent = item.label;
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
    document.body.classList.add("fi-global-nav-enabled");
  }

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("global-bottom-nav.css?v=20261122-v1", root).href;
  document.head.appendChild(css);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();