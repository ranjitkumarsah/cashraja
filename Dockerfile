# Cash Raja — single production image: NestJS API + bundled admin/landing SPA.
# Build context is the REPO ROOT (needs both admin/ and backend/). Used by
# Fly.io (fly.toml) and the Hetzner compose. Debian slim so Prisma engines work
# without musl juggling. Fly builds this remotely — nothing lands on your disk.

# ---- 1. Build the admin panel + marketing landing (Vite) ----
FROM node:22-slim AS admin
WORKDIR /admin
COPY admin/package*.json ./
RUN npm ci
COPY admin/ ./
# Same-origin API (the backend serves this SPA), so VITE_API_BASE_URL stays unset
# and the app uses the relative "/api". → /admin/dist
RUN npm run build

# ---- 2a. Build the backend (NestJS + Prisma) — full deps incl. ts-node ----
# This stage keeps devDependencies (used by the compose `seed` one-shot).
FROM node:22-slim AS backend-build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

# ---- 2b. Prune to production deps (prisma CLI stays — needed for migrate deploy)
FROM backend-build AS backend
RUN npm prune --omit=dev && npx prisma generate

# ---- 3. Runtime: compiled API + prod deps + the built SPA at ./client ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl wget && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node --from=backend /app/node_modules ./node_modules
COPY --chown=node:node --from=backend /app/dist ./dist
COPY --chown=node:node --from=backend /app/prisma ./prisma
COPY --chown=node:node --from=backend /app/package.json ./package.json
COPY --chown=node:node --from=backend /app/backend-entrypoint.sh ./backend-entrypoint.sh
# The SPA the backend serves from ../client (see main.ts).
COPY --chown=node:node --from=admin /admin/dist ./client
RUN chmod +x ./backend-entrypoint.sh

USER node
EXPOSE 3000
# Honors $PORT when the host injects one (Render sets it); falls back to 3000.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/healthz" || exit 1

# Applies pending migrations (idempotent) then starts the API.
ENTRYPOINT ["./backend-entrypoint.sh"]
CMD ["node", "dist/main"]
