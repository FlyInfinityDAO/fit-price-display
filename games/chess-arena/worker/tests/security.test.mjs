import test from "node:test";
import assert from "node:assert/strict";
import { cleanupExpiredRecords, enforceRateLimit, getFitBalance, rpcJson } from "../src/security.js";

function rateLimitDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() { return { meta: { changes: 0 } }; },
            async first() {
              if (sql.startsWith("CREATE TABLE")) return {};
              const [key, windowStart, expiresAt] = args;
              const previous = rows.get(key);
              const hits = previous?.windowStart === windowStart ? previous.hits + 1 : 1;
              rows.set(key, { windowStart, hits, expiresAt });
              return { hits };
            }
          };
        }
      };
    }
  };
}

test("rate limiter allows requests up to the configured limit and resets each window", async () => {
  const env = { DB: rateLimitDb(), SESSION_SECRET: "test-only-session-secret-that-is-long-enough" };
  const request = new Request("https://example.test/api/auth/challenge", { headers: { "CF-Connecting-IP": "192.0.2.10" } });
  assert.equal((await enforceRateLimit(request, env, "challenge", 2, 60, 120)).allowed, true);
  assert.equal((await enforceRateLimit(request, env, "challenge", 2, 60, 121)).allowed, true);
  const blocked = await enforceRateLimit(request, env, "challenge", 2, 60, 122);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 58);
  assert.equal((await enforceRateLimit(request, env, "challenge", 2, 60, 180)).allowed, true);
  const otherIp = new Request("https://example.test/api/auth/challenge", { headers: { "CF-Connecting-IP": "192.0.2.11" } });
  assert.equal((await enforceRateLimit(otherIp, env, "challenge", 2, 60, 180)).allowed, true);
});

test("RPC errors are normalized and balance reads require BNB Smart Chain", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ result: "0x1" }), { status: 200 });
  await assert.rejects(() => getFitBalance({ BSC_RPC_URL: "https://rpc.test" }, "0x0000000000000000000000000000000000000001"), /not BNB Smart Chain/);
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  await assert.rejects(() => rpcJson("https://rpc.test", { method: "eth_chainId" }), /temporarily unavailable/);
});

test("balance read uses chain validation before querying FIT balance", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.method);
    return new Response(JSON.stringify({ result: body.method === "eth_chainId" ? "0x38" : "0xde0b6b3a7640000" }), { status: 200 });
  };
  const balance = await getFitBalance({ BSC_RPC_URL: "https://rpc.test" }, "0x0000000000000000000000000000000000000001");
  assert.equal(balance, 10n ** 18n);
  assert.deepEqual(calls, ["eth_chainId", "eth_call"]);
});

test("expired security records are cleaned in bounded batches", async () => {
  const statements = [];
  const env = {
    DB: {
      prepare(sql) {
        statements.push(sql);
        return { bind: (...args) => ({ run: async () => ({ meta: { changes: args.length ? 2 : 0 } }) }) };
      }
    }
  };
  const removed = await cleanupExpiredRecords(env, 200000);
  assert.equal(removed, 6);
  assert.equal(statements.length, 4);
  assert.match(statements[1], /wallet_nonces/);
  assert.match(statements[2], /websocket_tickets/);
  assert.match(statements[3], /api_rate_limits/);
  assert.ok(statements.slice(1).every(sql => /LIMIT 1000/.test(sql)));
});
