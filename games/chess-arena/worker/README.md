# Fly Chess Arena API

A separate Cloudflare Worker, isolated from Fly AI and its database. Chess Arena and Backgammon intentionally share this Worker and D1 database while using separate Durable Object classes.

## Included

- Wallet challenge with short-lived, one-use nonce and signature recovery.
- BNB Smart Chain verification (chain ID 56).
- Server-side FIT Token `balanceOf(wallet)` check; minimum is exactly `10^18` base units (1 FIT, 18 decimals).
- 30-minute HMAC-signed session; FIT balance is rechecked for protected actions and WebSocket tickets.
- Private room creation and joining by six-character code.
- Durable Object room state with authoritative chess.js move validation, clocks, checkmate/draw/resignation, draw offers, and WebSocket broadcasts.
- Separate Backgammon room class with server-authoritative dice, legal move validation, resign/draw handling, and CPU opponents.
- Wallet-based Backgammon records and leaderboard.
- No Network registration check, FIT transfer, approval, or transaction.

## Existing production resources

- Worker: `fly-chess-arena-api`.
- Existing D1: `fly-chess-arena-db`.
- Existing database ID: `eae175c6-d221-48b8-ba54-3b784475b192`.
- D1 binding: `DB`.
- Durable Object bindings: `CHESS_ROOMS` → `ChessRoom`; `BACKGAMMON_ROOMS` → `BackgammonRoom`.
- Durable Object migration tags: `v1` for `ChessRoom`, `v2` for `BackgammonRoom`.

The database and Worker already exist. Do not run `wrangler d1 create fly-chess-arena-db` or replace the configured database ID during routine deployment.

## Configuration and secrets

The Wrangler file is the source of truth for D1, Durable Object bindings, compatibility date/flags, frontend origins, and cron configuration. The runtime requires the Worker secret `SESSION_SECRET` (at least 32 characters). Never commit secret values.

## Validation

From this directory:

```bash
npm install
npm run check
npm run test:security
```

A production deploy or remote migration is a separate operation and requires explicit approval, review of pending migrations, and a rollback plan. Do not use production as a test environment.

## API

- `GET /api/health`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `GET /api/auth/session`
- Chess private-room and WebSocket endpoints under `/api/rooms/`
- Backgammon room and WebSocket endpoints under `/api/backgammon/rooms/`
- Backgammon statistics under `/api/backgammon/stats/`

The frontend signs only a login message. It never approves or transfers FIT. The only eligibility rule is holding at least 1 FIT.
