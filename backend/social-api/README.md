# Fly Infinity Social API v2

Independent backend for the Fly Infinity Social page. It uses its own Worker, D1 database and private Backblaze B2 bucket. It does not share authentication, quotas, storage or database tables with Fly AI, Image Studio, Audio Studio or games.

## Dedicated resources

- Worker: `fly-infinity-social-api`
- D1 database: `fly-infinity-social-db` (EU jurisdiction)
- D1 ID: `64b672c3-cce6-418e-a0d2-da8d8ee3df7f`
- Image storage: Backblaze B2 S3-compatible private bucket
- Wrangler config: `backend/wrangler.social-api.toml`
- Migrations: `backend/social-api/migrations/`

## User experience and access

1. Initially the page shows only Fly Infinity branding, language selection and wallet connection. It does not load a public feed or sample posts.
2. The user connects a wallet on BNB Smart Chain (chain ID 56) and signs a short-lived one-use login challenge.
3. The Worker verifies the signature and checks `Owner_Exists(wallet)` in the Fly Infinity Network contract. The signature is a free off-chain message; it never authorizes a transaction, token transfer or spending.
4. After wallet verification, the user creates a username and password, or enters existing credentials. The feed is unavailable until password authentication succeeds.
5. New usernames are normalized to lowercase and must be 3–24 English letters, digits or underscores. A unique case-insensitive D1 index/constraint prevents duplicates; `GET /api/handles/check` is only a convenience check and the database remains authoritative.
6. Passwords must be 6–128 characters. They are stored as PBKDF2-SHA-256 hashes with a per-user random salt and 100,000 iterations (the Cloudflare Workers runtime limit), never as plaintext.
7. To recover a password, the wallet first obtains a short-lived recovery challenge and signs its explicit recovery message. The signature is verified server-side and the one-use nonce is consumed before the new password is saved. This is not a blockchain transaction and costs no gas. All prior sessions for that wallet are revoked and a new password-verified session is issued.

## Supported social features

- Posts contain optional text (up to 2,000 characters) and an optional image. Text-only, image-only and text-plus-image posts are supported.
- Images: PNG, JPEG or WebP, up to 15 MiB; the Worker checks MIME type and binary signature.
- Persistent likes: unique per wallet per original post.
- Persistent reposts: a repost is a separate feed event referencing the original post. The original post ID, image, text and original creator remain unchanged; the feed labels the wallet that reposted it. Duplicate reposts by the same wallet are prevented by a D1 unique constraint.
- Personalized feed: posts from the current wallet and followed profiles appear first, followed by a ranked selection of popular community posts.
- Explore: public image posts are ranked using likes, reposts and recency.
- Public profiles: each profile shows its posts, follower/following counts, and whether the viewer follows it; followers and following lists are browsable.
- Follows: profiles can be followed or unfollowed. Self-following is rejected and repeat follows do not create duplicate events.
- Notifications: the profile owner receives in-app notifications when another wallet follows them, likes one of their posts, or reposts one of their posts. Notifications can be marked individually or all at once.
- Users can delete their own original posts.
- There is no comments feature, audio, prompt library, creator directory, challenge or voting UI/API in the v2 public surface.

## API overview

### Health and account access
- `GET /api/health`
- `POST /api/auth/challenge` — `{ "address": "0x..." }`
- `POST /api/auth/verify` — `{ "address": "0x...", "nonce": "...", "signature": "0x..." }`
- `POST /api/profile/create` — `{ "handle": "...", "password": "..." }`
- `GET /api/handles/check?handle=...`
- `POST /api/auth/password` — `{ "handle": "...", "password": "..." }`
- `POST /api/auth/password/recovery/challenge`
- `POST /api/auth/password/recovery/verify` — `{ "nonce": "...", "signature": "0x...", "password": "..." }`
- `GET /api/me`
- `POST /api/auth/logout`

### Feed and posts
- `GET /api/feed?limit=30` — password-verified session; followed/self posts plus popular posts.
- `GET /api/explore?limit=36` — password-verified session; popular public posts.
- `GET /api/profiles/:handle?limit=40` — public profile summary and its posts.
- `GET /api/profiles/:handle/followers` and `GET /api/profiles/:handle/following` — connection lists.
- `POST|DELETE /api/profiles/:handle/follow` — follow or unfollow a profile.
- `GET /api/notifications?limit=50` — notifications and unread count.
- `PATCH /api/notifications/:id/read` and `POST /api/notifications/read-all` — mark notifications as read.
- `POST /api/media/upload` — binary image body with PNG/JPEG/WebP Content-Type.
- `POST /api/posts` — `{ "text": "...", "mediaKey": "uploads/..." }`; either field may be omitted, but not both.
- `DELETE /api/posts/:postId`
- `POST|DELETE /api/posts/:postId/like`
- `POST|DELETE /api/posts/:postId/repost`
- `GET /api/media/:key` — image is served only if attached to a published, unrestricted original post.

Protected endpoints require `Authorization: Bearer <sessionToken>`. Posting, uploads, likes, reposts and feed access require a password-verified session. Username checks, profile creation, login and recovery require a valid wallet-authenticated session.

## Storage and privacy

- Usernames and account metadata, password hashes, session hashes, posts, likes, follows, repost references, notifications and recovery nonces are stored in Social D1 only.
- Original images are kept in the private Backblaze B2 bucket; the B2 key is available only to the Worker and is never sent to the browser.
- The Worker serves image bytes only after D1 confirms that the image is attached to a published post.
- Old sessions become password-unverified after migration; existing wallet owners must create/set their Social password once. No existing profile or post is deleted by migrations 0002 or 0003.
- Moderation/report tooling is not presented as a live capability.

## Backblaze B2

Use one private bucket and an application key restricted to the bucket and the `uploads/` prefix. Required key capabilities: `readFiles`, `writeFiles`, `deleteFiles`. Do not use the Master Application Key.

The GitHub Actions repository secrets are:
- `FLY_SOCIAL_B2_ENDPOINT`
- `FLY_SOCIAL_B2_BUCKET`
- `FLY_SOCIAL_B2_KEY_ID`
- `FLY_SOCIAL_B2_APPLICATION_KEY`

Cloudflare deployment uses `CLOUDFLARE_SOCIAL_API_TOKEN` when available and falls back to the existing `CLOUDFLARE_API_TOKEN`. Do not change the shared token for Social deployment.

## Deploy and migrations

- Tests: `.github/workflows/fly-social-api-check.yml`
- Manual deploy: `.github/workflows/fly-social-api-provision.yml`
- The deploy workflow applies pending migrations remotely before deploying only `fly-infinity-social-api`.
- The workflow verifies the private B2 bucket with a temporary write/read/delete probe, deploys the Worker and checks health, CORS and wallet validation.
- Do not deploy or alter other Fly Infinity Workers or databases.

## Local validation

From `backend/`:

```bash
npm install
node --check social-api/src/index.js
node --check social-api/src/auth.js
node --check social-api/src/validation.js
node --test social-api/tests/*.test.js
python3 social-api/tests/schema-smoke.py
npx wrangler deploy --dry-run --outdir /tmp/social-api-dry-run --config=wrangler.social-api.toml
```


## Public image delivery

Published post images are served by the Social Worker from private Backblaze B2 storage. The Worker verifies in D1 that an image belongs to a published, unrestricted post before returning it. The response uses `Cross-Origin-Resource-Policy: cross-origin` because the public Social UI is hosted on GitHub Pages and the image API is hosted on `workers.dev`; keeping this header at `same-site` would cause browsers to block otherwise successful image responses.
