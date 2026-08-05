/**
 * Monetag integration (web). This account offers no rewarded-video SDK, so we
 * use the two formats that fit our rules:
 *
 *  1. DIRECT LINK as the earn gate ("rewarded-ish"): tapping an earn button
 *     opens a Monetag sponsor link in a new tab and starts an in-app countdown;
 *     coins are credited only after the countdown completes. It's a click-task,
 *     not a watched video — but it keeps the "do something to earn" rule and
 *     pays real Monetag revenue. Opening a new tab isn't subject to our CSP, so
 *     the Direct Link needs NO CSP change.
 *
 *  2. VIGNETTE BANNER for passive revenue, loaded ONLY on the signed-in web app
 *     (never the public SEO pages). Better-Ads compliant, least intrusive.
 *
 * Turn each on independently with build-time env vars (Render / .env):
 *   VITE_MONETAG_DIRECT_URL=https://…        // Direct Link zone URL
 *   VITE_MONETAG_BANNER_SRC=https://…/tag.js // Vignette zone script src
 *   VITE_MONETAG_BANNER_ZONE=1234567         // (if the tag uses data-zone)
 *
 * Unset = that piece stays off (Direct Link falls back to a house countdown;
 * the banner simply doesn't load). The banner's script domain must be added to
 * the CSP (script-src / frame-src / img-src / connect-src) in backend
 * security-headers.ts before it will render.
 */
const env = import.meta.env as Record<string, string | undefined>;

const DIRECT_URL = env.VITE_MONETAG_DIRECT_URL?.trim() || '';
const BANNER_SRC = env.VITE_MONETAG_BANNER_SRC?.trim() || '';
const BANNER_ZONE = env.VITE_MONETAG_BANNER_ZONE?.trim() || '';

/** True when a Monetag Direct Link is configured (gates earns via a sponsor visit). */
export const directLinkEnabled = DIRECT_URL.length > 0;

/** True when a Monetag banner (Vignette) script is configured. */
export const bannerEnabled = BANNER_SRC.length > 0;

/** Open the Monetag Direct Link in a new tab (the paid sponsor visit). */
export function openMonetagDirectLink(): void {
  if (!directLinkEnabled) return;
  window.open(DIRECT_URL, '_blank', 'noopener,noreferrer');
}

let bannerLoaded = false;

/** Inject the Vignette banner script once (call from the signed-in app only). */
export function loadMonetagBanner(): void {
  if (!bannerEnabled || bannerLoaded) return;
  bannerLoaded = true;
  const script = document.createElement('script');
  script.src = BANNER_SRC;
  if (BANNER_ZONE) script.dataset.zone = BANNER_ZONE;
  script.async = true;
  document.head.appendChild(script);
}
