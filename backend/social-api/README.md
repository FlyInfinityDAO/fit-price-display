# Fly Infinity Social API

Independent backend for the Fly Infinity Social / Creator Arena page. It does not share a Worker, D1 database, R2 bucket, authentication table, or quota table with Fly AI, Image Studio, Audio Studio, or the games.

## Dedicated resources

- Worker: `fly-infinity-social-api`
- D1 database: `fly-infinity-social-db` (EU jurisdiction)
- R2 bucket: `fly-infinity-social-media` (private, EU jurisdiction)
- Wrangler config: `backend/wrangler.social-api.toml`
- Migration: `backend/social-api/migrations/0001_init.sql`

The provisioning workflow creates or reuses only these Social resources. It never changes another product's bindings or databases.

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
- Uploads are staged for two hours. A scheduled cleanup removes abandoned staged objects.
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

Challenge votes are unique per wallet and entry. Remix posts store the source post, source wallet and original title so attribution survives even when a creator later changes their display name.

## Moderation and launch scope

The initial backend stores user reports and keeps publication/moderation state on every post. It does not yet provide a moderator dashboard or automated content classifier. Do not describe the report queue as actively moderated until moderator tooling and an accountable moderation process are in place.

Creator challenges, voting, profiles, posts, follows and likes are persistent. Creator marketplace, paid sales, on-chain payments, tipping, NFT minting and creator payouts are deliberately out of scope.

## Provision and deploy

GitHub Actions workflow: `.github/workflows/fly-social-api-provision.yml`.

The workflow:
1. Runs Social-only unit tests and syntax checks.
2. Creates or reuses `fly-infinity-social-db` in EU.
3. Creates or reuses the private `fly-infinity-social-media` R2 bucket in EU.
4. Applies only the Social migration to Social D1.
5. Deploys only `fly-infinity-social-api`.
6. Verifies Worker health, CORS preflight and invalid-wallet rejection.

The GitHub Actions secret `CLOUDFLARE_API_TOKEN` must permit the current Worker/D1 provisioning tasks **and** Cloudflare R2 bucket creation. The R2 API requires the `Workers R2 Storage Write` permission. Do not paste API tokens into source code, chat, or workflow logs; replace the secret in GitHub repository settings with a suitably scoped token.

## Local validation

From `backend/`:

```bash
npm install
node --check social-api/src/index.js
node --check social-api/src/auth.js
node --check social-api/src/validation.js
node --test social-api/tests/*.test.js
```
