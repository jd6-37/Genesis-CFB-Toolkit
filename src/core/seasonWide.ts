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
// - title game switches (2026 test31 / 1994 test33 on; claude.ai project handoff H-011, `ctg.py`): table "CTG1"
//   at 0x2D5200, count 11 at +4, one flag byte per conference at +5: bit 0 = the conference plays a title game
//   (its top two the week after the regular season; at least 2 teams), bit 1 = with the 1994 SEC divisions
//   (East = Florida, Georgia, Kentucky, South Carolina, Tennessee, Vanderbilt, by team; West = the rest of
//   that conference). Index 10 (Independents) never plays one. Older ROMs have no table: every conference
//   plays one (2026), the SEC only with its divisions (1994).

import { rw, ww } from './bytes';
import { groupAt } from './teamRatings';
import { isWide, teamsOf } from './wide';

export const CONFS = 11; // 10 conferences + Independents
export const INDEPENDENT = 10;
export const MAX_CONF_TEAMS = 24;
export const NAME_LEN = 22;
export const REG_WEEKS = 12;
export const POWER4 = 4;

/**
 * What an edition's engine needs of the conferences: the regular season's weeks, and the conferences that play a
 * title game (each needs 2 teams). The 2026 edition: 12 weeks, a title game in each of the ten; the 1994 edition
 * (the Dynasty app, src/core/dynasty/edition.ts): 11 weeks, only the first conference's (the SEC's).
 */
export interface ConfRules {
  weeks: number;
  titleGames: number[];
}
export const RULES_2026: ConfRules = { weeks: REG_WEEKS, titleGames: Array.from({ length: INDEPENDENT }, (_, c) => c) };

export const CTG_AT = 0x2d5200;
/** Title game switch bits (a conference's flag byte in CTG1). */
export const TG_ON = 1;
export const TG_SEC94 = 2;
/** The 1994 SEC divisions' East, by team (ctg.py's list). */
export const SEC_EAST_1994 = ['Florida', 'Georgia', 'Kentucky', 'South Carolina', 'Tennessee', 'Vanderbilt'];

/** The ROM's title game switches (11 flag bytes), or null on a ROM without the table. */
export function readTitleGames(d: Uint8Array): number[] | null {
  if (d.length < CTG_AT + 16 || String.fromCharCode(...d.subarray(CTG_AT, CTG_AT + 4)) !== 'CTG1' || d[CTG_AT + 4] !== CONFS) return null;
  const f = Array.from(d.subarray(CTG_AT + 5, CTG_AT + 5 + CONFS));
  return f.some((x) => (x & ~(TG_ON | TG_SEC94)) !== 0) ? null : f;
}

/** The conferences that play a title game: the switches if there are any, else the edition's rule. */
export const titleGameConfs = (s: WideSeason, rules: ConfRules = RULES_2026): number[] =>
  s.titleGames ? s.titleGames.map((f, c) => (c < INDEPENDENT && f & TG_ON ? c : -1)).filter((c) => c >= 0) : rules.titleGames;

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
  /** Title game switches per conference 0-10 (TG_ON, TG_SEC94), on ROMs that have them. */
  titleGames?: number[];
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
  const tg = readTitleGames(d);
  return {
    names: Array.from({ length: CONFS }, (_, c) => readName(d, t.names, c + 1)),
    conf: Array.from({ length: teamsOf(d) }, (_, team) => rw(d, groupAt(d, team) + 6)),
    start: Array.from({ length: INDEPENDENT }, (_, c) => d[t.cws + c]),
    games: Array.from({ length: INDEPENDENT }, (_, c) => d[t.cwn + c]),
    ...(tg ? { titleGames: tg } : {}),
  };
}

/** Teams in each conference. */
export const confSizes = (s: WideSeason) => Array.from({ length: CONFS }, (_, c) => s.conf.filter((x) => x === c).length);

/** The most conference games a conference of n teams can play: one round robin. */
export const roundRobin = (n: number) => Math.max(0, n + (n % 2) - 1);

/** The conference games each team of conference c gets in a random season (what the engine plays). */
export function playedGames(s: WideSeason, c: number, weeks = REG_WEEKS): number {
  if (c === INDEPENDENT) return 0;
  return Math.max(0, Math.min(s.games[c], roundRobin(confSizes(s)[c]), weeks - s.start[c]));
}

/** Why these settings can't go into the ROM; empty if they can. */
export function wideSeasonIssues(s: WideSeason, rules: ConfRules = RULES_2026): string[] {
  const REG_WEEKS = rules.weeks;
  const out: string[] = [];
  const sizes = confSizes(s);
  s.names.forEach((n, c) => {
    const label = n.trim() || `Conference ${c + 1}`;
    if (!n.trim()) out.push(`Conference ${c + 1} needs a name.`);
    if (n.length > NAME_LEN) out.push(`${label}: names can have at most ${NAME_LEN} characters.`);
    if (!ALLOWED.test(n)) out.push(`${label}: the game can only show ${NAME_CHARS}.`);
  });
  const titled = titleGameConfs(s, rules);
  if (s.titleGames && (s.titleGames.length !== CONFS || s.titleGames.some((f, c) => (f & ~(TG_ON | TG_SEC94)) !== 0 || (c === INDEPENDENT && f !== 0)))) {
    out.push('The title game switches are not valid.');
  }
  for (let c = 0; c < INDEPENDENT; c++) {
    const label = s.names[c].trim() || `Conference ${c + 1}`;
    if (titled.includes(c) && sizes[c] < 2) out.push(`${label} needs at least 2 teams for its title game.`);
    if (sizes[c] > MAX_CONF_TEAMS) out.push(`${label} has ${sizes[c]} teams; the game takes at most ${MAX_CONF_TEAMS}.`);
    if (!(s.start[c] >= 0 && s.start[c] < REG_WEEKS)) out.push(`${label}: the first conference week must be 1-${REG_WEEKS}.`);
    if (s.start[c] + s.games[c] > REG_WEEKS) {
      out.push(`${label}: ${s.games[c]} conference games starting in week ${s.start[c] + 1} run past week ${REG_WEEKS}.`);
    }
  }
  return out;
}

/** Writes the settings in place (checksums are fixed when the ROM is saved). */
export function writeWideSeason(d: Uint8Array, s: WideSeason, rules: ConfRules = RULES_2026, base?: Uint8Array): void {
  const p = wideSeasonProblems(d);
  if (p.length) throw new Error(`This ROM's season can't be changed: ${p.join('; ')}.`);
  const issues = wideSeasonIssues(s, rules);
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
  if (s.titleGames) {
    if (!readTitleGames(d)) throw new Error("This ROM has no title game switches (they came with the 2026 Season Edition's test31 and the 1994 Season Edition's test33).");
    d.set(s.titleGames, CTG_AT + 5);
  }
  if (base) markRealSchedule(d, s, base);
}

/**
 * Game Setup's Schedule row (H-046, 2026 / 1994 v2.1.1-test1 on): its default (word at 0x0786EA in
 * `move.w #n,$E5D6`; 0 Random, 1 Real) and its range (0x078432 `moveq #max,d0 / cmpi.w #max,d0`, max 1: Random or
 * Real; ROM lane: nothing else reads it). User (2026-11-20): when conferences are edited the real schedule no longer
 * fits them, so the row offers Random only: default 0 and max 0. Conferences back as loaded: the ROM's own bytes.
 */
export const SCHEDULE_DEFAULT_AT = 0x0786ea;
export const SCHEDULE_RANGE_AT = 0x078432;
const RANGE_LEN = 6;
const hasScheduleRow = (d: Uint8Array) =>
  d[SCHEDULE_DEFAULT_AT - 2] === 0x31 && d[SCHEDULE_DEFAULT_AT - 1] === 0xfc && d[SCHEDULE_DEFAULT_AT + 2] === 0xe5 && d[SCHEDULE_DEFAULT_AT + 3] === 0xd6 &&
  d[SCHEDULE_RANGE_AT] === 0x70 && d[SCHEDULE_RANGE_AT + 2] === 0xb0 && d[SCHEDULE_RANGE_AT + 3] === 0x7c && d[SCHEDULE_RANGE_AT + 4] === 0 &&
  d[SCHEDULE_RANGE_AT + 1] === d[SCHEDULE_RANGE_AT + 5] && d[SCHEDULE_RANGE_AT + 1] <= 1;

/** After a conference edit: Random only when the teams' conferences differ from `base`'s; else `base`'s own bytes (an
 * edit undone puts the Real schedule and the ROM's default back). ROMs before v2.1.1 are left alone. */
function markRealSchedule(d: Uint8Array, s: WideSeason, base: Uint8Array): void {
  if (!hasScheduleRow(d) || !hasScheduleRow(base)) return;
  const was = readWideSeason(base).conf;
  if (s.conf.some((c, t) => c !== was[t])) {
    d[SCHEDULE_DEFAULT_AT] = 0;
    d[SCHEDULE_DEFAULT_AT + 1] = 0;
    d[SCHEDULE_RANGE_AT + 1] = 0;
    d[SCHEDULE_RANGE_AT + 5] = 0;
  } else {
    d.set(base.subarray(SCHEDULE_DEFAULT_AT, SCHEDULE_DEFAULT_AT + 2), SCHEDULE_DEFAULT_AT);
    d.set(base.subarray(SCHEDULE_RANGE_AT, SCHEDULE_RANGE_AT + RANGE_LEN), SCHEDULE_RANGE_AT);
  }
}

/** The Schedule row (v2.1.1 on): its default (0 Random, 1 Real) and whether Real can be picked; null on older ROMs. */
export function readScheduleRow(d: Uint8Array): { def: number; real: boolean } | null {
  if (!hasScheduleRow(d)) return null;
  return { def: (d[SCHEDULE_DEFAULT_AT] << 8) | d[SCHEDULE_DEFAULT_AT + 1], real: d[SCHEDULE_RANGE_AT + 1] === 1 };
}

/** Copies the Schedule row's default and range from `from` (carrying edits to a newer ROM). */
export function copyScheduleRow(to: Uint8Array, from: Uint8Array): void {
  if (!hasScheduleRow(to) || !hasScheduleRow(from)) return;
  to.set(from.subarray(SCHEDULE_DEFAULT_AT, SCHEDULE_DEFAULT_AT + 2), SCHEDULE_DEFAULT_AT);
  to.set(from.subarray(SCHEDULE_RANGE_AT, SCHEDULE_RANGE_AT + RANGE_LEN), SCHEDULE_RANGE_AT);
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
  if (readTitleGames(d)) r.push([CTG_AT + 5, CTG_AT + 5 + CONFS]);
  if (hasScheduleRow(d)) r.push([SCHEDULE_DEFAULT_AT, SCHEDULE_DEFAULT_AT + 2], [SCHEDULE_RANGE_AT, SCHEDULE_RANGE_AT + RANGE_LEN]);
  return r;
}

/** Puts back the settings of `base` (Undo all). */
export function restoreWideSeason(d: Uint8Array, base: Uint8Array): void {
  for (const [s, e] of wideSeasonRanges(base)) d.set(base.subarray(s, e), s);
}

/** Used by tests: the table addresses. */
export const wideSeasonTables = (d: Uint8Array) => tables(d);
