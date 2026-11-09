# Fly Infinity — Infrastructure & Transfer Readiness Map

Last audited: 2026-11-09
Source of truth: `FlyInfinityDAO/fit-price-display`, branch `main`, plus a read-only Cloudflare dashboard inspection.

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
- Current GitHub workflow credential names: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `HOKM_SESSION_SECRET`. The workflow maps `HOKM_SESSION_SECRET` into the Worker secret named `SESSION_SECRET`.
- Verify the actual configured names in Cloudflare and GitHub before future deployment. Values must never be exposed.

## Deployment and migration rules

1. All Worker source/config changes are reviewed in a branch and PR first.
2. Syntax checks and tests must run before merge.
3. A production deploy is a separate, explicit operation; do not infer deploy permission from permission to edit a workflow.
4. Apply only the existing database's checked-in migrations. Never run `wrangler d1 create` when the real database ID is already present.
5. Durable Object class changes require deliberate migration review; do not rename bindings/classes casually.
6. Confirm the intended frontend origins before changing CORS configuration.
7. Preserve current account IDs, database IDs, Worker names, bindings, compatibility dates, cron schedules, and production URLs unless a reviewed migration plan explicitly changes them.
8. Keep a rollback reference to the last known-good commit and Worker deployment before any future production deployment.

## Known follow-up checks

- Verify Cloudflare Worker secret/variable presence by name only and compare it with the code-required inventory above.
- Record exact Worker routes/domains, deployment versions, and any account-level custom domains.
- Record exact D1 table names and migration histories, not only counts.
- Confirm the complete Pages build settings and clarify the legacy `fly-chess-arena` project's role without deleting it.
- Verify GitHub Pages settings and confirm the deployed URL for each frontend.
- Audit every remaining workflow for branch filters, checkout refs, secrets, remote migration commands, and deployment side effects.
- Run frontend/backend tests in CI; never use a production deployment as a test.

## Change log

- 2026-11-09: Initial read-only Cloudflare and repository inventory. No Worker, Pages, D1, Durable Object, secret, variable, or production deployment setting was changed by the audit.
