# PHASE_REPORT_A.md — Foundation (Scaffold · Schema · Ledger · Auth)

**Date:** 2026-07-19 · **Status:** ✅ Complete — all quality gates green, independently verified

---

## Completed Tasks

All of TASKS.md sections A1–A4 (21 atomic tasks):

| Area | Delivered |
|---|---|
| Repo/tooling | Monorepo git repo, NestJS 11 + strict TS scaffold, ESLint/Prettier/Jest, docker-compose (postgres:16 + redis:7, healthchecks), `.env.example` (every var documented), GitHub Actions CI (unit job + Postgres/Redis-service integration job) |
| Database | Full Prisma schema — 21 tables (10 TRD + 11 gap-fix), 15 enums, all mandated indexes; migration `0001_init` applied to live Postgres; idempotent seed (super-admin, ₹50/₹100/₹250 × 3 brands catalog, app_config + bonus_config defaults) |
| Ledger core | Single write path `LedgerService.record()` — transactional, row-locked, DB-constraint idempotency (duplicate = no-op), `balance_after` audit chain, write-through cache; `reserveDebit()`/`reverse()` (compensating rows, originals immutable); nightly reconciliation job with drift alerting (pluggable console/webhook) |
| User auth | `POST /api/auth/google` (FirebaseVerifier interface: mock driver for dev, firebase-admin for prod), device fingerprint capture, GeoIP stub, unique referral-code generation, referral linkage rows; JWT (aud=app, 15 m) + opaque refresh tokens (hashed, 30 d, rotation with reuse-detection → full revocation); banned users 403 |
| Admin auth | bcrypt login → TOTP (setup-on-first-login via QR, otplib) → admin JWT (aud=admin, role claim, 8 h); strict per-route throttles (5/min login); failed logins logged without credentials |
| RBAC/security | Audience-separated guards (app vs admin, both directions tested), `@Roles()` reviewer/super_admin matrix, global ValidationPipe (whitelist), global throttler (300/min), pino redaction extended to all token/password/code field names |

## Verification (run independently in the main session, not just agent-reported)

- `npm run build` / `typecheck` / `lint` — clean
- `npm test` with live DB: **95/95 passing** (90 unit + 5 real-Postgres integration)
- Integration coverage includes Testing-doc E2E #3 (reject reverses coins), #4 (duplicate postback credits once), #5 (parallel redemption race — one winner)
- Live smoke: server boot, `/healthz` 200, real token exchange, refresh rotation + reuse-detection 401 (agent-run; left one `smoke-uid` user in local dev DB)

## Environment milestones

Docker Desktop installed to `D:\Docker` (WSL2 backend, data on D:), postgres+redis containers healthy. Node/npm caches redirected to D:. Flutter/SDK already on D:.

## Remaining Tasks (project-wide)

Phases B–F per IMPLEMENTATION_PLAN.md — next up: B (adapter layer, postback pipeline, ads SSV, wallet API).

## Risks / Issues

- **No git commits yet** — the tree is entirely untracked. Recommend an initial commit checkpoint now that Phase A is verified (awaiting owner go-ahead, per convention).
- Prisma seed hook uses deprecated `package.json#prisma` config — migrate to `prisma.config.ts` before Prisma 7 (tracked, low).
- `reverse()` reuses the original `source_type` (TRD enum lacks `reversal`) — linked via `source_ref_id`; documented behavior, revisit only if reporting needs a distinct type.
- Real Firebase project credentials still pending (mock verifier in use) — owner-side task, non-blocking.

## Recommendations

1. Make the initial git commit (clean checkpoint before Phase B's large diff).
2. Create the three Firebase projects (dev/staging/prod) when convenient — only the prod one blocks launch.
3. Start offerwall/ad network signups (Strategy doc flags approval lead times).

## Next Phase

**B — Earning Pipelines:** provider adapter layer (offerwall ×4 + ad-SSV ×3 + gift-card interfaces, mock drivers, simulator CLI), postback webhook with fast-200 + BullMQ async pipeline, offers catalog + launch tokens, ad reward caps, wallet endpoints, rate limits, burst load test.
