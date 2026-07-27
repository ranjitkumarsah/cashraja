/// <reference types="vite/client" />

/**
 * Base URL for every API call (authenticated axios client + the public landing
 * fetch). Defaults to the same-origin `/api` path — used by the Vite dev proxy
 * and by any prod deployment that reverse-proxies `/api` → backend on the same
 * host (the Hetzner + Caddy stack).
 *
 * Set `VITE_API_BASE_URL` at BUILD time to target a cross-origin API instead
 * (the Cloudflare Pages + Fly.io stack, e.g.
 * `https://api.cashraja.graduatedcoder.in/api`). In that case the backend
 * `CORS_ORIGINS` allowlist must include this site's origin.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/api';
