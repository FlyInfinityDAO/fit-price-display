# Fly Hokm API (isolated)

This Worker is intentionally separate from the Chess/Backgammon Worker.

## Features in this stage
- Free wallet-signature challenge and verification (no transaction).
- BNB Smart Chain ID 56 validation.
- Server-side FIT `balanceOf` verification against the configured RPC.
- Tier 1 (1 to <10 FIT) and Tier 2 (>=10 FIT) claims in a short-lived signed session.
- Session revalidation checks the live FIT balance.
- D1-backed single-use nonces, rate limiting, and scheduled cleanup.

## Provisioning (not deployed)
1. Create a separate Cloudflare D1 database named `fly-hokm-db`.
2. Replace the placeholder `database_id` in `wrangler.toml` with that database's ID.
3. Apply migrations with `npx wrangler d1 migrations apply fly-hokm-db --remote`.
4. Set a random secret of at least 32 characters: `npx wrangler secret put SESSION_SECRET`.
5. Configure `FRONTEND_ORIGIN` / `FRONTEND_ORIGINS` to the final Hokm page origin.
6. Run `npm install`, `npm run check`, then deploy only after review.

No deployment, live signature, wallet prompt, or transaction is performed by this commit.
Online rooms and authoritative 15s/30s timers are a later server stage; the engine policies are already covered by the Hokm engine tests.
