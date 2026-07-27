import type { NextFunction, Request, Response } from 'express';

/**
 * Baseline security-response headers for a JSON-only API. We serve no HTML, so
 * there is no need for the full helmet CSP machinery — this sets the handful of
 * headers that actually matter for an API and adds a dependency-free footprint.
 *
 * - `X-Content-Type-Options: nosniff` — never MIME-sniff a JSON body into HTML.
 * - `X-Frame-Options: DENY` + `frame-ancestors 'none'` — the API must never be
 *   framed (defence-in-depth clickjacking; irrelevant for JSON but cheap).
 * - `Referrer-Policy: no-referrer` — don't leak API URLs (which may carry ids)
 *   via the Referer header.
 * - `Cross-Origin-*-Policy` — isolate the API from cross-origin embedding.
 * - `Strict-Transport-Security` — force HTTPS for a full year (prod/staging
 *   only; behind TLS termination). Never sent in dev where there is no TLS.
 *
 * `x-powered-by` is stripped separately in main.ts via the Express instance.
 */
export function securityHeaders(isTls: boolean) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (isTls) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}
