import { resolveRoll } from "./rules.js";
const COLORS = ["#36d6d0","#ffbf5b","#a78bfa","#ff668c"];
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});

export class SnakesRoom {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async read(){
    const game=await this.ctx.storage.get("game");
    if(game&&Date.now()-game.createdAt>24*60*60*1000){await this.ctx.storage.delete("game");return null;}
    return game||null;
  }
  async save(game){
    if(game.state?.status==="finished"&&!game.statsRecorded&&this.env.DB){
      const now=Math.floor(Date.now()/1000),winner=game.state.winner;
      const statements=game.players.filter(Boolean).map((wallet,index)=>this.env.DB.prepare(
        "INSERT OR IGNORE INTO snakes_player_results (room_code,wallet_address,outcome,points,created_at) VALUES (?,?,?,?,?)"
      ).bind(game.code,wallet,winner===index?"win":"loss",winner===index?3:0,now));
      if(statements.length)await this.env.DB.batch(statements);
      game.statsRecorded=true;
    }
    await this.ctx.storage.put("game",game);
  }
  snapshot(game){return {roomCode:game.code,playerCount:game.playerCount,players:game.players,status:game.status,state:game.state,createdAt:game.createdAt,serverTime:Date.now()};}
  broadcast(game,type="state"){
    const payload=JSON.stringify({type,game:this.snapshot(game)});
    for(const socket of this.ctx.getWebSockets()){try{socket.send(payload);}catch{}}
  }
  async fetch(request){
    const url=new URL(request.url),wallet=(request.headers.get("x-snakes-wallet")||"").toLowerCase();
    if(request.method==="POST"&&url.pathname==="/create"){
      if(await this.read())return json({ok:false,error:"Room code collision."},409);
      if(!wallet)return json({ok:false,error:"Wallet missing."},400);
      const count=Math.max(2,Math.min(4,Number(url.searchParams.get("players"))||2));
      const players=Array(count).fill(null);players[0]=wallet;
      const game={code:url.searchParams.get("code")||"",playerCount:count,players,hostWallet:wallet,status:"waiting",state:null,createdAt:Date.now(),statsRecorded:false};
      await this.save(game);return json({ok:true,room:this.snapshot(game)});
    }
    if(request.method==="POST"&&url.pathname==="/join"){
      const game=await this.read();if(!game)return json({ok:false,error:"Room not found."},404);
      if(!wallet)return json({ok:false,error:"Wallet missing."},400);
      if(game.players.includes(wallet))return json({ok:true,room:this.snapshot(game)});
      if(game.status!=="waiting")return json({ok:false,error:"Room is full or already started."},409);
      const seat=game.players.findIndex(value=>!value);
      if(seat<0)return json({ok:false,error:"Room is full."},409);
      game.players[seat]=wallet;
      if(game.players.every(Boolean)){
        game.status="active";
        game.state={version:1,status:"active",turn:0,players:game.players.map((address,index)=>({id:index,name:"Player "+(index+1),kind:"human",wallet:address,position:0,color:COLORS[index]})),lastAction:null,winner:null,moveNumber:0};
      }
      await this.save(game);this.broadcast(game,game.status==="active"?"started":"joined");
      return json({ok:true,room:this.snapshot(game)});
    }
    if(request.method==="GET"&&url.pathname==="/check-player"){
      const game=await this.read();if(!game)return json({ok:false,error:"Room not found."},404);
      return game.players.includes(wallet)?json({ok:true}):json({ok:false,error:"Wallet is not a player in this room."},403);
    }
    if(request.method==="GET"&&url.pathname==="/snapshot"){
      const game=await this.read();if(!game)return json({ok:false,error:"Room not found."},404);
      if(!game.players.includes(wallet))return json({ok:false,error:"Wallet is not a player in this room."},403);
      return json({ok:true,room:this.snapshot(game)});
    }
    if(request.method==="GET"&&url.pathname==="/ws"){
      const game=await this.read();if(!game)return json({ok:false,error:"Room not found."},404);
      if(!game.players.includes(wallet))return json({ok:false,error:"Wallet is not a player in this room."},403);
      if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({ok:false,error:"WebSocket upgrade required."},426);
      const pair=new WebSocketPair(),[client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server);server.serializeAttachment({wallet});
      server.send(JSON.stringify({type:"state",game:this.snapshot(game)}));
      return new Response(null,{status:101,webSocket:client});
    }
    return json({ok:false,error:"Room route not found."},404);
  }
  async webSocketMessage(socket,message){
    let action;try{if(typeof message!=="string"||message.length>1024)throw 0;action=JSON.parse(message);}catch{socket.send(JSON.stringify({type:"error",error:"Invalid game action."}));return;}
    const wallet=socket.deserializeAttachment()?.wallet,game=await this.read();
    if(!game||game.status!=="active"||!game.state||!wallet||!game.players.includes(wallet)){socket.send(JSON.stringify({type:"error",error:"Game is not active for this wallet."}));return;}
    const playerIndex=game.state.turn,player=game.state.players[playerIndex];
    if(player.wallet!==wallet){socket.send(JSON.stringify({type:"error",error:"It is not your turn."}));return;}
    if(action.type==="roll"){
      const value=1+crypto.getRandomValues(new Uint32Array(1))[0]%6;
      const move=resolveRoll(player.position,value);player.position=move.to;game.state.lastAction={type:"roll",value,player:playerIndex,...move};game.state.moveNumber++;
      if(move.to===100){game.state.status="finished";game.state.winner=playerIndex;game.status="finished";}
      else game.state.turn=(playerIndex+1)%game.playerCount;
      await this.save(game);this.broadcast(game,game.status==="finished"?"finished":"roll");return;
    }
    if(action.type==="resign"){
      const next=(playerIndex+1)%game.playerCount;
      game.state.status="finished";game.state.winner=next;game.state.lastAction={type:"resign",player:playerIndex};game.status="finished";
      await this.save(game);this.broadcast(game,"finished");return;
    }
    socket.send(JSON.stringify({type:"error",error:"Unsupported game action."}));
  }
  async webSocketClose(socket){try{socket.close(1000,"closed");}catch{}}
}
