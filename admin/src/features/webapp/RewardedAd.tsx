import { useCallback, useEffect, useRef, useState } from 'react';
import { mountHilltopInterstitial } from './hilltopads';

/**
 * Rewarded-ad gate for the web app. Owner rule: NO ad, NO earn.
 *
 * Tapping an earn button opens a full-screen overlay that shows the HilltopAds
 * banner for a ~10s countdown; the reward is released only after the countdown
 * (Collect). Closing early (✕) forfeits it — no reward. A popunder, when loaded
 * app-wide, also fires on the same tap (see loadHilltopPopunder). Display fills
 * ~100%, so there's no "no ad available" dead-end.
 *
 * `watchAd()` resolves `true` only if the user waited out the ad and collected.
 */
export function useRewardedAd() {
  const resolverRef = useRef<((watched: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const adRef = useRef<HTMLDivElement>(null);

  const settle = useCallback((watched: boolean) => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(watched);
  }, []);

  const watchAd = useCallback((seconds = 10): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setRemaining(seconds);
      setOpen(true);
    });
  }, []);

  // Load a fresh banner into the overlay each time it opens.
  useEffect(() => {
    if (open && adRef.current) mountHilltopInterstitial(adRef.current);
  }, [open]);

  // Countdown ticker.
  useEffect(() => {
    if (!open || remaining <= 0) return;
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [open, remaining]);

  const adNode = open ? (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 px-6 text-center">
      <button
        type="button"
        onClick={() => settle(false)}
        aria-label="Close ad"
        className="absolute right-4 top-4 rounded-full border border-white/20 px-3 py-1 text-sm font-semibold text-white/70 hover:bg-white/10"
      >
        ✕
      </button>

      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">Sponsored</p>

      {/* HilltopAds 300x250 renders here. */}
      <div
        ref={adRef}
        className="mt-4 flex h-[250px] w-[300px] items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10"
      >
        <span className="text-sm text-white/40">Advertisement</span>
      </div>

      {remaining > 0 ? (
        <p className="mt-6 text-sm font-medium text-white/60">
          Reward unlocks in <span className="coin-num text-white">{remaining}s</span>…
        </p>
      ) : (
        <button
          type="button"
          onClick={() => settle(true)}
          className="mt-6 rounded-full bg-gold-400 px-8 py-2.5 text-sm font-extrabold text-primary-950 shadow-lg hover:bg-gold-300"
        >
          Collect reward
        </button>
      )}
    </div>
  ) : null;

  return { adNode, watchAd };
}
