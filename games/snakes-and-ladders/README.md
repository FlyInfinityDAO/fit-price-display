# Fly Infinity Snakes & Ladders

The game is isolated under `games/snakes-and-ladders/`. All changes are made directly on `main`.

## Live page and services
- Frontend: https://flyinfinitydao.github.io/fit-price-display/games/snakes-and-ladders/
- Dedicated Worker: https://fly-snakes-and-ladders-api.flyinfinityplatform.workers.dev/
- Health: https://fly-snakes-and-ladders-api.flyinfinityplatform.workers.dev/api/health
- Worker: `fly-snakes-and-ladders-api`
- Dedicated D1: `fly-snakes-and-ladders-db`
- Durable Object: `SnakesRoom` / `SNAKES_ROOMS`

## Features
- Responsive 10×10 board and standard snakes/ladders.
- Eight UI languages: Persian, English, Arabic, Turkish, Russian, Chinese, Spanish and Portuguese.
- Wallet-gated access: BNB Smart Chain, minimum 1 FIT, server-verified free signature, no transaction.
- Local pass-and-play and CPU modes for 2–4 seats.
- Online private rooms for 2–4 wallet-connected players, six-character room codes and WebSocket updates.
- Server-authoritative dice, turn order, snakes, ladders and exact finish.
- FIGS records for completed online rooms: 3 points for a win, 0 for a loss. Local pass-and-play and CPU practice are not currently submitted to the server leaderboard; no unverified client-side result is counted.
- No entry fee, token transfer or financial rewards.

## Dedicated Worker setup
The deployment workflow provisions the isolated D1 database if missing, applies migrations, configures a session-signing secret, deploys the Worker and checks its health. It requires `CLOUDFLARE_API_TOKEN` with Workers Scripts:Edit and D1:Edit, plus the `CLOUDFLARE_ACCOUNT_ID` repository variable.

## API outline
- `POST /api/auth/challenge` and `POST /api/auth/verify`
- `POST /api/rooms/create` and `POST /api/rooms/join`
- `GET /api/rooms/:code`, `POST /api/rooms/:code/ticket`, WebSocket `/api/rooms/:code/ws`
- `GET /api/stats/me` and `GET /api/stats/leaderboard`

The Worker and database are separate from Chess Arena, Backgammon and Ludo. Do not reuse or bind those games' resources here.
