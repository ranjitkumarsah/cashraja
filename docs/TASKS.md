# TASKS.md — Atomic Task Board

**Generated:** 2026-07-19 · **Phase:** 5 — Task Breakdown
Status legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked
Each task is independently executable and maps to a build phase (A–F) from IMPLEMENTATION_PLAN.md.

---

## A — Foundation

### A1 Repo & Tooling
- [x] A1.1 `git init`, .gitignore (node/flutter/env), root README
- [x] A1.2 Backend scaffold: NestJS + TS strict + ESLint/Prettier + Jest
- [x] A1.3 `docker-compose.yml` (postgres:16, redis:7) + `.env.example` (3-env profile scheme)
- [x] A1.4 CI workflow: backend lint + typecheck + test

### A2 Database
- [x] A2.1 Prisma schema — TRD tables (users, coin_ledger, offers, offer_completions, ad_impressions, gift_cards, redemptions, referrals, fraud_flags, admin_audit_log)
- [x] A2.2 Prisma schema — gap tables (admins, devices, refresh_tokens, game_rounds, streaks, bonus_attempts, bonus_config, gift_card_inventory, notifications, referral_earnings, app_config)
- [x] A2.3 Indexes: ledger (user_id, created_at), unique idempotency_key, device lookups
- [x] A2.4 Initial migration + seed (super-admin, catalog ₹50/₹100/₹250, config defaults)

### A3 Ledger Core
- [x] A3.1 LedgerService.record() — transactional insert, balance_after, write-through cache
- [x] A3.2 Idempotency: unique-violation → return existing row (no-op)
- [x] A3.3 Reserve-debit + compensating-reversal helpers
- [x] A3.4 Unit tests: every source_type path, dup-key no-op, reversal
- [x] A3.5 Property test: random credit/debit sequences ⇒ cache == SUM(ledger)
- [x] A3.6 Concurrency test: parallel writes, parallel redemption reserve (only one wins)
- [x] A3.7 Nightly reconciliation job + drift alert hook

### A4 Auth
- [x] A4.1 FirebaseVerifier interface + mock driver (dev) + real driver (admin SDK)
- [x] A4.2 POST /api/auth/google — verify, upsert user + device row, GEO from IP
- [x] A4.3 JWT issuance (aud=app, 15m) + refresh rotation (hashed, reuse-detection revoke)
- [x] A4.4 POST /api/auth/refresh · A4.5 auth guards/decorators · A4.6 integration tests
- [x] A4.7 Admin auth: bcrypt login + TOTP (otplib) + admin JWT (aud=admin, 8h)
- [x] A4.8 RBAC guard (reviewer vs super_admin) + audience separation tests

## B — Earning Pipelines

### B1 Adapter Layer
- [x] B1.1 OfferwallAdapter interface + registry (env-selected)
- [x] B1.2 Mock offerwall driver (deterministic HMAC) + simulator CLI
- [x] B1.3 Skeletons: adjoe, adgate, offertoro, cpx (`NEEDS_CREDENTIALS`)
- [x] B1.4 AdSsvAdapter interface + mock + skeletons (applovin, levelplay, admob)
- [x] B1.5 GiftCardProvider interface + ManualInventoryProvider stub wiring

### B2 Postback Pipeline
- [x] B2.1 POST /api/webhooks/offerwall/:network — verify→persist→enqueue→200
- [x] B2.2 BullMQ queue + worker (fraud hook → ledger credit → notify hook)
- [x] B2.3 offer_completions status flow + pending-expiry job (30d void)
- [x] B2.4 Integration tests per adapter: valid / bad-sig / replay
- [x] B2.5 Burst load test — p95 < 500ms response

### B3 Offers & Ads
- [x] B3.1 GET /api/offers (eligibility-filtered) · B3.2 POST /api/offers/:id/launch (signed token)
- [x] B3.3 POST /api/webhooks/ads/:network SSV flow + ad_impressions rows
- [x] B3.4 Daily ad-view caps + bonus slot (config-driven) + tests

### B4 Wallet
- [x] B4.1 GET /api/wallet (balance, pending, recent) · B4.2 GET /api/wallet/ledger (cursor pagination) · B4.3 GET /api/me
- [x] B4.4 Rate limiting (throttler+Redis) on public endpoints

## C — Redemption & Admin

### C1 Gift Cards & Inventory
- [x] C1.1 Catalog endpoints + admin CRUD
- [x] C1.2 Inventory upload (CSV/paste) — AES-256-GCM encrypt, dedupe
- [x] C1.3 Inventory lifecycle unused→reserved→issued + low-stock alert
- [x] C1.4 Audited reveal endpoint (super-admin only, masked elsewhere)

### C2 Redemption Flow
- [x] C2.1 POST /api/redemptions — balance check, reserve-debit, fraud pre-screen annotation
- [x] C2.2 Status machine requested→under_review→approved/rejected→issued
- [x] C2.3 Approve → issue from inventory → in-app delivery; retry queue on failure
- [x] C2.4 Reject → compensating reversal + reason
- [x] C2.5 GET /api/redemptions/mine · C2.6 race test (E2E #5) · C2.7 banned-user hold rule (P6)

### C3 Admin API
- [x] C3.1 Users: list/filter, ledger view, flag/ban
- [x] C3.2 Balance adjust — ledger + audit log same transaction (+rollback test)
- [x] C3.3 Redemption queue endpoints + CSV export
- [x] C3.4 Offer management (enable/disable, edit reward) + postback log viewer
- [x] C3.5 Config management (rates, caps, referral %, probability tables) — versioned writes
- [x] C3.6 Admin management (create/disable, role assign) · C3.7 fraud-flag review queue
- [x] C3.8 Account deletion: DELETE /api/account (anonymize-in-place, ledger preserved)

### C4 Metrics
- [x] C4.1 Hourly aggregates job (DAU, issued/redeemed, completion rates, liability)
- [x] C4.2 GET /api/admin/dashboard/metrics · C4.3 accuracy spot-check tests

### C5 Admin Panel (React)
- [x] C5.1 Scaffold: Vite+TS+Tailwind+shadcn-style+TanStack Query/Table+zod
- [x] C5.2 Raja theme (premium: indigo/gold, Inter, card layout, dark toggle)
- [x] C5.3 Login + TOTP flow, role-gated routing
- [x] C5.4 Dashboard (Recharts: DAU, coins issued vs redeemed, liability, completion rates)
- [x] C5.5 Users screen (search, ledger drawer, flag/ban, adjust-balance modal w/ reason)
- [x] C5.6 Redemption queue (bulk-review UX, approve/reject w/ reason, export)
- [x] C5.7 Offers screen · C5.8 Inventory screen (upload, stock levels)
- [x] C5.9 Fraud queue · C5.10 Config screen · C5.11 Admins screen
- [x] C5.12 Component/RBAC tests + build in CI

## D — Engagement Features

### D1 Game
- [x] D1.1 POST /api/game/round-start (server round_id, difficulty, expiry)
- [x] D1.2 POST /api/game/round-complete — anti-replay, min-play-time, daily cap, credit
- [x] D1.3 Tests: replay rejected, too-fast rejected, cap boundary

### D2 Streaks
- [x] D2.1 Streak state (IST day), claim endpoint, day-1→7 escalation from config
- [x] D2.2 Tests: continuation, break, double-claim rejected

### D3 Scratch/Spin
- [x] D3.1 bonus_config weighted tables (server-side) + roll endpoint
- [x] D3.2 Attempt limits + unlock via ad-view/streak hooks
- [x] D3.3 Distribution test + tamper test (client can't influence roll)

### D4 Referral
- [x] D4.1 Code generation + GET my-code/stats · D4.2 POST redeem at signup (once, window start)
- [x] D4.3 Bonus fan-out on referred earnings (snapshot %, capped window, own idempotency keys)
- [x] D4.4 Self-referral block (device/IP) + window-expiry tests · E2E #6

## E — Fraud, Notifications, Flutter App

### E1 Fraud Engine
- [ ] E1.1 FraudRule interface + hook points + Redis sliding-window lib (w/ expiry tests)
- [ ] E1.2–E1.6 Rules: multi-account · offer velocity (auto-hold) · self-referral · round farming · new-account redemption abuse — one test each
- [ ] E1.7 Auto-actions (none/hold/flag/ban) + fraud_flags persistence + admin queue wiring

### E2 Notifications
- [ ] E2.1 FCM service (mockable) + token registration endpoint
- [ ] E2.2 In-app inbox (list/read) + triggers (credit, redemption status, streak reminder)

### E3 Flutter App
- [ ] E3.1 Scaffold: Flutter + Riverpod + go_router + dio + intl (en, hi-ready)
- [ ] E3.2 Raja design system (dark-first indigo/gold, bundled Manrope, tabular numerals, coin glyph, count-up balance)
- [ ] E3.3 API client + auth interceptor (refresh rotation) from OpenAPI
- [ ] E3.4 Auth: Google Sign-In (mockable verifier in dev) → onboarding (18+ DOB attestation, referral code entry)
- [ ] E3.5 Home: balance, streak flame, play CTA, tasks CTA, invite CTA
- [ ] E3.6 Game screen (number-pattern tap, 3 tiers, round lifecycle)
- [ ] E3.7 Tasks tab: offer list, webview launch, pending/credited states
- [ ] E3.8 Rewarded-ad flow behind RewardedAdService (mock impl + real-SDK stubs)
- [ ] E3.9 Wallet: balance + ledger history + pending credits
- [ ] E3.10 Scratch card + spin wheel screens (server-rolled)
- [ ] E3.11 Invite & Earn (code share, stats) · E3.12 Redeem store + history (status timeline)
- [ ] E3.13 Inbox · E3.14 Profile/settings (account deletion flow)
- [ ] E3.15 Widget tests (wallet, offers, redemption states) + auth integration test + CI job

## F — Hardening & Ship

- [ ] F1 E2E suite: Testing-doc scenarios 1–7 scripted against mock adapters
- [ ] F2 Load tests: webhook burst, game/redemption endpoints with rate limits
- [ ] F3 Volume seed (thousands of ledger rows/user) + balance-derivation check at volume
- [ ] F4 Security pass: OWASP checklist, secrets audit, log-scrubbing verification, headers
- [ ] F5 Prod compose profile + deploy runbook + rollback notes (ledger migrations additive-only check)
- [ ] F6 Play Store checklist doc (Data Safety mapping, copy rules, account-deletion URL)
- [ ] F7 Docs final pass (README per package, API docs, admin guide) · F8 FINAL_REPORT.md

---

## G — Monetization & Ads (owner feedback, 2026-07-23) + quick wins

Decision: **age gate stays 18+** (India DPDP Act minors = under-18 + parental consent; network terms; Play Families). DOB attestation kept/stored.

### Quick wins
- [x] G0.1 Spin wheel showed ₹ instead of coins — replaced with coin markers
- [ ] G0.2 Rewards store: show real per-card stock availability + hide/disable sold-out (backend inventory already tracks; expose count in /gift-cards, wire in app)
- [ ] G0.3 Live Google Sign-In — debug SHA-1 added to Firebase (owner action)

### Ads integration (real AdMob rewarded + banner; test IDs in dev, real IDs via dart-define)
- [ ] G1 RewardedAdService real AdMob impl (google_mobile_ads) + banner widget
- [ ] G2 Streak claim gated behind a rewarded ad (3a)
- [ ] G3 Banner ad on game screen where it fits (3b)
- [ ] G4 Game win → claim popup (coins + Claim/Close); Claim→watch ad→credit, Close→forfeit (3c). round-start returns reward preview so popup shows amount before crediting
- [ ] G5 Banner on scratch/spin win screens (3d)
- [ ] G6 Real scratch-to-reveal gesture; on reveal → claim popup → watch ad to credit (3e)
- [ ] G7 Watch-ads: max 10/day + ~1min cooldown between watch and claim (3g); backend cap already exists, add cooldown
- Note: dev uses client-gated ad-watch before the existing credit call (server still authoritative + daily caps); production hardening = ad-network SSV (already built for offer/ad webhooks).

---

## H — Launch Readiness & Content (owner feedback, 2026-07-25)

- [ ] H1 Profile page: Terms & Conditions + Privacy Policy links, proper Settings section (Play Store requires an accessible privacy policy). Policy content drafted from docs/cash-mafia-clone-data-security.md; owner/legal review before publish.
- [ ] H2 Referral page: list referred users (names) + their earnings + commission earned by referrer + the referral cap/window. Needs backend referral breakdown endpoint + app UI.
- [ ] H3 Marketing landing page (web, new deliverable): premium design, features, live stats (total users, daily users, rewards paid), Play Store link (when live), Privacy Policy, T&C, About Us (no physical address), FAQs. Needs a public read-only stats endpoint + hosting.
- [ ] H4 Feedback/complaint system: in-app submit form (users) + admin queue to view/resolve/reply. Backend model + endpoints + app form + admin screen.

Decisions needed: (a) privacy/T&C legal review (draft from Data & Security doc); (b) landing-page + policy hosting (ties to the still-open production-host decision U4); (c) which "stats" to expose publicly (aggregate only, no PII).

- [ ] H5 Manual offers + proof review (owner 2026-07-25): super-admin creates manual offers/tasks (title, description, coin reward, instructions); users view them, complete, and submit **text proof**; admin reviews submissions and approves (credit via LedgerService) or rejects (with reason). Backend model (ManualOffer + ManualOfferSubmission) + endpoints; admin CRUD + review queue; app offer list + proof-submit form + status. Credits go through the ledger (source_type offer/admin_adjustment) with idempotency.
- [ ] H0 Wallet history display: owner reports list looks incorrect — DATA verified correct (balance chain consistent); investigate labels/order/refresh once owner specifies.

- [ ] H6 Rewards page redesign (owner 2026-07-25): current flat grid of all 9 cards is confusing. Two-level flow: (1) Rewards page shows one card per BRAND (Amazon, Flipkart, Google Play) with brand icon/logo + color; (2) tapping a brand opens that brand's available gift cards (denominations ₹50/₹100/₹250) with stock + coin cost + redeem; (3) banner ad at the bottom of the brand-detail page. Data (GET /api/gift-cards) is correct — pure app UI restructure. Brand logos: use branded color cards + placeholder icons (real brand logos to be supplied/sourced; avoid unlicensed copyrighted assets bundled).

## Hosting & consolidation decisions (owner, 2026-07-25)
- Free launch stack: Cloudflare Pages (admin+landing static) + Neon (Postgres) + Upstash (Redis) + Fly.io (backend). Watch-items: Upstash daily command cap (BullMQ/velocity heavy), Fly 256MB RAM, Neon 0.5GB (ledger grows). Fallback/real host: ~$5/mo Hetzner VPS running docker-compose (removes all limits). Move = .env change.
- **Landing page merged INTO the admin project** (revises H3): one React app on Cloudflare Pages. Public landing at `/`; ALL admin routes move under `/admin/*` (`/admin/login`, `/admin/dashboard`, ...). Do this AFTER the running H5/H6 agent finishes (it is editing admin App.tsx now — avoid conflict). Update guards/redirects (RequireAuth -> /admin/login), nav links, and the login redirect target accordingly.

## Hosting FINAL (owner confirmed, 2026-07-25)
- Vercel & Render RULED OUT: Vercel Hobby bans commercial use + serverless can't run BullMQ workers; Render free Postgres self-deletes after 30 days + web service sleeps. Not viable for a money app.
- Plan: free stack = STAGING/validation (Cloudflare Pages admin+landing / Neon Postgres / Upstash Redis / Fly.io backend). PRODUCTION v1 = ~$5/mo Hetzner VPS running docker-compose (no limits, commercial-OK, real persistent Postgres/Redis). Move between them = .env change.
- Phase F deliverable: prep deploy configs for BOTH — (a) Fly.io fly.toml + Neon/Upstash env wiring + Cloudflare Pages build for the merged admin+landing; (b) Hetzner VPS docker-compose prod profile + deploy/runbook. Owner picks at deploy time.

## Domain (owner has graduatedcoder.in on Hostinger, 2026-07-25)
- Subdomains: cashraja.graduatedcoder.in -> landing (/) + admin (/admin); api.cashraja.graduatedcoder.in -> backend API. (Chose api.cashraja.* over cashrajabackend.* — cleaner nesting.)
- Uses: public privacy-policy URL for Play Store listing (cashraja.graduatedcoder.in/privacy or landing section); production API_BASE_URL for the app (https://api.cashraja.graduatedcoder.in/api); offerwall postback base URL for v2 (e.g. CPX -> https://api.cashraja.graduatedcoder.in/api/webhooks/offerwall/cpx).
- DNS wiring at deploy: VPS = A records -> VPS IP + Caddy/nginx + Let's Encrypt SSL; free stack = CNAME to Cloudflare Pages / Fly.io targets. Phase F outputs the exact records.
- App release build must set --dart-define=API_BASE_URL=https://api.cashraja.graduatedcoder.in/api (replacing the localhost dev tunnel).
