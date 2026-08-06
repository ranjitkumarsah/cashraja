/**
 * Detect an ad blocker OR ad-blocking DNS (AdGuard DNS, NextDNS, Pi-hole, etc.).
 * Reward sites rely on ad/offer domains loading; when they're blocked, the
 * offerwall and ads silently fail, so we surface a notice asking the user to
 * turn it off.
 *
 * Two independent signals:
 *  1. Network/DNS block — fetching a universally ad-blocked URL fails outright
 *     (blocklist or DNS sinkhole). `no-cors` means a normal response resolves
 *     (opaque) even on 404; only an actual block rejects.
 *  2. Cosmetic filters — a bait element with ad-like class names gets hidden by
 *     element-hiding filter lists.
 */
const BAIT_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

async function networkBlocked(): Promise<boolean> {
  try {
    await fetch(BAIT_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
    return false;
  } catch {
    return true;
  }
}

function cosmeticBlocked(): Promise<boolean> {
  return new Promise((resolve) => {
    const bait = document.createElement('div');
    bait.className = 'adsbox ad ads ad-banner ad-placement adsbygoogle pub_300x250';
    bait.setAttribute('aria-hidden', 'true');
    bait.style.cssText =
      'position:absolute;left:-9999px;top:-9999px;height:10px;width:10px;pointer-events:none;';
    bait.innerHTML = '&nbsp;';
    document.body.appendChild(bait);
    window.setTimeout(() => {
      const style = window.getComputedStyle(bait);
      const hidden =
        bait.offsetParent === null ||
        bait.offsetHeight === 0 ||
        bait.clientHeight === 0 ||
        style.display === 'none' ||
        style.visibility === 'hidden';
      bait.remove();
      resolve(hidden);
    }, 130);
  });
}

/** True if an ad blocker or ad-blocking DNS appears to be active. */
export async function detectAdBlock(): Promise<boolean> {
  if (await networkBlocked()) return true;
  return cosmeticBlocked();
}
