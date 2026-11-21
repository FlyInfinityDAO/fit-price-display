import { ethers } from 'ethers';
export function buildChallengeMessage({origin,address,nonce,issuedAt,expiresAt}){
 return ['Fly Infinity Image Studio sign-in','',
 'Domain: '+new URL(origin).host,'URI: '+origin,'Wallet: '+ethers.getAddress(address),'Chain ID: 56',
 'Nonce: '+nonce,'Issued At: '+issuedAt,'Expiration Time: '+expiresAt,'',
 'This signature only authenticates wallet access to Fly Infinity Image Studio. It does not authorize transactions or token transfers.'].join('\n');
}
export function verifyWalletSignature({address,message,signature}){
 try{return ethers.isAddress(address)&&typeof message==='string'&&typeof signature==='string'&&ethers.getAddress(ethers.verifyMessage(message,signature))===ethers.getAddress(address)}catch{return false}
}
export function createOpaqueSessionToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')}
export async function hashSessionToken(token){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(token)));
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}