import { chromium } from "playwright";
import assert from "node:assert/strict";

const baseURL = process.env.BACKGAMMON_TEST_URL || "http://127.0.0.1:4173/games/backgammon/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pageErrors = [];
const failedRequests = [];
page.on("pageerror", error => pageErrors.push(error.message));
page.on("requestfailed", request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));

try {
  // Replace only the wallet bridge with a deterministic, non-interactive test stub.
  // No real wallet is requested, no signature is produced, and no transaction is sent.
  await page.route("**/walletconnect-bridge.js", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.fiSelectWalletProvider = async () => { throw new Error("PLAYWRIGHT_WALLET_STUB"); };'
  }));

  const response = await page.goto(baseURL, { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, "Backgammon page must load successfully");
  await page.locator("#languageSelect").waitFor();
  await page.locator(".access-card").waitFor({ state: "visible" });
  assert.equal(await page.locator("#access-title").innerText(), "Connect to enter",
    "Wallet access card should use the chess-style access heading");
  assert.equal(await page.locator("#connectBrowserBtn").isVisible(), true,
    "Browser wallet button should be visible");
  assert.equal(await page.locator("#connectWalletBtn").isVisible(), true,
    "WalletConnect / injected wallet button should be visible");

  // No game modes or board may be exposed before wallet verification.
  assert.equal(await page.locator("#mode-grid").isVisible(), false, "CPU/practice choices must stay hidden before wallet verification");
  assert.equal(await page.locator("#game-panel").isVisible(), false, "The board must stay hidden before wallet verification");
  await page.locator("#practiceBtn").dispatchEvent("click");
  await page.locator("#cpuStartBtn").dispatchEvent("click");
  assert.equal(await page.locator("#game-panel").isVisible(), false, "Direct event dispatch must not bypass the access gate");

  // Exercise all eight languages and verify both document language and RTL direction.
  const expected = { en: "ltr", fa: "rtl", ar: "rtl", tr: "ltr", ru: "ltr", zh: "ltr", es: "ltr", pt: "ltr" };
  for (const [language, direction] of Object.entries(expected)) {
    await page.locator("#languageSelect").selectOption(language);
    await page.waitForFunction(lang => document.documentElement.lang === lang, language, { timeout: 5000 });
    assert.equal(await page.locator("html").getAttribute("dir"), direction, language + " direction");
    assert.ok((await page.locator("h1[data-i='title']").innerText()).trim(), language + " title must not be empty");
  }

  // Failed wallet attempts must keep both game modes and the board locked.
  await page.locator("#languageSelect").selectOption("en");
  await page.locator("#connectBrowserBtn").click();
  await page.locator("#onlineStatus").waitFor({ state: "visible", timeout: 5000 });
  assert.match(await page.locator("#onlineStatus").innerText(), /PLAYWRIGHT_WALLET_STUB/);
  assert.equal(await page.locator("#deniedPanel").isVisible(), true, "Wallet errors should be shown in the access card");
  assert.equal(await page.locator("#mode-grid").isVisible(), false, "Failed verification must not unlock game modes");
  assert.equal(await page.locator("#game-panel").isVisible(), false, "Failed verification must not reveal the board");
  await page.locator("#connectWalletBtn").click();
  await page.locator("#onlineStatus").waitFor({ state: "visible", timeout: 5000 });
  assert.match(await page.locator("#onlineStatus").innerText(), /No injected wallet was found\\./);

  // Simulate a successful wallet provider and server response. No real wallet,
  // user signature, blockchain request, or transaction is used in this test.
  await page.evaluate(() => {
    const address = "0x1111111111111111111111111111111111111111";
    const signature = "0x" + "11".repeat(65);
    window.fiSelectWalletProvider = async () => ({
      request: async ({ method }) => {
        if (method === "eth_chainId") return "0x38";
        if (method === "net_version") return "56";
        if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
        if (method === "personal_sign" || method === "eth_sign") return signature;
        throw new Error("Unexpected test wallet method: " + method);
      },
      on() {},
      removeListener() {}
    });
  });
  await page.route("**/api/auth/challenge", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, nonce: "playwright-nonce", message: "Playwright test challenge" })
  }));
  await page.route("**/api/auth/verify", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true, sessionToken: "playwright-session",
      wallet: "0x1111111111111111111111111111111111111111",
      fitBalanceWei: "1000000000000000000"
    })
  }));
  await page.locator("#connectBrowserBtn").click();
  await page.locator("#mode-grid").waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await page.locator("#eligiblePanel").isVisible(), true, "Successful server verification should unlock access");
  assert.equal(await page.locator("#game-panel").isVisible(), false, "The board should remain hidden until a game mode is selected");
  await page.locator("#cpuStartBtn").click();
  await page.locator("#game-panel").waitFor({ state: "visible" });
  await page.locator("#rollBtn").waitFor({ state: "visible" });

  // Verify the mobile board fits the 390px viewport without horizontal page overflow.
  const mobileLayout = await page.evaluate(() => {
    const board = document.querySelector(".board-frame");
    const rect = board.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      boardLeft: rect.left,
      boardRight: rect.right,
      boardWidth: rect.width
    };
  });
  assert.ok(mobileLayout.documentWidth <= mobileLayout.viewportWidth + 1,
    "Mobile page must not overflow horizontally: " + JSON.stringify(mobileLayout));
  assert.ok(mobileLayout.boardWidth > 0 && mobileLayout.boardLeft >= -1 && mobileLayout.boardRight <= mobileLayout.viewportWidth + 1,
    "Backgammon board must fit the mobile viewport: " + JSON.stringify(mobileLayout));

  assert.deepEqual(pageErrors, [], "No uncaught JavaScript exceptions should occur");
  console.log(JSON.stringify({
    ok: true,
    testedLanguages: Object.keys(expected),
    rtlVerified: ["fa", "ar"],
    preAuthGameGate: "passed; modes and board stay hidden before verification; direct event attempts cannot bypass the gate",
    postAuthUnlock: "passed with mocked provider and server verification; CPU mode unlocks without real wallet activity",
    walletButtons: "handlers verified with a safe stub; no wallet connection/signature/transaction",
    pageErrors,
    failedRequests
  }, null, 2));
} finally {
  await browser.close();
}
