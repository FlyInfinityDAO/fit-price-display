import test from "node:test";
import assert from "node:assert/strict";

globalThis.DurableObject ||= class {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
};

const { HokmRoom } = await import("../src/room.js");

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
  const originalNow = Date.now;
  Date.now = () => 1000;
  try {
    const roomController = new HokmRoom({}, {});
    for (const [difficulty, delay] of [["easy", 380], ["normal", 520], ["hard", 650], ["veryhard", 850]]) {
      const room = makeRoom(difficulty);
      roomController.queueCpuTurn(room);
      assert.equal(room.cpuTurnAt, 1500 + delay, difficulty + " should respect its think delay and card animation");
    }
  } finally {
    Date.now = originalNow;
  }
});

test("online scheduler clears stale CPU timers when the next seat is human", () => {
  const roomController = new HokmRoom({}, {});
  const room = makeRoom("veryhard", 2, [1]);
  roomController.queueCpuTurn(room);
  assert.equal("cpuTurnAt" in room, false);
});

test("online snapshots expose only the viewer's hand and persist room difficulty", () => {
  const roomController = new HokmRoom({}, {});
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
  const state = roomController.snapshot(room, players[0].wallet);
  assert.equal(state.cpuDifficulty, "veryhard");
  assert.deepEqual(state.game.ownHand, [ownCard]);
  assert.equal("hands" in state.game, false);
  assert.equal(JSON.stringify(state).includes(hiddenCard.id), false);
});
