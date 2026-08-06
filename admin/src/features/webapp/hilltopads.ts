/**
 * HilltopAds integration (web) — replaces Monetag. Signed-in app only (never the
 * public SEO pages, so Google ranking is unaffected).
 *
 * Rewarded gate (no video — display fills far better in India): tapping an earn
 * button shows the MultiTag banner in a full-screen overlay for a ~10s countdown
 * AND fires a popunder; the reward is released after the countdown. Two ad
 * impressions per earn, ~100% fill, so no "no ad available" dead-ends. Honors
 * the owner rule "no ad, no earn" (an ad is always shown/opened).
 *
 * Zones:
 *  - MultiTag Banner 300x250 (VITE_HILLTOP_BANNER_SRC) — used BOTH as the passive
 *    bottom banner and as the 10s rewarded interstitial.
 *  - Popunder (VITE_HILLTOP_POPUNDER_SRC) — loaded globally in the signed-in app;
 *    HilltopAds' popunder script opens on user clicks (incl. earn taps). Inert
 *    until the tag is provided.
 *
 * Ad scripts run in the app origin; the CSP already allows third-party https:
 * scripts/media (see backend security-headers.ts). Values are public, so they're
 * committed defaults; env can override per build.
 */
const env = import.meta.env as Record<string, string | undefined>;

/** "MultiTag: Banner 300x250" loader script src. */
const BANNER_SRC =
  env.VITE_HILLTOP_BANNER_SRC?.trim() ||
  'https://unfoldedtrade.com/b.XaV/s/drGrlY0PYPW/cV/TeNmh9WuWZRUWlxktPxTKcLy/OiTqQGyYOeThcZtrNkzzIH5/NEDfM/wuMpQJ';

/** "Popunder" loader script src — paste your HilltopAds Popunder zone tag. */
const POPUNDER_SRC = env.VITE_HILLTOP_POPUNDER_SRC?.trim() || '';

export const bannerEnabled =
  BANNER_SRC.length > 0 && (env.VITE_HILLTOP_BANNER?.trim() || '1') !== '0';
export const popunderEnabled = POPUNDER_SRC.length > 0;

/** Build a HilltopAds MultiTag banner <script> (settings{} + relaxed referrer). */
function bannerScript(): HTMLScriptElement {
  const script = document.createElement('script');
  (script as HTMLScriptElement & { settings?: unknown }).settings = {};
  script.src = BANNER_SRC;
  script.async = true;
  script.referrerPolicy = 'no-referrer-when-downgrade';
  return script;
}

let passiveBannerLoaded = false;

/** Passive bottom banner — one instance for the app session. */
export function mountHilltopBanner(container: HTMLElement): void {
  if (!bannerEnabled || passiveBannerLoaded) return;
  passiveBannerLoaded = true;
  container.appendChild(bannerScript());
}

/** Rewarded interstitial banner — a fresh ad each time the overlay opens. */
export function mountHilltopInterstitial(container: HTMLElement): void {
  if (!bannerEnabled) return;
  container.replaceChildren(); // clear any previous banner
  container.appendChild(bannerScript());
}

let popunderLoaded = false;

/** Load the HilltopAds popunder once (signed-in app). Fires on user clicks. */
export function loadHilltopPopunder(): void {
  if (!popunderEnabled || popunderLoaded) return;
  popunderLoaded = true;
  const script = document.createElement('script');
  script.src = POPUNDER_SRC;
  script.async = true;
  (document.body || document.documentElement).appendChild(script);
}
