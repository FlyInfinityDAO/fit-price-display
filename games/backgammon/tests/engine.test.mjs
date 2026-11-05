import test from "node:test";
import assert from "node:assert/strict";
import { initialPosition, legalTurnSequences, winner } from "../js/backgammon-engine.js";

const position = () => ({ points: Array(24).fill(0), bar: { w: 0, b: 0 }, off: { w: 0, b: 0 } });

test("starting position has fifteen checkers per side", () => {
  const p = initialPosition();
  assert.equal(p.points.reduce((n, x) => n + Math.max(0, x), 0), 15);
  assert.equal(p.points.reduce((n, x) => n + Math.max(0, -x), 0), 15);
});

test("a point occupied by two opposing checkers is blocked", () => {
  const p = position(); p.points[10] = 1; p.points[9] = -2;
  const moves = legalTurnSequences(p, "w", [1, 2]).map(s => s.moves[0]);
  assert.equal(moves.some(m => m.from === 10 && m.to === 9), false);
});

test("hitting a single opposing checker sends it to the bar", () => {
  const p = position(); p.points[5] = 1; p.points[3] = -1;
  const seq = legalTurnSequences(p, "w", [2, 6]).find(s => s.moves[0]?.from === 5 && s.moves[0]?.to === 3);
  assert.ok(seq);
  assert.equal(seq.moves[0].hit, true);
  assert.equal(seq.position.bar.b, 1);
});

test("a checker on the bar has priority over all other checkers", () => {
  const p = position(); p.bar.w = 1; p.points[5] = 1; p.points[23] = -2;
  const moves = legalTurnSequences(p, "w", [1, 2]).map(s => s.moves[0]);
  assert.ok(moves.length > 0);
  assert.ok(moves.every(m => m.from === "bar"));
  assert.ok(moves.every(m => m.die === 2));
});

test("doubles allow four moves when all four are playable", () => {
  const p = position(); p.points[10] = 4;
  const seqs = legalTurnSequences(p, "w", [1, 1]);
  assert.ok(seqs.some(s => s.moves.length === 4));
});

test("when only one die can be played, the higher die is required", () => {
  const p = position(); p.points[2] = 1; p.points[10] = 1; p.points[1] = -2; p.points[8] = -2; p.points[9] = -2;
  const seqs = legalTurnSequences(p, "w", [1, 2]);
  assert.ok(seqs.length > 0);
  assert.ok(seqs.every(s => s.moves.length === 1 && s.moves[0].die === 2));
});

test("both dice are used when a two-move sequence is possible", () => {
  const p = position(); p.points[10] = 1;
  const seqs = legalTurnSequences(p, "w", [1, 2]);
  assert.ok(seqs.some(s => s.moves.length === 2));
});

test("oversized bear-off is forbidden while a checker remains farther from the exit", () => {
  const p = position(); p.points[1] = 1; p.points[3] = 1; p.off.w = 13;
  const moves = legalTurnSequences(p, "w", [6, 5]).map(s => s.moves[0]);
  assert.equal(moves.some(m => m.from === 1 && m.to === "off"), false);
});

test("a player wins after bearing off all fifteen checkers", () => {
  const p = position(); p.off.w = 15; p.points[12] = -15;
  assert.deepEqual(winner(p), { side: "w", multiplier: 2 });
});

test("black re-enters from the bar on the mirrored entry point", () => {
  const p = position(); p.bar.b = 1; p.points[0] = 1;
  const seqs = legalTurnSequences(p, "b", [1, 3]);
  assert.ok(seqs.length > 0);
  assert.ok(seqs.every(s => s.moves[0]?.from === "bar"));
  assert.ok(seqs.some(s => s.moves[0]?.to === 2 && s.moves[0]?.die === 3));
});

test("black can bear off exactly from its home board", () => {
  const p = position(); p.points[22] = -1; p.off.b = 14;
  const seqs = legalTurnSequences(p, "b", [2, 1]);
  assert.ok(seqs.some(s => s.moves.some(m => m.from === 22 && m.to === "off" && m.die === 2)));
});

test("black cannot overshoot while a checker remains farther from the exit", () => {
  const p = position(); p.points[22] = -1; p.points[20] = -1; p.off.b = 13;
  const moves = legalTurnSequences(p, "b", [6, 5]).map(s => s.moves[0]);
  assert.equal(moves.some(m => m.from === 22 && m.to === "off"), false);
});

test("a gammon is scored when the loser has borne off no checkers", () => {
  const p = position(); p.off.w = 15; p.points[12] = -15;
  assert.deepEqual(winner(p), { side: "w", multiplier: 2 });
});

test("a backgammon is scored when the loser has a checker on the bar", () => {
  const p = position(); p.off.w = 15; p.bar.b = 1; p.points[12] = -14;
  assert.deepEqual(winner(p), { side: "w", multiplier: 3 });
});

test("a backgammon is scored when the loser remains in the winner's home board", () => {
  const p = position(); p.off.w = 15; p.points[2] = -1; p.points[12] = -14;
  assert.deepEqual(winner(p), { side: "w", multiplier: 3 });
});

test("a single win is scored if the loser has borne off at least one checker", () => {
  const p = position(); p.off.w = 15; p.off.b = 1; p.points[12] = -14;
  assert.deepEqual(winner(p), { side: "w", multiplier: 1 });
});
