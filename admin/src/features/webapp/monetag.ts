/**
 * Monetag integration (web). This account offers no rewarded-video SDK, so we
 * use the two formats it does offer:
 *
 *  1. DIRECT LINK as the earn gate ("rewarded-ish"): tapping an earn button
 *     opens a Monetag sponsor link in a new tab and starts an in-app countdown;
 *     coins are credited only after the countdown completes. Opening a new tab
 *     isn't governed by our page CSP, so the Direct Link needs no CSP change.
 *
 *  2. VIGNETTE BANNER for passive revenue, rendered by <MonetagBanner> inside a
 *     SANDBOXED opaque-origin iframe (/monetag-vignette.html) so third-party ad
 *     scripts can't read our auth tokens in localStorage. Signed-in app only.
 *
 * The zone ids/URLs are public (they ship in client code regardless), so they
 * live here as defaults; env vars can still override per build.
 */
const env = import.meta.env as Record<string, string | undefined>;

const DIRECT_URL = env.VITE_MONETAG_DIRECT_URL?.trim() || 'https://omg10.com/4/11507183';

/** True when a Monetag Direct Link is configured (gates earns via a sponsor visit). */
export const directLinkEnabled = DIRECT_URL.length > 0;

/** Open the Monetag Direct Link in a new tab (the paid sponsor visit). */
export function openMonetagDirectLink(): void {
  if (!directLinkEnabled) return;
  window.open(DIRECT_URL, '_blank', 'noopener,noreferrer');
}

/** Same-origin page (sandboxed by the embedder) that hosts the Vignette script. */
export const BANNER_IFRAME_SRC = '/monetag-vignette.html';

/** Banner on by default; set VITE_MONETAG_BANNER=0 to disable a build. */
export const bannerEnabled = (env.VITE_MONETAG_BANNER?.trim() || '1') !== '0';
