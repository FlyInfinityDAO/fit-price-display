import { getAddress, isAddress, verifyMessage } from "ethers";
import { handleRoomApi } from "./rooms-api.js";
import { enforceRateLimit, cleanupExpiredRecords, getFitBalance } from "./security.js";

const FIT_TOKEN = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const BSC_CHAIN_ID = 56;
const MIN_FIT_WEI = 10n ** 18n;
const NONCE_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 30 * 60;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

function allowedFrontendOrigins(env) {
  return new Set(
    [env.FRONTEND_ORIGIN, ...(env.FRONTEND_ORIGINS || "").split(",")]
      .map(value => (value || "").trim())
      .filter(Boolean)
  );
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedFrontendOrigins(env).has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeText(value) {
  return base64url(new TextEncoder().encode(value));
}

async function signSession(payload, secret) {
  const header = encodeText(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeText(JSON.stringify(payload));
  const input = header + "." + body;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return input + "." + base64url(new Uint8Array(signature));
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
}

async function verifySession(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const input = parts[0] + "." + parts[1];
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const signature = Uint8Array.from(decodeBase64Url(parts[2]), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(input));
    if (!valid) return null;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

async function handleChallenge(request, env) {
  const body = await request.json();
  if (typeof body.address !== "string" || !isAddress(body.address)) {
    return json({ ok: false, error: "A valid wallet address is required." }, 400);
  }
  const wallet = getAddress(body.address);
  const service = ["Chess Arena", "Backgammon", "Ludo"].includes(body.service) ? body.service : "Chess Arena";
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + NONCE_TTL_SECONDS;
  const origin = request.headers.get("Origin") || env.FRONTEND_ORIGIN;
  const domain = new URL(origin).host;
  const message = [
    "Fly Infinity " + service + " wants you to sign in with your BNB Smart Chain wallet:",
    wallet,
    "",
    "Sign in to Fly Infinity " + service + ". This signature is free and does not authorize a token transfer.",
    "",
    "URI: " + origin,
    "Chain ID: " + BSC_CHAIN_ID,
    "Nonce: " + nonce,
    "Issued At: " + new Date(now * 1000).toISOString(),
    "Expiration Time: " + new Date(expiresAt * 1000).toISOString()
  ].join("\n");

  await env.DB.prepare(
    "INSERT INTO wallet_nonces (nonce, wallet_address, message, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).bind(nonce, wallet.toLowerCase(), message, expiresAt, now).run();

  return json({ ok: true, address: wallet, chainId: BSC_CHAIN_ID, nonce, message, expiresAt });
}

async function handleVerify(request, env) {
  const body = await request.json();
  if (typeof body.address !== "string" || !isAddress(body.address) ||
      typeof body.nonce !== "string" || typeof body.signature !== "string") {
    return json({ ok: false, error: "Address, nonce, and signature are required." }, 400);
  }

  const wallet = getAddress(body.address);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT message, expires_at, used FROM wallet_nonces WHERE nonce = ? AND wallet_address = ?"
  ).bind(body.nonce, wallet.toLowerCase()).first();

  if (!row || row.used !== 0 || row.expires_at <= now) {
    return json({ ok: false, error: "Nonce is invalid, expired, or already used. Request a new challenge." }, 401);
  }

  let recovered;
  try {
    recovered = getAddress(verifyMessage(row.message, body.signature));
  } catch {
    return json({ ok: false, error: "Wallet signature is invalid." }, 401);
  }
  if (recovered !== wallet) return json({ ok: false, error: "Signature does not match the wallet address." }, 401);

  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    return json({ ok: false, error: "Chess Arena session signing is not configured." }, 503);
  }

  let balance;
  try {
    balance = await getFitBalance(env, wallet);
  } catch {
    return json({ ok: false, error: "BSC RPC is temporarily unavailable. Please retry shortly." }, 503, { "retry-after": "5" });
  }
  const consumed = await env.DB.prepare(
    "UPDATE wallet_nonces SET used = 1 WHERE nonce = ? AND wallet_address = ? AND used = 0 AND expires_at > ?"
  ).bind(body.nonce, wallet.toLowerCase(), Math.floor(Date.now() / 1000)).run();
  if (!consumed.meta || consumed.meta.changes !== 1) {
    return json({ ok: false, error: "Challenge has already been used. Request a new one." }, 409);
  }
  if (balance < MIN_FIT_WEI) {
    return json({
      ok: false,
      error: "At least 1 FIT is required to enter Chess Arena.",
      balanceWei: balance.toString(),
      minimumWei: MIN_FIT_WEI.toString()
    }, 403);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signSession({
    sub: wallet,
    chainId: BSC_CHAIN_ID,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS
  }, env.SESSION_SECRET);

  return json({
    ok: true,
    wallet,
    chainId: BSC_CHAIN_ID,
    fitBalanceWei: balance.toString(),
    sessionToken: token,
    expiresAt: issuedAt + SESSION_TTL_SECONDS
  });
}

async function handleSession(request, env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    return json({ ok: false, error: "Chess Arena session signing is not configured." }, 503);
  }
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const session = await verifySession(token, env.SESSION_SECRET);
  if (!session || !isAddress(session.sub) || session.chainId !== BSC_CHAIN_ID) {
    return json({ ok: false, error: "Session is invalid or expired." }, 401);
  }

  let balance;
  try {
    balance = await getFitBalance(env, getAddress(session.sub));
  } catch {
    return json({ ok: false, error: "BSC RPC is temporarily unavailable. Please retry shortly." }, 503, { "retry-after": "5" });
  }
  if (balance < MIN_FIT_WEI) {
    return json({ ok: false, error: "At least 1 FIT is required. Access has been revoked.", balanceWei: balance.toString() }, 403);
  }
  return json({ ok: true, wallet: getAddress(session.sub), fitBalanceWei: balance.toString(), expiresAt: session.exp });
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(cleanupExpiredRecords(env).catch(error => console.error("Expired security record cleanup failed.", error)));
  },
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      if (!headers["access-control-allow-origin"]) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers });
    }
    if (origin && !allowedFrontendOrigins(env).has(origin)) return json({ ok: false, error: "Origin not allowed." }, 403);
    const requestPath = new URL(request.url).pathname;
    let rateConfig = null;
    if (request.method === "POST" && requestPath === "/api/auth/challenge") rateConfig = ["auth-challenge", 20, 600];
    else if (request.method === "POST" && requestPath === "/api/auth/verify") rateConfig = ["auth-verify", 30, 600];
    else if (request.method === "GET" && requestPath === "/api/auth/session") rateConfig = ["auth-session", 60, 60];
    else if (requestPath.startsWith("/api/rooms/") || requestPath.startsWith("/api/backgammon/") || requestPath.startsWith("/api/ludo/") ||
             requestPath === "/api/stats/me" || requestPath === "/api/stats/leaderboard") {
      rateConfig = ["game-api", 120, 60];
    }
    if (rateConfig) {
      try {
        const rate = await enforceRateLimit(request, env, ...rateConfig);
        if (!rate.allowed) return json({ ok: false, error: "Too many requests. Please wait and try again." }, 429, { "retry-after": String(rate.retryAfter) , ...headers });
      } catch {
        return json({ ok: false, error: "Security service is temporarily unavailable. Please retry shortly." }, 503, { "retry-after": "5", ...headers });
      }
    }
    if (request.method === "GET" && new URL(request.url).pathname === "/api/health") {
      return json({ ok: true, service: "Fly Chess Arena API", version: "0.1.0" }, 200, headers);
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/api/auth/challenge") {
      try { return await handleChallenge(request, env).then(r => withHeaders(r, headers)); }
      catch (error) { return json({ ok: false, error: error.message || "Challenge creation failed." }, 500, headers); }
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/api/auth/verify") {
      try { return await handleVerify(request, env).then(r => withHeaders(r, headers)); }
      catch (error) { return json({ ok: false, error: error.message || "Wallet verification failed." }, 500, headers); }
    }
    if (request.method === "GET" && new URL(request.url).pathname === "/api/auth/session") {
      try { return await handleSession(request, env).then(r => withHeaders(r, headers)); }
      catch (error) { return json({ ok: false, error: error.message || "Session check failed." }, 500, headers); }
    }
    try {
      const roomResponse = await handleRoomApi(request, env);
      if (roomResponse) {
        if (roomResponse.status === 101) return roomResponse;
        return withHeaders(roomResponse, headers);
      }
    } catch (error) {
      return json({ ok: false, error: error.message || "Room request failed." }, 500, headers);
    }
    return json({ ok: false, error: "Not found." }, 404, headers);
  }
};

export { ChessRoom } from "./room.js";
export { BackgammonRoom } from "./backgammon-room.js";
export { LudoRoom } from "./ludo-room.js";

function withHeaders(response, headers) {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, { status: response.status, headers: merged });
}

// No-op comment: verify Cloudflare Workers Builds from the main branch.
