(function(root){
"use strict";
const SUITS=["♠","♥","♦","♣"],RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"],TEAMS=[[0,2],[1,3]];
const rankValue=r=>RANKS.indexOf(r);
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
 if(!["easy","normal","hard"].includes(difficulty))throw new Error("Invalid CPU difficulty");
 return {mode,players:players.map(p=>({...p})),difficulty,accessTier:policy.tier,maxRounds:policy.maxRounds,roundsPlayed:0,matchPoints:[0,0],finished:false,round:null};
}
function createGame({mode="solo",humanSeat=0,hakem=0,rng=Math.random}={}){
 const deck=shuffle(makeDeck(),rng),hands=[[],[],[],[]];
 for(let n=0;n<5;n++)for(let p=0;p<4;p++)hands[p].push(deck.pop());
 return {mode,humanSeat,hakem,hands,remaining:deck,phase:"choose-trump",trump:null,leader:hakem,currentPlayer:hakem,trick:[],tricksWon:[0,0,0,0],teamTricks:[0,0],teamPoints:[0,0],round:1,finished:false};
}
function startRound(match,{humanSeat=0,hakem=0,rng=Math.random}={}){
 if(match.finished||match.roundsPlayed>=match.maxRounds)throw new Error("Match has reached its round limit");
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
 match.roundsPlayed++;match.matchPoints[winningTeam]++;
 if(match.roundsPlayed>=match.maxRounds)match.finished=true;
 return {roundsPlayed:match.roundsPlayed,maxRounds:match.maxRounds,matchPoints:[...match.matchPoints],matchWinner:match.finished?(match.matchPoints[0]===match.matchPoints[1]?-1:match.matchPoints[0]>match.matchPoints[1]?0:1):null,matchFinished:match.finished};
}
function playCard(game,player,cardId){
 if(game.phase!=="playing"||game.finished)throw new Error("Game is not accepting cards");
 if(player!==game.currentPlayer)throw new Error("Not this player's turn");
 const card=game.hands[player].find(c=>c.id===cardId);if(!card)throw new Error("Card not in hand");
 if(!legalCards(game,player).some(c=>c.id===cardId))throw new Error("Must follow the lead suit when possible");
 game.hands[player]=game.hands[player].filter(c=>c.id!==cardId);game.trick.push({player,card});
 if(game.trick.length<4){game.currentPlayer=(player+1)%4;return {game,completed:false}}
 const winner=trickWinner(game.trick,game.trump),team=winner%2===0?0:1;
 game.tricksWon[winner]++;game.teamTricks[team]++;game.leader=winner;game.currentPlayer=winner;
 const completedTrick=game.trick.map(x=>({...x}));game.trick=[];
 if(game.teamTricks[team]>=7){game.finished=true;game.phase="finished";game.teamPoints[team]+=game.teamTricks[team]===13?2:1;return {game,completed:true,winner,trick:completedTrick,roundWinner:team}}
 if(game.teamTricks[0]+game.teamTricks[1]===13){game.finished=true;game.phase="finished";const winningTeam=game.teamTricks[0]>game.teamTricks[1]?0:1;game.teamPoints[winningTeam]++;return {game,completed:true,winner,trick:completedTrick,roundWinner:winningTeam}}
 return {game,completed:true,winner,trick:completedTrick};
}
function chooseCpuCard(game,player=game.currentPlayer,difficulty="normal",rng=Math.random){
 const legal=legalCards(game,player);if(!legal.length)throw new Error("CPU has no legal card");
 const lead=game.trick[0]?.card.suit;
 if(difficulty==="easy")return legal[Math.floor(rng()*legal.length)];
 const following=lead?legal.filter(c=>c.suit===lead):legal;
 const pool=following.length?following:legal;
 if(difficulty==="normal")return pool.slice().sort((a,b)=>rankValue(a.rank)-rankValue(b.rank))[0];
 const currentWinner=game.trick.length?trickWinner(game.trick,game.trump):null;
 const winning=pool.filter(c=>{
  const hypothetical=[...game.trick,{player,card:c}];
  if(hypothetical.length<4)return false;
  return trickWinner(hypothetical,game.trump)%2===player%2;
 });
 if(winning.length)return winning.slice().sort((a,b)=>cardStrength(a,lead||a.suit,game.trump)-cardStrength(b,lead||b.suit,game.trump))[0];
 return pool.slice().sort((a,b)=>rankValue(a.rank)-rankValue(b.rank))[0];
}
function seatMap(mode="solo",humanSeat=0){
 if(mode!=="solo")return [0,1,2,3].map(seat=>({seat,kind:"human",team:seat%2}));
 return [0,1,2,3].map(seat=>({seat,kind:seat===humanSeat?"human":"cpu",team:seat%2}));
}

const TURN_TIMEOUT_MS=15000,RECONNECT_GRACE_MS=30000;
function startTurnClock(game,now=Date.now()){
 if(game.phase!=="playing"||game.finished)throw new Error("Game is not accepting turns");
 game.turnStartedAt=now;game.turnDeadlineAt=now+TURN_TIMEOUT_MS;
 return {startedAt:game.turnStartedAt,deadlineAt:game.turnDeadlineAt,timeoutMs:TURN_TIMEOUT_MS};
}
function playCardWithClock(game,player,cardId,now=Date.now()){
 if(!Number.isFinite(game.turnDeadlineAt))startTurnClock(game,now);
 if(now>=game.turnDeadlineAt)return resolveTurnTimeout(game,{now});
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

const api={SUITS,RANKS,TEAMS,TURN_TIMEOUT_MS,RECONNECT_GRACE_MS,makeDeck,shuffle,tierForBalance,resolveAccessPolicy,createMatch,startRound,createGame,chooseTrump,legalCards,cardStrength,trickWinner,finishRound,playCard,playCardWithClock,startTurnClock,resolveTurnTimeout,markPlayerDisconnected,reconnectPlayer,expireDisconnectedPlayers,chooseCpuCard,seatMap};
if(typeof module!=="undefined"&&module.exports)module.exports=api;root.HokmEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this);
