# Fly Infinity Chess Arena

An isolated game module under `games/chess-arena/`. It does not modify the existing dashboard or the Fly AI application.

## Entry requirements

A wallet must satisfy **both** requirements on BNB Smart Chain (chain ID 56):

1. `Owner_Exists(walletAddress) === true` on Fly Infinity Network contract `0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B`.
2. FIT Token `balanceOf(walletAddress) >= 1e18` (at least 1 FIT; token decimals: 18), token contract `0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa`.

No FIT is spent, transferred, staked, or locked. There is no entry fee or financial prize.

## Current implementation status

The initial isolated frontend shell and wallet/on-chain preflight checks are in place. The browser checks are **not a security boundary**. They must be repeated by the game API after a signed nonce challenge, and before room entry / matchmaking. Do not enable live matchmaking until server-side signature verification and on-chain eligibility checks are deployed.

## Planned service architecture

- Separate Chess Arena Cloudflare Worker; do not change the existing Fly AI Worker.
- Durable Objects for authoritative real-time rooms and WebSocket sessions.
- Separate game database for profiles, match history, and ratings.
- Server-authoritative chess legality, clocks, results, reconnect handling, and rating updates.
- Standard chess rules, private invite rooms, public matchmaking, and a free leaderboard.

## Local preview

Open `index.html` through a local static server or the GitHub Pages path. The page uses the existing root `walletconnect-bridge.js` and ethers v5 CDN. WalletConnect and injected-wallet selection therefore follow the site's existing bridge.
