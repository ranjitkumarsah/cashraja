import type { NextFunction, Request, Response } from 'express';

/**
 * Baseline security-response headers. This server serves BOTH the JSON API and
 * the bundled admin/landing SPA on one origin.
 *
 * - `X-Content-Type-Options: nosniff` — never MIME-sniff a response.
 * - `X-Frame-Options: DENY` + `frame-ancestors 'none'` — never framed (clickjacking).
 * - `Referrer-Policy: no-referrer` — don't leak URLs (which may carry ids).
 * - `Content-Security-Policy` — see below.
 * - `Cross-Origin-*-Policy` — isolate from cross-origin embedding.
 * - `Strict-Transport-Security` — force HTTPS for a year (prod/staging only).
 *
 * `x-powered-by` is stripped separately in main.ts via the Express instance.
 *
 * NOTE on the ad-network allowances: the signed-in web app runs a third-party
 * display ad network (HilltopAds) directly in the page. Its script + creatives
 * load and eval from many rotating https domains, so `script-src`/`connect-src`/
 * `frame-src` allow `https:` (plus `unsafe-eval`). This is a deliberate,
 * owner-approved trade-off for ad revenue; `img-src` already allowed `https:`.
 * Firebase/GA/Playtime hosts are covered by the same `https:` allowance.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function securityHeaders(isTls: boolean) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    // 'same-origin-allow-popups' (not 'same-origin') so Firebase signInWithPopup
    // can talk back to the opener window — otherwise the OAuth popup resolves as
    // 'auth/popup-closed-by-user'.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (isTls) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}
