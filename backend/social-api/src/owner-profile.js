import { ethers } from 'ethers';
import {
  buildOwnerProfileChallengeMessage,
  createOpaqueSessionToken,
  createPasswordSalt,
  hashPassword,
  hashValue,
  hashSessionToken,
  normalizeAddress,
  verifyWalletSignature,
  constantTimeEqual
} from './auth.js';
import { normalizeHandle } from './validation.js';

const CHAIN_ID = 56;
const PASSWORD_ITERATIONS = 100000;
const SESSION_TTL = 604800;
const PROOF_TTL = 300;
const MAX_LINKED_WALLETS = 20;
const now = () => Math.floor(Date.now() / 1000);
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

async function readJson(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 24000) throw new Error('Request body is too large');
  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > 24000) throw new Error('Request body is too large');
  try { return JSON.parse(source || '{}'); }
  catch { throw new Error('Request body must be valid JSON'); }
}

function bearer(request) {
  const match = String(request.headers.get('Authorization') || '').match(/^Bearer\\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function rateLimit(db, key, limit, windowSeconds) {
  const windowStart = Math.floor(now() / windowSeconds) * windowSeconds;
  const row = await db.prepare(
    'INSERT INTO social_rate_limits(rate_key,window_start,hits) VALUES(?,?,1) ' +
    'ON CONFLICT(rate_key,window_start) DO UPDATE SET hits=hits+1 RETURNING hits'
  ).bind(key, windowStart).first();
  return Number(row?.hits || 0) <= limit;
}

async function isNetworkOwner(address, env) {
  const provider = new ethers.JsonRpcProvider(
    env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
    CHAIN_ID,
    { staticNetwork: true }
  );
  try {
    const network = new ethers.Contract(
      env.NETWORK_ADDRESS || '0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B',
      ['function Owner_Exists(address owner) view returns (bool)'],
      provider
    );
    return Boolean(await network.Owner_Exists(ethers.getAddress(address)));
  } finally {
    try { provider.destroy(); } catch {}
  }
}

// Reads the immutable owner ID and verifies the contract's ID -> current-wallet index.
// _Change_Wallet replaces the wallet at this index, preserving the same owner ID.
async function getNetworkOwnerIdentity(address, env) {
  const provider = new ethers.JsonRpcProvider(
    env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
    CHAIN_ID,
    { staticNetwork: true }
  );
  try {
    const network = new ethers.Contract(
      env.NETWORK_ADDRESS || '0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B',
      [
        'function Owner_Exists(address owner) view returns (bool)',
        'function Owner_Info_Global(address owner) view returns (uint64 id,uint32 AL,uint32 AR,uint32 LT,uint32 RT,uint8 XI,bool YY,address UP,address PO,address QO)',
        'function All_Owner_Address(uint32 start,uint32 end) view returns (address[])'
      ],
      provider
    );
    const wallet = ethers.getAddress(address);
    if (!await network.Owner_Exists(wallet)) return null;
    const node = await network.Owner_Info_Global(wallet);
    const ownerId = BigInt(node.id ?? node[0]);
    if (ownerId <= 0n || ownerId > 0xffffffffn) return null;
    const indexed = await network.All_Owner_Address(ownerId - 1n, ownerId - 1n);
    if (!indexed?.[0] || ethers.getAddress(indexed[0]) !== wallet) return null;
    return { ownerId: Number(ownerId), address: wallet };
  } finally {
    try { provider.destroy(); } catch {}
  }
}

async function backfillNetworkOwnerId(db, profile, env) {
  if (profile.network_owner_id !== null && profile.network_owner_id !== undefined) {
    return String(profile.network_owner_id);
  }
  try {
    const identity = await getNetworkOwnerIdentity(profile.primary_wallet_address, env);
    if (!identity) return null;
    await db.prepare(
      'UPDATE owner_profiles SET network_owner_id=?,updated_at=? WHERE profile_id=? AND network_owner_id IS NULL'
    ).bind(identity.ownerId, now(), profile.profile_id).run();
    return String(identity.ownerId);
  } catch (error) {
    console.warn('Owner Profile network identity backfill unavailable:',
      String(error?.message || error).slice(0, 180));
    return null;
  }
}

function parsePassword(value) {
  const password = String(value || '');
  if (password.length < 8 || password.length > 128) {
    throw new Error('Password must contain 8–128 characters');
  }
  return password;
}

async function createChallenge(request, env) {
  const body = await readJson(request);
  let address;
  try { address = normalizeAddress(body.address); }
  catch (error) { return json({ error: error.message }, 400); }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashValue(ip + ':' + new Date().toISOString().slice(0, 10));
  if (!await rateLimit(env.DB, 'owner-profile-challenge-ip:' + ipHash, 20, 300) ||
      !await rateLimit(env.DB, 'owner-profile-challenge-wallet:' + address, 8, 300)) {
    return json({ error: 'Too many wallet verification attempts. Please wait a few minutes.' }, 429);
  }

  const timestamp = now();
  await env.DB.prepare('DELETE FROM owner_profile_nonces WHERE expires_at < ?').bind(timestamp).run();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = timestamp + PROOF_TTL;
  const message = buildOwnerProfileChallengeMessage({
    origin: env.APP_ORIGIN || 'https://flyinfinitydao.github.io',
    address,
    nonce,
    issuedAt: new Date(timestamp * 1000).toISOString(),
    expiresAt: new Date(expiresAt * 1000).toISOString()
  });
  await env.DB.prepare(
    'INSERT INTO owner_profile_nonces(nonce,wallet_address,message,ip_hash,created_at,expires_at,consumed_at) ' +
    'VALUES(?,?,?,?,?,?,NULL)'
  ).bind(nonce, address, message, ipHash, timestamp, expiresAt).run();

  return json({ address: ethers.getAddress(address), chainId: CHAIN_ID, nonce, message, expiresAt, expiresIn: PROOF_TTL });
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
  const challenge = await env.DB.prepare(
    'SELECT message,expires_at,consumed_at FROM owner_profile_nonces WHERE nonce=? AND wallet_address=?'
  ).bind(body.nonce, address).first();
  if (!challenge || challenge.consumed_at !== null || Number(challenge.expires_at) <= timestamp) {
    return json({ error: 'Wallet verification challenge expired or was already used' }, 401);
  }
  if (!verifyWalletSignature({ address, message: challenge.message, signature: body.signature })) {
    return json({ error: 'Wallet signature does not match the requested address' }, 401);
  }

  const consumed = await env.DB.prepare(
    'UPDATE owner_profile_nonces SET consumed_at=? WHERE nonce=? AND wallet_address=? AND consumed_at IS NULL AND expires_at>?'
  ).bind(timestamp, body.nonce, address, timestamp).run();
  if (Number(consumed.meta?.changes || 0) !== 1) {
    return json({ error: 'Wallet verification challenge expired or was already used' }, 401);
  }

  let owner = false;
  try { owner = await isNetworkOwner(address, env); }
  catch (error) {
    console.error('Owner Profile network verification unavailable:', String(error?.message || error).slice(0, 180));
    return json({ error: 'BNB Smart Chain verification is temporarily unavailable. Please try again.' }, 503);
  }
  if (!owner) return json({ error: 'This wallet is not a registered Fly Infinity Network Owner' }, 403);

  const proofToken = createOpaqueSessionToken();
  const expiresAt = timestamp + PROOF_TTL;
  await env.DB.prepare(
    'INSERT INTO owner_profile_proofs(token_hash,wallet_address,created_at,expires_at,consumed_at) VALUES(?,?,?,?,NULL)'
  ).bind(await hashSessionToken(proofToken), address, timestamp, expiresAt).run();

  return json({ proofToken, wallet: ethers.getAddress(address), expiresAt, expiresIn: PROOF_TTL });
}

async function consumeWalletProof(db, env, proofToken) {
  if (typeof proofToken !== 'string' || proofToken.length < 40 || proofToken.length > 256) {
    return { error: 'A valid, recent wallet signature is required', status: 401 };
  }
  const tokenHash = await hashSessionToken(proofToken);
  const timestamp = now();
  const proof = await db.prepare(
    'SELECT wallet_address FROM owner_profile_proofs WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?'
  ).bind(tokenHash, timestamp).first();
  if (!proof) return { error: 'Wallet signature expired or was already used. Please sign again.', status: 401 };

  const consumed = await db.prepare(
    'UPDATE owner_profile_proofs SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?'
  ).bind(timestamp, tokenHash, timestamp).run();
  if (Number(consumed.meta?.changes || 0) !== 1) {
    return { error: 'Wallet signature expired or was already used. Please sign again.', status: 401 };
  }

  try {
    if (!await isNetworkOwner(proof.wallet_address, env)) {
      return { error: 'This wallet is not currently a registered Fly Infinity Network Owner', status: 403 };
    }
  } catch (error) {
    console.error('Owner Profile proof revalidation unavailable:', String(error?.message || error).slice(0, 180));
    return { error: 'BNB Smart Chain verification is temporarily unavailable. Please try again.', status: 503 };
  }
  return { address: proof.wallet_address };
}

async function createProfileSession(db, profileId) {
  const token = createOpaqueSessionToken();
  const timestamp = now();
  const expiresAt = timestamp + SESSION_TTL;
  await db.prepare(
    'INSERT INTO owner_profile_sessions(token_hash,profile_id,created_at,expires_at,revoked_at) VALUES(?,?,?,?,NULL)'
  ).bind(await hashSessionToken(token), profileId, timestamp, expiresAt).run();
  return { token, expiresAt, expiresIn: SESSION_TTL };
}

async function getProfileSession(request, env) {
  const token = bearer(request);
  if (!token || token.length > 256) {
    return { error: 'Sign in to your Owner Profile to continue', status: 401 };
  }
  const tokenHash = await hashSessionToken(token);
  const row = await env.DB.prepare(
    'SELECT profile_id,expires_at FROM owner_profile_sessions ' +
    'WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?'
  ).bind(tokenHash, now()).first();
  if (!row) return { error: 'Your Owner Profile session has expired. Please sign in again.', status: 401 };
  return { profileId: row.profile_id, tokenHash, expiresAt: Number(row.expires_at) };
}

async function getProfileSummary(db, profileId) {
  const profile = await db.prepare(
    'SELECT username,primary_wallet_address,network_owner_id,created_at FROM owner_profiles WHERE profile_id=?'
  ).bind(profileId).first();
  if (!profile) return null;
  const rows = await db.prepare(
    'SELECT wallet_address,is_primary,added_at FROM owner_profile_wallets ' +
    'WHERE profile_id=? AND is_primary=1 LIMIT 1'
  ).bind(profileId).all();
  return {
    username: profile.username,
    primaryWallet: ethers.getAddress(profile.primary_wallet_address),
    networkOwnerId: profile.network_owner_id === null || profile.network_owner_id === undefined
      ? null : String(profile.network_owner_id),
    createdAt: Number(profile.created_at),
    wallets: (rows.results || []).map(row => ({
      address: ethers.getAddress(row.wallet_address),
      isPrimary: Number(row.is_primary) === 1,
      addedAt: Number(row.added_at)
    }))
  };
}

async function createProfile(request, env) {
  const body = await readJson(request);
  let username, password;
  try {
    username = normalizeHandle(body.username);
    password = parsePassword(body.password);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashValue(ip + ':' + new Date().toISOString().slice(0, 10));
  if (!await rateLimit(env.DB, 'owner-profile-create-ip:' + ipHash, 8, 3600)) {
    return json({ error: 'Too many profile setup attempts. Please try later.' }, 429);
  }
  const proof = await consumeWalletProof(env.DB, env, body.proofToken);
  if (proof.error) return json({ error: proof.error }, proof.status);

  let identity;
  try { identity = await getNetworkOwnerIdentity(proof.address, env); }
  catch (error) {
    console.error('Owner Profile identity lookup failed:', String(error?.message || error).slice(0, 180));
    return json({ error: 'Could not verify the Network Owner ID on BNB Smart Chain. Please try again.' }, 503);
  }
  if (!identity) return json({ error: 'This wallet is not the current indexed wallet of a registered Network Owner.' }, 403);

  const existingWallet = await env.DB.prepare(
    'SELECT profile_id FROM owner_profile_wallets WHERE wallet_address=?'
  ).bind(proof.address).first();
  if (existingWallet) return json({ error: 'This wallet is already linked to an Owner Profile' }, 409);

  const salt = createPasswordSalt();
  const passwordHash = await hashPassword(password, salt, PASSWORD_ITERATIONS);
  const profileId = crypto.randomUUID();
  const timestamp = now();
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO owner_profiles(profile_id,username,password_hash,password_salt,password_iterations,primary_wallet_address,network_owner_id,created_at,updated_at) ' +
        'VALUES(?,?,?,?,?,?,?,?,?)'
      ).bind(profileId, username, passwordHash, salt, PASSWORD_ITERATIONS, proof.address, identity.ownerId, timestamp, timestamp),
      env.DB.prepare(
        'INSERT INTO owner_profile_wallets(wallet_address,profile_id,is_primary,added_at) VALUES(?,?,1,?)'
      ).bind(proof.address, profileId, timestamp)
    ]);
  } catch (error) {
    const message = String(error?.message || error).toLowerCase();
    if (message.includes('unique') || message.includes('constraint')) {
      return json({ error: 'This username or wallet is already registered. Please choose another username or sign in.' }, 409);
    }
    throw error;
  }

  const session = await createProfileSession(env.DB, profileId);
  return json({ token: session.token, expiresAt: session.expiresAt, expiresIn: session.expiresIn,
    profile: await getProfileSummary(env.DB, profileId) }, 201);
}

async function login(request, env) {
  const body = await readJson(request);
  let username, password;
  try {
    username = normalizeHandle(body.username);
    password = parsePassword(body.password);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashValue(ip + ':' + new Date().toISOString().slice(0, 10));
  if (!await rateLimit(env.DB, 'owner-profile-login-ip:' + ipHash, 20, 300) ||
      !await rateLimit(env.DB, 'owner-profile-login-user:' + username, 8, 300)) {
    return json({ error: 'Too many sign-in attempts. Please wait a few minutes.' }, 429);
  }

  const profile = await env.DB.prepare(
    'SELECT profile_id,username,password_hash,password_salt,password_iterations,primary_wallet_address,network_owner_id ' +
    'FROM owner_profiles WHERE username=? COLLATE NOCASE'
  ).bind(username).first();
  if (!profile || !profile.password_hash || !profile.password_salt) {
    return json({ error: 'Username or password is incorrect' }, 401);
  }

  const calculated = await hashPassword(password, profile.password_salt,
    Number(profile.password_iterations || PASSWORD_ITERATIONS));
  if (!constantTimeEqual(calculated, profile.password_hash)) {
    return json({ error: 'Username or password is incorrect' }, 401);
  }

  await backfillNetworkOwnerId(env.DB, profile, env);
  const session = await createProfileSession(env.DB, profile.profile_id);
  return json({ token: session.token, expiresAt: session.expiresAt, expiresIn: session.expiresIn,
    profile: await getProfileSummary(env.DB, profile.profile_id) });
}

async function me(request, env) {
  const session = await getProfileSession(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  const rawProfile = await env.DB.prepare(
    'SELECT profile_id,primary_wallet_address,network_owner_id FROM owner_profiles WHERE profile_id=?'
  ).bind(session.profileId).first();
  const profile = await getProfileSummary(env.DB, session.profileId);
  if (!profile || !rawProfile) return json({ error: 'Owner Profile was not found' }, 404);
  if (!profile.networkOwnerId) {
    profile.networkOwnerId = await backfillNetworkOwnerId(env.DB, rawProfile, env);
  }
  return json({ profile, expiresAt: session.expiresAt });
}

async function changeNetworkWallet(request, env) {
  const session = await getProfileSession(request, env);
  if (session.error) return json({ error: session.error }, session.status);

  const body = await readJson(request);
  const proof = await consumeWalletProof(env.DB, env, body.proofToken);
  if (proof.error) return json({ error: proof.error }, proof.status);

  const profile = await env.DB.prepare(
    'SELECT profile_id,primary_wallet_address,network_owner_id FROM owner_profiles WHERE profile_id=?'
  ).bind(session.profileId).first();
  if (!profile) return json({ error: 'Owner Profile was not found' }, 404);
  if (!profile.network_owner_id) {
    return json({
      error: 'This profile does not have a saved Network Owner ID yet. Sign in again while the original wallet is still active to register it before changing wallets.'
    }, 409);
  }

  const oldAddress = ethers.getAddress(profile.primary_wallet_address);
  const newAddress = ethers.getAddress(proof.address);
  if (oldAddress === newAddress) {
    return json({ error: 'The connected wallet is already registered to this profile.' }, 409);
  }

  let identity;
  try { identity = await getNetworkOwnerIdentity(newAddress, env); }
  catch (error) {
    console.error('Owner Profile wallet-change identity lookup failed:',
      String(error?.message || error).slice(0, 180));
    return json({ error: 'Could not verify the new wallet against the Network Owner index. Please try again.' }, 503);
  }
  if (!identity || String(identity.ownerId) !== String(profile.network_owner_id)) {
    return json({
      error: 'The new wallet does not match this profile’s original Network Owner ID. Complete _Change_Wallet on the network first, then try again.'
    }, 403);
  }

  try {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE owner_profiles SET primary_wallet_address=?,network_owner_id=?,updated_at=? ' +
        'WHERE profile_id=? AND primary_wallet_address=? AND network_owner_id=?'
      ).bind(newAddress, identity.ownerId, now(), session.profileId, oldAddress, Number(profile.network_owner_id)),
      env.DB.prepare(
        'DELETE FROM owner_profile_wallets WHERE profile_id=?'
      ).bind(session.profileId),
      env.DB.prepare(
        'INSERT INTO owner_profile_wallets(wallet_address,profile_id,is_primary,added_at) VALUES(?,?,1,?)'
      ).bind(newAddress, session.profileId, now())
    ]);
  } catch (error) {
    const message = String(error?.message || error).toLowerCase();
    if (message.includes('unique') || message.includes('constraint')) {
      return json({ error: 'This new wallet is already associated with another Owner Profile.' }, 409);
    }
    throw error;
  }

  const updated = await getProfileSummary(env.DB, session.profileId);
  return json({ profile: updated, walletChanged: true });
}

async function addWallet(request, env) {
  const session = await getProfileSession(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  return json({ error: 'Each Owner Profile is linked to one verified primary wallet. Additional wallet linking is disabled.' }, 409);
}

async function removeWallet(request, env, addressParam) {
  const session = await getProfileSession(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  return json({ error: 'An Owner Profile is bound to its original verified wallet. Wallet removal is disabled.' }, 409);
}

async function recoverPassword(request, env) {
  const body = await readJson(request);
  let password;
  try { password = parsePassword(body.password); }
  catch (error) { return json({ error: error.message }, 400); }
  const proof = await consumeWalletProof(env.DB, env, body.proofToken);
  if (proof.error) return json({ error: proof.error }, proof.status);

  const wallet = await env.DB.prepare(
    'SELECT profile_id FROM owner_profile_wallets WHERE wallet_address=? AND is_primary=1'
  ).bind(proof.address).first();
  if (!wallet) return json({ error: 'This wallet is not linked to an Owner Profile' }, 403);

  const salt = createPasswordSalt();
  const passwordHash = await hashPassword(password, salt, PASSWORD_ITERATIONS);
  await env.DB.prepare(
    'UPDATE owner_profiles SET password_hash=?,password_salt=?,password_iterations=?,updated_at=? WHERE profile_id=?'
  ).bind(passwordHash, salt, PASSWORD_ITERATIONS, now(), wallet.profile_id).run();
  await env.DB.prepare(
    'UPDATE owner_profile_sessions SET revoked_at=? WHERE profile_id=? AND revoked_at IS NULL'
  ).bind(now(), wallet.profile_id).run();

  const session = await createProfileSession(env.DB, wallet.profile_id);
  return json({ token: session.token, expiresAt: session.expiresAt, expiresIn: session.expiresIn,
    profile: await getProfileSummary(env.DB, wallet.profile_id) });
}

async function logout(request, env) {
  const session = await getProfileSession(request, env);
  if (session.error) return json({ error: session.error }, session.status);
  await env.DB.prepare(
    'UPDATE owner_profile_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL'
  ).bind(now(), session.tokenHash).run();
  return json({ ok: true });
}

export async function routeOwnerProfile(request, env) {
  const path = new URL(request.url).pathname;
  const method = request.method;
  if (path === '/api/owner-profile/auth/challenge' && method === 'POST') return createChallenge(request, env);
  if (path === '/api/owner-profile/auth/verify' && method === 'POST') return verifyChallenge(request, env);
  if (path === '/api/owner-profile/register' && method === 'POST') return createProfile(request, env);
  if (path === '/api/owner-profile/login' && method === 'POST') return login(request, env);
  if (path === '/api/owner-profile/me' && method === 'GET') return me(request, env);
  if (path === '/api/owner-profile/wallet-change' && method === 'POST') return changeNetworkWallet(request, env);
  if (path === '/api/owner-profile/wallets' && method === 'POST') return addWallet(request, env);
  const walletPrefix = '/api/owner-profile/wallets/';
  const walletAddress = path.startsWith(walletPrefix) ? path.slice(walletPrefix.length) : '';
  if (walletAddress && method === 'DELETE' && !walletAddress.includes('/')) return removeWallet(request, env, walletAddress);
  if (path === '/api/owner-profile/password/recover' && method === 'POST') return recoverPassword(request, env);
  if (path === '/api/owner-profile/logout' && method === 'POST') return logout(request, env);
  return null;
}
