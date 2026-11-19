import test from "node:test";
import assert from "node:assert/strict";
import "../../engine/hokm-engine.js";
import { isCpuTurn, queueCpuTurnState } from "../src/room-logic.js";

const H = globalThis.HokmEngine;

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

test("three humans and one CPU complete a full online round without a stalled CPU seat", () => {
  for (const seed of [3, 11, 29, 47, 89, 113, 20261119]) {
    const players = [
      { seat: 0, kind: "human", balance: 1, wallet: "human-0", connectionStatus: "connected" },
      { seat: 1, kind: "human", balance: 1, wallet: "human-1", connectionStatus: "connected" },
      { seat: 2, kind: "human", balance: 1, wallet: "human-2", connectionStatus: "connected" },
      { seat: 3, kind: "cpu", balance: 0, wallet: "cpu-3", connectionStatus: "replaced" }
    ];
    const match = H.createMatch({ mode: "online", players, difficulty: "hard", allowCpuSeats: true });
    H.startRound(match, { humanSeat: 0, rng: seeded(seed) });
    const room = { status: "playing", players, match, cardFlightUntil: 0, lastTrickClearAt: 0 };
    const game = match.round;
    let now = 1000;
    let cpuCards = 0;
    let humanCards = 0;
    let totalCards = 0;

    while (!game.finished && totalCards < 52) {
      const cpuTurn = isCpuTurn(room);
      const queuedAt = queueCpuTurnState(room, now);
      assert.equal(queuedAt !== null, cpuTurn, "CPU turn must have exactly one scheduled action");

      if (game.phase === "choose-trump") {
        const hakem = game.hakem;
        const player = players.find(candidate => candidate.seat === hakem);
        const suit = player.kind === "cpu"
          ? H.chooseCpuTrump(game, hakem, match.difficulty, seeded(seed + 5))
          : H.SUITS
              .map(s => ({ suit: s, count: game.hands[hakem].filter(card => card.suit === s).length }))
              .sort((a, b) => b.count - a.count)[0].suit;
        H.chooseTrump(game, suit);
        now += 1000;
        continue;
      }

      const seat = game.currentPlayer;
      const player = players.find(candidate => candidate.seat === seat);
      const card = player.kind === "cpu"
        ? H.chooseCpuCard(game, seat, match.difficulty, seeded(seed + totalCards + 9))
        : H.legalCards(game, seat)[0];
      if (player.kind === "cpu") {
        cpuCards++;
        assert.ok(queuedAt >= now, "CPU card turn must be scheduled");
      } else {
        humanCards++;
      }
      assert.ok(H.legalCards(game, seat).some(candidate => candidate.id === card.id));
      const result = H.playCard(game, seat, card.id);
      totalCards++;
      if (result.completed) {
        assert.equal(result.trick.length, 4);
        assert.equal(new Set(result.trick.map(entry => entry.player)).size, 4);
        room.lastTrickClearAt = now + 2500;
        room.cardFlightUntil = now + 1900;
      }
      now += 2000;
    }

    assert.equal(game.finished, true, "round should finish within 52 legal card plays");
    assert.ok(cpuCards > 0, "the single CPU seat must take turns");
    assert.ok(humanCards > 0, "all human seats must participate");
    assert.ok(totalCards >= 28 && totalCards <= 52 && totalCards % 4 === 0, "the round ends after a complete trick once a team reaches seven tricks");
  }
});
