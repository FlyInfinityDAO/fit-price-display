import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import net from "node:net";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Wallet } from "ethers";

const ORIGIN = "https://flyinfinitydao.github.io";
const WORKER_DIR = process.cwd();
const WRANGLER_BIN = resolve(WORKER_DIR, "node_modules/wrangler/bin/wrangler.js");
const WAIT_MS = 100;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", error => error ? reject(error) : resolve()));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitUntil(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(WAIT_MS);
  }
  throw new Error("Timed out waiting for " + label + (lastError ? ": " + lastError.message : ""));
}

function makeRpcServer(blockedAddress) {
  const balance = 10n * 10n ** 18n;
  return createServer(async (request, response) => {
    let body = "";
    request.setEncoding("utf8");
    for await (const chunk of request) body += chunk;
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid JSON" }));
      return;
    }
    let result;
    if (payload.method === "eth_chainId") {
      result = "0x38";
    } else if (payload.method === "eth_call") {
      const data = payload.params?.[0]?.data || "";
      const queriedAddress = ("0x" + data.slice(-40)).toLowerCase();
      result = queriedAddress === blockedAddress.toLowerCase()
        ? "0x0"
        : "0x" + balance.toString(16);
    } else {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id ?? null, error: { code: -32601, message: "Method not found" } }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id ?? null, result }));
  });
}

async function api(baseUrl, path, { token, method = "GET", body } = {}) {
  const headers = { Origin: ORIGIN };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { status: response.status, data };
}

async function login(baseUrl, wallet, wrongSigner) {
  const challenge = await api(baseUrl, "/api/auth/challenge", {
    method: "POST",
    body: { address: wallet.address }
  });
  assert.equal(challenge.status, 200, "wallet challenge should be issued");
  assert.equal(challenge.data.chainId, 56, "challenge must target BNB Smart Chain");
  assert.match(challenge.data.message, /does not authorize a token transfer/i);

  if (wrongSigner) {
    const wrongSignature = await wrongSigner.signMessage(challenge.data.message);
    const rejected = await api(baseUrl, "/api/auth/verify", {
      method: "POST",
      body: { address: wallet.address, nonce: challenge.data.nonce, signature: wrongSignature }
    });
    assert.equal(rejected.status, 401, "a signature from another wallet must be rejected");
  }

  const signature = await wallet.signMessage(challenge.data.message);
  const verified = await api(baseUrl, "/api/auth/verify", {
    method: "POST",
    body: { address: wallet.address, nonce: challenge.data.nonce, signature }
  });
  assert.equal(verified.status, 200, "a valid wallet signature and FIT balance should be accepted");
  assert.equal(verified.data.tier, 2, "the mocked 10 FIT balance should receive tier 2");

  const replay = await api(baseUrl, "/api/auth/verify", {
    method: "POST",
    body: { address: wallet.address, nonce: challenge.data.nonce, signature }
  });
  assert.equal(replay.status, 401, "a used nonce must not be reusable");

  const session = await api(baseUrl, "/api/auth/session", { token: verified.data.sessionToken });
  assert.equal(session.status, 200, "the signed session should be accepted");
  assert.equal(session.data.wallet.toLowerCase(), wallet.address.toLowerCase());
  return { wallet, token: verified.data.sessionToken };
}

async function connectRoom(baseUrl, code, player) {
  const ticket = await api(baseUrl, "/api/rooms/" + code + "/ticket", {
    method: "POST",
    token: player.token,
    body: {}
  });
  assert.equal(ticket.status, 200, "each admitted human player should receive a one-time WebSocket ticket");

  const socket = new WebSocket("ws://127.0.0.1:" + globalThis.__hokmWorkerPort +
    "/api/rooms/" + code + "/ws?ticket=" + encodeURIComponent(ticket.data.ticket));
  const client = { socket, latest: null, errors: [], seat: -1 };
  socket.addEventListener("message", event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "state") {
      client.latest = message.state;
      client.seat = message.state.seat;
    } else if (message.type === "error") {
      client.errors.push(String(message.error || "Unknown Worker error"));
    }
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out")), 12000);
    socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("WebSocket connection failed")); }, { once: true });
  });
  await waitUntil(() => client.latest && client.latest.seat >= 0, 10000, "initial room snapshot for seat");
  return client;
}

function closeClients(clients) {
  for (const client of clients) {
    try { client.socket.close(); } catch {}
  }
}

function roomState(clients) {
  return clients.find(client => client.latest)?.latest || null;
}

function suitWithMostCards(hand) {
  const counts = new Map();
  for (const card of hand) counts.set(card.suit, (counts.get(card.suit) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function chooseLegalCard(game) {
  const hand = game.ownHand || [];
  assert.ok(hand.length, "the active human seat should have its private hand");
  const leadSuit = game.trick?.[0]?.card?.suit;
  const followingSuit = leadSuit ? hand.filter(card => card.suit === leadSuit) : [];
  return (followingSuit.length ? followingSuit : hand)[0];
}

async function chooseTrumpIfHuman(clients, cpuSeats = []) {
  await waitUntil(() => roomState(clients)?.game, 15000, "game to start");
  const state = roomState(clients);
  if (state.game.phase !== "choose-trump") return;
  const hakem = state.game.hakem;
  if (cpuSeats.includes(hakem)) {
    await waitUntil(() => roomState(clients)?.game?.phase !== "choose-trump", 12000, "CPU Hakem to choose trump");
    return;
  }
  const player = clients.find(client => client.seat === hakem);
  assert.ok(player, "the Hakem must have an active human WebSocket");
  const suit = suitWithMostCards(player.latest.game.ownHand);
  assert.ok(suit, "the Hakem must have cards to select a trump suit");
  player.socket.send(JSON.stringify({ type: "choose_trump", suit }));
  await waitUntil(() => clients.every(client => client.latest?.game?.phase === "playing"), 10000, "trump selection to be applied to all room views");
}

async function waitForCardGate(clients) {
  await waitUntil(() => {
    const snapshots = clients.map(client => client.latest);
    const deadlines = snapshots.map(state => state?.cardFlightUntil || 0);
    const latestDeadline = Math.max(0, ...deadlines);
    const snapshotsSynchronized = deadlines.every(deadline => deadline === latestDeadline);
    const trickCollectionFinished = snapshots.every(state => state && !(state.game?.lastTrick?.length));
    return snapshotsSynchronized && trickCollectionFinished && Date.now() >= latestDeadline;
  }, 12000, "all players to finish card flight and completed-trick collection");
}

function snapshotCounts(clients) {
  return clients.map(client => ({
    seat: client.seat,
    status: client.latest?.status,
    phase: client.latest?.game?.phase,
    currentPlayer: client.latest?.game?.currentPlayer,
    handCounts: client.latest?.game?.handCounts,
    cardFlightUntil: client.latest?.cardFlightUntil,
    errors: client.errors.slice(-3)
  }));
}

async function waitForHumanCardAccepted(clients, player, seat, before, label) {
  const errorCounts = clients.map(client => client.errors.length);
  await waitUntil(() => {
    const accepted = clients.some(client => Number(client.latest?.game?.handCounts?.[seat]) < before);
    const rejected = clients.some((client, index) => client.errors.length > errorCounts[index]);
    return accepted || rejected;
  }, 7000, label + " response");
  if (!clients.some(client => Number(client.latest?.game?.handCounts?.[seat]) < before)) {
    throw new Error(label + " was rejected by Worker: " + JSON.stringify(snapshotCounts(clients)));
  }
  await waitUntil(() => clients.every(client => Number(client.latest?.game?.handCounts?.[seat]) < before),
    3000, label + " broadcast synchronization: " + JSON.stringify(snapshotCounts(clients)));
}

async function playOneHumanTrick(clients) {
  await chooseTrumpIfHuman(clients);
  const initialCounts = roomState(clients).game.handCounts.slice();
  let lastPlayedSeat = -1;
  for (let step = 0; step < 4; step++) {
    await waitForCardGate(clients);
    const state = roomState(clients);
    assert.equal(state.status, "playing");
    assert.equal(state.game.phase, "playing");
    const seat = state.game.currentPlayer;
    const player = clients.find(client => client.seat === seat);
    assert.ok(player, "every seat in the four-human test must have a connected player");
    const before = player.latest.game.handCounts[seat];
    const card = chooseLegalCard(player.latest.game);
    player.socket.send(JSON.stringify({ type: "play_card", cardId: card.id }));
    await waitForHumanCardAccepted(clients, player, seat, before, "seat " + seat + " card");
    lastPlayedSeat = seat;
    if (player.latest.game.lastTrick?.length === 4) break;
  }
  await waitUntil(() => clients.some(client => client.latest?.game?.lastTrick?.length === 4), 10000, "four-card trick to complete");
  const trick = clients.find(client => client.latest?.game?.lastTrick?.length === 4).latest.game.lastTrick;
  assert.equal(trick.length, 4);
  assert.equal(new Set(trick.map(entry => entry.player)).size, 4, "a completed trick must contain one card from each seat");
  assert.ok(initialCounts.reduce((sum, count) => sum + count, 0) - roomState(clients).game.handCounts.reduce((sum, count) => sum + count, 0) >= 4);
  return { trick, lastPlayedSeat };
}

async function waitForCpuCard(clients, cpuSeats) {
  // The Durable Object can run a CPU turn immediately after the last socket
  // connects, before this test receives its first complete room snapshot.
  // New Hokm rounds always start with 13 cards per seat, so compare with the
  // round's true starting point rather than a possibly already-advanced view.
  const startingCounts = [13, 13, 13, 13];
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    const state = roomState(clients);
    assert.equal(state.status, "playing", "CPU room must remain active");
    const counts = state.game.handCounts;
    if (cpuSeats.some(seat => counts[seat] < startingCounts[seat])) {
      return cpuSeats.find(seat => counts[seat] < startingCounts[seat]);
    }

    if (state.game.phase === "choose-trump") {
      await chooseTrumpIfHuman(clients, cpuSeats);
      continue;
    }

    const seat = state.game.currentPlayer;
    if (cpuSeats.includes(seat)) {
      await sleep(WAIT_MS);
      continue;
    }
    const player = clients.find(client => client.seat === seat);
    assert.ok(player, "the active human player must have a WebSocket");
    await waitForCardGate(clients);
    const current = roomState(clients);
    const active = player.latest.game;
    if (active.currentPlayer !== seat) continue;
    const before = active.handCounts[seat];
    const card = chooseLegalCard(active);
    player.socket.send(JSON.stringify({ type: "play_card", cardId: card.id }));
    await waitForHumanCardAccepted(clients, player, seat, before, "human card before a CPU turn");
  }
  throw new Error("No CPU card was played within 35 seconds");
}

async function run() {
  if (typeof WebSocket !== "function") throw new Error("Node 22 WebSocket support is required for real Worker WebSocket QA");
  const blockedWallet = Wallet.createRandom();
  const wrongSigner = Wallet.createRandom();
  const rpc = makeRpcServer(blockedWallet.address);
  await new Promise((resolve, reject) => rpc.listen(0, "127.0.0.1", error => error ? reject(error) : resolve()));
  const rpcPort = rpc.address().port;
  const workerPort = await freePort();
  globalThis.__hokmWorkerPort = workerPort;

  const stateDir = mkdtempSync(join(tmpdir(), "hokm-local-worker-"));
  mkdirSync(stateDir, { recursive: true });
  const migration = spawnSync(process.execPath, [
    WRANGLER_BIN, "d1", "migrations", "apply", "fly-hokm-db", "--local", "--persist-to", stateDir
  ], {
    cwd: WORKER_DIR,
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    input: "y\n",
    encoding: "utf8"
  });
  if (migration.status !== 0) {
    rpc.close();
    rmSync(stateDir, { recursive: true, force: true });
    throw new Error("Could not apply isolated local D1 migrations: " + (migration.stderr || migration.stdout || "unknown migration error"));
  }

  const secret = randomBytes(32).toString("hex");
  const child = spawn(process.execPath, [
    WRANGLER_BIN, "dev", "--local", "--ip", "127.0.0.1", "--port", String(workerPort),
    "--persist-to", stateDir, "--log-level", "error",
    "--var", "SESSION_SECRET:" + secret,
    "--var", "BSC_RPC_URL:http://127.0.0.1:" + rpcPort
  ], {
    cwd: WORKER_DIR,
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let workerOutput = "";
  child.stdout.on("data", chunk => { workerOutput += chunk.toString(); });
  child.stderr.on("data", chunk => { workerOutput += chunk.toString(); });
  const baseUrl = "http://127.0.0.1:" + workerPort;
  const clientsToClose = [];
  try {
    await waitUntil(async () => {
      if (child.exitCode !== null) throw new Error("wrangler dev exited: " + workerOutput.slice(-4000));
      try {
        const response = await fetch(baseUrl + "/api/health");
        return response.ok;
      } catch {
        return false;
      }
    }, 60000, "isolated local Worker startup");

    const health = await api(baseUrl, "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.data.service, "Fly Hokm API");

    const rejectedOrigin = await fetch(baseUrl + "/api/health", { headers: { Origin: "https://not-fly-infinity.example" } });
    assert.equal(rejectedOrigin.status, 403, "unapproved browser origins must be rejected");

    const blockedChallenge = await api(baseUrl, "/api/auth/challenge", {
      method: "POST", body: { address: blockedWallet.address }
    });
    assert.equal(blockedChallenge.status, 200, "wallet challenge failed: " + JSON.stringify(blockedChallenge.data) + "\n" + workerOutput.slice(-3500));
    const blockedSignature = await blockedWallet.signMessage(blockedChallenge.data.message);
    const blockedVerify = await api(baseUrl, "/api/auth/verify", {
      method: "POST",
      body: { address: blockedWallet.address, nonce: blockedChallenge.data.nonce, signature: blockedSignature }
    });
    assert.equal(blockedVerify.status, 403, "a wallet with less than 1 FIT must not enter Hokm");

    const wallets = Array.from({ length: 4 }, () => Wallet.createRandom());
    const players = [];
    for (let index = 0; index < wallets.length; index++) {
      players.push(await login(baseUrl, wallets[index], index === 0 ? wrongSigner : null));
    }

    const unauthenticated = await api(baseUrl, "/api/rooms", { method: "POST", body: { action: "create" } });
    assert.equal(unauthenticated.status, 401, "room creation must require a verified wallet session");

    const created = await api(baseUrl, "/api/rooms", {
      method: "POST", token: players[0].token, body: { action: "create" }
    });
    assert.equal(created.status, 200);
    const humanCode = created.data.code;
    assert.match(humanCode, /^[A-HJ-NP-Z2-9]{6}$/);
    for (let index = 1; index < 4; index++) {
      const joined = await api(baseUrl, "/api/rooms", {
        method: "POST", token: players[index].token, body: { action: "join", code: humanCode }
      });
      assert.equal(joined.status, 200, "human seat " + index + " should be admitted");
      assert.equal(joined.data.seat, index);
    }

    const humanClients = [];
    for (const player of players) {
      humanClients.push(await connectRoom(baseUrl, humanCode, player));
    }
    clientsToClose.push(...humanClients);
    await waitUntil(() => humanClients.every(client => client.latest?.status === "playing" && client.latest?.game), 15000, "four-human WebSocket room to start");
    assert.equal(new Set(humanClients.map(client => client.seat)).size, 4);

    const start = roomState(humanClients);
    const outOfTurnSeat = (start.game.currentPlayer + 1) % 4;
    const outOfTurnClient = humanClients.find(client => client.seat === outOfTurnSeat);
    const errorCount = outOfTurnClient.errors.length;
    outOfTurnClient.socket.send(JSON.stringify({ type: "play_card", cardId: "not-a-real-card" }));
    await waitUntil(() => outOfTurnClient.errors.length > errorCount, 5000, "out-of-turn action to be rejected");
    assert.match(outOfTurnClient.errors.at(-1), /not your turn/i);

    const humanTrick = await playOneHumanTrick(humanClients);
    assert.equal(humanTrick.trick.length, 4);

    closeClients(humanClients);
    clientsToClose.length = 0;
    await sleep(250);

    const cpuRoom = await api(baseUrl, "/api/rooms", {
      method: "POST", token: players[0].token, body: { action: "create" }
    });
    assert.equal(cpuRoom.status, 200);
    const cpuCode = cpuRoom.data.code;
    const cpuJoin = await api(baseUrl, "/api/rooms", {
      method: "POST", token: players[1].token, body: { action: "join", code: cpuCode }
    });
    assert.equal(cpuJoin.status, 200);

    const forbiddenCpuAdd = await api(baseUrl, "/api/rooms/" + cpuCode + "/cpu", {
      method: "POST", token: players[1].token, body: { seats: [2, 3], difficulty: "easy" }
    });
    assert.equal(forbiddenCpuAdd.status, 403, "only the room creator may add CPU seats");

    const cpusAdded = await api(baseUrl, "/api/rooms/" + cpuCode + "/cpu", {
      method: "POST", token: players[0].token, body: { seats: [2, 3], difficulty: "easy" }
    });
    assert.equal(cpusAdded.status, 200);
    assert.deepEqual(cpusAdded.data.cpuSeats, [2, 3]);

    const cpuClients = [
      await connectRoom(baseUrl, cpuCode, players[0]),
      await connectRoom(baseUrl, cpuCode, players[1])
    ];
    clientsToClose.push(...cpuClients);
    await waitUntil(() => cpuClients.every(client => client.latest?.status === "playing" && client.latest?.game), 15000, "two-human two-CPU room to start");
    assert.equal(cpuClients[0].latest.players.filter(player => player.cpu).length, 2);
    const cpuSeatPlayed = await waitForCpuCard(cpuClients, [2, 3]);

    console.log(JSON.stringify({
      ok: true,
      scope: "local Wrangler Worker + D1 + Durable Objects + real WebSockets; isolated from Cloudflare production",
      walletAuth: "valid signature accepted; wrong signature rejected; nonce replay rejected",
      fitGate: "wallet below 1 FIT rejected",
      humanMultiplayer: "four verified wallets joined; four real WebSockets connected; wrong-turn action rejected; one complete four-card trick played",
      cpuMultiplayer: "two verified humans plus two Worker-controlled CPU seats; owner-only CPU assignment; CPU played a legal card",
      cpuSeatPlayed,
      productionTouched: false
    }, null, 2));
  } finally {
    closeClients(clientsToClose);
    try { child.kill("SIGTERM"); } catch {}
    await sleep(300);
    try { rpc.close(); } catch {}
    rmSync(stateDir, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error("Hokm local Worker integration QA failed:", error.stack || error);
  process.exitCode = 1;
});
