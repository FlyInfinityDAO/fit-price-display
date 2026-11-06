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
- Four-player private rooms, wallet-bound seats, authoritative turn validation, server-side 15-second turn timeouts, reconnect support, and server-side score progression.

## Provisioning
1. The isolated D1 database `fly-hokm-db` is already configured in `wrangler.toml`.
2. Apply D1 migrations with `npx wrangler d1 migrations apply fly-hokm-db --remote` if not already applied.
3. Keep the existing `SESSION_SECRET` secret configured (at least 32 characters).
4. Apply the Durable Object migration by deploying the Worker with the new `HOKM_ROOMS` binding.
5. Configure `FRONTEND_ORIGIN` / `FRONTEND_ORIGINS` to the final Hokm page origin.
6. Run `npm install`, `npm run check`, then deploy only after review.

This commit adds backend room infrastructure only; it does not change wallet connection code or automatically deploy the Worker.
