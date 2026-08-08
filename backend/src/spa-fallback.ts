import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';

/**
 * Signed-in app + admin route prefixes. Must mirror NOINDEX_PREFIXES in
 * admin/src/lib/seo/SeoManager.tsx. These are real routes, so they must never
 * 404 — but they must never be indexed either.
 */
export const APP_ROUTE_PREFIXES = [
  '/admin',
  '/home',
  '/earn',
  '/wallet',
  '/rewards',
  '/inbox',
  '/profile',
  '/login',
] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * SPA fallback for the bundled marketing site + admin panel.
 *
 * A GET for a non-API, extension-less path resolves to real HTML so deep links
 * and reloads work. Real assets and /api/* pass through untouched.
 *
 * Three outcomes, in order:
 *   1. a prerendered public page exists      -> that page, 200
 *   2. a signed-in app / admin route         -> noindex shell, 200
 *   3. anything else (typo, dead backlink)   -> noindex shell, 404
 *
 * Case 3 is the reason this exists. It previously returned the SPA shell at
 * 200, and because prerendering '/' overwrites dist/index.html, that shell was
 * the fully-rendered homepage — canonical "/", robots "index, follow" and all.
 * Every mistyped URL was therefore an indexable duplicate of the homepage.
 *
 * The shell served in cases 2 and 3 is app-shell.html, written by
 * admin/scripts/prerender.mjs with an empty #root and a noindex meta, so
 * crawlers that never execute JavaScript read the noindex straight from the
 * server response rather than depending on client-side hydration.
 */
export function createSpaFallback(clientDir: string) {
  const indexHtml = join(clientDir, 'index.html');
  const appShellPath = join(clientDir, 'app-shell.html');
  // Fall back to index.html if the build predates app-shell.html.
  const appShell = existsSync(appShellPath) ? appShellPath : indexHtml;

  return function spaFallback(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const p = req.path;
    if (p.startsWith('/api') || p === '/healthz' || p === '/readyz') return next();
    if (extname(p)) return next();

    if (p === '/') {
      res.sendFile(indexHtml);
      return;
    }

    // Safe-char paths only (no traversal) before touching the filesystem.
    if (/^\/[a-zA-Z0-9\-/]+$/.test(p)) {
      const prerendered = join(clientDir, p, 'index.html');
      if (existsSync(prerendered)) {
        res.sendFile(prerendered);
        return;
      }
    }

    if (isAppRoute(p)) {
      res.sendFile(appShell);
      return;
    }

    res.status(404).sendFile(appShell);
  };
}
