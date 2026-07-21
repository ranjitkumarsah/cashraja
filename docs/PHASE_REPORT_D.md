# PHASE_REPORT_D.md — Engagement: Game, Streaks, Scratch/Spin, Referral

**Date:** 2026-07-21 · **Status:** ✅ Complete — verified, committed

---

## Completed Tasks (TASKS.md D1–D4)

- **D1 Game** — `POST /game/round-start` (server-issued round, daily cap, expiry) + `POST /game/round-complete` (anti-replay, wrong-user 403, expired 410, min-play-time → reject + `game_farming` fraud signal). Credits via LedgerService, key `game:${roundId}`.
- **D2 Streaks** — `GET /streak` + `POST /streak/claim` with IST-calendar-day logic (first/continue/double-claim-reject/break-reset/day-7 cycle). Key `streak:${userId}:${IST-date}`.
- **D3 Scratch/Spin** — `GET /bonus/:type` + `POST /bonus/:type/play`; server-side weighted roll via `node:crypto.randomInt` (client cannot influence outcome); daily attempt caps. Key `bonus:${attemptId}`.
- **D4 Referral** — earnings fan-out: `ReferralService.onUserEarned` credits the referrer their snapshot percent when a referred user earns (wired into postback worker + game/streak/bonus credit paths), within the referral window, skipping self/flagged/banned. `GET /referral/my-code`, `GET /referral/stats`. Key `referral:${sourceLedgerId}`.

All amounts server-authoritative from `app_config`/`bonus_config`; `client_score` ignored for rewards; every credit through LedgerService with idempotency.

## Migration
`0005_phase_d_engagement` (additive) — LedgerSourceType `streak`+`bonus`, `game_rounds.expires_at`, UNIQUE on `referral_earnings.source_ledger_id`. Config: added `game.round_expiry_seconds` (default 120).

## Verification (independent, main session)
- typecheck ✓ · build ✓ · lint ✓
- Engagement integration (live Postgres): streak double-claim rejected, bonus daily cap + server-roll, game anti-replay + foreign-round reject, **referral fan-out credits referrer the snapshot %** — all green.
- Agent full run: **225 unit + 39 integration** tests passing (all prior phases stay green).

## Deviations
- Referral idempotency anchored on `source_ledger_id` (not a fresh earning UUID) — the correct dedupe guarantee, backed by the new UNIQUE constraint.
- `onUserEarned` is best-effort/non-throwing in the earner's path (their credit already committed); worker retries re-run it idempotently.
- "Flagged referral" = skip payout if referrer banned / referred non-active / self-referral (referrals table has no per-row flag column).
- `GET /me` keeps its `streak: null` placeholder; `GET /streak` is the D2 surface.

## Phase E handoff
- Fraud engine binds real impls behind `FRAUD_SIGNAL_HOOK` (receives `game_farming`, `self_referral`) + existing `FRAUD_CHECK_SERVICE` (currently log-only).
- Bonus unlock gate is a stubbed always-available check — wire ad-view/streak-milestone gating there.
- Engagement credits don't yet emit notifications — add when FCM/inbox lands.
- Flutter app consumes these 8 endpoints (app agent building in parallel).

## Next
**E** — fraud engine (populates the admin Fraud queue), notifications, wire the Flutter app's Phase-D screens (game/scratch/spin/referral) which are currently placeholders. Then **F** (E2E, load, security, deployment).
