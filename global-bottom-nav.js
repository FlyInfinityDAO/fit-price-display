(function () {
  "use strict";
  if (window.__FLY_GLOBAL_BOTTOM_NAV__) return;
  window.__FLY_GLOBAL_BOTTOM_NAV__ = true;

  const script = document.currentScript;
  const root = new URL("./", script.src);
  const href = (path) => new URL(path, root).href;

  const translations = {
    en: { nav: "Fly Infinity main navigation", dapp: "DApp", owner: "Owner", fit: "FIT?", dashboard: "Home", ai: "AI", games: "Games", media: "Social",
      aria: { dapp: "Open the Fly Infinity DApp", owner: "Open Owner Profile", fit: "Learn what FIT is", dashboard: "Open Dashboard", ai: "Open Fly Infinity AI", games: "Open Fly Infinity Games", media: "Open Fly Infinity Social" } },
    fa: { nav: "ناوبری اصلی فلای اینفینیتی", dapp: "DApp", owner: "مالک", fit: "FIT چیست؟", dashboard: "خانه", ai: "هوش", games: "بازی", media: "مدیا",
      aria: { dapp: "ورود به برنامه غیرمتمرکز فلای اینفینیتی", owner: "ورود به پروفایل مالک", fit: "آشنایی با FIT", dashboard: "ورود به داشبورد", ai: "ورود به هوش مصنوعی فلای اینفینیتی", games: "ورود به بازی‌های فلای اینفینیتی", media: "ورود به رسانه اجتماعی فلای اینفینیتی" } },
    ar: { nav: "التنقل الرئيسي في Fly Infinity", dapp: "DApp", owner: "المالك", fit: "ما هو FIT؟", dashboard: "الرئيسية", ai: "الذكاء", games: "الألعاب", media: "اجتماعي",
      aria: { dapp: "افتح تطبيق Fly Infinity اللامركزي", owner: "افتح ملف المالك", fit: "تعرف على FIT", dashboard: "افتح لوحة التحكم", ai: "افتح الذكاء الاصطناعي من Fly Infinity", games: "افتح ألعاب Fly Infinity", media: "افتح Fly Infinity Social" } },
    tr: { nav: "Fly Infinity ana gezinme", dapp: "DApp", owner: "Profil", fit: "FIT?", dashboard: "Panel", ai: "Yapay", games: "Oyun", media: "Sosyal",
      aria: { dapp: "Fly Infinity merkeziyetsiz uygulamasını aç", owner: "Sahip profilini aç", fit: "FIT hakkında bilgi edin", dashboard: "Kontrol panelini aç", ai: "Fly Infinity yapay zekâsını aç", games: "Fly Infinity oyunlarını aç", media: "Fly Infinity Social sayfasını aç" } },
    ru: { nav: "Главная навигация Fly Infinity", dapp: "DApp", owner: "Профиль", fit: "FIT?", dashboard: "Домой", ai: "ИИ", games: "Игры", media: "Соцсеть",
      aria: { dapp: "Открыть децентрализованное приложение Fly Infinity", owner: "Открыть профиль владельца", fit: "Узнать о FIT", dashboard: "Открыть панель управления", ai: "Открыть ИИ Fly Infinity", games: "Открыть игры Fly Infinity", media: "Открыть Fly Infinity Social" } },
    zh: { nav: "Fly Infinity 主导航", dapp: "DApp", owner: "档案", fit: "FIT?", dashboard: "首页", ai: "AI", games: "游戏", media: "社交",
      aria: { dapp: "打开 Fly Infinity 去中心化应用", owner: "打开所有者档案", fit: "了解 FIT", dashboard: "打开控制面板", ai: "打开 Fly Infinity 人工智能", games: "打开 Fly Infinity 游戏", media: "打开 Fly Infinity 社交空间" } },
    es: { nav: "Navegación principal de Fly Infinity", dapp: "DApp", owner: "Perfil", fit: "FIT?", dashboard: "Inicio", ai: "IA", games: "Juegos", media: "Social",
      aria: { dapp: "Abrir la DApp de Fly Infinity", owner: "Abrir el perfil de propietario", fit: "Descubrir qué es FIT", dashboard: "Abrir el panel", ai: "Abrir Fly Infinity AI", games: "Abrir los juegos de Fly Infinity", media: "Abrir Fly Infinity Social" } },
    pt: { nav: "Navegação principal Fly Infinity", dapp: "DApp", owner: "Perfil", fit: "FIT?", dashboard: "Início", ai: "IA", games: "Jogos", media: "Social",
      aria: { dapp: "Abrir a DApp da Fly Infinity", owner: "Abrir o perfil do proprietário", fit: "Saber o que é FIT", dashboard: "Abrir o painel", ai: "Abrir a Fly Infinity AI", games: "Abrir os jogos Fly Infinity", media: "Abrir o Fly Infinity Social" } }
  };

  const items = [
    { id: "dapp", path: "dapp.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="m4.5 7.7 7.5 4.4 7.5-4.4M12 12v8.5"/></svg>' },
    { id: "owner", path: "owner-profile.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v4m0 0-7 4m7-4 7 4"/></svg>' },
    { id: "fit", path: "what-is-fit.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.3-1.8 2.7m0 3h.01"/></svg>' },
    { id: "dashboard", path: "index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13a9 9 0 1 1 18 0"/><path d="M12 13 17 8M5 18h14"/></svg>' },
    { id: "ai", path: "fly-ai/index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="5"/></svg>' },
    { id: "games", path: "games/index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9h12a4 4 0 0 1 3.8 5.2l-1 3.2a2 2 0 0 1-3.2 1l-3-2.4H9.4l-3 2.4a2 2 0 0 1-3.2-1l-1-3.2A4 4 0 0 1 6 9Z"/><path d="M7 12v4m-2-2h4m7-1h.01M18 15h.01"/></svg>' },
    { id: "media", path: "creator-arena/index.html", icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>' }
  ];

  function getLanguage(preferred) {
    if (preferred && translations[preferred]) return preferred;
    try {
      const path = window.location.pathname.toLowerCase();
      let keys = ["fit_lang", "fi-game-language", "fi-hokm-language"];
      if (path.includes("/games/hokm/")) keys = ["fi-hokm-language", "fit_lang", "fi-game-language"];
      else if (path.includes("/games/ludo/") || path.includes("/games/snakes-and-ladders/")) keys = ["fi-game-language", "fit_lang"];
      for (const key of keys) {
        const saved = localStorage.getItem(key);
        if (saved && translations[saved]) return saved;
      }
    } catch (error) {}
    const browser = (navigator.language || "en").toLowerCase().split("-")[0];
    return translations[browser] ? browser : "en";
  }

  function currentSection() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("creator-arena")) return "media";
    if (path.includes("owner-profile")) return "owner";
    if (path.includes("what-is-fit")) return "fit";
    if (path.includes("/games/")) return "games";
    if (path.includes("/fly-ai/")) {
      const params = new URLSearchParams(window.location.search);
      return params.get("studio") === "media" ? "media" : "ai";
    }
    if (path.includes("dapp")) return "dapp";
    return "dashboard";
  }

  function pinSiteHeader() {
    if (!document.body || document.body.classList.contains("fi-fixed-header-enabled")) return;

    const candidates = Array.from(document.querySelectorAll(".top-bar, .topbar"));
    const header = candidates.find((element) => {
      if (element.closest(".sidebar, .sidebar-menu, .fi-global-bottom-nav")) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0;
    });
    if (!header) return;

    header.classList.add("fi-global-fixed-header");
    document.documentElement.classList.add("fi-fixed-header-document");
    document.body.classList.add("fi-fixed-header-enabled");

    const updateHeaderSpace = () => {
      const height = Math.ceil(header.getBoundingClientRect().height || header.offsetHeight || 0);
      if (height > 0) {
        document.documentElement.style.setProperty("--fi-fixed-header-height", height + "px");
      }
    };

    updateHeaderSpace();
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(updateHeaderSpace);
      observer.observe(header);
    }
    window.addEventListener("resize", updateHeaderSpace, { passive: true });
    window.addEventListener("orientationchange", () => window.requestAnimationFrame(updateHeaderSpace), { passive: true });
    document.addEventListener("fi-language-updated", () => window.requestAnimationFrame(updateHeaderSpace));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateHeaderSpace).catch(() => {});
    }
  }

  function mount() {
    if (!document.body || document.getElementById("fiGlobalBottomNav")) return;
    pinSiteHeader();
    const nav = document.createElement("nav");
    nav.id = "fiGlobalBottomNav";
    nav.className = "fi-global-bottom-nav";
    const active = currentSection();
    const anchors = {};

    items.forEach((item) => {
      const anchor = document.createElement("a");
      anchor.className = "fi-bottom-nav-item fi-bottom-nav-" + item.id + (item.id === active ? " is-active" : "");
      anchor.href = href(item.path);
      if (item.id === active) anchor.setAttribute("aria-current", "page");
      anchor.innerHTML = '<span class="fi-bottom-nav-icon-wrap">' + item.icon + '</span><span class="fi-bottom-nav-label"></span>';
      nav.appendChild(anchor);
      anchors[item.id] = anchor;
    });

    function refreshLabels(preferredLanguage) {
      const language = getLanguage(preferredLanguage);
      const labels = translations[language] || translations.en;
      nav.setAttribute("aria-label", labels.nav);
      nav.dataset.language = language;
      items.forEach((item) => {
        const anchor = anchors[item.id];
        const label = anchor.querySelector(".fi-bottom-nav-label");
        label.textContent = labels[item.id];
        anchor.setAttribute("aria-label", labels.aria[item.id]);
        anchor.title = labels.aria[item.id];
      });
    }

    refreshLabels();
    document.body.appendChild(nav);
    document.body.classList.add("fi-global-nav-enabled");

    // Mobile browsers may move fixed elements into the visible area when
    // the software keyboard opens. Hide the shared nav while editing fields.
    const isEditable = (element) => {
      if (!element || !element.matches) return false;
      return element.matches('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select, [contenteditable="true"]');
    };
    let keyboardCloseCheck;
    document.addEventListener("focusin", (event) => {
      if (window.matchMedia("(max-width: 759px)").matches && isEditable(event.target)) {
        window.clearTimeout(keyboardCloseCheck);
        document.body.classList.add("fi-mobile-keyboard-open");
      }
    });
    document.addEventListener("focusout", () => {
      if (!window.matchMedia("(max-width: 759px)").matches) return;
      window.clearTimeout(keyboardCloseCheck);
      keyboardCloseCheck = window.setTimeout(() => {
        if (!isEditable(document.activeElement)) {
          document.body.classList.remove("fi-mobile-keyboard-open");
        }
      }, 450);
    });


    document.addEventListener("fi-language-updated", (event) => {
      refreshLabels(event && event.detail && event.detail.lang);
    });
    window.addEventListener("storage", (event) => {
      if (event.key === "fit_lang") refreshLabels(event.newValue);
    });
  }

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("global-bottom-nav.css?v=20261126-premium-tabs-v4", root).href;
  document.head.appendChild(css);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
