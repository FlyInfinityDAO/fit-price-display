import test from "node:test";
import assert from "node:assert/strict";
import { ChessRoom } from "../src/room.js";

function makeDb() {
  const saved = [];
  return {
    saved,
    prepare(sql) {
      return {
        sql, values: [],
        bind(...values) { this.values = values; return this; },
        run: async () => ({ success: true })
      };
    },
    batch: async statements => { saved.push(...statements.map(statement => ({ sql: statement.sql, values: statement.values }))); }
  };
}

function makeRequest(path, method, wallet) {
  return new Request("https://room.test" + path, {
    method,
    headers: { "x-chess-wallet": wallet }
  });
}

test("two virtual players complete a legal checkmate game and persist both ranked results exactly once", async () => {
  const values = new Map();
  const received = { white: [], black: [] };
  const sockets = [
    { deserializeAttachment: () => ({ wallet: "0xwhite-test-wallet" }), send: message => received.white.push(JSON.parse(message)) },
    { deserializeAttachment: () => ({ wallet: "0xblack-test-wallet" }), send: message => received.black.push(JSON.parse(message)) }
  ];
  const db = makeDb();
  const ctx = {
    storage: {
      get: async key => values.get(key),
      put: async (key, value) => values.set(key, structuredClone(value)),
      setAlarm: async () => {},
      deleteAlarm: async () => {}
    },
    getWebSockets: () => sockets
  };
  const room = new ChessRoom(ctx, { DB: db });

  const created = await room.fetch(makeRequest("/create?code=SIMCH1", "POST", "0xwhite-test-wallet"));
  assert.equal(created.status, 200);
  assert.equal((await created.json()).room.status, "waiting");

  const joined = await room.fetch(makeRequest("/join", "POST", "0xblack-test-wallet"));
  assert.equal(joined.status, 200);
  assert.equal((await joined.json()).room.status, "active");

  const moves = [
    ["white", "f2", "f3"],
    ["black", "e7", "e5"],
    ["white", "g2", "g4"],
    ["black", "d8", "h4"]
  ];
  for (const [player, from, to] of moves) {
    await room.webSocketMessage(sockets[player === "white" ? 0 : 1], JSON.stringify({ type: "move", from, to }));
  }

  const finished = await values.get("game");
  assert.equal(finished.status, "finished");
  assert.equal(finished.result, "b");
  assert.equal(finished.reason, "checkmate");
  assert.match(finished.pgn, /Qh4\#/);
  assert.equal(finished.statsRecorded, true);

  const whiteResult = db.saved.find(row => row.values[1] === "0xwhite-test-wallet");
  const blackResult = db.saved.find(row => row.values[1] === "0xblack-test-wallet");
  assert.ok(whiteResult, "White player's result should be persisted");
  assert.ok(blackResult, "Black player's result should be persisted");
  assert.equal(whiteResult.values[2], "loss");
  assert.equal(whiteResult.values[4], 0);
  assert.equal(blackResult.values[2], "win");
  assert.equal(blackResult.values[4], 3);
  assert.equal(db.saved.length, 2);

  await room.saveGame(finished);
  assert.equal(db.saved.length, 2, "Repeated finalization must not duplicate result rows");
  assert.ok(received.white.some(message => message.type === "finished" && message.game.result === "b"));
  assert.ok(received.black.some(message => message.type === "finished" && message.game.result === "b"));

  console.log(JSON.stringify({
    ok: true,
    game: "chess",
    roomCode: finished.code,
    plies: moves.length,
    winner: finished.result,
    reason: finished.reason,
    persistedPlayerRows: db.saved.length,
    duplicateWritePrevented: true,
    bothPlayersReceivedFinalState: true
  }, null, 2));
});
