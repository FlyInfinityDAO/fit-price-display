// Fly Infinity Snakes & Ladders — deterministic rules engine.
export const BOARD_SIZE=100;
export const SNAKES=Object.freeze({16:6,47:26,49:11,56:53,62:19,64:60,87:24,93:73,95:75,98:78});
export const LADDERS=Object.freeze({1:38,4:14,9:31,21:42,28:84,36:44,51:67,71:91,80:100});
export function createGame(playerCount=2,humanCount=playerCount,difficulty="medium"){
 const count=Math.max(2,Math.min(4,Number(playerCount)||2)),humans=Math.max(1,Math.min(count,Number(humanCount)||1));
 return {version:1,status:"active",turn:0,dice:null,players:Array.from({length:count},(_,i)=>({id:i,name:i<humans?`Player ${i+1}`:`CPU ${i-humans+1}`,kind:i<humans?"human":"cpu",position:0,color:["#FF1744","#00E676","#2979FF","#FFD600"][i]})),difficulty,lastAction:null,winner:null,moveNumber:0};
}
export function roll(game,random=Math.random){
 if(game.status!=="active"||game.dice!==null)throw new Error("The dice are not ready.");
 const next=structuredClone(game),value=1+Math.floor(random()*6);next.dice=value;
 const p=next.players[next.turn],from=p.position,needSix=from===0&&value!==6,raw=from===0?(value===6?1:0):from+value;let to=needSix?0:(raw<=100?raw:from),transport=null;
 if(!needSix&&to>0&&LADDERS[to]){transport={type:"ladder",from:to,to:LADDERS[to]};to=LADDERS[to];}
 else if(!needSix&&to>0&&SNAKES[to]){transport={type:"snake",from:to,to:SNAKES[to]};to=SNAKES[to];}
 p.position=to;next.lastAction={type:"roll",value,player:next.turn,from,to,transport,needSix,overshoot:!needSix&&raw>100};next.moveNumber++;
 if(to===100){next.status="finished";next.winner=next.turn;next.dice=null;return next;}
 next.dice=null;next.turn=(next.turn+1)%next.players.length;return next;
}
export function applyRoll(game,value){if(!Number.isInteger(value)||value<1||value>6)throw new Error("Invalid dice value.");return roll(game,()=> (value-1)/6);}
export function validateGame(game){if(!game||!Array.isArray(game.players)||game.players.length<2||game.players.length>4)throw new Error("Invalid game state.");if(!Number.isInteger(game.turn)||game.turn<0||game.turn>=game.players.length)throw new Error("Invalid turn.");for(const p of game.players)if(!Number.isInteger(p.position)||p.position<0||p.position>100)throw new Error("Invalid player position.");return true;}
