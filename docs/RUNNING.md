# RUNNING.md — How to run Cash Raja locally

Monorepo: `backend/` (NestJS API) · `admin/` (React admin panel) · `app/` (Flutter — not built yet).
Prerequisite: **Docker Desktop running** (hosts Postgres + Redis).

---

## Quick start (three terminals)

### 1. Databases — from project root `D:\claude_dev\Cash Raja`
```powershell
docker compose up -d      # postgres:16 + redis:7
docker compose ps         # both should read "healthy"
```

### 2. Backend API → http://localhost:3000
```powershell
cd backend
npm install               # first time only
npx prisma migrate deploy # first time, and after any schema change
npm run prisma:seed       # first time only — seeds super-admin + gift-card catalog + config
npm run start:dev         # watch mode; use `npm run start:prod` for the built dist
```

### 3. Admin panel → http://localhost:5173
```powershell
cd admin
npm install               # first time only
npm run dev
```
Open http://localhost:5173. The panel dev server proxies `/api` → `http://localhost:3000`, so the backend must be up first.

---

## Admin login (seeded)
- Email: `admin@cashraja.local`
- Password: `ChangeMe!Dev123`  (override via `SEED_ADMIN_PASSWORD` in `backend/.env` before seeding)
- First login enrolls TOTP: scan the QR with Google Authenticator / Authy, then enter the 6-digit code. Later logins ask only for the code.

## Useful backend commands
```powershell
npm run build             # compile (nest build)
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm test                  # full suite (unit + integration; needs DB + Redis up)
npm run simulate:postback -- --url=http://localhost:3000 --network=mock --user=<USER_ID> --coins=100 --txn=<ID>
#   flags: --replay (resend same txn), --bad-sig (force signature failure)
```

## Stopping
- Ctrl-C in the backend and admin terminals.
- `docker compose stop` to stop the databases (data persists in volumes). `docker compose down -v` wipes the data.

## Notes
- `backend/.env` holds local dev config (gitignored). `.env.example` documents every variable.
- Dev secrets (admin password, JWT secrets, AES key) are development defaults; the app refuses to boot in production mode with them — real secrets get injected at deploy time (Phase F).
- Ports: backend 3000, admin 5173, Postgres 5432, Redis 6379.
