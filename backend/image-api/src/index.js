import { ethers } from 'ethers';
import { generateImage } from '../../src/image-provider.js';
import { reserveImageQuota, releaseImageQuota } from '../../src/image-quota.js';
import { buildChallengeMessage, verifyWalletSignature, createOpaqueSessionToken, hashSessionToken } from './auth.js';
const ABI_NETWORK=['function Owner_Exists(address owner) view returns (bool)'];
const ABI_FIT=['function balanceOf(address account) view returns (uint256)'];
const DEFAULT_APP_ORIGIN='https://flyinfinitydao.github.io';
const now=()=>Math.floor(Date.now()/1000);
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
function corsHeaders(env){return {'Access-Control-Allow-Origin':env.APP_ORIGIN||DEFAULT_APP_ORIGIN,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Expose-Headers':'X-Image-Model,X-Image-Width,X-Image-Height,X-Image-Quota-Remaining,X-Image-Global-Quota-Remaining,X-Image-Seed','Vary':'Origin'}}
function normalizeAddress(value){if(typeof value!=='string'||!ethers.isAddress(value))throw new Error('Invalid wallet address');return ethers.getAddress(value)}
function rpcProvider(env){return new ethers.JsonRpcProvider(env.BSC_RPC_URL||'https://bsc-dataseed.binance.org/',56,{staticNetwork:true})}
async function entitlement(address,env){
 const rpc=rpcProvider(env),network=new ethers.Contract(env.NETWORK_ADDRESS,ABI_NETWORK,rpc),fit=new ethers.Contract(env.FIT_TOKEN_ADDRESS,ABI_FIT,rpc);
 const [owner,balanceRaw]=await Promise.all([network.Owner_Exists(address),fit.balanceOf(address)]);
 const balance=ethers.formatUnits(balanceRaw,18);if(!owner)return {owner:false,balance,tier:0};
 const one=ethers.parseUnits(env.MIN_TIER2_FIT||'1',18),ten=ethers.parseUnits(env.MIN_TIER3_FIT||'10',18);
 return {owner:true,balance,tier:balanceRaw>=ten?3:balanceRaw>=one?2:1};
}
async function readJson(req){try{return await req.json()}catch{throw new Error('Request body must be valid JSON')}}
async function challenge(req,env){
 const body=await readJson(req);let address;try{address=normalizeAddress(body?.address)}catch(e){return json({error:e.message},400)}
 const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM image_auth_nonces WHERE address=? AND created_at>?').bind(address,now()-300).first();
 if(Number(recent?.n||0)>=10)return json({error:'Too many image sign-in attempts. Please wait five minutes.'},429);
 const issuedAt=new Date().toISOString(),expires=now()+300,nonce=crypto.randomUUID().replace(/-/g,'');
 const message=buildChallengeMessage({origin:env.APP_ORIGIN||DEFAULT_APP_ORIGIN,address,nonce,issuedAt,expiresAt:new Date(expires*1000).toISOString()});
 await env.DB.prepare('INSERT INTO image_auth_nonces(nonce,address,message,created_at,expires_at,consumed_at) VALUES(?,?,?,?,?,NULL)').bind(nonce,address,message,now(),expires).run();
 return json({address,nonce,message,expiresAt:expires,expiresIn:300});
}
async function verify(req,env){
 const body=await readJson(req);let address;try{address=normalizeAddress(body?.address)}catch(e){return json({error:e.message},400)}
 if(typeof body?.nonce!=='string'||typeof body?.signature!=='string')return json({error:'Nonce and wallet signature are required'},400);
 const row=await env.DB.prepare('SELECT nonce,message,expires_at,consumed_at FROM image_auth_nonces WHERE nonce=? AND address=?').bind(body.nonce,address).first();
 if(!row||row.consumed_at!==null||Number(row.expires_at)<=now())return json({error:'Image Studio sign-in challenge expired or was already used'},401);
 if(!verifyWalletSignature({address,message:row.message,signature:body.signature}))return json({error:'Wallet signature does not match the requested address'},401);
 const used=await env.DB.prepare('UPDATE image_auth_nonces SET consumed_at=? WHERE nonce=? AND address=? AND consumed_at IS NULL AND expires_at>?').bind(now(),body.nonce,address,now()).run();
 if(Number(used.meta?.changes||0)!==1)return json({error:'Image Studio sign-in challenge expired or was already used'},401);
 const access=await entitlement(address,env);if(!access.owner)return json({error:'This wallet is not a registered Fly Infinity Network Owner'},403);
 const token=createOpaqueSessionToken(),hash=await hashSessionToken(token),expires=now()+1800;
 await env.DB.prepare('INSERT INTO image_sessions(token_hash,address,created_at,expires_at) VALUES(?,?,?,?)').bind(hash,address,now(),expires).run();
 return json({token,address,tier:access.tier,balance:access.balance,expiresAt:expires,expiresIn:1800});
}
async function requireSession(req,env){
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token||token.length>256)return {error:'Image Studio wallet session is required',status:401};
 const hash=await hashSessionToken(token),row=await env.DB.prepare('SELECT address,expires_at FROM image_sessions WHERE token_hash=? AND expires_at>?').bind(hash,now()).first();
 if(!row)return {error:'Image Studio wallet session expired. Please sign in again.',status:401};
 const address=normalizeAddress(row.address),access=await entitlement(address,env);
 if(!access.owner)return {error:'This wallet is no longer an eligible Fly Infinity Network Owner',status:403};
 return {address,tier:access.tier,balance:access.balance};
}
async function generate(req,env){
 const session=await requireSession(req,env);if(session.error)return json({error:session.error},session.status);
 if(!env.AI||typeof env.AI.run!=='function')return json({error:'Workers AI binding is not configured'},503);
 const body=await readJson(req),prompt=typeof body?.prompt==='string'?body.prompt.trim():'';
 if(prompt.length<8||prompt.length>1500)return json({error:'Prompt must contain 8–1500 characters'},400);
 if((body?.width!==undefined&&body.width!==512)||(body?.height!==undefined&&body.height!==512))return json({error:'Image output is fixed at 512×512'},400);
 const seed=body?.seed;if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>2147483647))return json({error:'Seed must be an integer between 0 and 2147483647'},400);
 const quota=await reserveImageQuota({db:env.DB,address:session.address,tier:session.tier});let image;
 try{image=await generateImage({ai:env.AI,prompt,seed})}
 catch(e){
  try{await releaseImageQuota({db:env.DB,address:session.address,day:quota.day})}catch(refund){console.error('Image quota refund failed:',refund?.message||refund)}
  const detail=String(e?.message||e||'Unknown provider error').replace(/[\r\n]+/g,' ').slice(0,240);
  console.error('Image model failed:',detail);return json({error:'Image generation failed; reserved quota was released.',detail},503);
 }
 return new Response(image.bytes,{status:200,headers:{
  'Content-Type':image.contentType,'Cache-Control':'no-store','X-Image-Model':image.model,'X-Image-Width':'512','X-Image-Height':'512',
  'X-Image-Quota-Remaining':String(quota.userRemaining),'X-Image-Global-Quota-Remaining':String(quota.globalRemaining),
  ...(image.seed!==null?{'X-Image-Seed':String(image.seed)}:{})
 }});
}
async function route(req,env){
 const url=new URL(req.url),origin=req.headers.get('Origin'),allowed=env.APP_ORIGIN||DEFAULT_APP_ORIGIN;
 if(origin&&origin!==allowed)return json({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204});
 if(url.pathname==='/api/health'&&req.method==='GET')return json({ok:true,service:'Fly Infinity Image API',version:'1.0.0'});
 if(url.pathname==='/api/auth/challenge'&&req.method==='POST')return challenge(req,env);
 if(url.pathname==='/api/auth/verify'&&req.method==='POST')return verify(req,env);
 if(url.pathname==='/api/image/generate'&&req.method==='POST')return generate(req,env);
 return json({error:'Not found'},404);
}
export default {
 async fetch(req,env){
  const headers=corsHeaders(env);
  try{const response=await route(req,env),out=new Response(response.body,response);for(const [k,v] of Object.entries(headers))out.headers.set(k,v);return out}
  catch(e){
   console.error('Fly Infinity Image API:',e?.message||e);const message=String(e?.message||e||'Internal error');
   const status=/invalid wallet address|valid JSON/i.test(message)?400:/quota reached|too many image sign-in/i.test(message)?429:/not configured/i.test(message)?503:/RPC|network|timeout|fetch failed/i.test(message)?503:500;
   return json({error:status===500?'Image service temporarily unavailable':message},status,headers);
  }
 },
 async scheduled(event,env){
  const today=new Date().toISOString().slice(0,10),cutoff=now();
  await Promise.all([
   env.DB.prepare('DELETE FROM image_auth_nonces WHERE expires_at<?').bind(cutoff).run(),
   env.DB.prepare('DELETE FROM image_sessions WHERE expires_at<?').bind(cutoff).run(),
   env.DB.prepare("DELETE FROM image_generation_usage WHERE day<date(?, '-90 days')").bind(today).run(),
   env.DB.prepare("DELETE FROM image_generation_daily_usage WHERE day<date(?, '-90 days')").bind(today).run()
  ]);
 }
};
