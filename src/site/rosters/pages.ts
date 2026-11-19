// The Rosters section's addresses and the data each page carries (user, 2026-11-19: "a ROSTERS tab ... a roster page
// for every team in the game, 1994 and 2026, including the 32 historic teams", then the original game's 36 too).
//   /rosters                  the 2026 cards (the same page as /rosters/2026)
//   /rosters/<edition>        an edition's cards: 2026, 1994, original, historic
//   /rosters/<edition>/table  every player of the edition in one table (the players load in the browser)
//   /rosters/<edition>/<team> one team's card
// Built pages carry their data in <script id="page-data"> (cli/prerender.ts); the dev server's pages fetch it.
import type { EditionData, EditionId, TeamRoster, TeamSummary } from './types';

export interface EditionInfo {
  id: EditionId;
  /** The switch's label. */
  label: string;
  /** "the 2026 Season Edition" … for sentences. */
  long: string;
  /** The year mark on a card title ('26); historic teams' names carry their own. */
  yy: string;
}
export const EDITIONS: EditionInfo[] = [
  { id: '2026', label: '2026', long: 'the 2026 Season Edition', yy: "'26" },
  { id: '1994', label: '1994', long: 'the 1994 Season Edition', yy: "'94" },
  { id: 'original', label: '1994 original', long: "the original Bill Walsh College Football '95", yy: "'94" },
  { id: 'historic', label: 'Historic', long: 'the historic teams (Exhibition)', yy: '' },
];
export const editionInfo = (id: EditionId) => EDITIONS.find((e) => e.id === id)!;

export type PageKind = 'cards' | 'table' | 'team';
export interface RosterPageData {
  kind: PageKind;
  edition: EditionId;
  build: string;
  sheet: EditionData['sheet'];
  teams: TeamSummary[];
  /** The team page's team. */
  team?: TeamRoster;
}

export const rostersHref = (ed: EditionId, rest?: string) => `/rosters/${ed}${rest ? `/${rest}` : ''}`;

/** What an address under /rosters asks for, or null. */
export function parseRosterPath(path: string): { edition: EditionId; kind: PageKind; team?: string } | null {
  const parts = path.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] !== 'rosters' || parts.length > 3) return null;
  if (parts.length === 1) return { edition: '2026', kind: 'cards' };
  const ed = EDITIONS.find((e) => e.id === parts[1]);
  if (!ed) return null;
  if (parts.length === 2) return { edition: ed.id, kind: 'cards' };
  return parts[2] === 'table' ? { edition: ed.id, kind: 'table' } : { edition: ed.id, kind: 'team', team: parts[2] };
}

const summary = ({ players: _p, ...t }: TeamRoster): TeamSummary => t;

/** The data of a page, from its edition's file, or null when the address names no such team. */
export function pageData(path: string, set: EditionData): RosterPageData | null {
  const at = parseRosterPath(path);
  if (!at || at.edition !== set.edition) return null;
  const base = { kind: at.kind, edition: set.edition, build: set.build, sheet: set.sheet, teams: set.teams.map(summary).sort((a, b) => a.school.localeCompare(b.school)) };
  if (at.kind !== 'team') return base;
  const team = set.teams.find((t) => t.id === at.team);
  return team ? { ...base, team } : null;
}

/** Every address of the section, for the build. */
export function rosterPaths(sets: EditionData[]): string[] {
  return ['/rosters', ...sets.flatMap((s) => [rostersHref(s.edition), rostersHref(s.edition, 'table'), ...s.teams.map((t) => rostersHref(s.edition, t.id))])];
}

/** A card's title: the school and the season ("BYU '26"; a historic team's name has its year). */
export const cardTitle = (t: TeamSummary, ed: EditionId) => (ed === 'historic' ? t.school : `${t.school} ${editionInfo(ed).yy}`).toUpperCase();

/** A player's name as the card shows it: first initial and last name ("R. Bush"). */
export function shortName(first: string, last: string): string {
  if (!last) return first;
  return first ? `${first[0]}. ${last}` : last;
}
