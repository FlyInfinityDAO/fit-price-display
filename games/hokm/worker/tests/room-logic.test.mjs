import test from "node:test";
import assert from "node:assert/strict";
import {
  isCpuTurn,
  scheduleCpuTurnAt,
  queueCpuTurnState,
  nextHakemAfterRound,
  createRoomSnapshot,
  scheduleCpuRetryAt,
  clearCpuRetryState,
  pauseTurnClockForDisconnectedPlayer,
  resumeTurnClockForReconnectedPlayer,
  prepareNextTurnClock
} from "../src/room-logic.js";

function room({difficulty="normal",phase="playing",seat=2,now=1000}={}) {
  const players=[0,1,2,3].map(index=>({
    seat:index,kind:index===seat?"cpu":"human",
    wallet:"0x"+String(index+1).repeat(40),tier:1,connected:true
  }));
  return {
    status:"playing",
    players,
    match:{
      difficulty,
      players:players.map(player=>({...player,connectionStatus:"connected"})),
      round:{phase,hakem:seat,currentPlayer:seat,turnDeadlineAt:now+30000,turnStartedAt:now,hands:[[1],[2],[3],[4]],tricksWon:[0,0,0,0],trick:[],teamTricks:[0,0],playedCards:[]}
    },
    cardFlightUntil:0,
    lastTrickClearAt:0
  };
}

test("CPU turn detection uses the Hakem during trump selection and current player during play",()=>{
  const state=room({phase:"choose-trump",seat:2});
  assert.equal(isCpuTurn(state),true);
  state.match.players[2].kind="human";
  assert.equal(isCpuTurn(state),false);
  state.match.round.phase="playing";
  state.match.round.currentPlayer=1;
  state.match.players[1].kind="cpu";
  assert.equal(isCpuTurn(state),true);
});

test("CPU thinking delay respects each difficulty level",()=>{
  for(const [difficulty,delay] of [["easy",380],["normal",520],["hard",650],["veryhard",850]]){
    const state=room({difficulty,seat:2,now:5000});
    assert.equal(scheduleCpuTurnAt(state,5000),5000+delay);
  }
});

test("CPU scheduling waits until card flight and trick collection have both finished",()=>{
  const state=room({difficulty:"hard",seat:2,now:1000});
  state.cardFlightUntil=4000;
  state.lastTrickClearAt=6000;
  assert.equal(scheduleCpuTurnAt(state,1000),6650);
});

test("CPU queue clears human turn deadlines and replaces an earlier retry time",()=>{
  const state=room({difficulty:"veryhard",seat:2,now:1000});
  state.cpuTurnAt=500;
  const scheduled=queueCpuTurnState(state,1000);
  assert.equal(scheduled,1850);
  assert.equal(state.cpuTurnAt,1850);
  assert.equal("turnDeadlineAt" in state.match.round,false);
  assert.equal("turnStartedAt" in state.match.round,false);
  assert.equal("trumpDeadlineAt" in state,false);
});

test("CPU queue clears stale blocked state and does not schedule for a human turn",()=>{
  const state=room({seat:2});
  state.cpuTurnBlocked=true;
  queueCpuTurnState(state,1000);
  assert.equal(state.cpuTurnBlocked,undefined);
  state.match.players[2].kind="human";
  state.cpuTurnAt=2000;
  state.cpuTurnFailures=2;
  state.cpuTurnBlocked=true;
  state.error="CPU turn failed after retries";
  assert.equal(queueCpuTurnState(state,3000),null);
  assert.equal(state.cpuTurnAt,undefined);
  assert.equal(state.cpuTurnFailures,undefined);
  assert.equal(state.cpuTurnBlocked,undefined);
  assert.equal(state.error,undefined);
});

test("Hakem stays with the winning team and rotates counterclockwise after a loss",()=>{
  assert.equal(nextHakemAfterRound(0,0),0);
  assert.equal(nextHakemAfterRound(2,0),2);
  assert.equal(nextHakemAfterRound(0,1),3);
  assert.equal(nextHakemAfterRound(2,1),1);
  assert.equal(nextHakemAfterRound(1,0),0);
  assert.equal(nextHakemAfterRound(3,0),2);
  assert.throws(()=>nextHakemAfterRound(4,0),/Hakem/);
  assert.throws(()=>nextHakemAfterRound(0,2),/winning team/);
});

test("room snapshots expose only the requesting player's hand",()=>{
  const state=room({seat:2});
  state.match.round.hands=[
    [{id:"A♠",secret:"seat0"}],
    [{id:"K♠",secret:"seat1"}],
    [{id:"Q♠",secret:"seat2"}],
    [{id:"J♠",secret:"seat3"}]
  ];
  state.cpuTurnAt=4567;
  state.cpuTurnFailures=1;
  const snapshot=createRoomSnapshot(state,state.players[2].wallet);
  assert.equal(snapshot.cpuTurnAt,4567);
  assert.equal(snapshot.cpuTurnFailures,1);
  assert.equal(snapshot.cpuTurnBlocked,false);
  assert.equal(snapshot.seat,2);
  assert.deepEqual(snapshot.game.ownHand,[{id:"Q♠",secret:"seat2"}]);
  assert.deepEqual(snapshot.game.handCounts,[1,1,1,1]);
  const serialized=JSON.stringify(snapshot);
  assert.equal(serialized.includes("seat0"),false);
  assert.equal(serialized.includes("seat1"),false);
  assert.equal(serialized.includes("seat3"),false);
  assert.equal(serialized.includes("seat2"),true);
});

test("room snapshots expose public CPU and reconnect state without revealing full wallets",()=>{
  const state=room({seat:3});
  state.players[3].kind="cpu";
  state.players[3].wallet="cpu-seat-3";
  state.match.players[1].connectionStatus="disconnected";
  state.match.players[1].reconnectDeadlineAt=123456;
  const snapshot=createRoomSnapshot(state,state.players[0].wallet);
  assert.equal(snapshot.players[3].cpu,true);
  assert.equal(snapshot.players[3].wallet,null);
  assert.equal(snapshot.players[1].reconnectDeadlineAt,123456);
  assert.equal(snapshot.players[0].wallet,"0x1111…1111");
});

test("CPU retry schedule is bounded to three attempts and clears after recovery",()=>{
  const state={};
  assert.equal(scheduleCpuRetryAt(state,1000),2000);
  assert.equal(scheduleCpuRetryAt(state,2000),4000);
  assert.equal(scheduleCpuRetryAt(state,4000),7000);
  assert.equal(scheduleCpuRetryAt(state,7000),null);
  assert.equal(state.cpuTurnFailures,4);
  assert.equal(state.cpuTurnBlocked,true);
  state.error="CPU turn failed after retries";
  clearCpuRetryState(state);
  assert.equal(state.cpuTurnFailures,undefined);
  assert.equal(state.cpuTurnBlocked,undefined);
  assert.equal(state.error,undefined);
});

test("successful CPU retry state cleanup preserves unrelated room errors",()=>{
  const state={cpuTurnFailures:2,cpuTurnBlocked:true,error:"A different room warning"};
  clearCpuRetryState(state);
  assert.equal(state.cpuTurnFailures,undefined);
  assert.equal(state.cpuTurnBlocked,undefined);
  assert.equal(state.error,"A different room warning");
});


test("disconnect pauses only the active human turn and reconnect resumes its remaining time", () => {
  const state = room({seat:2,now:1000});
  state.match.players[2].kind = "human";
  state.match.round.currentPlayer = 2;
  state.match.round.turnStartedAt = 1000;
  state.match.round.turnDeadlineAt = 31000;
  assert.equal(pauseTurnClockForDisconnectedPlayer(state,2,11000),true);
  assert.equal(state.match.round.pausedTurnRemainingMs,20000);
  assert.equal(state.match.round.turnDeadlineAt,undefined);
  assert.equal(resumeTurnClockForReconnectedPlayer(state,2,51000),true);
  assert.equal(state.match.round.turnStartedAt,51000);
  assert.equal(state.match.round.turnDeadlineAt,71000);
  assert.equal(state.match.round.pausedTurnRemainingMs,undefined);
});

test("a disconnected human receives no active-turn deadline until reconnect or CPU takeover", () => {
  const state = room({seat:2,now:1000});
  state.match.players[1].kind = "human";
  state.match.players[1].connectionStatus = "disconnected";
  state.match.round.currentPlayer = 1;
  prepareNextTurnClock(state,5000);
  assert.equal(state.match.round.turnDeadlineAt,undefined);
  assert.equal(state.match.round.turnStartedAt,undefined);
  assert.equal(resumeTurnClockForReconnectedPlayer(state,1,9000),true);
  assert.equal(state.match.round.turnDeadlineAt,39000);
});

test("CPU Hakem turn exposes an automatic thinking deadline in the room snapshot", () => {
  const state = room({phase:"choose-trump",seat:2,now:1000});
  state.cpuTurnAt = 1650;
  const snapshot = createRoomSnapshot(state,state.players[0].wallet);
  assert.equal(snapshot.cpuTurnAt,1650);
  assert.equal(snapshot.cpuTurnDelayMs,520);
});


test("duplicate disconnect events do not reset a paused human turn clock", () => {
  const state = room({seat:2,now:1000});
  state.match.players[2].kind = "human";
  state.match.round.currentPlayer = 2;
  state.match.round.turnDeadlineAt = 31000;
  assert.equal(pauseTurnClockForDisconnectedPlayer(state,2,11000),true);
  assert.equal(pauseTurnClockForDisconnectedPlayer(state,2,15000),true);
  assert.equal(state.match.round.pausedTurnRemainingMs,20000);
});

test("disconnecting the Hakem pauses trump selection and reconnect resumes the remaining choice time", () => {
  const state = room({phase:"choose-trump",seat:2,now:1000});
  state.match.players[2].kind = "human";
  state.trumpDeadlineAt = 21000;
  assert.equal(pauseTurnClockForDisconnectedPlayer(state,2,11000),true);
  assert.equal(state.pausedTrumpRemainingMs,10000);
  assert.equal(state.trumpDeadlineAt,undefined);
  assert.equal(resumeTurnClockForReconnectedPlayer(state,2,50000),true);
  assert.equal(state.trumpDeadlineAt,60000);
  assert.equal(state.pausedTrumpRemainingMs,undefined);
});
