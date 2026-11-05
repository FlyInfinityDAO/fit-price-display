import test from "node:test";
import assert from "node:assert/strict";
import { BackgammonRoom } from "../../chess-arena/worker/src/backgammon-room.js";
import { legalTurnSequences } from "../js/backgammon-engine.js";

function makeRoom() {
  const values = new Map();
  const ctx = {
    storage: {
      get: async key => values.get(key),
      put: async (key, value) => values.set(key, structuredClone(value))
    },
    getWebSockets: () => []
  };
  return { room: new BackgammonRoom(ctx), storage: ctx.storage };
}
function request(path, method, wallet, body) {
  return new Request("https://room.test" + path, {
    method,
    headers: { "x-backgammon-wallet": wallet, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}
const whiteSocket = { deserializeAttachment: () => ({ wallet: "white-wallet" }), send: () => {} };
const blackSocket = { deserializeAttachment: () => ({ wallet: "black-wallet" }), send: () => {} };

test("private room waits for a second distinct wallet", async () => {
  const { room, storage } = makeRoom();
  const created = await room.fetch(request("/create?code=ABC234", "POST", "white-wallet"));
  assert.equal(created.status, 200);
  assert.equal((await storage.get("game")).status, "waiting");
  const sameWallet = await room.fetch(request("/join", "POST", "white-wallet"));
  assert.equal(sameWallet.status, 200);
  assert.equal((await storage.get("game")).status, "waiting");
  const joined = await room.fetch(request("/join", "POST", "black-wallet"));
  assert.equal(joined.status, 200);
  assert.equal((await storage.get("game")).status, "active");
});

test("server rolls dice and rejects an illegal move before accepting a legal move", async () => {
  const { room, storage } = makeRoom();
  await room.fetch(request("/create?code=ABC234", "POST", "white-wallet"));
  await room.fetch(request("/join", "POST", "black-wallet"));
  await room.webSocketMessage(whiteSocket, JSON.stringify({ type: "roll" }));
  let game = await storage.get("game");
  assert.equal(game.turn, "w");
  assert.equal(game.dice.length, 2);
  assert.ok(game.sequenceOptions.length > 0);
  const before = JSON.stringify(game.position);

  await room.webSocketMessage(whiteSocket, JSON.stringify({ type: "move", from: "bar", to: "off" }));
  game = await storage.get("game");
  assert.equal(JSON.stringify(game.position), before);

  const legal = game.sequenceOptions[0].moves[0];
  await room.webSocketMessage(whiteSocket, JSON.stringify({ type: "move", from: legal.from, to: legal.to }));
  game = await storage.get("game");
  assert.notEqual(JSON.stringify(game.position), before);
});

test("the server rejects moves submitted by the player whose turn it is not", async () => {
  const { room, storage } = makeRoom();
  await room.fetch(request("/create?code=ABC234", "POST", "white-wallet"));
  await room.fetch(request("/join", "POST", "black-wallet"));
  await room.webSocketMessage(blackSocket, JSON.stringify({ type: "roll" }));
  const game = await storage.get("game");
  assert.equal(game.dice, null);
  assert.equal(game.turn, "w");
});

test("a room participant can rejoin an active room after reconnecting", async () => {
  const { room, storage } = makeRoom();
  await room.fetch(request("/create?code=ABC234", "POST", "white-wallet"));
  await room.fetch(request("/join", "POST", "black-wallet"));
  const rejoined = await room.fetch(request("/join", "POST", "white-wallet"));
  assert.equal(rejoined.status, 200);
  assert.equal((await storage.get("game")).status, "active");
});


test("bearing off the final checker ends the online game and broadcasts the winner", async () => {
  const sent = [];
  const values = new Map();
  const ctx = {
    storage: {
      get: async key => values.get(key),
      put: async (key, value) => values.set(key, structuredClone(value))
    },
    getWebSockets: () => [{ send: message => sent.push(JSON.parse(message)) }]
  };
  const room = new BackgammonRoom(ctx);
  await room.fetch(request("/create?code=ABC234", "POST", "white-wallet"));
  await room.fetch(request("/join", "POST", "black-wallet"));

  const position = {
    points: Array(24).fill(0),
    bar: { w: 0, b: 0 },
    off: { w: 14, b: 0 }
  };
  position.points[1] = 1;
  position.points[23] = -15;
  const dice = [2, 2];
  const game = await values.get("game");
  game.position = position;
  game.turn = "w";
  game.dice = dice;
  game.sequenceOptions = legalTurnSequences(position, "w", dice);
  await values.set("game", game);

  await room.webSocketMessage(whiteSocket, JSON.stringify({ type: "move", from: 1, to: "off" }));

  const finished = await values.get("game");
  assert.equal(finished.status, "finished");
  assert.equal(finished.result, "w");
  assert.equal(finished.reason, "bear_off");
  assert.equal(finished.position.off.w, 15);
  assert.equal(finished.multiplier, 2);
  assert.equal(sent.at(-1).type, "finished");
  assert.equal(sent.at(-1).game.result, "w");
  assert.equal(sent.at(-1).game.status, "finished");
});
