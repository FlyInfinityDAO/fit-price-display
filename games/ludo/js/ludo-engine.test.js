import test from "node:test";
import assert from "node:assert/strict";
import {createGame,roll,legalPieceMoves,applyMove,chooseCpuMove,globalTrackIndex,SAFE_CELLS} from "./ludo-engine.js";

test("a six lets a piece leave the yard and grants another roll",()=>{
  let game=createGame(2,2);
  game=roll(game,()=>0.99);
  assert.equal(game.dice,6);
  const move=legalPieceMoves(game)[0];
  game=applyMove(game,0,move);
  assert.equal(game.players[0].pieces[0],0);
  assert.equal(game.turn,0);
  assert.equal(game.dice,null);
});

test("three consecutive sixes forfeit the player's turn",()=>{
  let game=createGame(2,2);
  for(let i=0;i<2;i++){
    game=roll(game,()=>0.99);
    const move=legalPieceMoves(game)[0];
    game=applyMove(game,0,move);
  }
  game=roll(game,()=>0.99);
  assert.equal(game.dice,null);
  assert.equal(game.turn,1);
  assert.equal(game.lastAction.type,"three-sixes");
});

test("a player must roll the exact number to finish",()=>{
  let game=createGame(2,2);
  game.players[0].pieces=[54,57,57,57];
  game.players[0].finished=3;
  game.dice=3;
  assert.equal(legalPieceMoves(game,0).some(m=>m.to===57),true);
  game=applyMove(game,0,{pieceIndex:0,from:54,to:57});
  assert.equal(game.status,"finished");
  assert.equal(game.winner,"red");
});

test("landing on a non-safe opponent square captures the piece",()=>{
  let game=createGame(2,2);
  game.players[0].pieces[0]=0;
  game.players[1].pieces[0]=27;
  game.dice=1;
  game=applyMove(game,0,{pieceIndex:0,from:0,to:1});
  assert.equal(game.players[1].pieces[0],-1);
  assert.equal(game.players[0].pieces[0],1);
});

test("two or more opponent pieces form a blockade",()=>{
  let game=createGame(2,2);
  game.players[0].pieces[0]=0;
  game.players[1].pieces[0]=27;
  game.players[1].pieces[1]=27;
  game.dice=1;
  assert.equal(legalPieceMoves(game,0).some(m=>m.pieceIndex===0&&m.to===1),false);
});

test("safe squares do not allow captures",()=>{
  let game=createGame(2,2);
  game.players[0].pieces[0]=7;
  game.players[1].pieces[0]=34;
  game.dice=1;
  const safe=globalTrackIndex("red",8);
  assert.equal(SAFE_CELLS.has(safe),true);
  game=applyMove(game,0,{pieceIndex:0,from:7,to:8});
  assert.equal(game.players[1].pieces[0],34);
});

test("the engine supports two, three and four players",()=>{
  assert.deepEqual([2,3,4].map(n=>createGame(n,n).players.length),[2,3,4]);
});

test("CPU strategy always selects a legal move",()=>{
  const game=createGame(4,1);
  game.dice=6;
  const move=chooseCpuMove(game,"hard");
  assert.ok(legalPieceMoves(game).some(candidate=>candidate.pieceIndex===move.pieceIndex&&candidate.to===move.to));
});


test("a blocked six still grants another roll to the same player",()=>{
  const game=createGame(2,2);
  game.players[0].pieces=[57,57,57,57];
  game.players[0].finished=4;
  const next=roll(game,()=>0.99);
  assert.equal(next.dice,null);
  assert.equal(next.turn,0);
  assert.equal(next.consecutiveSixes,1);
  assert.equal(next.lastAction.type,"blocked");
});

test("three consecutive sixes are counted even when the rolls are blocked",()=>{
  let game=createGame(2,2);
  game.players[0].pieces=[57,57,57,57];
  game.players[0].finished=4;
  game=roll(game,()=>0.99);
  game=roll(game,()=>0.99);
  game=roll(game,()=>0.99);
  assert.equal(game.turn,1);
  assert.equal(game.consecutiveSixes,0);
  assert.equal(game.lastAction.type,"three-sixes");
});

test("CPU player counts are clamped to available human seats",()=>{
  assert.equal(createGame(2,99).players.filter(p=>p.kind==="human").length,2);
  assert.equal(createGame(3,1).players.filter(p=>p.kind==="cpu").length,2);
  assert.equal(createGame(4,2).players.filter(p=>p.kind==="human").length,2);
});
