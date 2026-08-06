import { useCallback, useEffect, useRef, useState } from 'react';
import { HILLTOP_VAST_TAG, vastRewardedEnabled } from './hilltopads';
import { loadIma, playVastRewarded } from './ima-rewarded';

/**
 * Rewarded-ad gate for the web app. Mirrors the Android rewarded-video flow: the
 * user must complete the ad before the backend credit call runs (the backend
 * still enforces the daily cap + cooldown).
 *
 * `watchAd()` resolves `true` only if the user completed the ad. Behaviour:
 * - HilltopAds VAST video (when VITE_HILLTOP_VAST_TAG is set): plays a real
 *   rewarded video; COMPLETE → true, SKIP → false, no-fill/error → falls back to
 *   the house countdown so earns are never blocked when video ads don't fill.
 * - Otherwise: the house countdown placeholder (watch through → Collect → true).
 */
export function useRewardedAd() {
  const resolverRef = useRef<((watched: boolean) => void) | null>(null);
  const [mode, setMode] = useState<'idle' | 'countdown' | 'vast'>('idle');
  const [remaining, setRemaining] = useState(0);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imaReadyRef = useRef(false);

  // Preload IMA so AdDisplayContainer.initialize() can run inside the click
  // gesture (browsers need a gesture to autoplay the ad with sound).
  useEffect(() => {
    if (!vastRewardedEnabled) return;
    loadIma()
      .then(() => {
        imaReadyRef.current = true;
      })
      .catch(() => {
        imaReadyRef.current = false;
      });
  }, []);

  const settle = useCallback((watched: boolean) => {
    setMode('idle');
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(watched);
  }, []);

  const runCountdown = useCallback((seconds: number) => {
    setRemaining(seconds);
    setMode('countdown');
  }, []);

  const watchAd = useCallback(
    (seconds = 12): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;

        if (
          vastRewardedEnabled &&
          imaReadyRef.current &&
          adContainerRef.current &&
          videoRef.current
        ) {
          setMode('vast');
          void playVastRewarded(adContainerRef.current, videoRef.current, HILLTOP_VAST_TAG).then(
            (outcome) => {
              if (outcome === 'completed') settle(true);
              else if (outcome === 'skipped') settle(false);
              else runCountdown(seconds); // no-fill/error → house gate
            },
          );
        } else {
          runCountdown(seconds);
        }
      });
    },
    [settle, runCountdown],
  );

  // House countdown ticker.
  useEffect(() => {
    if (mode !== 'countdown' || remaining <= 0) return;
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [mode, remaining]);

  const adNode = (
    <>
      {/* VAST video overlay — kept mounted (invisible) when idle so its refs
          exist synchronously at click time; shown only while a video plays. */}
      {vastRewardedEnabled && (
        <div
          className={
            'fixed inset-0 z-[60] flex flex-col bg-black ' +
            (mode === 'vast' ? '' : 'pointer-events-none opacity-0')
          }
        >
          <div className="flex h-11 items-center justify-between px-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
              Sponsored
            </span>
            {mode === 'vast' && (
              <button
                type="button"
                onClick={() => settle(false)}
                aria-label="Close ad"
                className="rounded-full border border-white/20 px-3 py-1 text-sm font-semibold text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            )}
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <video ref={videoRef} className="max-h-full max-w-full" muted playsInline />
            <div ref={adContainerRef} className="absolute inset-0" />
          </div>
          {mode === 'vast' && (
            <p className="py-3 text-center text-sm text-white/60">
              Watch the ad to earn your reward…
            </p>
          )}
        </div>
      )}

      {/* House countdown placeholder (fallback / when no VAST tag). */}
      {mode === 'countdown' && (
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
      )}
    </>
  );

  return { adNode, watchAd };
}
