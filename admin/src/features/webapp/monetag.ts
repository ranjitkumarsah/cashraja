/**
 * Monetag integration (web). This account offers no rewarded-video SDK, so we
 * use the two formats it does offer:
 *
 *  1. DIRECT LINK as the earn gate ("rewarded-ish"): tapping an earn button
 *     opens a Monetag sponsor link in a new tab and starts an in-app countdown;
 *     coins are credited only after the countdown completes. Opening a new tab
 *     isn't governed by our page CSP, so the Direct Link needs no CSP change.
 *
 *  2. VIGNETTE BANNER for passive revenue, loaded directly into the signed-in
 *     app page (Monetag's account has no iframe/rewarded-friendly format, and a
 *     sandboxed iframe with an opaque origin makes the SDK abort). Owner-approved
 *     trade-off: the ad script runs in the app origin. It's loaded ONLY in the
 *     signed-in app, never the public/SEO pages.
 *
 * The zone ids/URLs are public (they ship in client code regardless), so they
 * live here as defaults; env vars can still override per build.
 */
const env = import.meta.env as Record<string, string | undefined>;

const DIRECT_URL = env.VITE_MONETAG_DIRECT_URL?.trim() || 'https://omg10.com/4/11507183';
const BANNER_SRC = env.VITE_MONETAG_BANNER_SRC?.trim() || 'https://n6wxm.com/vignette.min.js';
const BANNER_ZONE = env.VITE_MONETAG_BANNER_ZONE?.trim() || '11507190';

/** True when a Monetag Direct Link is configured (gates earns via a sponsor visit). */
export const directLinkEnabled = DIRECT_URL.length > 0;

/** Open the Monetag Direct Link in a new tab (the paid sponsor visit). */
export function openMonetagDirectLink(): void {
  if (!directLinkEnabled) return;
  window.open(DIRECT_URL, '_blank', 'noopener,noreferrer');
}

/** Banner on by default; set VITE_MONETAG_BANNER=0 to disable a build. */
export const bannerEnabled =
  BANNER_SRC.length > 0 && (env.VITE_MONETAG_BANNER?.trim() || '1') !== '0';

let bannerLoaded = false;

/**
 * Inject the Monetag Vignette script once. Vignette renders its own on-page
 * banner, so there's no container to manage. Call from the signed-in app only.
 */
export function loadMonetagBanner(): void {
  if (!bannerEnabled || bannerLoaded) return;
  bannerLoaded = true;
  const script = document.createElement('script');
  (document.body || document.documentElement).appendChild(script);
  script.dataset.zone = BANNER_ZONE;
  script.src = BANNER_SRC;
}
