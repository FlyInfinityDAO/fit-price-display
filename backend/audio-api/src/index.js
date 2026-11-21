import { ethers } from 'ethers';
import { reserveAudioQuota, releaseAudioQuota } from '../../src/audio-quota.js';
import { buildChallengeMessage, verifyWalletSignature, createOpaqueSessionToken, hashSessionToken } from './auth.js';

const ABI_NETWORK = ['function Owner_Exists(address owner) view returns (bool)'];
const ABI_FIT = ['function balanceOf(address account) view returns (uint256)'];
const DEFAULT_APP_ORIGIN = 'https://flyinfinitydao.github.io';
const MODEL = '@cf/deepgram/aura-1';
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

async function generateSpeech(req, env) {
  const session = await requireSession(req, env);
  if (session.error) return json({ error: session.error }, session.status);
  if (!env.AI || typeof env.AI.run !== 'function') return json({ error: 'Workers AI binding is not configured' }, 503);
  const body = await readJson(req);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 300) return json({ error: 'Voice-over text must contain 1–300 characters' }, 400);
  if (body?.language && body.language !== 'en') return json({ error: 'The free voice model currently supports English speech only' }, 400);
  const speakers = new Set(['angus','asteria','arcas','orion','orpheus','athena','luna','zeus','perseus','helios','hera','stella']);
  const speaker = typeof body?.speaker === 'string' && speakers.has(body.speaker) ? body.speaker : 'luna';
  await env.DB.prepare("DELETE FROM audio_speech_usage WHERE day<date(?, '-90 days')").bind(new Date().toISOString().slice(0, 10)).run();
  await env.DB.prepare("DELETE FROM audio_speech_global_usage WHERE day<date(?, '-90 days')").bind(new Date().toISOString().slice(0, 10)).run();

  const quota = await reserveAudioQuota({ db: env.DB, address: session.address, tier: session.tier, characters: text.length });
  try {
    const result = await env.AI.run(MODEL, { text, speaker, encoding: 'mp3' }, { returnRawResponse: true });
    let response;
    if (result instanceof Response) response = result;
    else if (result && typeof result.getReader === 'function') response = new Response(result, { headers: { 'Content-Type': 'audio/mpeg' } });
    else if (result instanceof Uint8Array || result instanceof ArrayBuffer) response = new Response(result, { headers: { 'Content-Type': 'audio/mpeg' } });
    else throw new Error('Unexpected audio model response');
    if (!response.ok) throw new Error('Audio model request failed');
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error('The audio model returned an empty file');
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'no-store',
        'X-Audio-Model': MODEL,
        'X-Audio-Quota-Remaining': String(quota.userRemaining),
        'X-Audio-Characters-Remaining': String(quota.charactersRemaining)
      }
    });
  } catch (error) {
    try { await releaseAudioQuota({ db: env.DB, address: session.address, day: quota.day, characters: text.length }); }
    catch (refundError) { console.error('Audio quota refund failed:', refundError?.message || refundError); }
    console.error('Audio TTS failed:', error?.message || error);
    return json({ error: 'Voice generation failed; reserved quota was released.' }, 503);
  }
}


async function generatePreviewSpeech(req, env) {
  if (env.APP_ORIGIN !== 'https://raw.githack.com' || env.AUDIO_PREVIEW_ENABLED === 'false') return json({ error: 'Audio preview is disabled outside the isolated test Worker' }, 404);
  const origin = req.headers.get('Origin');
  const allowedOrigin = env.APP_ORIGIN || DEFAULT_APP_ORIGIN;
  if (!origin || origin !== allowedOrigin) return json({ error: 'Preview origin not allowed' }, 403);
  if (!env.AI || typeof env.AI.run !== 'function') return json({ error: 'Workers AI binding is not configured' }, 503);

  const body = await readJson(req);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 160) return json({ error: 'Preview text must contain 1–160 characters' }, 400);
  const today = new Date().toISOString().slice(0, 10);
  const reserved = await env.DB.prepare(
    'INSERT INTO audio_preview_usage(day,requests,characters,updated_at) VALUES(?,1,?,?) ' +
    'ON CONFLICT(day) DO UPDATE SET requests=requests+1,characters=characters+excluded.characters,updated_at=excluded.updated_at WHERE requests < 3 AND characters + excluded.characters <= 480'
  ).bind(today, text.length, now()).run();
  if (Number(reserved.meta?.changes || 0) !== 1) return json({ error: 'The no-wallet audio preview limit has been reached for today' }, 429);

  try {
    const speakers = new Set(['angus','asteria','arcas','orion','orpheus','athena','luna','zeus','perseus','helios','hera','stella']);
    const speaker = typeof body?.speaker === 'string' && speakers.has(body.speaker) ? body.speaker : 'luna';
    const response = await env.AI.run(MODEL, { text, speaker, encoding: 'mp3' }, { returnRawResponse: true });
    if (!(response instanceof Response) || !response.ok) throw new Error('Unexpected audio model response');
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error('The audio model returned an empty file');
    return new Response(bytes, {
      status: 200,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Audio-Model': MODEL }
    });
  } catch (error) {
    await env.DB.prepare(
      'UPDATE audio_preview_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,characters=CASE WHEN characters>=? THEN characters-? ELSE 0 END,updated_at=? WHERE day=?'
    ).bind(text.length, text.length, now(), today).run();
    console.error('Audio preview failed:', error?.message || error);
    return json({ error: 'Audio preview generation failed; the test quota was released.' }, 503);
  }
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
