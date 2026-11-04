# Fly Infinity Chess Arena

An isolated game module under `games/chess-arena/`. It does not modify the existing dashboard or the Fly AI application.

## Single entry requirement

The connected wallet must hold **at least 1 FIT** on BNB Smart Chain (chain ID 56):

- FIT Token contract: `0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa`
- Check: `balanceOf(walletAddress) >= 10^18` (18 decimals)

This is the **only eligibility condition**. Network contract registration / `Owner_Exists` is not checked and is not required.

No FIT is spent, transferred, staked, or locked. There is no entry fee or financial prize. BNB Smart Chain is used because FIT balance is read from the FIT token contract deployed there.

## Current implementation status

The isolated frontend includes wallet connection, a local balance display, and a signed login flow to the separate Chess Arena API. The server independently verifies the wallet signature and FIT balance, then issues a short-lived session. The browser-only balance check does not grant access.

The API URL defaults to `https://fly-chess-arena-api.flyinfinityplatform.workers.dev`. To override it, define `window.CHESS_ARENA_API_URL` before loading `chess-arena.js`.

## Planned service architecture

- Separate Chess Arena Cloudflare Worker; do not change the existing Fly AI Worker.
- Durable Objects for authoritative real-time rooms and WebSocket sessions.
- Separate game database for profiles, match history, and ratings.
- Server-authoritative chess legality, clocks, results, reconnect handling, and rating updates.
- Standard chess rules, private invite rooms, public matchmaking, and a free leaderboard.

## Local preview

Open `index.html` through a local static server or the GitHub Pages path. The page uses the existing root `walletconnect-bridge.js` and ethers v5 CDN. WalletConnect and injected-wallet selection therefore follow the site's existing bridge.
