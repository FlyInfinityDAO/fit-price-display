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

  // Exercise all eight languages and verify both document language and RTL direction.
  const expected = { en: "ltr", fa: "rtl", ar: "rtl", tr: "ltr", ru: "ltr", zh: "ltr", es: "ltr", pt: "ltr" };
  for (const [language, direction] of Object.entries(expected)) {
    await page.locator("#languageSelect").selectOption(language);
    await page.waitForFunction(lang => document.documentElement.lang === lang, language, { timeout: 5000 });
    assert.equal(await page.locator("html").getAttribute("dir"), direction, language + " direction");
    assert.ok((await page.locator("h1[data-i='title']").innerText()).trim(), language + " title must not be empty");
  }

  // Return to English and verify the main game controls are wired.
  await page.locator("#languageSelect").selectOption("en");
  await page.locator("#practiceBtn").click();
  await page.locator("#game-panel").waitFor({ state: "visible" });
  await page.locator("#cpuStartBtn").click();
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
  assert.ok(mobileLayout.boardLeft >= -1 && mobileLayout.boardRight <= mobileLayout.viewportWidth + 1,
    "Backgammon board must fit the mobile viewport: " + JSON.stringify(mobileLayout));

  // Verify both wallet buttons execute their handlers without opening a real wallet.
  await page.locator("#connectBrowserBtn").click();
  await page.getByText("PLAYWRIGHT_WALLET_STUB", { exact: false }).waitFor({ timeout: 5000 });
  assert.equal(await page.locator("#deniedPanel").isVisible(), true, "Wallet errors should be shown in the access card");
  await page.locator("#connectWalletBtn").click();
  await page.getByText("No compatible wallet was found.", { exact: false }).waitFor({ timeout: 5000 });

  assert.deepEqual(pageErrors, [], "No uncaught JavaScript exceptions should occur");
  console.log(JSON.stringify({
    ok: true,
    testedLanguages: Object.keys(expected),
    rtlVerified: ["fa", "ar"],
    practiceAndCpuControls: "passed",
    walletButtons: "handlers verified with a safe stub; no wallet connection/signature/transaction",
    pageErrors,
    failedRequests
  }, null, 2));
} finally {
  await browser.close();
}
