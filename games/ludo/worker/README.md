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

1. The dedicated D1 database `fly-ludo-db` is created and its UUID is configured in `wrangler.toml`.
2. The initial schema is stored in `migrations/0001_initial.sql`; the deployment workflow applies it remotely and safely.
3. The Production secret `SESSION_SECRET` is configured in Cloudflare (96-character random value; never commit it).
4. The Cloudflare Worker project is connected to `FlyInfinityDAO/fit-price-display`, branch `main`, root `/games/ludo/worker`.
5. `.github/workflows/ludo-cloudflare-deploy.yml` validates the Worker, runs the engine/room tests, applies D1 migrations, deploys with Wrangler, and verifies the production health endpoint.
6. All development and deployments use the repository `main` branch only.

The Ludo frontend calls only `https://fly-ludo-api.flyinfinityplatform.workers.dev`. Chess and Backgammon continue using `fly-chess-arena-api`. Ludo has its own D1 database and Durable Object namespace; do not bind it to the Chess/Backgammon database or Worker.
