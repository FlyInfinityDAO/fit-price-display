const baseURL = (process.env.BACKGAMMON_WORKER_URL || "https://fly-chess-arena-api.flyinfinityplatform.workers.dev").replace(/\/$/, "");

async function getJson(path, expectedStatus) {
  const response = await fetch(baseURL + path, {
    method: "GET",
    headers: { "accept": "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(path + " returned non-JSON content-type: " + contentType);
  }
  const body = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(path + " expected HTTP " + expectedStatus + " but received " + response.status + ": " + JSON.stringify(body));
  }
  if (!body || body.ok !== true && body.ok !== false) {
    throw new Error(path + " returned an invalid JSON API envelope: " + JSON.stringify(body));
  }
  return { status: response.status, body };
}

const health = await getJson("/api/health", 200);
if (health.body.ok !== true || health.body.service !== "Fly Chess Arena API") {
  throw new Error("Worker health response did not identify the expected service: " + JSON.stringify(health.body));
}

for (const path of [
  "/api/backgammon/stats/me",
  "/api/backgammon/stats/leaderboard"
]) {
  const result = await getJson(path, 401);
  if (result.body.ok !== false ||
      !/Wallet session is invalid or expired/i.test(result.body.error || "")) {
    throw new Error(path + " did not reject the missing session as expected: " + JSON.stringify(result.body));
  }
  console.log("PASS " + path + " -> HTTP " + result.status + " (unauthenticated request rejected)");
}

console.log(JSON.stringify({
  ok: true,
  worker: baseURL,
  health: "HTTP 200",
  backgammonStatsMe: "HTTP 401 without a session",
  backgammonLeaderboard: "HTTP 401 without a session",
  note: "This read-only smoke test verifies route deployment and the authentication gate. It does not verify authenticated D1 reads."
}, null, 2));
