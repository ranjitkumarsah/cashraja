/**
 * HilltopAds integration (web) — replaces Monetag.
 *
 * Two zones, both signed-in app only (never the public SEO pages):
 *
 *  1. REWARDED VIDEO — HilltopAds "Video: VAST 3.0 (for Google IMA SDK)". The
 *     VAST tag is played via the IMA SDK (see ima-rewarded.ts). Watched through
 *     = reward; skipped or no-fill = NO reward (owner rule: "no ad, no earn").
 *
 *  2. PASSIVE BANNER — HilltopAds "MultiTag: Banner 300x250". Its snippet builds
 *     a <script> with a `settings` object + referrerPolicy and renders itself.
 *     Reproduced faithfully in mountHilltopBanner().
 *
 * The ad scripts/creatives run in the app origin; the backend CSP already allows
 * third-party https: scripts/media (see security-headers.ts). Values are public
 * (they ship in client code regardless), so they're defaults here; env can
 * override per build.
 */
const env = import.meta.env as Record<string, string | undefined>;

/** "Video: VAST 3.0 (for Google IMA SDK)" ad tag. */
export const HILLTOP_VAST_TAG =
  env.VITE_HILLTOP_VAST_TAG?.trim() ||
  'https://inconsequentialdear.com/dLmDF.zYdlGhNFvaZ-GrUh/pegmn9CuoZxUxlTkgPkT/cWyROQTtQlyNNFjcUZt/NIzmIx5MNpDwIJ2qO/Qy';

/** "MultiTag: Banner 300x250" loader script src. */
const BANNER_SRC =
  env.VITE_HILLTOP_BANNER_SRC?.trim() ||
  'https://unfoldedtrade.com/b.XaV/s/drGrlY0PYPW/cV/TeNmh9WuWZRUWlxktPxTKcLy/OiTqQGyYOeThcZtrNkzzIH5/NEDfM/wuMpQJ';

export const vastRewardedEnabled = HILLTOP_VAST_TAG.length > 0;
export const bannerEnabled =
  BANNER_SRC.length > 0 && (env.VITE_HILLTOP_BANNER?.trim() || '1') !== '0';

let bannerLoaded = false;

/**
 * Inject the HilltopAds MultiTag banner into `container` once — a faithful copy
 * of HilltopAds' snippet (a <script> carrying an empty `settings` object + a
 * relaxed referrer policy). The 300x250 renders itself.
 */
export function mountHilltopBanner(container: HTMLElement): void {
  if (!bannerEnabled || bannerLoaded) return;
  bannerLoaded = true;
  const script = document.createElement('script');
  (script as HTMLScriptElement & { settings?: unknown }).settings = {};
  script.src = BANNER_SRC;
  script.async = true;
  script.referrerPolicy = 'no-referrer-when-downgrade';
  container.appendChild(script);
}
