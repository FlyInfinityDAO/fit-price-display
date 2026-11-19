import { chromium, webkit } from "playwright";

const baseURL = process.env.HOKM_ONLINE_PREVIEW_URL ||
  "https://hokm-online-motion-qa-261119.fly-hokm-preview.pages.dev/games/hokm/";
const failures = [];

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const ownHand = ranks.map((rank, index) => ({
  id: "own-" + index,
  rank,
  suit: suits[index % suits.length]
}));
const playedCards = [
  { id: "played-south", rank: "A", suit: "♠" },
  { id: "played-west", rank: "K", suit: "♥" },
  { id: "played-north", rank: "Q", suit: "♦" },
  { id: "played-east", rank: "J", suit: "♣" }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stateWith(game, currentPlayer, status = "playing") {
  return {
    code: "QA2345",
    status,
    cpuDifficulty: "normal",
    seat: 0,
    cardFlightUntil: Date.now() + 1900,
    players: [
      { seat: 0, wallet: "0x0000000000000000000000000000000000000001", you: true, cpu: false, connected: true },
      { seat: 1, wallet: null, you: false, cpu: true, connected: true },
      { seat: 2, wallet: "0x0000000000000000000000000000000000000002", you: false, cpu: false, connected: true },
      { seat: 3, wallet: null, you: false, cpu: true, connected: true }
    ],
    match: {
      maxRounds: 3,
      roundsPlayed: 0,
      matchPoints: [0, 0],
      hakemCounts: [0, 0],
      accessTier: 1,
      finished: false
    },
    game: {
      phase: "playing",
      hakem: 0,
      currentPlayer,
      trump: "♠",
      ownHand: game.ownHand,
      handCounts: game.handCounts,
      tricksWon: [0, 0, 0, 0],
      teamTricks: [0, 0],
      trick: game.trick,
      lastTrick: game.lastTrick,
      finished: false,
      turnDeadlineAt: Date.now() + 30000,
      roundWinner: null
    },
    cpuTurnAt: null,
    cpuTurnDelayMs: 520
  };
}

function initialState() {
  return stateWith({
    ownHand: ownHand,
    handCounts: [13, 13, 13, 13],
    trick: [],
    lastTrick: []
  }, 0);
}

function makeNextState(previous, seat, trick) {
  const next = clone(previous);
  next.game.handCounts[seat]--;
  if (seat === 0) next.game.ownHand = next.game.ownHand.filter(card => card.id !== ownHand[0].id);
  next.game.currentPlayer = (seat + 1) % 4;
  next.game.trick = trick;
  next.game.lastTrick = [];
  if (trick.length === 4) {
    next.game.trick = [];
    next.game.lastTrick = clone(trick);
    next.game.currentPlayer = 0;
  }
  next.cardFlightUntil = Date.now() + 1900;
  return next;
}

async function runViewport(browserType, name, viewport, mobile = false, language = "en", disableWebAnimations = false) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    serviceWorkers: "block",
    isMobile: mobile && browserType === chromium,
    hasTouch: mobile
  });
  const page = await context.newPage();
  // The ambient canvas intentionally disables itself for OS-level reduced motion.
  // Keep visual-regression runs deterministic; reduced-motion behavior is handled by app CSS/JS.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.addInitScript((disableAnimations) => {
      if (disableAnimations) {
        Object.defineProperty(Element.prototype, "animate", {
          configurable: true,
          writable: true,
          value: undefined
        });
      }

      window.Audio = class {
        constructor() {
          this.paused = true;
          this.volume = 1;
          this.currentTime = 0;
          this.loop = false;
        }
        addEventListener() {}
        play() { this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
      };
      Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
      Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: undefined });

      class MockWebSocket {
        static OPEN = 1;
        constructor(url) {
          this.url = url;
          this.readyState = 0;
          this.listeners = {};
          window.__hokmMockSocket = this;
          setTimeout(() => {
            this.readyState = 1;
            this.emit("open", {});
          }, 0);
        }
        addEventListener(type, callback) {
          (this.listeners[type] ||= []).push(callback);
        }
        removeEventListener(type, callback) {
          this.listeners[type] = (this.listeners[type] || []).filter(fn => fn !== callback);
        }
        emit(type, event) {
          for (const callback of this.listeners[type] || []) callback(event);
        }
        send(payload) {
          window.__hokmMockLastSent = payload;
        }
        close() {
          this.readyState = 3;
          this.emit("close", {});
        }
      }
      window.WebSocket = MockWebSocket;
    }, disableWebAnimations);

    await page.route("https://fly-hokm-api.flyinfinityplatform.workers.dev/**", async route => {
      const url = new URL(route.request().url());
      // Let the wallet-auth probe reach the real Worker. The deliberately invalid
      // address is rejected before D1 is touched, while verifying this preview's CORS origin.
      if (url.pathname === "/api/auth/challenge" &&
          ["OPTIONS", "POST"].includes(route.request().method())) {
        return route.continue();
      }
      if (url.pathname === "/api/rooms") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, code: "QA2345", seat: 0 })
        });
      }
      if (url.pathname === "/api/rooms/QA2345/ticket") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, ticket: "mock-ticket" })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction(
      () => !!document.querySelector("#fi-games-neon-canvas"),
      null,
      { timeout: 5000 }
    ).catch(() => {});


    // The same shared cyan/blue/violet ambient canvas used by Chess Arena and Backgammon
    // must render behind Hokm without intercepting game interaction or changing layout.
    const ambientBackground = await page.evaluate(() => {
      const canvas = document.querySelector("#fi-games-neon-canvas");
      const arena = document.querySelector(".arena");
      if (!canvas || !arena) {
        let canvas2d = false;
        try { canvas2d = !!document.createElement("canvas").getContext("2d"); } catch {}
        const ambientScript = [...document.scripts].find(script =>
          script.src.includes("shared-neon-ambient.js")
        );
        const resource = performance.getEntriesByType("resource").find(entry =>
          entry.name.includes("shared-neon-ambient.js")
        );
        return {
          exists: !!canvas,
          arena: !!arena,
          readyState: document.readyState,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          ambientScriptSrc: ambientScript?.src || null,
          ambientResourceLoaded: !!resource,
          canvas2d
        };
      }
      const style = getComputedStyle(canvas);
      const arenaStyle = getComputedStyle(arena);
      const ambientScript = [...document.scripts].find(script =>
        script.src.includes("shared-neon-ambient.js")
      );
      const resource = performance.getEntriesByType("resource").find(entry =>
        entry.name.includes("shared-neon-ambient.js")
      );
      let canvas2d = false;
      try { canvas2d = !!document.createElement("canvas").getContext("2d"); } catch {}
      return {
        exists: true,
        width: canvas.width,
        height: canvas.height,
        display: style.display,
        position: style.position,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
        opacity: style.opacity,
        arenaPosition: arenaStyle.position,
        arenaZIndex: arenaStyle.zIndex,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        ambientScriptSrc: ambientScript?.src || null,
        ambientResourceLoaded: !!resource,
        canvas2d
      };
    });
    if (!ambientBackground.exists ||
        ambientBackground.display === "none" ||
        ambientBackground.position !== "fixed" ||
        ambientBackground.zIndex !== "0" ||
        ambientBackground.pointerEvents !== "none" ||
        !ambientBackground.width || !ambientBackground.height ||
        Number(ambientBackground.arenaZIndex) <= Number(ambientBackground.zIndex)) {
      throw new Error("Shared animated game background is missing or layered above Hokm: " +
        JSON.stringify(ambientBackground));
    }


    const walletButtons = await page.evaluate(() => ({
      browser: !!document.querySelector("#connectBrowserBtn") &&
        !document.querySelector("#connectBrowserBtn").disabled,
      wallet: !!document.querySelector("#connectWalletBtn") &&
        !document.querySelector("#connectWalletBtn").disabled
    }));
    if (!walletButtons.browser || !walletButtons.wallet) {
      throw new Error("Both wallet connection options must be present and enabled: " + JSON.stringify(walletButtons));
    }

    // This request uses an invalid address so the Worker returns 400 before any
    // nonce is created or D1 is written. A CORS failure means the preview origin is not allowlisted.
    const walletAuthProbe = await page.evaluate(async () => {
      const response = await fetch(
        "https://fly-hokm-api.flyinfinityplatform.workers.dev/api/auth/challenge",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: "not-a-valid-wallet" })
        }
      );
      return {
        status: response.status,
        body: await response.json(),
        origin: window.location.origin
      };
    });
    if (walletAuthProbe.status !== 400 ||
        walletAuthProbe.body?.error !== "A valid wallet address is required") {
      throw new Error("Wallet-auth API rejected the preview origin or failed its safe validation probe: " +
        JSON.stringify(walletAuthProbe));
    }

    if (language !== "en") await page.locator("#languageSelect").selectOption(language);

    const qaAuth = {
      wallet: "0x0000000000000000000000000000000000000001",
      tier: 2,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      sessionToken: "qa-online-motion-session"
    };
    await page.evaluate(detail => {
      window.hokmAuthState = detail;
      window.dispatchEvent(new CustomEvent("hokm:authenticated", { detail }));
      const originalStartRound = window.HokmEngine.startRound;
      window.HokmEngine.startRound = (match, options = {}) =>
        originalStartRound(match, { ...options, hakem: 0 });
    }, qaAuth);

    // Exercise the actual solo-mode suit and card click handlers in a simulated,
    // wallet-gated session. This is browser UI QA only; no wallet is connected.
    await page.locator("#hokmStartBtn:not([disabled])").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#hokmStartBtn").click();
    const soloSuit = page.locator("#hokmTrumpPicker [data-suit]").first();
    await soloSuit.waitFor({ state: "visible", timeout: 10000 });
    const soloSuitHit = await soloSuit.evaluate(button => {
      const r = button.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      return {
        suit: button.dataset.suit,
        pointerEvents: getComputedStyle(button).pointerEvents,
        disabled: button.disabled,
        hitButton: top?.closest?.("button") === button,
        hitTag: top?.tagName || null,
        hitClass: typeof top?.className === "string" ? top.className : ""
      };
    });
    if (!soloSuitHit.hitButton || soloSuitHit.pointerEvents === "none" || soloSuitHit.disabled) {
      throw new Error("Desktop/mobile solo trump control missed its hit target: " + JSON.stringify(soloSuitHit));
    }
    if (mobile) await soloSuit.tap({ timeout: 10000 });
    else await soloSuit.click({ timeout: 10000 });
    await page.waitForFunction(
      expected => document.getElementById("tableTrumpSuit")?.textContent?.trim() === expected,
      soloSuitHit.suit,
      { timeout: 10000 }
    );

    await page.waitForFunction(
      () => !document.querySelector(".hand-south")?.classList.contains("dealing"),
      null,
      { timeout: 10000 }
    );
    const soloCards = page.locator(".hand-south .hokm-card.playable");
    await soloCards.first().waitFor({ state: "visible", timeout: 10000 });
    const soloCardCount = await page.locator(".hand-south .hokm-card").count();
    const soloCard = soloCards.first();
    const soloCardHit = await soloCard.evaluate(button => {
      const r = button.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      return {
        cardId: button.dataset.cardId,
        pointerEvents: getComputedStyle(button).pointerEvents,
        disabled: button.disabled,
        hitCardId: top?.closest?.(".hokm-card")?.dataset?.cardId || null,
        hitTag: top?.tagName || null,
        hitClass: typeof top?.className === "string" ? top.className : ""
      };
    });
    if (soloCardHit.hitCardId !== soloCardHit.cardId ||
        soloCardHit.pointerEvents === "none" || soloCardHit.disabled) {
      throw new Error("Solo human card missed its hit target: " + JSON.stringify(soloCardHit));
    }
    if (mobile) await soloCard.tap({ timeout: 10000 });
    else await soloCard.click({ timeout: 10000 });
    await page.waitForFunction(
      expected => document.querySelectorAll(".hand-south .hokm-card").length === expected,
      soloCardCount - 1,
      { timeout: 10000 }
    );
    const soloClickChecks = { soloSuitHit, soloCardHit, cardsBefore: soloCardCount, cardsAfter: soloCardCount - 1 };

    // Reset the page so solo-mode CPU timers cannot overlap online-room UI tests.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
    if (language !== "en") await page.locator("#languageSelect").selectOption(language);
    await page.evaluate(detail => {
      window.hokmAuthState = detail;
      window.dispatchEvent(new CustomEvent("hokm:authenticated", { detail }));
    }, qaAuth);
    pageErrors.length = 0;
    consoleErrors.length = 0;

    await page.locator("#hokmCreateRoom").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#hokmCreateRoom").click();
    await page.waitForFunction(() => !!window.__hokmMockSocket && window.__hokmMockSocket.readyState === 1, null, { timeout: 10000 });

    const sendState = async state => page.evaluate(value => {
      const socket = window.__hokmMockSocket;
      if (!socket) throw new Error("Mock WebSocket was not created");
      socket.emit("message", { data: JSON.stringify({ type: "state", state: value }) });
    }, state);

    // Exercise the actual multiplayer trump and card button handlers with a mock
    // WebSocket, then continue the existing motion regression scenario unchanged.
    const onlineChoose = initialState();
    onlineChoose.game.phase = "choose-trump";
    onlineChoose.game.trump = null;
    onlineChoose.game.currentPlayer = 0;
    onlineChoose.game.ownHand = ownHand.slice(0, 5);
    onlineChoose.game.handCounts = [5, 5, 5, 5];
    onlineChoose.game.trick = [];
    onlineChoose.game.lastTrick = [];
    onlineChoose.cardFlightUntil = 0;
    await sendState(onlineChoose);
    const onlineSuit = page.locator("#hokmOnlineTrump [data-online-suit]").first();
    await onlineSuit.waitFor({ state: "visible", timeout: 10000 });
    const onlineSuitHit = await onlineSuit.evaluate(button => {
      const r = button.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      return {
        suit: button.dataset.onlineSuit,
        pointerEvents: getComputedStyle(button).pointerEvents,
        disabled: button.disabled,
        hitButton: top?.closest?.("button") === button,
        hitTag: top?.tagName || null,
        hitClass: typeof top?.className === "string" ? top.className : ""
      };
    });
    if (!onlineSuitHit.hitButton || onlineSuitHit.pointerEvents === "none" || onlineSuitHit.disabled) {
      throw new Error("Online trump control missed its hit target: " + JSON.stringify(onlineSuitHit));
    }
    if (mobile) await onlineSuit.tap({ timeout: 10000 });
    else await onlineSuit.click({ timeout: 10000 });
    const onlineSuitCommand = await page.evaluate(() => {
      try { return JSON.parse(window.__hokmMockLastSent || "null"); } catch { return null; }
    });
    if (onlineSuitCommand?.type !== "choose_trump" || onlineSuitCommand?.suit !== onlineSuitHit.suit) {
      throw new Error("Online trump click did not send the expected action: " + JSON.stringify({ onlineSuitHit, onlineSuitCommand }));
    }

    const onlinePlaying = initialState();
    onlinePlaying.cardFlightUntil = 0;
    await sendState(onlinePlaying);
    await page.waitForFunction(
      () => !document.querySelector(".hand-south")?.classList.contains("dealing"),
      null,
      { timeout: 10000 }
    );
    const onlinePlayable = page.locator(".hand-south .hokm-card.playable").first();
    await onlinePlayable.waitFor({ state: "visible", timeout: 10000 });
    // This room panel sits above the felt. Bring the actual card into the viewport
    // before using viewport-relative elementFromPoint coordinates.
    await onlinePlayable.scrollIntoViewIfNeeded();
    const onlineCardHit = await onlinePlayable.evaluate(button => {
      const r = button.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      return {
        cardId: button.dataset.cardId,
        pointerEvents: getComputedStyle(button).pointerEvents,
        disabled: button.disabled,
        hitCardId: top?.closest?.(".hokm-card")?.dataset?.cardId || null,
        hitTag: top?.tagName || null,
        hitClass: typeof top?.className === "string" ? top.className : ""
      };
    });
    if (onlineCardHit.hitCardId !== onlineCardHit.cardId ||
        onlineCardHit.pointerEvents === "none" || onlineCardHit.disabled) {
      throw new Error("Online human card missed its hit target: " + JSON.stringify(onlineCardHit));
    }
    if (mobile) await onlinePlayable.tap({ timeout: 10000 });
    else await onlinePlayable.click({ timeout: 10000 });
    const onlineCardCommand = await page.evaluate(() => {
      try { return JSON.parse(window.__hokmMockLastSent || "null"); } catch { return null; }
    });
    if (onlineCardCommand?.type !== "play_card" || onlineCardCommand?.cardId !== onlineCardHit.cardId) {
      throw new Error("Online card click did not send the expected action: " + JSON.stringify({ onlineCardHit, onlineCardCommand }));
    }

    let current = initialState();
    await sendState(current);
    await page.waitForFunction(() =>
      [".hand-south", ".seat-west .hand", ".hand-north", ".seat-east .hand"].every(selector => {
        const hand = document.querySelector(selector);
        return hand && hand.children.length === 13 && hand.classList.contains("dealing");
      }), null, { timeout: 10000 });

    // Layout QA after simulated authentication: no real wallet is connected or signed.
    const tableChromeLayout = await page.evaluate(() => {
      const rect = selector => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height };
      };
      const toolbar = rect(".table-toolbar");
      const heading = rect(".table-toolbar h2");
      const sound = rect("#soundToggle");
      const scoreboard = rect(".hokm-round-scoreboard");
      const felt = rect(".velvet-table");
      const hakem = rect(".table-center .hakem-pill");
      const trump = rect(".table-center .trump-pill");
      const intervalGap = hakem && trump
        ? Math.max(hakem.left, trump.left) - Math.min(hakem.right, trump.right)
        : null;
      return {
        toolbar, heading, sound, scoreboard, felt, hakem, trump, intervalGap,
        scoreboardPosition: getComputedStyle(document.querySelector(".hokm-round-scoreboard")).position
      };
    });
    if (!tableChromeLayout.heading?.width || !tableChromeLayout.sound?.width) {
      throw new Error("The Hokm table title or sound toggle is missing: " + JSON.stringify(tableChromeLayout));
    }
    if (tableChromeLayout.scoreboardPosition === "absolute" ||
        tableChromeLayout.scoreboard.top < tableChromeLayout.toolbar.bottom + 4 ||
        tableChromeLayout.scoreboard.bottom > tableChromeLayout.felt.top) {
      throw new Error("The score boxes overlap the title/sound controls or the table: " + JSON.stringify(tableChromeLayout));
    }
    if (mobile && tableChromeLayout.intervalGap < 10) {
      throw new Error("The mobile Hakem and trump indicators are too close or overlap: " + JSON.stringify(tableChromeLayout));
    }

    const dealState = await page.evaluate(() => {
      const read = selector => {
        const hand = document.querySelector(selector);
        return {
          dealing: hand.classList.contains("dealing"),
          animation: getComputedStyle(hand.firstElementChild).animationName,
          x: hand.style.getPropertyValue("--deal-x"),
          y: hand.style.getPropertyValue("--deal-y")
        };
      };
      return {
        south: read(".hand-south"),
        west: read(".seat-west .hand"),
        north: read(".hand-north"),
        east: read(".seat-east .hand")
      };
    });
    if (Object.values(dealState).some(value => !value.dealing || value.animation !== "hokmCardDeal")) {
      throw new Error("Online hands did not start the staggered deal animation: " + JSON.stringify(dealState));
    }
    if (!dealState.south.y.startsWith("clamp(-") || !dealState.north.y.startsWith("clamp(55px") ||
        !dealState.west.x.startsWith("clamp(70px") || !dealState.east.x.startsWith("clamp(-")) {
      throw new Error("Deal vectors do not originate from the felt center: " + JSON.stringify(dealState));
    }

    await page.waitForFunction(() =>
      [".hand-south", ".seat-west .hand", ".hand-north", ".seat-east .hand"].every(selector =>
        !document.querySelector(selector).classList.contains("dealing")
      ), null, { timeout: 4000 });

    const handSelectors = [".hand-south", ".seat-west .hand", ".hand-north", ".seat-east .hand"];
    let trick = [];
    let flightDiagnostic = null;
    for (let seat = 0; seat < 4; seat++) {
      const card = playedCards[seat];
      const sourceSelector = handSelectors[seat];
      const sourceInfo = await page.evaluate(({ selector, seat, cardId }) => {
        const hand = document.querySelector(selector);
        const source = seat === 0
          ? hand.querySelector('[data-card-id="' + cardId + '"]')
          : hand.querySelector(".hokm-card-back:last-child");
        const target = document.querySelector('.table-center .played-card[data-trick-slot="' + seat + '"]');
        if (!source || !target) throw new Error("Missing source or target card for seat " + seat);
        const s = source.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        return {
          source: { left: s.left, top: s.top, width: s.width, height: s.height },
          target: { left: t.left, top: t.top, width: t.width, height: t.height },
          sourceTag: source.tagName,
          sourceClass: source.className,
          expectedCenter: { x: s.left + s.width / 2, y: s.top + s.height / 2 }
        };
      }, { selector: sourceSelector, seat, cardId: ownHand[0].id });

      trick.push({ player: seat, card });
      const next = makeNextState(current, seat, trick);
      const cardText = card.rank + card.suit;
      flightDiagnostic = { seat, cardText, sourceInfo, handSelector: sourceSelector };
      await sendState(next);

      try {
        await page.waitForFunction(text =>
          [...document.querySelectorAll(".hokm-online-card-flight")].some(node => node.textContent.trim() === text),
          cardText,
          { timeout: 5000 }
        );
      } catch (error) {
        const domState = await page.evaluate(({ selector }) => {
          const rect = node => {
            if (!node) return null;
            const r = node.getBoundingClientRect();
            return { left:r.left, top:r.top, width:r.width, height:r.height };
          };
          const hand = document.querySelector(selector);
          const targetCards = [...document.querySelectorAll(".table-center .played-card")].map(node => ({
            text: node.textContent, className: node.className, rect: rect(node),
            slot: node.dataset.trickSlot, key: node.dataset.playedCardKey
          }));
          const flights = [...document.querySelectorAll(".hokm-online-card-flight")].map(node => ({
            text: node.textContent, left: node.style.left, top: node.style.top
          }));
          return {
            handCount: hand?.children.length,
            handDataset: hand ? { cardCount: hand.dataset.cardCount, signature: hand.dataset.handSignature } : null,
            handRect: rect(hand),
            sourceRect: rect(hand?.lastElementChild),
            sourceActive: !!hand?.querySelector(".hokm-card-source-active"),
            flights,
            targets: targetCards
          };
        }, { selector: sourceSelector });
        throw new Error("Seat " + seat + " card-flight animation was not observed: " +
          JSON.stringify({ flightDiagnostic, domState, cause: error.message }));
      }
      const flight = await page.locator(".hokm-online-card-flight").filter({ hasText: cardText }).last().evaluate(node => {
        const left = parseFloat(node.style.left);
        const top = parseFloat(node.style.top);
        const width = parseFloat(node.style.width);
        const height = parseFloat(node.style.height);
        return { left, top, width, height, center: { x: left + width / 2, y: top + height / 2 } };
      });
      if (Math.abs(flight.center.x - sourceInfo.expectedCenter.x) > 2 ||
          Math.abs(flight.center.y - sourceInfo.expectedCenter.y) > 2) {
        throw new Error("Seat " + seat + " card flight did not start at the hand card center: " +
          JSON.stringify({ expectedCenter: sourceInfo.expectedCenter, actual: flight }));
      }
      current = next;
      if (seat < 3) await page.waitForTimeout(1700);
    }

    await page.waitForFunction(() =>
      document.querySelectorAll(".table-center .played-card:not(.empty)").length === 4,
      null,
      { timeout: 10000 }
    );
    await page.waitForFunction(() =>
      document.querySelectorAll(".hokm-online-collect-flight").length === 4,
      null,
      { timeout: 7000 }
    );
    await page.waitForFunction(() =>
      document.querySelectorAll(".hokm-online-collect-flight").length === 0,
      null,
      { timeout: 7000 }
    );

    const afterCollection = await page.evaluate(() => ({
      visibleCards: document.querySelectorAll(".table-center .played-card:not(.empty)").length,
      hiddenInlineCards: [...document.querySelectorAll(".table-center .played-card")]
        .filter(card => card.style.opacity === "0").length,
      winnerHighlights: document.querySelectorAll(".player-chip.hokm-trick-winner").length
    }));
    if (afterCollection.visibleCards !== 0 || afterCollection.hiddenInlineCards !== 0) {
      throw new Error("Collected cards reappeared or remained hidden in the center: " + JSON.stringify(afterCollection));
    }

    // Simulate another WebSocket snapshot while the server is still retaining lastTrick.
    await sendState(current);
    const repeatedSnapshot = await page.evaluate(() =>
      document.querySelectorAll(".table-center .played-card:not(.empty)").length
    );
    if (repeatedSnapshot !== 0) {
      throw new Error("The same completed trick was rendered again before the Worker cleared it");
    }

    const cleared = clone(current);
    cleared.game.lastTrick = [];
    await sendState(cleared);
    await page.waitForTimeout(1500);
    const finalState = await page.evaluate(() => ({
      visibleCards: document.querySelectorAll(".table-center .played-card:not(.empty)").length,
      collectionClones: document.querySelectorAll(".hokm-online-collect-flight").length,
      winnerHighlights: document.querySelectorAll(".player-chip.hokm-trick-winner").length,
      dealingHands: document.querySelectorAll(".hand.dealing").length
    }));
    if (finalState.visibleCards || finalState.collectionClones || finalState.winnerHighlights || finalState.dealingHands) {
      throw new Error("Online card motion cleanup failed: " + JSON.stringify(finalState));
    }
    if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));

    console.log(JSON.stringify({
      scenario: name,
      ok: true,
      walletButtons,
      walletAuthProbe,
      soloClickChecks,
      onlineClickChecks: { onlineSuitHit, onlineSuitCommand, onlineCardHit, onlineCardCommand },
      tableChromeLayout,
      dealState,
      flightsStartedFromEachHand: 4,
      collection: afterCollection,
      finalState,
      reducedWebAnimations: disableWebAnimations,
      consoleErrors
    }));
  } catch (error) {
    failures.push({ scenario: name, error: error.message, flightDiagnostic: typeof flightDiagnostic === "undefined" ? null : flightDiagnostic, pageErrors, consoleErrors });
    console.error(JSON.stringify(failures[failures.length - 1]));
  } finally {
    await context.close();
    await browser.close();
  }
}

await runViewport(chromium, "desktop-chromium", { width: 1440, height: 1000 });
await runViewport(webkit, "mobile-webkit-persian-fallback", { width: 390, height: 844 }, true, "fa", true);

if (failures.length) process.exitCode = 1;
