// Updates the cached FIT holder count from Binplorer's public free endpoint.
// The dashboard reads the generated JSON file, so visitors do not call the API.
const fs = require("node:fs");
const path = require("node:path");

const TOKEN_ADDRESS = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const API_BASE = "https://api.binplorer.com";
const API_KEY = process.env.BINPLORER_API_KEY || "freekey";
const OUTPUT_FILE = path.join(__dirname, "holders-data.json");
const MAX_SOURCE_AGE_MS = 72 * 60 * 60 * 1000;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000)
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from Binplorer: ${body.slice(0, 300)}`);
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Binplorer returned invalid JSON");
  }
  if (!data || typeof data !== "object" || data.error) {
    throw new Error(data?.error?.message || data?.error || "Binplorer returned an API error");
  }
  return data;
}

async function main() {
  const tokenUrl = `${API_BASE}/getTokenInfo/${TOKEN_ADDRESS}?apiKey=${encodeURIComponent(API_KEY)}`;
  const token = await fetchJson(tokenUrl);

  if (String(token.address || "").toLowerCase() !== TOKEN_ADDRESS.toLowerCase()) {
    throw new Error("Binplorer response contract address does not match FIT");
  }
  if (String(token.symbol || "").toUpperCase() !== "FIT" || Number(token.decimals) !== 18) {
    throw new Error("Binplorer response token identity does not match FIT");
  }

  const totalHolders = Number(token.holdersCount);
  if (!Number.isSafeInteger(totalHolders) || totalHolders < 1) {
    throw new Error("Binplorer returned an invalid FIT holdersCount");
  }

  const sourceUpdatedAt = Number(token.lastUpdated);
  if (!Number.isSafeInteger(sourceUpdatedAt) || sourceUpdatedAt <= 0) {
    throw new Error("Binplorer response is missing a valid lastUpdated timestamp");
  }
  const sourceUpdatedAtMs = sourceUpdatedAt * 1000;
  if (Date.now() - sourceUpdatedAtMs > MAX_SOURCE_AGE_MS || sourceUpdatedAtMs > Date.now() + 5 * 60 * 1000) {
    throw new Error("Binplorer token data is older than 72 hours or has a future timestamp; keeping previous cached value");
  }

  let indexedThroughBlock = null;
  try {
    const chainProgress = await fetchJson(`${API_BASE}/getLastBlock?apiKey=${encodeURIComponent(API_KEY)}`);
    const parsedBlock = Number(chainProgress.lastBlock);
    if (Number.isSafeInteger(parsedBlock) && parsedBlock > 0) {
      indexedThroughBlock = parsedBlock;
    }
  } catch (error) {
    console.warn("Could not read Binplorer indexed block height:", error.message);
  }

  const payload = {
    lastUpdated: new Date().toISOString(),
    sourceUpdatedAt: new Date(sourceUpdatedAtMs).toISOString(),
    totalHolders,
    source: "Binplorer public freekey API",
    contractAddress: TOKEN_ADDRESS,
    chainId: 56,
    indexedThroughBlock,
    totalSupplyRaw: String(token.totalSupply || ""),
    transfersCount: Number(token.transfersCount || 0),
    transactionsCount: Number(token.txsCount || 0)
  };

  const temporaryFile = OUTPUT_FILE + ".tmp";
  fs.writeFileSync(temporaryFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  fs.renameSync(temporaryFile, OUTPUT_FILE);

  console.log(`FIT holders updated: ${totalHolders.toLocaleString("en-US")}`);
  console.log(`Source data timestamp: ${payload.sourceUpdatedAt}`);
  console.log(`Binplorer indexed through block: ${indexedThroughBlock ?? "not available"}`);
}

main().catch((error) => {
  console.error("FIT holder count update failed:", error.message);
  process.exitCode = 1;
});
