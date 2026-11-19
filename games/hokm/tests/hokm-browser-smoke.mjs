import { chromium, webkit } from "playwright";

const baseURL = process.env.HOKM_PREVIEW_URL || "https://hokm-current-main-20261119.fly-hokm-preview.pages.dev/games/hokm/";
const failures = [];

function testURL(language) {
  const url = new URL(baseURL);
  url.searchParams.set("hokmTest", "1");
  if (language && language !== "en") url.searchParams.set("qaLanguage", language);
  return url.toString();
}

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
        sessionToken: "qa-only-playwright-session"
      };
      // The synthetic identity exists only in this isolated Playwright context.
      // Preserve it if the production bridge attempts to clear the startup value.
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

    await page.goto(testURL(language), { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.locator(".game-shell:not([hidden])").waitFor({ state: "visible", timeout: 15000 });
    if (language !== "en") await page.locator("#languageSelect").selectOption(language);
    await page.locator("#hokmStartBtn:not([disabled])").waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#hokmStartBtn").click();

    const trumpPicker = page.locator("#hokmTrumpPicker");
    if (await trumpPicker.isVisible().catch(() => false)) {
      await trumpPicker.locator("[data-suit]").first().click();
    } else {
      // When a CPU is Hakem, wait for its delayed suit choice before measuring or clicking.
      await page.waitForFunction(() => {
        const suit = document.querySelector("#tableTrumpSuit")?.textContent?.trim();
        return !!suit && suit !== "—";
      }, undefined, { timeout: 15000 });
    }

    await page.locator(".hand-south .hokm-card.playable").last().waitFor({ state: "visible", timeout: 20000 });

    const seatLayout = await page.evaluate(() => {
      const inner = document.querySelector(".table-inner");
      if (!inner) throw new Error("Missing .table-inner");
      const origin = inner.getBoundingClientRect();
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) throw new Error("Missing table element: " + selector);
        const r = element.getBoundingClientRect();
        return {
          left: r.left - origin.left,
          top: r.top - origin.top,
          right: r.right - origin.left,
          bottom: r.bottom - origin.top,
          x: r.left - origin.left + r.width / 2,
          y: r.top - origin.top + r.height / 2,
          width: r.width,
          height: r.height
        };
      };
      const center = rect(".table-center");
      const seats = {
        north: rect(".seat-north .player-chip"),
        south: rect(".seat-south .player-chip"),
        west: rect(".seat-west .player-chip"),
        east: rect(".seat-east .player-chip")
      };
      const cards = [1, 2, 3, 4].map(index =>
        rect(".trick-cards .played-card:nth-child(" + index + ")")
      );
      const overlaps = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const inside = center.left >= 0 && center.top >= 0 &&
        center.right <= origin.width && center.bottom <= origin.height;
      return {
        seats: seats.north.y < center.y && seats.south.y > center.y &&
          seats.west.x < center.x && seats.east.x > center.x,
        cardDirections: cards[0].y > center.y && cards[1].x < center.x &&
          cards[2].y < center.y && cards[3].x > center.x,
        centerInsideTable: inside,
        sideCardsClearOfSideSeats: !overlaps(cards[1], seats.west) && !overlaps(cards[3], seats.east),
        cardsReadable: cards.every(card => card.width >= 30 && card.height >= 48),
        center: { x: center.x, y: center.y, width: center.width, height: center.height },
        cardRects: cards.map(({ x, y, width, height }) => ({ x, y, width, height }))
      };
    });

    if (!seatLayout.seats || !seatLayout.cardDirections || !seatLayout.centerInsideTable || !seatLayout.sideCardsClearOfSideSeats || !seatLayout.cardsReadable) {
      throw new Error("Table/card positions overlap or are out of bounds: " + JSON.stringify(seatLayout));
    }

    const hand = page.locator(".hand-south .hokm-card");
    const playable = page.locator(".hand-south .hokm-card.playable");
    const playOne = async () => {
      await playable.last().waitFor({ state: "visible", timeout: 25000 });
      const before = await hand.count();
      const card = playable.last();
      await card.scrollIntoViewIfNeeded();
      const hitTest = await card.evaluate(element => {
        const r = element.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          cardId: element.dataset.cardId,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          topTag: top?.tagName || null,
          topCardId: top?.closest?.(".hokm-card")?.dataset?.cardId || null,
          cardPointerEvents: getComputedStyle(element).pointerEvents,
          topPointerEvents: top ? getComputedStyle(top).pointerEvents : null
        };
      });
      if (hitTest.topCardId !== hitTest.cardId || hitTest.cardPointerEvents === "none") {
        throw new Error("The selected human card is covered or not clickable: " + JSON.stringify(hitTest));
      }
      if (mobile) await card.tap({ timeout: 10000 });
      else await card.click({ timeout: 10000 });

      await page.waitForFunction(
        expected => document.querySelectorAll(".hand-south .hokm-card").length === expected,
        before - 1,
        { timeout: 12000 }
      );
      await page.waitForFunction(
        () => [...document.querySelectorAll(".trick-cards .played-card")].some(card =>
          !card.classList.contains("empty") && card.dataset.playerLabel && card.dataset.playOrder
        ),
        { timeout: 6000 }
      );
      return hitTest;
    };

    const firstHitTest = await playOne();
    // Observe the complete four-card trick while it is still on the felt,
    // before the collection animation clears it.
    await page.waitForFunction(
      () => document.querySelectorAll(".trick-cards .played-card:not(.empty)").length === 4,
      undefined,
      { timeout: 20000 }
    );
    const firstCompleteTrick = await page.evaluate(() => {
      const inner = document.querySelector(".table-inner").getBoundingClientRect();
      const center = document.querySelector(".table-center").getBoundingClientRect();
      const cards = [1, 2, 3, 4].map(index => {
        const el = document.querySelector(".trick-cards .played-card:nth-child(" + index + ")");
        const rect = el.getBoundingClientRect();
        return {
          card: el.textContent.trim(),
          player: el.dataset.playerLabel || "",
          order: Number(el.dataset.playOrder || 0),
          left: rect.left - inner.left,
          top: rect.top - inner.top,
          right: rect.right - inner.left,
          bottom: rect.bottom - inner.top,
          x: rect.left + rect.width / 2 - inner.left,
          y: rect.top + rect.height / 2 - inner.top
        };
      });
      const centerX = center.left + center.width / 2 - inner.left;
      const centerY = center.top + center.height / 2 - inner.top;
      const orders = cards.map(card => card.order).sort((a, b) => a - b);
      return {
        cards,
        allNamed: cards.every(card => !!card.player),
        orderComplete: orders.every((value, index) => value === index + 1),
        directionalSlots: cards[0].y > centerY && cards[1].x < centerX &&
          cards[2].y < centerY && cards[3].x > centerX
      };
    });
    if (!firstCompleteTrick.allNamed || !firstCompleteTrick.orderComplete || !firstCompleteTrick.directionalSlots) {
      throw new Error("The four played cards lost their player/order labels or seat positions: " + JSON.stringify(firstCompleteTrick));
    }
    await playable.last().waitFor({ state: "visible", timeout: 30000 });
    const secondHitTest = await playOne();

    const activationCounts = await page.evaluate(() => ({
      clicks: window.__hokmCardClicks,
      touchEnds: window.__hokmCardTouchEnds
    }));
    const observedActivations = mobile ? activationCounts.touchEnds : activationCounts.clicks;
    if (observedActivations < 2) {
      throw new Error("Only " + observedActivations + " card activation events were observed");
    }
    if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));

    console.log(JSON.stringify({
      viewport: name, result: "PASS", seatLayout,
      firstHitTest, firstCompleteTrick, secondHitTest, activationCounts,
      consoleErrors
    }));
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const inner = document.querySelector(".table-inner");
      const hand = document.querySelector(".hand-south");
      const card = document.querySelector(".hand-south .hokm-card.playable");
      const rect = element => {
        if (!element || !inner) return null;
        const a = element.getBoundingClientRect(), b = inner.getBoundingClientRect();
        return { x: a.x - b.x, y: a.y - b.y, width: a.width, height: a.height };
      };
      const center = document.querySelector(".table-center");
      const trick = document.querySelector(".table-center .trick-cards");
      const style = element => {
        if (!element) return null;
        const css = getComputedStyle(element);
        return {
          display: css.display, position: css.position, direction: css.direction,
          width: css.width, height: css.height, minWidth: css.minWidth,
          gridColumns: css.gridTemplateColumns, gridRows: css.gridTemplateRows,
          left: css.left, right: css.right, top: css.top, bottom: css.bottom,
          transform: css.transform, gap: css.gap
        };
      };
      const cardGeometry = [...(trick?.querySelectorAll(".played-card") || [])].map(el => ({
        rect: rect(el), style: style(el),
        gridColumn: getComputedStyle(el).gridColumn,
        gridRow: getComputedStyle(el).gridRow
      }));
      return {
        gameShellVisible: !!document.querySelector(".game-shell:not([hidden])"),
        inner: rect(inner),
        hand: rect(hand),
        totalCards: hand?.querySelectorAll(".hokm-card").length || 0,
        playableCards: hand?.querySelectorAll(".hokm-card.playable").length || 0,
        firstCard: card?.dataset.cardId || null,
        center: rect(center), centerStyle: style(center),
        trick: rect(trick), trickStyle: style(trick),
        cardGeometry,
        westChip: rect(document.querySelector(".seat-west .player-chip")),
        westChipStyle: style(document.querySelector(".seat-west .player-chip")),
        eastChip: rect(document.querySelector(".seat-east .player-chip")),
        eastChipStyle: style(document.querySelector(".seat-east .player-chip")),
        westSeat: rect(document.querySelector(".seat-west")),
        eastSeat: rect(document.querySelector(".seat-east")),
        clicks: window.__hokmCardClicks,
        touchEnds: window.__hokmCardTouchEnds
      };
    }).catch(() => ({}));
    const failure = { viewport: name, result: "FAIL", error: error.message, diagnostics, pageErrors, consoleErrors };
    failures.push(failure);
    console.error(JSON.stringify(failure));
  } finally {
    await context.close();
  }
}

const chromiumBrowser = await chromium.launch({ headless: true });
await runViewport(chromiumBrowser, "desktop-chromium", { width: 1365, height: 900 });
await runViewport(chromiumBrowser, "mobile-chromium-touch", { width: 390, height: 844 }, true);
await runViewport(chromiumBrowser, "small-mobile-chromium-touch", { width: 320, height: 740 }, true, "fa");
await chromiumBrowser.close();

const webkitBrowser = await webkit.launch({ headless: true });
await runViewport(webkitBrowser, "mobile-webkit-touch", { width: 390, height: 844 }, true);
await runViewport(webkitBrowser, "mobile-webkit-touch-fa-rtl", { width: 390, height: 844 }, true, "fa");
await webkitBrowser.close();

if (failures.length) process.exit(1);
