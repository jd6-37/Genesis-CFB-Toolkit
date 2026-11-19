// After `vite build` (the browser files) and the SSR build of src/site/server.tsx (dist-ssr/), writes every
// site address as its own HTML file into dist/, so each page loads with its content, title and share
// picture: dist/index.html, dist/manual/index.html, dist/manual/offense/index.html, dist/404.html …
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const template = readFileSync('dist/index.html', 'utf8');
if (!template.includes('<!--head-->') || !template.includes('<!--app-->')) throw new Error('dist/index.html has lost its <!--head--> or <!--app--> mark');
const { pages, extraFiles } = (await import(pathToFileURL(resolve('dist-ssr/server.js')).href)) as {
  pages: { path: string; head: string; html: () => string }[];
  extraFiles: { path: string; text: () => string }[];
};
for (const p of pages) {
  const out = p.path === '/' ? 'dist/index.html' : p.path === '/404' ? 'dist/404.html' : `dist${p.path}/index.html`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, template.replace('<!--head-->', p.head).replace('<!--app-->', p.html()));
}
for (const f of extraFiles) writeFileSync(`dist/${f.path}`, f.text());
rmSync('dist-ssr', { recursive: true, force: true });
console.log(`${pages.length} pages written, and ${extraFiles.map((f) => f.path).join(', ')}.`);
