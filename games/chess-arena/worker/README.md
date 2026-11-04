# Fly Chess Arena API

A separate Cloudflare Worker, isolated from Fly AI and its database.

## Included

- Wallet challenge with short-lived, one-use nonce and signature recovery.
- BNB Smart Chain verification (chain ID 56).
- Server-side FIT Token `balanceOf(wallet)` check; minimum is exactly `10^18` base units (1 FIT, 18 decimals).
- 30-minute HMAC-signed session; FIT balance is rechecked for protected actions and WebSocket tickets.
- Private room creation and joining by six-character code.
- Durable Object room state with authoritative chess.js move validation, 10-minute clocks, checkmate/draw/resignation, draw offers, and WebSocket broadcasts.
- Single-use 30-second WebSocket tickets.
- No Network registration check, FIT transfer, approval, or transaction.

## Deploy setup

From this directory:

```bash
npm install
npx wrangler d1 create fly-chess-arena-db
```

Copy the returned database ID into `wrangler.toml` in place of `REPLACE_WITH_D1_DATABASE_ID`. Then apply the D1 migrations and create the secret:

```bash
npx wrangler d1 migrations apply fly-chess-arena-db --remote
npx wrangler secret put SESSION_SECRET
```

Use a random secret of at least 32 characters. Never commit it to GitHub. Confirm `FRONTEND_ORIGIN` is the exact origin serving the site, without a trailing slash. A reliable BSC RPC can be set in `BSC_RPC_URL`.

Deploy after the database ID and secret are configured:

```bash
npx wrangler deploy
```

## API

- `GET /api/health`
- `POST /api/auth/challenge` — JSON `{ "address": "0x..." }`
- `POST /api/auth/verify` — JSON `{ "address": "0x...", "nonce": "...", "signature": "0x..." }`
- `GET /api/auth/session` — bearer session
- `POST /api/rooms/create` — bearer session; creates a private room
- `POST /api/rooms/join` — bearer session; JSON `{ "roomCode": "ABC234" }`
- `GET /api/rooms/{code}` — authenticated room snapshot
- `POST /api/rooms/{code}/ticket` — bearer session; issues a one-use WebSocket ticket
- `GET /api/rooms/{code}/ws?ticket=...` — consumes ticket and upgrades to WebSocket

The frontend signs only a login message. It never approves or transfers FIT. The only eligibility rule is holding at least 1 FIT.

## Not yet included

Public matchmaking, player profiles, ELO/rating history, leaderboard, tournament support, and full frontend chessboard/room controls are not included yet. The live room service must be deployed and tested before presenting the game as production-ready.
