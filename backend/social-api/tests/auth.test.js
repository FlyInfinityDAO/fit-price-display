import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import {
  buildChallengeMessage, buildPasswordRecoveryMessage, normalizeAddress,
  verifyWalletSignature, hashValue, createPasswordSalt, hashPassword,
  constantTimeEqual
} from '../src/auth.js';

test('Social sign-in challenge binds origin, wallet, BSC chain and non-transaction scope', () => {
  const wallet = Wallet.createRandom();
  const message = buildChallengeMessage({
    origin: 'https://flyinfinitydao.github.io',
    address: wallet.address,
    nonce: 'single-use-test-nonce',
    issuedAt: '2026-11-22T12:00:00.000Z',
    expiresAt: '2026-11-22T12:05:00.000Z'
  });
  assert.match(message, /Domain: flyinfinitydao\.github\.io/);
  assert.match(message, /Chain ID: 56/);
  assert.match(message, new RegExp(wallet.address));
  assert.match(message, /single-use-test-nonce/);
  assert.match(message, /does not authorize transactions, token transfers, or spending/i);
});

test('password recovery challenge explicitly scopes a free signature to password reset', () => {
  const wallet = Wallet.createRandom();
  const message = buildPasswordRecoveryMessage({
    origin: 'https://flyinfinitydao.github.io',
    address: wallet.address,
    nonce: 'recovery-nonce',
    issuedAt: '2026-11-22T12:00:00.000Z',
    expiresAt: '2026-11-22T12:05:00.000Z'
  });
  assert.match(message, /password recovery/i);
  assert.match(message, /is not a blockchain transaction and requires no gas/i);
  assert.match(message, /Chain ID: 56/);
});

test('wallet signature verification accepts the signer and rejects a different wallet', async () => {
  const wallet = Wallet.createRandom();
  const other = Wallet.createRandom();
  const address = normalizeAddress(wallet.address);
  const message = buildChallengeMessage({
    origin: 'https://flyinfinitydao.github.io',
    address: wallet.address,
    nonce: 'nonce-123',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300000).toISOString()
  });
  const signature = await wallet.signMessage(message);
  assert.equal(verifyWalletSignature({ address, message, signature }), true);
  assert.equal(verifyWalletSignature({ address: other.address, message, signature }), false);
  assert.equal(verifyWalletSignature({ address, message, signature: '0x00' }), false);
});

test('wallet addresses are normalized and invalid addresses are rejected', () => {
  const wallet = Wallet.createRandom();
  assert.equal(normalizeAddress(wallet.address), wallet.address.toLowerCase());
  assert.throws(() => normalizeAddress('not-a-wallet'), /valid BNB Smart Chain wallet address/i);
});

test('session hashing produces a stable SHA-256 digest', async () => {
  const first = await hashValue('social-session-token');
  const second = await hashValue('social-session-token');
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, 'social-session-token');
});

test('passwords use unique salts and PBKDF2 hashes that can be verified without storing plaintext', async () => {
  const password = 'a-long-safe-password';
  const saltA = createPasswordSalt();
  const saltB = createPasswordSalt();
  assert.notEqual(saltA, saltB);
  const hashA = await hashPassword(password, saltA, 1000);
  const hashAgain = await hashPassword(password, saltA, 1000);
  const hashOtherSalt = await hashPassword(password, saltB, 1000);
  assert.equal(hashA, hashAgain);
  assert.notEqual(hashA, hashOtherSalt);
  assert.equal(constantTimeEqual(hashA, hashAgain), true);
  assert.equal(constantTimeEqual(hashA, hashOtherSalt), false);
  assert.match(hashA, /^[0-9a-f]{64}$/);
});
