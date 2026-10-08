// Build step: write static HTML for /compare and each /compare/<slug> page.
//
// Runs after `vite build`. Takes the built dist/index.html (so the SPA bundle
// and CSS still load), swaps in per-page title / description / Open Graph /
// Twitter / canonical tags, and puts the server-rendered page copy in a
// #compare-prerender block just before #root. Compare.jsx removes that block
// on mount, once React has drawn the same markup.
//
// Output: dist/compare/index.html and dist/compare/<slug>/index.html.
// vercel.json rewrites /compare and /compare/<slug> to these files.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

const escapeAttr = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(new RegExp(pattern.source, 'g')) || [];
  if (matches.length !== 1) {
    throw new Error(`prerender-compare: expected exactly one ${label} in dist/index.html, found ${matches.length}`);
  }
  return html.replace(pattern, replacement);
}

function buildPage(template, { title, description, url, body }) {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const u = escapeAttr(url);
  let html = template;
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${t}</title>`, '<title>');
  html = replaceOnce(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}" />`, 'meta description');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${u}" />`, 'og:url');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}" />`, 'og:title');
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />`, 'og:description');
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${t}" />`, 'twitter:title');
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${d}" />`, 'twitter:description');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${u}" />`, 'canonical');
  html = replaceOnce(html, /<div id="root"><\/div>/, `<div id="compare-prerender">${body}</div>\n    <div id="root"></div>`, '#root');
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) throw new Error(`prerender-compare: ${url} has ${h1s} <h1> tags`);
  return html;
}

async function main() {
  const template = await readFile(resolve(dist, 'index.html'), 'utf8');
  const vite = await createServer({
    root,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { render } = await vite.ssrLoadModule('/scripts/compare-ssr-entry.jsx');
    const { PAGES, OTHERS, HUB, SITE_URL } = await vite.ssrLoadModule('/src/pages/compareData.js');

    const pages = [
      { path: '/compare', title: HUB.title, description: HUB.description },
      ...OTHERS.map(({ slug }) => ({
        path: `/compare/${slug}`,
        title: PAGES[slug].title,
        description: PAGES[slug].description,
      })),
    ];

    for (const p of pages) {
      const html = buildPage(template, {
        title: p.title,
        description: p.description,
        url: `${SITE_URL}${p.path}`,
        body: render(p.path),
      });
      const out = resolve(dist, `.${p.path}`, 'index.html');
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, html);
      console.log(`prerender-compare: wrote ${out.slice(root.length + 1)}`);
    }
  } finally {
    await vite.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
