# Fly Infinity Snakes & Ladders Worker

Dedicated resources only; this Worker does not share a namespace or database with Chess, Backgammon or Ludo.

## Resources
- Worker: `fly-snakes-and-ladders-api`
- D1: `fly-snakes-and-ladders-db`
- Durable Object: `SnakesRoom` in the `SNAKES_ROOMS` namespace
- Chain: BNB Smart Chain (56)
- Access: server-verified wallet signature and at least 1 FIT

## Secrets and variables
- `SESSION_SECRET`: random secret with at least 32 characters (Cloudflare Worker secret)
- `BSC_RPC_URL`: BNB Smart Chain JSON-RPC endpoint
- `FRONTEND_ORIGIN`: `https://flyinfinitydao.github.io`

The deploy workflow provisions the dedicated D1 database if it does not exist, applies migrations, creates the session-signing secret only if it is missing (preserving existing sessions), and deploys this Worker. The Cloudflare API token must allow Workers Scripts:Edit and D1:Edit. The workflow also requires the repository variable `CLOUDFLARE_ACCOUNT_ID` and secret `CLOUDFLARE_API_TOKEN`.

## API
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `POST /api/rooms/create`
- `POST /api/rooms/join`
- `GET /api/rooms/:code`
- `POST /api/rooms/:code/ticket`
- `GET /api/rooms/:code/ws?ticket=...`
- `GET /api/stats/me`
- `GET /api/stats/leaderboard`

The server is authoritative for dice, movement, snakes, ladders and exact-finish rules. A completed win earns 3 FIGS; a loss earns 0 FIGS, matching the existing Fly Infinity games scoring convention. No entry fee, token transfer or financial reward is involved.
