# Image Studio test environment — retired

**Retired on 2026-11-22.** The isolated no-wallet image sandbox has completed its testing lifecycle and has been decommissioned.

The test-only Cloudflare Worker `fly-ai-image-test` and D1 database `fly-ai-image-test-db` have been removed. Its provisioning workflow, Wrangler configuration, browser sandbox page, and test frontend configuration have also been removed from this branch.

This file remains only as an archival note. Do not recreate the retired Worker or D1 database from the old test implementation.

## Production Image Studio

The production service is separate:
- Worker: `fly-ai-image-api`
- D1 database: `fly-ai-image-db`
- Frontend: `fly-ai/index.html`

The production Image Studio uses its own wallet authentication, session handling, and quota tables. It does not depend on the retired test Worker or test database.
