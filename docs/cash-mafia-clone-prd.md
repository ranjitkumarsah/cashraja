# PRD: Coin Rewards / Offerwall App (Cash Mafia Clone)

**Status:** Draft v1
**Owner:** Ranjit
**Reference app:** Cash Mafia (Rayole Software) — com.rayolesoftware.cashmafia

---

## 1. Overview

A mobile-first "earn rewards" app where users complete micro-tasks (offerwall offers, rewarded video ads, daily engagement loops) to earn in-app coins, redeemable only for digital gift cards (Amazon, Flipkart, Google Play) once a threshold is met. A lightweight casual "game" screen sits on top as the primary category/retention hook, but the actual product is a coin ledger + offerwall aggregator + gift-card fulfillment pipeline.

**One-line goal:** Maximize daily active engagement with offerwall/ad inventory while keeping actual cash payout (breakage-adjusted) below revenue from ad/CPA networks.

---

## 2. Goals & Success Metrics

| Goal | Metric | Target (v1, 90 days post-launch) |
|---|---|---|
| Acquire users cheaply | Installs, CPI | 50K installs, referral-driven CAC < ad-network payout per user |
| Drive engagement | DAU/MAU, session length | DAU/MAU ≥ 20%, avg session ≥ 4 min |
| Monetize via offers/ads | eCPM, offer completion rate | Positive margin per DAU after payouts |
| Control payout risk | Redemption rate, breakage | Redemption rate 15–30% of earned coins (rest expires/unused — standard for this category) |
| Retain via referral | K-factor | ≥ 0.15 |

---

## 3. Target Users

- Primary: value-conscious mobile users in Tier 2/3 India (and similar GEOs) looking for pocket-money style earning in spare time
- Secondary: students, gig-time users (commute, queue-waiting) — matches actual review sentiment from the reference app
- Age gate: 18+ (matches reference app's content rating; needed because task/offer completion often requires purchases/signups)

---

## 4. Scope

**In scope (v1):**
- Coin-earning game screen (number/pattern recognition, cheap to build, serves as Play Store category alibi)
- Offerwall aggregator integration (multiple CPA networks)
- Rewarded video ads
- Daily streak bonus
- Scratch card / spin wheel bonus mechanics
- Coin wallet + transaction ledger
- Referral program
- Redemption flow — gift cards only (Amazon, Flipkart, Google Play), no cash/bank/UPI payout
- Admin panel: user management, offer management, fraud review, gift-card order approval queue

**Out of scope (v1):**
- Native iOS (Play Store clone economics don't translate as cleanly to iOS review policy — revisit later)
- Cash/bank/UPI/PayPal payouts (gift-card-only simplifies KYC and payment-compliance burden considerably)
- Automated instant gift-card delivery for all users (manual/batched approval recommended initially for fraud control)
- Multi-language localization beyond English + Hindi

---

## 5. Core User Flow

1. Install → onboarding (Google Sign-In only) → country/GEO detected
2. Home screen: coin balance, daily streak, "play" CTA (game), "Tasks" tab (offerwall), "Invite & Earn"
3. User plays game or opens Tasks → completes an offer via SDK webview → postback credits coins (with delay/verification)
4. Coins accumulate → wallet screen shows redeemable value against available gift cards
5. At threshold, user picks a gift card (Amazon/Flipkart/Google Play) → fraud/eligibility check → manual/batched approval → gift card code delivered in-app/email
6. Referral: share code → referred user installs & completes first action → referrer earns % bonus (time-limited)

---

## 6. Functional Requirements

### 6.1 Authentication
- Google Sign-In only (via Firebase Auth) — no phone OTP, no email/password, no other social logins in v1
- Simplifies onboarding and keeps auth cost at zero (no SMS/OTP charges)
- Device ID + IP captured at signup for fraud scoring
- One Google account = one user account; block re-registration from the same device with a different Google account past a threshold (common multi-accounting abuse vector in this app category)

### 6.2 Home / Game Screen
- Simple number-recognition or pattern-tap mini-game (2–3 difficulty tiers)
- Small coin reward per completed round, capped per day to prevent bot farming
- Daily streak counter with escalating bonus (day 1 → day 7 cycle)

### 6.3 Tasks / Offerwall Tab
- **Adjoe (Playtime SDK)** — this is very likely what powers the reference app's "Super Offer" flow (install an app → keep it open ~2 min → credited). Adjoe specializes in pay-per-time-spent-in-app offers and is one of the higher-eCPM offerwalls for exactly this mechanic; free to integrate, revenue-share model
- Round out the offerwall tab with 1–2 general CPA aggregators — **AdGate Media**, **OfferToro**, or **CPX Research** — for survey/signup-style offers alongside the app-install offers
- Each offer shows: reward (coins), estimated time, difficulty/requirements
- Webview/SDK launch → server-side postback (S2S) credits coins after network confirms completion
- "Pending" vs "Credited" status visible to user (manages expectation/reduces support tickets — a known pain point in the reference app's reviews)

### 6.4 Rewarded Video Ads
- Use **AppLovin MAX** as the mediation layer — it's free to integrate (revenue-share model, no upfront cost) and consistently posts among the highest rewarded-video eCPMs available to Android publishers, which is why most serious reward/GPT apps run it as a primary or co-primary network
- Add **Unity LevelPlay (formerly ironSource)** as a second mediation source in the waterfall/bidding stack — also free to integrate, strong fill in India-heavy traffic
- Keep **Google AdMob** in the mix as a baseline/backfill network — lowest integration risk, but generally lower eCPM than MAX/LevelPlay for rewarded video in this vertical
- Cap free rewarded views per day to control ad-network payout exposure vs. coins issued
- One free "daily bonus" ad slot beyond the capped set

### 6.5 Scratch Card / Spin Wheel
- Randomized bonus coins, weighted probability table (configurable server-side, not client-side, to prevent tampering)
- Limited attempts/day, unlockable via ad view or streak milestone

### 6.6 Wallet & Coin Ledger
- Append-only ledger: every credit/debit logged with source (game, offer_id, ad, referral, redemption, admin_adjustment)
- Real-time balance = sum of ledger; never store balance as a mutable field alone (audit + fraud requirement)
- Configurable `coin_to_currency_rate` per country (same pattern as your FoxiGrow-style app's `coin_to_usd_rate` — should be driven by blended eCPM/offer margin data, reviewed periodically)

### 6.7 Referral Program
- Unique referral code/link per user
- Referrer earns X% of referred user's earnings for a capped window (e.g., 30 days) — avoid uncapped/perpetual referral liabilities
- Fraud check: same-device/same-IP self-referrals blocked

### 6.8 Redemption / Gift Cards
- Gift-card-only redemption: **Amazon.in, Flipkart, Google Play** to start (all have wide user recognition in India and no cash-payout compliance overhead)
- Fixed coin-to-gift-card-denomination table (e.g., 1000/2000/5000 coins → ₹50/₹100/₹250 card), configurable in admin — **do not change thresholds post-launch** without clear communication (top trust-breaking pattern in reference app reviews)
- Gift card sourcing is the one part of this flow that is **not free**: you'll need either (a) a gift-card API/reseller like Xoxoday, Qwikcilver/Pine Labs, or Cashfree's rewards catalog (small margin/fee per card, but instant digital fulfillment), or (b) manually bulk-purchasing codes at a discount and issuing from inventory — cheaper at scale but manual and needs float capital. Worth deciding this early since it drives your admin fulfillment workflow
- Status flow: `requested → under_review → approved/rejected → issued`
- Manual approval queue for all redemptions initially (no automated instant issuance in v1) — critical given gift cards are a common fraud target (fake/duplicate accounts farming cards)

### 6.9 Admin Panel (React)
- Dashboard: DAU, coins issued vs redeemed, offer completion rates, payout liability outstanding
- User management: view ledger, flag/ban, adjust balance with audit reason
- Offer/network management: enable/disable offerwalls, view postback logs, reconcile discrepancies
- Payout queue: approve/reject with reason, export for accounting
- Configurable: coin rates, redemption thresholds, referral %, daily caps

### 6.10 Notifications
- Push (Firebase Cloud Messaging): offer available, redemption approved, streak reminder
- In-app inbox for policy/reward-rule changes (transparency reduces the "rules changed on me" complaints seen in reference app reviews)

---

## 7. Coin Economy Model

- Define `coin_value` per gift-card denomination such that: `avg_offer_payout_from_network − avg_gift_card_cost_to_you > target_margin`
- Model breakage: not all earned coins get redeemed (users churn, thresholds not met) — v1 should still price conservatively assuming 40–50% eventual redemption, not the ~15% seen in aggressive competitor models
- Recommend: start with **transparent, fixed thresholds** and avoid raising them post-launch — the single most common trust-breaking pattern in reference app reviews

---

## 8. Technical Architecture

| Layer | Choice | Notes |
|---|---|---|
| Backend | Node.js (Express/Nest) | Coin ledger, offer postback handling, redemption workflow, REST/GraphQL API for the Flutter app |
| Admin panel | React | Dashboard, user management, offer/network management, payout queue — talks to the same Node.js API |
| Mobile frontend (Android) | Flutter | Native-feeling Android app; needs platform channels for any ad/offerwall SDK that's Android-native-only |
| Database | Postgres/MySQL + Redis (for velocity/fraud counters, rate limiting) | Ledger table append-only; Redis for hot-path fraud checks |
| Auth | Firebase Auth — Google Sign-In only | Firebase Admin SDK on the Node.js backend to verify tokens; free tier covers this easily |
| Push | Firebase Cloud Messaging | Flutter's `firebase_messaging` plugin on the client; free |
| Ad mediation | AppLovin MAX (primary) + Unity LevelPlay (secondary) + AdMob (backfill) | Free to integrate (revenue-share); MAX and LevelPlay are the highest-eCPM rewarded-video options available to Android publishers in this vertical |
| Offerwall SDKs | Adjoe (Playtime — matches competitor's "Super Offer" mechanic) + AdGate Media/OfferToro/CPX Research for survey/signup offers | Free to integrate (revenue-share); check Flutter plugin availability per SDK, fall back to platform channel + native wrapper if needed |
| Gift card fulfillment | Xoxoday / Qwikcilver (Pine Labs) / Cashfree rewards catalog, or manual bulk-purchased inventory | Not free — small per-card margin/fee (API route) or upfront float capital (bulk-purchase route); this is the one cost center in an otherwise free-to-integrate stack |
| Fraud/risk | Device fingerprint + IP + velocity checks | Custom rules engine in Node.js, backed by Redis counters, not a third-party service initially |

---

## 9. Non-Functional Requirements

- Ledger writes must be idempotent (offerwall postbacks can duplicate/retry)
- All coin-affecting endpoints server-authoritative — no client-trusted reward amounts
- Redemption approval audit trail retained indefinitely
- Play Store Data Safety form must accurately disclose data sharing with ad/offer networks (undeclared sharing is a common takedown trigger)

---

## 10. Compliance & Risk Notes

- Categorizing as a "game" while the core function is paid rewards has drawn Play Store enforcement against similar apps — budget for possible policy pushback and have a "Finance"-category-compliant fallback positioning ready
- Avoid "guaranteed income" language anywhere in store listing or in-app copy; keep the reference app's disclaimer pattern ("not a job or income source")
- 18+ age gate should be enforced, not just declared, if offers include gambling-adjacent or financial-product signups
- Do not shift redemption thresholds upward post-launch without clear in-app communication — this is the top user-trust complaint in the reference app

---

## 11. Phased Roadmap

- **Phase 1 (MVP):** Google Sign-In, wallet/ledger, Adjoe + 1 CPA offerwall, AppLovin MAX rewarded ads, Amazon/Google Play gift card redemption, basic admin panel
- **Phase 2:** Game screen, streaks, scratch card/spin, referral program
- **Phase 3:** Additional offerwalls/ad networks (LevelPlay), Flipkart added to gift card catalog, fraud scoring v2
- **Phase 4:** Localization, iOS evaluation, analytics-driven coin-value tuning

---

## 12. Open Questions

- Gift card sourcing: API/reseller (Xoxoday, Qwikcilver, Cashfree) vs. manual bulk-purchase inventory — which fits your working capital better?
- Which offerwall networks (Adjoe, AdGate, OfferToro, CPX Research) are actually accessible from an India-based developer account with good fill rates?
- What's the acceptable gift-card liability ceiling (coins issued but not yet redeemed) before you need reserve/float planning?
- Target GEO(s) for launch — India-only or global from day one? (Affects which gift cards make sense beyond Amazon/Flipkart/Google Play)
