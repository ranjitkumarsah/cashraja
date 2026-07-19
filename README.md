# Cash Raja — Coin Rewards / Offerwall Platform

Android rewards app (Flutter) + Node.js API + React admin panel. Users earn coins via offerwall tasks, rewarded ads, and casual gameplay; coins redeem for gift cards (Amazon.in / Flipkart / Google Play) after manual admin approval.

## Monorepo layout

| Path | What | Stack |
|---|---|---|
| `backend/` | API, coin ledger, fraud engine, webhooks, jobs | NestJS · Prisma · PostgreSQL 16 · Redis 7 (BullMQ) |
| `admin/` | Operations panel | React 18 · Vite · Tailwind · TanStack |
| `app/` | Android app | Flutter · Riverpod · go_router |
| `docs/` | Source-of-truth product docs (PRD/BRD/TRD/…) | — |
| `shared/` | OpenAPI spec + generated clients | — |

## Project documents

Planning chain (read in order): `PROJECT_ANALYSIS.md` → `GAP_ANALYSIS.md` → `ARCHITECTURE_PLAN.md` → `IMPLEMENTATION_PLAN.md` → `TASKS.md`.

## Development

```bash
docker compose up -d          # postgres + redis
cd backend && npm i && npx prisma migrate dev && npm run start:dev
cd admin && npm i && npm run dev
cd app && flutter run
```

All external networks (offerwalls, ad SSV, gift-card fulfillment) run behind **mock adapter drivers** in development — no network credentials required. See `ARCHITECTURE_PLAN.md` §4.

## Non-negotiable invariants

1. Every coin movement is an append-only `coin_ledger` row written by `LedgerService.record()` — no other write path exists.
2. Idempotency is enforced by a DB unique constraint; a duplicate key is a no-op, never an error, never a double-credit.
3. No client-reported completion ever credits coins — server-side verification (HMAC postback / SSV) only.
4. Redemptions debit at request time (reserve), reverse by compensating entry on rejection — originals are never mutated.
5. Ledger schema migrations are additive-only.
