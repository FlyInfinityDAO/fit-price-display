import test from "node:test";
import assert from "node:assert/strict";
import { initialPosition, legalTurnSequences, allInHome, winner, rollDice } from "./backgammon-engine.js";

test("standard opening position contains fifteen checkers per side", () => {
  const p = initialPosition();
  assert.equal(p.points.reduce((s,n)=>s+Math.max(0,n),0),15);
  assert.equal(p.points.reduce((s,n)=>s+Math.max(0,-n),0),15);
});
test("bar checkers must enter before other checkers move", () => {
  const p = initialPosition(); p.bar.w = 1;
  const seq = legalTurnSequences(p,"w",[1,2]);
  assert.ok(seq.length);
  assert.ok(seq.every(s=>s.moves.every(m=>m.from==="bar")));
});
test("doubles provide up to four moves", () => {
  const p = initialPosition();
  const seq = legalTurnSequences(p,"w",[3,3]);
  assert.ok(seq.length);
  assert.equal(seq[0].moves.length,4);
});
test("bearing off requires all checkers in home and no bar checkers", () => {
  const p = initialPosition();
  assert.equal(allInHome(p,"w"),false);
  p.points.fill(0); p.points[2]=15;
  assert.equal(allInHome(p,"w"),true);
  p.bar.w=1;
  assert.equal(allInHome(p,"w"),false);
});
test("winner is recognized after all fifteen checkers bear off", () => {
  const p = initialPosition(); p.off.w=15;
  assert.deepEqual(winner(p),{side:"w",multiplier:1});
});
test("dice are within standard range", () => {
  assert.deepEqual(rollDice(()=>0),[1,1]);
  assert.deepEqual(rollDice(()=>0.999999),[6,6]);
});
