# Fly Infinity Audio Studio

## Production integration
- Frontend: `fly-ai/index.html`
- Specialist card: `data-assistant="audio-studio"`
- Workspace script: `fly-ai/js/audio-studio.js`
- UI logic: `fly-ai/js/app.js`
- Supported interface languages: English, Persian, Arabic, Turkish, Russian, Chinese, Spanish and Portuguese.

Audio Studio remains behind the existing Fly Infinity wallet verification gate. Wallet signatures are free and do not authorize transactions.

## Free capabilities
1. **Browser voice-over:** uses the browser's built-in Web Speech API. The selected Fly AI interface language determines the requested speech locale. Actual voices and language coverage depend on voices installed or made available by the user's browser/device. This feature runs locally and does not call an API, consume cloud credits, or create a downloadable recording.
2. **Music Maker:** renders original short algorithmic instrumental compositions in the browser with Web Audio API and exports WAV. It is not a generative AI music model; the prompt is used as a deterministic variation seed rather than interpreted semantically.
3. **Sound Effects:** locally synthesizes chime, magic sparkle, whoosh, laser, impact and rain ambience; exports WAV.

## Full AI music (external service)
The Music Maker panel links to ACE Music's hosted ACE-Step page: https://acemusic.ai/ace-step/. Users must sign in to ACE Music and explicitly select **ACE-Step v1.5 XL**. ACE Music's current Terms state that this model does not consume generation credits and permits commercial use under those Terms. Other models may consume credits and have different use rights. This is an external service; no API integration, account sharing or automated generation is performed by Fly Infinity.

## No paid or metered audio API
Cloudflare Workers AI speech generation and the no-wallet preview endpoint are disabled. The production and test Wrangler configurations no longer bind Workers AI. The legacy Audio Worker routes return HTTP 410 and cannot invoke a speech model. The local browser tools do not depend on the Audio Worker or D1 database.

No voice text, audio recording, or generated local audio is uploaded to Fly Infinity servers by these browser-only tools.


## Natural AI voice (Gemini TTS)
- Production endpoint: `POST /api/audio/tts` on `fly-infinity-audio-api`.
- Provider key: `GEMINI_API_KEY`, configured only as a Cloudflare Worker **Secret**. Never place it in GitHub source, `config.js`, browser storage, D1, or a request body.
- The app authenticates the wallet with the existing Audio Studio free-signature challenge before each 30-minute session. The API rechecks Fly Infinity Network ownership and applies daily per-wallet quotas (Tier 1: 2, Tier 2: 4, Tier 3: 8) plus the existing shared 1,200-character daily ceiling.
- The user's text is forwarded to Google Gemini and is not stored by Fly Infinity. Google's free tier may use submitted content to improve its products; the UI discloses this and advises against entering sensitive text.
- The no-wallet QA endpoint remains separate and is not used by production UI.
- To activate: in Cloudflare Dashboard, open Workers & Pages → `fly-infinity-audio-api` → Settings → Variables and Secrets → Add → Secret. Set the name to `GEMINI_API_KEY`, paste a dedicated Gemini API key as the value, and save. The value must never be committed or sent in chat.
