(function(root){
"use strict";
const SUITS=["♠","♥","♦","♣"],RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const TEAMS=[[0,2],[1,3]];
const rankValue=r=>RANKS.indexOf(r);
function makeDeck(){return SUITS.flatMap(s=>RANKS.map(r=>({suit:s,rank:r,id:r+s})))}
function shuffle(deck,rng=Math.random){const a=[...deck];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function createGame({mode="solo",humanSeat=0,hakem=0,rng=Math.random}={}){
 const deck=shuffle(makeDeck(),rng),hands=[[],[],[],[]];
 for(let n=0;n<5;n++)for(let p=0;p<4;p++)hands[p].push(deck.pop());
 return {mode,humanSeat,hakem,hands,remaining:deck,phase:"choose-trump",trump:null,leader:hakem,currentPlayer:hakem,trick:[],tricksWon:[0,0,0,0],teamTricks:[0,0],teamPoints:[0,0],round:1,finished:false};
}
function chooseTrump(game,suit){
 if(game.phase!=="choose-trump"||!SUITS.includes(suit))throw new Error("Invalid trump selection");
 game.trump=suit;
 for(let n=0;n<8;n++)for(let p=0;p<4;p++)game.hands[p].push(game.remaining.pop());
 game.remaining=[];game.phase="playing";game.currentPlayer=game.hakem;return game;
}
function legalCards(game,player=game.currentPlayer){
 const hand=game.hands[player];if(!hand||!hand.length)return [];
 if(!game.trick.length)return [...hand];
 const lead=game.trick[0].card.suit,follow=hand.filter(c=>c.suit===lead);
 return follow.length?follow:[...hand];
}
function trickWinner(trick,trump){
 if(!Array.isArray(trick)||trick.length!==4)throw new Error("A trick needs four cards");
 const lead=trick[0].card.suit;
 const strength=c=>c.suit===trump?200+rankValue(c.rank):c.suit===lead?100+rankValue(c.rank):rankValue(c.rank);
 return trick.reduce((best,entry)=>strength(entry.card)>strength(best.card)?entry:best).player;
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
function chooseCpuCard(game,player=game.currentPlayer){
 const legal=legalCards(game,player);if(!legal.length)throw new Error("CPU has no legal card");
 const lead=game.trick[0]?.card.suit;
 if(!lead)return legal.slice().sort((a,b)=>rankValue(a.rank)-rankValue(b.rank))[0];
 const following=legal.filter(c=>c.suit===lead);
 const pool=following.length?following:legal;
 return pool.slice().sort((a,b)=>rankValue(a.rank)-rankValue(b.rank))[0];
}
function seatMap(mode="solo",humanSeat=0){
 if(mode!=="solo")return [0,1,2,3].map(seat=>({seat,kind:"human",team:seat%2}));
 return [0,1,2,3].map(seat=>({seat,kind:seat===humanSeat?"human":"cpu",team:seat%2}));
}
const api={SUITS,RANKS,TEAMS,makeDeck,shuffle,createGame,chooseTrump,legalCards,trickWinner,playCard,chooseCpuCard,seatMap};
if(typeof module!=="undefined"&&module.exports)module.exports=api;root.HokmEngine=api;
})(typeof globalThis!=="undefined"?globalThis:this);
