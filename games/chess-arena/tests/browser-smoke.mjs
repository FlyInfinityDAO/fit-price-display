import { chromium } from "playwright";
import assert from "node:assert/strict";

const baseURL = process.env.CHESS_TEST_URL || "https://flyinfinitydao.github.io/fit-price-display/games/chess-arena/";
const browser = await chromium.launch({ headless: true });
const errors = [];
const failedRequests = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  const response = await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert.equal(response?.status(), 200, "Chess page should return HTTP 200");
  await page.locator("#languageSelect").waitFor();
  await page.locator("#chessBoard").waitFor({ state: "attached" });
  await page.locator("#connectBrowserBtn").waitFor();
  assert.equal(await page.locator("#gamePanel").isVisible(), false, "Board must remain hidden before wallet verification");
  assert.equal(await page.locator("#roomsPanel").isVisible(), false, "Room controls must remain hidden before wallet verification");
  assert.equal(await page.locator("#statsPanel").isVisible(), false, "Player stats must remain hidden before wallet verification");
  const expected = { en: "ltr", fa: "rtl", ar: "rtl", tr: "ltr", ru: "ltr", zh: "ltr", es: "ltr", pt: "ltr" };
  for (const [language, direction] of Object.entries(expected)) {
    await page.locator("#languageSelect").selectOption(language);
    await page.waitForFunction(lang => document.documentElement.lang === lang, language, { timeout: 5000 });
    assert.equal(await page.locator("html").getAttribute("dir"), direction, language + " direction");
    assert.ok((await page.locator("h1").innerText()).trim(), language + " title must not be empty");
  }
  await page.locator("#languageSelect").selectOption("en");
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    pageTitle: document.title,
    stylesheetCount: document.styleSheets.length,
    boardHidden: document.querySelector("#gamePanel").hidden
  }));
  assert.ok(layout.documentWidth <= layout.viewportWidth + 1, "Mobile page must not overflow horizontally: " + JSON.stringify(layout));
  assert.equal(layout.boardHidden, true);
  assert.deepEqual(errors, [], "No uncaught JavaScript exceptions should occur");
  console.log(JSON.stringify({ ok: true, url: baseURL, testedLanguages: Object.keys(expected), rtlVerified: ["fa", "ar"], walletGate: "locked before authentication", mobileLayout: layout, pageErrors: errors, failedRequests }, null, 2));
} finally {
  await browser.close();
}
