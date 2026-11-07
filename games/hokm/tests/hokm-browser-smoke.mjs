import { chromium, webkit } from "playwright";

const baseURL = process.env.HOKM_PREVIEW_URL || "https://hokm-preview.fly-hokm-preview.pages.dev/games/hokm/";
const failures = [];
const browser = await chromium.launch({ headless: true });

async function runViewport(browserType, name, viewport, mobile = false, language = "en") {
  const context = await browserType.newContext({ viewport, isMobile: mobile && browserType === chromium, hasTouch: mobile });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.addInitScript(() => {
      window.hokmAuthState = { wallet: "0x0000000000000000000000000000000000000001", tier: 2 };
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

    const hand = page.locator(".hand-south .hokm-card");
    const playable = page.locator(".hand-south .hokm-card.playable");
    await playable.first().waitFor({ state: "visible", timeout: 20000 });

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
        topTag: top?.tagName || null,
        topClass: top?.className?.toString?.() || "",
        topCardId: top?.closest?.(".hokm-card")?.dataset?.cardId || null,
        cardPointerEvents: getComputedStyle(el).pointerEvents,
        topPointerEvents: top ? getComputedStyle(top).pointerEvents : null
      };
    });

    if (mobile) await firstCard.tap({ timeout: 10000 });
    else await firstCard.click({ timeout: 10000 });

    await page.waitForFunction(
      expected => document.querySelectorAll(".hand-south .hokm-card").length === expected,
      before - 1,
      { timeout: 10000 }
    );

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
    if (observedActivations < 2) throw new Error(`Only ${observedActivations} card activation events were observed`);
    if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));

    console.log(JSON.stringify({ viewport: name, result: "PASS", firstHitTest: hitTest, activationCounts, consoleErrors }));
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const hand = document.querySelector(".hand-south");
      const card = document.querySelector(".hand-south .hokm-card.playable");
      if (!hand) return { handFound: false };
      const r = card?.getBoundingClientRect();
      const top = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      return {
        handFound: true,
        handRect: (() => { const h = hand.getBoundingClientRect(); return { x: h.x, y: h.y, width: h.width, height: h.height }; })(),
        totalCards: hand.querySelectorAll(".hokm-card").length,
        playableCards: hand.querySelectorAll(".hokm-card.playable").length,
        firstCard: card?.dataset.cardId || null,
        hitTarget: top ? { tag: top.tagName, className: top.className?.toString?.() || "", cardId: top.closest?.(".hokm-card")?.dataset?.cardId || null } : null,
        seatZ: getComputedStyle(document.querySelector(".seat-south")).zIndex,
        handPointer: getComputedStyle(hand).pointerEvents,
        centerPointer: getComputedStyle(document.querySelector(".table-center")).pointerEvents,
        clicks: window.__hokmCardClicks
      };
    }).catch(() => ({}));
    const failure = { viewport: name, result: "FAIL", error: error.message, diagnostics, pageErrors };
    failures.push(failure);
    console.error(JSON.stringify(failure));
  } finally {
    await context.close();
  }
}

await runViewport(browser, "desktop-chromium", { width: 1365, height: 900 }, false);
await runViewport(browser, "mobile-chromium-touch", { width: 390, height: 844 }, true);
const safari = await webkit.launch({ headless: true });
await runViewport(safari, "mobile-webkit-touch-en", { width: 390, height: 844 }, true);
await runViewport(safari, "mobile-webkit-touch-fa-rtl", { width: 390, height: 844 }, true, "fa");
await safari.close();
await browser.close();

if (failures.length) process.exit(1);
