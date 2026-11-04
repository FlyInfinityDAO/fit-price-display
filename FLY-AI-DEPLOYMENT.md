# Fly AI v1 — deployment guide

## What is in this branch
- `fly-ai/`: standalone GitHub Pages interface, matching the existing dark / gold / emerald Fly Infinity visual language.
- Eight interface languages: English, Persian, Arabic, Turkish, Russian, Chinese, Spanish and Portuguese.
- Existing Reown WalletConnect bridge is reused for injected wallets and WalletConnect mobile/desktop flows.
- Wallet proof uses a short-lived, single-use signed challenge. No private key or seed phrase is requested.
- Cloudflare Worker API, D1 schema, server-side owner and FIT checks, signed sessions, daily request quota and configurable AI provider adapter.
- Read-only BNB Smart Chain contract access only.

## Access policy implemented
The backend reads `Owner_Exists(address)` from the Network contract and `balanceOf(address)` from the FIT ERC-20 contract. A non-owner is always tier 0; a verified owner is tier 1, tier 2 at 1 FIT, and tier 3 at 10 FIT. FIT uses 18 decimals and integer-safe comparisons. Ownership is rechecked for chat requests. This is the agreed v1 policy; no separate Agreement getter is assumed.

## Required deployment steps
1. Create a Cloudflare D1 database named `fly-ai-db`. Apply `backend/migrations/0001_init.sql` using Wrangler or the Cloudflare dashboard.
2. Replace `database_id` in `backend/wrangler.toml` with the created D1 database ID.
3. Set Worker secrets:
   - `BSC_RPC_URL`: reliable BNB Smart Chain RPC endpoint.
   - `JWT_SECRET`: long random secret (at least 32 random bytes).
   - `AI_API_KEY`: selected provider key.
   - `AI_MODEL`: exact model identifier enabled for that provider.
   - For OpenAI-compatible APIs: `AI_PROVIDER=openai-compatible`, `AI_BASE_URL` (optional; defaults to OpenAI API).
   - For Gemini: `AI_PROVIDER=gemini`; `AI_BASE_URL` is not used.
4. Optional Worker vars: `APP_ORIGIN=https://flyinfinitydao.github.io`, `DAILY_REQUEST_LIMIT=30`, `MAX_OUTPUT_TOKENS=1200`. Configure a strict custom domain/route and retain HTTPS.
5. Deploy from `backend/` with Wrangler after installing dependencies.
6. Set `fly-ai/js/config.js` `apiBase` to the deployed Worker origin, e.g. `https://fly-ai-api.<account>.workers.dev`.
7. Enable GitHub Pages for the repository's `main` branch after merging this feature branch. The public page path will be `https://flyinfinitydao.github.io/fit-price-display/fly-ai/` for project Pages, unless the repository has a custom Pages domain or a different publishing setup. Confirm the actual Pages settings before advertising a URL.
8. Smoke-test with a registered Owner wallet, a non-owner wallet, an Owner with 0 FIT, 1 FIT and 10 FIT; test mobile WalletConnect, account changes, wrong network, expired signature, repeated nonce and exhausted quota.

## Important limitations / security notes
- The UI and API are not production-ready until Worker, D1, RPC and AI secrets are deployed. The frontend deliberately shows a configuration message rather than silently using a paid or public API.
- Provider quotas and model availability are controlled by the selected AI provider. Choose the best model actually available under the intended free quota; do not assume unlimited free inference.
- The Worker enforces a per-wallet daily request limit and caps input/output. Configure Cloudflare platform limits and monitor usage; free plans have changing quotas.
- Add abuse controls (Cloudflare rate limiting / Turnstile) before public launch. D1 nonce storage is one-time and expires after five minutes.
- CORS is restricted to the published Fly Infinity origin. If the actual Pages/custom domain differs, update `APP_ORIGIN` in the Worker before deployment.
- Chat requests are currently non-streaming. Streaming can be added once the chosen provider and deployment are validated.
- Wallet login proves control of an address; it never asks for transaction approval.
- No smart-contract write method is exposed.

## Local development
- Frontend: serve the repository root over HTTP; open `/fly-ai/`.
- Backend: `cd backend && npm install && npx wrangler dev`.
- Use test-only credentials and a test D1 database during development. Never commit secrets.
