import { ethers } from 'ethers';
import { buildChallengeMessage, verifyWalletSignature, createOpaqueSessionToken, hashSessionToken } from './auth.js';

const ABI_NETWORK = ['function Owner_Exists(address owner) view returns (bool)'];
const ABI_FIT = ['function balanceOf(address account) view returns (uint256)'];
const DEFAULT_APP_ORIGIN = 'https://flyinfinitydao.github.io';
const now = () => Math.floor(Date.now() / 1000);
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
});

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.APP_ORIGIN || DEFAULT_APP_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Expose-Headers': 'X-Audio-Model,X-Audio-Quota-Remaining,X-Audio-Characters-Remaining',
    'Vary': 'Origin'
  };
}

function normalizeAddress(value) {
  if (typeof value !== 'string' || !ethers.isAddress(value)) throw new Error('Invalid wallet address');
  return ethers.getAddress(value);
}

function rpcProvider(env) {
  return new ethers.JsonRpcProvider(env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/', 56, { staticNetwork: true });
}

async function entitlement(address, env) {
  const rpc = rpcProvider(env);
  const network = new ethers.Contract(env.NETWORK_ADDRESS, ABI_NETWORK, rpc);
  const fit = new ethers.Contract(env.FIT_TOKEN_ADDRESS, ABI_FIT, rpc);
  const [owner, balanceRaw] = await Promise.all([network.Owner_Exists(address), fit.balanceOf(address)]);
  const balance = ethers.formatUnits(balanceRaw, 18);
  if (!owner) return { owner: false, balance, tier: 0 };
  const tier2 = ethers.parseUnits(env.MIN_TIER2_FIT || '1', 18);
  const tier3 = ethers.parseUnits(env.MIN_TIER3_FIT || '10', 18);
  return { owner: true, balance, tier: balanceRaw >= tier3 ? 3 : balanceRaw >= tier2 ? 2 : 1 };
}

async function readJson(req) {
  try { return await req.json(); } catch { throw new Error('Request body must be valid JSON'); }
}

async function issueChallenge(req, env) {
  const body = await readJson(req);
  let address;
  try { address = normalizeAddress(body?.address); } catch (error) { return json({ error: error.message }, 400); }
  await env.DB.prepare('DELETE FROM audio_auth_nonces WHERE expires_at<?').bind(now()).run();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM audio_auth_nonces WHERE address=? AND created_at>?').bind(address, now() - 300).first();
  if (Number(recent?.n || 0) >= 10) return json({ error: 'Too many audio sign-in attempts. Please wait five minutes.' }, 429);

  const issuedAt = new Date().toISOString(), expires = now() + 300, nonce = crypto.randomUUID().replace(/-/g, '');
  const message = buildChallengeMessage({
    origin: env.APP_ORIGIN || DEFAULT_APP_ORIGIN, address, nonce, issuedAt,
    expiresAt: new Date(expires * 1000).toISOString()
  });
  await env.DB.prepare('INSERT INTO audio_auth_nonces(nonce,address,message,created_at,expires_at,consumed_at) VALUES(?,?,?,?,?,NULL)')
    .bind(nonce, address, message, now(), expires).run();
  return json({ address, nonce, message, expiresAt: expires, expiresIn: 300 });
}

async function verifyChallenge(req, env) {
  const body = await readJson(req);
  let address;
  try { address = normalizeAddress(body?.address); } catch (error) { return json({ error: error.message }, 400); }
  if (typeof body?.nonce !== 'string' || typeof body?.signature !== 'string') return json({ error: 'Nonce and wallet signature are required' }, 400);
  const row = await env.DB.prepare('SELECT nonce,message,expires_at,consumed_at FROM audio_auth_nonces WHERE nonce=? AND address=?')
    .bind(body.nonce, address).first();
  if (!row || row.consumed_at !== null || Number(row.expires_at) <= now()) return json({ error: 'Audio Studio sign-in challenge expired or was already used' }, 401);
  if (!verifyWalletSignature({ address, message: row.message, signature: body.signature })) return json({ error: 'Wallet signature does not match the requested address' }, 401);

  const used = await env.DB.prepare('UPDATE audio_auth_nonces SET consumed_at=? WHERE nonce=? AND address=? AND consumed_at IS NULL AND expires_at>?')
    .bind(now(), body.nonce, address, now()).run();
  if (Number(used.meta?.changes || 0) !== 1) return json({ error: 'Audio Studio sign-in challenge expired or was already used' }, 401);

  const access = await entitlement(address, env);
  if (!access.owner) return json({ error: 'This wallet is not a registered Fly Infinity Network Owner' }, 403);
  await env.DB.prepare('DELETE FROM audio_sessions WHERE expires_at<?').bind(now()).run();
  const token = createOpaqueSessionToken(), tokenHash = await hashSessionToken(token), expires = now() + 1800;
  await env.DB.prepare('INSERT INTO audio_sessions(token_hash,address,created_at,expires_at) VALUES(?,?,?,?)')
    .bind(tokenHash, address, now(), expires).run();
  return json({ token, address, tier: access.tier, balance: access.balance, expiresAt: expires, expiresIn: 1800 });
}

async function requireSession(req, env) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length > 256) return { error: 'Audio Studio wallet session is required', status: 401 };
  const tokenHash = await hashSessionToken(token);
  const row = await env.DB.prepare('SELECT address,expires_at FROM audio_sessions WHERE token_hash=? AND expires_at>?').bind(tokenHash, now()).first();
  if (!row) return { error: 'Audio Studio wallet session expired. Please sign in again.', status: 401 };
  const address = normalizeAddress(row.address), access = await entitlement(address, env);
  if (!access.owner) return { error: 'This wallet is no longer an eligible Fly Infinity Network Owner', status: 403 };
  return { address, tier: access.tier };
}

async function generateSpeech() {
  return json({ error: 'Cloud speech generation is disabled. Use browser-native speech in Fly Infinity Audio Studio.' }, 410);
}

async function generatePreviewSpeech() {
  return json({ error: 'Cloud speech preview is disabled to keep Audio Studio fully free.' }, 410);
}

async function route(req, env) {
  const url = new URL(req.url), origin = req.headers.get('Origin'), allowedOrigin = env.APP_ORIGIN || DEFAULT_APP_ORIGIN;
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (url.pathname === '/api/health' && req.method === 'GET') return json({ ok: true, service: 'Fly Infinity Audio API', version: '1.0.0' });
  if (url.pathname === '/api/auth/challenge' && req.method === 'POST') return issueChallenge(req, env);
  if (url.pathname === '/api/auth/verify' && req.method === 'POST') return verifyChallenge(req, env);
  if (url.pathname === '/api/audio/tts' && req.method === 'POST') return generateSpeech(req, env);
  if (url.pathname === '/api/audio/preview' && req.method === 'POST') return generatePreviewSpeech(req, env);
  if (url.pathname === '/api/audio/music' && req.method === 'POST') return json({ error: 'AI music generation is disabled until a paid provider is explicitly approved. Use the built-in free music composer.' }, 402);
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(req, env) {
    const headers = corsHeaders(env);
    try {
      const response = await route(req, env), output = new Response(response.body, response);
      for (const [key, value] of Object.entries(headers)) output.headers.set(key, value);
      return output;
    } catch (error) {
      console.error('Fly Infinity Audio API:', error?.message || error);
      const message = String(error?.message || error || 'Internal error');
      const status = /invalid wallet address|valid JSON|characters/i.test(message) ? 400 :
        /quota reached|capacity reached|too many audio sign-in/i.test(message) ? 429 :
        /not configured/i.test(message) ? 503 :
        /RPC|network|timeout|fetch failed/i.test(message) ? 503 : 500;
      return json({ error: status === 500 ? 'Audio service temporarily unavailable' : message }, status, headers);
    }
  }
};
