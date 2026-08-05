/**
 * Monetag rewarded-ad integration (web).
 *
 * We use ONLY Monetag's "Rewarded Interstitial" format — an opt-in ad the user
 * triggers by tapping an earn button. No popunder / push / auto-interstitial
 * formats (they hurt SEO + UX). The SDK exposes a global `show_<zone>()` that
 * returns a Promise resolving when the user completes the ad, which is exactly
 * the gate `useRewardedAd().watchAd()` expects.
 *
 * Turn it on by setting build-time env vars (on Render / .env):
 *   VITE_MONETAG_ZONE=123456              // your Rewarded Interstitial zone id
 *   VITE_MONETAG_SDK_SRC=https://…/sdk.js // the src from the tag Monetag gives you
 *
 * When VITE_MONETAG_ZONE is unset, `monetagEnabled` is false and the app falls
 * back to the house placeholder ad — so the site behaves normally until the
 * real zone is wired.
 *
 * CSP: once the SDK domain is known, add it to script-src / frame-src /
 * connect-src / img-src in backend security-headers.ts (see repo TODO).
 */
const env = import.meta.env as Record<string, string | undefined>;

const ZONE = env.VITE_MONETAG_ZONE?.trim() || '';
const SDK_SRC = env.VITE_MONETAG_SDK_SRC?.trim() || 'https://libtl.com/sdk.js';

/** True when a Monetag rewarded zone is configured at build time. */
export const monetagEnabled = ZONE.length > 0;

/** The global function name the SDK installs (`data-sdk="show_<zone>"`). */
const FN_NAME = `show_${ZONE}`;

let loadPromise: Promise<void> | null = null;

/** Inject the Monetag SDK once; resolves when `window[show_<zone>]` is ready. */
function loadSdk(): Promise<void> {
  if (!monetagEnabled) return Promise.reject(new Error('Monetag not configured'));
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    if (typeof w[FN_NAME] === 'function') {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.dataset.zone = ZONE;
    script.dataset.sdk = FN_NAME;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Monetag SDK failed to load'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Show a Monetag rewarded ad. Resolves `true` only if the user completed it;
 * resolves `false` on any error or dismissal so the caller never credits coins
 * for an ad that didn't play.
 */
export async function showMonetagRewarded(): Promise<boolean> {
  if (!monetagEnabled) return false;
  try {
    await loadSdk();
    const w = window as unknown as Record<string, unknown>;
    const show = w[FN_NAME];
    if (typeof show !== 'function') return false;
    await (show as () => Promise<unknown>)();
    return true;
  } catch {
    return false;
  }
}
