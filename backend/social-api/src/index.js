import { ethers } from 'ethers';
import {
  buildChallengeMessage, createOpaqueSessionToken, hashValue,
  hashSessionToken, normalizeAddress, verifyWalletSignature
} from './auth.js';
import {
  allowedMediaType, hasValidMediaSignature, makeCursor, parseCursor,
  parsePostInput, parseProfileInput, safeFileExtension
} from './validation.js';

const DEFAULT_ORIGIN = 'https://flyinfinitydao.github.io';
const CHAIN_ID = 56;
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
  const allowed = env.APP_ORIGIN || DEFAULT_ORIGIN;
  return !origin || origin === allowed;
}

async function readJson(request, maxBytes = 24_000) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > maxBytes) throw new Error('Request body is too large');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('Request body is too large');
  try { return JSON.parse(text || '{}'); }
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
  const issuedAt = new Date(timestamp * 1000).toISOString();
  const expiresAt = timestamp + 300;
  const origin = env.APP_ORIGIN || DEFAULT_ORIGIN;
  const message = buildChallengeMessage({
    origin, address, nonce, issuedAt,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  });
  await env.DB.prepare(
    'INSERT INTO social_auth_nonces(nonce,wallet_address,message,ip_hash,created_at,expires_at,consumed_at) ' +
    'VALUES(?,?,?,?,?,?,NULL)'
  ).bind(nonce, address, message, ipHash, timestamp, expiresAt).run();
  return json({ address: ethers.getAddress(address), chainId: CHAIN_ID, nonce, message, expiresAt, expiresIn: 300 });
}

async function ensureProfile(db, address) {
  const stamp = now();
  const suffix = address.slice(-10);
  const handle = 'creator_' + suffix;
  const displayName = 'Creator ' + address.slice(0, 6) + '…' + address.slice(-4);
  await db.prepare(
    'INSERT OR IGNORE INTO social_profiles(wallet_address,handle,display_name,bio,language,created_at,updated_at) ' +
    'VALUES(?,?,?,?,?,?,?)'
  ).bind(address, handle, displayName, '', 'en', stamp, stamp).run();
}

async function verifyChallenge(request, env) {
  const body = await readJson(request);
  let address;
  try { address = normalizeAddress(body.address); }
  catch (error) { return json({ error: error.message }, 400); }
  if (typeof body.nonce !== 'string' || typeof body.signature !== 'string') {
    return json({ error: 'A nonce and wallet signature are required' }, 400);
  }
  if (body.nonce.length > 80 || body.signature.length > 600) return json({ error: 'Invalid signature request' }, 400);
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

  await ensureProfile(env.DB, address);
  await env.DB.prepare('DELETE FROM social_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL').bind(timestamp).run();
  const token = createOpaqueSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = timestamp + Number(env.SESSION_TTL_SECONDS || 604800);
  await env.DB.prepare(
    'INSERT INTO social_sessions(token_hash,wallet_address,created_at,expires_at,revoked_at) VALUES(?,?,?,?,NULL)'
  ).bind(tokenHash, address, timestamp, expiresAt).run();
  const profile = await getProfileByWallet(env.DB, address);
  return json({ token, wallet: ethers.getAddress(address), expiresAt, expiresIn: expiresAt - timestamp, profile });
}

async function getSession(request, env, required = false) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return required ? { error: 'Connect your Fly Infinity wallet to continue', status: 401 } : null;
  if (token.length > 256) return { error: 'Invalid session', status: 401 };
  const tokenHash = await hashSessionToken(token);
  const row = await env.DB.prepare(
    'SELECT wallet_address,expires_at FROM social_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?'
  ).bind(tokenHash, now()).first();
  if (!row) return { error: 'Your Social session has expired. Please connect your wallet again.', status: 401 };
  return { address: row.wallet_address, expiresAt: Number(row.expires_at), tokenHash };
}

async function getProfileByWallet(db, address) {
  return db.prepare(
    'SELECT p.wallet_address,p.handle,p.display_name,p.bio,p.language,p.created_at,' +
    '(SELECT COUNT(*) FROM social_posts s WHERE s.wallet_address=p.wallet_address AND s.status=\'published\') AS post_count,' +
    '(SELECT COUNT(*) FROM social_follows f WHERE f.following_wallet=p.wallet_address) AS follower_count,' +
    '(SELECT COUNT(*) FROM social_follows f WHERE f.follower_wallet=p.wallet_address) AS following_count ' +
    'FROM social_profiles p WHERE p.wallet_address=?'
  ).bind(address).first();
}

async function getMe(request, env) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  const profile = await getProfileByWallet(env.DB, session.address);
  return json({ wallet: ethers.getAddress(session.address), profile, expiresAt: session.expiresAt });
}

async function logout(request, env) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  await env.DB.prepare('UPDATE social_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
    .bind(now(), session.tokenHash).run();
  return json({ loggedOut: true });
}

async function updateProfile(request, env) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  const body = await readJson(request);
  let profile;
  try { profile = parseProfileInput(body); }
  catch (error) { return json({ error: error.message }, 400); }
  try {
    await env.DB.prepare(
      'UPDATE social_profiles SET handle=?,display_name=?,bio=?,language=?,updated_at=? WHERE wallet_address=?'
    ).bind(profile.handle, profile.displayName, profile.bio, profile.language, now(), session.address).run();
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) return json({ error: 'That handle is already taken' }, 409);
    throw error;
  }
  return json({ profile: await getProfileByWallet(env.DB, session.address) });
}

function mediaUrl(request, key) {
  return new URL('/api/media/' + encodeURIComponent(key), request.url).toString();
}

function serializePost(row, request) {
  return {
    id: row.post_id,
    title: row.title,
    mediaType: row.media_type,
    description: row.description,
    prompt: row.prompt,
    mediaUrl: row.media_key ? mediaUrl(request, row.media_key) : null,
    creator: {
      wallet: ethers.getAddress(row.wallet_address),
      handle: row.handle,
      displayName: row.display_name
    },
    source: row.source_post_id ? {
      postId: row.source_post_id,
      wallet: row.source_wallet ? ethers.getAddress(row.source_wallet) : null,
      title: row.source_title
    } : null,
    likes: Number(row.like_count || 0),
    likedByMe: asBool(row.liked_by_me),
    createdAt: Number(row.created_at)
  };
}

const POST_SELECT = `
SELECT p.post_id,p.wallet_address,p.title,p.media_type,p.description,p.prompt,p.media_key,
       p.source_post_id,p.source_wallet,p.source_title,p.created_at,
       pr.handle,pr.display_name,
       (SELECT COUNT(*) FROM social_likes l WHERE l.post_id=p.post_id) AS like_count,
       CASE WHEN ? <> '' AND EXISTS(
         SELECT 1 FROM social_likes vl WHERE vl.post_id=p.post_id AND vl.wallet_address=?
       ) THEN 1 ELSE 0 END AS liked_by_me
FROM social_posts p
JOIN social_profiles pr ON pr.wallet_address=p.wallet_address
`;

async function feed(request, env, typeFilter = null) {
  const url = new URL(request.url);
  const session = await getSession(request, env, false);
  const viewer = session && !session.error ? session.address : '';
  const cursor = parseCursor(url.searchParams.get('cursor'));
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get('limit') || 20) || 20));
  const params = [viewer, viewer];
  let where = " WHERE p.status='published' AND p.moderation_state='clear' ";
  if (typeFilter) { where += ' AND p.media_type=? '; params.push(typeFilter); }
  if (url.searchParams.has('type')) {
    const type = url.searchParams.get('type');
    if (!['image','audio','prompt'].includes(type)) return json({ error: 'Unsupported feed filter' }, 400);
    where += ' AND p.media_type=? '; params.push(type);
  }
  if (cursor) {
    where += ' AND (p.created_at<? OR (p.created_at=? AND p.post_id<?)) ';
    params.push(cursor.createdAt, cursor.createdAt, cursor.postId);
  }
  params.push(limit + 1);
  const rows = await env.DB.prepare(POST_SELECT + where + ' ORDER BY p.created_at DESC,p.post_id DESC LIMIT ?')
    .bind(...params).all();
  const items = rows.results || [];
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  return json({
    posts: items.map(row => serializePost(row, request)),
    nextCursor: hasMore && items.length ? makeCursor(items[items.length - 1].created_at, items[items.length - 1].post_id) : null
  });
}

async function getPost(request, env, postId) {
  const session = await getSession(request, env, false);
  const viewer = session && !session.error ? session.address : '';
  const row = await env.DB.prepare(POST_SELECT +
    " WHERE p.post_id=? AND p.status='published' AND p.moderation_state='clear'"
  ).bind(viewer, viewer, postId).first();
  if (!row) return json({ error: 'Creation not found' }, 404);
  return json({ post: serializePost(row, request) });
}

async function uploadMedia(request, env) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!env.MEDIA) return json({ error: 'Social media storage is not configured' }, 503);
  if (!await rateLimit(env.DB, 'media:' + session.address, 30, 86400)) {
    return json({ error: 'Daily upload limit reached. Try again tomorrow.' }, 429);
  }
  const media = allowedMediaType(request.headers.get('Content-Type'));
  if (!media) return json({ error: 'Only PNG, JPEG, WebP images and supported audio files are accepted' }, 415);
  const maxBytes = media.mediaType === 'image'
    ? Number(env.MAX_IMAGE_BYTES || 15728640)
    : Number(env.MAX_AUDIO_BYTES || 31457280);
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > maxBytes) return json({ error: 'File exceeds the allowed size' }, 413);
  const buffer = await request.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > maxBytes) return json({ error: 'File is empty or exceeds the allowed size' }, 413);
  if (!hasValidMediaSignature(buffer, media.contentType)) return json({ error: 'File content does not match its declared media type' }, 415);
  const extension = safeFileExtension(media.contentType);
  const key = 'uploads/' + crypto.randomUUID() + '.' + extension;
  const timestamp = now();
  await env.MEDIA.put(key, buffer, {
    httpMetadata: { contentType: media.contentType, cacheControl: 'public, max-age=3600' },
    customMetadata: { owner: session.address, mediaType: media.mediaType }
  });
  try {
    await env.DB.prepare(
      'INSERT INTO social_media_objects(media_key,owner_wallet,media_type,content_type,byte_size,state,created_at,expires_at,attached_post_id) ' +
      "VALUES(?,?,?,?,?,'staged',?,?,NULL)"
    ).bind(key, session.address, media.mediaType, media.contentType, buffer.byteLength, timestamp, timestamp + 7200).run();
  } catch (error) {
    try { await env.MEDIA.delete(key); } catch {}
    throw error;
  }
  return json({ mediaKey: key, mediaType: media.mediaType, contentType: media.contentType, size: buffer.byteLength, expiresAt: timestamp + 7200 }, 201);
}

async function serveMedia(request, env, encodedKey) {
  if (!env.MEDIA) return json({ error: 'Media storage is unavailable' }, 503);
  let key;
  try { key = decodeURIComponent(encodedKey); } catch { return json({ error: 'Invalid media key' }, 400); }
  if (!key.startsWith('uploads/') || key.includes('..') || key.length > 180) return json({ error: 'Invalid media key' }, 400);
  const visible = await env.DB.prepare(
    "SELECT m.content_type,m.byte_size FROM social_media_objects m JOIN social_posts p ON p.media_key=m.media_key " +
    "WHERE m.media_key=? AND m.state='attached' AND p.status='published' AND p.moderation_state='clear' LIMIT 1"
  ).bind(key).first();
  if (!visible) return json({ error: 'Media not found' }, 404);
  const object = await env.MEDIA.get(key);
  if (!object) return json({ error: 'Media not found' }, 404);
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
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'post:' + session.address, 20, 86400)) {
    return json({ error: 'Daily publishing limit reached. Try again tomorrow.' }, 429);
  }
  const body = await readJson(request);
  let post;
  try { post = parsePostInput(body); }
  catch (error) { return json({ error: error.message }, 400); }

  let source = null;
  if (post.sourcePostId) {
    source = await env.DB.prepare(
      "SELECT post_id,wallet_address,title FROM social_posts WHERE post_id=? AND status='published' AND moderation_state='clear'"
    ).bind(post.sourcePostId).first();
    if (!source) return json({ error: 'The original creation is no longer available' }, 404);
  }

  let media = null;
  if (post.mediaKey) {
    media = await env.DB.prepare(
      "SELECT media_type FROM social_media_objects WHERE media_key=? AND owner_wallet=? AND state='staged' AND expires_at>?"
    ).bind(post.mediaKey, session.address, now()).first();
    if (!media || media.media_type !== post.mediaType) {
      return json({ error: 'Uploaded media was not found, has expired, or does not match this creation type' }, 409);
    }
  }

  let challenge = null;
  if (post.challengeId) {
    challenge = await env.DB.prepare(
      "SELECT challenge_id,media_type FROM social_challenges WHERE challenge_id=? AND status='active' AND starts_at<=? AND ends_at>?"
    ).bind(post.challengeId, now(), now()).first();
    if (!challenge) return json({ error: 'This creator challenge is not active' }, 409);
    if (challenge.media_type !== post.mediaType) return json({ error: 'Creation type does not match this challenge' }, 400);
  }

  const timestamp = now();
  const postId = crypto.randomUUID();
  const sourceWallet = source?.wallet_address || null;
  const sourceTitle = source?.title || null;
  const statements = [
    env.DB.prepare(
      'INSERT INTO social_posts(post_id,wallet_address,title,media_type,description,prompt,media_key,source_post_id,source_wallet,source_title,status,moderation_state,created_at,updated_at) ' +
      "VALUES(?,?,?,?,?,?,?,?,?,?,'published','clear',?,?)"
    ).bind(postId, session.address, post.title, post.mediaType, post.description, post.prompt,
      post.mediaKey, post.sourcePostId, sourceWallet, sourceTitle, timestamp, timestamp)
  ];
  if (media) statements.push(env.DB.prepare(
    "UPDATE social_media_objects SET state='attached',attached_post_id=?,expires_at=? WHERE media_key=? AND owner_wallet=? AND state='staged'"
  ).bind(postId, timestamp + 31536000, post.mediaKey, session.address));
  if (challenge) statements.push(env.DB.prepare(
    'INSERT INTO social_challenge_submissions(challenge_id,post_id,wallet_address,created_at) VALUES(?,?,?,?)'
  ).bind(challenge.challenge_id, postId, session.address, timestamp));
  await env.DB.batch(statements);
  const row = await env.DB.prepare(POST_SELECT +
    " WHERE p.post_id=? AND p.status='published'"
  ).bind(session.address, session.address, postId).first();
  return json({ post: row ? serializePost(row, request) : { id: postId } }, 201);
}

async function likePost(request, env, postId, method) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'like:' + session.address, 300, 86400)) return json({ error: 'Daily appreciation limit reached' }, 429);
  const post = await env.DB.prepare(
    "SELECT post_id FROM social_posts WHERE post_id=? AND status='published' AND moderation_state='clear'"
  ).bind(postId).first();
  if (!post) return json({ error: 'Creation not found' }, 404);
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

async function followCreator(request, env, targetAddress, method) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'follow:' + session.address, 100, 86400)) return json({ error: 'Daily follow limit reached' }, 429);
  let target;
  try { target = normalizeAddress(targetAddress); }
  catch { return json({ error: 'Invalid creator wallet address' }, 400); }
  if (target === session.address) return json({ error: 'You cannot follow your own creator profile' }, 400);
  const profile = await env.DB.prepare('SELECT wallet_address FROM social_profiles WHERE wallet_address=?').bind(target).first();
  if (!profile) return json({ error: 'Creator profile not found' }, 404);
  if (method === 'DELETE') {
    await env.DB.prepare('DELETE FROM social_follows WHERE follower_wallet=? AND following_wallet=?')
      .bind(session.address, target).run();
  } else {
    await env.DB.prepare('INSERT OR IGNORE INTO social_follows(follower_wallet,following_wallet,created_at) VALUES(?,?,?)')
      .bind(session.address, target, now()).run();
  }
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM social_follows WHERE following_wallet=?').bind(target).first();
  return json({ following: method !== 'DELETE', followers: Number(count?.n || 0) });
}

async function listChallenges(request, env) {
  const timestamp = now();
  const session = await getSession(request, env, false);
  const viewer = session && !session.error ? session.address : '';
  const rows = await env.DB.prepare(
    "SELECT challenge_id,media_type,title,description,starts_at,ends_at FROM social_challenges " +
    "WHERE status='active' AND starts_at<=? AND ends_at>? ORDER BY ends_at ASC"
  ).bind(timestamp, timestamp).all();
  const challenges = [];
  for (const row of rows.results || []) {
    const entries = await env.DB.prepare(
      "SELECT p.post_id,p.wallet_address,p.title,p.media_type,p.description,p.prompt,p.media_key,p.source_post_id,p.source_wallet,p.source_title,p.created_at,pr.handle,pr.display_name," +
      "(SELECT COUNT(*) FROM social_challenge_votes v WHERE v.challenge_id=? AND v.post_id=p.post_id) AS vote_count," +
      "CASE WHEN ? <> '' AND EXISTS(SELECT 1 FROM social_challenge_votes mv WHERE mv.challenge_id=? AND mv.voter_wallet=?) THEN 1 ELSE 0 END AS voted_by_me " +
      "FROM social_challenge_submissions s JOIN social_posts p ON p.post_id=s.post_id " +
      "JOIN social_profiles pr ON pr.wallet_address=p.wallet_address " +
      "WHERE s.challenge_id=? AND p.status='published' AND p.moderation_state='clear' ORDER BY vote_count DESC,p.created_at DESC LIMIT 40"
    ).bind(row.challenge_id, viewer, row.challenge_id, viewer, row.challenge_id).all();
    challenges.push({
      id: row.challenge_id, mediaType: row.media_type, title: row.title, description: row.description,
      startsAt: Number(row.starts_at), endsAt: Number(row.ends_at),
      entries: (entries.results || []).map(item => ({
        ...serializePost({ ...item, like_count: 0, liked_by_me: 0 }, request),
        votes: Number(item.vote_count || 0),
        votedByMe: asBool(item.voted_by_me)
      }))
    });
  }
  return json({ challenges });
}

async function voteChallenge(request, env, challengeId) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  const body = await readJson(request);
  const postId = String(body.postId || '');
  if (!postId || postId.length > 80) return json({ error: 'A valid challenge entry is required' }, 400);
  const challenge = await env.DB.prepare(
    "SELECT challenge_id FROM social_challenges WHERE challenge_id=? AND status='active' AND starts_at<=? AND ends_at>?"
  ).bind(challengeId, now(), now()).first();
  if (!challenge) return json({ error: 'This challenge is closed' }, 409);
  const entry = await env.DB.prepare(
    "SELECT s.post_id,s.wallet_address FROM social_challenge_submissions s JOIN social_posts p ON p.post_id=s.post_id " +
    "WHERE s.challenge_id=? AND s.post_id=? AND p.status='published' AND p.moderation_state='clear'"
  ).bind(challengeId, postId).first();
  if (!entry) return json({ error: 'Challenge entry not found' }, 404);
  if (entry.wallet_address === session.address) return json({ error: 'You cannot vote for your own challenge entry' }, 403);
  if (!await rateLimit(env.DB, 'vote:' + session.address, 50, 86400)) {
    return json({ error: 'Daily voting limit reached' }, 429);
  }
  const result = await env.DB.prepare(
    'INSERT OR IGNORE INTO social_challenge_votes(challenge_id,post_id,voter_wallet,created_at) VALUES(?,?,?,?)'
  ).bind(challengeId, postId, session.address, now()).run();
  if (Number(result.meta?.changes || 0) !== 1) return json({ error: 'You have already voted in this challenge' }, 409);
  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM social_challenge_votes WHERE challenge_id=? AND post_id=?'
  ).bind(challengeId, postId).first();
  return json({ voted: true, votes: Number(count?.n || 0) });
}

async function listCreators(request, env) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 24) || 24));
  const session = await getSession(request, env, false);
  const viewer = session && !session.error ? session.address : '';
  const rows = await env.DB.prepare(
    'SELECT p.wallet_address,p.handle,p.display_name,p.bio,p.created_at,' +
    ' (SELECT COUNT(*) FROM social_posts s WHERE s.wallet_address=p.wallet_address AND s.status=\\'published\\') AS post_count,' +
    ' (SELECT COUNT(*) FROM social_follows f WHERE f.following_wallet=p.wallet_address) AS follower_count,' +
    ' (SELECT COUNT(*) FROM social_follows f WHERE f.follower_wallet=p.wallet_address) AS following_count,' +
    ' (SELECT COUNT(*) FROM social_likes l JOIN social_posts s ON s.post_id=l.post_id WHERE s.wallet_address=p.wallet_address AND s.status=\\'published\\') AS appreciation_count,' +
    ' CASE WHEN ? <> \\'\\' AND EXISTS(SELECT 1 FROM social_follows vf WHERE vf.follower_wallet=? AND vf.following_wallet=p.wallet_address) THEN 1 ELSE 0 END AS following_by_me ' +
    'FROM social_profiles p ORDER BY follower_count DESC,appreciation_count DESC,p.created_at ASC LIMIT ?'
  ).bind(viewer, viewer, limit).all();
  return json({ creators: rows.results || [] });
}
async function getCreator(request, env, handle) {
  const profile = await env.DB.prepare(
    'SELECT p.wallet_address,p.handle,p.display_name,p.bio,p.language,p.created_at,' +
    '(SELECT COUNT(*) FROM social_posts s WHERE s.wallet_address=p.wallet_address AND s.status=\'published\') AS post_count,' +
    '(SELECT COUNT(*) FROM social_follows f WHERE f.following_wallet=p.wallet_address) AS follower_count,' +
    '(SELECT COUNT(*) FROM social_follows f WHERE f.follower_wallet=p.wallet_address) AS following_count ' +
    'FROM social_profiles p WHERE p.handle=? COLLATE NOCASE'
  ).bind(handle).first();
  if (!profile) return json({ error: 'Creator not found' }, 404);
  const session = await getSession(request, env, false);
  const viewer = session && !session.error ? session.address : '';
  const following = viewer ? await env.DB.prepare(
    'SELECT 1 AS yes FROM social_follows WHERE follower_wallet=? AND following_wallet=?'
  ).bind(viewer, profile.wallet_address).first() : null;
  return json({ creator: { ...profile, following: Boolean(following) } });
}

async function reportContent(request, env) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  if (!await rateLimit(env.DB, 'report:' + session.address, 10, 86400)) {
    return json({ error: 'Daily report limit reached' }, 429);
  }
  const body = await readJson(request);
  const targetType = String(body.targetType || '');
  const targetId = String(body.targetId || '');
  const reason = String(body.reason || '');
  const details = String(body.details || '').trim();
  if (!['post','creator'].includes(targetType) || !targetId || targetId.length > 100) {
    return json({ error: 'Invalid report target' }, 400);
  }
  if (!['copyright','harassment','spam','unsafe','impersonation','other'].includes(reason)) {
    return json({ error: 'Select a valid report reason' }, 400);
  }
  if (details.length > 400) return json({ error: 'Report details must be 400 characters or fewer' }, 400);
  let exists;
  if (targetType === 'post') {
    exists = await env.DB.prepare("SELECT 1 AS yes FROM social_posts WHERE post_id=? AND status='published'").bind(targetId).first();
  } else {
    let creatorAddress;
    try { creatorAddress = normalizeAddress(targetId); }
    catch { return json({ error: 'Invalid creator wallet address' }, 400); }
    exists = await env.DB.prepare('SELECT 1 AS yes FROM social_profiles WHERE wallet_address=?').bind(creatorAddress).first();
  }
  if (!exists) return json({ error: 'Reported content or creator was not found' }, 404);
  try {
    await env.DB.prepare(
      'INSERT INTO social_reports(report_id,reporter_wallet,target_type,target_id,reason,details,status,created_at) VALUES(?,?,?,?,?,?,\'pending\',?)'
    ).bind(crypto.randomUUID(), session.address, targetType, targetId, reason, details, now()).run();
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) return json({ error: 'You have already reported this item' }, 409);
    throw error;
  }
  return json({ reported: true }, 201);
}

async function deletePost(request, env, postId) {
  const session = await getSession(request, env, true);
  if (session?.error) return json({ error: session.error }, session.status);
  const post = await env.DB.prepare(
    'SELECT media_key FROM social_posts WHERE post_id=? AND wallet_address=? AND status=\'published\''
  ).bind(postId, session.address).first();
  if (!post) return json({ error: 'Your published creation was not found' }, 404);
  await env.DB.prepare(
    "UPDATE social_posts SET status='deleted',updated_at=? WHERE post_id=? AND wallet_address=?"
  ).bind(now(), postId, session.address).run();
  if (post.media_key) {
    await env.DB.prepare(
      "UPDATE social_media_objects SET state='removed',expires_at=? WHERE media_key=? AND owner_wallet=?"
    ).bind(now(), post.media_key, session.address).run();
    try { await env.MEDIA?.delete(post.media_key); }
    catch (error) { console.error('Social post media deletion failed:', String(error?.message || error).slice(0, 160)); }
  }
  return json({ deleted: true });
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!validateOrigin(request, env)) return json({ error: 'Origin not allowed' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (path === '/api/health' && request.method === 'GET') {
    return json({ ok: true, service: 'Fly Infinity Social API', version: '1.0.0' });
  }
  if (path === '/api/auth/challenge' && request.method === 'POST') return createChallenge(request, env);
  if (path === '/api/auth/verify' && request.method === 'POST') return verifyChallenge(request, env);
  if (path === '/api/me' && request.method === 'GET') return getMe(request, env);
  if (path === '/api/auth/logout' && request.method === 'POST') return logout(request, env);
  if (path === '/api/profile' && request.method === 'PUT') return updateProfile(request, env);
  if (path === '/api/feed' && request.method === 'GET') return feed(request, env);
  if (path === '/api/prompts' && request.method === 'GET') return feed(request, env, 'prompt');
  if (path === '/api/posts' && request.method === 'POST') return createPost(request, env);
  if (path === '/api/media/upload' && request.method === 'POST') return uploadMedia(request, env);
  if (path.startsWith('/api/media/') && request.method === 'GET') return serveMedia(request, env, path.slice('/api/media/'.length));
  if (path === '/api/challenges' && request.method === 'GET') return listChallenges(request, env);
  if (path === '/api/creators' && request.method === 'GET') return listCreators(request, env);
  if (path === '/api/reports' && request.method === 'POST') return reportContent(request, env);

  const postMatch = path.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch && request.method === 'GET') return getPost(request, env, decodeURIComponent(postMatch[1]));
  if (postMatch && request.method === 'DELETE') return deletePost(request, env, decodeURIComponent(postMatch[1]));

  const likeMatch = path.match(/^\/api\/posts\/([^/]+)\/like$/);
  if (likeMatch && ['POST','DELETE'].includes(request.method)) {
    return likePost(request, env, decodeURIComponent(likeMatch[1]), request.method);
  }
  const voteMatch = path.match(/^\/api\/challenges\/([^/]+)\/vote$/);
  if (voteMatch && request.method === 'POST') return voteChallenge(request, env, decodeURIComponent(voteMatch[1]));
  const followMatch = path.match(/^\/api\/creators\/([^/]+)\/follow$/);
  if (followMatch && ['POST','DELETE'].includes(request.method)) {
    return followCreator(request, env, decodeURIComponent(followMatch[1]), request.method);
  }
  const creatorMatch = path.match(/^\/api\/creators\/([^/]+)$/);
  if (creatorMatch && request.method === 'GET') return getCreator(request, env, decodeURIComponent(creatorMatch[1]));
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
      const status = /valid JSON|valid BNB Smart Chain wallet|invalid wallet address/i.test(message) ? 400 :
        /too many|limit reached/i.test(message) ? 429 :
        /not configured|temporarily unavailable/i.test(message) ? 503 : 500;
      return json({ error: status === 500 ? 'Social service temporarily unavailable' : message }, status, headers);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      const timestamp = now();
      const stale = await env.DB.prepare(
        "SELECT media_key FROM social_media_objects WHERE state IN ('staged','removed') AND expires_at<? LIMIT 100"
      ).bind(timestamp).all();
      for (const row of stale.results || []) {
        try { await env.MEDIA?.delete(row.media_key); } catch (error) {
          console.error('Social media cleanup failed:', String(error?.message || error).slice(0, 160));
        }
        await env.DB.prepare("UPDATE social_media_objects SET state='removed' WHERE media_key=? AND state='staged'")
          .bind(row.media_key).run();
      }
      await env.DB.batch([
        env.DB.prepare('DELETE FROM social_auth_nonces WHERE expires_at<?').bind(timestamp - 3600),
        env.DB.prepare('DELETE FROM social_sessions WHERE expires_at<? OR revoked_at IS NOT NULL').bind(timestamp),
        env.DB.prepare('DELETE FROM social_rate_limits WHERE window_start<?').bind(timestamp - 172800)
      ]);
    })());
  }
};
