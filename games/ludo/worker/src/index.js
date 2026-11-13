import { getAddress, isAddress, verifyMessage } from "ethers";
import { handleLudoApi } from "./rooms-api.js";
import { enforceRateLimit, cleanupExpiredRecords, getFitBalance } from "./security.js";

const BSC_CHAIN_ID=56;
const MIN_FIT_WEI=10n**18n;
const NONCE_TTL_SECONDS=5*60;
const SESSION_TTL_SECONDS=30*60;
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
function allowedFrontendOrigins(env){return new Set([env.FRONTEND_ORIGIN,...(env.FRONTEND_ORIGINS||"").split(",")].map(v=>(v||"").trim()).filter(Boolean));}
function corsHeaders(request,env){
  const origin=request.headers.get("Origin");if(!origin||!allowedFrontendOrigins(env).has(origin))return{};
  return{"access-control-allow-origin":origin,"access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"Content-Type, Authorization","access-control-max-age":"86400","vary":"Origin"};
}
function base64url(bytes){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function encodeText(value){return base64url(new TextEncoder().encode(value));}
async function signSession(payload,secret){
  const header=encodeText(JSON.stringify({alg:"HS256",typ:"JWT"})),body=encodeText(JSON.stringify(payload)),input=header+"."+body;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(input));
  return input+"."+base64url(new Uint8Array(signature));
}
function decodeBase64Url(value){const normalized=value.replace(/-/g,"+").replace(/_/g,"/");return atob(normalized+"=".repeat((4-normalized.length%4)%4));}
async function verifySession(token,secret){
  const parts=(token||"").split(".");if(parts.length!==3||!secret||secret.length<32)return null;
  try{
    const input=parts[0]+"."+parts[1],key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const signature=Uint8Array.from(decodeBase64Url(parts[2]),c=>c.charCodeAt(0));
    if(!await crypto.subtle.verify("HMAC",key,signature,new TextEncoder().encode(input)))return null;
    const payload=JSON.parse(decodeBase64Url(parts[1]));
    if(!payload.exp||payload.exp<=Math.floor(Date.now()/1000)||payload.chainId!==BSC_CHAIN_ID||!isAddress(payload.sub))return null;
    return payload;
  }catch{return null;}
}
async function handleChallenge(request,env){
  const body=await request.json();
  if(typeof body.address!=="string"||!isAddress(body.address))return json({ok:false,error:"A valid wallet address is required."},400);
  const wallet=getAddress(body.address),nonce=crypto.randomUUID().replace(/-/g,""),now=Math.floor(Date.now()/1000),expiresAt=now+NONCE_TTL_SECONDS;
  const origin=request.headers.get("Origin")||env.FRONTEND_ORIGIN;
  let domain;try{domain=new URL(origin).host;}catch{return json({ok:false,error:"Frontend origin is not configured."},503);}
  const message=[
    "Fly Infinity Ludo wants you to sign in with your BNB Smart Chain wallet:",
    wallet,"",
    "Sign in to Fly Infinity Ludo. This signature is free and does not authorize a token transfer.","",
    "URI: "+origin,"Chain ID: "+BSC_CHAIN_ID,"Nonce: "+nonce,
    "Issued At: "+new Date(now*1000).toISOString(),
    "Expiration Time: "+new Date(expiresAt*1000).toISOString()
  ].join("\n");
  await env.DB.prepare("INSERT INTO wallet_nonces (nonce,wallet_address,message,expires_at,used,created_at) VALUES (?,?,?,?,0,?)").bind(nonce,wallet.toLowerCase(),message,expiresAt,now).run();
  return json({ok:true,address:wallet,chainId:BSC_CHAIN_ID,nonce,message,expiresAt,domain});
}
async function handleVerify(request,env){
  const body=await request.json();
  if(typeof body.address!=="string"||!isAddress(body.address)||typeof body.nonce!=="string"||typeof body.signature!=="string")return json({ok:false,error:"Address, nonce, and signature are required."},400);
  const wallet=getAddress(body.address),now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare("SELECT message,expires_at,used FROM wallet_nonces WHERE nonce=? AND wallet_address=?").bind(body.nonce,wallet.toLowerCase()).first();
  if(!row||row.used!==0||row.expires_at<=now)return json({ok:false,error:"Nonce is invalid, expired, or already used. Request a new challenge."},401);
  let recovered;try{recovered=getAddress(verifyMessage(row.message,body.signature));}catch{return json({ok:false,error:"Wallet signature is invalid."},401);}
  if(recovered!==wallet)return json({ok:false,error:"Signature does not match the wallet address."},401);
  if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return json({ok:false,error:"Fly Infinity Ludo session signing is not configured."},503);
  let balance;try{balance=await getFitBalance(env,wallet);}catch{return json({ok:false,error:"BSC RPC is temporarily unavailable. Please retry shortly."},503,{"retry-after":"5"});}
  const consumed=await env.DB.prepare("UPDATE wallet_nonces SET used=1 WHERE nonce=? AND wallet_address=? AND used=0 AND expires_at>?").bind(body.nonce,wallet.toLowerCase(),Math.floor(Date.now()/1000)).run();
  if(!consumed.meta||consumed.meta.changes!==1)return json({ok:false,error:"Challenge has already been used. Request a new one."},409);
  if(balance<MIN_FIT_WEI)return json({ok:false,error:"At least 1 FIT is required to enter Fly Infinity Ludo.",balanceWei:balance.toString(),minimumWei:MIN_FIT_WEI.toString()},403);
  const issuedAt=Math.floor(Date.now()/1000),sessionToken=await signSession({sub:wallet,chainId:BSC_CHAIN_ID,iat:issuedAt,exp:issuedAt+SESSION_TTL_SECONDS},env.SESSION_SECRET);
  return json({ok:true,wallet,chainId:BSC_CHAIN_ID,fitBalanceWei:balance.toString(),sessionToken,expiresAt:issuedAt+SESSION_TTL_SECONDS});
}
async function handleSession(request,env){
  if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return json({ok:false,error:"Fly Infinity Ludo session signing is not configured."},503);
  const authorization=request.headers.get("Authorization")||"",token=authorization.startsWith("Bearer ")?authorization.slice(7):"",session=await verifySession(token,env.SESSION_SECRET);
  if(!session)return json({ok:false,error:"Session is invalid or expired."},401);
  let balance;try{balance=await getFitBalance(env,getAddress(session.sub));}catch{return json({ok:false,error:"BSC RPC is temporarily unavailable. Please retry shortly."},503,{"retry-after":"5"});}
  if(balance<MIN_FIT_WEI)return json({ok:false,error:"At least 1 FIT is required. Access has been revoked.",balanceWei:balance.toString()},403);
  return json({ok:true,wallet:getAddress(session.sub),fitBalanceWei:balance.toString(),expiresAt:session.exp});
}
function withHeaders(response,headers){
  const merged=new Headers(response.headers);for(const[key,value]of Object.entries(headers))merged.set(key,value);
  return new Response(response.body,{status:response.status,headers:merged});
}
export default{
  async scheduled(_controller,env,ctx){ctx.waitUntil(cleanupExpiredRecords(env).catch(error=>console.error("Ludo cleanup failed.",error)));},
  async fetch(request,env){
    const headers=corsHeaders(request,env),origin=request.headers.get("Origin");
    if(request.method==="OPTIONS")return headers["access-control-allow-origin"]?new Response(null,{status:204,headers}):new Response(null,{status:403});
    if(origin&&!allowedFrontendOrigins(env).has(origin))return json({ok:false,error:"Origin not allowed."},403);
    const path=new URL(request.url).pathname;
    let rate=null;
    if(request.method==="POST"&&path==="/api/auth/challenge")rate=["auth-challenge",20,600];
    else if(request.method==="POST"&&path==="/api/auth/verify")rate=["auth-verify",30,600];
    else if(request.method==="GET"&&path==="/api/auth/session")rate=["auth-session",60,60];
    else if(path.startsWith("/api/ludo/"))rate=["ludo-api",120,60];
    if(rate){try{const result=await enforceRateLimit(request,env,...rate);if(!result.allowed)return json({ok:false,error:"Too many requests. Please wait and try again."},429,{"retry-after":String(result.retryAfter),...headers});}catch{return json({ok:false,error:"Security service is temporarily unavailable. Please retry shortly."},503,{"retry-after":"5",...headers});}}
    if(request.method==="GET"&&path==="/api/health"){
      let databaseReady=false;
      try{const row=await env.DB.prepare("SELECT 1 AS ok").first();databaseReady=row?.ok===1;}catch{}
      const sessionConfigured=typeof env.SESSION_SECRET==="string"&&env.SESSION_SECRET.length>=32;
      const ready=databaseReady&&sessionConfigured;
      return json({ok:ready,service:"Fly Infinity Ludo API",version:"1.0.2",build:"ludo-isolated-db-session-check",database:databaseReady?"ok":"unavailable",sessionConfigured},ready?200:503,headers);
    }
    try{
      if(request.method==="POST"&&path==="/api/auth/challenge")return withHeaders(await handleChallenge(request,env),headers);
      if(request.method==="POST"&&path==="/api/auth/verify")return withHeaders(await handleVerify(request,env),headers);
      if(request.method==="GET"&&path==="/api/auth/session")return withHeaders(await handleSession(request,env),headers);
      const response=await handleLudoApi(request,env);
      if(response){if(response.status===101)return response;return withHeaders(response,headers);}
    }catch(error){return json({ok:false,error:error?.message||"Ludo API request failed."},500,headers);}
    return json({ok:false,error:"Not found."},404,headers);
  }
};
export { LudoRoom } from "./ludo-room.js";
