import test from "node:test";
import assert from "node:assert/strict";
import {resolveRoll,SNAKES,LADDERS} from "../src/rules.js";

test("server rules climb every mapped ladder endpoint",()=>{
 for(const [from,to] of Object.entries(LADDERS)){
  const start=Number(from)-1;
  const move=Number(from)===1?resolveRoll(0,6):resolveRoll(start,1);
  assert.equal(move.to,Number(to));
  assert.equal(move.transport.type,"ladder");
 }
});
test("server rules slide down mapped snake endpoints",()=>{
 for(const [from,to] of Object.entries(SNAKES)){
  const start=Number(from)-1;
  const move=resolveRoll(start,1);
  assert.equal(move.to,to);
  assert.equal(move.transport.type,"snake");
 }
});

test("a six is required to enter the board",()=>{
 const blocked=resolveRoll(0,4);assert.equal(blocked.to,0);assert.equal(blocked.needSix,true);
 const entered=resolveRoll(0,6);assert.equal(entered.needSix,false);assert.equal(entered.to,38);
});
test("after entry, normal dice values advance the player",()=>assert.equal(resolveRoll(12,3).to,15));

test("exact roll reaches square 100",()=>assert.equal(resolveRoll(96,4).to,100));
test("overshoot leaves the player in place",()=>{
 const move=resolveRoll(97,5);
 assert.equal(move.to,97);
 assert.equal(move.overshoot,true);
});
test("ordinary roll moves by the die value",()=>assert.equal(resolveRoll(10,4).to,14));
test("invalid server positions and dice are rejected",()=>{
 assert.throws(()=>resolveRoll(-1,2));
 assert.throws(()=>resolveRoll(2,7));
});
