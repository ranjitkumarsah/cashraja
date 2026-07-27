#!/bin/sh
# Apply any pending Prisma migrations, then hand off to the app (CMD).
# `migrate deploy` is idempotent and additive-only — safe to run on every boot.
# It never generates or resets; it only applies committed migration files.
set -e

echo "[entrypoint] applying database migrations (prisma migrate deploy)…"
npx prisma migrate deploy

echo "[entrypoint] migrations up to date — starting: $*"
exec "$@"
