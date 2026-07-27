# Cash Raja backend — production image (NestJS + Prisma).
# Debian slim (not alpine) so Prisma's default engines work without musl
# binary-target juggling. Multi-stage: build with full deps, ship lean runtime.

# ---- builder: install all deps, generate client, compile ----
FROM node:22-slim AS builder
WORKDIR /app
# openssl is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# Prune to production dependencies (prisma CLI stays — it is a prod dep, needed
# for `migrate deploy` at boot). The generated client under node_modules/.prisma
# is preserved by re-running generate after prune.
RUN npm prune --omit=dev && npx prisma generate

# ---- runtime: minimal image with compiled app + prod deps ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl wget && rm -rf /var/lib/apt/lists/*

# Run as the built-in non-root `node` user.
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node backend-entrypoint.sh ./backend-entrypoint.sh
RUN chmod +x ./backend-entrypoint.sh

USER node
EXPOSE 3000

# Liveness for orchestrators that honour HEALTHCHECK (compose). Fly uses its own.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

# Entrypoint applies pending migrations (idempotent) then starts the API.
ENTRYPOINT ["./backend-entrypoint.sh"]
CMD ["node", "dist/main"]
