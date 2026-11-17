import test from "node:test";
import assert from "node:assert/strict";
import { createRoomSnapshot, isCpuTurn, queueCpuTurnState, scheduleCpuTurnAt } from "../src/room-logic.js";

function makeRoom(difficulty = "normal", currentPlayer = 1, cpuSeats = [1]) {
  return {
    status: "playing",
    cpuTurnAt: 555,
    cardFlightUntil: 1200,
    lastTrickClearAt: 1500,
    match: {
      difficulty,
      round: { phase: "playing", currentPlayer, finished: false },
      players: [0, 1, 2, 3].map(seat => ({ seat, kind: cpuSeats.includes(seat) ? "cpu" : "human" }))
    }
  };
}

test("online CPU think delay follows the configured difficulty", () => {
  for (const [difficulty, delay] of [["easy", 380], ["normal", 520], ["hard", 650], ["veryhard", 850]]) {
    const room = makeRoom(difficulty);
    assert.equal(scheduleCpuTurnAt(room, 1000), 1500 + delay, difficulty + " should respect its think delay and card animation");
  }
});

test("online scheduler clears stale CPU timers when the next seat is human", () => {
  const room = makeRoom("veryhard", 2, [1]);
  assert.equal(scheduleCpuTurnAt(room, 1000), null);
});

test("expired reconnect replacement is recognized as a CPU turn, not a human timeout", () => {
  const room = makeRoom("veryhard", 1, [1]);
  room.match.players[1].kind = "cpu";
  assert.equal(isCpuTurn(room), true);
  assert.equal(scheduleCpuTurnAt(room, 30000), 30850);
});

test("human turns remain on the ordinary turn-timeout path", () => {
  const room = makeRoom("veryhard", 2, [1]);
  assert.equal(isCpuTurn(room), false);
});

test("queuing a CPU turn clears an expired human clock to prevent immediate alarm loops", () => {
  const room = makeRoom("veryhard", 1, [1]);
  room.match.round.turnStartedAt = 0;
  room.match.round.turnDeadlineAt = 30000;
  assert.equal(queueCpuTurnState(room, 30000), 30850);
  assert.equal(room.match.round.turnStartedAt, undefined);
  assert.equal(room.match.round.turnDeadlineAt, undefined);
  assert.equal(room.cpuTurnAt, 30850);
});

test("queuing a CPU turn does not erase the active human player's clock", () => {
  const room = makeRoom("veryhard", 2, [1]);
  room.match.round.turnStartedAt = 10000;
  room.match.round.turnDeadlineAt = 40000;
  assert.equal(queueCpuTurnState(room, 30000), null);
  assert.equal(room.match.round.turnStartedAt, 10000);
  assert.equal(room.match.round.turnDeadlineAt, 40000);
  assert.equal(room.cpuTurnAt, undefined);
});

test("online snapshots expose only the viewer's hand and persist room difficulty", () => {
  const ownCard = { id: "A♠", suit: "♠", rank: "A" };
  const hiddenCard = { id: "K♥", suit: "♥", rank: "K" };
  const players = [0, 1, 2, 3].map(seat => ({
    seat, wallet: "0x" + String(seat + 1).repeat(40), tier: 1,
    kind: "human", connected: true
  }));
  const room = {
    code: "ABCD12",
    status: "playing",
    players,
    lastTrick: [],
    match: {
      difficulty: "veryhard",
      maxRounds: 3,
      roundsPlayed: 0,
      matchPoints: [0, 0],
      hakemCounts: [0, 0],
      accessTier: 1,
      finished: false,
      players: players.map(p => ({ seat: p.seat, connectionStatus: "connected" })),
      round: {
        phase: "playing", hakem: 0, currentPlayer: 0, trump: "♠",
        hands: [[ownCard], [hiddenCard], [], []],
        tricksWon: [0, 0, 0, 0], trick: [], teamTricks: [0, 0],
        finished: false, turnDeadlineAt: 30000
      }
    }
  };
  const state = createRoomSnapshot(room, players[0].wallet);
  assert.equal(state.cpuDifficulty, "veryhard");
  assert.deepEqual(state.game.ownHand, [ownCard]);
  assert.equal("hands" in state.game, false);
  assert.equal(JSON.stringify(state).includes(hiddenCard.id), false);
});
