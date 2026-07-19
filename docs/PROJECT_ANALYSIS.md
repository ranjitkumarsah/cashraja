# PROJECT_ANALYSIS.md — Coin Rewards / Offerwall App ("Cash Raja")

**Generated:** 2026-07-19
**Sources analyzed:** BRD, PRD, TRD, Data & Security, Strategy, Testing & Deployment (docs/cash-mafia-clone-*.md)
**Phase:** 1 — Document Analysis

---

## 1. Executive Summary

An Android rewards (GPT/offerwall) app for the India market. Users earn in-app coins via offerwall tasks (Adjoe Playtime + CPA aggregators), rewarded video ads (AppLovin MAX / Unity LevelPlay / AdMob), a light number-pattern mini-game, streaks, scratch/spin bonuses, and referrals. Coins redeem **only** for digital gift cards (Amazon.in, Flipkart, Google Play) after manual admin approval. Revenue = ad/offerwall network payouts; cost = gift card value redeemed. Margin lives in the spread plus breakage.

The real product is **not** the game — it is a fraud-hardened, append-only coin ledger with an offerwall postback pipeline and a gift-card fulfillment workflow. Testing and engineering priority is explicitly inverted: ledger correctness > fraud rules > postback idempotency > everything else > UI polish. However, per the owner's added note, **both the app and admin panel must have a premium-looking theme and color scheme** — trust-signaling UI is part of the differentiation strategy ("fixed rates, no surprises").

**Stack (fixed by TRD):** Node.js API (Express/Nest) · React admin panel · Flutter Android app · Postgres/MySQL + Redis · Firebase (Auth: Google Sign-In only; FCM for push).

---

## 2. Goals

### Business (from BRD)
| Metric | Target (90 days) |
|---|---|
| Installs | 50K |
| DAU/MAU | ≥ 20% |
| Redemption rate | 15–30% of earned coins |
| Referral K-factor | ≥ 0.15 |
| Net margin per DAU | Positive by month 2–3 |

### Product (from PRD)
- Avg session ≥ 4 min
- Positive margin per DAU after payouts
- Trust differentiation: **fixed redemption thresholds, never raised without clear notice** (the reference app's #1 failure mode)

---

## 3. Functional Requirements (consolidated)

1. **Auth** — Google Sign-In only via Firebase Auth; backend verifies ID token (aud/iss), mints own short-lived JWT + rotating refresh token. Device ID + IP captured at signup. One Google account = one user; multi-account-per-device blocked past a threshold.
2. **Game screen** — number/pattern-tap mini-game, 2–3 difficulty tiers, small per-round coin reward, daily cap, anti-replay (server-issued round IDs), minimum-play-time farming check.
3. **Daily streak** — day 1→7 escalating bonus cycle.
4. **Offerwall tab** — Adjoe (Playtime, likely native-wrapper via platform channel) + 1–2 webview-based CPA walls (AdGate/OfferToro/CPX). Offers show reward/time/requirements. Server-to-server (S2S) HMAC-signed postbacks credit coins; pending vs credited status visible to user.
5. **Rewarded video** — AppLovin MAX primary, LevelPlay secondary, AdMob backfill. Server-side verification (SSV) required; capped views/day + one daily bonus slot.
6. **Scratch card / spin wheel** — server-side weighted probability tables, limited attempts/day, unlockable via ad view or streak milestone.
7. **Wallet & ledger** — append-only `coin_ledger`; balance derived from ledger; `coin_balance_cached` is a read cache only; DB-level idempotency keys; every entry sourced and referenced.
8. **Referral** — unique code per user; referrer earns X% of referred user's earnings for a capped window (~30 days); self-referral (same device/IP) blocked; rate snapshotted per referral.
9. **Redemption** — fixed coin→denomination table; reserve-debit at request time, reverse on rejection; status flow `requested → under_review → approved/rejected → issued`; manual approval for all v1 redemptions; gift card codes AES-256 encrypted at rest; delivery in-app + email.
10. **Admin panel (React)** — dashboard (DAU, coins issued/redeemed, completion rates, outstanding liability), user management (ledger view, flag/ban, audited balance adjustments), offer/network management, redemption approval queue with export, config (rates, thresholds, referral %, caps). RBAC: super-admin vs support/reviewer.
11. **Notifications** — FCM push (offer available, redemption approved, streak reminder) + in-app inbox for rule-change transparency.
12. **Fraud engine** — custom Node.js rules + Redis sliding-window counters: multi-accounting, offer velocity, self-referral, game-round farming, new-account redemption abuse. Durable `fraud_flags` in Postgres.

---

## 4. Non-Functional Requirements

- Idempotent ledger writes (DB unique constraint = the mechanism; violation = no-op).
- All coin-affecting endpoints server-authoritative; client-reported completions never trusted.
- Postback webhooks respond < 5–10s; heavy processing async post-200.
- Ledger indexed on `(user_id, created_at)` + unique `idempotency_key`.
- Dashboard metrics pre-aggregated (materialized view / scheduled job).
- TLS everywhere; secrets in env-managed storage, never in repo or Flutter client.
- Admin JWT audience separate from user JWT audience.
- Rate limiting on all public endpoints (game round + redemption especially).
- Redemption audit trail retained indefinitely; account deletion = anonymize PII in place, preserve ledger.
- Dev/staging/prod separation with separate Firebase projects.
- Ledger schema migrations must always be roll-back safe.
- **Premium visual theme** in Flutter app and React admin panel (owner directive).

---

## 5. User Roles

| Role | Description |
|---|---|
| End user | 18+, Tier 2/3 India; earns and redeems coins |
| Support/Reviewer admin | Redemption queue review, user viewing, fraud-flag triage — **cannot** adjust balances or configure offers |
| Super-admin | Everything: balance adjustments (with mandatory reason), offer/network config, rate/threshold config, admin management |

---

## 6. Features by Roadmap Phase (PRD §11)

- **Phase 1 (MVP):** Google Sign-In, wallet/ledger, Adjoe + 1 CPA offerwall, MAX rewarded ads, Amazon/Google Play redemption, basic admin panel
- **Phase 2:** Game screen, streaks, scratch/spin, referrals
- **Phase 3:** LevelPlay, Flipkart card, fraud scoring v2
- **Phase 4:** Localization, iOS evaluation, coin-value tuning
- *(Note: this phasing conflicts with the PRD's own v1 scope list — see GAP_ANALYSIS #1.)*

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Play Store enforcement (category/data-safety) | High — takedown | Accurate Data Safety form, no income-guarantee copy, Finance-category fallback listing ready |
| Fraud / coin farming | High — direct margin loss | SSV-only crediting, device fingerprinting, velocity rules, manual redemption gate |
| Offerwall network access from India dev account | High — no inventory = no revenue | Start network signups before build completes |
| Gift-card liability > cash on hand | Medium | Manual approval gate, liability dashboard, conservative breakage pricing (40–50% redemption assumption) |
| Trust erosion via threshold changes | Medium | Fixed-rate policy, in-app inbox transparency |
| Ad/offerwall SDK native crashes on budget Android | Medium | Staged rollout 5–10%, Play vitals monitoring |

---

## 8. Dependencies

**External accounts/approvals needed (outside dev control):** Adjoe, AdGate/OfferToro/CPX, AppLovin, Unity, AdMob, Firebase projects (×3 envs), gift-card supplier (Xoxoday/Qwikcilver/Cashfree) or bulk-purchase inventory, Play Console account, email delivery provider (unspecified — see gaps).

**Internal build order:** DB schema → ledger core → auth → postback webhooks → wallet API → Flutter shell → admin panel → game/streak/scratch → referral → redemption fulfillment → fraud engine → notifications.

---

## 9. Missing Information

Cataloged fully in GAP_ANALYSIS.md. Headlines: build-scope ambiguity (MVP vs full v1), gift-card sourcing route, DB engine confirmation, concrete coin-economy numbers, ~10 missing API endpoints, ~8 missing tables/fields, hosting target, email provider, Hindi-in-v1 ambiguity, admin bootstrap/auth mechanism, app branding (folder name "Cash Raja" conflicts with Strategy doc's differentiation guidance).

---

## 10. Technical Challenges

1. **Ledger correctness under concurrency** — reserve-debit races (two simultaneous redemptions), idempotent postback replay, cached-balance drift detection.
2. **Adjoe integration in Flutter** — likely needs a native Android module + MethodChannel wrapper; custom test coverage required.
3. **Postback burst handling** — 200-fast + async processing (queue/worker split) while keeping fraud checks in the pipeline.
4. **SSV verification per network** — each ad network's server-side reward callback has its own signature scheme; all must be verified, none client-trusted.
5. **Fraud engine tuning** — Redis sliding-window semantics (window-expiry off-by-ones called out in Testing doc) and avoiding false-positive bans at launch.
6. **Column-level encryption** for gift card codes with masked admin UI and log scrubbing.
7. **Building against networks we don't have accounts for yet** — requires clean adapter interfaces + sandbox/stub implementations so integration is a config change, not a refactor.

---

## 11. Suggested Improvements (beyond the docs)

1. **Provider-adapter pattern for every external network** (offerwalls, ad SSV, gift-card fulfillment) with a `mock`/`sandbox` driver — lets the whole system be built and E2E-tested before any network approval lands, and makes the open gift-card-sourcing decision non-blocking architecturally.
2. **Outbox/queue for post-webhook processing** (BullMQ on the existing Redis) rather than fire-and-forget async — guarantees fraud checks and notifications survive a process crash after the 200 response.
3. **`devices` join table** instead of a single `device_id` column on `users` — the fraud rule "same device linked to >2 accounts" is unqueryable if a user record holds only one device string and users reinstall/change devices.
4. **Admin bootstrap + TOTP 2FA** for admin logins — the docs specify RBAC but no admin credential mechanism at all; gift-card approval rights deserve 2FA.
5. **Config as versioned DB rows** (rates, caps, referral %, probability tables) with an audit trail — supports the "snapshot rate at time of referral" requirement and the fixed-rate trust policy generally.
6. **Account-deletion endpoint in v1** — Play Store now requires in-app account deletion for apps with account creation; the Data & Security doc describes the anonymization policy but no API exposes it.
7. **Branding check:** "Cash Raja" follows the exact "Cash ___" naming pattern of the reference portfolio the Strategy doc says to avoid imitating. Flagged for the owner's decision (build is name-agnostic; store listing is not).
