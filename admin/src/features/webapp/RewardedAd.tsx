import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Rewarded-ad gate for the web app. Mirrors the Android rewarded-video flow:
 * the user must watch the ad through to the end before the backend credit call
 * is allowed (the backend still enforces the daily cap + cooldown, so the ad is
 * purely the client-side "did they watch" gate).
 *
 * `watchAd()` returns a Promise that resolves `true` only if the user watched
 * the full countdown and tapped "Collect"; it resolves `false` if they close
 * early (no credit is claimed in that case).
 *
 * NOTE: the panel below is a house/placeholder ad slot. Swap the inner markup
 * for a real web rewarded unit (e.g. an AdSense H5 rewarded ad or a rewarded
 * SDK) when one is approved — the gate contract (`watchAd(): Promise<boolean>`)
 * stays the same.
 */
export function useRewardedAd() {
  const resolverRef = useRef<((watched: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const watchAd = useCallback(
    (seconds = 12): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setRemaining(seconds);
        setOpen(true);
      });
    },
    [],
  );

  const settle = useCallback((watched: boolean) => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(watched);
  }, []);

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

      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
        Sponsored
      </p>
      <div className="mt-4 flex aspect-video w-full max-w-sm flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600/40 via-primary-800 to-primary-950 px-6 text-center shadow-2xl ring-1 ring-white/10">
        <span className="text-4xl">🎬</span>
        <span className="mt-2 text-sm font-bold text-white/80">Advertisement</span>
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
