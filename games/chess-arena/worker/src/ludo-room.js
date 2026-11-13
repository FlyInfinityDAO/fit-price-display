import { createGame, roll, legalPieceMoves, applyMove, chooseCpuMove } from "../../../ludo/js/ludo-engine.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export class LudoRoom {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async read(){
    const game=await this.ctx.storage.get("game");
    if(game&&Date.now()-game.createdAt>6*60*60*1000){await this.ctx.storage.delete("game");return null;}
    // Repair legacy waiting rooms that were incorrectly pre-filled with the creator wallet.
    if(game&&game.mode==="friend"&&game.status==="waiting"&&!game.state&&Array.isArray(game.players)&&
       game.players.length===game.playerCount&&game.players.length>1&&game.players.every(value=>value===game.players[0])){
      const host=game.players[0];game.players=Array(game.playerCount).fill(null);game.players[0]=host;game.hostWallet=game.hostWallet||host;
      await this.ctx.storage.put("game",game);
    }
    // Repair legacy CPU rooms where one wallet was incorrectly assigned multiple human seats.
    if(game&&game.mode==="cpu"&&game.status==="active"&&game.state?.players?.length===game.playerCount&&
       Array.isArray(game.players)&&game.players.length>1&&game.players.every(value=>value===game.players[0])){
      const host=game.players[0];game.players=Array(game.playerCount).fill(null);game.players[0]=host;game.hostWallet=game.hostWallet||host;
      game.state.players.forEach((player,index)=>{player.kind=index===0?"human":"cpu";});
      await this.ctx.storage.put("game",game);
    }
    return game;
  }
  async save(game){
    if(game.state?.status==="finished"&&!game.statsRecorded&&this.env.DB){
      await this.env.DB.prepare("CREATE TABLE IF NOT EXISTS ludo_player_results (room_code TEXT NOT NULL,wallet_address TEXT NOT NULL,outcome TEXT NOT NULL,points INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(room_code,wallet_address))").run();
      const now=Math.floor(Date.now()/1000),winnerIndex=game.state.players.findIndex(p=>p.color===game.state.winner);
      const uniqueWallets=[...new Set(game.players.filter(Boolean))];
      const statements=uniqueWallets.map(wallet=>{
        const seats=game.players.map((value,index)=>value===wallet?index:-1).filter(index=>index>=0);
        const won=seats.includes(winnerIndex),outcome=won?"win":"loss";
        return this.env.DB.prepare("INSERT OR IGNORE INTO ludo_player_results (room_code,wallet_address,outcome,points,created_at) VALUES (?,?,?,?,?)").bind(game.code,wallet,outcome,won?3:0,now);
      });
      if(statements.length)await this.env.DB.batch(statements);
      game.statsRecorded=true;
    }
    await this.ctx.storage.put("game",game);
  }
  snapshot(g){return {roomCode:g.code,playerCount:g.playerCount,players:g.players,hostWallet:g.hostWallet,mode:g.mode,difficulty:g.difficulty,status:g.status,state:g.state,serverTime:Date.now()};}
  broadcast(g,type="state"){const payload=JSON.stringify({type,game:this.snapshot(g)});for(const socket of this.ctx.getWebSockets()){try{socket.send(payload);}catch{}}}
  async playCpuTurns(g){
    let guard=0;
    while(g.state?.status==="active"&&g.state.players[g.state.turn]?.kind==="cpu"&&guard++<64){
      g.state=roll(g.state);
      if(g.state.dice!==null){
        const move=chooseCpuMove(g.state,g.difficulty||"medium");
        if(move)g.state=applyMove(g.state,g.state.turn,move);
      }
    }
    if(g.state?.status==="finished")g.status="finished";
  }
  async fetch(request){
    const url=new URL(request.url),wallet=(request.headers.get("x-ludo-wallet")||"").toLowerCase();
    if(request.method==="POST"&&url.pathname==="/create"){
      if(await this.read())return json({ok:false,error:"Room code collision."},409);
      if(!wallet)return json({ok:false,error:"Wallet missing."},400);
      const mode=url.searchParams.get("mode")==="cpu"?"cpu":"friend";
      const count=Math.max(2,Math.min(4,Number(url.searchParams.get("players"))||4));
      // A wallet occupies exactly one human seat. Empty seats remain joinable.
      const humans=1;
      const difficulty=["easy","medium","hard"].includes(url.searchParams.get("difficulty"))?url.searchParams.get("difficulty"):"medium";
      const players=Array(count).fill(null);players[0]=wallet;
      const game={code:url.searchParams.get("code")||"",playerCount:count,players,hostWallet:wallet,mode,difficulty:mode==="cpu"?difficulty:null,state:mode==="cpu"?createGame(count,humans):null,status:mode==="cpu"?"active":"waiting",createdAt:Date.now(),statsRecorded:false};
      await this.save(game);return json({ok:true,room:this.snapshot(game)});
    }
    if(request.method==="POST"&&url.pathname==="/join"){
      const g=await this.read();if(!g)return json({ok:false,error:"Room not found."},404);
      if(!wallet)return json({ok:false,error:"Wallet missing."},400);
      if(g.mode==="cpu")return json({ok:false,error:"CPU rooms cannot be joined."},409);
      if(g.players.includes(wallet))return json({ok:true,room:this.snapshot(g)});
      if(g.status!=="waiting")return json({ok:false,error:"This room is full or already started."},409);
      const seat=g.players.findIndex(value=>!value);
      if(seat<0)return json({ok:false,error:"This room is full or already started."},409);
      g.players[seat]=wallet;
      if(g.players.every(Boolean)){g.status="active";g.mode="friend";g.state=createGame(g.playerCount,g.playerCount);}
      await this.save(g);this.broadcast(g,g.status==="active"?"started":"joined");return json({ok:true,room:this.snapshot(g)});
    }
    if(request.method==="POST"&&url.pathname==="/fill-cpu"){
      const g=await this.read();if(!g)return json({ok:false,error:"Room not found."},404);
      if(!wallet||wallet!==g.hostWallet)return json({ok:false,error:"Only the room creator can start CPU seats."},403);
      if(g.status!=="waiting")return json({ok:false,error:"This room has already started."},409);
      const humans=g.players.filter(Boolean).length;
      if(humans<1||humans>=g.playerCount)return json({ok:false,error:"There are no empty seats to fill."},409);
      const difficulty=["easy","medium","hard"].includes(url.searchParams.get("difficulty"))?url.searchParams.get("difficulty"):"medium";
      g.mode="mixed";g.difficulty=difficulty;g.state=createGame(g.playerCount,humans);g.status="active";
      await this.save(g);this.broadcast(g,"started");return json({ok:true,room:this.snapshot(g)});
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
    const seats=g.players.map((value,index)=>value===wallet?index:-1).filter(index=>index>=0);
    if(!seats.includes(g.state.turn)){socket.send(JSON.stringify({type:"error",error:"It is not your turn."}));return;}
    const playerIndex=g.state.turn;
    try{
      if(action.type==="roll"){
        g.state=roll(g.state);
        await this.playCpuTurns(g);
        await this.save(g);this.broadcast(g,g.status==="finished"?"finished":"roll");return;
      }
      if(action.type==="move"){
        const move=legalPieceMoves(g.state).find(m=>m.pieceIndex===action.pieceIndex&&m.to===action.to);
        if(!move)throw new Error("Illegal move.");
        g.state=applyMove(g.state,playerIndex,move);
        await this.playCpuTurns(g);
        if(g.state.status==="finished")g.status="finished";
        await this.save(g);this.broadcast(g,g.status==="finished"?"finished":"move");return;
      }
      if(action.type==="resign"){
        g.state.status="finished";g.state.winner=g.state.players[(playerIndex+1)%g.playerCount].color;g.status="finished";
        await this.save(g);this.broadcast(g,"finished");return;
      }
      throw new Error("Unsupported action.");
    }catch(error){socket.send(JSON.stringify({type:"error",error:error.message||"Move rejected."}));}
  }
  async webSocketClose(socket){try{socket.close(1000,"closed");}catch{}}
}