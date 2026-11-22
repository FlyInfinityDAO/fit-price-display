import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import {
  buildChallengeMessage, normalizeAddress, verifyWalletSignature, hashValue
} from '../src/auth.js';

test('Social sign-in challenge binds origin, wallet, BSC chain, expiry and non-transaction scope', () => {
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

test('hashValue produces a stable SHA-256 digest without returning the input', async () => {
  const first = await hashValue('social-session-token');
  const second = await hashValue('social-session-token');
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, 'social-session-token');
});
