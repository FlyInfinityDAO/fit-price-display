import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import pathModule from "node:path";

const workerDir = pathModule.resolve(pathModule.dirname(fileURLToPath(import.meta.url)), "..");
const workerURL = "http://127.0.0.1:8787";
const secret = "isolated-test-session-secret-32-bytes-minimum";
const wallets = {
  white: "0x1111111111111111111111111111111111111111",
  black: "0x2222222222222222222222222222222222222222"
};

function tokenFor(address) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: address, chainId: 56, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
  const input = header + "." + payload;
  const signature = createHmac("sha256", secret).update(input).digest("base64url");
  return input + "." + signature;
}

function startRpcMock() {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", chunk => body += chunk);
    request.on("end", () => {
      let payload;
      try { payload = JSON.parse(body); } catch { payload = {}; }
      const result = payload.method === "eth_chainId" ? "0x38"
        : payload.method === "eth_call" ? "0xde0b6b3a7640000"
        : null;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id ?? 1, result }));
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(8545, "127.0.0.1", () => resolve(server));
  });
}

async function waitForWorker(child) {
  let output = "";
  child.stdout.on("data", chunk => output += chunk.toString());
  child.stderr.on("data", chunk => output += chunk.toString());
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error("Wrangler exited before ready:\n" + output);
    try {
      const response = await fetch(workerURL + "/api/health");
      if (response.ok && (await response.json()).ok) return;
    } catch {}
    await delay(1000);
  }
  throw new Error("Local Worker did not become ready:\n" + output);
}

async function api(page, path, token, body) {
  return page.evaluate(async ({ path, token, body }) => {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error(path + " failed: " + response.status + " " + JSON.stringify(data));
    return data;
  }, { path, token, body });
}

async function connectSocket(page, socketUrl) {
  return page.evaluate(async socketUrl => {
    const socket = new WebSocket(socketUrl);
    window.__gameSocket = socket;
    const first = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket initial state timed out")), 10000);
      socket.addEventListener("message", event => { clearTimeout(timer); resolve(JSON.parse(event.data)); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("WebSocket connection failed")); }, { once: true });
    });
    return first;
  }, socketUrl);
}

async function waitForSocketType(page, type) {
  return page.evaluate(type => new Promise((resolve, reject) => {
    const socket = window.__gameSocket;
    const timer = setTimeout(() => reject(new Error("Timed out waiting for WebSocket message: " + type)), 10000);
    const handler = event => {
      const data = JSON.parse(event.data);
      if (data.type === type || data.type === "error") {
        clearTimeout(timer);
        socket.removeEventListener("message", handler);
        if (data.type === "error") reject(new Error(data.error));
        else resolve(data);
      }
    };
    socket.addEventListener("message", handler);
  }), type);
}

async function sendSocket(page, message) {
  await page.evaluate(message => window.__gameSocket.send(JSON.stringify(message)), message);
}

const rpc = await startRpcMock();
let worker;
let browser;
try {
  const migration = spawn("npx", ["wrangler", "d1", "migrations", "apply", "fly-infinity-arena-isolated-test", "--local", "--config", "wrangler.test.toml"], { cwd: workerDir, stdio: "inherit" });
  const migrationCode = await new Promise((resolve, reject) => {
    migration.once("error", reject);
    migration.once("exit", resolve);
  });
  assert.equal(migrationCode, 0, "Local isolated D1 migrations must apply");

  worker = spawn("npx", ["wrangler", "dev", "--local", "--config", "wrangler.test.toml", "--ip", "127.0.0.1", "--port", "8787"], { cwd: workerDir, stdio: ["ignore", "pipe", "pipe"] });
  await waitForWorker(worker);

  browser = await chromium.launch({ headless: true });
  const whiteContext = await browser.newContext();
  const blackContext = await browser.newContext();
  const whitePage = await whiteContext.newPage();
  const blackPage = await blackContext.newPage();
  await Promise.all([whitePage.goto(workerURL + "/api/health"), blackPage.goto(workerURL + "/api/health")]);
  const whiteToken = tokenFor(wallets.white);
  const blackToken = tokenFor(wallets.black);

  // Chess: two separate browser contexts authenticate as different test wallets,
  // create/join the same room, receive independent WebSocket states, and observe a live move.
  const chessRoom = await api(whitePage, "/api/rooms/create", whiteToken, {});
  const chessCode = chessRoom.roomCode;
  await api(blackPage, "/api/rooms/join", blackToken, { roomCode: chessCode });
  const [whiteChessTicket, blackChessTicket] = await Promise.all([
    api(whitePage, "/api/rooms/" + chessCode + "/ticket", whiteToken, {}),
    api(blackPage, "/api/rooms/" + chessCode + "/ticket", blackToken, {})
  ]);
  const [whiteChessState, blackChessState] = await Promise.all([
    connectSocket(whitePage, whiteChessTicket.socketUrl),
    connectSocket(blackPage, blackChessTicket.socketUrl)
  ]);
  assert.equal(whiteChessState.game.status, "active");
  assert.equal(blackChessState.game.status, "active");
  const blackSawChessMove = waitForSocketType(blackPage, "move");
  await sendSocket(whitePage, { type: "move", from: "e2", to: "e4" });
  const chessBroadcast = await blackSawChessMove;
  assert.equal(chessBroadcast.game.turn, "b");
  assert.equal(chessBroadcast.game.fen.split(" ")[1], "b");

  // Backgammon: the same two independent browser contexts join a distinct room
  // and both observe the authoritative server's dice-roll broadcast.
  const bgRoom = await api(whitePage, "/api/backgammon/rooms/create", whiteToken, {});
  const bgCode = bgRoom.roomCode;
  await api(blackPage, "/api/backgammon/rooms/join", blackToken, { roomCode: bgCode });
  const [whiteBgTicket, blackBgTicket] = await Promise.all([
    api(whitePage, "/api/backgammon/rooms/" + bgCode + "/ticket", whiteToken, {}),
    api(blackPage, "/api/backgammon/rooms/" + bgCode + "/ticket", blackToken, {})
  ]);
  const [whiteBgState, blackBgState] = await Promise.all([
    connectSocket(whitePage, whiteBgTicket.socketUrl),
    connectSocket(blackPage, blackBgTicket.socketUrl)
  ]);
  assert.equal(whiteBgState.game.status, "active");
  assert.equal(blackBgState.game.status, "active");
  const blackSawRoll = waitForSocketType(blackPage, "rolled");
  await sendSocket(whitePage, { type: "roll" });
  const bgBroadcast = await blackSawRoll;
  assert.equal(bgBroadcast.game.turn, "w");
  assert.ok(Array.isArray(bgBroadcast.game.dice) && bgBroadcast.game.dice.length === 2);

  console.log(JSON.stringify({
    ok: true,
    environment: "isolated local Cloudflare Workers runtime (Wrangler) with local Durable Objects and D1",
    browserContexts: 2,
    distinctWallets: true,
    realWalletSignatures: false,
    blockchainTransactions: false,
    chess: { roomCode: chessCode, bothSocketsConnected: true, moveBroadcastVerified: true, nextTurn: chessBroadcast.game.turn },
    backgammon: { roomCode: bgCode, bothSocketsConnected: true, diceBroadcastVerified: true, dice: bgBroadcast.game.dice }
  }, null, 2));

  await whiteContext.close();
  await blackContext.close();
} finally {
  if (browser) await browser.close();
  if (worker && worker.exitCode === null) worker.kill("SIGTERM");
  await new Promise(resolve => rpc.close(resolve));
}
