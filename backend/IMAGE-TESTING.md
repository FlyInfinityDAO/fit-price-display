# Fly AI image-generation isolated test route

This branch adds a separately named test Worker and a test-only image endpoint. It does not change the production Worker configuration, the existing chat endpoint, or the chat quota.

## What is added

- `backend/wrangler.image-test.toml`: Worker named `fly-ai-image-test`, with its own D1 database and Workers AI binding.
- Model adapter for `@cf/black-forest-labs/flux-2-klein-4b`.
- `POST /api/image/test`, protected by a temporary test-only secret header. This is a private test harness, not the end-user Fly AI authentication flow; it does not accept or reuse production wallet/JWT credentials.
- A separate D1 table, `image_test_usage`, with a maximum of 50 attempts in total per UTC day across the isolated test Worker. The counter is independent from the production chat quota. A failed model call releases its reservation; a request rejected because the cap is reached does not consume an additional slot.
- `IMAGE_TEST_ENABLED=true` is set only in the isolated test Worker configuration. The production `backend/wrangler.toml` remains unchanged.
- Unit tests for multipart model invocation, output decoding, and fail-closed behavior.
- A comparison script for the 10 Persian/English prompt pairs. `IMAGE_TEST_START_INDEX` can skip pairs already produced.

## Isolated test setup

1. Create or reuse a dedicated D1 database named `fly-ai-image-test-db`. Never use production `fly-ai-db`.
2. Put its ID into `backend/wrangler.image-test.toml`.
3. Apply `backend/migrations/0001_init.sql` and `backend/migrations/0004_image_test_usage.sql` to that test database only.
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

The endpoint fixes output to 512×512 to control Neurons consumption. It accepts one prompt per request. The 50-attempt ceiling is a test safety cap, not the Cloudflare free-plan quota. Cloudflare's Neurons allowance is shared across Workers AI models and is separate from this D1 counter.

## Validation

Run from `backend/`:

```sh
npm test
node --check src/index.js
node --check src/image-provider.js
node --check scripts/image-prompt-comparison.mjs
```

These checks validate code and test scaffolding. Live image generation is verified separately through the isolated Worker workflow.
