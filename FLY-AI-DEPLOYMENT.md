# Fly AI — current deployment and operations guide

## Current architecture

- Frontend source: `fly-ai/` in `FlyInfinityDAO/fit-price-display`.
- Worker source: `backend/`.
- Worker name: `fly-ai-api`.
- D1 database: `fly-ai-db`.
- Existing D1 database ID: `be1d9f7e-09b9-42ae-818d-94eb50faede0`.
- The database already exists and is bound as `DB` in `backend/wrangler.toml`.
- Do not create another `fly-ai-db` database and do not replace the configured ID during routine deployment.
- The Worker is read-only with respect to BNB Smart Chain contracts; wallet login is a signature and does not authorize token transfers.

## Access policy

The backend reads `Owner_Exists(address)` from the Network contract and `balanceOf(address)` from the FIT ERC-20 contract. A non-owner is tier 0; a verified owner is tier 1, tier 2 at 1 FIT, and tier 3 at 10 FIT. FIT uses 18 decimals and integer-safe comparisons. Ownership is rechecked for authenticated requests.

## Worker configuration

The checked-in `backend/wrangler.toml` is the source of truth for non-secret Worker configuration:

- `CHAIN_ID`
- `FIT_TOKEN_ADDRESS`
- `NETWORK_ADDRESS`
- `MIN_TIER2_FIT`
- `MIN_TIER3_FIT`
- `MAX_INPUT_CHARS`
- `MAX_OUTPUT_TOKENS`
- D1 binding `DB` → existing `fly-ai-db`
- Compatibility date and `nodejs_compat` flag

The runtime code also reads these secret/config names:

- `JWT_SECRET` — required for signed sessions.
- `BSC_RPC_URL` — required for BNB Smart Chain reads.
- `AI_API_KEY` — provider credential.
- `AI_MODEL` — model identifier; configure as a Worker variable or secret.
- Optional variables: `AI_PROVIDER` (defaults to `openai-compatible`), `AI_BASE_URL`, `APP_ORIGIN` (defaults to `https://flyinfinitydao.github.io`), and `DAILY_REQUEST_LIMIT` (defaults to 30).

Keep credentials only in Cloudflare Worker secrets. Never place them in frontend JavaScript, GitHub files, workflow logs, or this document. Record only names and presence in the infrastructure inventory.

## AI provider

The adapter supports OpenAI-compatible APIs and Gemini.

For an OpenAI-compatible provider, configure `AI_PROVIDER=openai-compatible`, the provider's API base in `AI_BASE_URL` if required, the API credential in `AI_API_KEY`, and the exact supported model identifier in `AI_MODEL`.

For Gemini, configure `AI_PROVIDER=gemini`, the API credential in `AI_API_KEY`, and the exact model identifier in `AI_MODEL`.

Free provider tiers have changing availability, quotas, and rate limits. Do not assume unlimited capacity. The Fly AI per-wallet daily quota and output cap are separate from provider limits.

## D1 migrations

The production database already exists and its ID is configured. Before applying migrations in any future approved deployment:

1. Confirm the intended database is `fly-ai-db` and the configured ID still matches the infrastructure map.
2. Review pending migration files under `backend/migrations/`.
3. Take/confirm an appropriate backup and understand the migration's effect.
4. Apply migrations only as a deliberate production operation.

Never run `wrangler d1 create fly-ai-db` for the existing production database.

## Deployment safety

There is no automatic production Worker deployment in this guide. A production deployment must be separately and explicitly approved after reviewing the exact diff, migrations, Cloudflare bindings, required secret names, and rollback plan.

From `backend/`, the normal build commands are:

```bash
npm install
node --check src/index.js
node --check src/ai-provider.js
```

A future approved deployment may use Wrangler from this directory after the production configuration and migration review. Do not run a production deploy as a validation step.

## Frontend

The frontend reads its API base from `fly-ai/js/config.js`. Verify that it points to the existing `fly-ai-api` Worker before advertising a public URL.

GitHub Pages is the intended frontend publishing path. Confirm the repository's actual Pages settings and URL before publishing or documenting a final public route.

## Smoke-test checklist for an approved release

- Health endpoint responds with the expected Fly AI service identity.
- Registered Owner with 0 FIT receives tier 1.
- Registered Owner with at least 1 FIT receives tier 2.
- Registered Owner with at least 10 FIT receives tier 3.
- Non-owner is denied.
- Wallet signature nonce is single-use and expires.
- Wrong chain, changed account, expired session, and exhausted quota are handled safely.
- Mobile WalletConnect and desktop injected-wallet flows work.
- AI provider failure returns a controlled error and does not expose credentials.
- Confirm no transaction or token approval is requested.

## Historical notes

This document replaces the original first-deployment instructions that told operators to create a new D1 database and overwrite the database ID. Those steps are no longer appropriate because the production database already exists.
