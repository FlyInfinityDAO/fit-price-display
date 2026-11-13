import { getAddress, isAddress } from "ethers";
import { createGame, roll, legalPieceMoves, applyMove } from "../../js/ludo-engine.js";
import { getFitBalance } from "./security.js";

const MIN_FIT_WEI = 10n ** 18n;
const BSC_CHAIN_ID = 56;
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});

function allowedOrigin(origin,env){
  return new Set([env.FRONTEND_ORIGIN,...(env.FRONTEND_ORIGINS||"").split(",")].map(v=>(v||"").trim()).filter(Boolean)).has(origin);
}
function decodeBase64Url(value){const normalized=value.replace(/-/g,"+").replace(/_/g,"/");return atob(normalized+"=".repeat((4-normalized.length%4)%4));}
async function verifySession(token,secret){
  if(!token||!secret||secret.length<32)return null;
  const parts=token.split(".");if(parts.length!==3)return null;
  try{
    const input=parts[0]+"."+parts[1],key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const signature=Uint8Array.from(decodeBase64Url(parts[2]),c=>c.charCodeAt(0));
    if(!await crypto.subtle.verify("HMAC",key,signature,new TextEncoder().encode(input)))return null;
    const payload=JSON.parse(decodeBase64Url(parts[1]));
    if(!payload.exp||payload.exp<=Math.floor(Date.now()/1000)||payload.chainId!==BSC_CHAIN_ID||!isAddress(payload.sub))return null;
    return payload;
  }catch{return null;}
}
async function authorize(request,env){
  const header=request.headers.get("Authorization")||"",token=header.startsWith("Bearer ")?header.slice(7):"";
  const session=await verifySession(token,env.SESSION_SECRET);
  if(!session)return{response:json({ok:false,error:"Wallet session is invalid or expired. Reconnect your wallet."},401)};
  const wallet=getAddress(session.sub);let balance;
  try{balance=await getFitBalance(env,wallet);}catch{return{response:json({ok:false,error:"BSC RPC is temporarily unavailable. Please retry shortly."},503,{"retry-after":"5"})};}
  if(balance<MIN_FIT_WEI)return{response:json({ok:false,error:"At least 1 FIT is required to enter or continue a game.",balanceWei:balance.toString()},403)};
  return{wallet,balance};
}
function validRoomCode(value){return typeof value==="string"&&/^[A-HJ-NP-Z2-9]{6}$/.test(value.toUpperCase());}
function makeRoomCode(){const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return Array.from(bytes,b=>ROOM_ALPHABET[b%ROOM_ALPHABET.length]).join("");}
function roomStub(env,code){return env.LUDO_ROOMS.get(env.LUDO_ROOMS.idFromName(code));}
async function createRoom(env,wallet,count,mode="friend",difficulty="medium"){
  for(let attempt=0;attempt<5;attempt++){
    const code=makeRoomCode(),stub=roomStub(env,code);
    const response=await stub.fetch("https://ludo-room.internal/create?code="+code+"&mode="+mode+"&players="+count+"&humans=1&difficulty="+difficulty,{method:"POST",headers:{"x-ludo-wallet":wallet.toLowerCase()}});
    if(response.status===409)continue;
    const data=await response.json();if(!response.ok||data.ok!==true)return json(data,response.status);
    return json({...data,roomCode:code});
  }
  return json({ok:false,error:"Could not allocate a Ludo room. Please try again."},503);
}

function secureRandom(){const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0]/4294967296;}
export function advanceLocalState(state,action,random=secureRandom){
  if(action?.type==="roll")return roll(state,random);
  if(action?.type==="move"){
    if(!Number.isInteger(action.pieceIndex)||!Number.isInteger(action.to))throw new Error("Invalid piece move.");
    const legal=legalPieceMoves(state).find(move=>move.pieceIndex===action.pieceIndex&&move.to===action.to);
    if(!legal)throw new Error("Illegal Ludo move.");
    return applyMove(state,state.turn,legal);
  }
  throw new Error("Unsupported local game action.");
}
async function handleLocalMatch(request,env,path,auth){
  if(path==="/api/ludo/local/start"&&request.method==="POST"){
    const body=await request.json().catch(()=>({})),count=Number(body.playerCount);
    if(!Number.isInteger(count)||count<2||count>4)return json({ok:false,error:"Choose between 2 and 4 local players."},400);
    const matchId=crypto.randomUUID().replace(/-/g,""),state=createGame(count,count),now=Math.floor(Date.now()/1000);
    await env.DB.prepare("INSERT INTO local_matches (match_id,wallet_address,state_json,status,revision,created_at,updated_at) VALUES (?,?,?,'active',0,?,?)").bind(matchId,auth.wallet.toLowerCase(),JSON.stringify(state),now,now).run();
    return json({ok:true,matchId,game:state,revision:0});
  }
  if((path==="/api/ludo/local/roll"||path==="/api/ludo/local/move")&&request.method==="POST"){
    const body=await request.json().catch(()=>({})),matchId=body.matchId;
    if(typeof matchId!=="string"||!/^[a-f0-9]{32}$/.test(matchId))return json({ok:false,error:"Invalid local match."},400);
    const row=await env.DB.prepare("SELECT wallet_address,state_json,status,revision FROM local_matches WHERE match_id=?").bind(matchId).first();
    if(!row||row.wallet_address!==auth.wallet.toLowerCase())return json({ok:false,error:"Local match not found for this wallet."},404);
    if(row.status!=="active")return json({ok:false,error:"This local match is already finished."},409);
    let state;try{state=JSON.parse(row.state_json);}catch{return json({ok:false,error:"Stored local match is invalid."},500);}
    try{state=advanceLocalState(state,path.endsWith("/roll")?{type:"roll"}:{type:"move",pieceIndex:body.pieceIndex,to:body.to});}
    catch(error){return json({ok:false,error:error?.message||"Invalid local game action."},409);}
    const finished=state.status==="finished",now=Math.floor(Date.now()/1000);
    const saved=await env.DB.prepare("UPDATE local_matches SET state_json=?,status=?,revision=revision+1,updated_at=? WHERE match_id=? AND wallet_address=? AND revision=? AND status='active'").bind(JSON.stringify(state),finished?"finished":"active",now,matchId,auth.wallet.toLowerCase(),row.revision).run();
    if(Number(saved.meta?.changes||0)!==1)return json({ok:false,error:"The match changed in another request. Refresh the game state and retry."},409);
    if(finished)await env.DB.prepare("INSERT OR IGNORE INTO ludo_player_results (room_code,wallet_address,outcome,points,created_at) VALUES (?,?, 'win',3,?)").bind("LOCAL-"+matchId,auth.wallet.toLowerCase(),now).run();
    return json({ok:true,matchId,game:state,revision:Number(row.revision)+1});
  }
  return null;
}
export async function handleLudoApi(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==="POST"&&path==="/api/ludo/rooms/create"){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const body=await request.json().catch(()=>({})),count=Math.max(2,Math.min(4,Number(body.playerCount)||4));
    return createRoom(env,auth.wallet,count,"friend");
  }
  if(request.method==="POST"&&path==="/api/ludo/rooms/cpu"){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const body=await request.json().catch(()=>({})),count=Math.max(2,Math.min(4,Number(body.playerCount)||2));
    const difficulty=["easy","medium","hard"].includes(body.difficulty)?body.difficulty:"medium";
    return createRoom(env,auth.wallet,count,"cpu",difficulty);
  }
  if(request.method==="POST"&&path==="/api/ludo/rooms/join"){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const body=await request.json().catch(()=>({}));if(!validRoomCode(body.roomCode))return json({ok:false,error:"Enter a valid six-character room code."},400);
    const code=body.roomCode.toUpperCase(),response=await roomStub(env,code).fetch("https://ludo-room.internal/join",{method:"POST",headers:{"x-ludo-wallet":auth.wallet.toLowerCase()}});
    return new Response(response.body,{status:response.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }
  const roomMatch=path.match(/^\/api\/ludo\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(ticket|ws|fill-cpu))?$/);
  if(request.method==="POST"&&roomMatch&&roomMatch[2]==="fill-cpu"){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const body=await request.json().catch(()=>({})),difficulty=["easy","medium","hard"].includes(body.difficulty)?body.difficulty:"medium";
    const response=await roomStub(env,roomMatch[1]).fetch("https://ludo-room.internal/fill-cpu?difficulty="+difficulty,{method:"POST",headers:{"x-ludo-wallet":auth.wallet.toLowerCase()}});
    return new Response(response.body,{status:response.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }
  if(request.method==="POST"&&roomMatch&&roomMatch[2]==="ticket"){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const code=roomMatch[1],member=await roomStub(env,code).fetch("https://ludo-room.internal/check-player",{headers:{"x-ludo-wallet":auth.wallet.toLowerCase()}});
    if(!member.ok)return new Response(member.body,{status:member.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
    const ticket=crypto.randomUUID().replace(/-/g,""),now=Math.floor(Date.now()/1000);
    await env.DB.prepare("INSERT INTO websocket_tickets (ticket,room_code,wallet_address,expires_at,used,created_at) VALUES (?,?,?,?,0,?)").bind(ticket,"LD"+code,auth.wallet.toLowerCase(),now+30,now).run();
    const wsUrl=new URL("/api/ludo/rooms/"+code+"/ws?ticket="+ticket,request.url);wsUrl.protocol=wsUrl.protocol==="https:"?"wss:":"ws:";
    return json({ok:true,ticket,socketUrl:wsUrl.toString(),expiresAt:now+30});
  }
  if(request.method==="GET"&&roomMatch&&roomMatch[2]==="ws"&&request.headers.get("Upgrade")?.toLowerCase()==="websocket"){
    if(!allowedOrigin(request.headers.get("Origin"),env))return json({ok:false,error:"Origin not allowed."},403);
    const code=roomMatch[1],ticket=url.searchParams.get("ticket")||"";
    if(!/^[a-f0-9]{32}$/.test(ticket))return json({ok:false,error:"WebSocket ticket is invalid."},401);
    const now=Math.floor(Date.now()/1000),row=await env.DB.prepare("SELECT wallet_address,expires_at,used FROM websocket_tickets WHERE ticket=? AND room_code=?").bind(ticket,"LD"+code).first();
    if(!row||row.used!==0||row.expires_at<=now)return json({ok:false,error:"WebSocket ticket expired."},401);
    const wallet=getAddress(row.wallet_address);let balance;
    try{balance=await getFitBalance(env,wallet);}catch{return json({ok:false,error:"BSC RPC is temporarily unavailable."},503,{"retry-after":"5"});}
    if(balance<MIN_FIT_WEI)return json({ok:false,error:"At least 1 FIT is required."},403);
    const consumed=await env.DB.prepare("UPDATE websocket_tickets SET used=1 WHERE ticket=? AND room_code=? AND used=0 AND expires_at>?").bind(ticket,"LD"+code,Math.floor(Date.now()/1000)).run();
    if(!consumed.meta||consumed.meta.changes!==1)return json({ok:false,error:"WebSocket ticket already used."},409);
    return roomStub(env,code).fetch("https://ludo-room.internal/ws",{headers:{"x-ludo-wallet":wallet.toLowerCase(),"Upgrade":"websocket"}});
  }
  if(request.method==="GET"&&roomMatch&&!roomMatch[2]){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const response=await roomStub(env,roomMatch[1]).fetch("https://ludo-room.internal/snapshot",{headers:{"x-ludo-wallet":auth.wallet.toLowerCase()}});
    return new Response(response.body,{status:response.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }
  if(request.method==="POST"&&path==="/api/ludo/stats/record"){
    return json({ok:false,error:"Client-submitted game results are disabled. Results are recorded by the authoritative game service."},410);
  }
  if(path.startsWith("/api/ludo/local/")){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const localResponse=await handleLocalMatch(request,env,path,auth);
    if(localResponse)return localResponse;
  }
  if(request.method==="GET"&&(path==="/api/ludo/stats/me"||path==="/api/ludo/stats/leaderboard")){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    if(path==="/api/ludo/stats/me"){
      const row=await env.DB.prepare("SELECT wallet_address,COUNT(*) AS games,COALESCE(SUM(points),0) AS points,SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) AS wins,SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) AS losses FROM ludo_player_results WHERE wallet_address=? GROUP BY wallet_address").bind(auth.wallet.toLowerCase()).first();
      const totals=row||{wallet_address:auth.wallet.toLowerCase(),games:0,points:0,wins:0,losses:0};
      const rank=await env.DB.prepare("WITH totals AS (SELECT wallet_address,SUM(points) AS points FROM ludo_player_results GROUP BY wallet_address) SELECT COUNT(*)+1 AS rank FROM totals WHERE points>?").bind(totals.points).first();
      return json({ok:true,stats:{...totals,rank:rank?.rank||1}});
    }
    const leaderboard=await env.DB.prepare("SELECT wallet_address,COUNT(*) AS games,SUM(points) AS points,SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) AS wins FROM ludo_player_results GROUP BY wallet_address ORDER BY points DESC,wins DESC,games DESC LIMIT 20").all();
    return json({ok:true,leaderboard:leaderboard.results||[]});
  }
  return null;
}
