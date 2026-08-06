/**
 * HilltopAds integration (web) — replaces Monetag.
 *
 * Two things from HilltopAds, both signed-in app only (never the public SEO
 * pages, so Google ranking is unaffected):
 *
 *  1. PASSIVE BANNER — the "MultiTag: Banner 300x250" zone. Its snippet is an
 *     async script (+ inline invoke) that renders into a container div. Paste
 *     the script URL as VITE_HILLTOP_BANNER_SRC (and, if the snippet uses a
 *     data-key/inline config, tell me and I'll add it). Rendered by
 *     <HilltopBanner>.
 *
 *  2. REWARDED VIDEO — the "Video: VAST 3.0" zone. Its VAST tag URL goes in
 *     VITE_HILLTOP_VAST_TAG and is played via the IMA SDK (see ima-rewarded.ts);
 *     COMPLETE = reward, SKIP/no-fill = no reward (caller falls back to the
 *     house gate). This is the only HilltopAds zone that can confirm a full view.
 *
 * The ad script runs in the app origin (CSP already allows third-party https:
 * scripts/media — see backend security-headers.ts).
 */
const env = import.meta.env as Record<string, string | undefined>;

/** HilltopAds "MultiTag: Banner 300x250" script URL. */
const BANNER_SRC = env.VITE_HILLTOP_BANNER_SRC?.trim() || '';
/** Optional data-key/site id some MultiTag snippets require on the script tag. */
const BANNER_KEY = env.VITE_HILLTOP_BANNER_KEY?.trim() || '';

/** HilltopAds "Video: VAST 3.0" ad tag URL (rewarded). */
export const HILLTOP_VAST_TAG = env.VITE_HILLTOP_VAST_TAG?.trim() || '';

export const bannerEnabled = BANNER_SRC.length > 0;
export const vastRewardedEnabled = HILLTOP_VAST_TAG.length > 0;

let bannerLoaded = false;

/**
 * Inject the HilltopAds banner script into the given container once. The 300x250
 * MultiTag renders itself where the script is placed.
 */
export function mountHilltopBanner(container: HTMLElement): void {
  if (!bannerEnabled || bannerLoaded) return;
  bannerLoaded = true;
  const script = document.createElement('script');
  script.src = BANNER_SRC;
  script.async = true;
  if (BANNER_KEY) script.dataset.key = BANNER_KEY;
  container.appendChild(script);
}
