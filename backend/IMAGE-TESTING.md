# Image Studio test environment — retired

**Retired on 2026-11-22.** The isolated no-wallet image sandbox has completed its testing lifecycle and has been decommissioned.

The following test-only Cloudflare resources were removed:
- Worker: `fly-ai-image-test`
- D1 database: `fly-ai-image-test-db`

The test-only deployment workflow, Wrangler configuration, browser sandbox page, and browser test configuration were removed from the test branch. This file remains only as an archival record; do not recreate the retired Worker or database from the old test implementation.

## Production Image Studio remains active

The production service is separate and was not changed:
- Worker: `fly-ai-image-api`
- D1 database: `fly-ai-image-db`
- Frontend: `fly-ai/index.html`
- Production API: `https://fly-ai-image-api.flyinfinityplatform.workers.dev`

Production Image Studio continues to use its own wallet authentication, session handling, and image quotas. It does not use the retired test Worker or test database.
