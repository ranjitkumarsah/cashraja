import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { createSpaFallback, isAppRoute } from './spa-fallback';

/**
 * Builds a throwaway client dir shaped like admin/dist: a prerendered homepage
 * and marketing page, plus the noindex app shell.
 */
function makeClientDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cashraja-client-'));
  // Prerendering '/' overwrites index.html with the rendered homepage — the
  // exact condition that made the old shell an indexable homepage duplicate.
  writeFileSync(
    join(dir, 'index.html'),
    '<html><head><link rel="canonical" href="https://cashraja.graduatedcoder.in/" />' +
      '<meta name="robots" content="index, follow" /></head><body>HOMEPAGE</body></html>',
  );
  writeFileSync(
    join(dir, 'app-shell.html'),
    '<html><head><meta name="robots" content="noindex, nofollow" /></head>' +
      '<body><div id="root"></div></body></html>',
  );
  mkdirSync(join(dir, 'faq'), { recursive: true });
  writeFileSync(join(dir, 'faq', 'index.html'), '<html><body>FAQ PAGE</body></html>');
  mkdirSync(join(dir, 'blog', 'is-cash-raja-legit'), { recursive: true });
  writeFileSync(
    join(dir, 'blog', 'is-cash-raja-legit', 'index.html'),
    '<html><body>LEGIT POST</body></html>',
  );
  return dir;
}

function makeApp() {
  const app = express();
  app.get('/api/public/stats', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/healthz', (_req, res) => {
    res.send('ok');
  });
  app.use(createSpaFallback(makeClientDir()));
  return app;
}

describe('SPA fallback', () => {
  const app = makeApp();

  describe('valid marketing routes still resolve', () => {
    it('serves the prerendered homepage at / with 200', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('HOMEPAGE');
    });

    it('serves a prerendered marketing page with 200', async () => {
      const res = await request(app).get('/faq');
      expect(res.status).toBe(200);
      expect(res.text).toContain('FAQ PAGE');
    });

    it('serves a prerendered nested blog post with 200', async () => {
      const res = await request(app).get('/blog/is-cash-raja-legit');
      expect(res.status).toBe(200);
      expect(res.text).toContain('LEGIT POST');
    });
  });

  describe('app routes are served but never indexable', () => {
    it.each(['/login', '/admin', '/admin/dashboard', '/home', '/earn', '/wallet', '/rewards', '/inbox', '/profile'])(
      'serves %s with 200 and a server-rendered noindex',
      async (path) => {
        const res = await request(app).get(path);
        expect(res.status).toBe(200);
        // Readable without executing JavaScript — this is the whole point.
        expect(res.text).toContain('content="noindex, nofollow"');
        // And must NOT be the homepage: that was the old duplicate-content bug.
        expect(res.text).not.toContain('HOMEPAGE');
        expect(res.text).not.toContain('rel="canonical"');
      },
    );
  });

  describe('unmatched URLs return a genuine 404', () => {
    it.each([
      '/this-page-does-not-exist-xyz123',
      '/blog/nonexistent-post-abc',
      '/free-gift-cards-typo',
    ])('returns 404 with a noindex shell for %s', async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.text).toContain('content="noindex, nofollow"');
      // Regression: previously 200 + full homepage markup + canonical "/".
      expect(res.text).not.toContain('HOMEPAGE');
      expect(res.text).not.toContain('index, follow');
    });
  });

  describe('non-page traffic passes through untouched', () => {
    it('does not intercept /api routes', async () => {
      const res = await request(app).get('/api/public/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('does not intercept health checks', async () => {
      expect((await request(app).get('/healthz')).status).toBe(200);
    });

    it('does not swallow asset requests (paths with an extension)', async () => {
      // No such asset exists, so express falls through to its own 404 handler
      // rather than the SPA shell being returned for a missing file.
      const res = await request(app).get('/assets/missing.js');
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('noindex');
    });

    it('leaves non-GET methods alone', async () => {
      expect((await request(app).post('/some-path')).status).toBe(404);
    });
  });

  describe('isAppRoute', () => {
    it('matches exact prefixes and their children', () => {
      expect(isAppRoute('/admin')).toBe(true);
      expect(isAppRoute('/admin/users')).toBe(true);
      expect(isAppRoute('/login')).toBe(true);
    });

    it('does not match public pages that merely start with similar text', () => {
      expect(isAppRoute('/')).toBe(false);
      expect(isAppRoute('/earn-money-online')).toBe(false);
      expect(isAppRoute('/homepage-guide')).toBe(false);
      expect(isAppRoute('/blog/is-cash-raja-legit')).toBe(false);
    });
  });
});
