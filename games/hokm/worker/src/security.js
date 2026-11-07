const encoder=new TextEncoder();
const rateLimitTablePromises=new WeakMap();
async function ensureRateLimitTable(env){
 const db=env.DB;
 if(!rateLimitTablePromises.has(db)){
  const pending=db.prepare("CREATE TABLE IF NOT EXISTS api_rate_limits (bucket_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL)").run().catch(error=>{rateLimitTablePromises.delete(db);throw error});
  rateLimitTablePromises.set(db,pending);
 }
 return rateLimitTablePromises.get(db);
}
function toHex(bytes){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")}
export async function enforceRateLimit(request,env,bucket,limit,windowSeconds,now=Math.floor(Date.now()/1000)){
 await ensureRateLimitTable(env);
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw new Error("Rate-limit signing secret is not configured");
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 const keyObj=await crypto.subtle.importKey("raw",encoder.encode(env.SESSION_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=await crypto.subtle.sign("HMAC",keyObj,encoder.encode(ip));
 const key=bucket+":"+toHex(digest),windowStart=Math.floor(now/windowSeconds)*windowSeconds;
 const row=await env.DB.prepare("INSERT INTO api_rate_limits (bucket_key,window_start,hits,expires_at) VALUES (?,?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET hits=CASE WHEN api_rate_limits.window_start=excluded.window_start THEN api_rate_limits.hits+1 ELSE 1 END,window_start=excluded.window_start,expires_at=excluded.expires_at RETURNING hits").bind(key,windowStart,windowStart+windowSeconds*2).first();
 return {allowed:Number(row?.hits||0)<=limit,retryAfter:Math.max(1,windowStart+windowSeconds-now)};
}
export async function cleanupExpiredRecords(env,now=Math.floor(Date.now()/1000)){
 await ensureRateLimitTable(env);
 const results=await Promise.all([
  env.DB.prepare("DELETE FROM wallet_nonces WHERE rowid IN (SELECT rowid FROM wallet_nonces WHERE expires_at < ? LIMIT 1000)").bind(now-86400).run(),
  env.DB.prepare("DELETE FROM api_rate_limits WHERE rowid IN (SELECT rowid FROM api_rate_limits WHERE expires_at < ? LIMIT 1000)").bind(now).run()
 ]);
 return results.reduce((n,r)=>n+Number(r.meta?.changes||0),0);
}
export async function rpcJson(rpcUrl,payload){
 let response;try{response=await fetch(rpcUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)})}catch{throw new Error("BSC RPC is temporarily unavailable")}
 if(!response.ok)throw new Error("BSC RPC is temporarily unavailable");
 let data;try{data=await response.json()}catch{throw new Error("BSC RPC returned invalid data")}
 if(data?.error)throw new Error("BSC RPC request failed");
 return data;
}
export async function getFitBalance(env,wallet){
 const rpc=env.BSC_RPC_URL||"https://bsc-dataseed.binance.org/";
 const chain=await rpcJson(rpc,{jsonrpc:"2.0",id:1,method:"eth_chainId",params:[]});
 if(typeof chain.result!=="string"||BigInt(chain.result)!==56n)throw new Error("Configured RPC is not BNB Smart Chain");
 const address=wallet.slice(2).toLowerCase().padStart(64,"0");
 const result=await rpcJson(rpc,{jsonrpc:"2.0",id:2,method:"eth_call",params:[{to:"0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa",data:"0x70a08231"+address},"latest"]});
 if(typeof result.result!=="string"||!/^0x[0-9a-f]+$/i.test(result.result))throw new Error("FIT balance could not be verified");
 return BigInt(result.result);
}
