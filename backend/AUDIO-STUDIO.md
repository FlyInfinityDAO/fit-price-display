# Fly Infinity Audio Studio

## Deployment layout
- Production Worker: `fly-infinity-audio-api`
- Production D1: `fly-infinity-audio-db`
- No-wallet test Worker: `fly-infinity-audio-test`
- No-wallet test D1: `fly-infinity-audio-test-db`
- Production site integration: `fly-ai/index.html`, card `data-assistant="audio-studio"`

The audio service has its own wallet challenge, one-use nonce, short-lived session and D1 usage tables. It verifies BNB Smart Chain `Owner_Exists` and the live FIT balance independently from Fly AI chat and the Image Studio. Wallet signatures are free and do not authorize transactions.

## Current capabilities
1. **AI voice-over:** Cloudflare Workers AI `@cf/deepgram/aura-1`. It currently supports English speech only. The audio bytes are streamed to the browser; no generated recordings are stored in D1.
2. **Music Maker:** original algorithmic instrumental compositions rendered locally with the browser Web Audio API and exported as WAV. This does not call an AI music model or consume model API credits.
3. **Sound Effects:** locally synthesized chime, magic sparkle, whoosh, laser, impact and rain ambience; exported as WAV.

The audio UI is translated into the eight Fly AI interface languages. This does not mean the current free voice model speaks all eight languages; voice-over is explicitly English-only in this initial release.

## Quotas and free-capacity guard
- Tier 1: 2 voice generations/day
- Tier 2: 4 voice generations/day
- Tier 3: 8 voice generations/day
- Each cloud voice request: maximum 300 characters
- Shared cloud voice budget: 1,200 characters/day

Cloudflare Workers AI has a shared 10,000-Neuron daily free allocation. The audio character cap is deliberately conservative because it shares that account-level allowance with the separately deployed Image Studio. The exact available capacity can vary with other Workers AI usage on the account.

## Paid AI music boundary
Full-song AI music providers are not activated. Google Lyria 3.5 is currently listed at $0.08 per full track and has no free tier in the Gemini API pricing. `POST /api/audio/music` returns HTTP 402 with an explicit message until a paid provider and its budget are approved. The local Music Maker remains available without a paid API.

Meta MusicGen is not used in production: its model weights are published under CC-BY-NC 4.0, which is not suitable for an ordinary commercial production service.

## No-wallet test environment
The isolated test Worker exposes `POST /api/audio/preview` only when `AUDIO_PREVIEW_ENABLED=true` and only from the exact test origin. It has a separate D1 and a small daily preview allowance. The production Worker does not enable this route.

## Data handling
D1 stores short-lived authentication nonces, SHA-256 hashes of session tokens, wallet/day quota counters and global daily character usage. Generated audio is streamed back; the service does not persist user narration text or resulting audio files.
