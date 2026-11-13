import test from "node:test";
import assert from "node:assert/strict";
import { advanceLocalState, getLocalWalletOutcome, handleLudoApi } from "../src/rooms-api.js";
import { createGame, legalPieceMoves } from "../../js/ludo-engine.js";

test("local match dice are generated server-side and a legal six-entry move is accepted",()=>{
  const initial=createGame(2,2);
  const rolled=advanceLocalState(initial,{type:"roll"},()=>0.99);
  assert.equal(rolled.dice,6);
  const move=legalPieceMoves(rolled)[0];
  const next=advanceLocalState(rolled,{type:"move",pieceIndex:move.pieceIndex,to:move.to});
  assert.equal(next.players[0].pieces[move.pieceIndex],0);
  assert.equal(next.dice,null);
  assert.equal(next.turn,0);
});

test("local match rejects forged and out-of-turn moves",()=>{
  const initial=createGame(2,2);
  assert.throws(()=>advanceLocalState(initial,{type:"move",pieceIndex:0,to:57}),/Illegal Ludo move/);
  const rolled=advanceLocalState(initial,{type:"roll"},()=>0);
  assert.equal(rolled.dice,null);
  assert.equal(rolled.turn,1);
});

test("unsupported client-supplied result endpoint is permanently rejected",async()=>{
  const response=await handleLudoApi(new Request("https://ludo-api.test/api/ludo/stats/record",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({source:"local",outcome:"win",roomCode:"LOCAL-FAKEFAKE"})}),{});
  assert.equal(response.status,410);
  const data=await response.json();
  assert.equal(data.ok,false);
});

test("local FIGS records the wallet holder's first seat, not any human winner",()=>{
  const playerOneWins=createGame(2,2);playerOneWins.status="finished";playerOneWins.winner="red";
  const playerTwoWins=createGame(2,2);playerTwoWins.status="finished";playerTwoWins.winner="yellow";
  assert.equal(getLocalWalletOutcome(playerOneWins),"win");
  assert.equal(getLocalWalletOutcome(playerTwoWins),"loss");
});
