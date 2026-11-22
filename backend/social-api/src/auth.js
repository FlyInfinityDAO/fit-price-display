import { ethers } from 'ethers';

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

export const hashSessionToken = hashValue;
