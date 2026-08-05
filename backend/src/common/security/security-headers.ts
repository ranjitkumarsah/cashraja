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
  // Firebase Web Auth loads Google's gapi + gstatic; GA4 loads gtag.js.
  "script-src 'self' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  // https: allows Google account profile images.
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // Firebase Auth REST endpoints (sign-in, token refresh) + GA4 collection.
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
  // The Firebase auth handler iframe + Google account chooser + the embedded
  // PlaytimeAds web offerwall.
  "frame-src 'self' https://cashraja-prod.firebaseapp.com https://accounts.google.com https://web.playtimeads.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * The Monetag Vignette banner runs here, inside a same-origin iframe that the
 * web app sandboxes to an OPAQUE origin — so ad scripts cannot read our auth
 * tokens (localStorage) or touch the app DOM. Because that isolation contains
 * the blast radius, this one route gets a permissive CSP (ad creatives + the
 * SDK load from many rotating https domains) and is framable by our own origin.
 * The main app CSP above stays strict.
 */
const AD_FRAME_PATH = '/monetag-vignette.html';
const AD_FRAME_CSP = [
  "default-src 'self' https:",
  "script-src 'self' 'unsafe-inline' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-src https:",
  "frame-ancestors 'self'",
].join('; ');

export function securityHeaders(isTls: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (req.path === AD_FRAME_PATH) {
      // SAMEORIGIN (not DENY) so the app can embed this sandboxed ad iframe.
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', AD_FRAME_CSP);
      if (isTls) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      next();
      return;
    }

    res.setHeader('X-Frame-Options', 'DENY');
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
