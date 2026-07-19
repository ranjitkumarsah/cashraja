# GAP_ANALYSIS.md — Coin Rewards / Offerwall App ("Cash Raja")

**Generated:** 2026-07-19
**Phase:** 2 — Gap Analysis
**Status:** ⛔ BLOCKED — questions in §6 must be answered before implementation starts.

Legend: 🔴 blocks build start · 🟡 blocks a specific feature, not the whole build · 🟢 resolvable with a recommended default (will proceed unless overridden)

---

## 1. Conflicts & Contradictions Between Documents

| # | Conflict | Documents | Impact |
|---|---|---|---|
| C1 🔴 | **PRD "In scope (v1)" lists game, streaks, scratch/spin, referral — but PRD §11 roadmap puts all of those in Phase 2.** Which scope is "the build"? | PRD §4 vs PRD §11 | Defines the entire task breakdown |
| C2 🟢 | **Redemption-rate assumptions differ:** BRD/PRD success metric targets 15–30% redemption, but PRD §7 says *price* the economy assuming 40–50% redemption | BRD §7, PRD §2 vs PRD §7 | Not a true contradiction (target vs conservative pricing) — economy config must use 40–50% for margin math, dashboards track 15–30% as the KPI. Will implement this interpretation. |
| C3 🟢 | **Multi-account threshold:** BRD says block re-registration "past a threshold" (unspecified); TRD fraud table says flag at ">2 accounts per device" | BRD §4 vs TRD §5 | Default: flag at >2, hard-block at >3, both admin-configurable. |
| C4 🟡 | **Hindi localization:** PRD out-of-scope excludes localization "beyond English + Hindi" (implying Hindi IS in v1), but roadmap Phase 4 says "Localization" | PRD §4 vs PRD §11 | Default: build with i18n scaffolding (Flutter `intl`), ship English strings in v1, Hindi translation as content task later. Cheap now, expensive to retrofit. |
| C5 🟡 | **App branding:** working folder/name "Cash Raja" follows the reference portfolio's "Cash ___" pattern that Strategy §1/§4 explicitly says to avoid | Strategy vs project name | Code is name-agnostic (config-driven app name). Owner decision needed before store submission, not before build. |
| C6 🟢 | **TRD says debit at request; PRD status flow starts at `requested`** — consistent, but TRD §6 fulfillment starts at "admin approves" while PRD §6.8 requires fraud/eligibility check *before* approval | PRD §5 vs TRD §6 | Default: automated fraud pre-screen runs at request time and annotates the queue item; human approval remains the gate. |

---

## 2. Missing APIs (specified nowhere, but required by specified features)

| # | Missing endpoint | Needed by |
|---|---|---|
| A1 🔴 | **Admin auth** (login, session, RBAC token issuance) — admin panel is specified, its auth is not. Google Sign-In restricted to allowlisted admin emails? Email+password+TOTP? | Entire admin panel |
| A2 🔴 | `POST /api/game/round-start` (or equivalent) — TRD's `round-complete` validates "round_id was actually issued", but no endpoint issues one | Game anti-replay |
| A3 🟡 | Streak endpoints (`GET /api/streak`, claim bonus) | Daily streak |
| A4 🟡 | Scratch/spin endpoints (get attempts, play, server-rolled result) | Scratch/spin |
| A5 🟡 | Notifications: FCM token registration + in-app inbox list/read | Notifications §6.10 |
| A6 🟡 | `DELETE /api/account` (anonymize-in-place) — required by Play Store policy + Data & Security §6 | Compliance |
| A7 🟡 | User profile: `GET /api/me`, referral stats (`GET /api/referral/stats` — earnings from referred users) | Home screen, Invite & Earn |
| A8 🟡 | Admin: gift-card catalog CRUD, fraud-flag review queue, admin-user management, config management (rates/caps/referral %/probability tables), postback log viewer (PRD 6.9 mentions "view postback logs" — no endpoint) | Admin panel |
| A9 🟡 | Admin: manual gift-card inventory upload (if manual sourcing route chosen) | Fulfillment |
| A10 🟢 | AdMob SSV callback — TRD §3.6 covers MAX/LevelPlay SSV; AdMob rewarded SSV has its own format | Ad crediting |

---

## 3. Missing DB Fields / Tables

| # | Missing | Needed by |
|---|---|---|
| D1 🔴 | `admins` table (id, email, role, totp/credentials, status) — `admin_audit_log.admin_id` FKs to nothing | Admin panel, audit log |
| D2 🟡 | `devices` table (user_id ↔ device fingerprint, many-to-many with first/last seen) — single `users.device_id` can't express "same device linked to >2 accounts" | Fraud rule #1 |
| D3 🟡 | `refresh_tokens` table (token hash, user, expiry, rotated_from) — rotation is specified, storage is not | Auth |
| D4 🟡 | `game_rounds` table (server-issued round_id, difficulty, issued_at, completed_at, status) | Game anti-replay |
| D5 🟡 | `streaks` (current_count, last_claim_date) + streak bonus config | Streaks |
| D6 🟡 | `bonus_attempts` (scratch/spin plays) + `bonus_config` (weighted probability tables, server-side) | Scratch/spin |
| D7 🟡 | `gift_card_inventory` (uploaded codes: encrypted code, denomination, brand, status used/unused, uploaded_by) — required if manual sourcing route | Fulfillment |
| D8 🟡 | `notifications` / inbox table | §6.10 |
| D9 🟡 | `users.referral_code` (unique) + `referral_earnings` linkage (each referral-bonus ledger row must reference the referred user's originating earning) | Referral |
| D10 🟢 | `app_config` versioned key-value (coin rates, caps, thresholds, referral %) with audit | Admin config §6.9 |
| D11 🟢 | `redemptions.rejection_reason`; `offer_completions.idempotency` linkage to ledger; `ad_impressions.ssv_payload` raw retention (parity with offer postbacks) | Audit/disputes |

---

## 4. Missing Permissions / Business Rules / Edge Cases

| # | Gap |
|---|---|
| P1 🔴 | **All coin-economy numbers are unspecified:** game coins/round, daily caps (game rounds, ad views), streak bonus schedule, scratch/spin prize tables, referral % and window, coin→₹ rate, redemption tiers (the 1000/2000/5000 → ₹50/₹100/₹250 table is marked as an example). Build can make these all admin-configurable with placeholder defaults — but launch values need owner sign-off. |
| P2 🟡 | **Admin permissions matrix** — "support/reviewer vs super-admin" named, but per-action mapping (who can view PII? who exports payout CSVs? who manages admins?) undefined. Will draft a matrix for approval in ARCHITECTURE_PLAN.md. |
| P3 🟡 | **Referral qualifying action** undefined ("completes first action") — first offer completion? first ad? any ledger credit? Affects fraud exposure (ad-view-only qualification is cheapest to farm). |
| P4 🟡 | **18+ enforcement** — "enforced, not just declared" but no mechanism specified (Google accounts don't expose age). Options: self-attestation checkbox + DOB entry, or attestation-only. |
| P5 🟡 | **Pending-credit expiry** — offers stuck in `pending` forever? Networks sometimes never confirm. Need a timeout/void policy. |
| P6 🟡 | **Banned-user redemption** — user banned *after* requesting redemption but *before* approval: auto-reject and reverse, or hold? |
| P7 🟡 | **Coin expiry / dormancy** — breakage model assumes coins go unredeemed; is there an explicit expiry (e.g., inactive 12 months) or do balances live forever? Affects liability accounting. |
| P8 🟢 | **Email delivery of gift cards** — provider unspecified (SendGrid/SES/SMTP?). Also: in-app-only delivery would remove the email dependency entirely for v1. Default: in-app delivery only, email later. |
| P9 🟢 | **Streak break rules** — timezone for "daily" (IST fixed?), grace period? Default: IST calendar day, no grace. |

---

## 5. Unclear / Unresolved Decisions (carried from the docs' own Open Items)

| # | Decision | Status |
|---|---|---|
| U1 🔴 | **Gift card sourcing: API (Xoxoday/Qwikcilver/Cashfree) vs manual bulk inventory** — flagged in BRD, PRD, TRD, and Strategy as the biggest unresolved decision; drives admin fulfillment workflow + schema (D7) | Owner must decide (architecture will abstract it either way) |
| U2 🟢 | **Postgres vs MySQL** — TRD itself recommends Postgres (jsonb) | Default: **Postgres** |
| U3 🟢 | **`coin_balance_cached`: trigger vs recompute-on-read** — TRD leaves open | Default: **recompute-on-read for v1** (TRD's own "simpler correctness" argument) + scheduled reconciliation job; trigger later if read latency demands |
| U4 🔴 | **Deployment target** — Docker is implied by the workflow docs but no host is named (VPS? Railway/Render? AWS/GCP?) | Owner input needed for DevOps phase (build ships Docker Compose regardless) |
| U5 🟡 | **Network account availability** — no Adjoe/AdGate/AppLovin/etc. credentials exist yet; sandbox availability unconfirmed | Build against adapter interfaces + mock drivers; real keys slot in later |
| U6 🟢 | **Repo layout** — unspecified | Default: **monorepo** (`backend/`, `admin/`, `app/`) — single dev, shared types, one CI |
| U7 🟡 | **Analytics (Firebase Analytics)** — Data & Security §8 leaves it undecided; affects Data Safety form | Default: exclude from v1 code; revisit pre-launch |

---

## 6. ⛔ QUESTIONS FOR THE OWNER (all together, per process)

**Blocking (answering these unblocks the build):**

1. **Build scope (C1):** Do we build the *full v1 feature set* (game, streaks, scratch/spin, referral included) in this effort, executed in the PRD's phase order — or strictly the Phase-1 MVP (auth, wallet/ledger, offerwall, rewarded ads, redemption, admin) and stop for review before Phase 2?
2. **Gift card sourcing (U1):** API provider or manual bulk-purchased inventory? (Architecture abstracts both; the admin workflow and schema D7/A9 differ.)
3. **Admin auth (A1):** Email + password + TOTP (self-contained, recommended) or Google Sign-In restricted to allowlisted admin emails?
4. **External networks (U5):** Confirm the build should use mock/sandbox adapter drivers for all ad/offerwall/gift-card providers now, with real credentials wired in when accounts are approved?

**Secondary (answerable now or during build — defaults listed will be used otherwise):**

5. Coin-economy launch numbers (P1) — placeholders now, sign-off before launch?
6. Referral qualifying action (P3) — default: first *offerwall* completion (hardest to farm).
7. 18+ mechanism (P4) — default: DOB self-attestation at onboarding, stored.
8. Pending-credit expiry (P5) — default: void after 30 days with user-visible status.
9. Banned-user pending redemptions (P6) — default: auto-move to `under_review`, never auto-approve.
10. Coin expiry (P7) — default: no expiry in v1 (trust positioning), liability watched on dashboard.
11. Deployment host (U4) — default: Docker Compose artifacts + generic VPS instructions.
12. Gift-card delivery channel (P8) — default: in-app only for v1 (no email provider dependency).
13. App display name (C5) — "Cash Raja" conflicts with Strategy's differentiation rule; config-driven either way.

---

## 7. Verdict

Documents are unusually complete for this stage — the architecture, data model, fraud rules, and testing strategy are coherent and mutually consistent on all core mechanics (ledger, idempotency, reserve-debit, SSV-only crediting). The gaps are concentrated in: (a) scope ambiguity, (b) one big unresolved sourcing decision, (c) admin auth being entirely unspecified, and (d) concrete economy numbers. **Implementation must not start until §6 questions 1–4 are answered.**
