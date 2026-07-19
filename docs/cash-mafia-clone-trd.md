# TRD: Coin Rewards / Offerwall App (Cash Mafia Clone)

**Status:** Draft v1
**Owner:** Ranjit
**Based on:** PRD v1 (cash-mafia-clone-prd.md)
**Stack:** Node.js (backend API) · React (admin panel) · Flutter (Android app) · Postgres/MySQL + Redis · Firebase (Auth + FCM)

---

## 1. System Overview

```
┌─────────────┐        ┌──────────────────────┐        ┌───────────────┐
│ Flutter App │◄──────►│   Node.js API (BFF)   │◄──────►│  Postgres/DB   │
│  (Android)  │  REST  │  Express/Nest, JWT     │        │  + Redis cache │
└─────────────┘        └──────────┬────────────┘        └───────────────┘
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                           ▼
┌───────────────┐        ┌───────────────────┐        ┌──────────────────┐
│ Ad mediation   │        │ Offerwall SDKs     │        │ Gift card         │
│ (MAX/LevelPlay/│        │ (Adjoe/AdGate/     │        │ fulfillment API   │
│  AdMob)        │        │  OfferToro/CPX)     │        │ (Xoxoday/Qwikcilver│
│ — client-side  │        │ — S2S postback →   │        │  / manual)         │
└───────────────┘        │   Node.js webhook   │        └──────────────────┘
                          └───────────────────┘

┌────────────────┐
│  React Admin    │──────► Node.js API (same backend, role-gated)
│  Panel          │
└────────────────┘
```

**Key architectural rule:** the Flutter app never writes coin balances directly. All coin-affecting events (offer completion, ad view, game round, redemption) go through the Node.js API, which is the single source of truth via an append-only ledger.

---

## 2. Data Model

### 2.1 `users`
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| google_uid | string, unique | from Firebase Auth |
| email | string | from Google profile |
| display_name | string | |
| country | string | detected at signup (IP-based) |
| device_id | string, indexed | primary device fingerprint |
| status | enum(active, flagged, banned) | |
| coin_balance_cached | integer | **cache only** — always derived from ledger, recomputed on read or via trigger, never trusted as source of truth |
| created_at, last_seen_at | timestamp | |

### 2.2 `coin_ledger` (append-only)
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK | |
| amount | integer | positive = credit, negative = debit |
| source_type | enum(game, offer, ad, referral, redemption, admin_adjustment) | |
| source_ref_id | string | offer_completion_id / ad_impression_id / redemption_id / etc. |
| idempotency_key | string, unique | **critical** — prevents duplicate postback credits |
| balance_after | integer | snapshot for audit/debug |
| created_at | timestamp | |

### 2.3 `offers` / `offer_networks`
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| network | enum(adjoe, adgate, offertoro, cpx) | |
| external_offer_id | string | network's own ID |
| title, description | string | |
| coin_reward | integer | |
| requirements | jsonb | e.g. `{"min_playtime_seconds": 120}` for Adjoe-style offers |
| is_active | boolean | admin-togglable |

### 2.4 `offer_completions`
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id, offer_id | FK | |
| network | string | |
| status | enum(pending, credited, rejected) | |
| network_payload | jsonb | raw postback payload, retained for dispute resolution |
| credited_at | timestamp, nullable | |

### 2.5 `ad_impressions`
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | FK | |
| network | enum(applovin_max, unity_levelplay, admob) | |
| ad_unit_id | string | |
| coin_reward | integer | server-validated against server-side reward callback, not client claim alone |
| verified | boolean | true only after server-to-server ad verification (MAX/LevelPlay SSV) |

### 2.6 `gift_cards` (catalog)
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| brand | enum(amazon, flipkart, google_play) | |
| denomination | integer | e.g. 50, 100, 250 (₹) |
| coin_cost | integer | fixed, admin-configurable |
| is_active | boolean | |

### 2.7 `redemptions`
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id, gift_card_id | FK | |
| coin_amount | integer | debited from ledger on request (not on approval — reserve coins immediately, reverse on rejection) |
| status | enum(requested, under_review, approved, rejected, issued) | |
| fulfillment_method | enum(api_xoxoday, api_qwikcilver, manual) | |
| gift_card_code | string, encrypted at rest | populated on issuance |
| reviewed_by_admin_id | uuid, nullable | |
| created_at, resolved_at | timestamp | |

### 2.8 `referrals`
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| referrer_id, referred_id | FK to users | |
| bonus_percent | decimal | snapshot of rate at time of referral (don't retroactively change) |
| valid_until | timestamp | capped window, e.g. 30 days |

### 2.9 `fraud_flags`
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | FK | |
| rule_triggered | string | e.g. `same_device_multi_account`, `offer_velocity_exceeded` |
| severity | enum(low, medium, high) | |
| auto_action | enum(none, flagged_for_review, auto_banned) | |
| created_at | timestamp | |

### 2.10 `admin_audit_log`
| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| admin_id | FK | |
| action | string | e.g. `redemption_approved`, `balance_adjusted`, `offer_disabled` |
| target_type, target_id | string | |
| reason | text | required for any manual balance adjustment |
| created_at | timestamp | |

---

## 3. API Contracts (Node.js REST, JWT-authenticated except where noted)

### 3.1 Auth
```
POST /api/auth/google
  body: { id_token: string }         // Firebase ID token from Flutter
  → verifies via Firebase Admin SDK, creates/loads user, checks device fingerprint
  → returns: { access_token, refresh_token, user }

POST /api/auth/refresh
  body: { refresh_token }
  → returns: { access_token }
```

### 3.2 Wallet
```
GET /api/wallet
  → { coin_balance, pending_offer_credits, recent_ledger_entries[] }

GET /api/wallet/ledger?cursor=&limit=
  → paginated ledger history
```

### 3.3 Game
```
POST /api/game/round-complete
  body: { round_id, difficulty, client_score }
  → server validates round_id was actually issued (anti-replay), applies daily cap check
  → credits coin_ledger with source_type=game
  → { coins_earned, new_balance, daily_cap_remaining }
```

### 3.4 Offers
```
GET /api/offers
  → list of active offers, per-user eligibility already filtered (country, device)

POST /api/offers/:offer_id/launch
  → returns signed webview URL / SDK launch token with user_id embedded for postback matching
```

### 3.5 Offerwall Postback (public webhook, HMAC-signed by network, NOT JWT)
```
POST /api/webhooks/offerwall/:network   (e.g. /api/webhooks/offerwall/adjoe)
  → verify signature against network's shared secret
  → idempotency_key = network + external_transaction_id (dedupe retries)
  → find/create offer_completion, set status=credited
  → write coin_ledger entry
  → respond 200 quickly (networks retry aggressively on non-2xx/timeout)
```

### 3.6 Ads
```
POST /api/ads/reward-callback   (server-side verification, called by ad SDK backend, not client)
  body: network-specific SSV payload (e.g. AppLovin MAX server-side reward verification, Unity LevelPlay SSV)
  → verify signature, credit coin_ledger with source_type=ad
```
*Note: never credit coins purely on the client-side "ad completed" callback — always require the network's server-side verification (SSV) endpoint. Client-only crediting is the single biggest coin-farming exploit in this app category.*

### 3.7 Referral
```
GET /api/referral/my-code
POST /api/referral/redeem   body: { code }   // called once at signup by the referred user
```

### 3.8 Redemption / Gift Cards
```
GET /api/gift-cards                        → active catalog
POST /api/redemptions
  body: { gift_card_id }
  → checks balance ≥ coin_cost, reserves (debits) coins immediately, creates redemption(status=requested)
GET /api/redemptions/mine                  → user's redemption history/status
```

### 3.9 Admin (role-gated, separate auth scope)
```
GET  /api/admin/users?filter=&cursor=
POST /api/admin/users/:id/adjust-balance   body: { amount, reason }   // writes ledger + audit log
POST /api/admin/users/:id/ban

GET  /api/admin/redemptions?status=requested
POST /api/admin/redemptions/:id/approve     → triggers gift-card fulfillment call
POST /api/admin/redemptions/:id/reject      → reverses the reserved coin debit

GET  /api/admin/offers
PATCH /api/admin/offers/:id                 → enable/disable, edit coin_reward

GET  /api/admin/dashboard/metrics           → DAU, coins issued vs redeemed, offer completion rates, outstanding gift-card liability
```

---

## 4. Coin Ledger & Idempotency Design

- Every credit/debit is a new row, never an update — `coin_balance_cached` on `users` is a denormalized read-optimization only, recomputed via a Postgres trigger or scheduled reconciliation job, and any drift is a bug to fix, not a value to trust
- `idempotency_key` uniqueness constraint at the DB level is the actual anti-duplication mechanism — application code should treat a unique-constraint violation on insert as "already credited, no-op" rather than erroring
- Redemption debits happen at **request** time (reserve pattern), not at approval time — this prevents a user from spending the same coins on two simultaneous redemption requests; rejection reverses the debit with a new ledger row (never delete/edit the original)

---

## 5. Fraud & Risk Engine (Node.js + Redis)

| Rule | Detection | Action |
|---|---|---|
| Multi-accounting | Same `device_id` linked to >2 accounts | Flag all linked accounts for review |
| Offer velocity abuse | >N offer completions in X minutes (Redis sliding window counter) | Auto-hold credit, queue for manual review |
| Self-referral | Referrer and referred share device_id/IP | Block referral bonus, flag both accounts |
| Game round farming | Round completions submitted faster than min. possible play time | Reject round, flag account |
| Redemption abuse | New account requesting max-value gift card immediately | Force manual review regardless of normal auto-rules |

Redis is used for velocity counters (sliding window, TTL-based) since these need sub-100ms checks on the hot path; Postgres holds the durable `fraud_flags` record once a rule fires.

---

## 6. Gift Card Fulfillment Workflow

1. Admin approves a `redemption` (status → approved)
2. Backend calls the fulfillment provider (Xoxoday/Qwikcilver/Cashfree API) **or** pulls the next unused code from a manually-uploaded inventory table, depending on which sourcing route you pick (open question from the PRD)
3. Code is encrypted at rest in `redemptions.gift_card_code`, delivered to the user via in-app screen + email, status → issued
4. If the API call fails, redemption stays `approved` with a retry queue — never silently drop a paid-for redemption

---

## 7. Ad & Offerwall Integration Notes (Flutter-specific)

- **AppLovin MAX**: official Flutter plugin exists (`applovin_max`) — use it directly
- **Unity LevelPlay**: official Flutter plugin exists (`unity_ads_plugin` / LevelPlay Flutter SDK) — use it directly
- **AdMob**: `google_mobile_ads` Flutter plugin — official, well-maintained
- **Adjoe**: primarily ships native Android/iOS SDKs — check current Flutter plugin availability before committing; if none exists, wrap via a small native Android module + Flutter platform channel (MethodChannel)
- **AdGate/OfferToro/CPX Research**: typically webview-based (a signed URL you load in an in-app webview), which sidesteps the native-SDK/Flutter-plugin question entirely — often the simpler integration path for the non-Adjoe offerwalls

---

## 8. Security Requirements

- All coin-affecting endpoints require valid JWT except the offerwall postback webhook, which instead requires HMAC signature verification against each network's shared secret
- Gift card codes encrypted at rest (e.g. AES-256 column-level encryption), decrypted only for display to the owning user and immediately re-masked in logs
- Admin panel requires separate role-based auth scope from regular users — never reuse the same JWT audience
- Rate-limit all public endpoints (especially `/api/game/round-complete` and `/api/redemptions`) at the API gateway/Node middleware level
- Firebase ID token verification must check `aud` and `iss` claims match your Firebase project — standard Firebase Admin SDK verification handles this if used correctly

---

## 9. Non-Functional Requirements

- Postback webhook must respond within the offer network's timeout window (typically 5–10s) — do heavy processing (fraud checks, notifications) async after the 200 response, not inline
- Ledger table should be indexed on `(user_id, created_at)` for wallet history queries and on `idempotency_key` (unique) for dedupe
- Admin dashboard metrics can be pre-aggregated hourly (materialized view or scheduled job) rather than computed live — DAU/coins-issued/redeemed queries over a growing ledger table will get slow otherwise

---

## 10. Environments & Deployment

- **Dev/staging/prod** separation with separate Firebase projects (separate Google Sign-In client IDs per environment)
- Offerwall/ad network sandbox modes should be used in staging — most networks (Adjoe, AppLovin, AdGate) provide test credentials/sandbox postbacks
- Secrets (network HMAC keys, gift-card API keys) in environment-managed secret storage, never committed to the repo

---

## 11. Open Technical Decisions (carried over from PRD + new)

- Gift card fulfillment: API-based (Xoxoday/Qwikcilver/Cashfree) vs. manual inventory — determines whether section 6's step 2 is synchronous API call or manual admin action
- Confirm Adjoe Flutter plugin availability at build time — if native-only, budget extra time for the platform-channel wrapper
- Decide DB: Postgres vs MySQL — Postgres recommended here for native `jsonb` support (used in `offers.requirements` and `offer_completions.network_payload`)
- Decide whether `coin_balance_cached` is trigger-maintained or recomputed on-read; trigger is faster reads, recompute-on-read is simpler correctness guarantee for a v1
