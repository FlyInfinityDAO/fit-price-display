# Fly AI image-generation isolated test route

This branch adds a separately named test Worker and a disabled-by-default test endpoint. It does not change the production Worker configuration, the existing chat endpoint, or the chat quota.

## What is added

- `backend/wrangler.image-test.toml`: a separate Worker named `fly-ai-image-test` with its own D1 database placeholder and Workers AI binding.
- Model adapter for `@cf/black-forest-labs/flux-2-klein-4b`.
- `POST /api/image/test`, protected by the existing Fly AI wallet JWT and Network Owner entitlement check.
- A separate D1 table, `image_test_usage`, with a maximum of 25 attempts in total per UTC day across the test Worker. Failed model calls release their quota reservation.
- The endpoint is disabled unless `IMAGE_TEST_ENABLED=true` is set in the Worker environment.
- Unit tests for model invocation, output decoding, and fail-closed behavior.

## Isolated test setup

1. Create a **new** D1 database named `fly-ai-image-test-db`.
2. Put its ID into `backend/wrangler.image-test.toml`. Never use the production `fly-ai-db` ID.
3. Apply `backend/migrations/0001_init.sql` and `backend/migrations/0004_image_test_usage.sql` to the new test database only.
4. Set test Worker secrets `JWT_SECRET` and `BSC_RPC_URL`. Use a new test JWT secret; do not copy or expose production secret values.
5. Deploy only with `npx wrangler deploy --config wrangler.image-test.toml` from `backend/`.
6. Keep the test Worker separate until the Persian/English image comparison is complete.

The production `backend/wrangler.toml` is intentionally unchanged. Do not deploy this branch with that production config.

## Request

- Method: `POST`
- Path: `/api/image/test`
- Header: `Authorization: Bearer <session JWT issued by the test Worker>`
- JSON body: `{"prompt":"A professional product photograph of a watch on black marble","seed":42}`
- Output: raw image bytes; response headers include `X-Image-Model`, `X-Image-Quota-Remaining`, width and height.

The test endpoint fixes output to 512×512 to control free Neurons consumption while comparing Persian and English prompts. It accepts one prompt per request. The image-test quota is account-wide for this isolated test Worker, is capped at 25 attempts per UTC day across all test wallets, and is independent from the production chat quota.

## Validation

Run from `backend/`:

```sh
npm test
node --check src/index.js
node --check src/image-provider.js
```

These checks validate the local adapter and test scaffolding. They do not claim that live Cloudflare inference has succeeded. Live generation must be tested on the isolated Worker.
