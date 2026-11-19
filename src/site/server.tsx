// Build-time rendering (cli/prerender.ts): the HTML and <head> of every address.
import { renderToString } from 'react-dom/server';
import { Site } from './Site';
import { notFound, rosterRoute, routes, SITE_NAME, SITE_URL, type Route } from './routes';
import { pageData, rosterPaths } from './rosters/pages';
import type { EditionData } from './rosters/types';
import r2026 from '../../public/data/rosters/2026.json';
import r1994 from '../../public/data/rosters/1994.json';
import rOriginal from '../../public/data/rosters/original.json';
import rHistoric from '../../public/data/rosters/historic.json';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function head(r: Route) {
  const url = SITE_URL + (r.path === '/404' ? '/' : r.path);
  const image = SITE_URL + (r.image ?? '/media/share.png');
  return [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.description)}" />`,
    r.path !== '/404' ? `<link rel="canonical" href="${url}" />` : '',
    `<meta property="og:type" content="${r.section === 'insights' && r.path !== '/insights' ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:title" content="${esc(r.title)}" />`,
    `<meta property="og:description" content="${esc(r.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    r.data ? `<script type="application/json" id="page-data">${JSON.stringify(r.data).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ');
}

// The Rosters section: one page per edition, table and team, each with its data.
const sets = [r2026, r1994, rOriginal, rHistoric] as EditionData[];
const rosterRoutes = rosterPaths(sets).map((path) => {
  const at = path === '/rosters' ? '/rosters/2026' : path;
  const set = sets.find((s) => at.startsWith(`/rosters/${s.edition}`))!;
  const route = rosterRoute(path, pageData(at, set));
  if (!route || !route.data) throw new Error(`No data for ${path}`);
  return route;
});

export const pages = [...routes, ...rosterRoutes, notFound].map((r) => ({
  path: r.path,
  head: head(r),
  html: () => renderToString(<Site route={r} />),
}));
