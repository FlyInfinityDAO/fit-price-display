# Fly Infinity Snakes & Ladders

Standalone game source, isolated under `games/snakes-and-ladders/`.

- Frontend: `https://flyinfinitydao.github.io/fit-price-display/games/snakes-and-ladders/`
- Dedicated Worker: `fly-snakes-and-ladders-api`
- Worker source: `worker/`
- Rules engine: `js/snakes-engine.js`

## Current implementation milestone

- Responsive Fly Infinity dark/neon interface, aligned with the Ludo game shell.
- Eight UI locales: English, Persian, Arabic, Turkish, Russian, Chinese, Spanish and Portuguese.
- Local pass-and-play and CPU game modes (2–4 seats).
- One token per player; serpentine 10×10 numbering, exact roll required for square 100.
- Wallet UI checks BNB Smart Chain and at least 1 FIT, then requests a free ownership signature. No transaction is requested.
- Online rooms remain disabled until their independent server-authoritative room/session infrastructure is provisioned. The Worker currently exposes an isolated health endpoint only.

## Worker setup

Configure a separate Cloudflare Worker named `fly-snakes-and-ladders-api`. Do not bind Ludo, Chess or Backgammon resources. Online play and server-verified wallet sessions are a separate follow-up milestone requiring a dedicated D1 database and Durable Object namespace.
