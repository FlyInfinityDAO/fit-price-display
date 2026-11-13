import { getAddress, isAddress } from "ethers";
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
  const roomMatch=path.match(/^\/api\/ludo\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(ticket|ws|fill-cpu))?$/);
  if(request.method==="POST"&&roomMatch&&roomMatch[2]==="join"){
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const body=await request.json().catch(()=>({}));if(!validRoomCode(body.roomCode))return json({ok:false,error:"Enter a valid six-character room code."},400);
    const code=body.roomCode.toUpperCase(),response=await roomStub(env,code).fetch("https://ludo-room.internal/join",{method:"POST",headers:{"x-ludo-wallet":auth.wallet.toLowerCase()}});
    return new Response(response.body,{status:response.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }
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
    const auth=await authorize(request,env);if(auth.response)return auth.response;
    const body=await request.json().catch(()=>({}));
    if(body.source!=="local"||!["win","loss"].includes(body.outcome)||typeof body.roomCode!=="string"||!/^LOCAL-[A-Za-z0-9-]{8,64}$/.test(body.roomCode))return json({ok:false,error:"Invalid local game result."},400);
    await env.DB.prepare("INSERT OR IGNORE INTO ludo_player_results (room_code,wallet_address,outcome,points,created_at) VALUES (?,?,?,?,?)").bind(body.roomCode,auth.wallet.toLowerCase(),body.outcome,body.outcome==="win"?3:0,Math.floor(Date.now()/1000)).run();
    return json({ok:true,recorded:true});
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
