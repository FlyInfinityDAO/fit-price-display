import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const baseUrl = process.env.LUDO_PREVIEW_URL;
if (!baseUrl) throw new Error("LUDO_PREVIEW_URL is required.");

const scenarios = [
  { name: "desktop-chromium", engine: chromium, viewport: { width: 1440, height: 1000 } },
  { name: "mobile-webkit", engine: webkit, viewport: { width: 390, height: 844 } }
];

for (const scenario of scenarios) {
  const browser = await scenario.engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: scenario.viewport });
    await page.goto(new URL("/games/ludo/", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("#ludoBoard").waitFor({ state: "attached" });
    await page.waitForFunction(() =>
      Array.from(document.styleSheets).some(sheet => sheet.href?.includes("/games/ludo/css/ludo.css") && sheet.cssRules.length > 0)
    );

    const styles = await page.evaluate(() => {
      const board = document.querySelector("#ludoBoard");
      const addToken = (parent, id, color) => {
        const stack = document.createElement("div");
        stack.className = "piece-stack";
        const token = document.createElement("button");
        token.type = "button";
        token.className = "piece-token";
        token.id = id;
        token.disabled = true;
        token.style.setProperty("--token", color);
        const engraving = document.createElement("span");
        engraving.className = "piece-engraving";
        engraving.textContent = "✦";
        token.append(engraving);
        stack.append(token);
        parent.append(stack);
        return token;
      };

      const trackCell = document.createElement("div");
      trackCell.className = "cell track";
      const trackToken = addToken(trackCell, "track-token-probe", "#F00032");
      board.append(trackCell);

      const yardSpot = document.createElement("div");
      yardSpot.className = "yard-spot";
      const yardToken = addToken(yardSpot, "yard-token-probe", "#00B85C");
      board.append(yardSpot);

      const ordinaryDisabledButton = document.createElement("button");
      ordinaryDisabledButton.className = "primary-btn";
      ordinaryDisabledButton.disabled = true;
      ordinaryDisabledButton.textContent = "Disabled control probe";
      document.querySelector(".arena").append(ordinaryDisabledButton);

      const read = element => {
        const style = getComputedStyle(element);
        return { opacity: style.opacity, filter: style.filter, disabled: element.disabled };
      };
      const result = {
        trackPiece: read(trackToken),
        yardPiece: read(yardToken),
        ordinaryDisabledButton: read(ordinaryDisabledButton)
      };

      trackCell.remove();
      yardSpot.remove();
      ordinaryDisabledButton.remove();
      return result;
    });

    for (const [name, piece] of Object.entries({
      track: styles.trackPiece,
      yard: styles.yardPiece
    })) {
      assert.equal(piece.disabled, true, `${name} piece must remain non-interactive when disabled`);
      assert.equal(piece.opacity, "1", `${name} piece opacity must remain fully visible`);
      assert.ok(piece.filter.includes("saturate(1.65)"), name + " piece saturation must match active tokens");
      assert.ok(piece.filter.includes("contrast(1.08)"), name + " piece contrast must match active tokens");
    }

    assert.equal(styles.ordinaryDisabledButton.opacity, "0.42",
      "Unrelated disabled controls must keep the shared dimmed appearance");
    assert.ok(styles.ordinaryDisabledButton.filter.includes("saturate(0.65)"), "Unrelated disabled controls must keep their original desaturation");

    // Verify both wallet buttons are wired to their own provider entry points.
    await page.evaluate(() => {
      window.fiSelectWalletProvider = () => new Promise(() => {});
      window.ethereum = { request: () => new Promise(() => {}) };
    });
    await page.locator("#connectBrowserBtn").click();
    await page.waitForFunction(() =>
      document.querySelector("#accessStatus")?.textContent !==
      document.querySelector("[data-i='notConnected']")?.textContent
    ).catch(() => {});
    const browserButtonState = await page.evaluate(() => ({
      status: document.querySelector("#accessStatus")?.textContent,
      disabled: document.querySelector("#connectBrowserBtn")?.disabled
    }));
    assert.equal(browserButtonState.disabled, true,
      "Browser wallet button must invoke its connection handler");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.ethereum = { request: () => new Promise(() => {}) };
    });
    await page.locator("#connectWalletBtn").click();
    await page.waitForFunction(() => document.querySelector("#connectWalletBtn")?.disabled === true);
    const walletButtonState = await page.evaluate(() => ({
      status: document.querySelector("#accessStatus")?.textContent,
      disabled: document.querySelector("#connectWalletBtn")?.disabled
    }));
    assert.equal(walletButtonState.disabled, true,
      "Wallet button must invoke its connection handler");

    console.log(JSON.stringify({ scenario: scenario.name, ok: true, styles }));
  } finally {
    await browser.close();
  }
}
