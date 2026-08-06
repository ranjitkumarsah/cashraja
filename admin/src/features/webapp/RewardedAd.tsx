import { useCallback, useEffect, useRef, useState } from 'react';
import { HILLTOP_VAST_TAG, vastRewardedEnabled } from './hilltopads';
import { loadIma, playVastRewarded } from './ima-rewarded';

/**
 * Rewarded-ad gate for the web app. Owner rule: NO ad watched → NO reward.
 *
 * `watchAd()` resolves `true` only if the user completed a real rewarded video:
 * - HilltopAds VAST via IMA (when a VAST tag is set — it is by default):
 *     COMPLETE → true (reward). SKIP → false (no reward). No-fill / error /
 *     SDK-not-ready → shows a "no ad available" notice and resolves false (no
 *     reward). There is deliberately NO free-countdown fallback here.
 * - Only when NO VAST tag is configured (e.g. local dev) does it fall back to a
 *   house countdown placeholder so the flow is testable.
 */
export function useRewardedAd() {
  const resolverRef = useRef<((watched: boolean) => void) | null>(null);
  const [mode, setMode] = useState<'idle' | 'countdown' | 'vast' | 'nofill'>('idle');
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

  const resolveOnly = useCallback((watched: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(watched);
  }, []);

  const settle = useCallback(
    (watched: boolean) => {
      setMode('idle');
      resolveOnly(watched);
    },
    [resolveOnly],
  );

  // No ad to show → no reward, but tell the user why (auto-dismiss).
  const showNoFill = useCallback(() => {
    setMode('nofill');
    resolveOnly(false);
    window.setTimeout(() => setMode('idle'), 2600);
  }, [resolveOnly]);

  const playVast = useCallback(async () => {
    let ready = imaReadyRef.current;
    if (!ready) {
      try {
        await loadIma();
        imaReadyRef.current = true;
        ready = true;
      } catch {
        ready = false;
      }
    }
    if (!ready || !adContainerRef.current || !videoRef.current) {
      showNoFill();
      return;
    }
    setMode('vast');
    const outcome = await playVastRewarded(
      adContainerRef.current,
      videoRef.current,
      HILLTOP_VAST_TAG,
    );
    if (outcome === 'completed') settle(true);
    else if (outcome === 'skipped') settle(false);
    else showNoFill();
  }, [settle, showNoFill]);

  const watchAd = useCallback(
    (seconds = 12): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        if (vastRewardedEnabled) {
          void playVast();
        } else {
          setRemaining(seconds);
          setMode('countdown');
        }
      });
    },
    [playVast],
  );

  // House countdown ticker (dev-only path, when no VAST tag is configured).
  useEffect(() => {
    if (mode !== 'countdown' || remaining <= 0) return;
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [mode, remaining]);

  const adNode = (
    <>
      {/* VAST video overlay — kept mounted (invisible) when idle so its refs
          exist synchronously at click time; visible only while a video plays. */}
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
              Watch the full ad to earn your reward…
            </p>
          )}
        </div>
      )}

      {/* No ad available → no reward, with a short notice. */}
      {mode === 'nofill' && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 px-6 text-center">
          <span className="text-4xl">📭</span>
          <p className="mt-3 max-w-xs text-sm font-medium text-white/80">
            No ad available right now. Please try again in a bit — or complete an offer to earn.
          </p>
        </div>
      )}

      {/* House countdown placeholder — only when no VAST tag is configured. */}
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
