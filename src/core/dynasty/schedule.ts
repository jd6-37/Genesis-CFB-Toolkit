// Dynasty schedules from the second season on (user, 2026-11-12: "Generate each year, and then the user can
// edit … Basically use same rules"; "I would like to be able to edit conference games too"; "let's keep
// protected rivalries"). Pure functions.
//
// The game's Random schedule (the 138-team season engine's GEN): 12 weeks, every team plays every week;
// each conference plays its conference games (the ROM's count, CWN) in the weeks from its first conference
// week (CWS) on, as circle-method rounds of a shuffled order; every team without a conference game that week
// is paired at random, another conference first, no repeat games. The app does the same, and first makes sure
// the protected rivalries (rivalries.ts) are in: inside a conference by picking rounds that hold them, across
// conferences in a week both teams are free; the season finales go in the last week.

import { INDEPENDENT, seasonView } from './derive';
import { PROTECTED } from './rivalries';

export const SCHED_WEEKS = 12;

/** A game: week (0-based, like the save), visitor, home. */
export interface SchedGame { week: number; visitor: number; home: number }
export interface DSchedule {
  games: SchedGame[];
  /** The seed it was made from ("Make a new schedule" picks another). */
  seed: number;
  /** A user changed it (any team's games). */
  edited?: boolean;
}

/** Per conference 0-9: first conference week (0-based) and conference games, as the ROM's CWS/CWN tables. */
export interface ConfWeeks { start: number[]; games: number[] }
/** The 2026 Season Edition's values (for dynasties made before the app kept the ROM's). */
export const RELEASE_CONF_WEEKS: ConfWeeks = { start: [3, 3, 4, 3, 4, 4, 3, 3, 3, 4], games: [9, 9, 8, 9, 8, 8, 8, 8, 8, 7] };

export interface ScheduleInput {
  schools: string[];
  conf: number[];
  confWeeks: ConfWeeks;
  /** Last season's games (visitor, home), so rivalry games switch sites. */
  last?: { visitor: number; home: number }[];
  seed: number;
}

const key = (a: number, b: number) => (a < b ? a * 1000 + b : b * 1000 + a);

function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(a: T[], r: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** The protected rivalries as team pairs (pairs whose schools aren't in the league are left out). */
export function protectedPairs(schools: string[]): { a: number; b: number; last: boolean }[] {
  const at = new Map(schools.map((s, i) => [s, i]));
  return PROTECTED.flatMap((p) => {
    const a = at.get(p.a), b = at.get(p.b);
    return a === undefined || b === undefined ? [] : [{ a, b, last: !!p.last }];
  });
}

/** Circle-method rounds for these teams (an odd count gets a bye: -1). */
function rounds(teams: number[]): [number, number][][] {
  const t = teams.length % 2 ? [...teams, -1] : teams.slice();
  const m = t.length, out: [number, number][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = t[i], b = t[m - 1 - i];
      if (a >= 0 && b >= 0) round.push([a, b]);
    }
    out.push(round);
    t.splice(1, 0, t.pop()!);
  }
  return out;
}

/** The working grid: opponent of each team in each week (-1 = none yet). */
class Grid {
  opp: Int16Array[];
  met = new Map<number, number>();
  constructor(n: number) { this.opp = Array.from({ length: SCHED_WEEKS }, () => new Int16Array(n).fill(-1)); }
  free(w: number, t: number) { return this.opp[w][t] < 0; }
  add(w: number, a: number, b: number) { this.opp[w][a] = b; this.opp[w][b] = a; this.met.set(key(a, b), (this.met.get(key(a, b)) ?? 0) + 1); }
  remove(w: number, a: number) {
    const b = this.opp[w][a];
    if (b < 0) return -1;
    this.opp[w][a] = -1; this.opp[w][b] = -1;
    const k = key(a, b), c = (this.met.get(k) ?? 1) - 1;
    if (c > 0) this.met.set(k, c); else this.met.delete(k);
    return b;
  }
  weekOf(a: number, b: number) { for (let w = 0; w < SCHED_WEEKS; w++) if (this.opp[w][a] === b) return w; return -1; }
}

/** A new regular season for every team. */
export function makeSchedule(inp: ScheduleInput): DSchedule {
  const n = inp.schools.length;
  const r = rand(inp.seed);
  const g = new Grid(n);
  const last = SCHED_WEEKS - 1;
  const prot = protectedPairs(inp.schools);
  const sameConf = (a: number, b: number) => inp.conf[a] === inp.conf[b] && inp.conf[a] !== INDEPENDENT;

  // 1. Conference games: rounds that hold the conference's protected games, the finale's round last.
  for (let c = 0; c < INDEPENDENT; c++) {
    const teams = inp.conf.map((x, t) => (x === c ? t : -1)).filter((t) => t >= 0);
    if (teams.length < 2) continue;
    const all = rounds(teams).length;
    const start = Math.min(inp.confWeeks.start[c] ?? 3, last);
    const games = Math.max(0, Math.min(inp.confWeeks.games[c] ?? 8, all, SCHED_WEEKS - start));
    if (!games) continue;
    const mine = prot.filter((p) => inp.conf[p.a] === c && inp.conf[p.b] === c);
    let best: { order: [number, number][][]; score: number } | null = null;
    for (let tries = 0; tries < 400 && (!best || best.score > 0); tries++) {
      const rs = rounds(shuffle(teams.slice(), r));
      const roundOf = (p: { a: number; b: number }) => rs.findIndex((rd) => rd.some(([x, y]) => key(x, y) === key(p.a, p.b)));
      const need = [...new Set(mine.map(roundOf))];
      if (need.length > games) continue;
      const others = shuffle(rs.map((_, i) => i).filter((i) => !need.includes(i)), r).slice(0, games - need.length);
      const pick = shuffle([...need, ...others], r);
      // The finale's round goes last (the one with the most finales).
      const finales = (i: number) => mine.filter((p) => p.last && roundOf(p) === i).length;
      if (start + games - 1 === last) pick.sort((x, y) => finales(x) - finales(y));
      const score = start + games - 1 === last ? mine.filter((p) => p.last).length - finales(pick[pick.length - 1]) : 0;
      if (!best || score < best.score) best = { order: pick.map((i) => rs[i]), score };
    }
    if (!best) {
      // No order holds every protected game: plain rounds (the missing ones are placed below where they fit).
      best = { order: rounds(shuffle(teams.slice(), r)).slice(0, games), score: 0 };
    }
    best.order.forEach((rd, i) => rd.forEach(([a, b]) => g.add(start + i, a, b)));
  }

  // 2. The finales into the last week: when one isn't there, the two teams leave their games that week
  //    (those games move to a week where both teams are free).
  const moved: [number, number][] = [];
  for (const p of prot.filter((x) => x.last)) {
    if (g.opp[last][p.a] === p.b) continue;
    const before = g.weekOf(p.a, p.b);
    if (before >= 0) g.remove(before, p.a);
    for (const t of [p.a, p.b]) {
      const o = g.remove(last, t);
      if (o >= 0) moved.push([t, o]);
    }
    g.add(last, p.a, p.b);
  }
  const placeAnywhere = (a: number, b: number, prefer: 'late' | 'any') => {
    const weeks = Array.from({ length: SCHED_WEEKS }, (_, w) => w).filter((w) => g.free(w, a) && g.free(w, b));
    if (!weeks.length) return false;
    g.add(prefer === 'late' ? weeks[weeks.length - 1] : weeks[Math.floor(r() * weeks.length)], a, b);
    return true;
  };
  for (const [a, b] of moved) if (!g.met.has(key(a, b))) placeAnywhere(a, b, 'late');

  // 3. The other protected games not in yet (across conferences, or a conference that couldn't hold them).
  for (const p of prot) if (!g.met.has(key(p.a, p.b))) placeAnywhere(p.a, p.b, 'any');

  // 4. Everyone else, week by week: another conference first, then anyone new, then anyone (the game's passes).
  for (let w = 0; w < SCHED_WEEKS; w++) {
    let bestPairs: [number, number][] = [], bestRepeats = Infinity;
    for (let tries = 0; tries < 40 && bestRepeats > 0; tries++) {
      const pool = shuffle(Array.from({ length: n }, (_, t) => t).filter((t) => g.free(w, t)), r);
      const used = new Set<number>(), pairs: [number, number][] = [];
      let repeats = 0;
      for (const a of pool) {
        if (used.has(a)) continue;
        const rest = pool.filter((b) => b !== a && !used.has(b));
        if (!rest.length) break;
        const b = rest.find((x) => !sameConf(a, x) && !g.met.has(key(a, x))) ?? rest.find((x) => !g.met.has(key(a, x))) ?? rest[0];
        if (g.met.has(key(a, b))) repeats++;
        used.add(a); used.add(b); pairs.push([a, b]);
      }
      if (repeats < bestRepeats) { bestRepeats = repeats; bestPairs = pairs; }
    }
    for (const [a, b] of bestPairs) g.add(w, a, b);
  }

  // 5. Home and away: rivalries switch sites from last season; then the fewest home games so far hosts.
  const lastHome = new Map<number, number>();
  for (const x of inp.last ?? []) lastHome.set(key(x.visitor, x.home), x.home);
  const homes = new Int16Array(n);
  const pairs: { week: number; a: number; b: number }[] = [];
  for (let w = 0; w < SCHED_WEEKS; w++) for (let a = 0; a < n; a++) { const b = g.opp[w][a]; if (b > a) pairs.push({ week: w, a, b }); }
  const isProt = new Set(prot.map((p) => key(p.a, p.b)));
  const games: SchedGame[] = [];
  const order = [...pairs.filter((p) => isProt.has(key(p.a, p.b))), ...shuffle(pairs.filter((p) => !isProt.has(key(p.a, p.b))), r)];
  for (const p of order) {
    const prev = isProt.has(key(p.a, p.b)) ? lastHome.get(key(p.a, p.b)) : undefined;
    let home: number;
    if (prev !== undefined) home = prev === p.a ? p.b : p.a;
    else if (homes[p.a] !== homes[p.b]) home = homes[p.a] < homes[p.b] ? p.a : p.b;
    else home = r() < 0.5 ? p.a : p.b;
    homes[home]++;
    games.push({ week: p.week, visitor: home === p.a ? p.b : p.a, home });
  }
  // Even out: a game whose host has two or more home games more than his visitor switches (not rivalries).
  for (let pass = 0, changed = true; changed && pass < 50; pass++) {
    changed = false;
    for (const x of shuffle(games.slice(), r)) {
      if (isProt.has(key(x.visitor, x.home)) || homes[x.home] < homes[x.visitor] + 2) continue;
      homes[x.home]--; homes[x.visitor]++;
      [x.visitor, x.home] = [x.home, x.visitor];
      changed = true;
    }
  }
  games.sort((x, y) => x.week - y.week || x.home - y.home);
  return { games, seed: inp.seed };
}

// ---- reading and editing

/** Each week, each team's game (index into games), or -1. */
export function weekGrid(s: DSchedule, n: number): number[][] {
  const out = Array.from({ length: SCHED_WEEKS }, () => new Array<number>(n).fill(-1));
  s.games.forEach((x, i) => { out[x.week][x.visitor] = i; out[x.week][x.home] = i; });
  return out;
}

const opponentIn = (x: SchedGame, t: number) => (x.visitor === t ? x.home : x.visitor);

/**
 * Gives `team` a new opponent in a week (user, 2026-11-12: the user's teams only, conference games too).
 * His old opponent plays the new opponent's old opponent instead, so every team still plays once that week.
 */
export function setOpponent(s: DSchedule, week: number, team: number, opp: number): DSchedule {
  if (opp === team) return s;
  const games = s.games.map((x) => ({ ...x }));
  const ia = games.findIndex((x) => x.week === week && (x.visitor === team || x.home === team));
  const ib = games.findIndex((x) => x.week === week && (x.visitor === opp || x.home === opp));
  if (ia < 0 || ib < 0 || ia === ib) return s;
  const a = games[ia], b = games[ib];
  const x = opponentIn(a, team), y = opponentIn(b, opp);
  const teamHome = a.home === team;
  games[ia] = teamHome ? { week, visitor: opp, home: team } : { week, visitor: team, home: opp };
  // The two left over: the one who was the visitor stays the visitor if he can.
  games[ib] = a.visitor === x ? { week, visitor: x, home: y } : { week, visitor: y, home: x };
  return { ...s, games, edited: true };
}

/** Plays `team`'s game of week `from` in week `to` instead, and his game of `to` in `from`. */
export function moveGame(s: DSchedule, team: number, from: number, to: number): DSchedule {
  if (from === to) return s;
  const g = weekGrid(s, Math.max(...s.games.map((x) => Math.max(x.visitor, x.home))) + 1);
  const ga = g[from][team], gb = g[to][team];
  if (ga < 0 || gb < 0) return s;
  const a = opponentIn(s.games[ga], team), b = opponentIn(s.games[gb], team);
  const home = s.games[ga].home === team, home2 = s.games[gb].home === team;
  let out = setOpponent(s, to, team, a);
  out = setOpponent(out, from, team, b);
  // Keep each game's site with the game.
  return {
    ...out,
    games: out.games.map((x) => {
      if (x.week === to && (x.visitor === team || x.home === team) && (x.home === team) !== home) return { ...x, visitor: x.home, home: x.visitor };
      if (x.week === from && (x.visitor === team || x.home === team) && (x.home === team) !== home2) return { ...x, visitor: x.home, home: x.visitor };
      return x;
    }),
  };
}

/** Switches home and away of `team`'s game in a week. */
export function flipHome(s: DSchedule, week: number, team: number): DSchedule {
  return {
    ...s, edited: true,
    games: s.games.map((x) => (x.week === week && (x.visitor === team || x.home === team) ? { ...x, visitor: x.home, home: x.visitor } : x)),
  };
}

/** A team's season: per week, the opponent and whether he's at home (null = no game). */
export function teamSchedule(s: DSchedule, team: number): ({ opp: number; home: boolean } | null)[] {
  const out: ({ opp: number; home: boolean } | null)[] = new Array(SCHED_WEEKS).fill(null);
  for (const x of s.games) if (x.visitor === team || x.home === team) out[x.week] = { opp: opponentIn(x, team), home: x.home === team };
  return out;
}

export interface ScheduleCheck {
  /** Teams without exactly one game a week (should never happen). */
  broken: string[];
  /** Pairs playing twice. */
  repeats: [number, number][];
  /** Protected rivalries not on the schedule. */
  missing: [number, number][];
  /** Per team: conference games and home games. */
  confGames: number[];
  homeGames: number[];
}

export function checkSchedule(s: DSchedule, schools: string[], conf: number[]): ScheduleCheck {
  const n = schools.length;
  const count = Array.from({ length: SCHED_WEEKS }, () => new Int16Array(n));
  const met = new Map<number, number>();
  const confGames = new Array<number>(n).fill(0), homeGames = new Array<number>(n).fill(0);
  for (const x of s.games) {
    count[x.week][x.visitor]++; count[x.week][x.home]++;
    met.set(key(x.visitor, x.home), (met.get(key(x.visitor, x.home)) ?? 0) + 1);
    homeGames[x.home]++;
    if (conf[x.visitor] === conf[x.home] && conf[x.home] !== INDEPENDENT) { confGames[x.visitor]++; confGames[x.home]++; }
  }
  const broken: string[] = [];
  for (let w = 0; w < SCHED_WEEKS; w++) for (let t = 0; t < n; t++) if (count[w][t] !== 1) broken.push(`${schools[t]} has ${count[w][t]} games in week ${w + 1}`);
  const repeats = [...met].filter(([, c]) => c > 1).map(([k]) => [Math.floor(k / 1000), k % 1000] as [number, number]);
  const missing = protectedPairs(schools).filter((p) => !met.has(key(p.a, p.b))).map((p) => [p.a, p.b] as [number, number]);
  return { broken, repeats, missing, confGames, homeGames };
}

// ---- the ROM's copy

/**
 * The schedule set for the dynasty area ("SCH1"; the ROM reads it at New Season instead of making one):
 * "SCH1", weeks (byte), then per week a game count (byte) and visitor/home team bytes, as the ROM's
 * real 2026 table (REALTAB).
 */
export function scheduleSet(s: DSchedule): Uint8Array {
  const out: number[] = [0x53, 0x43, 0x48, 0x31, SCHED_WEEKS];
  for (let w = 0; w < SCHED_WEEKS; w++) {
    const games = s.games.filter((x) => x.week === w);
    out.push(games.length);
    for (const x of games) out.push(x.visitor, x.home);
  }
  return new Uint8Array(out);
}

// ---- the dynasty's current season

import type { DSeason, Dynasty } from './model';

/** Why the season's schedule can't be changed now, or null. */
export function scheduleLock(s: DSeason): string | null {
  if (!s.schedule) return 'The first season plays the schedule chosen in the game (Real 2026 or Random).';
  if (s.imports.length) return 'The season has started: its schedule is set.';
  return null;
}

/** Applies a change to the newest season's schedule; after a ROM download the ROM has to be written again. */
export function editSchedule(d: Dynasty, change: (s: DSchedule) => DSchedule): Dynasty {
  const s = d.seasons[d.seasons.length - 1];
  const lock = scheduleLock(s);
  if (lock) throw new Error(lock);
  const next = change(s.schedule!);
  if (next === s.schedule) return d;
  const season: DSeason = {
    ...s, schedule: next,
    ...(s.romDownloaded ? { lineupEdited: true, rosterVersion: s.lineupEdited ? s.rosterVersion ?? 1 : (s.rosterVersion ?? 1) + 1 } : {}),
  };
  return { ...d, seasons: [...d.seasons.slice(0, -1), season] };
}

/** A season's regular-season games as played (for the next schedule's home and away). */
export function lastGames(d: Dynasty, season: DSeason): { visitor: number; home: number }[] {
  const v = seasonView(d, season);
  if (!v.save) return season.schedule?.games ?? [];
  return v.games.filter((g) => g.week <= v.lastRegularWeek && g.visitor !== null && g.home !== null).map((g) => ({ visitor: g.visitor!, home: g.home! }));
}

/** A new schedule for the newest season (everyone's games change; the user's edits are gone). */
export function remakeSchedule(d: Dynasty, seed: number): Dynasty {
  const s = d.seasons[d.seasons.length - 1];
  const prev = d.seasons[d.seasons.length - 2];
  return editSchedule(d, () => makeSchedule({
    schools: d.teams.map((t) => t.school),
    conf: s.conf,
    confWeeks: s.confWeeks ?? RELEASE_CONF_WEEKS,
    last: prev ? lastGames(d, prev) : undefined,
    seed,
  }));
}
