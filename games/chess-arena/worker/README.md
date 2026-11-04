# Fly Chess Arena API

This is a separate Cloudflare Worker. It does not share the Fly AI Worker or its D1 database.

## What is implemented

- Wallet challenge with a short-lived, one-use nonce.
- Personal-signature verification; the recovered signer must match the submitted wallet.
- BNB Smart Chain verification (chain ID 56).
- Server-side FIT Token `balanceOf(wallet)` check; minimum is exactly `10^18` base units (1 FIT, 18 decimals).
- Short-lived HMAC-signed session token.
- Session endpoint rechecks FIT balance, so a wallet falling below 1 FIT loses eligibility.
- No Network contract registration check, no FIT transfer, no approval, and no transaction.

## Deploy setup

Run these commands from this directory:

```bash
npm install
npx wrangler d1 create fly-chess-arena-db
```

Copy the returned D1 database ID into `wrangler.toml` in place of `REPLACE_WITH_D1_DATABASE_ID`. Then run:

```bash
npx wrangler d1 migrations apply fly-chess-arena-db --remote
npx wrangler secret put SESSION_SECRET
```

For `SESSION_SECRET`, use a random secret of at least 32 characters. Do not commit it to GitHub.

Check that `FRONTEND_ORIGIN` in `wrangler.toml` is the exact origin serving the game page (scheme + host, without a trailing slash). You may set a reliable BSC RPC endpoint in `BSC_RPC_URL`.

Deploy only after the D1 database ID and secret are configured:

```bash
npx wrangler deploy
```

## API

- `GET /api/health`
- `POST /api/auth/challenge` JSON: `{ "address": "0x..." }`
- `POST /api/auth/verify` JSON: `{ "address": "0x...", "nonce": "...", "signature": "0x..." }`
- `GET /api/auth/session` header: `Authorization: Bearer <sessionToken>`

The frontend must sign the exact `message` returned by the challenge endpoint, then submit that signature to verify. The signature is a wallet login proof only; it is not a token-transfer approval.

## Not yet included

Real-time rooms, matchmaking, chess move validation, clocks, rating calculations, and leaderboard endpoints are a later phase. Do not present the game as live multiplayer until those services are implemented and tested.
