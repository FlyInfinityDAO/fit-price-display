const test=require("node:test");
const assert=require("node:assert/strict");
const H=require("../engine/hokm-engine.js");
test("deck contains 52 unique cards",()=>{const d=H.makeDeck();assert.equal(d.length,52);assert.equal(new Set(d.map(c=>c.id)).size,52)});
test("solo seats create one human and three CPUs across two teams",()=>{const seats=H.seatMap("solo",0);assert.deepEqual(seats.map(s=>s.kind),["human","cpu","cpu","cpu"]);assert.deepEqual(seats.map(s=>s.team),[0,1,0,1])});
test("first Ace in the draw selects Hakem",()=>{const rng=()=>0.37;const expected=H.selectHakemByFirstAce(rng);const g=H.createGame({rng});assert.equal(g.hakem,expected);assert.ok(g.hakem>=0&&g.hakem<4);assert.deepEqual(g.hands.map(h=>h.length),[5,5,5,5]);H.chooseTrump(g,"♠");assert.deepEqual(g.hands.map(h=>h.length),[13,13,13,13]);assert.equal(g.remaining.length,0)});
test("deal gives five cards each before Hokm suit and thirteen after",()=>{const g=H.createGame({hakem:0,rng:()=>0.37});assert.deepEqual(g.hands.map(h=>h.length),[5,5,5,5]);H.chooseTrump(g,"♠");assert.deepEqual(g.hands.map(h=>h.length),[13,13,13,13]);assert.equal(g.remaining.length,0)});
test("players must follow lead suit when possible",()=>{const g=H.createGame({rng:()=>0.42});H.chooseTrump(g,"♥");g.trick=[{player:0,card:{id:"2♠",suit:"♠",rank:"2"}}];g.currentPlayer=1;const legal=H.legalCards(g,1);if(g.hands[1].some(c=>c.suit==="♠"))assert.ok(legal.every(c=>c.suit==="♠"));else assert.equal(legal.length,g.hands[1].length)});
test("trump beats lead suit and higher trump wins",()=>{const trick=[{player:0,card:{suit:"♣",rank:"A"}},{player:1,card:{suit:"♣",rank:"K"}},{player:2,card:{suit:"♦",rank:"2"}},{player:3,card:{suit:"♦",rank:"A"}}];assert.equal(H.trickWinner(trick,"♦"),3)});
test("normal lead-suit winner is highest rank",()=>{const trick=[{player:0,card:{suit:"♣",rank:"10"}},{player:1,card:{suit:"♣",rank:"A"}},{player:2,card:{suit:"♥",rank:"A"}},{player:3,card:{suit:"♣",rank:"K"}}];assert.equal(H.trickWinner(trick,"♦"),1)});
test("CPU selects only a legal card",()=>{const g=H.createGame({rng:()=>0.23});H.chooseTrump(g,"♣");const c=H.chooseCpuCard(g,g.currentPlayer,"hard");assert.ok(H.legalCards(g,g.currentPlayer).some(x=>x.id===c.id))});
test("playCard rejects wrong turn",()=>{const g=H.createGame({rng:()=>0.51});H.chooseTrump(g,"♠");assert.throws(()=>H.playCard(g,1,g.hands[1][0].id),/turn/)});
test("four cards complete a trick and winner leads next",()=>{const g=H.createGame({rng:()=>0.71});H.chooseTrump(g,"♠");let result;for(let i=0;i<4;i++){const p=g.currentPlayer;const c=H.chooseCpuCard(g,p,"normal");result=H.playCard(g,p,c.id)}assert.equal(result.completed,true);assert.equal(g.tricksWon.reduce((a,b)=>a+b,0),1);assert.equal(g.currentPlayer,result.winner)});
test("1 FIT grants three rounds in solo; 10 FIT grants seven",()=>{const one=H.resolveAccessPolicy({mode:"solo",players:[{seat:0,kind:"human",balance:1},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});const ten=H.resolveAccessPolicy({mode:"solo",players:[{seat:0,kind:"human",balance:10},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});assert.equal(one.maxRounds,3);assert.equal(ten.maxRounds,7)});
test("online table is limited to three rounds if any wallet has only 1 FIT",()=>{const players=[1,10,10,10].map((balance,seat)=>({seat,kind:"human",balance}));assert.equal(H.resolveAccessPolicy({mode:"online",players}).maxRounds,3)});
test("online seven-round tier requires all four wallets to hold 10 FIT",()=>{const players=[10,12,10,25].map((balance,seat)=>({seat,kind:"human",balance}));assert.equal(H.resolveAccessPolicy({mode:"online",players}).maxRounds,7);players[2].balance=9.99;assert.equal(H.resolveAccessPolicy({mode:"online",players}).maxRounds,3)});
test("wallet below 1 FIT is denied and online requires four wallets",()=>{assert.equal(H.resolveAccessPolicy({mode:"solo",players:[{seat:0,kind:"human",balance:.99}]}).allowed,false);assert.equal(H.resolveAccessPolicy({mode:"online",players:[{seat:0,kind:"human",balance:10}]}).allowed,false)});
test("three-round match finishes exactly after round three",()=>{const m=H.createMatch({mode:"solo",players:[{seat:0,kind:"human",balance:1},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});assert.equal(m.maxRounds,3);for(let i=0;i<3;i++){const g=H.startRound(m,{hakem:0});g.finished=true;H.finishRound(m,g,i%2)}assert.equal(m.finished,true);assert.equal(m.roundsPlayed,3);assert.deepEqual(m.hakemCounts,[3,0]);assert.throws(()=>H.startRound(m),/limit/)});
test("seven-round match finishes exactly after round seven",()=>{const m=H.createMatch({mode:"online",players:[10,10,11,14].map((balance,seat)=>({seat,kind:"human",balance}))});for(let i=0;i<7;i++){const g=H.startRound(m,{hakem:0});g.finished=true;H.finishRound(m,g,i%2)}assert.equal(m.finished,true);assert.equal(m.roundsPlayed,7);assert.deepEqual(m.hakemCounts,[7,0])});
test("easy, normal and hard CPU levels are accepted",()=>{for(const difficulty of ["easy","normal","hard"])assert.equal(H.createMatch({mode:"solo",difficulty,players:[{seat:0,kind:"human",balance:10},{kind:"cpu"},{kind:"cpu"},{kind:"cpu"}]}).difficulty,difficulty)});

test("turn clock grants exactly 30 seconds and automatically plays a legal card after expiry",()=>{
 const g=H.createGame({hakem:0,rng:()=>0.31});H.chooseTrump(g,"♠");const clock=H.startTurnClock(g,1000);
 assert.equal(clock.deadlineAt,31000);assert.throws(()=>H.resolveTurnTimeout(g,{now:30999}),/not expired/);
 const result=H.resolveTurnTimeout(g,{now:31000,difficulty:"hard",rng:()=>0});
 assert.equal(result.automatic,true);assert.equal(result.automaticPlayer,0);assert.ok(!g.hands[0].some(c=>c.id===result.automaticCardId));
 assert.equal(g.turnDeadlineAt,61000);
});
test("a timely human card resets the 30-second turn clock",()=>{
 const g=H.createGame({hakem:0,rng:()=>0.28});H.chooseTrump(g,"♥");H.startTurnClock(g,5000);
 const card=H.legalCards(g,0)[0],result=H.playCardWithClock(g,0,card.id,9000);
 assert.equal(result.automatic,false);assert.equal(g.turnStartedAt,9000);assert.equal(g.turnDeadlineAt,39000);
});
test("disconnect preserves the human seat for 60 seconds and permits timely reconnection",()=>{
 const m={players:[0,1,2,3].map(seat=>({seat,kind:"human",connectionStatus:"connected"}))};
 const d=H.markPlayerDisconnected(m,2,10000);assert.equal(d.deadlineAt,10000+H.RECONNECT_GRACE_MS);
 assert.deepEqual(H.expireDisconnectedPlayers(m,d.deadlineAt-1),[]);
 assert.deepEqual(H.reconnectPlayer(m,2,d.deadlineAt-1),{reconnected:true,seat:2,kind:"human"});
 assert.equal(m.players[2].kind,"human");assert.equal(m.players[2].connectionStatus,"connected");
});
test("disconnected player is replaced by CPU after 60 seconds and cannot reclaim the seat",()=>{
 const m={players:[0,1,2,3].map(seat=>({seat,kind:"human",connectionStatus:"connected"}))};
 H.markPlayerDisconnected(m,1,20000);assert.deepEqual(H.expireDisconnectedPlayers(m,20000+H.RECONNECT_GRACE_MS-1),[]);assert.deepEqual(H.expireDisconnectedPlayers(m,20000+H.RECONNECT_GRACE_MS),[1]);
 assert.equal(m.players[1].kind,"cpu");assert.equal(m.players[1].connectionStatus,"replaced");
 assert.deepEqual(H.reconnectPlayer(m,1,80001),{reconnected:false,reason:"seat-unavailable"});
});
test("disconnect grace period uses inclusive 60-second deadline",()=>{
 const m={players:[{seat:0,kind:"human",connectionStatus:"connected"}]};
 H.markPlayerDisconnected(m,0,0);assert.deepEqual(H.expireDisconnectedPlayers(m,H.RECONNECT_GRACE_MS-1),[]);
 assert.deepEqual(H.expireDisconnectedPlayers(m,H.RECONNECT_GRACE_MS),[0]);
});

test("solo CPU match completes three real rounds using legal card plays",()=>{
 const match=H.createMatch({mode:"solo",difficulty:"normal",players:[{seat:0,kind:"human",balance:1},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});
 for(let round=0;round<3;round++){
  const g=H.startRound(match,{humanSeat:0,hakem:0,rng:()=>0.31+round*0.07});
  H.chooseTrump(g,H.SUITS[round%H.SUITS.length]);
  let moves=0;
  while(!g.finished&&moves<52){
   const player=g.currentPlayer;
   const card=H.chooseCpuCard(g,player,"normal");
   H.playCard(g,player,card.id);
   moves++;
  }
  assert.equal(g.finished,true,"round should finish within 52 card plays");
  assert.ok(moves<=52);
  H.finishRound(match,g,g.teamTricks[0]>g.teamTricks[1]?0:1);
 }
 assert.equal(match.finished,true);
 assert.equal(match.roundsPlayed,3);
 assert.equal(match.matchPoints[0]+match.matchPoints[1],3);
});

test("match ends when a team has been Hakem the required number of times, independent of hand wins",()=>{const m=H.createMatch({mode:"solo",players:[{seat:0,kind:"human",balance:1},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});assert.deepEqual(m.hakemCounts,[0,0],"initial Ace selection does not count as a Hakem assignment");for(let i=0;i<2;i++){const g=H.startRound(m,{hakem:0});g.finished=true;H.finishRound(m,g,1)}assert.equal(m.finished,false);const last=H.startRound(m,{hakem:0});last.finished=true;const result=H.finishRound(m,last,1);assert.equal(result.matchFinished,true);assert.equal(result.matchWinner,0);assert.deepEqual(m.hakemCounts,[3,0]);assert.deepEqual(m.matchPoints,[0,3])});
test("Hokm turn order is counterclockwise: south, east, north, west",()=>{assert.deepEqual([0,H.nextSeat(0),H.nextSeat(H.nextSeat(0)),H.nextSeat(H.nextSeat(H.nextSeat(0)))],[0,3,2,1]);assert.equal(H.nextSeat(1),0)});
test("trick-card slots stay aligned with the physical south, west, north and east seats",()=>{assert.deepEqual([0,1,2,3].map(H.trickSlot),[0,1,2,3])});
test("each card advances the turn counterclockwise",()=>{const g=H.createGame({hakem:0,rng:()=>0.37});H.chooseTrump(g,"♠");const order=[];for(let i=0;i<4;i++){const player=g.currentPlayer;order.push(player);const card=H.legalCards(g,player)[0];H.playCard(g,player,card.id)}assert.deepEqual(order,[0,3,2,1])});
