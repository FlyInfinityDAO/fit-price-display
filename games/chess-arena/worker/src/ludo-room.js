import { createGame, roll, legalPieceMoves, applyMove, COLORS } from "../../../ludo/js/ludo-engine.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export class LudoRoom {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async read(){return this.ctx.storage.get("game");}
  async save(game){
    if(game.state?.status==="finished"&&!game.statsRecorded&&this.env.DB){
      await this.env.DB.prepare("CREATE TABLE IF NOT EXISTS ludo_player_results (room_code TEXT NOT NULL,wallet_address TEXT NOT NULL,outcome TEXT NOT NULL,points INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(room_code,wallet_address))").run();
      const now=Math.floor(Date.now()/1000),winnerIndex=game.state.players.findIndex(p=>p.color===game.state.winner);
      const statements=game.players.map((wallet,i)=>this.env.DB.prepare("INSERT OR IGNORE INTO ludo_player_results (room_code,wallet_address,outcome,points,created_at) VALUES (?,?,?,?,?)").bind(game.code,wallet,winnerIndex===i?"win":"loss",winnerIndex===i?3:0,now));
      if(statements.length)await this.env.DB.batch(statements);
      game.statsRecorded=true;
    }
    await this.ctx.storage.put("game",game);
  }
  snapshot(g){return {roomCode:g.code,playerCount:g.playerCount,players:g.players,state:g.state,status:g.status,serverTime:Date.now()};}
  broadcast(g,type="state"){const payload=JSON.stringify({type,game:this.snapshot(g)});for(const socket of this.ctx.getWebSockets()){try{socket.send(payload);}catch{}}}
  async fetch(request){
    const url=new URL(request.url),wallet=(request.headers.get("x-ludo-wallet")||"").toLowerCase();
    if(request.method==="POST"&&url.pathname==="/create"){
      if(await this.read())return json({ok:false,error:"Room code collision."},409);
      if(!wallet)return json({ok:false,error:"Wallet missing."},400);
      const count=Math.max(2,Math.min(4,Number(url.searchParams.get("players"))||4));
      const g={code:url.searchParams.get("code")||"",playerCount:count,players:[wallet],state:null,status:"waiting",createdAt:Date.now(),statsRecorded:false};
      await this.save(g);return json({ok:true,room:this.snapshot(g)});
    }
    if(request.method==="POST"&&url.pathname==="/join"){
      const g=await this.read();if(!g)return json({ok:false,error:"Room not found."},404);
      if(!wallet)return json({ok:false,error:"Wallet missing."},400);
      if(g.players.includes(wallet))return json({ok:true,room:this.snapshot(g)});
      if(g.status!=="waiting"||g.players.length>=g.playerCount)return json({ok:false,error:"This room is full or already started."},409);
      g.players.push(wallet);
      if(g.players.length===g.playerCount){g.status="active";g.state=createGame(g.playerCount,g.playerCount);}
      await this.save(g);this.broadcast(g,"joined");return json({ok:true,room:this.snapshot(g)});
    }
    if(request.method==="GET"&&["/snapshot","/check-player"].includes(url.pathname)){
      const g=await this.read();if(!g)return json({ok:false,error:"Room not found."},404);
      if(!g.players.includes(wallet))return json({ok:false,error:"Wallet is not a player in this room."},403);
      return url.pathname==="/check-player"?json({ok:true}):json({ok:true,room:this.snapshot(g)});
    }
    if(request.method==="GET"&&url.pathname==="/ws"){
      const g=await this.read();if(!g)return json({ok:false,error:"Room not found."},404);
      if(!g.players.includes(wallet))return json({ok:false,error:"Wallet is not a player in this room."},403);
      if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({ok:false,error:"WebSocket upgrade required."},426);
      const pair=new WebSocketPair(),[client,server]=Object.values(pair);this.ctx.acceptWebSocket(server);server.serializeAttachment({wallet});server.send(JSON.stringify({type:"state",game:this.snapshot(g)}));return new Response(null,{status:101,webSocket:client});
    }
    return json({ok:false,error:"Room route not found."},404);
  }
  async webSocketMessage(socket,message){
    let action;try{if(typeof message!=="string"||message.length>2048)throw 0;action=JSON.parse(message);}catch{socket.send(JSON.stringify({type:"error",error:"Invalid game message."}));return;}
    const wallet=socket.deserializeAttachment()?.wallet,g=await this.read();
    if(!g||g.status!=="active"||!g.state||!wallet||!g.players.includes(wallet)){socket.send(JSON.stringify({type:"error",error:"Game is not active for this wallet."}));return;}
    const playerIndex=g.players.indexOf(wallet);
    if(playerIndex!==g.state.turn){socket.send(JSON.stringify({type:"error",error:"It is not your turn."}));return;}
    try{
      if(action.type==="roll"){g.state=roll(g.state);await this.save(g);this.broadcast(g,"roll");return;}
      if(action.type==="move"){const move=legalPieceMoves(g.state).find(m=>m.pieceIndex===action.pieceIndex&&m.to===action.to);if(!move)throw new Error("Illegal move.");g.state=applyMove(g.state,playerIndex,move);if(g.state.status==="finished")g.status="finished";await this.save(g);this.broadcast(g,g.status==="finished"?"finished":"move");return;}
      if(action.type==="resign"){g.state.status="finished";g.state.winner=g.state.players[(playerIndex+1)%g.playerCount].color;g.status="finished";await this.save(g);this.broadcast(g,"finished");return;}
      throw new Error("Unsupported action.");
    }catch(error){socket.send(JSON.stringify({type:"error",error:error.message||"Move rejected."}));}
  }
  async webSocketClose(socket){try{socket.close(1000,"closed");}catch{}}
}