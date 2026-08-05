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

export function SeoManager(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = PAGE_SEO[pathname];
    if (seo) {
      document.title = seo.title;
      setNamed('description', seo.description);
      setNamed('robots', 'index, follow');
      setCanonical(SITE_URL + (pathname === '/' ? '/' : pathname));
    } else {
      // App + admin: never index.
      document.title = pathname.startsWith('/admin') ? `${SITE_NAME} · Admin` : SITE_NAME;
      setNamed('robots', 'noindex, nofollow');
    }
  }, [pathname]);

  return null;
}
