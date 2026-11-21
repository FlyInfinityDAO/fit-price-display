# Fly AI image-generation isolated test route

This branch adds a separately named test Worker and a test-only image endpoint. It does not change the production Worker configuration, the existing chat endpoint, or the chat quota.

## What is added

- `backend/wrangler.image-test.toml`: Worker named `fly-ai-image-test`, with its own D1 database and Workers AI binding.
- Model adapter for `@cf/black-forest-labs/flux-2-klein-4b`.
- `POST /api/image/test`, protected by a temporary test-only secret header. This is a private test harness, not the end-user Fly AI authentication flow; it does not accept or reuse production wallet/JWT credentials.
- A separate D1 table, `image_test_usage`, with a maximum of 50 attempts in total per UTC day across the isolated test Worker.
- A separate production quota system in `image_generation_usage` and `image_generation_daily_usage`; it never reads or updates the existing chat `usage` table.
- `IMAGE_TEST_ENABLED=true` is set only in the isolated test Worker configuration. `IMAGE_GENERATION_ENABLED` remains false by default in both Worker configurations; the frontend `imageGenerationEnabled` flag is also false by default until the coordinated release.
- Production wallet-authenticated route: `POST /api/image/generate`. It reuses `requireAuth` (Network Owner verification and current FIT tier), while keeping image quota independent from chat.
- Unit tests for multipart model invocation, output decoding, and fail-closed behavior.
- A comparison script for the 10 Persian/English prompt pairs. `IMAGE_TEST_START_INDEX` can skip pairs already produced.

## Isolated test setup

1. Create or reuse a dedicated D1 database named `fly-ai-image-test-db`. Never use production `fly-ai-db`.
2. Put its ID into `backend/wrangler.image-test.toml`.
3. Apply `backend/migrations/0001_init.sql`, `backend/migrations/0004_image_test_usage.sql`, and `backend/migrations/0005_image_generation_usage.sql` to that test database only.
4. Deploy only with `npx wrangler deploy --config wrangler.image-test.toml` from `backend/`.
5. Set a fresh random `IMAGE_TEST_AUTH_KEY` secret on the test Worker. The GitHub Actions test workflow generates an ephemeral value for each test run and never writes it to the repository.
6. Keep the test Worker separate until the Persian/English image comparison is complete.

Do not copy production secrets into the test Worker. Do not deploy this branch using the production `backend/wrangler.toml`.

## Request

- Method: `POST`
- Path: `/api/image/test`
- Header: `X-Fly-Image-Test-Key: <ephemeral test-only key>`
- JSON body: `{"prompt":"A professional product photograph of a watch on black marble","seed":42}`
- Output: raw image bytes; response headers include `X-Image-Model`, `X-Image-Quota-Remaining`, dimensions and seed.

The test endpoint fixes output to 512×512 to control Neurons consumption. It accepts one prompt per request. The 50-attempt ceiling is a test safety cap, not the Cloudflare free-plan quota.

The production `/api/image/generate` route uses the existing wallet/JWT session and Network Owner entitlement. Initial per-wallet image quotas are 5 images/day for Tier 1, 10/day for Tier 2, and 20/day for Tier 3, with an account-wide ceiling of 250 images/day. At the tested 512×512 size this limits planned model consumption to about 6,513 Neurons/day for the production route. The route is disabled by default through `IMAGE_GENERATION_ENABLED=false`; it is not enabled on the production Worker by this branch.

## Validation

Run from `backend/`:

```sh
npm test
node --check src/index.js
node --check src/image-provider.js
node --check src/image-quota.js
node --check scripts/image-prompt-comparison.mjs
```

These checks validate code and test scaffolding. Live image generation is verified separately through the isolated Worker workflow.

## Frontend

The existing Fly AI workspace now includes an Image Studio tab alongside the original AI Chat tab. All eight supported languages have translations. The prompt is sent in its original language, the first release is fixed at 512×512, and generated images are previewed and downloadable. The frontend image feature flag remains disabled by default until the Worker route is deliberately enabled during a coordinated test/release.


## No-wallet Image Studio browser sandbox

A second, user-facing preview path is available for visual and live image-generation testing without connecting a wallet:

- Page: `fly-ai/image-studio-test.html`
- Test-only frontend config: `fly-ai/js/config.image-test.js`
- Test-only API path: `POST /api/image/preview` on the isolated `fly-ai-image-test` Worker.
- Allowed browser origin: `https://raw.githack.com` only.
- The page uses the shared Image Studio UI and eight-language translations, but switches to a clearly labeled sandbox mode. It does not enable the normal chat interface or call the wallet challenge/signature flow.
- The preview route does not accept production JWTs and does not call `requireAuth`. It is separate from `POST /api/image/generate` and from the private `/api/image/test` automation route.
- Client IP addresses are combined with an ephemeral Worker secret and SHA-256 hashed before any quota record is stored. Raw IP addresses are not written to D1.
- Preview limits: up to 4 in-flight or successful image generations per client IP per UTC day and 25 per day globally across the isolated preview Worker. A failed model call releases its reservation and does not consume the daily allowance.
- The test Worker enables `IMAGE_PREVIEW_ENABLED=true`; `IMAGE_GENERATION_ENABLED=false` remains in place. The production `fly-ai-api` Worker, `fly-ai-db`, production config, and wallet/JWT route are not modified or enabled.

The preview can be opened from the feature branch at:

`https://raw.githack.com/FlyInfinityDAO/fit-price-display/feature/fly-ai-image-test-api/fly-ai/image-studio-test.html`

To disable public no-wallet preview after testing, set `IMAGE_PREVIEW_ENABLED=false` on the isolated Worker (do not change the production Worker). The endpoint is a deliberately capped sandbox, not the production authentication policy.


## Dedicated production Image Studio service

Production image generation uses independent Cloudflare resources:

- Worker: `fly-ai-image-api`
- EU D1 database: `fly-ai-image-db`
- Workers AI model: `@cf/black-forest-labs/flux-2-klein-4b`
- API: `https://fly-ai-image-api.flyinfinityplatform.workers.dev`

The Worker owns its wallet challenge/session and image-quota tables. It verifies a separate free wallet signature, checks the current `Owner_Exists` status and FIT balance on BNB Smart Chain, and applies image quotas (Tier 1: 5/day, Tier 2: 10/day, Tier 3: 20/day; shared ceiling: 250/day). Session IDs are short-lived, random, and stored only as SHA-256 hashes. The wallet signature does not authorize a transaction or token transfer.

The three D1 stores are independent:
- `fly-ai-db`: current Fly AI chat, profiles, memory and conversations.
- `fly-ai-image-db`: production Image Studio sessions and quotas.
- `fly-ai-image-test-db`: no-wallet sandbox tests and quota.

The dedicated provisioning workflow creates/reuses only `fly-ai-image-db`, applies `backend/image-api/migrations/0001_init.sql` there, and deploys only `fly-ai-image-api`. Do not apply the legacy image quota migration to `fly-ai-db`. The no-wallet sandbox remains on its own Worker and D1.
