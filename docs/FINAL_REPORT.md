# Cash Raja — Final Report (v1 launch readiness)

**Date:** 2026-07-27 · **Status:** Feature-complete, hardened, deploy-ready.
Remaining items are owner deploy-time actions (infra provisioning, signing keys,
store submission) — not code work.

---

## 1. What Cash Raja is
An India-focused, 18+ Android rewards app: users earn virtual **coins** through
games, offers (offerwall + manual), rewarded ads, daily streaks, scratch/spin,
and referrals, then redeem coins **only** for digital gift cards (Amazon /
Flipkart / Google Play). Coins have no cash value.

**Stack:** NestJS + Prisma + Postgres + Redis (backend) · React + Vite + Tailwind
(admin panel + marketing landing) · Flutter (Android app) · Firebase (Google
Sign-In + FCM) · AdMob.

## 2. Build status by phase (verified against code, not the stale TASKS.md boxes)
A three-way completeness audit (backend / app / admin) confirmed every planned
functional area A–H is implemented, wired, and tested:

| Area | State | Evidence |
| --- | --- | --- |
| A Foundation — ledger, auth (Google + admin TOTP/RBAC) | ✅ | `tsc` clean, 38 backend specs + integration suite |
| B Earning — adapters, HMAC postbacks, BullMQ, offers/ads/wallet | ✅ | per-adapter integration tests, burst load test |
| C Redemption & admin — inventory (AES-256-GCM), reserve-debit, full admin API, metrics | ✅ | status-machine + rollback specs |
| C5 Admin panel — dashboard, users, redemptions, offers, inventory, fraud, config, admins | ✅ | 68 vitest tests, build green |
| D Engagement — game, streaks, scratch/spin, referral | ✅ | anti-replay / distribution / tamper tests |
| E1 **Fraud engine** — 5 rules + Redis sliding-window + auto-actions | ✅ | (TASKS.md showed unchecked; code is complete + spec'd) |
| E2 Notifications — FCM driver + inbox + auto-notify | ✅ | wired across all earn events + redemption |
| E3 Flutter app — all screens, real AdMob, push/inbox | ✅ | `flutter analyze` clean, 50 tests |
| G Monetization — rewarded/banner ads, ad-gated claims, cooldown | ✅ | ad-flow widget tests |
| H1–H10 — legal, referral breakdown, landing, feedback, manual offers, rewards redesign, markdown offers, push, config-driven rewards, in-stock store | ✅ | see per-feature commits |

**Only real gap the audit found** (now closed): the landing's "live stats" were
hardcoded placeholders. Fixed in Phase F (§3).

## 3. Phase F — hardening & ship (this phase)
**Security** (`8467d3c`)
- Security response headers (nosniff, X-Frame-Options DENY, Referrer-Policy, CSP,
  COOP/CORP, Permissions-Policy, HSTS on TLS) via a dependency-free middleware;
  `X-Powered-By` stripped. Verified live on the running backend.
- CORS allowlist from `CORS_ORIGINS` (admin/landing origins, credentials on);
  disallowed origins get no `Access-Control-Allow-Origin`. Verified.
- Log redaction (secrets/codes/tokens) and prod env guards (refuses dev-default
  secrets / `mock` drivers / `mock` verifier in production) were already in place.
- Secrets audit: no `.env`/keys/service-account/`google-services.json` tracked;
  `.gitignore` covers them.

**Public stats** (`8467d3c`)
- `GET /api/public/stats` — aggregate-only (total users, DAU, ₹ rewards paid),
  no PII, 60s cache, throttled. Landing now shows **real numbers or hides the
  strip** (never fabricated). Unit + landing tests added.

**Deploy configs — both stacks** (`9f229bf`, `7da5473`)
- Backend multi-stage `Dockerfile` (node:22-slim, non-root, healthcheck) +
  entrypoint that runs `prisma migrate deploy` (idempotent) then starts.
- **Hetzner/prod:** `deploy/docker-compose.prod.yml` (Postgres + Redis + backend
  + Caddy auto-HTTPS) + `Caddyfile` (SPA + same-origin `/api` proxy; `api.`
  subdomain → backend) + `.env.prod.example` + one-shot seed profile.
- **Free/staging:** `backend/fly.toml` (region `bom`, migrate release command,
  min-1 machine, 512 MB) + Neon/Upstash wiring + Cloudflare Pages (`_redirects`,
  build-configurable `VITE_API_BASE_URL`).
- `deploy/DEPLOY.md` runbook: both stacks, exact Hostinger DNS records, seed,
  backups, rollback. `.gitattributes` forces LF on container files.
- `docs/RELEASE.md` (release signing + dart-defines) and
  `docs/PLAY_STORE_CHECKLIST.md` (Data Safety, deletion, rating, copy).

**Verification this phase:** backend `tsc` clean + public spec pass + live
smoke (headers, endpoint, CORS); admin `tsc` + build + 68 tests; compose config
valid; app link-fix rebuilt + installed. *Not* run locally: the Docker image
build and a real cloud deploy (disk/time — configs are validated, not deployed).

## 4. Owner actions before go-live (not code)
1. **Provision infra** for the chosen stack (VPS or Neon+Upstash+Fly+Pages) and
   fill real secrets — `deploy/DEPLOY.md`.
2. **DNS**: add the records in `DEPLOY.md` for `cashraja` + `api.cashraja`.
3. **Release signing**: generate the upload keystore, wire `signingConfigs.release`
   — `docs/RELEASE.md` §1 (currently debug-signed = cannot publish).
4. **Firebase**: register release SHA-1/256; set `FIREBASE_VERIFIER=firebase`,
   `FCM_DRIVER=firebase`, service-account JSON.
5. **AdMob**: real App ID + unit ids via dart-define; build with `USE_MOCK_ADS=false`.
6. **Play Console**: complete Data Safety + IARC (18+) + internal-testing track.

## 5. Known deferrals (by design)
- **Offerwall/ad-network integrations** (Adjoe/AdGate/OfferToro/AppLovin/Tapjoy/PlaytimeAds):
  adapters are built and `NEEDS_CREDENTIALS`-gated; the in-app offerwall webview
  is stubbed. Manual offers + AdMob cover v1 earning. → **v2**, post-credentials.
- **F2/F3 load & volume tests** beyond the existing webhook burst test — add
  before large-scale traffic.
- Admin bundle is a single ~840 KB chunk (works; code-split later if desired).

## 6. Bottom line
The product is code-complete and hardened for a v1 internal-testing release. With
infra provisioned, signing configured, and the store forms completed, it is ready
to deploy and submit.
