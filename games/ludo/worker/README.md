# Fly Infinity Ludo API

Standalone Cloudflare Worker for Fly Infinity Ludo. It is intentionally isolated from the Chess Arena and Backgammon Worker.

## Resources

- Worker: `fly-ludo-api`
- D1 database: `fly-ludo-db`
- Durable Object: `LudoRoom`
- D1 binding: `DB`
- Durable Object binding: `LUDO_ROOMS`
- Frontend: `https://flyinfinitydao.github.io/fit-price-display/games/ludo/`
- API: `https://fly-ludo-api.flyinfinityplatform.workers.dev`

## Access rules

- BNB Smart Chain (chain ID 56).
- Minimum wallet balance: 1 FIT.
- Wallet access is a free signature; no token transfer or transaction.
- Sessions expire after 30 minutes and FIT balance is rechecked for protected actions.

## Multiplayer

- A new room starts with one occupied host seat; every other seat remains joinable by room code.
- The host may start the match by filling the remaining seats with CPU players.
- A wallet may occupy only one human seat in a room.
- Room state and move validation are server-authoritative in the Ludo Durable Object.

## Setup

1. Create a Cloudflare D1 database named `fly-ludo-db`.
2. Put its database UUID in `wrangler.toml`.
3. Apply the migration with `npx wrangler d1 migrations apply fly-ludo-db --remote`.
4. Set the Worker secret `SESSION_SECRET` (minimum 32 characters).
5. Configure the Worker build root as `games/ludo/worker`, build command `npm install && npm run check`, deploy command `npx wrangler deploy`.
6. Keep all changes on the repository `main` branch.

Do not alter the existing Chess Arena / Backgammon Worker or its D1 database when setting up Ludo.
