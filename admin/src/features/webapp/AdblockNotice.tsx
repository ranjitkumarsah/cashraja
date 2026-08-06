import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { detectAdBlock } from './adblockDetect';

const DISMISS_KEY = 'cr-adblock-dismissed';

/**
 * Shows a blocking modal when an ad blocker or ad-blocking DNS is detected, so
 * users know to turn it off for offers/features to work. Dismissible for the
 * session (so it doesn't nag on every navigation).
 */
export function AdblockNotice() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    let alive = true;
    detectAdBlock().then((isBlocked) => {
      if (alive && isBlocked) setBlocked(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!blocked) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setBlocked(false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-primary-950 p-6 text-center shadow-2xl">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-500/15 text-red-300">
          <ShieldAlert className="size-7" />
        </span>
        <h2 className="mt-4 text-lg font-extrabold text-white">Ad blocker detected</h2>
        <p className="mt-2 text-sm text-indigo-200/80">
          It looks like an ad blocker or private DNS is turned on. Offers and rewards can't load
          properly with it enabled. Please disable it for Cash Raja and reload.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-full bg-gold-400 px-5 py-2.5 text-sm font-extrabold text-primary-950 hover:bg-gold-300"
          >
            I've disabled it — Reload
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-full px-5 py-2 text-xs font-semibold text-indigo-300 hover:text-white"
          >
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
