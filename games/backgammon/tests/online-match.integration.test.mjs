import test from "node:test";
import assert from "node:assert/strict";
import { BackgammonRoom } from "../../chess-arena/worker/src/backgammon-room.js";

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

function makeRequest(path, method, wallet, body) {
  return new Request("https://room.test" + path, {
    method,
    headers: { "x-backgammon-wallet": wallet, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}

test("two virtual players complete a full legal backgammon match and persist both ranked results exactly once", async () => {
  const originalRandom = Math.random;
  let seed = 0x5eed1234;
  Math.random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  try {
    const storageValues = new Map();
    const received = { white: [], black: [] };
    const sockets = [
      { deserializeAttachment: () => ({ wallet: "0xwhite-test-wallet" }), send: message => received.white.push(JSON.parse(message)) },
      { deserializeAttachment: () => ({ wallet: "0xblack-test-wallet" }), send: message => received.black.push(JSON.parse(message)) }
    ];
    const db = makeDb();
    const ctx = {
      storage: {
        get: async key => storageValues.get(key),
        put: async (key, value) => storageValues.set(key, structuredClone(value))
      },
      getWebSockets: () => sockets
    };
    const room = new BackgammonRoom(ctx, { DB: db });

    const created = await room.fetch(makeRequest("/create?code=SIMBG1", "POST", "0xwhite-test-wallet"));
    assert.equal(created.status, 200);
    assert.equal((await created.json()).room.status, "waiting");

    const joined = await room.fetch(makeRequest("/join", "POST", "0xblack-test-wallet"));
    assert.equal(joined.status, 200);
    assert.equal((await joined.json()).room.status, "active");

    const initialWhite = await room.fetch(makeRequest("/snapshot", "GET", "0xwhite-test-wallet"));
    const initialBlack = await room.fetch(makeRequest("/snapshot", "GET", "0xblack-test-wallet"));
    assert.equal((await initialWhite.json()).room.status, "active");
    assert.equal((await initialBlack.json()).room.status, "active");

    let turns = 0;
    const maxTurns = 10000;
    while ((await storageValues.get("game")).status === "active" && turns < maxTurns) {
      turns++;
      let game = await storageValues.get("game");
      const wallet = game.turn === "w" ? "0xwhite-test-wallet" : "0xblack-test-wallet";
      const socket = sockets[game.turn === "w" ? 0 : 1];

      if (!game.dice) {
        await room.webSocketMessage(socket, JSON.stringify({ type: "roll" }));
        game = await storageValues.get("game");
      }

      let moveGuard = 0;
      while (game.status === "active" && game.turn === (wallet === "0xwhite-test-wallet" ? "w" : "b") && game.dice && moveGuard++ < 4) {
        const nextMove = game.sequenceOptions[0]?.moves[0];
        assert.ok(nextMove, "An available dice roll must expose a legal move sequence");
        await room.webSocketMessage(socket, JSON.stringify({ type: "move", from: nextMove.from, to: nextMove.to }));
        game = await storageValues.get("game");
      }
    }

    const finished = await storageValues.get("game");
    assert.ok(turns < maxTurns, "The simulated match should finish within the safety limit");
    assert.equal(finished.status, "finished");
    assert.ok(["w", "b"].includes(finished.result));
    assert.equal(finished.reason, "bear_off");
    assert.equal(finished.position.off[finished.result], 15);
    assert.equal(finished.statsRecorded, true);

    const whiteResult = db.saved.find(row => row.values[1] === "0xwhite-test-wallet");
    const blackResult = db.saved.find(row => row.values[1] === "0xblack-test-wallet");
    assert.ok(whiteResult, "White player's result should be persisted");
    assert.ok(blackResult, "Black player's result should be persisted");
    assert.equal(whiteResult.values[2], finished.result === "w" ? "win" : "loss");
    assert.equal(blackResult.values[2], finished.result === "b" ? "win" : "loss");
    assert.equal(whiteResult.values[4], finished.result === "w" ? 3 : 0);
    assert.equal(blackResult.values[4], finished.result === "b" ? 3 : 0);
    assert.equal(db.saved.length, 2, "Exactly two player records should be written");

    await room.saveGame(finished);
    assert.equal(db.saved.length, 2, "Repeated finalization must not duplicate result rows");
    assert.ok(received.white.some(message => message.type === "finished" && message.game.result === finished.result));
    assert.ok(received.black.some(message => message.type === "finished" && message.game.result === finished.result));

    console.log(JSON.stringify({
      ok: true,
      game: "backgammon",
      roomCode: finished.code,
      turns,
      winner: finished.result,
      reason: finished.reason,
      persistedPlayerRows: db.saved.length,
      duplicateWritePrevented: true,
      bothPlayersReceivedFinalState: true
    }, null, 2));
  } finally {
    Math.random = originalRandom;
  }
});
