import { getAddress, isAddress } from "ethers";

function isAllowedFrontendOrigin(origin, env) {
  return new Set(
    [env.FRONTEND_ORIGIN, ...(env.FRONTEND_ORIGINS || "").split(",")]
      .map(value => (value || "").trim())
      .filter(Boolean)
  ).has(origin);
}

const FIT_TOKEN = "0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa";
const MIN_FIT_WEI = 10n ** 18n;
const BSC_CHAIN_ID = 56;
const BALANCE_OF_SELECTOR = "70a08231";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return atob(padded);
}

async function verifySession(token, secret) {
  if (!token || !secret || secret.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const input = parts[0] + "." + parts[1];
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  let signature;
  try {
    signature = Uint8Array.from(decodeBase64Url(parts[2]), c => c.charCodeAt(0));
  } catch { return null; }
  const valid = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(input));
  if (!valid) return null;
  let payload;
  try { payload = JSON.parse(decodeBase64Url(parts[1])); } catch { return null; }
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000) ||
      payload.chainId !== BSC_CHAIN_ID || !isAddress(payload.sub)) return null;
  return payload;
}

async function getFitBalance(env, wallet) {
  const rpcUrl = env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/";
  const padded = wallet.slice(2).toLowerCase().padStart(64, "0");
  const [chainResponse, balanceResponse] = await Promise.all([
    fetch(rpcUrl, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] })
    }),
    fetch(rpcUrl, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2, method: "eth_call",
        params: [{ to: FIT_TOKEN, data: "0x" + BALANCE_OF_SELECTOR + padded }, "latest"]
      })
    })
  ]);
  if (!chainResponse.ok || !balanceResponse.ok) throw new Error("BSC RPC is unavailable.");
  const chain = await chainResponse.json();
  const result = await balanceResponse.json();
  if (Number.parseInt(chain.result, 16) !== BSC_CHAIN_ID) throw new Error("Configured RPC is not BNB Smart Chain.");
  if (result.error || typeof result.result !== "string" || !/^0x[0-9a-fA-F]+$/.test(result.result)) {
    throw new Error("FIT token balance could not be verified.");
  }
  return BigInt(result.result);
}

async function authorize(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = await verifySession(token, env.SESSION_SECRET);
  if (!session) return { response: json({ ok: false, error: "Wallet session is invalid or expired. Reconnect your wallet." }, 401) };
  const wallet = getAddress(session.sub);
  const balance = await getFitBalance(env, wallet);
  if (balance < MIN_FIT_WEI) {
    return { response: json({ ok: false, error: "At least 1 FIT is required to enter or continue a game.", balanceWei: balance.toString() }, 403) };
  }
  return { wallet, balance };
}

function validRoomCode(value) {
  return typeof value === "string" && /^[A-HJ-NP-Z2-9]{6}$/.test(value.toUpperCase());
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

async function roomStub(env, code) {
  const id = env.CHESS_ROOMS.idFromName(code);
  return env.CHESS_ROOMS.get(id);
}

async function internalRequest(stub, path, wallet, body, extraHeaders = {}) {
  return stub.fetch("https://chess-room.internal" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(wallet ? { "x-chess-wallet": wallet } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...extraHeaders
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function handleRoomApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && (path === "/api/stats/me" || path === "/api/stats/leaderboard")) {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS chess_player_results (room_code TEXT NOT NULL, wallet_address TEXT NOT NULL, outcome TEXT NOT NULL, reason TEXT NOT NULL, points INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (room_code, wallet_address))"
    ).run();
    if (path === "/api/stats/me") {
      const row = await env.DB.prepare(
        "SELECT wallet_address, COUNT(*) AS games, COALESCE(SUM(points), 0) AS points, SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) AS losses, SUM(CASE WHEN outcome = 'draw' THEN 1 ELSE 0 END) AS draws FROM chess_player_results WHERE wallet_address = ? GROUP BY wallet_address"
      ).bind(auth.wallet.toLowerCase()).first();
      const totals = row || { wallet_address: auth.wallet.toLowerCase(), games: 0, points: 0, wins: 0, losses: 0, draws: 0 };
      const rank = await env.DB.prepare(
        "WITH totals AS (SELECT wallet_address, SUM(points) AS points FROM chess_player_results GROUP BY wallet_address) SELECT COUNT(*) + 1 AS rank FROM totals WHERE points > ?"
      ).bind(totals.points).first();
      return json({ ok: true, stats: { ...totals, rank: rank?.rank || 1 } });
    }
    const leaderboard = await env.DB.prepare(
      "SELECT wallet_address, COUNT(*) AS games, SUM(points) AS points, SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) AS losses, SUM(CASE WHEN outcome = 'draw' THEN 1 ELSE 0 END) AS draws FROM chess_player_results GROUP BY wallet_address ORDER BY points DESC, wins DESC, games DESC LIMIT 20"
    ).all();
    return json({ ok: true, leaderboard: leaderboard.results || [] });
  }

  if (request.method === "GET" && (path === "/api/backgammon/stats/me" || path === "/api/backgammon/stats/leaderboard")) {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS backgammon_player_results (room_code TEXT NOT NULL, wallet_address TEXT NOT NULL, outcome TEXT NOT NULL, reason TEXT NOT NULL, points INTEGER NOT NULL, multiplier INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, PRIMARY KEY (room_code, wallet_address))"
    ).run();
    if (path === "/api/backgammon/stats/me") {
      const row = await env.DB.prepare(
        "SELECT wallet_address, COUNT(*) AS games, COALESCE(SUM(points), 0) AS points, SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) AS losses, SUM(CASE WHEN outcome = 'draw' THEN 1 ELSE 0 END) AS draws FROM backgammon_player_results WHERE wallet_address = ? GROUP BY wallet_address"
      ).bind(auth.wallet.toLowerCase()).first();
      const totals = row || { wallet_address: auth.wallet.toLowerCase(), games: 0, points: 0, wins: 0, losses: 0, draws: 0 };
      const rank = await env.DB.prepare(
        "WITH totals AS (SELECT wallet_address, SUM(points) AS points FROM backgammon_player_results GROUP BY wallet_address) SELECT COUNT(*) + 1 AS rank FROM totals WHERE points > ?"
      ).bind(totals.points).first();
      return json({ ok: true, stats: { ...totals, rank: rank?.rank || 1 } });
    }
    const leaderboard = await env.DB.prepare(
      "SELECT wallet_address, COUNT(*) AS games, SUM(points) AS points, SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) AS losses, SUM(CASE WHEN outcome = 'draw' THEN 1 ELSE 0 END) AS draws FROM backgammon_player_results GROUP BY wallet_address ORDER BY points DESC, wins DESC, games DESC LIMIT 20"
    ).all();
    return json({ ok: true, leaderboard: leaderboard.results || [] });
  }

  if (request.method === "POST" && path === "/api/rooms/create") {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      const stub = await roomStub(env, code);
      const response = await internalRequest(stub, "/create?code=" + code, auth.wallet, {});
      if (response.status === 409) continue;
      const data = await response.json();
      return json({ ...data, roomCode: code });
    }
    return json({ ok: false, error: "Could not allocate a room. Please try again." }, 503);
  }

  if (request.method === "POST" && path === "/api/rooms/cpu") {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    const body = await request.json().catch(() => ({}));
    const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
    const color = body.color === "b" ? "b" : "w";
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      const stub = await roomStub(env, code);
      const response = await internalRequest(stub, "/create?code=" + code + "&mode=cpu&difficulty=" + difficulty + "&color=" + color, auth.wallet, {});
      if (response.status === 409) continue;
      const data = await response.json();
      if (!response.ok || data.ok !== true) return json(data, response.status);
      return json({ ...data, roomCode: code });
    }
    return json({ ok: false, error: "Could not allocate a CPU game. Please try again." }, 503);
  }

  if (request.method === "POST" && path === "/api/rooms/join") {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    const body = await request.json();
    if (!validRoomCode(body.roomCode)) return json({ ok: false, error: "Enter a valid six-character room code." }, 400);
    const code = body.roomCode.toUpperCase();
    const response = await internalRequest(await roomStub(env, code), "/join", auth.wallet, {});
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }

  const ticketMatch = path.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/ticket$/);
  if (request.method === "POST" && ticketMatch) {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    const code = ticketMatch[1];
    const memberResponse = await internalRequest(await roomStub(env, code), "/check-player", auth.wallet);
    if (!memberResponse.ok) return new Response(memberResponse.body, { status: memberResponse.status, headers: { "content-type": "application/json" } });

    const ticket = crypto.randomUUID().replace(/-/g, "");
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO websocket_tickets (ticket, room_code, wallet_address, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    ).bind(ticket, code, auth.wallet.toLowerCase(), now + 30, now).run();
    const wsUrl = new URL("/api/rooms/" + code + "/ws?ticket=" + ticket, request.url);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    return json({ ok: true, ticket, socketUrl: wsUrl.toString(), expiresAt: now + 30 });
  }

  const socketMatch = path.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/ws$/);
  if (request.method === "GET" && socketMatch && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    const origin = request.headers.get("Origin");
    if (!isAllowedFrontendOrigin(origin, env)) return json({ ok: false, error: "Origin not allowed." }, 403);
    const code = socketMatch[1];
    const ticket = url.searchParams.get("ticket") || "";
    if (!/^[a-f0-9]{32}$/.test(ticket)) return json({ ok: false, error: "WebSocket ticket is invalid." }, 401);
    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare(
      "SELECT wallet_address, expires_at, used FROM websocket_tickets WHERE ticket = ? AND room_code = ?"
    ).bind(ticket, code).first();
    if (!row || row.used !== 0 || row.expires_at <= now) return json({ ok: false, error: "WebSocket ticket expired. Request a new one." }, 401);
    const consumed = await env.DB.prepare(
      "UPDATE websocket_tickets SET used = 1 WHERE ticket = ? AND room_code = ? AND used = 0 AND expires_at > ?"
    ).bind(ticket, code, now).run();
    if (!consumed.meta || consumed.meta.changes !== 1) return json({ ok: false, error: "WebSocket ticket has already been used." }, 409);

    const wallet = getAddress(row.wallet_address);
    const balance = await getFitBalance(env, wallet);
    if (balance < MIN_FIT_WEI) return json({ ok: false, error: "At least 1 FIT is required to join this game." }, 403);
    // Forward the WebSocket upgrade to the Durable Object. Without this
    // header the room sees a normal GET and rejects the handshake (426),
    // which surfaces in browsers as an abnormal close (1006).
    return internalRequest(await roomStub(env, code), "/ws", wallet, null, { "Upgrade": "websocket" });
  }

  const snapshotMatch = path.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})$/);
  if (request.method === "GET" && snapshotMatch) {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    const response = await internalRequest(await roomStub(env, snapshotMatch[1]), "/snapshot", auth.wallet);
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }


  if (request.method === "POST" && path === "/api/backgammon/rooms/cpu") {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    const body = await request.json().catch(() => ({}));
    const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      const stub = env.BACKGAMMON_ROOMS.get(env.BACKGAMMON_ROOMS.idFromName(code));
      const response = await stub.fetch("https://backgammon-room.internal/create?code=" + code + "&mode=cpu&difficulty=" + difficulty, {
        method: "POST", headers: { "x-backgammon-wallet": auth.wallet.toLowerCase() }
      });
      if (response.status === 409) continue;
      const data = await response.json();
      if (!response.ok || data.ok !== true) return json(data, response.status);
      return json({ ...data, roomCode: code });
    }
    return json({ ok: false, error: "Could not allocate a CPU game. Please try again." }, 503);
  }

  if (request.method === "POST" && path === "/api/backgammon/rooms/create") {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      const stub = env.BACKGAMMON_ROOMS.get(env.BACKGAMMON_ROOMS.idFromName(code));
      const response = await stub.fetch("https://backgammon-room.internal/create?code=" + code, {
        method: "POST", headers: { "x-backgammon-wallet": auth.wallet.toLowerCase() }
      });
      if (response.status === 409) continue;
      const data = await response.json();
      if (!response.ok || data.ok !== true) return json(data, response.status);
      return json({ ...data, roomCode: code });
    }
    return json({ ok: false, error: "Could not allocate a backgammon room. Please try again." }, 503);
  }

  if (request.method === "POST" && path === "/api/backgammon/rooms/join") {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    const body = await request.json().catch(() => ({}));
    if (!validRoomCode(body.roomCode)) return json({ ok: false, error: "Enter a valid six-character room code." }, 400);
    const code = body.roomCode.toUpperCase();
    const stub = env.BACKGAMMON_ROOMS.get(env.BACKGAMMON_ROOMS.idFromName(code));
    const response = await stub.fetch("https://backgammon-room.internal/join", {
      method: "POST", headers: { "x-backgammon-wallet": auth.wallet.toLowerCase() }
    });
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }

  const bgTicketMatch = path.match(/^\/api\/backgammon\/rooms\/([A-HJ-NP-Z2-9]{6})\/ticket$/);
  if (request.method === "POST" && bgTicketMatch) {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    const code = bgTicketMatch[1];
    const stub = env.BACKGAMMON_ROOMS.get(env.BACKGAMMON_ROOMS.idFromName(code));
    const memberResponse = await stub.fetch("https://backgammon-room.internal/check-player", {
      headers: { "x-backgammon-wallet": auth.wallet.toLowerCase() }
    });
    if (!memberResponse.ok) return new Response(memberResponse.body, { status: memberResponse.status, headers: { "content-type": "application/json" } });
    const ticket = crypto.randomUUID().replace(/-/g, "");
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO websocket_tickets (ticket, room_code, wallet_address, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    ).bind(ticket, "BG" + code, auth.wallet.toLowerCase(), now + 30, now).run();
    const wsUrl = new URL("/api/backgammon/rooms/" + code + "/ws?ticket=" + ticket, request.url);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    return json({ ok: true, ticket, socketUrl: wsUrl.toString(), expiresAt: now + 30 });
  }

  const bgSocketMatch = path.match(/^\/api\/backgammon\/rooms\/([A-HJ-NP-Z2-9]{6})\/ws$/);
  if (request.method === "GET" && bgSocketMatch && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    const origin = request.headers.get("Origin");
    if (!isAllowedFrontendOrigin(origin, env)) return json({ ok: false, error: "Origin not allowed." }, 403);
    const code = bgSocketMatch[1];
    const ticket = url.searchParams.get("ticket") || "";
    if (!/^[a-f0-9]{32}$/.test(ticket)) return json({ ok: false, error: "WebSocket ticket is invalid." }, 401);
    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare(
      "SELECT wallet_address, expires_at, used FROM websocket_tickets WHERE ticket = ? AND room_code = ?"
    ).bind(ticket, "BG" + code).first();
    if (!row || row.used !== 0 || row.expires_at <= now) return json({ ok: false, error: "WebSocket ticket expired. Request a new one." }, 401);
    const consumed = await env.DB.prepare(
      "UPDATE websocket_tickets SET used = 1 WHERE ticket = ? AND room_code = ? AND used = 0 AND expires_at > ?"
    ).bind(ticket, "BG" + code, now).run();
    if (!consumed.meta || consumed.meta.changes !== 1) return json({ ok: false, error: "WebSocket ticket has already been used." }, 409);
    const wallet = getAddress(row.wallet_address);
    const balance = await getFitBalance(env, wallet);
    if (balance < MIN_FIT_WEI) return json({ ok: false, error: "At least 1 FIT is required to join this game." }, 403);
    const stub = env.BACKGAMMON_ROOMS.get(env.BACKGAMMON_ROOMS.idFromName(code));
    return stub.fetch("https://backgammon-room.internal/ws", {
      headers: { "x-backgammon-wallet": wallet.toLowerCase(), "Upgrade": "websocket" }
    });
  }

  const bgSnapshotMatch = path.match(/^\/api\/backgammon\/rooms\/([A-HJ-NP-Z2-9]{6})$/);
  if (request.method === "GET" && bgSnapshotMatch) {
    const auth = await authorize(request, env);
    if (auth.response) return auth.response;
    const stub = env.BACKGAMMON_ROOMS.get(env.BACKGAMMON_ROOMS.idFromName(bgSnapshotMatch[1]));
    const response = await stub.fetch("https://backgammon-room.internal/snapshot", {
      headers: { "x-backgammon-wallet": auth.wallet.toLowerCase() }
    });
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }

  return null;
}
