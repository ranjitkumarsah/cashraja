/**
 * Rewarded VAST video via Google's IMA SDK. HilltopAds' "Video: VAST 3.0" zone
 * returns a VAST tag; IMA plays it and fires COMPLETE only when the user watches
 * it through — that's our "ad watched successfully → give reward" signal. SKIP
 * means no reward; any error/no-fill returns 'error' so the caller can fall back
 * to the house gate (earns must never get stuck when video ads don't fill).
 *
 * The IMA SDK is loaded from Google's CDN (allowed by the app's https: CSP).
 * Preload it on mount so AdDisplayContainer.initialize() can run synchronously
 * inside the click gesture (browsers require a gesture to autoplay the ad).
 */
type Ima = any; // IMA SDK has no bundled types; kept local + narrow.

export type VastOutcome = 'completed' | 'skipped' | 'error';

const IMA_SRC = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
let imaPromise: Promise<void> | null = null;

/** Load the IMA SDK once. Call early (on mount) so it's ready at click time. */
export function loadIma(): Promise<void> {
  if (imaPromise) return imaPromise;
  imaPromise = new Promise<void>((resolve, reject) => {
    if ((window as unknown as { google?: { ima?: unknown } }).google?.ima) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = IMA_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      imaPromise = null;
      reject(new Error('IMA SDK failed to load'));
    };
    document.head.appendChild(s);
  });
  return imaPromise;
}

function getIma(): Ima | null {
  return (window as unknown as { google?: { ima?: Ima } }).google?.ima ?? null;
}

/**
 * Play one rewarded VAST ad into `container` (overlaying `video`). Resolves with
 * the outcome. Must be called synchronously inside a user-gesture handler and
 * only after loadIma() has resolved.
 */
export function playVastRewarded(
  container: HTMLElement,
  video: HTMLVideoElement,
  tagUrl: string,
): Promise<VastOutcome> {
  const ima = getIma();
  if (!ima) return Promise.resolve('error');

  return new Promise<VastOutcome>((resolve) => {
    let settled = false;
    let adsManager: { destroy: () => void } | null = null;
    const finish = (outcome: VastOutcome) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(guard);
      try {
        adsManager?.destroy();
      } catch {
        /* ignore */
      }
      resolve(outcome);
    };
    // If IMA never calls back (blocked/no response), don't hang the earn.
    const guard = window.setTimeout(() => finish('error'), 15000);

    try {
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 360;

      const adDisplayContainer = new ima.AdDisplayContainer(container, video);
      adDisplayContainer.initialize(); // requires the click gesture

      const adsLoader = new ima.AdsLoader(adDisplayContainer);

      adsLoader.addEventListener(
        ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (e: { getAdsManager: (v: HTMLVideoElement) => any }) => {
          const mgr = e.getAdsManager(video);
          adsManager = mgr;
          mgr.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => finish('error'));
          mgr.addEventListener(ima.AdEvent.Type.SKIPPED, () => finish('skipped'));
          mgr.addEventListener(ima.AdEvent.Type.COMPLETE, () => finish('completed'));
          mgr.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => finish('completed'));
          try {
            mgr.init(w, h, ima.ViewMode.NORMAL);
            mgr.start();
          } catch {
            finish('error');
          }
        },
        false,
      );
      adsLoader.addEventListener(
        ima.AdErrorEvent.Type.AD_ERROR,
        () => finish('error'),
        false,
      );

      const req = new ima.AdsRequest();
      req.adTagUrl = tagUrl;
      req.linearAdSlotWidth = w;
      req.linearAdSlotHeight = h;
      req.setAdWillAutoPlay(true);
      req.setAdWillPlayMuted(false);
      adsLoader.requestAds(req);
    } catch {
      finish('error');
    }
  });
}
