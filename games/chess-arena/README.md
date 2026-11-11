# Fly Infinity Chess Arena

Chess Arena is an integrated game module in `games/chess-arena/` within the development repository `FlyInfinityDAO/fit-price-display`.

The development repository is the only repository to change during ongoing work. The final repository `FlyInfinityDAO/FlyInfinityDAO.github.io` must remain untouched until a separate, explicit future transfer instruction.

## Access requirement

The connected wallet must hold **at least 1 FIT** on BNB Smart Chain (chain ID 56):

- FIT Token contract: `0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa`
- Check: `balanceOf(walletAddress) >= 10^18` (18 decimals)

This is the only game eligibility condition. Network contract registration and `Owner_Exists` are not checked. No FIT is spent, transferred, staked, or locked. There is no entry fee or financial prize.

## Current architecture

- Frontend: `games/chess-arena/`, published with the integrated game frontend through the repository's GitHub Pages workflow.
- API Worker: `fly-chess-arena-api`.
- Existing D1 database: `fly-chess-arena-db`, ID `eae175c6-d221-48b8-ba54-3b784475b192`.
- D1 binding: `DB`.
- Chess Durable Object binding/class: `CHESS_ROOMS` → `ChessRoom` (migration tag `v1`).
- Backgammon shares this Worker and D1, but uses its own `BACKGAMMON_ROOMS` → `BackgammonRoom` binding/class (migration tag `v2`).
- Worker configuration: `worker/wrangler.toml`.
- Worker operations and safety notes: `worker/README.md`.
- Frontend API endpoint: `https://fly-chess-arena-api.flyinfinityplatform.workers.dev`. The frontend can override it through `window.CHESS_ARENA_API_URL` before loading `chess-arena.js`.

The Worker and D1 database already exist. **Do not create a replacement D1 database**, replace the configured database ID, rename the Worker or Durable Object classes, or apply remote migrations as part of routine frontend work.

## Implemented functionality

- Responsive Chess Arena frontend.
- Wallet connection through the site's wallet bridge.
- Signed wallet login; the signature is not a transaction or token approval.
- Server-side FIT balance verification and short-lived sessions.
- FIT balance rechecked for protected room actions and WebSocket tickets.
- Private 1v1 rooms with six-character invitation codes.
- Live WebSocket room connection.
- Server-authoritative chess move validation using `chess.js`.
- 10-minute clock per player, checkmate/draw detection, resignation, and draw offers.
- Chess and Backgammon room state are isolated in separate Durable Object classes.

## Validation and deployment

The repository's GitHub Actions validation workflow checks the Chess/Backgammon Worker, including syntax and security tests.

The integrated GitHub Pages publishing workflow completed successfully on 2026-11-09 for commit `27f24e839036789c0849039a127d55cb0a25693a`. Its validation, artifact upload, and Pages deployment steps all succeeded.

A successful GitHub Pages workflow does not itself prove every browser/device flow works. Continue to use end-to-end browser testing for wallet connection, signatures, room creation/joining, reconnects, and gameplay.

## Local development and safe operations

From `games/chess-arena/worker/`:

```bash
npm install
npm run check
npm run test:security
```

A production Worker deployment, D1 migration, Durable Object migration, secret change, or Cloudflare configuration change is a separate operation requiring explicit approval, review of the exact diff, and a rollback plan. Never use production as a test environment.

## Future scope

Public matchmaking, tournaments, and additional competitive/player-profile features should be treated as future work unless they are implemented and verified in the current source. Do not describe planned features as available.
