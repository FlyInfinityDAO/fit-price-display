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

  // Verify both wallet buttons execute their handlers without opening a real wallet.
  await page.locator("#connectBrowserBtn").click();
  await page.getByText("PLAYWRIGHT_WALLET_STUB", { exact: false }).waitFor({ timeout: 5000 });
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
