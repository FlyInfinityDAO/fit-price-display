# Fly AI image-generation isolated test route

This branch adds a **disabled-by-default** image-generation test endpoint. It does not add an Image Studio UI and does not change the existing chat endpoint or chat quota.

## What is added

- Workers AI binding named `AI`.
- Model adapter for `@cf/black-forest-labs/flux-2-klein-4b`.
- `POST /api/image/test`, protected by the existing Fly AI wallet JWT and Network Owner entitlement check.
- A separate D1 table, `image_test_usage`, with a maximum of 25 successful-or-in-flight attempts per wallet per UTC day. Failed model calls release the reservation.
- A feature flag that is `false` by default.
- Unit tests for model invocation, output decoding, and fail-closed behavior.

## Safe activation requirements

The endpoint returns 404 unless `IMAGE_TEST_ENABLED=true`. Before activating it in a test environment:

1. Add the Workers AI binding configured in `backend/wrangler.toml`.
2. Apply `backend/migrations/0004_image_test_usage.sql` to the **intended test D1 database**.
3. Set `IMAGE_TEST_ENABLED=true` only on the test Worker.
4. Keep the test Worker separate from production until the output comparison is complete.

Do not apply the migration to the production D1 database as part of this branch preparation. Do not deploy this branch to the existing `fly-ai-api` Worker without a separate deployment review.

## Request

- Method: `POST`
- Path: `/api/image/test`
- Header: `Authorization: Bearer <existing Fly AI session JWT>`
- JSON body: `{"prompt":"A professional product photograph of a watch on black marble","seed":42}`
- Output: raw image bytes; response headers include `X-Image-Model`, `X-Image-Quota-Remaining`, width and height.

The test endpoint intentionally fixes output to 512×512 to control free Neurons consumption while comparing Persian and English prompts. It accepts one prompt per request.

## Validation

Run from `backend/`:

```sh
npm test
node --check src/index.js
node --check src/image-provider.js
```

These checks validate the local adapter and test scaffolding. They do **not** claim that a live Cloudflare inference request has succeeded. Live generation must be tested on a separately configured test Worker.
