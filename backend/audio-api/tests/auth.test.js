import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { buildChallengeMessage, verifyWalletSignature, createOpaqueSessionToken, hashSessionToken } from '../src/auth.js';

test('audio challenge binds origin, wallet, BSC chain and a non-transaction disclaimer', () => {
  const wallet = Wallet.createRandom();
  const message = buildChallengeMessage({
    origin: 'https://flyinfinitydao.github.io', address: wallet.address,
    nonce: 'audio-nonce', issuedAt: '2026-11-21T10:00:00.000Z',
    expiresAt: '2026-11-21T10:05:00.000Z'
  });
  assert.match(message, /Fly Infinity Audio Studio sign-in/);
  assert.match(message, /Domain: flyinfinitydao\.github\.io/);
  assert.match(message, new RegExp(wallet.address));
  assert.match(message, /Chain ID: 56/);
  assert.match(message, /does not authorize transactions or token transfers/);
});

test('only the wallet signing the exact audio challenge is accepted', async () => {
  const wallet = Wallet.createRandom(), other = Wallet.createRandom();
  const message = buildChallengeMessage({
    origin: 'https://flyinfinitydao.github.io', address: wallet.address,
    nonce: 'one-use', issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300000).toISOString()
  });
  const signature = await wallet.signMessage(message);
  assert.equal(verifyWalletSignature({ address: wallet.address, message, signature }), true);
  assert.equal(verifyWalletSignature({ address: other.address, message, signature }), false);
  assert.equal(verifyWalletSignature({ address: wallet.address, message: message + ' altered', signature }), false);
});

test('malformed audio wallet signatures fail closed', () => {
  assert.equal(verifyWalletSignature({
    address: '0x0000000000000000000000000000000000000001', message: 'invalid', signature: 'invalid'
  }), false);
});

test('audio session tokens are opaque and only hashes are persisted', async () => {
  const token = createOpaqueSessionToken();
  assert.equal(token.length, 64);
  const hash = await hashSessionToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
});
