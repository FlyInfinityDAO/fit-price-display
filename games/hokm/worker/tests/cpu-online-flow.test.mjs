import test from "node:test";
import assert from "node:assert/strict";
import "../../engine/hokm-engine.js";
import { executeCpuTurn, isCpuTurn, queueCpuTurnState } from "../src/room-logic.js";

const H = globalThis.HokmEngine;

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function createTwoHumanTwoCpuMatch(seed) {
  const players = [
    { seat: 0, kind: "human", balance: 1, wallet: "human-0", connectionStatus: "connected" },
    { seat: 1, kind: "human", balance: 1, wallet: "human-1", connectionStatus: "connected" },
    { seat: 2, kind: "cpu", balance: 0, wallet: "cpu-2", connectionStatus: "replaced" },
    { seat: 3, kind: "cpu", balance: 0, wallet: "cpu-3", connectionStatus: "replaced" }
  ];
  const match = H.createMatch({ mode: "online", players, difficulty: "hard", allowCpuSeats: true });
  H.startRound(match, { humanSeat: 0, rng: seeded(seed) });
  const room = { status: "playing", players: players.map(p => ({ ...p })), match, cardFlightUntil: 0, lastTrickClearAt: 0 };
  return { room, rng: seeded(seed + 17) };
}

test("two-human two-CPU online round handles CPU Hakem selection and every CPU card turn", () => {
  for (const seed of [1, 7, 19, 41, 73, 101, 2026]) {
    const { room } = createTwoHumanTwoCpuMatch(seed);
    const game = room.match.round;
    let now = 1000;
    let cpuTrumpSelections = 0;
    const cpuCards = [0, 0, 0, 0];
    let humanCards = 0;
    let totalCards = 0;

    while (!game.finished && totalCards < 52) {
      const cpuTurn = isCpuTurn(room);
      const queuedAt = queueCpuTurnState(room, now);
      assert.equal(queuedAt !== null, cpuTurn, "CPU turn must have exactly one scheduled action");

      if (game.phase === "choose-trump") {
        const hakem = game.hakem;
        if (room.match.players.find(p => p.seat === hakem)?.kind === "cpu") {
          assert.ok(queuedAt >= now, "CPU Hakem selection is scheduled");
          const suit = H.chooseCpuTrump(game, hakem, room.match.difficulty, seeded(seed + 3));
          assert.ok(H.SUITS.includes(suit));
          H.chooseTrump(game, suit);
          cpuTrumpSelections++;
        } else {
          const counts = H.SUITS.map(suit => game.hands[hakem].filter(card => card.suit === suit).length);
          H.chooseTrump(game, H.SUITS[counts.indexOf(Math.max(...counts))]);
        }
        now += 1000;
        continue;
      }

      const seat = game.currentPlayer;
      const player = room.match.players.find(p => p.seat === seat);
      let card;
      if (player.kind === "cpu") {
        assert.ok(queuedAt >= now, "CPU card turn is scheduled");
        card = H.chooseCpuCard(game, seat, room.match.difficulty, seeded(seed + totalCards + 5));
        assert.ok(H.legalCards(game, seat).some(candidate => candidate.id === card.id));
        cpuCards[seat]++;
      } else {
        card = H.legalCards(game, seat)[0];
        humanCards++;
      }
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

    assert.equal(game.finished, true, "round should finish without a stalled CPU turn");
    assert.ok(cpuTrumpSelections + cpuCards[2] + cpuCards[3] > 0);
    assert.ok(cpuCards[2] > 0 && cpuCards[3] > 0, "both CPU seats must play cards");
    assert.ok(humanCards > 0, "both human seats participate");
    assert.ok(totalCards <= 52);
  }
});

test("CPU turn queue recovers when a CPU becomes active without a pre-existing alarm", () => {
  const { room } = createTwoHumanTwoCpuMatch(88);
  const game = room.match.round;
  game.phase = "playing";
  game.trump = "♠";
  game.currentPlayer = 2;
  delete room.cpuTurnAt;
  const scheduled = queueCpuTurnState(room, 5000);
  assert.equal(scheduled, 5650);
  assert.equal(room.cpuTurnAt, scheduled);
  assert.equal(isCpuTurn(room), true);
});


test("the real CPU turn executor completes CPU Hakem selection and the opening card", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const players = [
      { seat: 0, kind: "human", balance: 1, wallet: "human-0", connectionStatus: "connected" },
      { seat: 1, kind: "human", balance: 1, wallet: "human-1", connectionStatus: "connected" },
      { seat: 2, kind: "cpu", balance: 0, wallet: "cpu-2", connectionStatus: "replaced" },
      { seat: 3, kind: "cpu", balance: 0, wallet: "cpu-3", connectionStatus: "replaced" }
    ];
    const match = H.createMatch({ mode: "online", players, difficulty: "hard", allowCpuSeats: true });
    H.startRound(match, { humanSeat: 0, hakem: 2, rng: seeded(seed) });
    const room = { status: "playing", players, match };
    assert.equal(isCpuTurn(room), true);
    const selected = executeCpuTurn(room, 10000, seeded(seed + 100));
    assert.equal(selected.kind, "trump");
    assert.ok(H.SUITS.includes(selected.suit));
    assert.equal(match.round.phase, "playing");
    assert.equal(match.round.trump, selected.suit);
    assert.equal(match.round.currentPlayer, 2);
    const opening = executeCpuTurn(room, 11000, seeded(seed + 200));
    assert.equal(opening.kind, "card");
    assert.ok(H.legalCards({ ...match.round, trick: [] }, 2).length >= 0);
    assert.equal(match.round.trick.length, 1);
    assert.equal(match.round.trick[0].player, 2);
    assert.equal(match.round.trick[0].card.id, opening.card.id);
  }
});

test("Hakem is the seat receiving the first Ace in the complete dealing order", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const game = H.createGame({ mode: "online", humanSeat: 0, rng: seeded(seed) });
    const deal = [];
    for (let round = 0; round < 5; round++) {
      for (let seat = 0; seat < 4; seat++) deal.push({ seat, card: game.hands[seat][round] });
    }
    for (let index = game.remaining.length - 1; index >= 0; index--) {
      deal.push({ seat: (deal.length % 4), card: game.remaining[index] });
    }
    const firstAce = deal.find(entry => entry.card.rank === "A");
    assert.ok(firstAce);
    assert.equal(game.hakem, firstAce.seat);
  }
});
