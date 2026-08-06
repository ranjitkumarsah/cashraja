/**
 * HilltopAds integration (web) — replaces Monetag.
 *
 * HilltopAds is a display network (popunder / banner / in-page push / native).
 * We load its ad-spot script ONLY inside the signed-in app (never the public
 * SEO pages, so Google ranking is unaffected). Each HilltopAds ad spot gives you
 * a script snippet with a unique CDN domain — paste that URL here (or set
 * VITE_HILLTOP_SRC at build time). Inert until configured.
 *
 * Because the ad script runs in the app origin, the backend CSP already allows
 * third-party `https:` scripts/creatives (see security-headers.ts).
 */
const env = import.meta.env as Record<string, string | undefined>;

/** HilltopAds ad-spot script URL, e.g. 'https://<cdn>.com/<spot>.js'. */
const HILLTOP_SRC = env.VITE_HILLTOP_SRC?.trim() || '';

export const hilltopEnabled = HILLTOP_SRC.length > 0;

let loaded = false;

/** Inject the HilltopAds ad-spot script once. Call from the signed-in app only. */
export function loadHilltopAds(): void {
  if (!hilltopEnabled || loaded) return;
  loaded = true;
  const script = document.createElement('script');
  script.src = HILLTOP_SRC;
  script.async = true;
  (document.body || document.documentElement).appendChild(script);
}
