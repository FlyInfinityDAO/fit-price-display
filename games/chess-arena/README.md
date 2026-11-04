# Fly Infinity Chess Arena

An isolated game module under `games/chess-arena/`. Existing dashboard pages and the Fly AI application remain untouched.

## Single entry requirement

The connected wallet must hold **at least 1 FIT** on BNB Smart Chain (chain ID 56):

- FIT Token contract: `0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa`
- Check: `balanceOf(walletAddress) >= 10^18` (18 decimals)

This is the **only eligibility condition**. Network contract registration and `Owner_Exists` are not checked.

No FIT is spent, transferred, staked, or locked. There is no entry fee or financial prize.

## Implemented in this branch

- Standalone responsive Chess Arena page.
- Wallet connection through the site's existing wallet bridge.
- Signed wallet login; the signature is not a transaction or token approval.
- Server-side FIT balance verification and short-lived session.
- FIT balance is rechecked before room actions and WebSocket connection.
- Private 1v1 rooms with six-character invitation codes.
- Live WebSocket room connection.
- Server-authoritative chess move validation using `chess.js`.
- 10-minute clock per player, checkmate/draw detection, resignation, and draw offers.
- Isolated Cloudflare Worker, D1 database migrations, and SQLite-backed Durable Object room state.

## Deployment status

The code is committed on `feature/chess-arena-games`, but the new Worker has **not** been deployed. Before it can be used, create the dedicated D1 database, put its ID in `worker/wrangler.toml`, set the `SESSION_SECRET`, apply migrations, and deploy from `games/chess-arena/worker/`. Follow `worker/README.md`.

The frontend currently expects the Worker at `https://fly-chess-arena-api.flyinfinityplatform.workers.dev`. It can be overridden by defining `window.CHESS_ARENA_API_URL` before loading `chess-arena.js`.

## Not implemented yet

Public matchmaking, player profiles, ELO/rating history, leaderboard, tournaments, and full integration with the site's eight-language interface are later steps. Do not merge this branch into `main` or present the game as production-ready until deployment and end-to-end tests are complete.

## Local preview

Open `index.html` through a local static server. The page uses the existing root `walletconnect-bridge.js` and ethers v5 CDN.
