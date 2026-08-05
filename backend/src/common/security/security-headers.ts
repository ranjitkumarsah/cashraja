import type { NextFunction, Request, Response } from 'express';

/**
 * Baseline security-response headers. This server serves BOTH the JSON API and
 * the bundled admin/landing SPA on one origin, so the CSP must allow the SPA to
 * load its own assets while staying locked to same-origin.
 *
 * - `X-Content-Type-Options: nosniff` — never MIME-sniff a response.
 * - `X-Frame-Options: DENY` + `frame-ancestors 'none'` — never framed (clickjacking).
 * - `Referrer-Policy: no-referrer` — don't leak URLs (which may carry ids).
 * - `Content-Security-Policy` — everything from `'self'`; the Vite build uses
 *   external `/assets/*.js|css` (self) and React inline `style=` attributes
 *   (hence `style-src 'unsafe-inline'`). `connect-src 'self'` covers the
 *   same-origin API fetches. No external scripts/styles/fonts are used.
 * - `Cross-Origin-*-Policy` — isolate from cross-origin embedding.
 * - `Strict-Transport-Security` — force HTTPS for a year (prod/staging only).
 *
 * `x-powered-by` is stripped separately in main.ts via the Express instance.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Firebase Web Auth loads Google's gapi script + gstatic assets.
  "script-src 'self' https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  // https: allows Google account profile images.
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // Firebase Auth REST endpoints (sign-in, token refresh).
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
  // The Firebase auth handler iframe + Google account chooser.
  "frame-src 'self' https://cashraja-prod.firebaseapp.com https://accounts.google.com",
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
