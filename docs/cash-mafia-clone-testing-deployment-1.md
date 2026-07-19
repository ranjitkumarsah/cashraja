# Testing & Deployment: Coin Rewards / Offerwall App (Cash Mafia Clone)

**Status:** Draft v1
**Owner:** Ranjit
**Related docs:** PRD, TRD, BRD, Data & Security, Strategy (cash-mafia-clone-*.md)

---

## 1. Testing Strategy Overview

Because the core risk in this product is **money leakage via the coin ledger** (not UI polish), testing priority is inverted from a typical consumer app: ledger correctness, postback idempotency, and fraud-rule accuracy get the most test investment; the game screen and cosmetic UI get the least.

---

## 2. Backend (Node.js) Testing

### 2.1 Unit tests
- Ledger write logic: every credit/debit path (game, offer, ad, referral, redemption, admin adjustment) produces a correctly signed ledger row
- Idempotency: duplicate `idempotency_key` inserts are no-ops, not errors, and don't double-credit
- Coin balance derivation: cached balance always matches sum-of-ledger for a given user (property-based test: generate random sequences of credits/debits, assert invariant holds)
- Redemption reserve/reverse logic: requesting a redemption debits immediately; rejection reverses with a new ledger row, never mutates the original

### 2.2 Integration tests
- Offerwall postback webhook: simulate signed payloads from each network's format (Adjoe, AdGate, OfferToro, CPX) — valid signature credits coins, invalid signature is rejected, replayed payload is a no-op
- Ad reward server-side verification (SSV): simulate AppLovin MAX / Unity LevelPlay / AdMob SSV callbacks — same valid/invalid/replay coverage as offerwall postbacks
- Auth flow: Firebase Google ID token verification, JWT issuance, refresh token rotation
- Admin actions: balance adjustment writes both a ledger row and an audit log entry in the same transaction (test rollback-on-failure too — never allow one to succeed without the other)

### 2.3 Fraud rule tests
- Each rule from the TRD's fraud table (multi-accounting, offer velocity, self-referral, game round farming, redemption abuse) needs a dedicated test simulating the triggering condition and asserting the correct auto-action fires
- Redis-backed velocity counters: test window expiry behavior explicitly (a common source of off-by-one bugs)

### 2.4 Load/performance testing
- Postback webhook must be tested under burst load — offer networks send postbacks in bursts, and the endpoint must respond within their timeout window (5–10s) even under load; verify heavy processing is genuinely async and not blocking the response
- Redemption endpoint and game-round endpoint are the two most abuse-prone — load-test alongside rate-limit configuration, not just for throughput

---

## 3. Mobile (Flutter) Testing

- **Widget/unit tests:** wallet display, offer list rendering, redemption flow UI states (requested/under_review/approved/issued)
- **Integration tests:** full auth flow (Google Sign-In → token exchange → home screen), offer launch → webview/SDK handoff
- **SDK sandbox testing:** every ad/offerwall network (AppLovin MAX, Unity LevelPlay, AdMob, Adjoe, AdGate, OfferToro, CPX Research) provides sandbox/test credentials — integrate and verify each one credits correctly in a controlled test environment before touching production credentials
- **Device fragmentation:** test on a range of real Android versions/OEMs (not just emulators) given "Android 6.0+" is a wide range — offerwall SDKs in particular can behave inconsistently on lower-end/older devices, and this app's user base skews toward budget Android hardware
- **Platform channel testing (if Adjoe needs a native wrapper):** test the MethodChannel bridge explicitly, since this is custom code with no official Flutter-side test coverage from the vendor

---

## 4. Admin Panel (React) Testing

- Role-based access control: verify a support/reviewer-role admin genuinely cannot hit balance-adjustment or offer-config endpoints, not just that the UI hides the buttons
- Redemption approval flow: approve → fulfillment call triggered → status updates correctly; reject → coin reversal happens correctly
- Dashboard metrics accuracy: spot-check aggregated numbers (DAU, coins issued/redeemed, outstanding liability) against raw ledger queries

---

## 5. End-to-End (E2E) Test Scenarios

Priority scenarios to script and run before every release:

1. New user signs up (Google Sign-In) → completes a game round → completes an offer (sandbox) → views a rewarded ad (sandbox) → balance reflects all three correctly
2. User requests a redemption → admin approves → gift card issued and visible to user
3. User requests a redemption → admin rejects → coins are returned to balance
4. Duplicate offerwall postback (same transaction ID sent twice) → coins credited only once
5. Two simultaneous redemption requests from the same user for more coins than they have → only one succeeds
6. Referred user signs up via referral link → completes qualifying action → referrer receives bonus at the correct rate
7. Flagged/banned user attempts any coin-earning action → correctly blocked

---

## 6. QA Environment & Sandbox Setup

- Separate Firebase project for dev/staging (own Google Sign-In client ID) — never test against production auth
- Sandbox/test modes for every ad and offerwall network, using each network's provided test credentials — confirm this is genuinely available for Adjoe, AdGate, OfferToro, and CPX Research specifically, since sandbox support quality varies by network and this should be checked early, not assumed
- Staging database seeded with realistic-volume synthetic data for performance testing (thousands of ledger rows per user, not a handful) — bugs in balance derivation often only surface at volume

---

## 7. Deployment Pipeline

- **CI:** run unit + integration test suites on every PR (backend and Flutter separately); block merge on failure
- **CD (backend):** staged rollout — deploy to staging, run E2E smoke suite (Section 5 scenarios), then promote to production
- **CD (Flutter):** internal testing track → closed testing track (small real-user cohort) → production, using Play Console's staged rollout percentage feature (start at 5–10% of new installs, watch crash/ANR rates and fraud-flag volume before ramping)
- **Secrets:** environment-specific secret injection (never shared between staging/prod), consistent with the Data & Security doc's secrets management section
- **Rollback plan:** backend deploys should be reversible (previous version redeployable) without a data migration that can't be rolled back — be especially careful with ledger schema migrations, since this table should never need a destructive change post-launch

---

## 8. Play Store Submission Checklist

- Data Safety form matches the actual data inventory (from the Data & Security doc) exactly — no under-declaring ad/offerwall data sharing
- Store listing copy avoids "guaranteed income"/"get rich" language (Strategy doc, Section 1)
- Content rating questionnaire answered accurately given task/offer completion may involve third-party signups
- Privacy Policy and Terms of Service links live and accurate before submission, not placeholder text
- App name/icon/screenshots confirmed distinct from the reference portfolio (Strategy doc, Section 4) before submission — a late rename after review flags similarity costs a full re-review cycle

---

## 9. Post-Launch Monitoring

- **Ledger integrity job:** scheduled reconciliation comparing `coin_balance_cached` against sum-of-ledger for all users — alert on any drift, this should never happen and is a signal of a real bug if it does
- **Fraud flag volume dashboard:** sudden spikes indicate either a new abuse pattern or a legitimate feature bug (e.g. a rule firing too aggressively) — needs daily eyes early on
- **Network payout reconciliation:** periodically cross-check offerwall/ad network dashboards against your own recorded completions — discrepancies can indicate either missed postbacks (revenue leak) or over-crediting (margin leak)
- **Redemption liability tracking:** outstanding approved-but-not-yet-issued gift card value, watched against available fulfillment budget/float
- **Crash/ANR monitoring** (Flutter side) via Play Console vitals — offerwall/ad SDK integrations are a common source of native crashes, watch this closely in the first weeks

---

## 10. Open Items

- Confirm sandbox/test credential availability for each offerwall network before finalizing the QA environment plan
- Decide staged rollout percentages and ramp schedule for the first production release
- Set up the ledger reconciliation job's alerting destination (Slack/email/on-call) before launch, not after an incident
