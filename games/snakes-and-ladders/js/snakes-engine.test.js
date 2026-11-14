import test from "node:test";import assert from "node:assert/strict";import {createGame,roll,applyRoll,validateGame,SNAKES,LADDERS} from "./snakes-engine.js";
test("creates 2–4 player games",()=>{for(let n=2;n<=4;n++){const g=createGame(n);assert.equal(g.players.length,n);assert.ok(g.players.every(p=>p.position===0));validateGame(g);}});
test("moves by dice value and advances turn",()=>{const n=applyRoll(createGame(2),3);assert.equal(n.players[0].position,3);assert.equal(n.turn,1);});
test("climbs a ladder",()=>{const g=createGame(2);g.players[0].position=0;const n=applyRoll(g,1);assert.equal(n.players[0].position,38);assert.equal(n.lastAction.transport.type,"ladder");});
test("slides down a snake",()=>{const g=createGame(2);g.players[0].position=15;const n=applyRoll(g,1);assert.equal(n.players[0].position,6);assert.equal(n.lastAction.transport.type,"snake");});
test("requires exact roll to reach 100",()=>{const g=createGame(2);g.players[0].position=97;const n=applyRoll(g,5);assert.equal(n.players[0].position,97);assert.equal(n.lastAction.overshoot,true);});
test("wins exactly on 100",()=>{const g=createGame(2);g.players[0].position=96;const n=applyRoll(g,4);assert.equal(n.status,"finished");assert.equal(n.winner,0);});
test("rejects rolling while dice unresolved and invalid values",()=>{const g=createGame(2);g.dice=3;assert.throws(()=>roll(g));assert.throws(()=>applyRoll(createGame(2),0));});
test("has established snake and ladder endpoints",()=>{assert.equal(SNAKES[98],78);assert.equal(LADDERS[80],100);});
