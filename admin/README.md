# Cash Raja — Admin Panel

React 18 + Vite + TypeScript (strict) + Tailwind CSS 4. Hand-rolled "Raja" component kit
(indigo primary, restrained gold accent, Inter, tabular numerals) — no component library.

## Prerequisites

- Node 22, npm
- The backend running locally for live auth: `backend/` on `http://localhost:3000`
  (Postgres + Redis via the repo's `docker-compose.yml`, then `npm run start:dev` in `backend/`).

## Run

```bash
cd admin
npm install
npm run dev          # http://localhost:5173
```

### API proxy (no CORS)

The Vite dev server proxies every `/api/*` request to `http://localhost:3000`
(see `vite.config.ts`). The browser only ever talks to the Vite origin, so the backend needs
no CORS configuration for local development. The axios client (`src/lib/api/client.ts`) uses
the relative base `/api`, which also works in production when the panel is served behind the
same origin/reverse proxy as the API.

To point the proxy elsewhere, edit `server.proxy['/api'].target` in `vite.config.ts`.

### Logging in against the live backend

Seeded super-admin credentials come from the backend seed (`backend/prisma/seed.ts` /
`D:\Secrets`). First login triggers TOTP enrolment: scan the QR with any authenticator app and
confirm with a 6-digit code. Subsequent logins ask for the code only.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with `/api` proxy |
| `npm run build` | typecheck (`tsc`) + production bundle |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (jsdom + Testing Library) |
| `npm run format` | Prettier |

## Structure

```
src/
├── App.tsx                  # providers + route table (guards, role gating)
├── index.css                # Raja theme tokens (Tailwind 4 CSS-first, dark via .dark class)
├── components/
│   ├── ui/                  # Button, Card, Input, Badge, Table, Modal, Spinner, Toast
│   ├── layout/              # AppShell, Sidebar (role-aware nav), Topbar
│   └── guards.tsx           # RequireAuth / RedirectIfAuthed / RequireRole
├── features/
│   ├── auth/                # LoginPage (credentials → TOTP / TOTP setup), zod schemas
│   ├── dashboard/           # dashboard shell (charts land with the metrics API)
│   └── placeholder/         # elegant "Coming in Phase C" stub
└── lib/
    ├── api/                 # axios client + admin-auth calls + mirrored backend types
    ├── auth/                # token store (memory + sessionStorage) + AuthProvider
    ├── theme/               # light/dark ThemeProvider (persisted in localStorage)
    └── nav.ts               # nav entries + RBAC visibility
```

## Auth notes

- Access token lives in memory, mirrored to `sessionStorage` (key `cr-admin-session`) so a
  refresh keeps the session but closing the tab drops it. Expired tokens are discarded on load.
- The axios response interceptor clears the session on any non-auth `401`; route guards then
  land on `/login` (session-expiry handling).
- RBAC: reviewers see Dashboard / Users / Redemptions / Fraud; super-admins see everything
  (ARCHITECTURE_PLAN §2.3). Super-admin-only routes are also gated server-side — the nav is
  UX, not security.
