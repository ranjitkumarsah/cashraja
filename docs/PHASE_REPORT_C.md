# PHASE_REPORT_C.md — Redemption, Gift-Card Inventory, Admin API + Panel

**Date:** 2026-07-21 · **Status:** ✅ Complete — backend + panel verified, owner-tested live

---

## Completed Tasks (TASKS.md C1–C5)

### Backend (committed earlier: 9e43da4)
- **C1 Gift cards & inventory** — catalog CRUD; ManualInventoryProvider with AES-256-GCM code encryption, HMAC-fingerprint dedupe, masked everywhere except an audited super-admin reveal; low-stock alerts.
- **C2 Redemption flow** — reserve-debit at request, reject→reverse, approve→issue-from-inventory (row-locked, idempotent); out-of-stock stays approved + BullMQ retry + alert (never lost); banned-after-request forced to under_review; `/api/redemptions/mine`; account deletion (anonymize, ledger preserved).
- **C3 Admin API** — users (list/detail/ledger, super-admin balance-adjust + ban/unban), redemption queue + approve/reject + CSV export, offers + postback logs, versioned config, admins management, fraud queue, all RBAC-enforced server-side; every mutation writes admin_audit_log in the same transaction.
- **C4 Metrics** — hourly aggregation job + dashboard endpoint (DAU, coins issued/redeemed, completion rate, outstanding liability).
- **219 backend tests** (184 unit + 35 integration), incl. E2E #3 (reject-reverse), #5 (concurrent race), out-of-stock retry, RBAC negatives, encryption round-trip.

### Admin panel — all 8 feature screens (this commit)
Dashboard (stat tiles + Recharts), Users (table + ledger drawer + adjust-balance/ban), Redemptions (status-tabbed queue + approve/reject + CSV), Offers (toggle + inline edit + postback logs), Inventory (stock grid + upload + audited reveal), Fraud (queue + resolve), Config (versioned JSON editor), Admins (create + one-time temp password + disable). Premium Raja theme throughout, role-gated in UI + enforced server-side. **49 panel tests.**

## Owner live-testing → 4 bugs found & fixed (this commit)
Real hands-on testing surfaced four defects, all fixed and re-verified:
1. **Inventory brand** — free-text input allowed "Flipkart" (rejected by the lowercase enum) → replaced with a proper **dropdown** (Amazon/Flipkart/Google Play).
2. **Inventory codes** — form sent an array; backend expects a raw string → now sends raw pasted text (backend splits/trims/dedupes).
3. **Inventory list stale status** (owner's reported issue) — list showed a code as `unused` after it was issued. Data was always correct (DB + API verified: 4 unused / 1 issued); the list wasn't refreshing. Fixed: redemption approve/reject now invalidates inventory + stock + dashboard queries, and the Inventory screen force-refetches on mount.
4. **Two test-hygiene failures** (`theme`, `guards`) — these tests rendered data-fetching pages without mocking axios, which redirected them to login. Added URL-aware axios mocks (matching every other passing test).

## Verification (independent, main session)
- Backend: build/lint/typecheck clean; 219 tests green (incl. live-DB integration).
- Panel: build/lint/typecheck clean; **49/49 tests green**.
- Live end-to-end (owner-driven): logged into panel with TOTP, uploaded Flipkart ₹50 inventory, approved a redemption → code issued from stock, stock levels + audited reveal confirmed. Backend redemption reserve verified (test user balance 6000→1000 on request).

## Notes / Deviations
- CPX offerwall: adapter is code-complete; **activation deferred to deployment** (needs a public postback URL + the Flutter app) — per owner decision. Credentials recorded in `D:\Secrets`.
- Build warns admin JS chunk > 500 kB (Recharts) — advisory only.
- Dev secrets remain development defaults; production boot refuses them (swap at Phase F deploy).

## Next Phase
**D — Engagement** (in progress): game (server-issued rounds, anti-replay, caps), streaks (IST cycle), scratch/spin (server-side weighted tables), referral earnings fan-out. Then **E** (fraud engine that populates the Fraud queue, notifications, Flutter app) and **F** (E2E, load, security, deployment).
