# Fly Infinity — Infrastructure & Transfer Readiness Map

Last audited: 2026-11-09
Source of truth: `FlyInfinityDAO/fit-price-display`, branch `main`, repository configuration, and a read-only Cloudflare dashboard inspection.

## Non-negotiable repository policy

- Development and integration happen only in `FlyInfinityDAO/fit-price-display`.
- `FlyInfinityDAO/FlyInfinityDAO.github.io` is the final repository and must remain untouched until an explicit future transfer instruction.
- No transfer is currently planned. A delay of days or longer after project completion does not change this rule.
- A repository transfer is not a Cloudflare migration. Workers, D1 databases, Durable Objects, bindings, secrets, variables, routes, custom domains, cron triggers, and deployment settings must be inventoried and deliberately reconciled.
- Do not create a replacement database when an existing production database ID is already configured.
- Do not run production deployment workflows during routine validation. Production deploys require a deliberate manual dispatch and explicit confirmation.
- Keep the existing `fly-hokm-preview` Pages project. Do not delete it or promote it to production as part of this work.
- The game frontends are published from GitHub Pages. Cloudflare is used for APIs, D1, Durable Objects, and related backend resources. Preserve legacy Pages projects until their purpose is explicitly decided.

## Cloudflare account resources observed

Account: `Flyinfinityplatform@gmail.com's Account`
Account ID: `241418899c1f789e960db3ec328c1e29`

### Workers

| Worker | Purpose | Config source |
|---|---|---|
| `fly-ai-api` | Fly AI API | `backend/wrangler.toml` |
| `fly-chess-arena-api` | Chess Arena + Backgammon API | `games/chess-arena/worker/wrangler.toml` |
| `fly-hokm-api` | Hokm API | `games/hokm/worker/wrangler.toml` |

### D1 databases

| Database | ID | Region | Tables observed |
|---|---|---|---:|
| `fly-ai-db` | `be1d9f7e-09b9-42ae-818d-94eb50faede0` | APAC | 5 |
| `fly-chess-arena-db` | `eae175c6-d221-48b8-ba54-3b784475b192` | APAC | 9 |
| `fly-hokm-db` | `0f82c3fb-95f7-42d5-a2ca-9861d63b8948` | WNAM | 3 |

The database IDs above match the corresponding checked-in Wrangler configuration. These databases already exist. Treat their IDs as persistent production resources; never provision duplicates as part of ordinary deployment.

### Durable Objects

| Worker | Binding | Class | Migration tag |
|---|---|---|---|
| `fly-chess-arena-api` | `CHESS_ROOMS` | `ChessRoom` | `v1` |
| `fly-chess-arena-api` | `BACKGAMMON_ROOMS` | `BackgammonRoom` | `v2` |
| `fly-hokm-api` | `HOKM_ROOMS` | `HokmRoom` | `v1` |

Chess and Backgammon intentionally share one Worker and one D1, but use separate Durable Object classes and bindings. Do not split or rename these resources without a separately reviewed migration plan.

### Pages projects observed

| Project | Role/status | Repository connection |
|---|---|---|
| `fly-chess-arena` | Legacy/preview Pages resource; preserve pending architecture review | `FlyInfinityDAO/fit-price-display` was shown in the initial resource listing |
| `fly-hokm-preview` | Independent Hokm preview; preserve | No Git connection observed |

The authoritative integrated game frontend publishing path is the repository GitHub Pages workflow. Cloudflare Pages resources are not to be deleted or promoted by this transfer-readiness task.

## Worker configuration captured from the repository

| Worker | Compatibility date | Flags | D1 binding | Cron |
|---|---|---|---|---|
| Fly AI | `2026-11-04` | `nodejs_compat` | `DB → fly-ai-db` | none declared |
| Chess/Backgammon | `2026-10-01` | `nodejs_compat` | `DB → fly-chess-arena-db` | `17 * * * *` |
| Hokm | `2026-10-01` | `nodejs_compat` | `DB → fly-hokm-db` | `23 * * * *` |

## Secret and variable inventory (names only)

Never copy secret values into Git, this document, issue comments, or PR descriptions.

### Fly AI code-required runtime settings

- Wrangler vars in `backend/wrangler.toml`: `CHAIN_ID`, `FIT_TOKEN_ADDRESS`, `NETWORK_ADDRESS`, `MIN_TIER2_FIT`, `MIN_TIER3_FIT`, `MAX_INPUT_CHARS`, `MAX_OUTPUT_TOKENS`.
- Runtime secret/config names used by code: `JWT_SECRET`, `BSC_RPC_URL`, `AI_API_KEY`, `AI_MODEL`.
- Optional runtime variables used by code: `AI_PROVIDER`, `AI_BASE_URL`, `APP_ORIGIN`, `DAILY_REQUEST_LIMIT`.
- Verify presence and source (Wrangler vars vs Worker secrets) in Cloudflare before any future deployment. Do not assume GitHub Actions secrets mirror Cloudflare Worker secrets.

### Chess/Backgammon code-required runtime settings

- Wrangler vars: `FRONTEND_ORIGIN`, `FRONTEND_ORIGINS`, `BSC_RPC_URL`.
- Secret name used by code: `SESSION_SECRET`.
- GitHub deploy credentials, if a future deploy path is deliberately enabled: `CLOUDFLARE_API_TOKEN` (repository secret), `CLOUDFLARE_ACCOUNT_ID` (repository variable).

### Hokm code-required runtime settings

- Wrangler vars: `FRONTEND_ORIGIN`, `FRONTEND_ORIGINS`, `BSC_RPC_URL`.
- Secret name used by code: `SESSION_SECRET`.
- GitHub workflow credential names for a future approved Worker deploy: `CLOUDFLARE_API_TOKEN` (repository secret) and `CLOUDFLARE_ACCOUNT_ID` (repository variable). The deploy workflow does not overwrite the existing Worker `SESSION_SECRET`.
- Verify the actual configured names in Cloudflare and GitHub before future deployment. Values must never be exposed.

## GitHub Actions workflow inventory

This inventory is based on the workflow files currently checked into `.github/workflows/`. Schedules are UTC unless otherwise specified by GitHub.

| Workflow | Trigger | Side effects | Transfer note |
|---|---|---|---|
| `hokm-github-pages-publish.yml` | Push to `main` when site/game paths change; manual dispatch | Publishes the complete repository site to GitHub Pages | Intended development-site publisher; Pages permissions and deployment environment required |
| `fly-ai-check.yml` | PR/push affecting Fly AI, backend, or workflows | Installs dependencies and runs syntax checks | No deploy or secret write |
| `fly-games-validation.yml` | PR/push affecting games or workflows | Frontend syntax, Backgammon rules tests, Worker checks/security tests | No deploy or Cloudflare writes |
| `hokm-cloudflare-deploy.yml` | Manual dispatch on `main` with exact confirmation | Deploys Hokm Worker code only | Production-affecting; never dispatch without a separate explicit approval |
| `hokm-cloudflare-provision-d1.yml` | Manual dispatch on `main` with exact confirmation | Can create a new Hokm D1 only if a placeholder database ID is configured | Emergency-only; current real database ID should cause safe refusal |
| `hokm-pages-preview.yml` | Push to legacy `feature/hokm-four-player` paths or manual dispatch | Deploys isolated Hokm preview files to Cloudflare Pages; may create the Pages project if absent | Retain and review before any branch cleanup; preview URL is not the integrated production URL |
| `auto-update-airdrop.yml` | Every 6 hours; manual dispatch | Reads chain data and commits `airdrop-stats.json` to the checked-out branch | Requires write permission; uses GitHub token |
| `save-table-history.yml` | Every 6 hours; manual dispatch | Fetches CoinGecko prices and commits `price-history-table.json` | Requires write permission; uses external API |
| `update-crypto-cache.yml` | Every 6 hours; manual dispatch | Runs cache updater and attempts to commit `crypto-cache.json` | Workflow currently has no explicit `contents: write`; verify effective token permissions and run health |
| `update-price.yml` | Daily; manual dispatch | Runs price updater and pushes `price-history.json` to `main` | Direct main-branch write; retain only if this automated behavior is still intended |
| `update-trading-volume.yml` | Every 6 hours; manual dispatch | Scans chain and commits trading-volume data/progress files | Requires write permission; uses GitHub token |

### Workflow audit findings and cautions

- The price/cache/history/airdrop/trading-volume jobs are operational automations, not validation-only workflows. A future repository move must preserve or intentionally replace their schedules, token permissions, API dependencies, and commit targets.
- `update-price.yml` explicitly pushes to `main`; the other scheduled writers commit and push the checked-out branch. Verify default branch and permissions after any repository change.
- `update-crypto-cache.yml` does not declare explicit `permissions: contents: write`; its push may depend on repository-level default token permissions. Do not change permissions without verifying whether the workflow is still used.
- `hokm-pages-preview.yml` is tied to the legacy `feature/hokm-four-player` branch and Cloudflare credentials. Do not delete the branch, workflow, or preview resource until their relationship and current usage are deliberately reviewed.
- The preview host appears in both the Hokm Wrangler CORS allowlist and preview workflow. The checked-in hostname is `hokm-preview.fly-hokm-preview.pages.dev`; the Cloudflare project root observed earlier was `fly-hokm-preview.pages.dev`. Treat these as distinct hostnames and verify the deployed custom/subdomain mapping before changing either.
- CI validation added in PR #42 checks the named frontend scripts and Backgammon rules engine. It is not a full browser/device end-to-end test and does not prove wallet-provider or live multiplayer behavior.

## Deployment and migration rules

1. All Worker source/config changes are reviewed in a branch and PR first.
2. Syntax checks and tests must run before merge.
3. A production deploy is a separate, explicit operation; do not infer deploy permission from permission to edit a workflow.
4. Apply only the existing database's checked-in migrations. Never run `wrangler d1 create` when the real database ID is already present.
5. D1 schema migrations and Worker code deployments are separate operations. The Hokm code-deploy workflow does not apply remote D1 migrations or rotate `SESSION_SECRET`.
6. Durable Object class changes require deliberate migration review; do not rename bindings/classes casually.
7. Confirm the intended frontend origins before changing CORS configuration.
8. Preserve current account IDs, database IDs, Worker names, bindings, compatibility dates, cron schedules, and production URLs unless a reviewed migration plan explicitly changes them.
9. Keep a rollback reference to the last known-good commit and Worker deployment before any future production deployment.

## Dependency and reproducibility inventory

| Component | Runtime/dependency evidence | Reproducibility concern |
|---|---|---|
| Root repository | Root `package.json` declares `ethers ^5.7.2` | No root lockfile was present in the audited file list |
| Fly AI Worker | `backend/package.json` declares `ethers ^6.13.5`, Wrangler `^3.99.0` | No `backend/package-lock.json` was present in the audited file list |
| Chess/Backgammon Worker | Declares `ethers ^6.15.0`, `chess.js ^1.4.0`, Wrangler `^4.20.0` | No worker package lock was present in the audited file list |
| Hokm Worker | Declares `ethers ^6.15.0`, Wrangler `^4.20.0` | No worker package lock was present in the audited file list |
| GitHub Actions | Uses major-version tags such as `@v4` and `@v5` | Action tags are not pinned to immutable commit SHAs |

Do not generate or commit lockfiles blindly. First run each package's install/test flow in an isolated branch, inspect the generated lockfile and runtime compatibility, then add it in a separate reviewed PR. Pinning third-party Actions to verified commit SHAs is a separate supply-chain hardening task.

## Known follow-up checks

- Verify Cloudflare Worker secret/variable presence by name only and compare it with the code-required inventory above.
- Record exact Worker routes/domains, deployment versions, and any account-level custom domains.
- Record exact D1 table names and migration histories, not only counts.
- Confirm the complete Pages build settings and clarify the legacy `fly-chess-arena` project's role without deleting it.
- Verify GitHub Pages settings and confirm the deployed URL for each frontend.
- Confirm whether the legacy Hokm preview branch/workflow and scheduled data-update workflows are still required.
- Verify the effective GitHub Actions token permissions for every scheduled writer.
- Review dependency lockfile strategy and pin Actions to immutable SHAs only after compatibility review.
- Run browser/device tests for wallet connection, mobile layouts, and live multiplayer in a non-production preview; CI syntax checks alone do not cover these behaviors.

## Live Cloudflare reconciliation — 2026-11-09

This section records a second read-only dashboard inspection and comparison with the checked-in Wrangler files. It supersedes earlier incomplete observations where noted; it does not authorize configuration changes.

### Pages deployment state observed

| Project | Live production state | Repository/build state | Transfer implication |
|---|---|---|---|
| `fly-chess-arena` | Active production deployment from branch `feature/chess-arena-games`, commit `cc8e246` (observed 2026-11-07) | Connected to `FlyInfinityDAO/fit-price-display`; build command `bash games/chess-arena/build-pages.sh`; output `dist`; production branch is `feature/chess-arena-games` | This is a legacy Pages production path and is not aligned with the current `main`-based GitHub Pages publishing plan. Do not change its branch or deploy from `main` until the replacement/publication path has been verified end-to-end. |
| `fly-hokm-preview` | No production deployment observed; preview deployment history exists | No Git repository connection or build configuration displayed; subdomain `fly-hokm-preview.pages.dev` | Preserve as a legacy preview. Do not promote or delete. |

The Cloudflare Pages project subdomain `fly-hokm-preview.pages.dev` differs from the Hokm Worker CORS allowlist entry `https://hokm-preview.fly-hokm-preview.pages.dev`. Verify whether the latter is an intentional custom hostname/alias before any CORS or DNS change.

### Worker live state observed

| Worker | Live binding/domain observations | Git/deployment observations |
|---|---|---|
| `fly-ai-api` | `workers.dev` subdomain only; D1 binding `DB → fly-ai-db`; no DO or Service bindings observed | Git repository `FlyInfinityDAO/fit-price-display` shown |
| `fly-chess-arena-api` | `workers.dev` subdomain; D1 binding `DB → fly-chess-arena-db`; DO bindings `CHESS_ROOMS` and `BACKGAMMON_ROOMS` | Git repository `FlyInfinityDAO/fit-price-display` shown |
| `fly-hokm-api` | Latest observed version `9d784e27` Ready; `workers.dev` subdomain only; D1 binding to `fly-hokm-db`; DO binding `HOKM_ROOMS` → dashboard class label `fly-hokm-api_HokmRoom` | Git integration not connected; recent versions shown as manually deployed by API token. Checked-in Wrangler class is `HokmRoom`; do not rename it based on the dashboard's display label. |

No custom Worker routes/domains were observed for these three Workers; they use their `workers.dev` hostnames. Secret values were not opened or recorded.

### D1 live observations and source reconciliation

| Database | Live count / region | Live schema evidence | Checked-in migration evidence |
|---|---|---|---|
| `fly-ai-db` | 5 tables; 65.54 kB observed | `auth_nonces`, `d1_migrations`, `user_profiles`, `chat_audit`, `usage` visible | `0001_init.sql` creates auth_nonces, usage, chat_audit; `0002_user_profiles.sql` creates user_profiles. The visible schema is consistent with both migrations having been applied; the migration table is present. |
| `fly-chess-arena-db` | 9 tables; APAC (from prior inventory) | Exact live table names were not captured in this inspection | Checked-in migrations create `wallet_nonces` and `websocket_tickets`; reconcile all nine live tables against runtime-created tables and migration history before any schema operation. |
| `fly-hokm-db` | 3 tables; WNAM; 49.15 kB observed | `wallet_nonces` and `api_rate_limits` visible; third table name not captured | `0001_init.sql` creates the two named application tables. Do not assume the identity of the third table until a read-only schema listing confirms it. Migration metadata was not visible in the dashboard inspection. |

The live database IDs continue to match the IDs in the checked-in Wrangler files. No SQL was executed and no database was changed during this audit.

### Outstanding reconciliation before any migration or production change

1. Capture exact table names and migration history for `fly-chess-arena-db` and `fly-hokm-db` using a strictly read-only schema inspection.
2. Verify all three Workers' actual variable/secret *names and presence* against the code-required inventory; never read secret values.
3. Confirm GitHub Pages publication URL/settings independently of the legacy Cloudflare Pages production branch.
4. Decide, only after end-to-end verification, whether `fly-chess-arena` is retained as a legacy production fallback or eventually retired. No deletion or promotion is authorized by this audit.
5. Establish a reproducible deployment path for `fly-hokm-api` in GitHub Actions only after confirming the existing deployment credentials and rollback plan; do not connect or deploy automatically.

No Worker, Pages project, D1 database, Durable Object, secret, variable, route, or production deployment was modified by this audit.

## Change log

- 2026-11-09: Initial read-only Cloudflare and repository inventory. No Worker, Pages, D1, Durable Object, secret, variable, or production deployment setting was changed by the audit.
- 2026-11-09: Expanded the inventory to include all checked-in GitHub Actions workflows, their triggers/side effects, dependency reproducibility observations, and outstanding preview-host verification. Documentation-only change; no production resource or workflow execution setting was changed.


## Authenticated Cloudflare Worker settings audit — 2026-11-09

A subsequent authenticated, read-only inspection of the Cloudflare dashboard was completed using the saved TinyFish browser profile. All three Worker settings pages were accessible. No settings were edited, no deployment was triggered, and no secret values were opened or recorded.

### Live Worker settings and production branches

| Worker | Production branch shown in dashboard | Configured non-secret variable names | Secret names confirmed present | Bindings confirmed |
|---|---|---|---|---|
| `fly-ai-api` | `feat/fly-ai-v1` | `AI_BASE_URL`, `AI_MODEL`, `AI_PROVIDER`, `CHAIN_ID`, `FIT_TOKEN_ADDRESS`, `MAX_INPUT_CHARS`, `MAX_OUTPUT_TOKENS`, `MIN_TIER2_FIT`, `MIN_TIER3_FIT`, `NETWORK_ADDRESS` | `JWT_SECRET`, `BSC_RPC_URL`, `AI_API_KEY` | `DB → fly-ai-db` |
| `fly-chess-arena-api` | `feature/chess-arena-games` | `BSC_RPC_URL`, `FRONTEND_ORIGIN`, `FRONTEND_ORIGINS` | `SESSION_SECRET` | `DB → fly-chess-arena-db`; `CHESS_ROOMS → ChessRoom`; `BACKGAMMON_ROOMS → BackgammonRoom` |
| `fly-hokm-api` | Not explicitly shown in the inspected settings page | `BSC_RPC_URL`, `FRONTEND_ORIGIN`, `FRONTEND_ORIGINS` | `SESSION_SECRET` | `DB → fly-hokm-db`; `HOKM_ROOMS → HokmRoom` (dashboard display label includes the Worker prefix) |

All three Workers were shown in the Production environment. For Fly AI, `AI_MODEL` is a non-secret Variable, not a Secret. The expected Fly AI secret names `JWT_SECRET`, `BSC_RPC_URL`, and `AI_API_KEY` were present. No secret values were exposed.

### Important branch divergence

The dashboard reports `feat/fly-ai-v1` for Fly AI and `feature/chess-arena-games` for Chess/Backgammon, rather than the development repository's `main` branch. This is a material source-of-truth and future-transfer concern: do not change either Worker Git connection, production branch, or deploy source until the branch contents have been compared with current `main` and a deliberate cutover/rollback plan is approved. This audit made no branch or deployment changes.

### D1 inspection limitation and reconciliation status

The authenticated dashboard's standard D1 Overview/Settings pages did not expose table names or migration history for `fly-chess-arena-db` or `fly-hokm-db`. Accessing the Console would permit query execution, so it was intentionally not used. No SQL, schema query, or migration command was run.

Consequently, the table counts and partial table-name observations in the earlier live-audit section remain historical observations only; this latest pass did not independently verify the full schema or migration history. Do not infer that missing table names indicate missing tables. A separate explicitly authorized, read-only schema inspection is still required before any D1 migration or schema modification.

### Confirmed secret/variable presence only

This inspection confirmed the expected secret *names* listed above, not their values, validity, rotation age, or runtime functionality. Non-secret variable values were visible in the dashboard but are intentionally omitted from this transfer document. Never copy secret values into repository files.

No Worker, Pages project, D1 database, Durable Object, variable, secret, route, or production deployment was modified during this authenticated audit.


- 2026-11-09: Added authenticated Cloudflare Worker settings/secret-name audit, production branch observations, and explicit D1 dashboard inspection limitations. Documentation-only; no Cloudflare resource changed.


## Production-branch content reconciliation — 2026-11-09

Compared the current development `main` tree (`2f440e7bb03865f08196297d30bf7fe4dde7bc9f`) with the two Cloudflare-connected production branches observed in the authenticated dashboard. This was a Git object/tree comparison only; no branch, Worker, Pages project, D1 database, or deployment was changed.

### Chess / Backgammon / Hokm branch

Compared `feature/chess-arena-games` (`cc8e2469da726b14148e2898877a63a470782114`) with `main`:

- Of 45 files under `games/chess-arena/`, `games/backgammon/`, and `games/hokm/` present in the production branch tree, 40 have identical Git blob contents in `main`.
- Five existing paths have different contents: the Chess Worker README, Hokm Worker README, `games/hokm/css/hokm.css`, `games/hokm/js/hokm-play.js`, and `games/hokm/js/hokm.js`.
- `main` additionally contains `games/hokm/tests/hokm-browser-smoke.mjs`, which is absent from the production branch tree.
- The checked runtime-critical files for the Chess/Backgammon Worker (entry point, security module, Wrangler config, package manifest), and Hokm Worker (entry point, security module, Wrangler config), are byte-for-byte identical between the two refs. The Backgammon frontend and rules-engine files checked are also identical.
- The meaningful runtime differences found in this sampled tree are concentrated in Hokm's frontend. `main` contains newer shared-game shell styling, extra card touch handling for embedded mobile WebViews, and scroll-position preservation on language changes. The production branch contains some Hokm-specific error translation/status handling that is not present in the current `main` versions. Therefore, neither side should be blindly copied over the other; reconcile these focused Hokm changes deliberately if the Cloudflare Pages project still uses this branch.

### Fly AI production branch

Compared `feat/fly-ai-v1` (`d3d2e0c62bee188f8405f8ec85ff2a55574113c7`) with `main`:

- Of 10 files under `fly-ai/` and `backend/` present in the production branch tree, six have identical Git blob contents in `main`.
- Four paths differ: `backend/src/index.js`, `fly-ai/css/fly-ai.css`, `fly-ai/js/app.js`, and `fly-ai/js/i18n.js`.
- `main` additionally contains `backend/migrations/0002_user_profiles.sql`, absent from the production branch tree.
- The checked `backend/wrangler.toml`, `backend/src/ai-provider.js`, `backend/package.json`, `fly-ai/index.html`, and `fly-ai/js/config.js` are byte-for-byte identical.
- The newer `main` version adds country/region profile UI, language-aware prompts, profile GET/PUT API endpoints, and persistence through the `user_profiles` table/migration. The production branch versions of the AI frontend and Worker entry point do not contain those additions.
- The authenticated Cloudflare audit previously observed `user_profiles` in the live `fly-ai-db`. That suggests the database may already have the profile schema, but it does not prove that the currently deployed Worker serves the newer profile endpoints. The Cloudflare Worker dashboard showed `feat/fly-ai-v1` as the connected production branch, so this is a concrete source/deployment consistency risk that must be verified with a read-only live API check before any branch or deployment change.

### Interpretation and safe next steps

The ahead/behind commit counts are not a reliable measure of missing runtime functionality because these branches have diverged histories and several paths are identical Git blobs despite the history divergence. The file-tree/content comparison is the stronger evidence.

Do not merge either production branch wholesale into `main`, do not change Cloudflare Git connections or production branches, and do not deploy from either branch as a reconciliation shortcut. Keep `main` as the development source of truth. Next, verify the live Fly AI profile endpoint behavior without changing data, then decide whether any small, isolated Hokm frontend differences need to be reconciled. Preserve current production behavior until those checks and browser tests are complete.

No source code, workflow, Worker configuration, Pages configuration, D1 schema, secret, variable, route, or production deployment was modified during this comparison.

- 2026-11-09: Added Git tree/blob reconciliation of the two Cloudflare-connected production branches against development main. Documentation-only; no production change.


## Fly AI live profile endpoint smoke check — 2026-11-09

After the branch-content comparison, a read-only unauthenticated GET was made to the live Fly AI Worker endpoint:

- URL: `https://fly-ai-api.flyinfinityplatform.workers.dev/api/profile`
- Response: `{"error":"Invalid session"}`
- The route returned an authentication/session error rather than a missing-route 404. This confirms that the live Worker currently recognizes the protected `/api/profile` route.
- No wallet was connected, no signature was requested, no profile was read or changed, and no POST/PUT request was made.

This live result reduces the earlier concern that the deployed Worker might lack the profile route, despite the Cloudflare dashboard showing the older `feat/fly-ai-v1` Git-connected production branch. It does not identify the exact deployed source commit, prove that an authenticated profile read succeeds, or validate profile persistence against D1. Those require a separate authenticated test and should not be attempted without the user's explicit approval to connect/sign with a wallet. Do not change the Cloudflare Git connection or deploy source based on this smoke check alone.

No production resource or repository source code was modified by the endpoint test.

- 2026-11-09: Recorded unauthenticated live Fly AI profile-route check; protected endpoint exists. No authenticated profile access or writes performed.
