# ARCHITECTURE_PLAN.md — Coin Rewards / Offerwall App ("Cash Raja")

**Generated:** 2026-07-19 · **Phase:** 3 — Architecture Validation
**Inputs:** TRD v1 + resolved decisions (GAP_ANALYSIS §6: full v1 scope · manual gift-card inventory · email+password+TOTP admin auth · mock network adapters)

---

## 1. Repository Layout (monorepo)

```
Cash Raja/
├── docs/                     # source-of-truth project docs (existing)
├── backend/                  # Node.js API — NestJS 11 + TypeScript + Prisma + PostgreSQL + Redis
│   ├── prisma/               #   schema.prisma, migrations, seed
│   └── src/
│       ├── common/           #   guards, decorators, filters, crypto, config
│       ├── modules/
│       │   ├── auth/         #   Google token exchange, JWT, refresh rotation
│       │   ├── admin-auth/   #   email+password+TOTP, admin JWT (separate audience)
│       │   ├── users/        #   profile, devices, account deletion (anonymize)
│       │   ├── ledger/       #   THE CORE — append-only writes, idempotency, balance
│       │   ├── wallet/       #   balance + history endpoints
│       │   ├── game/         #   round issue/complete, anti-replay, caps
│       │   ├── streaks/
│       │   ├── bonus/        #   scratch/spin, server-side probability tables
│       │   ├── offers/       #   catalog, launch tokens, completions
│       │   ├── postbacks/    #   /webhooks/offerwall/:network — HMAC verify, fast-200
│       │   ├── ads/          #   SSV callbacks per network
│       │   ├── referrals/
│       │   ├── redemptions/  #   reserve-debit, status flow, fulfillment
│       │   ├── giftcards/    #   catalog + encrypted manual inventory
│       │   ├── fraud/        #   rules engine + Redis velocity counters
│       │   ├── notifications/#   FCM push + in-app inbox
│       │   ├── admin/        #   RBAC-gated management endpoints
│       │   └── metrics/      #   dashboard aggregates (scheduled)
│       ├── providers/        #   ADAPTER LAYER (see §4)
│       │   ├── offerwall/    #     adjoe | adgate | offertoro | cpx | mock
│       │   ├── ad-ssv/       #     applovin | levelplay | admob | mock
│       │   └── giftcard/     #     manual-inventory | xoxoday(stub) | mock
│       └── jobs/             #   BullMQ workers: postback processing, reconciliation, aggregates
├── admin/                    # React 18 + Vite + TypeScript + Tailwind CSS 4 + shadcn-style components + Recharts
│   └── src/features/         #   dashboard, users, redemptions, offers, fraud, inventory, config, admins
├── app/                      # Flutter (Android) — Riverpod + go_router + dio
│   └── lib/
│       ├── core/             #   theme, api client, router, l10n scaffolding (en + hi-ready)
│       └── features/         #   auth, home, game, tasks, wallet, bonus, referral, redeem, inbox, profile
├── shared/                   # OpenAPI spec (backend-generated) → typed clients for admin & app
├── docker-compose.yml        # postgres + redis + backend + admin (dev & prod-shaped)
└── .github/workflows/        # CI: backend suite, admin suite, flutter analyze+test
```

**Why NestJS over plain Express:** the TRD allows either; Nest's module DI maps 1:1 onto the required provider-adapter pattern, guards/pipes give RBAC + validation without boilerplate, `@nestjs/schedule` + BullMQ cover reconciliation/aggregation jobs, and its testing harness supports the ledger-heavy unit suite the Testing doc demands.
**Why Prisma:** typed schema-as-code, migration history (roll-back-safe requirement), and clean unique-constraint-violation handling — the DB-level idempotency mechanism the TRD §4 mandates (`P2002` → treat as already-credited no-op).

---

## 2. Backend Architecture

### 2.1 Ledger core (single write path)
Every coin movement goes through **one** service method:

```
LedgerService.record({ userId, amount, sourceType, sourceRefId, idempotencyKey })
  → INSERT coin_ledger row inside a transaction
  → on unique-violation(idempotency_key): return existing row (no-op, not error)
  → balance_after computed in-transaction via SELECT ... FOR UPDATE on user row
  → coin_balance_cached updated in same transaction (write-through cache;
     authoritative value remains SUM(ledger); nightly reconciliation job alerts on drift)
```

No other module writes `coin_ledger`. Redemption reserve = negative `record()` at request time; rejection = compensating positive `record()` referencing the original (never mutate/delete).

*(Resolves TRD open item U3: write-through-in-transaction + reconciliation job — same correctness as recompute-on-read, without the hot-path SUM.)*

### 2.2 Postback pipeline (fast-200 + durable async)
```
POST /api/webhooks/offerwall/:network
  1. Resolve network adapter → verify HMAC signature (reject 401 before anything)
  2. Parse to canonical PostbackEvent {userId, externalTxnId, coins, raw}
  3. Persist offer_completion (status=pending) + enqueue BullMQ job
  4. Respond 200   (< 500ms budget; network timeout is 5–10s)
Worker (async):
  5. Fraud pre-checks (velocity via Redis, flags) → hold or credit
  6. LedgerService.record(idempotencyKey = `${network}:${externalTxnId}`)
  7. Referral bonus fan-out (if referred user within window) — its own idempotency key
  8. FCM notification
```
Ad SSV callbacks (`/api/webhooks/ads/:network`) use the identical pipeline with per-network signature verification (AppLovin MAX SSV, LevelPlay SSV, AdMob SSV key — covers gap A10).

### 2.3 Auth
- **Users:** Flutter obtains Firebase ID token → `POST /api/auth/google` → Firebase Admin SDK verify (aud+iss) → upsert user + device row → issue access JWT (15 min, `aud=app`) + refresh token (30 d, hashed in DB, rotation with reuse-detection revocation).
- **Admins:** `POST /api/admin-auth/login` (email+bcrypt password) → TOTP challenge → admin JWT (`aud=admin`, 8 h). Separate guard chain; user JWTs are rejected on admin routes by audience, not just role.
- **RBAC matrix (draft for approval — gap P2):**

| Action | Reviewer | Super-admin |
|---|---|---|
| View users/ledgers/flags, redemption queue | ✅ | ✅ |
| Approve/reject redemptions | ✅ | ✅ |
| Adjust balances (reason mandatory) | ❌ | ✅ |
| Offer/network/config/rates management | ❌ | ✅ |
| Gift-card inventory upload / reveal codes | ❌ | ✅ |
| Manage admin accounts | ❌ | ✅ |
| Export payout CSV | ✅ | ✅ |

### 2.4 Fraud engine
Rule objects (`FraudRule` interface) evaluated at defined hook points (signup, postback-credit, game-complete, referral-redeem, redemption-request). Redis sliding-window counters (`ZADD`/`ZREMRANGEBYSCORE`, TTL) for velocity; durable `fraud_flags` row on trigger; auto-actions: none / hold-credit / flag / ban. Thresholds live in `app_config` (admin-tunable), defaults: flag device >2 accounts, hard-block >3 (per C3).

### 2.5 Security implementation
- Gift-card codes: AES-256-GCM column encryption (key from env), masked in all API responses except single audited "reveal" endpoint (super-admin, logged).
- Helmet, CORS allowlist, rate limits via `@nestjs/throttler` + Redis (strictest on `/game/round-complete`, `/redemptions`).
- All secrets via env (`.env.example` committed, real values never); Flutter carries only public SDK keys.
- `admin_audit_log` row written in the same transaction as every mutating admin action.

---

## 3. Data Model — TRD §2 plus gap fixes

TRD tables adopted as-is: `users`, `coin_ledger`, `offers`, `offer_completions`, `ad_impressions`, `gift_cards`, `redemptions`, `referrals`, `fraud_flags`, `admin_audit_log`.

**Added (from GAP_ANALYSIS §3):** `admins` (D1) · `devices` many-to-many (D2) · `refresh_tokens` (D3) · `game_rounds` (D4) · `streaks` (D5) · `bonus_attempts` + `bonus_config` (D6) · `gift_card_inventory` (D7 — encrypted codes, status unused/reserved/issued, uploaded_by) · `notifications` (D8) · `users.referral_code` + `referral_earnings` (D9) · `app_config` versioned (D10) · `redemptions.rejection_reason`, `ad_impressions.ssv_payload` (D11).

**DB: PostgreSQL 16** (U2 — TRD's own recommendation; jsonb for `offers.requirements`, `network_payload`).

---

## 4. Provider Adapter Layer (the mock-first decision, U5)

```ts
interface OfferwallAdapter  { verifySignature(req): boolean; parsePostback(req): PostbackEvent; buildLaunchUrl(user, offer): string }
interface AdSsvAdapter      { verifyCallback(req): Promise<VerifiedReward | null> }
interface GiftCardProvider  { fulfill(redemption): Promise<FulfillmentResult> }   // v1: ManualInventoryProvider
```
Each interface ships with: real-network skeletons (signature schemes per public network docs, marked `NEEDS_CREDENTIALS`) + a fully functional **mock driver** (deterministic signatures, sandbox postback simulator CLI) selected by env config. E2E tests run entirely on mocks; swapping to production networks is configuration + credentials, not code.

Flutter side mirrors this: `OfferwallLauncher` / `RewardedAdService` abstractions with mock implementations (simulated ad view → triggers mock SSV against dev backend), real SDK wiring (`applovin_max`, `google_mobile_ads`, Adjoe platform-channel) added when accounts exist.

---

## 5. Frontend Architecture

### 5.1 Flutter app
- **State:** Riverpod (providers per feature, `AsyncNotifier` for API state) · **Routing:** go_router with auth redirect · **HTTP:** dio + interceptor (JWT attach, 401→refresh→retry, rotation-aware).
- **Structure:** feature-first (`features/<name>/{data,domain,presentation}`), core design system in `core/theme`.
- **l10n:** `flutter_intl` scaffolding from day one, `en` strings; `hi` slot ready (C4).
- Offline-tolerant wallet screen (last-known balance cached, clearly stamped).

### 5.2 Admin panel
- React 18 + Vite + TS; TanStack Query (server state) + TanStack Table (queues/lists); react-hook-form + zod (mirrors backend DTOs); Recharts for dashboard.
- Route guards by role from admin JWT claims; API client generated from backend OpenAPI spec (`shared/`).

### 5.3 Premium theme (owner directive) — "Raja" design language
| Token | App (dark-first) | Admin (light-first, dark toggle) |
|---|---|---|
| Primary | Deep royal indigo `#1E1B4B` → `#312E81` surfaces | Indigo `#312E81` |
| Accent | Regal gold `#D4AF37` / amber gradient `#F5C518→#B8860B` (coins, CTAs) | Gold `#B8860B` restrained (highlights only) |
| Success/Danger | Emerald `#10B981` / Rose `#E11D48` | same |
| Type | Bundled variable font (Manrope for UI, tabular numerals for balances) | Inter |
| Texture | Subtle radial glows, soft elevation, gold-rim coin iconography, no clutter | Airy spacing, card-based, crisp data tables |
All coin values render with tabular numerals and a consistent coin glyph; motion kept subtle (balance count-up, streak flame) — premium = restraint + consistency, not effects.

---

## 6. Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Caching | Redis: session-adjacent lookups, config cache (invalidate on admin change), velocity counters |
| Queues/jobs | BullMQ (Redis): postback processing, notification fan-out, retry-able fulfillment |
| Scheduled | `@nestjs/schedule`: nightly ledger reconciliation (drift alert), hourly metrics aggregates, pending-credit expiry (30 d void, P5), refresh-token purge |
| Logging | pino structured logs; gift-card codes + tokens scrubbed by serializer allowlist |
| Monitoring | `/healthz` + `/readyz`; reconciliation drift + fraud-spike alerts to configurable webhook (Slack-ready, U4-agnostic) |
| API docs | Nest OpenAPI decorators → swagger JSON in `shared/` → generated TS + Dart clients |
| Migrations | Prisma migrate; ledger migrations additive-only (enforced by review checklist) |

---

## 7. Environments & Deployment

- `.env`-driven config, three profiles (dev/staging/prod), separate Firebase projects per TRD §10.
- `docker-compose.yml`: postgres:16, redis:7, backend, admin (nginx-served build) — dev parity and generic-VPS prod deploy (U4 default until a host is chosen).
- CI (GitHub Actions): backend lint+typecheck+unit+integration (Postgres/Redis service containers), admin lint+typecheck+test+build, Flutter analyze+test. Merge blocked on failure (Quality Gates).
- CD: staging deploy → E2E smoke (Testing doc §5 scenarios on mock adapters) → manual prod promote. Play Console staged rollout is an operational step documented in DEPLOYMENT notes.

---

## 8. Validation Against Phase-3 Checklist

folder structure ✅ · backend ✅ · frontend ✅ · admin ✅ · API ✅ (TRD contracts + gap A1–A10 additions) · authn ✅ · authz ✅ (RBAC matrix §2.3) · caching ✅ · queues ✅ · background jobs ✅ · logging ✅ · monitoring ✅ · scalability ✅ (stateless API, queue workers scale horizontally; aggregates pre-computed) · security ✅ (§2.5, Data & Security doc fully mapped)

**Deviations from TRD:** none of substance — additions only (tables/endpoints the TRD implied but didn't spec), plus the write-through cache choice explicitly left open by the TRD.
