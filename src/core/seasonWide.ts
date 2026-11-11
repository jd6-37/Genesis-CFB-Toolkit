// Season settings of the 138-team 2026 Season Edition (Elevated v2.0.0 on). Pure functions, no DOM.
//
// That edition has its own season engine (claude.ai project notes: bw95-138-teams-season-plan.md). What it
// takes from the ROM, and what this module edits:
// - each team's conference: the ratings group's word +6 (0-9 the ten conferences, 10 Independents);
// - the conference names: a table of 12 strings of 22 characters, centered ("Top 25", then the 11
//   conferences), which the Rankings screen prints as its title; the engine finds it with
//   `lea CONFNAMES(pc),a1` at 0x211D40;
// - for the random schedule: per conference the first conference week (CWS, 0-based) and the number of
//   conference games (CWN), 11 bytes each, found with `lea CWS(pc),a0` at 0x211576 and `lea CWN(pc),a0`
//   at 0x2115B2. Conference games are played by the circle method, at most one round robin (a
//   conference of n teams plays at most n - 1 games, n rounded up to even), in the season's 12 weeks.
//   Independents never play conference games. The real 2026 schedule is fixed; the conferences then only
//   decide the standings and the title games.
// - title games (Postseason with title games): the top two of each of the ten conferences, so each needs
//   2 teams; conferences 1-4 (SEC, Big Ten, ACC, Big 12 as released) are the Power 4 of the CFP's
//   automatic bids, 5-10 the Group of 6. The engine keeps at most 24 teams a conference.

import { rw, ww } from './bytes';
import { groupAt } from './teamRatings';
import { isWide, teamsOf } from './wide';

export const CONFS = 11; // 10 conferences + Independents
export const INDEPENDENT = 10;
export const MAX_CONF_TEAMS = 24;
export const NAME_LEN = 22;
export const REG_WEEKS = 12;
export const POWER4 = 4;

const NAMES_LEA = 0x211d40;
const CWS_LEA = 0x211576;
const CWN_LEA = 0x2115b2;
const NAME_ENTRY = 2 + NAME_LEN;

/** What the Rankings title font draws. */
export const NAME_CHARS = "letters, numbers, spaces and - . & '";
const ALLOWED = /^[A-Za-z0-9 .&'-]*$/;

export interface WideSeason {
  /** The 11 names as typed (no centering spaces). */
  names: string[];
  /** Conference of each team (0-10). */
  conf: number[];
  /** First conference week per conference 0-9 (0-based). */
  start: number[];
  /** Conference games per conference 0-9 (the engine plays at most one round robin). */
  games: number[];
}

/** Target of a `lea d16(pc),An` at `at`, or -1 if there's none. */
function pcLea(d: Uint8Array, at: number, reg: number): number {
  if (rw(d, at) !== (0x41fa | (reg << 9))) return -1;
  return at + 2 + ((rw(d, at + 2) << 16) >> 16);
}

/** Where the three tables are, from the engine's own code. */
function tables(d: Uint8Array) {
  return { names: pcLea(d, NAMES_LEA, 1), cws: pcLea(d, CWS_LEA, 0), cwn: pcLea(d, CWN_LEA, 0) };
}

/** Why this ROM's season settings can't be read or changed; empty if they can. */
export function wideSeasonProblems(d: Uint8Array): string[] {
  if (!isWide(d)) return ['this is not the 138-team 2026 Season Edition'];
  const t = tables(d);
  if (t.names < 0 || t.cws < 0 || t.cwn < 0) return ["the season engine isn't the one this tool knows"];
  for (let k = 0; k <= CONFS; k++) {
    if (rw(d, t.names + NAME_ENTRY * k) !== NAME_ENTRY) return ["the conference name table isn't laid out as expected"];
  }
  if (readName(d, t.names, 0) !== 'Top 25') return ["the conference name table isn't laid out as expected"];
  if (d[t.cws + INDEPENDENT] !== 99 || d[t.cwn + INDEPENDENT] !== 0) return ["the conference week tables aren't laid out as expected"];
  for (let c = 0; c < INDEPENDENT; c++) {
    if (d[t.cws + c] >= REG_WEEKS || d[t.cwn + c] > MAX_CONF_TEAMS) return ["the conference week tables aren't laid out as expected"];
  }
  for (let team = 0; team < teamsOf(d); team++) {
    if (rw(d, groupAt(d, team) + 6) > INDEPENDENT) return [`team ${team + 1} has an unknown conference`];
  }
  return [];
}

function readName(d: Uint8Array, base: number, k: number): string {
  const a = base + NAME_ENTRY * k + 2;
  return String.fromCharCode(...d.subarray(a, a + NAME_LEN)).trim();
}

export function readWideSeason(d: Uint8Array): WideSeason {
  const p = wideSeasonProblems(d);
  if (p.length) throw new Error(`This ROM's season can't be read: ${p.join('; ')}.`);
  const t = tables(d);
  return {
    names: Array.from({ length: CONFS }, (_, c) => readName(d, t.names, c + 1)),
    conf: Array.from({ length: teamsOf(d) }, (_, team) => rw(d, groupAt(d, team) + 6)),
    start: Array.from({ length: INDEPENDENT }, (_, c) => d[t.cws + c]),
    games: Array.from({ length: INDEPENDENT }, (_, c) => d[t.cwn + c]),
  };
}

/** Teams in each conference. */
export const confSizes = (s: WideSeason) => Array.from({ length: CONFS }, (_, c) => s.conf.filter((x) => x === c).length);

/** The most conference games a conference of n teams can play: one round robin. */
export const roundRobin = (n: number) => Math.max(0, n + (n % 2) - 1);

/** The conference games each team of conference c gets in a random season (what the engine plays). */
export function playedGames(s: WideSeason, c: number): number {
  if (c === INDEPENDENT) return 0;
  return Math.max(0, Math.min(s.games[c], roundRobin(confSizes(s)[c]), REG_WEEKS - s.start[c]));
}

/** Why these settings can't go into the ROM; empty if they can. */
export function wideSeasonIssues(s: WideSeason): string[] {
  const out: string[] = [];
  const sizes = confSizes(s);
  s.names.forEach((n, c) => {
    const label = n.trim() || `Conference ${c + 1}`;
    if (!n.trim()) out.push(`Conference ${c + 1} needs a name.`);
    if (n.length > NAME_LEN) out.push(`${label}: names can have at most ${NAME_LEN} characters.`);
    if (!ALLOWED.test(n)) out.push(`${label}: the game can only show ${NAME_CHARS}.`);
  });
  for (let c = 0; c < INDEPENDENT; c++) {
    const label = s.names[c].trim() || `Conference ${c + 1}`;
    if (sizes[c] < 2) out.push(`${label} needs at least 2 teams for its title game.`);
    if (sizes[c] > MAX_CONF_TEAMS) out.push(`${label} has ${sizes[c]} teams; the game takes at most ${MAX_CONF_TEAMS}.`);
    if (!(s.start[c] >= 0 && s.start[c] < REG_WEEKS)) out.push(`${label}: the first conference week must be 1-${REG_WEEKS}.`);
    if (s.start[c] + s.games[c] > REG_WEEKS) {
      out.push(`${label}: ${s.games[c]} conference games starting in week ${s.start[c] + 1} run past week ${REG_WEEKS}.`);
    }
  }
  return out;
}

/** Writes the settings in place (checksums are fixed when the ROM is saved). */
export function writeWideSeason(d: Uint8Array, s: WideSeason): void {
  const p = wideSeasonProblems(d);
  if (p.length) throw new Error(`This ROM's season can't be changed: ${p.join('; ')}.`);
  const issues = wideSeasonIssues(s);
  if (issues.length) throw new Error(issues[0]);
  if (s.conf.length !== teamsOf(d)) throw new Error('the team count differs from the ROM');
  const t = tables(d);
  s.names.forEach((n, c) => {
    const text = n.trim();
    const left = Math.floor((NAME_LEN - text.length) / 2);
    const padded = (' '.repeat(left) + text).padEnd(NAME_LEN, ' ');
    const a = t.names + NAME_ENTRY * (c + 1) + 2;
    for (let k = 0; k < NAME_LEN; k++) d[a + k] = padded.charCodeAt(k);
  });
  s.conf.forEach((c, team) => ww(d, groupAt(d, team) + 6, c));
  for (let c = 0; c < INDEPENDENT; c++) {
    d[t.cws + c] = s.start[c];
    d[t.cwn + c] = s.games[c];
  }
}

/** The bytes a season edit can change, as [start, end) ranges. */
export function wideSeasonRanges(d: Uint8Array): [number, number][] {
  const t = tables(d);
  const r: [number, number][] = [
    [t.names + NAME_ENTRY, t.names + NAME_ENTRY * (CONFS + 1)],
    [t.cws, t.cws + INDEPENDENT],
    [t.cwn, t.cwn + INDEPENDENT],
  ];
  for (let team = 0; team < teamsOf(d); team++) {
    const g = groupAt(d, team) + 6;
    r.push([g, g + 2]);
  }
  return r;
}

/** Puts back the settings of `base` (Undo all). */
export function restoreWideSeason(d: Uint8Array, base: Uint8Array): void {
  for (const [s, e] of wideSeasonRanges(base)) d.set(base.subarray(s, e), s);
}

/** Used by tests: the table addresses. */
export const wideSeasonTables = (d: Uint8Array) => tables(d);
