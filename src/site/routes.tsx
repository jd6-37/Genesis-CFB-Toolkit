// Every address of the site, with its title and description for the page's <head>.
// cli/prerender.ts writes one HTML file for each.
import type { ReactNode } from 'react';
import { chapters, posts } from './content';
import { Home } from './Home';
import { ChapterPage, ManualIndex } from './Manual';
import { InsightsIndex, PostPage } from './Insights';
import { NotFound } from './NotFound';
import { RostersPage } from './rosters/Rosters';
import { editionInfo, parseRosterPath, type RosterPageData } from './rosters/pages';

export const SITE_URL = 'https://genesis-cfb-toolkit.vercel.app';
export const SITE_NAME = "Bill Walsh '95 Elevated";
export const REPO_URL = 'https://github.com/jd6-37/Bill-Walsh-CFB-95-Elevated';

export type Section = 'home' | 'manual' | 'rosters' | 'insights';
export interface Route {
  path: string;
  title: string;
  description: string;
  section: Section;
  /** A share picture for this page (default: the site's). */
  image?: string;
  /** Data the page needs, written into the built page (<script id="page-data">) so it renders the same in the browser. */
  data?: unknown;
  render: () => ReactNode;
}

export const routes: Route[] = [
  {
    path: '/',
    title: `${SITE_NAME}: a free fan mod for Bill Walsh College Football '95`,
    description:
      "A free, fan-made mod for the Sega Genesis game Bill Walsh College Football '95. It fixes the fatigue bug and adds new formations and plays, harder CPU difficulty levels, 6-button controls and full seasons. Two editions: the 107 Division I-A teams of 1994, or the 138 FBS teams of 2026. The game is not included.",
    section: 'home',
    render: () => <Home />,
  },
  {
    path: '/manual',
    title: `Manual | ${SITE_NAME}`,
    description: "How to play Bill Walsh College Football '95 Elevated: every control, screen and mode of the original game, and everything the mod adds.",
    section: 'manual',
    render: () => <ManualIndex />,
  },
  ...chapters.map((c): Route => ({
    path: `/manual/${c.slug}`,
    title: `${c.title} | Manual | ${SITE_NAME}`,
    description: c.summary,
    section: 'manual',
    render: () => <ChapterPage chapter={c} />,
  })),
  {
    path: '/insights',
    title: `Insights | ${SITE_NAME}`,
    description: "Articles on how the game's code works and what the Elevated mod changes: what each rating does, how simulated games are decided, how fatigue works.",
    section: 'insights',
    render: () => <InsightsIndex />,
  },
  ...posts.map((p): Route => ({
    path: `/insights/${p.slug}`,
    title: `${p.title} | Insights | ${SITE_NAME}`,
    description: p.dek,
    section: 'insights',
    render: () => <PostPage post={p} />,
  })),
];

export const notFound: Route = {
  path: '/404',
  title: `Page not found | ${SITE_NAME}`,
  description: 'This page does not exist.',
  section: 'home',
  render: () => <NotFound />,
};

/** A Rosters page (rosters/pages.ts): its data comes with the built page; without it (dev server) the page fetches it. */
export function rosterRoute(path: string, data: RosterPageData | null): Route | null {
  const at = parseRosterPath(path);
  if (!at) return null;
  const ed = editionInfo(at.edition);
  const team = data?.team;
  const title = at.kind === 'team' && team
    ? `${team.school}${at.edition === 'historic' ? '' : ` ${ed.yy}`} roster | Rosters | ${SITE_NAME}`
    : at.kind === 'table' ? `Every player, ${ed.label} | Rosters | ${SITE_NAME}` : `Rosters, ${ed.label} | ${SITE_NAME}`;
  const description = at.kind === 'team' && team
    ? `The ${team.school} ${team.nickname} in ${ed.long}: every player's number, name, class and ratings, as the game's Team Rosters shows them.`
    : at.kind === 'table'
      ? `Every player of ${ed.long} in one table: sort and filter by team, position and each rating.`
      : `Every team of ${ed.long} as a roster card: numbers, names and ratings as the game's Team Rosters shows them.`;
  const canon = path.replace(/\/+$/, '') === '/rosters' ? '/rosters' : path.replace(/\/+$/, '');
  return { path: canon, title, description, section: 'rosters', data, render: () => <RostersPage path={canon} data={data} /> };
}

export const findRoute = (path: string, data: unknown = null) =>
  routes.find((r) => r.path === (path.replace(/\/+$/, '') || '/')) ?? rosterRoute(path, data as RosterPageData | null) ?? notFound;
