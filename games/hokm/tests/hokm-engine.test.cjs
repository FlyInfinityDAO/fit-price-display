const test=require("node:test");
const assert=require("node:assert/strict");
const H=require("../engine/hokm-engine.js");
test("deck contains 52 unique cards",()=>{const d=H.makeDeck();assert.equal(d.length,52);assert.equal(new Set(d.map(c=>c.id)).size,52)});
test("solo seats create one human and three CPUs across two teams",()=>{const seats=H.seatMap("solo",0);assert.deepEqual(seats.map(s=>s.kind),["human","cpu","cpu","cpu"]);assert.deepEqual(seats.map(s=>s.team),[0,1,0,1])});
test("first Ace in the actual deal selects the Hakem",()=>{const rng=()=>0.37;const g=H.createGame({rng});const dealOrder=[];for(let n=0;n<5;n++)for(let seat=0;seat<4;seat++)dealOrder.push(g.hands[seat][n]);dealOrder.push(...g.remaining.slice().reverse());const firstAceIndex=dealOrder.findIndex(card=>card.rank==="A");assert.ok(firstAceIndex>=0);assert.equal(g.hakem,firstAceIndex%4);assert.deepEqual(g.hands.map(h=>h.length),[5,5,5,5]);H.chooseTrump(g,"♠");assert.deepEqual(g.hands.map(h=>h.length),[13,13,13,13]);assert.equal(g.remaining.length,0)});
test("deal gives five cards each before Hokm suit and thirteen after",()=>{const g=H.createGame({hakem:0,rng:()=>0.37});assert.deepEqual(g.hands.map(h=>h.length),[5,5,5,5]);H.chooseTrump(g,"♠");assert.deepEqual(g.hands.map(h=>h.length),[13,13,13,13]);assert.equal(g.remaining.length,0)});
test("players must follow lead suit when possible",()=>{const g=H.createGame({rng:()=>0.42});H.chooseTrump(g,"♥");g.trick=[{player:0,card:{id:"2♠",suit:"♠",rank:"2"}}];g.currentPlayer=1;const legal=H.legalCards(g,1);if(g.hands[1].some(c=>c.suit==="♠"))assert.ok(legal.every(c=>c.suit==="♠"));else assert.equal(legal.length,g.hands[1].length)});
test("trump beats lead suit and higher trump wins",()=>{const trick=[{player:0,card:{suit:"♣",rank:"A"}},{player:1,card:{suit:"♣",rank:"K"}},{player:2,card:{suit:"♦",rank:"2"}},{player:3,card:{suit:"♦",rank:"A"}}];assert.equal(H.trickWinner(trick,"♦"),3)});
test("normal lead-suit winner is highest rank",()=>{const trick=[{player:0,card:{suit:"♣",rank:"10"}},{player:1,card:{suit:"♣",rank:"A"}},{player:2,card:{suit:"♥",rank:"A"}},{player:3,card:{suit:"♣",rank:"K"}}];assert.equal(H.trickWinner(trick,"♦"),1)});
test("CPU selects only a legal card at every difficulty",()=>{const g=H.createGame({rng:()=>0.23});H.chooseTrump(g,"♣");for(const difficulty of ["easy","normal","hard","veryhard"]){const c=H.chooseCpuCard(g,g.currentPlayer,difficulty,()=>0.5);assert.ok(H.legalCards(g,g.currentPlayer).some(x=>x.id===c.id))}});
test("hard CPU leads from a non-trump suit when possible and chooses its highest card in that suit",()=>{const g={hands:[[{id:"A♠",suit:"♠",rank:"A"},{id:"K♠",suit:"♠",rank:"K"},{id:"2♥",suit:"♥",rank:"2"},{id:"A♦",suit:"♦",rank:"A"}],[],[],[]],trick:[],trump:"♥"};const card=H.chooseCpuCard(g,0,"hard");assert.equal(card.suit,"♠");assert.equal(card.rank,"A")});
test("hard CPU does not overtake a winning partner on the final card",()=>{const g={hands:[[],[],[],[{id:"2♠",suit:"♠",rank:"2"},{id:"A♠",suit:"♠",rank:"A"}]],trick:[{player:0,card:{id:"K♠",suit:"♠",rank:"K"}},{player:1,card:{id:"2♥",suit:"♥",rank:"2"}},{player:2,card:{id:"3♠",suit:"♠",rank:"3"}}],trump:"♥"};const card=H.chooseCpuCard(g,3,"hard");assert.equal(card.rank,"2")});
test("hard CPU takes the trick with the cheapest winning trump when opponents lead",()=>{const g={hands:[[],[],[],[{id:"2♥",suit:"♥",rank:"2"},{id:"A♥",suit:"♥",rank:"A"}]],trick:[{player:0,card:{id:"A♠",suit:"♠",rank:"A"}},{player:1,card:{id:"2♠",suit:"♠",rank:"2"}},{player:2,card:{id:"3♠",suit:"♠",rank:"3"}}],trump:"♥"};const card=H.chooseCpuCard(g,3,"hard");assert.equal(card.id,"2♥");assert.equal(H.trickWinner([...g.trick,{player:3,card}],g.trump),3)});

test("hard CPU overtakes a currently winning opponent with the cheapest lead-suit card before the final seat",()=>{
 const g={hands:[[],[{id:"Q♠",suit:"♠",rank:"Q"},{id:"A♠",suit:"♠",rank:"A"},{id:"2♥",suit:"♥",rank:"2"}],[],[]],trick:[{player:0,card:{id:"J♠",suit:"♠",rank:"J"}}],trump:"♥"};
 const card=H.chooseCpuCard(g,1,"hard");
 assert.equal(card.id,"Q♠");
});
test("hard CPU preserves trump before the final seat when only a trump can overtake",()=>{
 const g={hands:[[],[{id:"2♣",suit:"♣",rank:"2"},{id:"2♥",suit:"♥",rank:"2"},{id:"A♥",suit:"♥",rank:"A"}],[],[]],trick:[{player:0,card:{id:"A♠",suit:"♠",rank:"A"}}],trump:"♥"};
 const card=H.chooseCpuCard(g,1,"hard");
 assert.equal(card.id,"2♣");
});

test("Very Hard CPU overtakes a vulnerable partner with a safe trump to protect the trick",()=>{const g={hands:[[],[],[{id:"Q♥",suit:"♥",rank:"Q"},{id:"2♣",suit:"♣",rank:"2"}],[]],trick:[{player:0,card:{id:"10♠",suit:"♠",rank:"10"}},{player:3,card:{id:"2♠",suit:"♠",rank:"2"}}],trump:"♥",playedCards:[{id:"10♠",suit:"♠",rank:"10",player:0},{id:"2♠",suit:"♠",rank:"2",player:3},{id:"A♥",suit:"♥",rank:"A",player:1},{id:"K♥",suit:"♥",rank:"K",player:1}]};assert.equal(H.chooseCpuCard(g,2,"veryhard").id,"Q♥")});
test("Very Hard CPU chooses a long trump suit with strong top honors",()=>{const g={hakem:1,hands:[[],[{id:"A♠",suit:"♠",rank:"A"},{id:"K♠",suit:"♠",rank:"K"},{id:"2♠",suit:"♠",rank:"2"},{id:"A♥",suit:"♥",rank:"A"},{id:"2♦",suit:"♦",rank:"2"}],[],[]]};assert.equal(H.chooseCpuTrump(g,1,"veryhard"),"♠")});
test("Very Hard CPU is an accepted match difficulty",()=>{const m=H.createMatch({mode:"solo",difficulty:"veryhard",players:[{seat:0,kind:"human",balance:10},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});assert.equal(m.difficulty,"veryhard")});
test("played-card history records every played card",()=>{const g=H.createGame({hakem:0,rng:()=>0.43});H.chooseTrump(g,"♦");const c=H.legalCards(g,0)[0];H.playCard(g,0,c.id);assert.equal(g.playedCards.length,1);assert.equal(g.playedCards[0].id,c.id);assert.equal(g.playedCards[0].player,0)});
test("Very Hard CPU leads from a long non-trump suit",()=>{const g={hands:[[{id:"A♠",suit:"♠",rank:"A"},{id:"K♠",suit:"♠",rank:"K"},{id:"Q♠",suit:"♠",rank:"Q"},{id:"2♦",suit:"♦",rank:"2"}],[],[],[]],trick:[],trump:"♥",playedCards:[]};const c=H.chooseCpuCard(g,0,"veryhard");assert.equal(c.suit,"♠");assert.equal(c.rank,"A")});
test("Very Hard CPU uses played-card history when evaluating a suit",()=>{const g={hands:[[],[{id:"Q♥",suit:"♥",rank:"Q"},{id:"2♣",suit:"♣",rank:"2"}],[],[]],trick:[{player:0,card:{id:"A♠",suit:"♠",rank:"A"}}],trump:"♥",playedCards:[{id:"A♥",suit:"♥",rank:"A",player:2},{id:"K♥",suit:"♥",rank:"K",player:3},{id:"A♠",suit:"♠",rank:"A",player:0}]};const c=H.chooseCpuCard(g,1,"veryhard");assert.equal(c.id,"Q♥")});
test("playCard rejects wrong turn",()=>{const g=H.createGame({hakem:0,rng:()=>0.51});H.chooseTrump(g,"♠");assert.throws(()=>H.playCard(g,1,g.hands[1][0].id),/turn/)});
test("four cards complete a trick and winner leads next",()=>{const g=H.createGame({rng:()=>0.71});H.chooseTrump(g,"♠");let result;for(let i=0;i<4;i++){const p=g.currentPlayer;const c=H.chooseCpuCard(g,p,"normal");result=H.playCard(g,p,c.id)}assert.equal(result.completed,true);assert.equal(g.tricksWon.reduce((a,b)=>a+b,0),1);assert.equal(g.currentPlayer,result.winner)});
test("1 FIT grants three rounds in solo; 10 FIT grants seven",()=>{const one=H.resolveAccessPolicy({mode:"solo",players:[{seat:0,kind:"human",balance:1},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});const ten=H.resolveAccessPolicy({mode:"solo",players:[{seat:0,kind:"human",balance:10},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});assert.equal(one.maxRounds,3);assert.equal(ten.maxRounds,7)});
test("online table is limited to three rounds if any wallet has only 1 FIT",()=>{const players=[1,10,10,10].map((balance,seat)=>({seat,kind:"human",balance}));assert.equal(H.resolveAccessPolicy({mode:"online",players}).maxRounds,3)});
test("online seven-round tier requires all four wallets to hold 10 FIT",()=>{const players=[10,12,10,25].map((balance,seat)=>({seat,kind:"human",balance}));assert.equal(H.resolveAccessPolicy({mode:"online",players}).maxRounds,7);players[2].balance=9.99;assert.equal(H.resolveAccessPolicy({mode:"online",players}).maxRounds,3)});
test("wallet below 1 FIT is denied and online requires four wallets",()=>{assert.equal(H.resolveAccessPolicy({mode:"solo",players:[{seat:0,kind:"human",balance:.99}]}).allowed,false);assert.equal(H.resolveAccessPolicy({mode:"online",players:[{seat:0,kind:"human",balance:10}]}).allowed,false)});
test("Hakem target, not a fixed hand cap, ends a three-count match",()=>{const m=H.createMatch({mode:"solo",players:[{seat:0,kind:"human",balance:1},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});assert.equal(m.maxRounds,3);for(const hakem of [0,3,0]){const g=H.startRound(m,{hakem});g.finished=true;H.finishRound(m,g,1)}assert.equal(m.finished,false);assert.equal(m.roundsPlayed,3);const fourth=H.startRound(m,{hakem:3});fourth.finished=true;H.finishRound(m,fourth,0);assert.equal(m.finished,false);const fifth=H.startRound(m,{hakem:0});fifth.finished=true;const result=H.finishRound(m,fifth,1);assert.equal(result.matchFinished,true);assert.equal(result.matchWinner,0);assert.deepEqual(m.hakemCounts,[3,2]);assert.equal(m.roundsPlayed,5)});
test("seven-round match finishes exactly after round seven",()=>{const m=H.createMatch({mode:"online",players:[10,10,11,14].map((balance,seat)=>({seat,kind:"human",balance}))});for(let i=0;i<7;i++){const g=H.startRound(m,{hakem:0});g.finished=true;H.finishRound(m,g,i%2)}assert.equal(m.finished,true);assert.equal(m.roundsPlayed,7);assert.deepEqual(m.hakemCounts,[7,0])});
test("easy, normal, hard and Very Hard CPU levels are accepted",()=>{for(const difficulty of ["easy","normal","hard","veryhard"])assert.equal(H.createMatch({mode:"solo",difficulty,players:[{seat:0,kind:"human",balance:10},{kind:"cpu"},{kind:"cpu"},{kind:"cpu"}]}).difficulty,difficulty)});

test("turn clock grants exactly 30 seconds and automatically plays a legal card after expiry",()=>{
 const g=H.createGame({hakem:0,rng:()=>0.31});H.chooseTrump(g,"♠");const clock=H.startTurnClock(g,1000);
 assert.equal(clock.deadlineAt,31000);assert.throws(()=>H.resolveTurnTimeout(g,{now:30999}),/not expired/);
 const result=H.resolveTurnTimeout(g,{now:31000,difficulty:"hard",rng:()=>0});
 assert.equal(result.automatic,true);assert.equal(result.automaticPlayer,0);assert.ok(!g.hands[0].some(c=>c.id===result.automaticCardId));
 assert.equal(g.turnDeadlineAt,61000);
});
test("late card submission resolves timeout using the selected CPU difficulty",()=>{const g=H.createGame({hakem:0,rng:()=>0.31});g.phase="playing";g.trump="♥";g.hands[0]=[{id:"A♠",suit:"♠",rank:"A"},{id:"2♥",suit:"♥",rank:"2"}];g.turnDeadlineAt=100;const result=H.playCardWithClock(g,0,"A♠",100,"veryhard");assert.equal(result.automatic,true);assert.equal(result.automaticCardId,"A♠")});
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
test("all CPU difficulty levels complete full legal rounds without stalling",()=>{
 for(const difficulty of ["easy","normal","hard","veryhard"]){
  const match=H.createMatch({mode:"solo",difficulty,players:[{seat:0,kind:"human",balance:1},{seat:1,kind:"cpu"},{seat:2,kind:"cpu"},{seat:3,kind:"cpu"}]});
  for(let round=0;round<3;round++){
   const g=H.startRound(match,{humanSeat:0,hakem:0,rng:()=>0.29+round*0.09});
   const trump=H.chooseCpuTrump(g,g.hakem,difficulty,()=>0.41);
   assert.ok(H.SUITS.includes(trump),difficulty+" must choose a valid trump suit");
   H.chooseTrump(g,trump);
   let moves=0;
   while(!g.finished&&moves<52){
    const player=g.currentPlayer,legal=H.legalCards(g,player);
    const card=H.chooseCpuCard(g,player,difficulty,()=>0.37);
    assert.ok(legal.some(candidate=>candidate.id===card.id),difficulty+" must only select legal cards");
    H.playCard(g,player,card.id);
    moves++;
   }
   assert.equal(g.finished,true,difficulty+" round should finish within 52 card plays");
   assert.ok(moves>=28&&moves<=52,difficulty+" should finish after a valid number of card plays");
   const winner=g.teamTricks[0]>g.teamTricks[1]?0:1;
   H.finishRound(match,g,winner);
  }
  assert.equal(match.finished,true,difficulty+" should complete a three-Hakem match");
  assert.equal(match.roundsPlayed,3);
 }
});

test("Hokm turn order is counterclockwise: south, east, north, west",()=>{assert.deepEqual([0,H.nextSeat(0),H.nextSeat(H.nextSeat(0)),H.nextSeat(H.nextSeat(H.nextSeat(0)))],[0,3,2,1]);assert.equal(H.nextSeat(1),0)});
test("trick-card slots stay aligned with the physical south, west, north and east seats",()=>{assert.deepEqual([0,1,2,3].map(H.trickSlot),[0,1,2,3])});
test("each card advances the turn counterclockwise",()=>{const g=H.createGame({hakem:0,rng:()=>0.37});H.chooseTrump(g,"♠");const order=[];for(let i=0;i<4;i++){const player=g.currentPlayer;order.push(player);const card=H.legalCards(g,player)[0];H.playCard(g,player,card.id)}assert.deepEqual(order,[0,3,2,1])});

test("repeated disconnect events do not extend the original reconnect grace deadline",()=>{
 const match={players:[{seat:0,kind:"human",connectionStatus:"connected"}]};
 const first=H.markPlayerDisconnected(match,0,1000);
 const repeated=H.markPlayerDisconnected(match,0,20000);
 assert.equal(first.deadlineAt,1000+H.RECONNECT_GRACE_MS);
 assert.equal(repeated.deadlineAt,first.deadlineAt);
 assert.deepEqual(H.expireDisconnectedPlayers(match,first.deadlineAt),[0]);
 assert.deepEqual(H.expireDisconnectedPlayers(match,first.deadlineAt+1),[]);
});

test("reconnection is rejected exactly at the grace deadline before CPU replacement",()=>{
 const match={players:[{seat:0,kind:"human",connectionStatus:"connected"}]};
 const disconnected=H.markPlayerDisconnected(match,0,5000);
 assert.deepEqual(H.reconnectPlayer(match,0,disconnected.deadlineAt),{reconnected:false,reason:"grace-expired"});
 assert.deepEqual(H.expireDisconnectedPlayers(match,disconnected.deadlineAt),[0]);
 assert.equal(match.players[0].kind,"cpu");
});
