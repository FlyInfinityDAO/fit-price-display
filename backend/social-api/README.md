# Fly Infinity Social API

Independent backend for the Fly Infinity Social / Creator Arena page. It does not share a Worker, D1 database, R2 bucket, authentication table, or quota table with Fly AI, Image Studio, Audio Studio, or the games.

## Dedicated resources

- Worker: `fly-infinity-social-api`
- D1 database: `fly-infinity-social-db` (EU jurisdiction)
- D1 ID: `64b672c3-cce6-418e-a0d2-da8d8ee3df7f`
- Object storage: Backblaze B2 S3-compatible API (private bucket)
- Wrangler config: `backend/wrangler.social-api.toml`
- Migration: `backend/social-api/migrations/0001_init.sql`

The Worker and D1 database are already created. The Social D1 migration has been applied and verified: all 12 Social tables and both seed challenges are present. Images and audio are stored in a private Backblaze B2 bucket, accessed only by the Worker through a bucket-restricted application key. Cloudflare R2 is not required.

## Account access

- The user signs a short-lived, one-use challenge with their BNB Smart Chain wallet.
- The Worker verifies the signature and checks `Owner_Exists(wallet)` on the Fly Infinity Network contract.
- No minimum FIT balance is required by this initial Social access policy.
- The signature is authentication only. It does not authorize token transfers, transactions, or spending.
- Opaque session tokens are stored in D1 as SHA-256 hashes; raw session tokens are returned only to the signing browser.

## Storage and media

- Structured records, profile details, feed metadata, likes, follows, challenge submissions, votes, and reports live in D1.
- Images and audio files live in a private R2 bucket, never in D1.
- The Worker accepts PNG/JPEG/WebP and supported MP3/WAV/OGG/M4A/AAC audio.
- Image limit: 15 MiB. Audio limit: 30 MiB.
- File MIME type and binary signature are checked before the object is accepted.
- Uploads are staged for two hours. Expired staged objects are cleaned up opportunistically during later uploads; no Cloudflare Cron Trigger is required.
- An uploaded file is served only after it is attached to a published, non-restricted creation. The R2 bucket is not public.
- Deleting a post hides it and its media from public retrieval. Physical object cleanup is a later retention/moderation operation.

## API overview

### Public
- `GET /api/health`
- `GET /api/feed?type=image|audio|prompt&cursor=...`
- `GET /api/posts/:postId`
- `GET /api/prompts`
- `GET /api/challenges`
- `GET /api/creators`
- `GET /api/creators/:handle`
- `GET /api/media/:key` (only media attached to a published creation)

### Wallet authentication
- `POST /api/auth/challenge` — JSON: `{ "address": "0x..." }`
- `POST /api/auth/verify` — JSON: `{ "address": "0x...", "nonce": "...", "signature": "0x..." }`
- `GET /api/me`
- `PUT /api/profile` — JSON: `{ "handle": "...", "displayName": "...", "bio": "...", "language": "en" }`

Protected calls use `Authorization: Bearer <sessionToken>`.

### Publishing and community
- `POST /api/media/upload` — raw file body; `Content-Type` must match the file signature.
- `POST /api/posts` — JSON: `{ "title": "...", "mediaType": "image|audio|prompt", "description": "...", "prompt": "...", "mediaKey": "...", "sourcePostId": "...", "challengeId": "..." }`
- `DELETE /api/posts/:postId` — delete your own creation.
- `POST /api/posts/:postId/like` and `DELETE /api/posts/:postId/like`
- `POST /api/creators/:walletAddress/follow` and `DELETE /api/creators/:walletAddress/follow`
- `POST /api/challenges/:challengeId/vote` — JSON: `{ "postId": "..." }`
- `POST /api/reports` — report a post or creator.

Each wallet may cast only one vote per challenge; the API rejects votes for a creator's own entry. These limits are enforced by D1 constraints and server-side checks, not only by the browser. Remix posts store the source post, source wallet and original title so attribution survives even when a creator later changes their display name.

## Moderation and launch scope

The initial backend stores user reports and keeps publication/moderation state on every post. It does not yet provide a moderator dashboard or automated content classifier. Do not describe the report queue as actively moderated until moderator tooling and an accountable moderation process are in place.

Creator challenges, voting, profiles, posts, follows and likes are persistent. Creator marketplace, paid sales, on-chain payments, tipping, NFT minting and creator payouts are deliberately out of scope.

## Backblaze B2 setup

Create a free Backblaze account at https://www.backblaze.com/sign-up/s3. Backblaze advertises 10 GB of always-free storage and free egress up to 3x average monthly storage. A payment method is not required to start. Use a **Private** bucket; public-bucket setup has separate payment-history requirements.

Create one private bucket in the account's region, then create a standard Application Key restricted to that bucket and the `uploads/` file-name prefix. Grant only the capabilities needed for this Worker:
- `readFiles`
- `writeFiles`
- `deleteFiles`

Do not use the master application key. Save the Application Key ID and Application Key because the latter is shown only once. Copy the bucket's S3 Endpoint URL (for example, `https://s3.us-west-004.backblazeb2.com`).

In GitHub repository Settings → Secrets and variables → Actions, create these four repository secrets:
- `FLY_SOCIAL_B2_ENDPOINT` — the S3 Endpoint URL shown in the bucket details
- `FLY_SOCIAL_B2_BUCKET` — the exact private bucket name
- `FLY_SOCIAL_B2_KEY_ID` — the scoped Application Key ID
- `FLY_SOCIAL_B2_APPLICATION_KEY` — the scoped Application Key value

Keep the existing `CLOUDFLARE_API_TOKEN` unchanged. The existing repository variable `CLOUDFLARE_ACCOUNT_ID` remains required for the Worker deploy.

## Deploy

GitHub Actions workflow: `.github/workflows/fly-social-api-provision.yml` (manual dispatch only).

After the four B2 secrets and the dedicated Cloudflare Worker deploy token `CLOUDFLARE_SOCIAL_API_TOKEN` are saved, run **Actions → Fly Infinity Social API — deploy → Run workflow** on `main`. The workflow runs tests, uploads the B2 credentials to this Worker as encrypted runtime secrets, deploys only `fly-infinity-social-api`, then verifies health, CORS and input validation.

The B2 key is never exposed to browser code, source files or workflow output. Media is stored in a private bucket and served only through the Social Worker after D1 confirms it belongs to a published, unrestricted post. Do not paste any token or application key into chat or source code.

## Local validation

From `backend/`:

```bash
npm install
node --check social-api/src/index.js
node --check social-api/src/auth.js
node --check social-api/src/validation.js
node --test social-api/tests/*.test.js
```
