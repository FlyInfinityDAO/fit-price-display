import { ethers } from 'ethers';

const PASSWORD_ITERATIONS = 100000;

export function normalizeAddress(value) {
  if (typeof value !== 'string' || !ethers.isAddress(value)) {
    throw new Error('A valid BNB Smart Chain wallet address is required');
  }
  return ethers.getAddress(value).toLowerCase();
}

export function buildChallengeMessage({ origin, address, nonce, issuedAt, expiresAt }) {
  const host = new URL(origin).host;
  return [
    'Fly Infinity Social sign-in',
    '',
    'Domain: ' + host,
    'URI: ' + origin,
    'Wallet: ' + ethers.getAddress(address),
    'Chain ID: 56',
    'Nonce: ' + nonce,
    'Issued At: ' + issuedAt,
    'Expiration Time: ' + expiresAt,
    '',
    'This free signature only authenticates your Fly Infinity Social account. It does not authorize transactions, token transfers, or spending.'
  ].join('\n');
}

export function buildOwnerProfileChallengeMessage({ origin, address, nonce, issuedAt, expiresAt }) {
  const host = new URL(origin).host;
  return [
    'Fly Infinity Owner Profile wallet verification',
    '',
    'Domain: ' + host,
    'URI: ' + origin,
    'Wallet: ' + ethers.getAddress(address),
    'Chain ID: 56',
    'Nonce: ' + nonce,
    'Issued At: ' + issuedAt,
    'Expiration Time: ' + expiresAt,
    '',
    'This free off-chain signature only verifies control of this wallet for an Owner Profile. It is not a blockchain transaction, does not authorize token transfers or spending, and requires no gas.'
  ].join('\n');
}

export function buildPasswordRecoveryMessage({ origin, address, nonce, issuedAt, expiresAt }) {
  const host = new URL(origin).host;
  return [
    'Fly Infinity Social password recovery',
    '',
    'Domain: ' + host,
    'URI: ' + origin,
    'Wallet: ' + ethers.getAddress(address),
    'Chain ID: 56',
    'Nonce: ' + nonce,
    'Issued At: ' + issuedAt,
    'Expiration Time: ' + expiresAt,
    '',
    'This free wallet signature authorizes only a password reset for this Fly Infinity Social account. It is not a blockchain transaction and requires no gas.'
  ].join('\n');
}

export function verifyWalletSignature({ address, message, signature }) {
  try {
    return ethers.isAddress(address) &&
      typeof message === 'string' &&
      typeof signature === 'string' &&
      ethers.getAddress(ethers.verifyMessage(message, signature)) === ethers.getAddress(address);
  } catch {
    return false;
  }
}

export function createOpaqueSessionToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), value =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

export async function hashValue(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest), value =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

export function createPasswordSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value =>
    value.toString(16).padStart(2, '0')
  ).join('');
}

export async function hashPassword(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  if (typeof password !== 'string' || !/^[a-f0-9]{32}$/i.test(String(saltHex || ''))) {
    throw new Error('Invalid password hashing input');
  }
  const salt = new Uint8Array(String(saltHex).match(/.{2}/g).map(byte => parseInt(byte, 16)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return Array.from(new Uint8Array(bits), value => value.toString(16).padStart(2, '0')).join('');
}

export function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

export const hashSessionToken = hashValue;
