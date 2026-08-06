import { useEffect, useRef } from 'react';
import { bannerEnabled, mountHilltopBanner } from './hilltopads';

/**
 * Passive HilltopAds banner (MultiTag 300x250), rendered only inside the
 * signed-in app (never the public SEO pages). The HilltopAds script renders
 * itself into the container div. No-op until VITE_HILLTOP_BANNER_SRC is set.
 */
export function HilltopBanner() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) mountHilltopBanner(ref.current);
  }, []);

  if (!bannerEnabled) return null;
  return (
    <div className="w-full">
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-indigo-300/40">
        Sponsored
      </p>
      <div ref={ref} className="flex min-h-[250px] w-full items-center justify-center overflow-hidden" />
    </div>
  );
}
