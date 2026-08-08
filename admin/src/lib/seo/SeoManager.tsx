import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PAGE_SEO, SITE_NAME, SITE_URL } from './seo-config';

/**
 * Client-side <head> manager. On every navigation it sets the title + meta for
 * the public marketing pages (matching what the prerender baked in), and marks
 * every non-public route (the app + /admin) `noindex`. Mounted once inside the
 * router. Prerendered pages already ship correct head tags; this keeps them in
 * sync during client-side navigation.
 */
function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setNamed(name: string, content: string): void {
  upsertMeta(`meta[name="${name}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute('name', name);
    return m;
  }, content);
}

function setCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/** Signed-in app + admin route prefixes — these must never be indexed. */
const NOINDEX_PREFIXES = [
  '/admin',
  '/home',
  '/earn',
  '/wallet',
  '/rewards',
  '/inbox',
  '/profile',
  '/login',
];

export function SeoManager(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    // Normalise a trailing slash (/how-to-earn/ → /how-to-earn) so the PAGE_SEO
    // lookup matches — otherwise a slash path fell through and got noindexed.
    const path = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
    const isApp = NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
    const seo = PAGE_SEO[path];

    if (isApp) {
      // Signed-in app + admin: never index.
      document.title = path.startsWith('/admin') ? `${SITE_NAME} · Admin` : SITE_NAME;
      setNamed('robots', 'noindex, nofollow');
    } else if (seo) {
      document.title = seo.title;
      setNamed('description', seo.description);
      setNamed('robots', 'index, follow');
      setCanonical(SITE_URL + (path === '/' ? '/' : path));
    } else {
      // No PAGE_SEO entry and not an app route — this path matches nothing, so
      // the router renders NotFoundPage and the server already answered 404
      // (backend/src/main.ts). Keep the client in step: leaving it
      // `index, follow` here would overwrite the server's noindex as soon as a
      // rendering crawler executed this effect.
      //
      // Safe because PAGE_SEO is the single source of truth for public pages —
      // PRERENDER_ROUTES is derived from its keys, and blog posts register
      // themselves into it — so a real marketing page can never land here.
      setNamed('robots', 'noindex, nofollow');
    }
  }, [pathname]);

  return null;
}
