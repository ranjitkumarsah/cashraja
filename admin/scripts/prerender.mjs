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

const { render, routesToPrerender, siteUrl } = await import(pathToFileURL(serverEntry).href);
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

// sitemap.xml from the prerendered public routes.
const today = new Date().toISOString().slice(0, 10);
const urls = routesToPrerender
  .map((u) => {
    const loc = siteUrl + (u === '/' ? '/' : u);
    const priority = u === '/' ? '1.0' : '0.7';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
console.log(`prerendered ${routesToPrerender.length} public route(s) + sitemap.xml`);
