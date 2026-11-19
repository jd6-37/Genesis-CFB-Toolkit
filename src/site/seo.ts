// Search and agent-facing data for the built pages (user, 2026-11-19: "SEO friendly ... json-ld and other best
// practices for search and agentic search"): schema.org JSON-LD per page, the sitemap and /llms.txt. Build time only
// (src/site/server.tsx, cli/prerender.ts).
import { chapters, posts } from './content';
import { REPO_URL, SITE_NAME, SITE_URL, type Route } from './routes';
import { cardTitle, editionInfo, parseRosterPath, rostersHref, type RosterPageData } from './rosters/pages';

type Ld = Record<string, unknown>;
const abs = (p: string) => SITE_URL + (p === '/' ? '/' : p);
const AUTHOR: Ld = { '@type': 'Person', name: 'JD637', url: 'https://github.com/jd6-37' };
const WEBSITE_ID = `${SITE_URL}/#website`;
const MOD_ID = `${SITE_URL}/#mod`;
const GAME: Ld = {
  '@type': 'VideoGame', name: "Bill Walsh College Football '95", gamePlatform: 'Sega Genesis', datePublished: '1994',
  publisher: { '@type': 'Organization', name: 'Electronic Arts' }, genre: 'Sports',
};

const crumbs = (items: [string, string][]): Ld => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
});

const website: Ld = {
  '@type': 'WebSite', '@id': WEBSITE_ID, url: abs('/'), name: SITE_NAME, alternateName: ['BW95 Elevated', 'Bill Walsh College Football 95 Elevated'],
  inLanguage: 'en', publisher: AUTHOR,
};

const mod: Ld = {
  '@type': 'SoftwareApplication', '@id': MOD_ID, name: SITE_NAME, url: abs('/'), image: abs('/media/share.png'),
  applicationCategory: 'GameApplication', applicationSubCategory: 'Game mod (ROM patch)',
  operatingSystem: 'Sega Genesis / Mega Drive (emulator or flash cartridge)',
  description:
    "A free, fan-made mod for the Sega Genesis game Bill Walsh College Football '95. It fixes the fatigue bug and adds new formations and plays, harder CPU difficulty levels, 6-button controls, 32 historic teams and full seasons. Two editions: the 107 Division I-A teams of 1994, or the 138 FBS teams of 2026. The game is not included.",
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, isAccessibleForFree: true,
  downloadUrl: `${REPO_URL}/releases`, softwareHelp: abs('/manual'), author: AUTHOR, isBasedOn: GAME,
};

const webApp = (name: string, path: string, description: string): Ld => ({
  '@type': 'WebApplication', name, url: abs(path), applicationCategory: 'GameApplication', operatingSystem: 'Any (a modern web browser)',
  browserRequirements: 'Requires JavaScript', description, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  isAccessibleForFree: true, author: AUTHOR, isPartOf: { '@id': WEBSITE_ID },
});

const page = (r: Route, type = 'WebPage', extra: Ld = {}): Ld => ({
  '@type': type, '@id': `${abs(r.path)}#page`, url: abs(r.path), name: r.title, description: r.description, inLanguage: 'en',
  isPartOf: { '@id': WEBSITE_ID }, ...extra,
});

/** The JSON-LD graph of a built page. */
export function jsonLd(r: Route): Ld | null {
  if (r.path === '/404') return null;
  const graph: Ld[] = [website];
  if (r.path === '/') {
    graph.push(page(r, 'WebPage', { about: { '@id': MOD_ID }, primaryImageOfPage: abs('/media/share.png') }), mod,
      webApp("Bill Walsh '95 Elevated Mod Toolkit", '/toolkit', "Patches a Bill Walsh College Football '95 ROM in the browser and edits rosters, teams, conferences, Walsh Reports and uniforms."),
      webApp("Bill Walsh '95 Elevated Dynasty", '/dynasty', 'Runs a multi-season dynasty: recruiting, player progression, coaches, schedules and awards, written into a new season ROM each year.'));
  } else if (r.path === '/manual') {
    graph.push(page(r, 'CollectionPage', {
      mainEntity: { '@type': 'ItemList', itemListElement: chapters.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.title, url: abs(`/manual/${c.slug}`) })) },
    }), crumbs([['Home', '/'], ['Manual', '/manual']]));
  } else if (r.path.startsWith('/manual/')) {
    const c = chapters.find((x) => `/manual/${x.slug}` === r.path)!;
    graph.push({
      ...page(r, 'TechArticle'), headline: c.title, description: c.summary, author: AUTHOR, publisher: AUTHOR, about: { '@id': MOD_ID },
      isPartOf: { '@type': 'CreativeWork', name: `${SITE_NAME} manual`, url: abs('/manual') },
    }, crumbs([['Home', '/'], ['Manual', '/manual'], [c.title, r.path]]));
  } else if (r.path === '/insights') {
    graph.push(page(r, 'Blog', {
      blogPost: posts.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: abs(`/insights/${p.slug}`), datePublished: p.date })),
    }), crumbs([['Home', '/'], ['Insights', '/insights']]));
  } else if (r.path.startsWith('/insights/')) {
    const p = posts.find((x) => `/insights/${x.slug}` === r.path)!;
    graph.push({
      ...page(r, 'BlogPosting'), headline: p.title, description: p.dek, datePublished: p.date, dateModified: p.date, author: AUTHOR,
      publisher: AUTHOR, image: abs(r.image ?? '/media/share.png'), articleSection: p.tag, timeRequired: `PT${p.minutes}M`, about: { '@id': MOD_ID },
      mainEntityOfPage: abs(r.path),
    }, crumbs([['Home', '/'], ['Insights', '/insights'], [p.title, r.path]]));
  } else if (r.section === 'rosters') {
    graph.push(...rosterLd(r));
  } else {
    graph.push(page(r));
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function rosterLd(r: Route): Ld[] {
  const d = r.data as RosterPageData | undefined;
  const at = parseRosterPath(r.path);
  if (!d || !at) return [page(r)];
  const ed = editionInfo(d.edition);
  const edPath = rostersHref(d.edition);
  const trail: [string, string][] = [['Home', '/'], ['Rosters', '/rosters'], [`${ed.label} teams`, edPath]];
  const teamName = (t: { school: string; nickname: string }) => `${t.school} ${t.nickname}`;
  if (at.kind === 'cards') {
    return [page(r, 'CollectionPage', {
      mainEntity: {
        '@type': 'ItemList', numberOfItems: d.teams.length,
        itemListElement: d.teams.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: teamName(t), url: abs(rostersHref(d.edition, t.id)) })),
      },
    }), crumbs(r.path === '/rosters' ? trail.slice(0, 2) : trail)];
  }
  if (at.kind === 'table') return [page(r, 'WebPage'), crumbs([...trail, ['Every player', r.path]])];
  const t = d.team!;
  const team: Ld = {
    '@type': 'SportsTeam', name: teamName(t), alternateName: cardTitle(t, d.edition), sport: 'American football',
    description: `The ${teamName(t)} roster in ${ed.long} of ${SITE_NAME}, as the game's Team Rosters screen shows it.`,
    ...(t.city ? { location: { '@type': 'Place', name: [t.city, t.state].filter(Boolean).join(', ') } } : {}),
    ...(t.conf ? { memberOf: { '@type': 'SportsOrganization', name: t.conf } } : {}),
    athlete: t.players.filter((p) => p[2] || p[3]).map((p) => ({
      '@type': 'Person', name: `${p[2]} ${p[3]}`.trim(), ...(p[1] !== null ? { identifier: `#${p[1]}` } : {}), jobTitle: p[0],
    })),
  };
  return [page(r, 'ProfilePage', { mainEntity: team }), crumbs([...trail, [t.school, r.path]])];
}

/** sitemap.xml of every indexable page. */
export function sitemapXml(paths: string[]): string {
  const dated = new Map(posts.map((p) => [`/insights/${p.slug}`, p.date]));
  const urls = paths.filter((p) => p !== '/404').map((p) => {
    const last = dated.get(p);
    const prio = p === '/' ? '1.0' : /^\/(manual|insights|rosters)$/.test(p) ? '0.8' : p.startsWith('/rosters/') ? '0.4' : '0.6';
    return `  <url><loc>${abs(p)}</loc>${last ? `<lastmod>${last}</lastmod>` : ''}<priority>${prio}</priority></url>`;
  });
  for (const p of ['/toolkit', '/dynasty']) urls.push(`  <url><loc>${abs(p)}</loc><priority>0.7</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** /llms.txt (llmstxt.org): what the site is and where its pages are, for language models and agents. */
export function llmsTxt(): string {
  const line = (title: string, path: string, note: string) => `- [${title}](${abs(path)}): ${note}`;
  return [
    `# ${SITE_NAME}`,
    '',
    `> ${mod.description as string} The mod is free; it is applied as a patch to your own copy of the game (no ROMs are hosted). Made by JD637.`,
    '',
    'Two editions: the 1994 Season Edition (107 Division I-A teams of 1994, the SEC Championship Game and the 19 bowl games of 1994) and the 2026 Season Edition (138 FBS teams of 2026, conference title games and a 12-team playoff, or another playoff format). Both have the 32 historic teams for Exhibition games.',
    '',
    '## Get the mod',
    `- [Releases on GitHub](${REPO_URL}/releases): the patches and release notes`,
    line('Mod Toolkit', '/toolkit', 'a web app that patches your ROM in the browser and edits rosters, teams, conferences, Walsh Reports and uniforms'),
    line('Dynasty', '/dynasty', 'a web app that runs a multi-season dynasty and writes each new season into your ROM'),
    '',
    '## Manual',
    ...chapters.map((c) => line(c.title, `/manual/${c.slug}`, c.summary)),
    '',
    '## Rosters',
    line('Rosters', '/rosters', 'every team of each edition as a roster card, and a table of every player'),
    line('2026 Season Edition teams', '/rosters/2026', '138 FBS teams'),
    line('1994 Season Edition teams', '/rosters/1994', '107 Division I-A teams'),
    line('Original game teams', '/rosters/original', "the 36 teams of the original Bill Walsh College Football '95"),
    line('Historic teams', '/rosters/historic', '32 great teams from 1978 to 2025, Exhibition only'),
    '',
    '## Insights',
    ...posts.map((p) => line(p.title, `/insights/${p.slug}`, p.dek)),
    '',
    '## Optional',
    line('Sitemap', '/sitemap.xml', 'every page, including one page per team roster'),
    '',
  ].join('\n');
}
