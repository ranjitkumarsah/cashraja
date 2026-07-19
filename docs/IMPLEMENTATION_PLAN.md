# IMPLEMENTATION_PLAN.md — Coin Rewards / Offerwall App ("Cash Raja")

**Generated:** 2026-07-19 · **Phase:** 4 — Implementation Plan
**Scope decision:** Full v1 feature set, built phase-by-phase with a PHASE_REPORT checkpoint after each phase.

Build phases (A–F) are ordered by dependency and risk (ledger first, cosmetics last), not by the PRD's market-rollout phases — everything in PRD Phases 1–2 plus fraud v1 lands in this build.

---

## Phase A — Foundation: Scaffold, Schema, Ledger Core, Auth

**Goal:** Running monorepo where a Google-authenticated user exists in Postgres and every coin movement flows through one idempotent, tested ledger path.

**Tasks:** repo/git init · backend scaffold (NestJS+Prisma+config/env layers) · docker-compose (postgres+redis) · full Prisma schema + initial migration + seed (admin, gift-card catalog, app_config defaults) · LedgerService (record/idempotency/reserve-reverse/balance) · user auth (Firebase verify → JWT + refresh rotation) · admin auth (bcrypt+TOTP, separate audience) · devices table capture · guards/RBAC skeleton · pino logging · error filters · CI workflow (backend).

**Dependencies:** environment decision (DB/Redis availability). Firebase project creds can be stubbed (verifier behind interface, mock driver in dev).
**Deliverables:** `backend/` boots; `POST /api/auth/google` (mock verifier) issues tokens; ledger unit + property tests green; CI green.
**Complexity:** High (correctness-critical core). **Risks:** idempotency race conditions — mitigated with DB-constraint-first design + concurrency tests.
**Validation:** unit suite (ledger paths, dup-key no-op, reserve/reverse), balance invariant property test, auth integration tests.
**DoD:** All Phase-8 quality gates green; PHASE_REPORT_A.md written.

## Phase B — Earning Pipelines: Offerwall Postbacks, Ad SSV, Wallet API

**Goal:** Coins can be earned end-to-end through mock networks exactly as they will be through real ones.

**Tasks:** provider adapter layer (offerwall × 4 skeletons + mock, ad-SSV × 3 + mock) · postback webhook (HMAC verify → persist → enqueue → 200) · BullMQ worker pipeline (fraud pre-check hook → ledger credit → notification hook) · offers module (catalog CRUD-lite, eligibility filter, launch tokens) · offer_completions status flow (pending/credited/rejected + 30-day expiry job) · ad reward flow (SSV verify → capped credit) · wallet endpoints (balance, paginated ledger, pending credits) · postback simulator CLI · rate limiting.

**Dependencies:** Phase A. **Deliverables:** simulator-driven E2E: signed mock postback → credited coins → visible in wallet; duplicate postback = no-op. **Complexity:** High. **Risks:** per-network signature scheme fidelity — skeletons marked `NEEDS_CREDENTIALS`, verified against network docs at integration time.
**Validation:** integration tests per adapter (valid/invalid/replay), burst load test on webhook (<500ms p95 response), cap enforcement tests.
**DoD:** gates green; PHASE_REPORT_B.md.

## Phase C — Redemption, Gift-Card Inventory, Admin Panel

**Goal:** Full money-out path with human approval gate, plus the operational cockpit.

**Tasks:** gift-card catalog + coin-cost table · manual inventory (CSV/paste upload, AES-256-GCM encrypt, unused/reserved/issued lifecycle) · redemption flow (reserve-debit at request, status machine, reject-reverse, approve→issue-from-inventory, in-app delivery) · fulfillment retry queue · admin API (users, ledger view, flag/ban, audited balance adjust, redemption queue, postback logs, config management, admin management, CSV export) · metrics aggregation job + dashboard endpoints (DAU, issued vs redeemed, completion rates, outstanding liability) · **React admin panel** (all features, premium theme, RBAC-gated routes) · account deletion endpoint (anonymize-in-place).

**Dependencies:** Phases A–B. **Deliverables:** E2E scenarios 2, 3 (approve/reject) pass; admin panel operational against seeded data. **Complexity:** High (largest surface). **Risks:** scope sprawl in admin UI — held to PRD §6.9 features only.
**Validation:** RBAC negative tests (reviewer genuinely blocked server-side), approve/reject/reversal integration tests, dashboard numbers spot-checked against raw ledger, concurrent-redemption race test (E2E #5).
**DoD:** gates green; PHASE_REPORT_C.md.

## Phase D — Engagement: Game, Streaks, Scratch/Spin, Referral

**Goal:** The retention layer, server-authoritative throughout.

**Tasks:** game module (round issue → complete, min-play-time check, daily caps, difficulty tiers) · streak module (IST calendar-day, day-1→7 escalating bonus, claim endpoint) · bonus module (server-rolled weighted probability tables from `bonus_config`, attempt limits, ad-view/streak unlock hooks) · referral module (code generation, redeem-at-signup, % of referred earnings for capped window, snapshot rates, self-referral device/IP block, referrer stats endpoint).

**Dependencies:** Phase A (ledger), B (fraud hooks), C (config). **Deliverables:** all four earning sources credit correctly under caps; E2E #6 passes. **Complexity:** Medium. **Risks:** farming vectors — every path has a dedicated fraud-rule test.
**Validation:** anti-replay tests (round reuse rejected), cap boundary tests, probability-table distribution test, referral window expiry test.
**DoD:** gates green; PHASE_REPORT_D.md.

## Phase E — Fraud Engine v1, Notifications, Flutter App

**Goal:** All five TRD fraud rules live; complete premium-themed Flutter app on mock SDKs.

**Tasks:** fraud rules (multi-account, offer velocity, self-referral, round farming, new-account redemption abuse) + Redis sliding windows + auto-actions + admin review queue · notifications (FCM service, in-app inbox, triggers: credit, redemption status, streak reminder) · **Flutter app:** design system (Raja theme) → auth flow → home (balance, streak, CTAs) → game screen → tasks/offerwall tab (webview + pending/credited states) → rewarded-ad flow (mock service) → wallet/ledger → scratch/spin → invite & earn → redemption store + history → inbox → profile/settings (incl. account deletion) · mock SDK abstractions + dev-only "simulate earn" hooks.

**Dependencies:** A–D APIs. **Deliverables:** full app flows on emulator against local backend; E2E #7 (banned user blocked) passes. **Complexity:** High (app surface). **Risks:** Windows Android-emulator variance; Adjoe platform-channel deferred to credential time (stub in place).
**Validation:** fraud-rule test-per-rule (Testing §2.3), window-expiry tests, Flutter widget tests (wallet, offer list, redemption states), integration test of auth→home.
**DoD:** gates green; PHASE_REPORT_E.md.

## Phase F — Hardening, E2E, Deployment, Final Docs

**Goal:** Ship-ready: every Testing-doc scenario scripted and green, deploy artifacts done, docs complete.

**Tasks:** full E2E suite (Testing §5 scenarios 1–7, scripted) · load tests (webhook burst, redemption/game endpoints w/ rate limits) · staging seed data at volume (thousands of ledger rows/user) · reconciliation + drift alerting finalized · security pass (headers, secrets audit, log scrubbing verification, OWASP checklist) · docker-compose prod profile + deploy runbook · CI/CD pipelines final · Play Store submission checklist doc (Data Safety mapping from Data & Security doc) · FINAL_REPORT.md.

**Dependencies:** A–E. **Deliverables:** one-command dev up; documented staging deploy; all gates + E2E green. **Complexity:** Medium. **Risks:** none novel — this phase exists to retire risk.
**Validation:** the full Phase-8 gate list, run end-to-end.
**DoD:** FINAL_REPORT.md complete with known limitations (real network credentials pending) and future work.

---

## Out of build (operational, owner-side, tracked in reports)
Network account signups (Adjoe/AdGate/AppLovin/Unity/AdMob) · Firebase project creation (3 envs) · gift-card bulk purchase · Play Console listing/branding decision (C5) · production host selection (U4) · coin-economy launch numbers sign-off (P1).
