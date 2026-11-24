/* Shared navigation for the primary Fly Infinity site pages. */
(() => {
  "use strict";
  const items = [
    ["index.html","dashboard","fa-solid fa-gauge-high"],
    ["what-is-fit.html","whatisfit","fa-solid fa-circle-info"],
    ["compare.html","comparison","fa-solid fa-scale-balanced"],
    ["dapp.html","dapp","fa-solid fa-cubes"],
    ["owner-profile.html","ownerProfile","fa-solid fa-network-wired"],
    ["games/index.html","games","fa-solid fa-dice"],
    ["fly-ai/index.html","ai","fa-solid fa-brain"],
    ["creator-arena/index.html","socialArena","fa-solid fa-users"],
    ["profit-simulator.html","profitCalculator","fa-solid fa-calculator"],
    ["next-projects.html","nextProjects","fa-solid fa-rocket"],
    ["transactions.html","transactions","fa-solid fa-arrow-right-arrow-left"],
    ["privacy.html","privacy","fa-solid fa-user-shield"],
    ["warnings.html","warnings","fa-solid fa-triangle-exclamation"],
    ["faq.html","faq","fa-solid fa-comments"],
    ["whitepaper.html","whitepaper","fa-solid fa-book-open"],
    ["audit.html","audit","fa-solid fa-shield"]
  ];

  function activePage() {
    const name = location.pathname.split("/").pop() || "index.html";
    return name === "" ? "index.html" : name;
  }

  function label(key) {
    return typeof window.t === "function" ? window.t("nav." + key) : key;
  }

  function applyLabels(root) {
    if (!root) return;
    root.querySelectorAll("[data-i18n]").forEach(node => {
      node.textContent = label(node.getAttribute("data-i18n").replace(/^nav\./, ""));
    });
  }

  function render() {
    const current = activePage();
    const menu = document.querySelector(".sidebar-menu");
    if (menu) {
      menu.innerHTML = items.map(([href,key,icon]) => {
        const active = href === current || (key === "dapp" && current.startsWith("dapp-"));
        return '<a href="' + href + '"' + (active ? ' class="active" aria-current="page"' : '') + '><i class="' + icon + '" aria-hidden="true"></i> <span data-i18n="nav.' + key + '">' + label(key) + '</span></a>';
      }).join("");
      applyLabels(menu);
    }
    const footer = document.querySelector(".footer .footer-links");
    if (footer) {
      footer.innerHTML = items.map(([href,key,icon],index) => {
        const separator = index ? '<span aria-hidden="true">|</span>' : "";
        return separator + '<a href="' + href + '"><i class="' + icon + '" aria-hidden="true"></i> <span data-i18n="nav.' + key + '">' + label(key) + '</span></a>';
      }).join("");
      applyLabels(footer);
    }
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("fi-language-updated", () => {
    applyLabels(document.querySelector(".sidebar-menu"));
    applyLabels(document.querySelector(".footer .footer-links"));
  });
})();