import { BANNER_IFRAME_SRC, bannerEnabled } from './monetag';

/**
 * Passive Monetag Vignette banner. The ad runs inside a same-origin iframe that
 * we sandbox WITHOUT `allow-same-origin`, giving it an opaque origin — so the
 * third-party ad scripts it loads cannot read the app's auth tokens
 * (localStorage) or reach into the app DOM. `allow-popups` (+ escape) lets a
 * click-through open in a new tab. Rendered only inside the signed-in app.
 */
export function MonetagBanner() {
  if (!bannerEnabled) return null;
  return (
    <div className="w-full">
      <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-indigo-300/40">
        Sponsored
      </p>
      <iframe
        title="Sponsored"
        src={BANNER_IFRAME_SRC}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        loading="lazy"
        className="block h-[260px] w-full overflow-hidden rounded-xl border border-white/5 bg-transparent"
      />
    </div>
  );
}
