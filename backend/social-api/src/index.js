import { ethers } from 'ethers';
import { getMediaStorage } from './storage.js';
import {
  buildChallengeMessage, buildPasswordRecoveryMessage,
  createOpaqueSessionToken, createPasswordSalt, hashPassword,
  hashValue, hashSessionToken, normalizeAddress,
  verifyWalletSignature, constantTimeEqual
} from './auth.js';
import {
  allowedMediaType, hasValidMediaSignature,
  parseAccountInput, parsePasswordInput, parsePostInput,
  normalizeHandle, safeFileExtension
} from './validation.js';

const DEFAULT_ORIGIN = 'https://flyinfinitydao.github.io';
const CHAIN_ID = 56;
const PASSWORD_ITERATIONS = 310000;
const now = () => Math.floor(Date.now() / 1000);
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
});
const asBool = value => Number(value || 0) > 0;

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.APP_ORIGIN || DEFAULT_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Expose-Headers': 'Content-Length,ETag',
    'Vary': 'Origin'
  };
}

function validateOrigin(request, env) {
  const origin = request.headers.get('Origin');
  return !origin || origin === (env.APP_ORIGIN || DEFAULT_ORIGIN);
}

async function readJson(request, maxBytes = 24000) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > maxBytes) throw new Error('Request body is too large');
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > maxBytes) throw new Error('Request body is too large');
  try { return JSON.parse(bodyText || '{}'); }
  catch { throw new Error('Request body must be valid JSON'); }
}

function getProvider(env) {
  return new ethers.JsonRpcProvider(
    env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
    CHAIN_ID,
    { staticNetwork: true }
  );
}

async function isNetworkOwner(address, env) {
  const provider = getProvider(env);
  try {
    const contract = new ethers.Contract(
      env.NETWORK_ADDRESS || '0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B',
      ['function Owner_Exists(address owner) view returns (bool)'],
      provider
    );
    return Boolean(await contract.Owner_Exists(ethers.getAddress(address)));
  } finally {
    try { provider.destroy(); } catch {}
  }
}

async function rateLimit(db, key, limit, windowSeconds) {
  const windowStart = Math.floor(now() / windowSeconds) * windowSeconds;
  const row = await db.prepare(
    'INSERT INTO social_rate_limits(rate_key,window_start,hits) VALUES(?,?,1) ' +
    'ON CONFLICT(rate_key,window_start) DO UPDATE SET hits=hits+1 RETURNING hits'
  ).bind(key, windowStart).first();
  return Number(row?.hits || 0) <= limit;
}

async function createChallenge(request, env) {
  const body = await readJson(request);
  let address;
  try { address = normalizeAddress(body.address); }
  catch (error) { return json({ error: error.message }, 400); }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashValue(ip + ':' + new Date().toISOString().slice(0, 10));
  if (!await rateLimit(env.DB, 'challenge-ip:' + ipHash, 20, 300) ||
      !await rateLimit(env.DB, 'challenge-wallet:' + address, 8, 300)) {
    return json({ error: 'Too many sign-in attempts. Please wait a few minutes.' }, 429);
  }
  const timestamp = now();
  await env.DB.prepare('DELETE FROM social_auth_nonces WHERE expires_at < ?').bind(timestamp).run();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = timestamp + 300;
  const message = buildChallengeMessage({
    origin: env.APP_ORIGIN || DEFAULT_ORIGIN,
    address,
    nonce,
    issuedAt: new Date(timestamp * 1000).toISOString(),
    expiresAt: new Date(expiresAt * 1000).toISOString()
  });
  await env.DB.prepare(
    'INSERT INTO social_auth_nonces(nonce,wallet_address,message,ip_hash,created_at,expires_at,consumed_at) ' +
    'VALUES(?,?,?,?,?,?,NULL)'
  ).bind(nonce, address, message, ipHash, timestamp, expiresAt).run();
  return json({ address: ethers.getAddress(address), chainId: CHAIN_ID, nonce, message, expiresAt, expiresIn: 300 });
}

async function getProfileByWallet(db, address) {
  return db.prepare(
    'SELECT p.wallet_address,p.handle,p.display_name,p.bio,p.language,p.created_at,' +
    'CASE WHEN p.password_hash IS NOT NULL AND p.password_salt IS NOT NULL THEN 1 ELSE 0 END AS password_set ' +
    'FROM social_profiles p WHERE p.wallet_address=?'
  ).bind(address).first();
}

async function createSession(db, address, passwordVerified) {
  const timestamp = now();
  await db.prepare('DELETE FROM social_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL').bind(timestamp).run();
  const token = createOpaqueSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = timestamp + 604800;
  await db.prepare(
    'INSERT INTO social_sessions(token_hash,wallet_address,created_at,expires_at,revoked_at,password_verified) ' +
    'VALUES(?,?,?,?,NULL,?)'
  ).bind(tokenHash, address, timestamp, expiresAt, passwordVerified ? 1 : 0).run();
  return { token, expiresAt, expiresIn: expiresAt - timestamp, tokenHash };
}

async function verifyChallenge(request, env) {
  const body = await readJson(request);
  let address;
  try { address = normalizeAddress(body.address); }
  catch (error) { return json({ error: error.message }, 400); }
  if (typeof body.nonce !== 'string' || typeof body.signature !== 'string' ||
      body.nonce.length > 80 || body.signature.length > 600) {
    return json({ error: 'A valid nonce and wallet signature are required' }, 400);
  }
  const timestamp = now();
  const row = await env.DB.prepare(
    'SELECT nonce,message,expires_at,consumed_at FROM social_auth_nonces WHERE nonce=? AND wallet_address=?'
  ).bind(body.nonce, address).first();
  if (!row || row.consumed_at !== null || Number(row.expires_at) <= timestamp) {
    return json({ error: 'Sign-in challenge expired or was already used' }, 401);
  }
  if (!verifyWalletSignature({ address, message: row.message, signature: body.signature })) {
    return json({ error: 'Wallet signature does not match the requested address' }, 401);
  }
  const consumed = await env.DB.prepare(
    'UPDATE social_auth_nonces SET consumed_at=? WHERE nonce=? AND wallet_address=? AND consumed_at IS NULL AND expires_at>?'
  ).bind(timestamp, body.nonce, address, timestamp).run();
  if (Number(consumed.meta?.changes || 0) !== 1) {
    return json({ error: 'Sign-in challenge expired or was already used' }, 401);
  }
  let owner = false;
  try { owner = await isNetworkOwner(address, env); }
  catch (error) {
    console.error('Social owner verification unavailable:', String(error?.message || error).slice(0, 180));
    return json({ error: 'BNB Smart Chain verification is temporarily unavailable. Please try again.' }, 503);
  }
  if (!owner) return json({ error: 'This wallet is not a registered Fly Infinity Network Owner' }, 403);

  const session = await createSession(env.DB, address, false);
  const profile = await getProfileByWallet(env.DB, address);
  return json({
    token: session.token,
    wallet: ethers.getAddress(address),
    expiresAt: session.expiresAt,
    expiresIn: session.expiresIn,
    profile,
    passwordSet: asBool(profile?.password_set),
    needsProfile: !profile || !asBool(profile.password_set)
  });
}

export function extractBearerToken(authorization) {
  const match = String(authorization || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function getSession(request, env, required = false, requirePassword = true) {
  const token = extractBearerToken(request.headers.get('Authorization'));
  if (!token) return required ? { error: 'Connect your Fly Infinity wallet to continue', status: 401 } : null;
  if (token.length > 256) return { error: 'Invalid session', status: 401 };
  const tokenHash = await hashSessionToken(token);
  const row = await env.DB.prepare(
    'SELECT wallet_address,expires_at,password_verified FROM social_sessions ' +
    'WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?'
  ).bind(tokenHash, now()).first();
  if (!row) return { error: 'Your Social session has expired. Please connect your wallet again.', status: 401 };
  if (required) {
    try {
      if (!await isNetworkOwner(row.wallet_address, env)) {
        await env.DB.prepare('UPDATE social_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
          .bind(now(), tokenHash).run();
        return { error: 'This wallet is no longer a registered Fly Infinity Network Owner', status: 403 };
      }
    } catch (error) {
      console.error('Social owner revalidation unavailable:', String(error?.message || error).slice(0, 180));
      return { error: 'BNB Smart Chain verification is temporarily unavailable. Please try again.', status: 503 };
    }
    if (requirePassword && !asBool(row.password_verified)) {
      return { error: 'Enter your Social account password to continue', status: 423 };
    }
  }
  return {
    address: row.wallet_address,
    expiresAt: Number(row.expires_at),
    tokenHash,
    passwordVerified: asBool(row.password_verified)
  };
}

async function getMe(request, env) {
  const session = await getSession(request, env, true, false);
  if (session?.error) return json({ error: session.error }, session.status);
  const profile = await getProfileByWallet(env.DB, session.address);
  return json({
    wallet: ethers.getAddress(session.address),
    profile,
    passwordSet: asBool(profile?.password_set),
    passwordVerified: session.passwordVerified,
    expiresAt: session.expiresAt
  });
}

async function createProfile(request, env) {
  const session = await getSession(request, env, true, false);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'profile-create:' + session.address, 8, 3600)) {
    return json({ error: 'Too many profile setup attempts. Please try later.' }, 429);
  }
  const body = await readJson(request);
  let account;
  try { account = parseAccountInput(body); }
  catch (error) { return json({ error: error.message }, 400); }
  const current = await env.DB.prepare(
    'SELECT password_hash,password_salt FROM social_profiles WHERE wallet_address=?'
  ).bind(session.address).first();
  if (current?.password_hash && current?.password_salt) {
    return json({ error: 'This wallet already has a password. Sign in or use password recovery.' }, 409);
  }
  const salt = createPasswordSalt();
  const passwordHash = await hashPassword(account.password, salt, PASSWORD_ITERATIONS);
  const timestamp = now();
  try {
    if (current) {
      await env.DB.prepare(
        'UPDATE social_profiles SET handle=?,display_name=?,bio=\'\',language=\'en\',password_hash=?,password_salt=?,password_iterations=?,updated_at=? ' +
        'WHERE wallet_address=? AND (password_hash IS NULL OR password_salt IS NULL)'
      ).bind(account.handle, account.handle, passwordHash, salt, PASSWORD_ITERATIONS, timestamp, session.address).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO social_profiles(wallet_address,handle,display_name,bio,language,created_at,updated_at,password_hash,password_salt,password_iterations) ' +
        'VALUES(?,?,?,\'\',\'en\',?,?,?,?,?)'
      ).bind(session.address, account.handle, account.handle, timestamp, timestamp,
        passwordHash, salt, PASSWORD_ITERATIONS).run();
    }
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      return json({ error: 'That username is already taken. Please choose another one.' }, 409);
    }
    throw error;
  }
  await env.DB.prepare('UPDATE social_sessions SET password_verified=1 WHERE token_hash=? AND revoked_at IS NULL')
    .bind(session.tokenHash).run();
  return json({ profile: await getProfileByWallet(env.DB, session.address), passwordSet: true, passwordVerified: true }, 201);
}

async function checkHandle(request, env) {
  const session = await getSession(request, env, true, false);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'handle-check:' + session.address, 60, 3600)) {
    return json({ error: 'Too many username checks. Please wait.' }, 429);
  }
  const url = new URL(request.url);
  let handle;
  try { handle = normalizeHandle(url.searchParams.get('handle')); }
  catch (error) { return json({ error: error.message, available: false }, 400); }
  const existing = await env.DB.prepare(
    'SELECT wallet_address FROM social_profiles WHERE handle=? COLLATE NOCASE'
  ).bind(handle).first();
  const available = !existing || existing.wallet_address === session.address;
  return json({ handle, available });
}

async function loginWithPassword(request, env) {
  const session = await getSession(request, env, true, false);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'password-login:' + session.address, 8, 300)) {
    return json({ error: 'Too many password attempts. Please wait a few minutes.' }, 429);
  }
  const body = await readJson(request);
  let account;
  try { account = parseAccountInput(body); }
  catch (error) { return json({ error: error.message }, 400); }
  const profile = await env.DB.prepare(
    'SELECT handle,password_hash,password_salt,password_iterations FROM social_profiles WHERE wallet_address=?'
  ).bind(session.address).first();
  if (!profile || !profile.password_hash || !profile.password_salt ||
      profile.handle !== account.handle) {
    return json({ error: 'Username or password is incorrect' }, 401);
  }
  const calculated = await hashPassword(account.password, profile.password_salt,
    Number(profile.password_iterations || PASSWORD_ITERATIONS));
  if (!constantTimeEqual(calculated, profile.password_hash)) {
    return json({ error: 'Username or password is incorrect' }, 401);
  }
  await env.DB.prepare('UPDATE social_sessions SET password_verified=1 WHERE token_hash=? AND revoked_at IS NULL')
    .bind(session.tokenHash).run();
  return json({ profile: await getProfileByWallet(env.DB, session.address), passwordVerified: true });
}

async function createPasswordRecoveryChallenge(request, env) {
  const session = await getSession(request, env, true, false);
  if (session?.error) return json({ error: session.error }, session.status);
  const profile = await env.DB.prepare(
    'SELECT password_hash,password_salt FROM social_profiles WHERE wallet_address=?'
  ).bind(session.address).first();
  if (!profile?.password_hash || !profile?.password_salt) {
    return json({ error: 'This profile does not have a password to recover yet' }, 409);
  }
  if (!await rateLimit(env.DB, 'password-recovery:' + session.address, 5, 3600)) {
    return json({ error: 'Too many recovery attempts. Please try again later.' }, 429);
  }
  const timestamp = now();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = timestamp + 300;
  const message = buildPasswordRecoveryMessage({
    origin: env.APP_ORIGIN || DEFAULT_ORIGIN,
    address: session.address,
    nonce,
    issuedAt: new Date(timestamp * 1000).toISOString(),
    expiresAt: new Date(expiresAt * 1000).toISOString()
  });
  await env.DB.prepare('DELETE FROM social_password_recovery_nonces WHERE expires_at<?')
    .bind(timestamp).run();
  await env.DB.prepare(
    'INSERT INTO social_password_recovery_nonces(nonce,wallet_address,message,created_at,expires_at,consumed_at) ' +
    'VALUES(?,?,?,?,?,NULL)'
  ).bind(nonce, session.address, message, timestamp, expiresAt).run();
  return json({ nonce, message, expiresAt, expiresIn: 300 });
}

async function recoverPassword(request, env) {
  const session = await getSession(request, env, true, false);
  if (session?.error) return json({ error: session.error }, session.status);
  const body = await readJson(request);
  if (typeof body.nonce !== 'string' || typeof body.signature !== 'string' ||
      body.nonce.length > 80 || body.signature.length > 600) {
    return json({ error: 'A valid recovery signature is required' }, 400);
  }
  let password;
  try { password = parsePasswordInput(body); }
  catch (error) { return json({ error: error.message }, 400); }
  const timestamp = now();
  const nonce = await env.DB.prepare(
    'SELECT message,expires_at,consumed_at FROM social_password_recovery_nonces WHERE nonce=? AND wallet_address=?'
  ).bind(body.nonce, session.address).first();
  if (!nonce || nonce.consumed_at !== null || Number(nonce.expires_at) <= timestamp) {
    return json({ error: 'Password recovery request expired or was already used' }, 401);
  }
  if (!verifyWalletSignature({ address: session.address, message: nonce.message, signature: body.signature })) {
    return json({ error: 'Recovery signature does not match this wallet' }, 401);
  }
  const consumed = await env.DB.prepare(
    'UPDATE social_password_recovery_nonces SET consumed_at=? WHERE nonce=? AND wallet_address=? AND consumed_at IS NULL AND expires_at>?'
  ).bind(timestamp, body.nonce, session.address, timestamp).run();
  if (Number(consumed.meta?.changes || 0) !== 1) {
    return json({ error: 'Password recovery request expired or was already used' }, 401);
  }
  const salt = createPasswordSalt();
  const passwordHash = await hashPassword(password, salt, PASSWORD_ITERATIONS);
  await env.DB.prepare(
    'UPDATE social_profiles SET password_hash=?,password_salt=?,password_iterations=?,updated_at=? WHERE wallet_address=?'
  ).bind(passwordHash, salt, PASSWORD_ITERATIONS, timestamp, session.address).run();
  await env.DB.prepare('UPDATE social_sessions SET revoked_at=? WHERE wallet_address=? AND revoked_at IS NULL')
    .bind(timestamp, session.address).run();
  const newSession = await createSession(env.DB, session.address, true);
  return json({
    token: newSession.token,
    wallet: ethers.getAddress(session.address),
    expiresAt: newSession.expiresAt,
    expiresIn: newSession.expiresIn,
    profile: await getProfileByWallet(env.DB, session.address),
    passwordSet: true,
    passwordVerified: true
  });
}

async function logout(request, env) {
  const session = await getSession(request, env, true, false);
  if (session?.error) return json({ error: session.error }, session.status);
  await env.DB.prepare('UPDATE social_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
    .bind(now(), session.tokenHash).run();
  return json({ loggedOut: true });
}

function mediaUrl(request, key) {
  return new URL('/api/media/' + encodeURIComponent(key), request.url).toString();
}

function serializePost(row, request) {
  return {
    id: row.post_id,
    text: row.description || '',
    imageUrl: row.media_key ? mediaUrl(request, row.media_key) : null,
    creator: {
      wallet: ethers.getAddress(row.wallet_address),
      handle: row.handle,
      displayName: row.display_name
    },
    likes: Number(row.like_count || 0),
    likedByMe: asBool(row.liked_by_me),
    reposts: Number(row.repost_count || 0),
    repostedByMe: asBool(row.reposted_by_me),
    repostedBy: row.reposter_wallet ? {
      wallet: ethers.getAddress(row.reposter_wallet),
      handle: row.reposter_handle || ''
    } : null,
    createdAt: Number(row.event_created_at || row.created_at)
  };
}

const POST_SELECT = `
SELECT p.post_id,p.wallet_address,p.description,p.media_key,p.created_at,
       pr.handle,pr.display_name,
       (SELECT COUNT(*) FROM social_likes l WHERE l.post_id=p.post_id) AS like_count,
       CASE WHEN ? <> '' AND EXISTS(
         SELECT 1 FROM social_likes vl WHERE vl.post_id=p.post_id AND vl.wallet_address=?
       ) THEN 1 ELSE 0 END AS liked_by_me,
       (SELECT COUNT(*) FROM social_reposts r WHERE r.post_id=p.post_id) AS repost_count,
       CASE WHEN ? <> '' AND EXISTS(
         SELECT 1 FROM social_reposts vr WHERE vr.post_id=p.post_id AND vr.wallet_address=?
       ) THEN 1 ELSE 0 END AS reposted_by_me
FROM social_posts p
JOIN social_profiles pr ON pr.wallet_address=p.wallet_address
`;

async function feed(request, env) {
  const session = await getSession(request, env, true, true);
  if (session?.error) return json({ error: session.error }, session.status);
  const viewer = session.address;
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(40, Number(url.searchParams.get('limit') || 30) || 30));
  const result = await env.DB.prepare(`
    WITH feed_events AS (
      SELECT p.post_id,p.created_at AS event_created_at,'' AS reposter_wallet
      FROM social_posts p
      WHERE p.media_type='image'
      UNION ALL
      SELECT r.post_id,r.created_at AS event_created_at,r.wallet_address AS reposter_wallet
      FROM social_reposts r
    )
    SELECT p.post_id,p.wallet_address,p.description,p.media_key,p.created_at,
           e.event_created_at,e.reposter_wallet,rp.handle AS reposter_handle,
           pr.handle,pr.display_name,
           (SELECT COUNT(*) FROM social_likes l WHERE l.post_id=p.post_id) AS like_count,
           CASE WHEN ? <> '' AND EXISTS(
             SELECT 1 FROM social_likes vl WHERE vl.post_id=p.post_id AND vl.wallet_address=?
           ) THEN 1 ELSE 0 END AS liked_by_me,
           (SELECT COUNT(*) FROM social_reposts r2 WHERE r2.post_id=p.post_id) AS repost_count,
           CASE WHEN ? <> '' AND EXISTS(
             SELECT 1 FROM social_reposts vr WHERE vr.post_id=p.post_id AND vr.wallet_address=?
           ) THEN 1 ELSE 0 END AS reposted_by_me
    FROM feed_events e
    JOIN social_posts p ON p.post_id=e.post_id
    JOIN social_profiles pr ON pr.wallet_address=p.wallet_address
    LEFT JOIN social_profiles rp ON rp.wallet_address=e.reposter_wallet
    WHERE p.status='published' AND p.moderation_state='clear' AND p.media_type='image'
    ORDER BY e.event_created_at DESC,p.post_id DESC,e.reposter_wallet DESC
    LIMIT ?
  `).bind(viewer, viewer, viewer, viewer, limit).all();
  return json({ posts: (result.results || []).map(row => serializePost(row, request)) });
}

async function cleanupExpiredMedia(env, mediaStorage, timestamp = now()) {
  const stale = await env.DB.prepare(
    "SELECT media_key FROM social_media_objects WHERE state IN ('staged','removed') AND expires_at<? LIMIT 25"
  ).bind(timestamp).all();
  for (const row of stale.results || []) {
    try {
      await mediaStorage.delete(row.media_key);
      await env.DB.prepare(
        "UPDATE social_media_objects SET state='removed' WHERE media_key=? AND state IN ('staged','removed')"
      ).bind(row.media_key).run();
    } catch (error) {
      console.error('Social image cleanup failed:', String(error?.message || error).slice(0, 160));
    }
  }
}

async function uploadImage(request, env) {
  const session = await getSession(request, env, true, true);
  if (session?.error) return json({ error: session.error }, session.status);
  const mediaStorage = getMediaStorage(env);
  if (!mediaStorage) return json({ error: 'Social image storage is not configured' }, 503);
  if (!await rateLimit(env.DB, 'image:' + session.address, 30, 86400)) {
    return json({ error: 'Daily image upload limit reached. Try again tomorrow.' }, 429);
  }
  const media = allowedMediaType(request.headers.get('Content-Type'));
  if (!media) return json({ error: 'Only PNG, JPEG and WebP images are accepted' }, 415);
  const maxBytes = Number(env.MAX_IMAGE_BYTES || 15728640);
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) return json({ error: 'Image exceeds the 15 MB size limit' }, 413);
  const buffer = await request.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > maxBytes) return json({ error: 'Image is empty or exceeds the 15 MB size limit' }, 413);
  if (!hasValidMediaSignature(buffer, media.contentType)) {
    return json({ error: 'Image content does not match its declared file type' }, 415);
  }
  const extension = safeFileExtension(media.contentType);
  const key = 'uploads/' + crypto.randomUUID() + '.' + extension;
  const timestamp = now();
  try { await cleanupExpiredMedia(env, mediaStorage, timestamp); }
  catch (error) { console.error('Social cleanup check failed:', String(error?.message || error).slice(0, 160)); }
  await mediaStorage.put(key, buffer, {
    contentType: media.contentType,
    cacheControl: 'public, max-age=3600',
    metadata: { owner: session.address, mediaType: 'image' }
  });
  try {
    await env.DB.prepare(
      'INSERT INTO social_media_objects(media_key,owner_wallet,media_type,content_type,byte_size,state,created_at,expires_at,attached_post_id) ' +
      "VALUES(?,?,?,?,?,'staged',?,?,NULL)"
    ).bind(key, session.address, 'image', media.contentType, buffer.byteLength,
      timestamp, timestamp + 7200).run();
  } catch (error) {
    try { await mediaStorage.delete(key); } catch {}
    throw error;
  }
  return json({
    mediaKey: key,
    mediaType: 'image',
    contentType: media.contentType,
    size: buffer.byteLength,
    expiresAt: timestamp + 7200
  }, 201);
}

async function serveMedia(request, env, encodedKey) {
  const mediaStorage = getMediaStorage(env);
  if (!mediaStorage) return json({ error: 'Media storage is unavailable' }, 503);
  let key;
  try { key = decodeURIComponent(encodedKey); }
  catch { return json({ error: 'Invalid media key' }, 400); }
  if (!key.startsWith('uploads/') || key.includes('..') || key.length > 180) {
    return json({ error: 'Invalid media key' }, 400);
  }
  const visible = await env.DB.prepare(
    "SELECT m.content_type,m.byte_size FROM social_media_objects m JOIN social_posts p ON p.media_key=m.media_key " +
    "WHERE m.media_key=? AND m.media_type='image' AND m.state='attached' AND p.status='published' AND p.moderation_state='clear' LIMIT 1"
  ).bind(key).first();
  if (!visible) return json({ error: 'Image not found' }, 404);
  const object = await mediaStorage.get(key);
  if (!object) return json({ error: 'Image not found' }, 404);
  const headers = new Headers({
    'Content-Type': visible.content_type,
    'Content-Length': String(visible.byte_size),
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-site'
  });
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return new Response(object.body, { headers });
}

async function createPost(request, env) {
  const session = await getSession(request, env, true, true);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'post:' + session.address, 30, 86400)) {
    return json({ error: 'Daily publishing limit reached. Try again tomorrow.' }, 429);
  }
  const body = await readJson(request);
  let post;
  try { post = parsePostInput(body); }
  catch (error) { return json({ error: error.message }, 400); }
  let media = null;
  if (post.mediaKey) {
    media = await env.DB.prepare(
      "SELECT media_type FROM social_media_objects WHERE media_key=? AND owner_wallet=? AND state='staged' AND expires_at>?"
    ).bind(post.mediaKey, session.address, now()).first();
    if (!media || media.media_type !== 'image') {
      return json({ error: 'Uploaded image was not found or has expired' }, 409);
    }
  }
  const timestamp = now();
  const postId = crypto.randomUUID();
  const title = post.text.slice(0, 90) || 'Image post';
  const statements = [
    env.DB.prepare(
      'INSERT INTO social_posts(post_id,wallet_address,title,media_type,description,prompt,media_key,source_post_id,source_wallet,source_title,status,moderation_state,created_at,updated_at) ' +
      "VALUES(?,?,?,'image',?,'',?,NULL,NULL,NULL,'published','clear',?,?)"
    ).bind(postId, session.address, title, post.text, post.mediaKey, timestamp, timestamp)
  ];
  if (media) {
    statements.push(env.DB.prepare(
      "UPDATE social_media_objects SET state='attached',attached_post_id=?,expires_at=? WHERE media_key=? AND owner_wallet=? AND state='staged'"
    ).bind(postId, timestamp + 31536000, post.mediaKey, session.address));
  }
  await env.DB.batch(statements);
  const row = await env.DB.prepare(POST_SELECT +
    " WHERE p.post_id=? AND p.status='published' AND p.media_type='image'"
  ).bind(session.address, session.address, session.address, session.address, postId).first();
  return json({ post: row ? serializePost(row, request) : { id: postId } }, 201);
}

async function likePost(request, env, postId, method) {
  const session = await getSession(request, env, true, true);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'like:' + session.address, 300, 86400)) {
    return json({ error: 'Daily like limit reached' }, 429);
  }
  const post = await env.DB.prepare(
    "SELECT post_id FROM social_posts WHERE post_id=? AND status='published' AND moderation_state='clear' AND media_type='image'"
  ).bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);
  if (method === 'DELETE') {
    await env.DB.prepare('DELETE FROM social_likes WHERE post_id=? AND wallet_address=?')
      .bind(postId, session.address).run();
  } else {
    await env.DB.prepare('INSERT OR IGNORE INTO social_likes(post_id,wallet_address,created_at) VALUES(?,?,?)')
      .bind(postId, session.address, now()).run();
  }
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM social_likes WHERE post_id=?').bind(postId).first();
  return json({ liked: method !== 'DELETE', likes: Number(count?.n || 0) });
}

async function repostPost(request, env, postId, method) {
  const session = await getSession(request, env, true, true);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'repost:' + session.address, 100, 86400)) {
    return json({ error: 'Daily repost limit reached' }, 429);
  }
  const post = await env.DB.prepare(
    "SELECT post_id,wallet_address FROM social_posts WHERE post_id=? AND status='published' AND moderation_state='clear' AND media_type='image'"
  ).bind(postId).first();
  if (!post) return json({ error: 'Post not found' }, 404);
  if (post.wallet_address === session.address) return json({ error: 'You cannot repost your own post' }, 400);
  if (method === 'DELETE') {
    await env.DB.prepare('DELETE FROM social_reposts WHERE post_id=? AND wallet_address=?')
      .bind(postId, session.address).run();
  } else {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO social_reposts(repost_id,post_id,wallet_address,created_at) VALUES(?,?,?,?)'
    ).bind(crypto.randomUUID(), postId, session.address, now()).run();
  }
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM social_reposts WHERE post_id=?').bind(postId).first();
  return json({ reposted: method !== 'DELETE', reposts: Number(count?.n || 0) });
}

async function deletePost(request, env, postId) {
  const session = await getSession(request, env, true, true);
  if (session?.error) return json({ error: session.error }, session.status);
  const post = await env.DB.prepare(
    "SELECT media_key FROM social_posts WHERE post_id=? AND wallet_address=? AND status='published'"
  ).bind(postId, session.address).first();
  if (!post) return json({ error: 'Your post was not found' }, 404);
  await env.DB.prepare(
    "UPDATE social_posts SET status='deleted',updated_at=? WHERE post_id=? AND wallet_address=?"
  ).bind(now(), postId, session.address).run();
  if (post.media_key) {
    await env.DB.prepare(
      "UPDATE social_media_objects SET state='removed',expires_at=? WHERE media_key=? AND owner_wallet=?"
    ).bind(now(), post.media_key, session.address).run();
    try { await getMediaStorage(env)?.delete(post.media_key); }
    catch (error) { console.error('Social post image deletion failed:', String(error?.message || error).slice(0, 160)); }
  }
  return json({ deleted: true });
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!validateOrigin(request, env)) return json({ error: 'Origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (path === '/api/health' && request.method === 'GET') {
    return json({ ok: true, service: 'Fly Infinity Social API', version: '2.0.0' });
  }
  if (path === '/api/auth/challenge' && request.method === 'POST') return createChallenge(request, env);
  if (path === '/api/auth/verify' && request.method === 'POST') return verifyChallenge(request, env);
  if (path === '/api/auth/password' && request.method === 'POST') return loginWithPassword(request, env);
  if (path === '/api/auth/password/recovery/challenge' && request.method === 'POST') {
    return createPasswordRecoveryChallenge(request, env);
  }
  if (path === '/api/auth/password/recovery/verify' && request.method === 'POST') {
    return recoverPassword(request, env);
  }
  if (path === '/api/auth/logout' && request.method === 'POST') return logout(request, env);
  if (path === '/api/me' && request.method === 'GET') return getMe(request, env);
  if (path === '/api/profile/create' && request.method === 'POST') return createProfile(request, env);
  if (path === '/api/handles/check' && request.method === 'GET') return checkHandle(request, env);
  if (path === '/api/feed' && request.method === 'GET') return feed(request, env);
  if (path === '/api/posts' && request.method === 'POST') return createPost(request, env);
  if (path === '/api/media/upload' && request.method === 'POST') return uploadImage(request, env);
  if (path.startsWith('/api/media/') && request.method === 'GET') {
    return serveMedia(request, env, path.slice('/api/media/'.length));
  }
  const postMatch = path.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch && request.method === 'DELETE') {
    return deletePost(request, env, decodeURIComponent(postMatch[1]));
  }
  const likeMatch = path.match(/^\/api\/posts\/([^/]+)\/like$/);
  if (likeMatch && ['POST','DELETE'].includes(request.method)) {
    return likePost(request, env, decodeURIComponent(likeMatch[1]), request.method);
  }
  const repostMatch = path.match(/^\/api\/posts\/([^/]+)\/repost$/);
  if (repostMatch && ['POST','DELETE'].includes(request.method)) {
    return repostPost(request, env, decodeURIComponent(repostMatch[1]), request.method);
  }
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(env);
    try {
      const response = await route(request, env);
      const output = new Response(response.body, response);
      for (const [name, value] of Object.entries(headers)) output.headers.set(name, value);
      return output;
    } catch (error) {
      const message = String(error?.message || error || 'Internal error');
      console.error('Fly Infinity Social API:', message.slice(0, 240));
      const status = /valid JSON|valid BNB Smart Chain wallet|username|password|post text|handle/i.test(message) ? 400 :
        /too many|limit reached/i.test(message) ? 429 :
        /not configured|temporarily unavailable/i.test(message) ? 503 : 500;
      return json({ error: status === 500 ? 'Social service temporarily unavailable' : message }, status, headers);
    }
  }
};
