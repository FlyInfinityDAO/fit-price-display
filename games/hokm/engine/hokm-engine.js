(function(root){
"use strict";
const SUITS=["♠","♥","♦","♣"],RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"],TEAMS=[[0,2],[1,3]];
const rankValue=r=>RANKS.indexOf(r);
function nextSeat(seat){return (seat+3)%4}
function trickSlot(seat){return seat;}
function makeDeck(){return SUITS.flatMap(s=>RANKS.map(r=>({suit:s,rank:r,id:r+s})))}
function shuffle(deck,rng=Math.random){const a=[...deck];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function tierForBalance(balance){const n=Number(balance);if(!Number.isFinite(n)||n<1)return 0;return n>=10?2:1}
function resolveAccessPolicy({mode="solo",players=[],allowCpuSeats=false}={}){
 const humans=players.filter(p=>p.kind!=="cpu");
 const expected=mode==="online"?4:1;
 const validCount=allowCpuSeats&&mode==="online"?humans.length>=1&&humans.length<=4:humans.length===expected;
 if(!validCount)return {allowed:false,reason:"player-count",maxRounds:0,tier:0};
 const tiers=humans.map(p=>tierForBalance(p.balance));
 if(tiers.some(t=>t===0))return {allowed:false,reason:"insufficient-fit",maxRounds:0,tier:0};
 const tier=Math.min(...tiers),maxRounds=tier===2?7:3;
 return {allowed:true,reason:null,maxRounds,tier,limitingPlayers:humans.filter(p=>tierForBalance(p.balance)===tier).map(p=>p.seat)};
}
function createMatch({mode="solo",players=[],difficulty="normal",allowCpuSeats=false}={}){
 const policy=resolveAccessPolicy({mode,players,allowCpuSeats});
 if(!policy.allowed)throw new Error(policy.reason==="player-count"?"Invalid human player count":"Every human player needs at least 1 FIT");
 if(!["easy","normal","hard","veryhard"].includes(difficulty))throw new Error("Invalid CPU difficulty");
 return {mode,players:players.map(p=>({...p})),difficulty,accessTier:policy.tier,maxRounds:policy.maxRounds,targetWins:Math.ceil(policy.maxRounds/2),roundsPlayed:0,matchPoints:[0,0],hakemCounts:[0,0],finished:false,round:null};
}
function hakemFromDealtDeck(deck){
 for(let dealIndex=0;dealIndex<deck.length;dealIndex++)if(deck[deck.length-1-dealIndex].rank==="A")return dealIndex%4;
 return 0;
}
function selectHakemByFirstAce(rng=Math.random){return hakemFromDealtDeck(shuffle(makeDeck(),rng))}
function createGame({mode="solo",humanSeat=0,hakem,rng=Math.random}={}){
 const deck=shuffle(makeDeck(),rng),hands=[[],[],[],[]];
 const selectedHakem=Number.isInteger(hakem)&&hakem>=0&&hakem<4?hakem:hakemFromDealtDeck(deck);
 for(let n=0;n<5;n++)for(let p=0;p<4;p++)hands[p].push(deck.pop());
 return {mode,humanSeat,hakem:selectedHakem,hands,remaining:deck,phase:"choose-trump",trump:null,leader:selectedHakem,currentPlayer:selectedHakem,trick:[],tricksWon:[0,0,0,0],playedCards:[],teamTricks:[0,0],teamPoints:[0,0],round:1,finished:false};
}
function startRound(match,{humanSeat=0,hakem,rng=Math.random}={}){
 if(match.finished)throw new Error("Match has already finished");
 match.round=createGame({mode:match.mode,humanSeat,hakem,rng});
 match.roundNo=match.roundsPlayed+1;
 return match.round;
}
function chooseTrump(game,suit){
 if(game.phase!=="choose-trump"||!SUITS.includes(suit))throw new Error("Invalid trump selection");
 game.trump=suit;for(let n=0;n<8;n++)for(let p=0;p<4;p++)game.hands[p].push(game.remaining.pop());
 game.remaining=[];game.phase="playing";game.currentPlayer=game.hakem;return game;
}
function legalCards(game,player=game.currentPlayer){
 const hand=game.hands[player];if(!hand||!hand.length)return [];
 if(!game.trick.length)return [...hand];
 const lead=game.trick[0].card.suit,follow=hand.filter(c=>c.suit===lead);
 return follow.length?follow:[...hand];
}
function cardStrength(card,lead,trump){return card.suit===trump?200+rankValue(card.rank):card.suit===lead?100+rankValue(card.rank):rankValue(card.rank)}
function trickWinner(trick,trump){
 if(!Array.isArray(trick)||trick.length!==4)throw new Error("A trick needs four cards");
 const lead=trick[0].card.suit;
 return trick.reduce((best,entry)=>cardStrength(entry.card,lead,trump)>cardStrength(best.card,lead,trump)?entry:best).player;
}
function finishRound(match,game,winningTeam){
 if(match.round!==game||!game.finished)throw new Error("Round is not complete or does not belong to this match");
 if(winningTeam!==0&&winningTeam!==1)throw new Error("Invalid round winner");
 match.roundsPlayed++;match.matchPoints[winningTeam]++;
 match.hakemCounts ||= [0,0];
 const hakemTeam=game.hakem%2;
 match.hakemCounts[hakemTeam]++;
 // maxRounds is the total best-of series length (3 or 7); Hakem counts are statistics only.
 const targetWins=match.targetWins||Math.ceil(match.maxRounds/2);
 let matchWinner=match.matchPoints[winningTeam]>=targetWins?winningTeam:null;
 if(matchWinner===null&&match.roundsPlayed>=match.maxRounds){
  matchWinner=match.matchPoints[0]===match.matchPoints[1]?null:(match.matchPoints[0]>match.matchPoints[1]?0:1);
 }
 if(matchWinner!==null)match.finished=true;
 return {roundsPlayed:match.roundsPlayed,maxRounds:match.maxRounds,targetWins,matchPoints:[...match.matchPoints],hakemCounts:[...match.hakemCounts],matchWinner,matchFinished:match.finished};
}
function playCard(game,player,cardId){
 if(game.phase!=="playing"||game.finished)throw new Error("Game is not accepting cards");
 if(player!==game.currentPlayer)throw new Error("Not this player's turn");
 const card=game.hands[player].find(c=>c.id===cardId);if(!card)throw new Error("Card not in hand");
 if(!legalCards(game,player).some(c=>c.id===cardId))throw new Error("Must follow the lead suit when possible");
 game.hands[player]=game.hands[player].filter(c=>c.id!==cardId);game.playedCards ||= [];game.playedCards.push({...card,player});game.trick.push({player,card});
 if(game.trick.length<4){game.currentPlayer=nextSeat(player);return {game,completed:false}}
 const winner=trickWinner(game.trick,game.trump),team=winner%2===0?0:1;
 game.tricksWon[winner]++;game.teamTricks[team]++;game.leader=winner;game.currentPlayer=winner;
 const completedTrick=game.trick.map(x=>({...x}));game.trick=[];
 if(game.teamTricks[team]>=7){game.finished=true;game.phase="finished";game.teamPoints[team]+=game.teamTricks[team]===13?2:1;return {game,completed:true,winner,trick:completedTrick,roundWinner:team}}
 if(game.teamTricks[0]+game.teamTricks[1]===13){game.finished=true;game.phase="finished";const winningTeam=game.teamTricks[0]>game.teamTricks[1]?0:1;game.teamPoints[winningTeam]++;return {game,completed:true,winner,trick:completedTrick,roundWinner:winningTeam}}
 return {game,completed:true,winner,trick:completedTrick};
}
function chooseCpuTrump(game,player=game.hakem,difficulty="normal",rng=Math.random){
 const hand=game.hands[player]||[];
 if(difficulty==="easy")return SUITS[Math.min(SUITS.length-1,Math.floor(rng()*SUITS.length))];
 const scoreSuit=suit=>{
  const cards=hand.filter(c=>c.suit===suit),ranks=cards.map(c=>rankValue(c.rank)).sort((a,b)=>b-a);
  if(difficulty!=="veryhard")return cards.reduce((v,c)=>v+(c.rank==="A"?5:c.rank==="K"?3:c.rank==="Q"?2:c.rank==="J"?1:0),0)+cards.length*3;
  const honors=cards.reduce((v,c)=>v+(c.rank==="A"?8:c.rank==="K"?5:c.rank==="Q"?3:c.rank==="J"?1:0),0);
  const lengthBonus=cards.length>=4?8:cards.length===3?4:cards.length===2?1:0;
  const rankSet=new Set(ranks);let topRun=0;for(let value=12;rankSet.has(value);value--)topRun++;
  const combo=(cards.some(c=>c.rank==="A")&&cards.some(c=>c.rank==="K")?4:0)+(cards.some(c=>c.rank==="Q")&&cards.some(c=>c.rank==="J")?2:0);
  return cards.length*4+honors+lengthBonus+topRun*2+combo;
 };
 return SUITS.map((suit,index)=>({suit,index,score:scoreSuit(suit)})).sort((a,b)=>b.score-a.score||a.index-b.index)[0].suit;
}

function chooseCpuCard(game,player=game.currentPlayer,difficulty="normal",rng=Math.random){
 const legal=legalCards(game,player);if(!legal.length)throw new Error("CPU has no legal card");
 const lead=game.trick[0]?.card.suit;
 if(difficulty==="easy")return legal[Math.min(legal.length-1,Math.floor(rng()*legal.length))];
 const following=lead?legal.filter(c=>c.suit===lead):legal;
 const pool=following.length?following:legal;
 const weakest=(cards)=>cards.slice().sort((a,b)=>rankValue(a.rank)-rankValue(b.rank))[0];
 if(difficulty==="veryhard")return chooseVeryHardCard(game,player,legal,pool,weakest);
 if(difficulty!=="hard")return weakest(pool);
 // Lead from a long non-trump suit and establish control with a high card.
 if(!game.trick.length){
  const nonTrump=legal.filter(c=>c.suit!==game.trump),candidates=nonTrump.length?nonTrump:legal;
  const suitCounts=new Map();for(const card of candidates)suitCounts.set(card.suit,(suitCounts.get(card.suit)||0)+1);
  return candidates.slice().sort((a,b)=>{
   const countDiff=(suitCounts.get(b.suit)||0)-(suitCounts.get(a.suit)||0);
   return countDiff||rankValue(b.rank)-rankValue(a.rank);
  })[0];
 }
 const best=game.trick.reduce((a,b)=>cardStrength(b.card,lead,game.trump)>cardStrength(a.card,lead,game.trump)?b:a);
 const partnerCurrentlyWinning=best.player%2===player%2;
 if(partnerCurrentlyWinning)return weakest(pool);
 const bestStrength=cardStrength(best.card,lead,game.trump);
 const winning=pool.filter(card=>cardStrength(card,lead,game.trump)>bestStrength)
  .sort((a,b)=>cardStrength(a,lead,game.trump)-cardStrength(b,lead,game.trump));
 if(game.trick.length===3)return winning[0]||weakest(pool);
 // Before the last seat, overtake an opponent only with a cheaper card in the led suit.
 // Keep trump for later unless this is the final card of the trick.
 if(lead){
  const safeWinners=winning.filter(card=>card.suit===lead);
  if(safeWinners.length)return safeWinners[0];
 }
 return weakest(pool);
}
function chooseVeryHardCard(game,player,legal,pool,weakest){
 const played=new Set((game.playedCards||[]).map(c=>c.id));
 const own=new Set((game.hands[player]||[]).map(c=>c.id));
 const unseenHigher=(card,suit)=>RANKS.slice(rankValue(card.rank)+1).filter(rank=>{const id=rank+suit;return !played.has(id)&&!own.has(id)}).length;
 const unseenSuit=suit=>RANKS.filter(rank=>{const id=rank+suit;return !played.has(id)&&!own.has(id)}).length;
 const lead=game.trick[0]?.card.suit;
 if(!game.trick.length){
  const candidates=legal.filter(c=>c.suit!==game.trump),source=candidates.length?candidates:legal;
  const counts=new Map();for(const c of source)counts.set(c.suit,(counts.get(c.suit)||0)+1);
  return source.slice().sort((a,b)=>{
   const am=unseenHigher(a,a.suit)===0?1:0,bm=unseenHigher(b,b.suit)===0?1:0;
   return ((counts.get(b.suit)||0)*8+bm*14+rankValue(b.rank))-((counts.get(a.suit)||0)*8+am*14+rankValue(a.rank));
  })[0];
 }
 const best=game.trick.reduce((a,b)=>cardStrength(b.card,lead,game.trump)>cardStrength(a.card,lead,game.trump)?b:a);
 const strength=cardStrength(best.card,lead,game.trump),finalSeat=game.trick.length===3,partnerWinning=best.player%2===player%2;
 const ranked=pool.filter(c=>cardStrength(c,lead,game.trump)>strength).map(card=>{
  const higherTrump=card.suit===game.trump?unseenHigher(card,game.trump):unseenSuit(game.trump);
  const higherLead=card.suit===game.trump?0:unseenHigher(card,lead);
  const risk=higherTrump+higherLead,cost=rankValue(card)+(card.suit===game.trump?15:0);
  return {card,risk,score:cost+risk*(finalSeat?0:7)};
 }).sort((a,b)=>a.score-b.score);
 if(partnerWinning){
  let futureOpponent=false,seat=nextSeat(player);
  for(let i=0;i<4-game.trick.length-1;i++){if(seat%2!==player%2)futureOpponent=true;seat=nextSeat(seat)}
  const partnerRisk=best.card.suit===game.trump?unseenHigher(best.card,game.trump):unseenHigher(best.card,lead)+unseenSuit(game.trump);
  if(!futureOpponent||partnerRisk===0)return weakest(pool);
  const safeProtection=ranked.find(x=>x.risk===0);
  return safeProtection?safeProtection.card:weakest(pool);
 }
 if(!ranked.length)return weakest(pool);
 if(finalSeat)return ranked[0].card;
 const safeLead=ranked.find(x=>x.card.suit===lead&&x.risk===0);if(safeLead)return safeLead.card;
 const safeTrump=ranked.find(x=>x.card.suit===game.trump&&x.risk===0);if(safeTrump)return safeTrump.card;
 return weakest(pool);
}
function seatMap(mode="solo",humanSeat=0){
 if(mode!=="solo")return [0,1,2,3].map(seat=>({seat,kind:"human",team:seat%2}));
 return [0,1,2,3].map(seat=>({seat,kind:seat===humanSeat?"human":"cpu",team:seat%2}));
}

const TURN_TIMEOUT_MS=30000,RECONNECT_GRACE_MS=60000;
function startTurnClock(game,now=Date.now()){
 if(game.phase!=="playing"||game.finished)throw new Error("Game is not accepting turns");
 game.turnStartedAt=now;game.turnDeadlineAt=now+TURN_TIMEOUT_MS;
 return {startedAt:game.turnStartedAt,deadlineAt:game.turnDeadlineAt,timeoutMs:TURN_TIMEOUT_MS};
}
function playCardWithClock(game,player,cardId,now=Date.now(),difficulty="normal"){
 if(!Number.isFinite(game.turnDeadlineAt))startTurnClock(game,now);
 if(now>=game.turnDeadlineAt)return resolveTurnTimeout(game,{now,difficulty});
 const result=playCard(game,player,cardId);
 if(!game.finished)startTurnClock(game,now);
 else {delete game.turnStartedAt;delete game.turnDeadlineAt}
 return {...result,automatic:false};
}
function resolveTurnTimeout(game,{now=Date.now(),difficulty="normal",rng=Math.random}={}){
 if(game.phase!=="playing"||game.finished)throw new Error("Game is not accepting turns");
 if(!Number.isFinite(game.turnDeadlineAt))throw new Error("Turn clock has not started");
 if(now<game.turnDeadlineAt)throw new Error("Turn deadline has not expired");
 const player=game.currentPlayer,card=chooseCpuCard(game,player,difficulty,rng);
 const result=playCard(game,player,card.id);
 if(!game.finished)startTurnClock(game,now);
 else {delete game.turnStartedAt;delete game.turnDeadlineAt}
 return {...result,automatic:true,automaticPlayer:player,automaticCardId:card.id};
}
function markPlayerDisconnected(match,seat,now=Date.now()){
 const player=match.players.find(p=>p.seat===seat&&p.kind!=="cpu");
 if(!player)throw new Error("Human player seat not found");
 if(player.connectionStatus==="replaced")return {status:"replaced",seat};
 if(player.connectionStatus==="disconnected"&&Number.isFinite(player.reconnectDeadlineAt))return {status:"disconnected",seat,deadlineAt:player.reconnectDeadlineAt,graceMs:RECONNECT_GRACE_MS};
 player.connectionStatus="disconnected";player.disconnectedAt=now;player.reconnectDeadlineAt=now+RECONNECT_GRACE_MS;
 return {status:"disconnected",seat,deadlineAt:player.reconnectDeadlineAt,graceMs:RECONNECT_GRACE_MS};
}
function reconnectPlayer(match,seat,now=Date.now()){
 const player=match.players.find(p=>p.seat===seat);
 if(!player||player.connectionStatus==="replaced"||player.kind==="cpu")return {reconnected:false,reason:"seat-unavailable"};
 if(player.connectionStatus!=="disconnected")return {reconnected:false,reason:"not-disconnected"};
 if(now>=player.reconnectDeadlineAt)return {reconnected:false,reason:"grace-expired"};
 player.connectionStatus="connected";delete player.disconnectedAt;delete player.reconnectDeadlineAt;
 return {reconnected:true,seat,kind:"human"};
}
function expireDisconnectedPlayers(match,now=Date.now()){
 const replaced=[];
 for(const player of match.players){
  if(player.kind==="cpu"||player.connectionStatus!=="disconnected"||now<player.reconnectDeadlineAt)continue;
  player.kind="cpu";player.connectionStatus="replaced";player.replacedAt=now;
  delete player.disconnectedAt;delete player.reconnectDeadlineAt;replaced.push(player.seat);
 }
 return replaced;
}

const api={SUITS,RANKS,TEAMS,nextSeat,trickSlot,TURN_TIMEOUT_MS,RECONNECT_GRACE_MS,makeDeck,shuffle,selectHakemByFirstAce,tierForBalance,resolveAccessPolicy,createMatch,startRound,createGame,chooseTrump,chooseCpuTrump,legalCards,cardStrength,trickWinner,finishRound,playCard,playCardWithClock,startTurnClock,resolveTurnTimeout,markPlayerDisconnected,reconnectPlayer,expireDisconnectedPlayers,chooseCpuCard,seatMap};
if(typeof module!=="undefined"&&module.exports)module.exports=api;root.HokmEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this);
