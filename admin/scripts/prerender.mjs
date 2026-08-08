// Build-time prerender: renders each public route to static HTML and injects a
// full SEO <head>, writing dist/<route>/index.html. The admin/app SPA is left
// untouched (it has no prerendered file and loads via the SPA fallback).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distDir = path.join(root, 'dist');
const serverEntry = path.join(root, 'dist-server', 'entry-server.js');

const { render, routesToPrerender, siteUrl, lastModFor } = await import(
  pathToFileURL(serverEntry).href
);
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

for (const url of routesToPrerender) {
  const { html, head } = render(url);
  // Drop the template's placeholder <title> so the injected SEO <title> is the
  // only one (a second <title> confuses crawlers).
  let page = template.replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  page = page.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  if (head) page = page.replace('</head>', `    ${head}\n  </head>`);
  const outDir = url === '/' ? distDir : path.join(distDir, url);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), page);
  console.log(`prerendered ${url} -> ${path.relative(root, path.join(outDir, 'index.html'))}`);
}

// app-shell.html — the SPA shell served for non-public routes (the signed-in
// app + /admin) and for unmatched URLs (404s).
//
// Why a separate file: prerendering '/' overwrites dist/index.html with the
// fully-rendered homepage, so using index.html as the shell served homepage
// markup — canonical "/", robots "index, follow" and all — for every app route
// and every typo'd URL. That made unmatched URLs look like indexable homepage
// duplicates. This shell has an empty #root and an explicit noindex in the
// server-delivered HTML, so crawlers that never run JavaScript still read it.
//
// Safe to ship an empty #root: the client entry uses createRoot (not
// hydrateRoot), so React renders from scratch rather than hydrating markup.
const shell = template
  .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
  .replace(
    '</head>',
    '    <meta name="robots" content="noindex, nofollow" />\n' +
      `    <title>${'Cash Raja'}</title>\n  </head>`,
  );
fs.writeFileSync(path.join(distDir, 'app-shell.html'), shell);
console.log('wrote app-shell.html (noindex SPA shell for app routes + 404s)');

// sitemap.xml from the prerendered public routes.
//
// <lastmod> comes from real content dates (lastModFor), not the build clock.
// Stamping "today" on every URL each build claimed all 17 pages changed on every
// unrelated deploy; Google discounts <lastmod> from sources it learns to
// distrust, so the old behaviour quietly destroyed a useful crawl signal.
//
// <changefreq> and <priority> are omitted: Google ignores both.
const urls = routesToPrerender
  .map((u) => {
    const loc = siteUrl + (u === '/' ? '/' : u);
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastModFor(u)}</lastmod>\n  </url>`;
  })
  .join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
console.log(`prerendered ${routesToPrerender.length} public route(s) + sitemap.xml`);
