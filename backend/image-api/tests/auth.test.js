import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { buildChallengeMessage,verifyWalletSignature,createOpaqueSessionToken,hashSessionToken } from '../image-api/src/auth.js';
test('challenge includes origin, wallet, chain and non-transaction disclaimer',()=>{
 const w=Wallet.createRandom(),message=buildChallengeMessage({origin:'https://flyinfinitydao.github.io',address:w.address,nonce:'nonce-123',issuedAt:'2026-11-21T10:00:00.000Z',expiresAt:'2026-11-21T10:05:00.000Z'});
 assert.match(message,/Fly Infinity Image Studio sign-in/);assert.match(message,/Domain: flyinfinitydao\.github\.io/);assert.match(message,new RegExp(w.address));assert.match(message,/Chain ID: 56/);assert.match(message,/Nonce: nonce-123/);assert.match(message,/does not authorize transactions or token transfers/);
});
test('only the address signing the exact challenge is accepted',async()=>{
 const w=Wallet.createRandom(),other=Wallet.createRandom(),message=buildChallengeMessage({origin:'https://flyinfinitydao.github.io',address:w.address,nonce:'nonce-456',issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+300000).toISOString()}),sig=await w.signMessage(message);
 assert.equal(verifyWalletSignature({address:w.address,message,signature:sig}),true);assert.equal(verifyWalletSignature({address:other.address,message,signature:sig}),false);assert.equal(verifyWalletSignature({address:w.address,message:message+' altered',signature:sig}),false);
});
test('malformed signature fails closed',()=>assert.equal(verifyWalletSignature({address:'0x0000000000000000000000000000000000000001',message:'bad',signature:'bad'}),false));
test('session identifiers are random opaque values and SHA-256 hashes are stored',async()=>{
 const a=createOpaqueSessionToken(),b=createOpaqueSessionToken();assert.equal(a.length,64);assert.notEqual(a,b);const h=await hashSessionToken(a);assert.match(h,/^[a-f0-9]{64}$/);assert.notEqual(h,a);
});
