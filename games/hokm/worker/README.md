# Fly Hokm API (isolated)

This Worker is intentionally separate from the Chess/Backgammon Worker.

## Features

- Free wallet-signature challenge and verification (no transaction).
- BNB Smart Chain ID 56 validation.
- Server-side FIT `balanceOf` verification against the configured RPC.
- Tier 1 (1 to <10 FIT) and Tier 2 (>=10 FIT) claims in a short-lived signed session.
- Session revalidation checks the live FIT balance.
- D1-backed single-use nonces, rate limiting, and scheduled cleanup.
- Isolated Durable Object room coordination with one-time WebSocket tickets.
- Four-player private rooms, wallet-bound seats, authoritative turn validation, reconnect support, and server-side score progression.

## Existing production resources

- Worker: `fly-hokm-api`.
- Existing D1: `fly-hokm-db`.
- Existing database ID: `0f82c3fb-95f7-42d5-a2ca-9861d63b8948`.
- D1 binding: `DB`.
- Durable Object binding: `HOKM_ROOMS` → `HokmRoom`.
- Durable Object migration tag: `v1`.

The isolated D1 database already exists and is configured in `wrangler.toml`. Never run the provisioning workflow or `wrangler d1 create fly-hokm-db` for this existing production database. The emergency provisioning workflow now refuses to create a database unless the Wrangler file explicitly contains the unprovisioned placeholder.

## Provisioning and approved deployment

1. Confirm the existing `fly-hokm-db` ID in the infrastructure map and Wrangler configuration.
2. Review pending SQL migrations before any production application.
3. Keep the Worker secret `SESSION_SECRET` configured (at least 32 characters); never expose its value.
4. Review Durable Object migration changes before deploying.
5. Confirm `FRONTEND_ORIGIN` / `FRONTEND_ORIGINS` match the intended frontend origins.
6. Run local validation first: `npm install` and `npm run check`.
7. Production deployment is manual-only and requires an explicit workflow confirmation. It applies the checked-in D1 migrations and deploys the Worker; do not run it as a test.

The GitHub Actions deploy workflow now checks out `main`, not a historical feature branch. It does not deploy on ordinary pushes.

## API

- `GET /api/health`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `GET /api/auth/session`
- Room creation, joining, CPU, and WebSocket endpoints under `/api/rooms/`

The frontend signs only a login message. It never approves or transfers FIT.
