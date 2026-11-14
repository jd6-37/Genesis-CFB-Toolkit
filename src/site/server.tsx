// Build-time rendering (cli/prerender.ts): the HTML and <head> of every address.
import { renderToString } from 'react-dom/server';
import { Site } from './Site';
import { notFound, routes, SITE_NAME, SITE_URL, type Route } from './routes';

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
  ].filter(Boolean).join('\n    ');
}

export const pages = [...routes, notFound].map((r) => ({
  path: r.path,
  head: head(r),
  html: () => renderToString(<Site route={r} />),
}));
