# Cash Raja — Deployment Runbook

Two deploy targets, same code, switch by `.env` only:

| Target | Use | Backend | DB | Redis | Static (admin+landing) |
| --- | --- | --- | --- | --- | --- |
| **Hetzner VPS** (recommended prod v1) | Real launch, no limits | docker-compose + Caddy | Postgres 16 (container) | Redis 7 (container) | Caddy serves built SPA |
| **Free stack** | Staging / validation | Fly.io (`bom`) | Neon | Upstash | Cloudflare Pages |

Domain: **graduatedcoder.in** (Hostinger DNS). Subdomains:
- `cashraja.graduatedcoder.in` → landing (`/`) + admin (`/admin/*`)
- `api.cashraja.graduatedcoder.in` → backend API (Flutter app + offerwall postbacks)

> Migrations run automatically on every backend boot (`prisma migrate deploy`,
> idempotent + additive-only). The super-admin + config **seed is a one-time
> manual step** (below) — never automatic.

---

## A. Hetzner VPS (production v1)

Prereqs: a small VPS (2 vCPU / 4 GB is plenty) with Docker + compose plugin, ports 80/443 open.

### 1. DNS (Hostinger → point at the VPS)
Create two **A** records to the VPS public IP (proxy/cloud off — Caddy terminates TLS):

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `cashraja` | `<VPS_IP>` | 300 |
| A | `api.cashraja` | `<VPS_IP>` | 300 |

Wait for propagation (`dig +short cashraja.graduatedcoder.in` returns the VPS IP).

### 2. Build the admin + landing SPA and stage it for Caddy
On your machine (or in CI), same-origin `/api` (Caddy proxies it) — so **do not**
set `VITE_API_BASE_URL`:
```bash
cd admin
npm ci
npm run build            # → admin/dist
# copy the build to the VPS next to the compose file:
scp -r dist/* <user>@<VPS_IP>:/opt/cashraja/deploy/admin-dist/
```

### 3. Configure secrets on the VPS
```bash
cd /opt/cashraja/deploy
cp .env.prod.example .env.prod
#   openssl rand -hex 32   → JWT_* secrets
#   openssl rand -hex 32   → AES_KEY (must be exactly 64 hex chars)
#   paste the Firebase service-account JSON as ONE line into FIREBASE_SERVICE_ACCOUNT_JSON
nano .env.prod
```

### 4. Launch
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend
```
Caddy provisions Let's Encrypt certs for both domains automatically on first hit.

Verify:
```bash
curl -s https://api.cashraja.graduatedcoder.in/healthz         # {"status":"ok"}
curl -s https://api.cashraja.graduatedcoder.in/api/public/stats # aggregate JSON
curl -sI https://cashraja.graduatedcoder.in | grep -i strict-transport  # HSTS present
```

### 5. One-time seed (super-admin + app_config defaults)
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml \
  --profile seed run --rm seed
```
Then log in at `https://cashraja.graduatedcoder.in/admin/login` with the seeded
super-admin, and immediately complete TOTP setup.

### 6. Updates / rollback
```bash
# update: pull code, rebuild, restart (migrations auto-apply)
git pull && docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
# rollback code: checkout the previous tag and rebuild. Migrations are
# additive-only, so an older image runs fine against the newer schema.
```

### 7. Backups (do before real users)
```bash
# nightly pg_dump (add to cron):
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U cashraja cashraja | gzip > /opt/backups/cashraja-$(date +%F).sql.gz
```

---

## B. Free stack (staging: Fly.io + Neon + Upstash + Cloudflare Pages)

### 1. Managed data stores
- **Neon**: create a project → copy the pooled `DATABASE_URL` (add `?sslmode=require`).
- **Upstash**: create a Redis DB → copy the `rediss://` URL. (Watch the daily
  command cap — BullMQ + fraud sliding-windows are command-heavy.)

### 2. Backend on Fly.io
```bash
cd backend
fly launch --no-deploy            # reuses fly.toml (app=cashraja-backend, region bom)
fly secrets set \
  DATABASE_URL='postgresql://…neon…?sslmode=require' \
  REDIS_URL='rediss://…upstash…' \
  JWT_ACCESS_SECRET=$(openssl rand -hex 32) \
  JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
  JWT_ADMIN_SECRET=$(openssl rand -hex 32) \
  AES_KEY=$(openssl rand -hex 32) \
  FIREBASE_VERIFIER=firebase FCM_DRIVER=firebase \
  FIREBASE_SERVICE_ACCOUNT_JSON='{…one line…}' \
  CORS_ORIGINS='https://cashraja.graduatedcoder.in'
fly deploy                        # release_command runs migrate deploy first
# one-time seed against Neon (run locally, ts-node is a dev dep):
DATABASE_URL='postgresql://…neon…' npm run prisma:seed
```
Map the API subdomain: `fly certs add api.cashraja.graduatedcoder.in`, then add
the CNAME Fly prints (see DNS table below).

### 3. Admin + landing on Cloudflare Pages
- Connect the repo; **Build command** `npm run build`, **output** `dist`,
  **root** `admin/`.
- Build variable: `VITE_API_BASE_URL = https://api.cashraja.graduatedcoder.in/api`
  (cross-origin → already in the backend CORS allowlist).
- `admin/public/_redirects` handles SPA routing automatically.
- Add custom domain `cashraja.graduatedcoder.in` in Pages.

### DNS for the free stack (Hostinger)
| Type | Name | Value |
| --- | --- | --- |
| CNAME | `cashraja` | `<your-project>.pages.dev` |
| CNAME | `api.cashraja` | `<app>.fly.dev` (value Fly prints on `fly certs add`) |

---

## C. After either deploy

1. **Flutter release build** points at prod (see `docs/RELEASE.md`):
   `--dart-define=API_BASE_URL=https://api.cashraja.graduatedcoder.in/api`.
2. **Firebase**: add the release SHA-1/SHA-256 to the Android app; confirm
   Google Sign-In + FCM push on a real device.
3. **Play Store privacy URL**: `https://cashraja.graduatedcoder.in/privacy`.
4. Smoke-test the full loop: sign in → earn → redeem → admin approve → push.

## Operational watch-items
- **Ledger is additive-only** — never edit/delete a migration that mutates
  `coin_ledger`; always add a new one. Rollbacks run old code on new schema.
- **Fly**: `min_machines_running = 1` (never auto-stop — it would kill the
  BullMQ worker + cron jobs). 512 MB minimum (256 MB OOMs).
- **Upstash free**: if the daily command cap bites, move to the Hetzner stack
  (Redis in-container, no cap) — it's a `.env` switch.
