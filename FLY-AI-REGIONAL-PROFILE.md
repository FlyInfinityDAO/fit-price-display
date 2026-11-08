# Fly AI regional profile

This feature adds a wallet-bound country profile to Fly AI. It does not infer country from language, browser locale, IP address, or wallet location.

## Data model
- D1 table: `user_profiles`
- Primary key: normalized wallet address (`address`)
- Stored fields: ISO 3166-1 alpha-2 `country_code`, selected interface `preferred_language`, and `updated_at`
- The profile is private to the authenticated wallet session and is not exposed publicly.

## API
- `GET /api/profile`: returns the authenticated wallet's profile, or `null` when no country has been saved.
- `PUT /api/profile`: saves the country and one of the supported interface languages. Requires the existing Fly AI JWT session.
- `POST /api/chat`: accepts the selected interface language and loads the saved country server-side. The model is explicitly instructed not to infer nationality, culture, residence, or legal jurisdiction from language.

## Deployment — do not skip
The code change alone does not update the live Worker or D1 database.

1. Review the feature branch first.
2. From the repository's `backend/` directory, apply the additive migration to the existing remote D1 database:
   `npx wrangler d1 migrations apply fly-ai-db --remote`
3. Confirm Wrangler reports migration `0002_user_profiles.sql` applied successfully.
4. Deploy the Worker from `backend/` only after reviewing the migration result:
   `npx wrangler deploy`
5. Publish the frontend branch only after testing the Worker and the country onboarding flow.

Migration `0002_user_profiles.sql` creates only the new `user_profiles` table. It does not alter or delete existing nonce, usage, or audit records. Do not create a new D1 database and do not replace the existing database binding.

## Manual smoke tests
- New eligible wallet: after signature verification, country dialog appears before chat can be used.
- Save a country: it is persisted in D1 against the wallet address.
- Reconnect same wallet on another browser/device: saved country is loaded without asking again.
- Change site language: country remains unchanged; country names and dialog copy follow the selected interface language.
- Change country in workspace settings: profile updates without reconnecting wallet.
- Send chat request: response language follows current site language and the country is supplied as context.
- Legal question: the assistant asks for a separate jurisdiction if the relevant legal venue is unclear.
- Existing wallet eligibility, tier checks, JWT, nonce handling, quota, and read-only chain access remain unchanged.

## Privacy and limitations
- The user chooses the country; no geolocation lookup is performed.
- Country is contextual information, not proof of physical presence, citizenship, tax residence, or legal jurisdiction.
- Legal answers must clarify the applicable jurisdiction when needed and must not be presented as guaranteed legal advice.
