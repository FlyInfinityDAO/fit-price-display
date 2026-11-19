import { chromium, webkit } from "playwright";

const baseURL = process.env.HOKM_PREVIEW_URL ||
  "https://hokm-fix-card-layout-20261119.fly-hokm-preview.pages.dev/games/hokm/";
const failures = [];

async function runViewport(browserType, name, viewport, mobile = false, language = "en") {
  const context = await browserType.newContext({
    viewport,
    isMobile: mobile && browserType === chromium,
    hasTouch: mobile
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.addInitScript(() => {
      const qaAuthState = {
        wallet: "0x0000000000000000000000000000000000000001",
        tier: 2,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        sessionToken: "qa-only-browser-session"
      };
      // Keep the synthetic wallet confined to this Playwright page context.
      // Production wallet initialization may clear an early assignment.
      Object.defineProperty(window, "hokmAuthState", {
        configurable: false,
        enumerable: true,
        get() { return qaAuthState; },
        set(value) {
          if (value && typeof value === "object") Object.assign(qaAuthState, value);
        }
      });
      window.addEventListener("load", () => {
        window.dispatchEvent(new CustomEvent("hokm:authenticated", { detail: qaAuthState }));
      }, { once: true });
      window.__hokmCardClicks = 0;
      window.__hokmCardTouchEnds = 0;
      document.addEventListener("click", event => {
        if (event.target.closest(".hand-south .hokm-card")) window.__hokmCardClicks++;
      }, true);
      document.addEventListener("touchend", event => {
        if (event.target.closest(".hand-south .hokm-card")) window.__hokmCardTouchEnds++;
      }, true);
    });

    await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (language !== "en") await page.locator("#languageSelect").selectOption(language);
    await page.waitForSelector("#hokmStartBtn:not([disabled])", { timeout: 15000 });
    await page.locator("#hokmStartBtn").click();

    const trumpPicker = page.locator("#hokmTrumpPicker");
    if (await trumpPicker.isVisible().catch(() => false)) {
      await trumpPicker.locator("[data-suit]").first().click();
    }
    await page.waitForFunction(
      () => {
        const suit = document.getElementById("tableTrumpSuit")?.textContent?.trim();
        return !!suit && suit !== "—";
      },
      { timeout: 15000 }
    );

    // The start button is below the table. Center the felt before taking
    // viewport-relative measurements; clicking controls can otherwise scroll
    // the table above the viewport and create false negative coordinates.
    await page.locator(".velvet-table").evaluate(element =>
      element.scrollIntoView({ block: "center", inline: "center" })
    );
    await page.waitForTimeout(80);

    const seatLayout = await page.evaluate(() => {
      const felt = document.querySelector(".velvet-table");
      const center = document.querySelector(".table-center");
      const trick = document.querySelector(".table-center .trick-cards");
      if (!felt || !center || !trick) throw new Error("Missing Hokm table/felt/card area");
      const box = element => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height,
          cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      };
      const c = box(center);
      const cards = [0, 1, 2, 3].map(slot => {
        const node = document.querySelector(
          '.table-center .played-card[data-trick-slot="' + slot + '"]'
        );
        if (!node) throw new Error("Missing directional card slot " + slot);
        return { ...box(node), before: getComputedStyle(node, "::before").content };
      });
      const seats = {
        north: box(document.querySelector(".seat-north .player-chip")),
        west: box(document.querySelector(".seat-west .player-chip")),
        east: box(document.querySelector(".seat-east .player-chip")),
        south: box(document.querySelector(".seat-south .player-chip"))
      };
      const gridDisplay = getComputedStyle(trick).display;
      const insideCenter = cards.every(card =>
        card.width > 0 && card.height > 0 &&
        card.x >= c.x - 1 && card.y >= c.y - 1 &&
        card.x + card.width <= c.x + c.width + 1 &&
        card.y + card.height <= c.y + c.height + 1
      );
      return {
        gridDisplay,
        seats: seats.north.cy < c.cy && seats.south.cy > c.cy &&
          seats.west.cx < c.cx && seats.east.cx > c.cx,
        slots: cards[0].cy > c.cy && cards[1].cx < c.cx &&
          cards[2].cy < c.cy && cards[3].cx > c.cx,
        insideCenter,
        duplicateBeforeLabels: cards.some(card => card.before !== "none"),
        center: c,
        cards,
        direction: document.documentElement.dir
      };
    });
    if (
      seatLayout.gridDisplay !== "grid" ||
      !seatLayout.seats ||
      !seatLayout.slots ||
      !seatLayout.insideCenter ||
      seatLayout.duplicateBeforeLabels
    ) {
      throw new Error("Directional table/card layout failed: " + JSON.stringify(seatLayout));
    }

    const hand = page.locator(".hand-south .hokm-card");
    const playable = page.locator(".hand-south .hokm-card.playable");
    await playable.first().waitFor({ state: "visible", timeout: 25000 });

    const before = await hand.count();
    const firstCard = playable.first();
    await firstCard.scrollIntoViewIfNeeded();
    const hitTest = await firstCard.evaluate(el => {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      return {
        card: el.dataset.cardId,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        hitCardId: top?.closest?.(".hokm-card")?.dataset?.cardId || null,
        cardPointerEvents: getComputedStyle(el).pointerEvents
      };
    });
    if (hitTest.hitCardId !== hitTest.card || hitTest.cardPointerEvents === "none") {
      throw new Error("Human card is not the pointer hit target: " + JSON.stringify(hitTest));
    }

    if (mobile) await firstCard.tap({ timeout: 10000 });
    else await firstCard.click({ timeout: 10000 });

    await page.waitForFunction(
      expected => document.querySelectorAll(".hand-south .hokm-card").length === expected,
      before - 1,
      { timeout: 10000 }
    );

    const humanLabel = await page.locator(".seat-south .player-chip b").innerText();
    await page.waitForFunction(
      label => [...document.querySelectorAll(".table-center .played-card[data-player-label]")]
        .some(card => card.dataset.playerLabel === label),
      humanLabel,
      { timeout: 10000 }
    );

    const playedCardCheck = await page.evaluate(label => {
      const card = [...document.querySelectorAll(".table-center .played-card[data-player-label]")]
        .find(node => node.dataset.playerLabel === label);
      if (!card) return { found: false };
      const r = card.getBoundingClientRect();
      const center = document.querySelector(".table-center").getBoundingClientRect();
      return {
        found: true,
        slot: card.dataset.trickSlot,
        playOrder: card.dataset.playOrder,
        x: r.x, y: r.y, width: r.width, height: r.height,
        belowCenter: r.top + r.height / 2 > center.top + center.height / 2,
        before: getComputedStyle(card, "::before").content,
        after: getComputedStyle(card, "::after").content,
        ariaLabel: card.getAttribute("aria-label")
      };
    }, humanLabel);
    if (
      !playedCardCheck.found ||
      playedCardCheck.slot !== "0" ||
      !playedCardCheck.belowCenter ||
      playedCardCheck.before !== "none" ||
      playedCardCheck.after === "none" ||
      !playedCardCheck.playOrder
    ) {
      throw new Error("Played card attribution/position failed: " + JSON.stringify(playedCardCheck));
    }

    await page.waitForFunction(
      () => document.querySelectorAll(".hand-south .hokm-card.playable").length > 0,
      { timeout: 25000 }
    );
    const secondBefore = await hand.count();
    const secondCard = playable.first();
    await secondCard.scrollIntoViewIfNeeded();
    if (mobile) await secondCard.tap({ timeout: 10000 });
    else await secondCard.click({ timeout: 10000 });
    await page.waitForFunction(
      expected => document.querySelectorAll(".hand-south .hokm-card").length === expected,
      secondBefore - 1,
      { timeout: 10000 }
    );

    const activationCounts = await page.evaluate(() => ({
      clicks: window.__hokmCardClicks,
      touchEnds: window.__hokmCardTouchEnds
    }));
    const observedActivations = mobile ? activationCounts.touchEnds : activationCounts.clicks;
    if (observedActivations < 2) {
      throw new Error(`Only ${observedActivations} card activation events were observed`);
    }
    if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));

    console.log(JSON.stringify({
      viewport: name, result: "PASS", seatLayout, hitTest, playedCardCheck,
      activationCounts, consoleErrors
    }));
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const hand = document.querySelector(".hand-south");
      const center = document.querySelector(".table-center");
      if (!hand) return { handFound: false };
      const card = hand.querySelector(".hokm-card.playable");
      const r = card?.getBoundingClientRect();
      const top = r ? document.elementFromPoint(
        Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2)),
        Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2))
      ) : null;
      const cr = center?.getBoundingClientRect();
      return {
        handRect: (() => { const h = hand.getBoundingClientRect(); return { x: h.x, y: h.y, width: h.width, height: h.height }; })(),
        centerRect: cr ? { x: cr.x, y: cr.y, width: cr.width, height: cr.height } : null,
        totalCards: hand.querySelectorAll(".hokm-card").length,
        playableCards: hand.querySelectorAll(".hokm-card.playable").length,
        firstCard: card?.dataset.cardId || null,
        hitTarget: top ? { tag: top.tagName, className: top.className?.toString?.() || "", cardId: top.closest?.(".hokm-card")?.dataset?.cardId || null } : null,
        slotRects: [0, 1, 2, 3].map(slot => {
          const node = document.querySelector('.table-center .played-card[data-trick-slot="' + slot + '"]');
          if (!node) return null;
          const b = node.getBoundingClientRect();
          return { x: b.x, y: b.y, width: b.width, height: b.height };
        }),
        gridDisplay: center ? getComputedStyle(center.querySelector(".trick-cards")).display : null,
        pageErrors
      };
    }).catch(() => ({}));
    const failure = { viewport: name, result: "FAIL", error: error.message, diagnostics, pageErrors };
    failures.push(failure);
    console.error(JSON.stringify(failure));
  } finally {
    await context.close();
  }
}

const chromiumBrowser = await chromium.launch({ headless: true });
await runViewport(chromiumBrowser, "desktop-chromium", { width: 1365, height: 900 }, false);
await runViewport(chromiumBrowser, "mobile-chromium-touch", { width: 390, height: 844 }, true);
await chromiumBrowser.close();

const safari = await webkit.launch({ headless: true });
await runViewport(safari, "mobile-webkit-touch-en", { width: 390, height: 844 }, true);
await runViewport(safari, "mobile-webkit-touch-fa-rtl", { width: 390, height: 844 }, true, "fa");
await safari.close();

if (failures.length) process.exit(1);
