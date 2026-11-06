export { HokmRoom } from "./room.js";
import {getAddress,isAddress,verifyMessage} from "ethers";
import {enforceRateLimit,cleanupExpiredRecords,getFitBalance} from "./security.js";
const CHAIN_ID=56,MIN_FIT=10n**18n,TIER2_FIT=10n**19n,NONCE_TTL=300,SESSION_TTL=1800;
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
function origins(env){return new Set([env.FRONTEND_ORIGIN,...(env.FRONTEND_ORIGINS||"").split(",")].map(x=>(x||"").trim()).filter(Boolean))}
function cors(request,env){const origin=request.headers.get("Origin");if(!origin||!origins(env).has(origin))return{};return{"access-control-allow-origin":origin,"access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"Content-Type, Authorization","access-control-max-age":"86400","vary":"Origin"}}
function b64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
const enc=s=>b64(new TextEncoder().encode(s));
async function sign(payload,secret){const h=enc(JSON.stringify({alg:"HS256",typ:"JWT"})),p=enc(JSON.stringify(payload)),input=h+"."+p,key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]),sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(input));return input+"."+b64(new Uint8Array(sig))}
function decode(s){return atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4))}
async function verifySession(token,secret){try{const parts=token.split(".");if(parts.length!==3)return null;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]),sig=Uint8Array.from(decode(parts[2]),c=>c.charCodeAt(0));if(!await crypto.subtle.verify("HMAC",key,sig,new TextEncoder().encode(parts[0]+"."+parts[1])))return null;const payload=JSON.parse(decode(parts[1]));return payload.exp>Date.now()/1000?payload:null}catch{return null}}
async function challenge(request,env){
 let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid JSON body"},400)}
 if(typeof body.address!=="string"||!isAddress(body.address))return json({ok:false,error:"A valid wallet address is required"},400);
 const wallet=getAddress(body.address),nonce=crypto.randomUUID().replace(/-/g,""),now=Math.floor(Date.now()/1000),expiresAt=now+NONCE_TTL,origin=request.headers.get("Origin")||env.FRONTEND_ORIGIN;
 const message=["Fly Infinity Hokm wants you to sign in with your BNB Smart Chain wallet:",wallet,"","Sign in to Hokm Fly Infinity. This free signature does not authorize a token transfer.","","URI: "+origin,"Chain ID: "+CHAIN_ID,"Nonce: "+nonce,"Issued At: "+new Date(now*1000).toISOString(),"Expiration Time: "+new Date(expiresAt*1000).toISOString()].join("\n");
 await env.DB.prepare("INSERT INTO wallet_nonces (nonce,wallet_address,message,expires_at,used,created_at) VALUES (?,?,?, ?,0,?)").bind(nonce,wallet.toLowerCase(),message,expiresAt,now).run();
 return json({ok:true,address:wallet,chainId:CHAIN_ID,nonce,message,expiresAt});
}
async function verify(request,env){
 let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid JSON body"},400)}
 if(typeof body.address!=="string"||!isAddress(body.address)||typeof body.nonce!=="string"||typeof body.signature!=="string")return json({ok:false,error:"Address, nonce and signature are required"},400);
 const wallet=getAddress(body.address),now=Math.floor(Date.now()/1000),row=await env.DB.prepare("SELECT message,expires_at,used FROM wallet_nonces WHERE nonce=? AND wallet_address=?").bind(body.nonce,wallet.toLowerCase()).first();
 if(!row||row.used!==0||row.expires_at<=now)return json({ok:false,error:"Nonce is invalid, expired or already used"},401);
 let recovered;try{recovered=getAddress(verifyMessage(row.message,body.signature))}catch{return json({ok:false,error:"Wallet signature is invalid"},401)}
 if(recovered!==wallet)return json({ok:false,error:"Signature does not match wallet"},401);
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return json({ok:false,error:"Hokm session signing is not configured"},503);
 let balance;try{balance=await getFitBalance(env,wallet)}catch{return json({ok:false,error:"BSC RPC is temporarily unavailable. Please retry shortly."},503,{"retry-after":"5"})}
 const consumed=await env.DB.prepare("UPDATE wallet_nonces SET used=1 WHERE nonce=? AND wallet_address=? AND used=0 AND expires_at>?").bind(body.nonce,wallet.toLowerCase(),Math.floor(Date.now()/1000)).run();
 if(!consumed.meta||consumed.meta.changes!==1)return json({ok:false,error:"Challenge already used. Request a new one."},409);
 if(balance<MIN_FIT)return json({ok:false,error:"At least 1 FIT is required to enter Hokm.",balanceWei:balance.toString(),minimumWei:MIN_FIT.toString()},403);
 const tier=balance>=TIER2_FIT?2:1,issued=Math.floor(Date.now()/1000),token=await sign({sub:wallet,chainId:CHAIN_ID,tier,iat:issued,exp:issued+SESSION_TTL},env.SESSION_SECRET);
 return json({ok:true,wallet,chainId:CHAIN_ID,tier,fitBalanceWei:balance.toString(),sessionToken:token,expiresAt:issued+SESSION_TTL});
}
async function session(request,env){
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return json({ok:false,error:"Hokm session signing is not configured"},503);
 const auth=request.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"",claims=await verifySession(token,env.SESSION_SECRET);
 if(!claims||!isAddress(claims.sub)||claims.chainId!==CHAIN_ID)return json({ok:false,error:"Session is invalid or expired"},401);
 let balance;try{balance=await getFitBalance(env,getAddress(claims.sub))}catch{return json({ok:false,error:"BSC RPC is temporarily unavailable"},503,{"retry-after":"5"})}
 if(balance<MIN_FIT)return json({ok:false,error:"At least 1 FIT is required. Access revoked.",balanceWei:balance.toString()},403);
 const tier=balance>=TIER2_FIT?2:1;
 return json({ok:true,wallet:getAddress(claims.sub),chainId:CHAIN_ID,tier,fitBalanceWei:balance.toString(),expiresAt:claims.exp});
}
async function verifiedPlayer(request,env){
 const auth=request.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"",claims=await verifySession(token,env.SESSION_SECRET||"");
 if(!claims||!isAddress(claims.sub)||claims.chainId!==CHAIN_ID)return json({ok:false,error:"Session is invalid or expired"},401);
 let balance;try{balance=await getFitBalance(env,getAddress(claims.sub))}catch{return json({ok:false,error:"BSC RPC is temporarily unavailable"},503,{"retry-after":"5"})}
 if(balance<MIN_FIT)return json({ok:false,error:"At least 1 FIT is required. Access revoked."},403);
 return {wallet:getAddress(claims.sub).toLowerCase(),tier:balance>=TIER2_FIT?2:1};
}
function makeRoomCode(){
 const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",bytes=crypto.getRandomValues(new Uint8Array(6));
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
}
function withHeaders(response,headers){const h=new Headers(response.headers);for(const[k,v]of Object.entries(headers))h.set(k,v);return new Response(response.body,{status:response.status,headers:h})}
export default {
 async scheduled(_controller,env,ctx){ctx.waitUntil(cleanupExpiredRecords(env).catch(error=>console.error("Hokm cleanup failed",error)))},
 async fetch(request,env){
  const headers=cors(request,env),origin=request.headers.get("Origin"),url=new URL(request.url),path=url.pathname;
  if(request.method==="OPTIONS")return headers["access-control-allow-origin"]?new Response(null,{status:204,headers}):new Response(null,{status:403});
  if(origin&&!origins(env).has(origin))return json({ok:false,error:"Origin not allowed"},403);
  if(request.method==="GET"&&path==="/api/health")return json({ok:true,service:"Fly Hokm API",version:"0.1.0"},200,headers);
  const configs={"POST /api/auth/challenge":["auth-challenge",20,600],"POST /api/auth/verify":["auth-verify",30,600],"GET /api/auth/session":["auth-session",60,60]};
  const dynamicTicket=request.method==="POST"&&/^\/api\/rooms\/[A-HJ-NP-Z2-9]{6}\/ticket$/.test(path);
  const config=configs[request.method+" "+path]||(request.method==="POST"&&path==="/api/rooms"?["room-create",20,600]:dynamicTicket?["room-ticket",80,60]:null);
  if(config){try{const limit=await enforceRateLimit(request,env,...config);if(!limit.allowed)return json({ok:false,error:"Too many requests. Please wait and retry."},429,{"retry-after":String(limit.retryAfter),...headers})}catch{return json({ok:false,error:"Security service temporarily unavailable"},503,{"retry-after":"5",...headers})}}
  try{
   if(request.method==="POST"&&path==="/api/auth/challenge")return withHeaders(await challenge(request,env),headers);
   if(request.method==="POST"&&path==="/api/auth/verify")return withHeaders(await verify(request,env),headers);
   if(request.method==="GET"&&path==="/api/auth/session")return withHeaders(await session(request,env),headers);
   if(request.method==="POST"&&path==="/api/rooms"){
    const player=await verifiedPlayer(request,env);if(player instanceof Response)return withHeaders(player,headers);
    let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid JSON body"},400,headers)}
    const action=body.action==="join"?"join":body.action==="create"?"create":null;
    if(!action)return json({ok:false,error:"Action must be create or join"},400,headers);
    const code=action==="create"?makeRoomCode():String(body.code||"").toUpperCase();
    if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return json({ok:false,error:"Invalid room code"},400,headers);
    const id=env.HOKM_ROOMS.idFromName(code),stub=env.HOKM_ROOMS.get(id);
    const response=await stub.fetch("https://hokm-room.internal/"+action+"?code="+code,{method:"POST",headers:{"x-player-wallet":player.wallet,"x-player-tier":String(player.tier)}});
    return withHeaders(response,headers);
   }
   const ticketMatch=path.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/ticket$/);
   if(request.method==="POST"&&ticketMatch){
    const player=await verifiedPlayer(request,env);if(player instanceof Response)return withHeaders(player,headers);
    const stub=env.HOKM_ROOMS.get(env.HOKM_ROOMS.idFromName(ticketMatch[1]));
    const response=await stub.fetch("https://hokm-room.internal/ticket",{method:"POST",headers:{"x-player-wallet":player.wallet}});
    return withHeaders(response,headers);
   }
   const wsMatch=path.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/ws$/);
   if(request.method==="GET"&&wsMatch){
    if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({ok:false,error:"WebSocket upgrade required"},426,headers);
    const ticket=url.searchParams.get("ticket")||"";
    if(!ticket||ticket.length>128)return json({ok:false,error:"A one-time connection ticket is required"},401,headers);
    const stub=env.HOKM_ROOMS.get(env.HOKM_ROOMS.idFromName(wsMatch[1]));
    return await stub.fetch(request);
   }
   return json({ok:false,error:"Not found"},404,headers);
  }catch(error){return json({ok:false,error:error.message||"Request failed"},500,headers)}
 }
};
