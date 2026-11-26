// Dynasty schedules from the second season on (user, 2026-11-12: "Generate each year, and then the user can
// edit … Basically use same rules"; "I would like to be able to edit conference games too"; "let's keep
// protected rivalries"). Pure functions.
//
// The game's Random schedule (the season engine's GEN): 12 weeks (the 1994 Season Edition: 11), every team plays every week;
// each conference plays its conference games (the ROM's count, CWN) in the weeks from its first conference
// week (CWS) on, as circle-method rounds of a shuffled order; every team without a conference game that week
// is paired at random, another conference first, no repeat games. The app does the same, and first makes sure
// the protected rivalries (rivalries.ts) are in: inside a conference by picking rounds that hold them, across
// conferences in a week both teams are free; the season finales go in the last week.

import { INDEPENDENT, seasonView } from './derive';
import type { EditionId } from './edition';
import { canonicalSchool, defaultRivalries, type Rivalry } from './rivalries';

/** Weeks of a 2026 schedule (and of every schedule made before the 1994 edition). */
export const SCHED_WEEKS = 12;
/** A schedule's regular-season weeks. */
export const weeksOf = (s: Pick<DSchedule, 'weeks'> | undefined) => s?.weeks ?? SCHED_WEEKS;

/** A game: week (0-based, like the save), visitor, home. */
export interface SchedGame { week: number; visitor: number; home: number }
export interface DSchedule {
  games: SchedGame[];
  /** Regular-season weeks (absent = 12; the 1994 Season Edition has 11). */
  weeks?: number;
  /** The seed it was made from ("Make a new schedule" picks another). */
  seed: number;
  /** A user changed it (any team's games). */
  edited?: boolean;
  /** The ROM's real schedule (REALTAB; setup, user 2026-11-20), teams moved with conference swaps: weeks 14, byes. */
  real?: boolean;
  /**
   * A light Week 0 before the app's 12 (1994: 11) weeks (user, 2026-11-26: "make week 0 a light week (not a lot of
   * games) like it is IRL"): about 8 (1994: 4) non-conference games moved there; their teams have a bye in the week the
   * game left, so every team still plays 12 (11). weeks counts Week 0. Rivalries' wanted weeks are a week later.
   */
  week0?: boolean;
  /**
   * The season's named opening games (user, 2026-11-26): the 1994 edition's **Kickoff Classic** in Week 0 (1983-2002 at
   * Giants Stadium) and the 2026 edition's **Aflac Kickoff Game** in Week 1 (Atlanta, Labor Day weekend: SEC against ACC,
   * now and then another conference; one a season). Like the real ones, usually a strong team against an average one. The game gives one of the two home field; the app names it on Scores and in the headlines.
   */
  kickoffs?: { name: string; week: number; visitor: number; home: number }[];
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
  /** Regular-season weeks (default 12). */
  weeks?: number;
  /** Whose protected rivalries (default the 2026 list). */
  edition?: EditionId;
  /** The dynasty's own rivalries (default: the edition's built-in list). */
  rivalries?: Rivalry[];
  /**
   * A conference played in divisions (the 1994 SEC divisions, `divisionsOf`): every team plays its whole division,
   * then the other division's teams for the rest of its conference games (user, 2026-11-20).
   */
  divisions?: { conf: number; east: number[]; west: number[] } | null;
  /** For the named opening game (DSchedule.kickoffs): each team's strength (prestige stars) and the conference names.
   *  Without them, there's none. */
  strength?: number[];
  confNames?: string[];
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

/** Regular-season weeks of an edition's dynasty schedules (12; 1994: 11). */
const weeksFor = (edition?: EditionId) => (edition === '1994' ? 11 : SCHED_WEEKS);

/** A dynasty's protected rivalries: its own list (user-defined), else the edition's built-in one. */
export function rivalriesOf(d: Dynasty): Rivalry[] {
  return d.rivalries ?? defaultRivalries(d.edition === '1994' ? '1994' : 'default', weeksFor(d.edition));
}

/**
 * The protected rivalries as team pairs (pairs whose schools aren't in the league are left out), each with the
 * week it should be in (null: any week). `list` is the dynasty's own; without it, the edition's built-in list.
 */
export function protectedPairs(schools: string[], edition?: EditionId, list?: Rivalry[]): { a: number; b: number; week: number | null }[] {
  const at = new Map(schools.flatMap((s, i) => [[s, i], [canonicalSchool(s), i]] as [string, number][]));
  return (list ?? defaultRivalries(edition === '1994' ? '1994' : 'default', weeksFor(edition))).flatMap((p) => {
    const a = at.get(p.a), b = at.get(p.b);
    return a === undefined || b === undefined || a === b ? [] : [{ a, b, week: p.week ?? null }];
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

/**
 * A divided conference's rounds: first the division rounds (both divisions' round robins side by side), then the
 * cross rounds (each East team against a different West team every round). Together they hold every pair once.
 */
function divisionRounds(east: number[], west: number[]): { rs: [number, number][][]; forced: number[] } {
  const re = rounds(east), rw = rounds(west);
  const div = re.map((rd, i) => [...rd, ...rw[i]]);
  const cross = west.map((_, k) => east.map((e, i) => [e, west[(i + k) % west.length]] as [number, number]));
  return { rs: [...div, ...cross], forced: div.map((_, i) => i) };
}

/** The working grid: opponent of each team in each week (-1 = none yet). */
class Grid {
  opp: Int16Array[];
  met = new Map<number, number>();
  constructor(n: number, readonly weeks: number) { this.opp = Array.from({ length: weeks }, () => new Int16Array(n).fill(-1)); }
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
  weekOf(a: number, b: number) { for (let w = 0; w < this.weeks; w++) if (this.opp[w][a] === b) return w; return -1; }
}

/** A new regular season for every team. */
export function makeSchedule(inp: ScheduleInput): DSchedule {
  const n = inp.schools.length;
  const r = rand(inp.seed);
  const WEEKS = inp.weeks ?? SCHED_WEEKS;
  const g = new Grid(n, WEEKS);
  const last = WEEKS - 1;
  const prot = protectedPairs(inp.schools, inp.edition, inp.rivalries).map((p) => ({ ...p, week: p.week !== null && p.week < WEEKS ? p.week : null }));
  const isLast = (p: { week: number | null }) => p.week === last;
  const sameConf = (a: number, b: number) => inp.conf[a] === inp.conf[b] && inp.conf[a] !== INDEPENDENT;

  // 1. Conference games: rounds that hold the conference's protected games, the finale's round last.
  for (let c = 0; c < INDEPENDENT; c++) {
    const teams = inp.conf.map((x, t) => (x === c ? t : -1)).filter((t) => t >= 0);
    if (teams.length < 2) continue;
    const all = rounds(teams).length;
    const start = Math.min(inp.confWeeks.start[c] ?? 3, last);
    const games = Math.max(0, Math.min(inp.confWeeks.games[c] ?? 8, all, WEEKS - start));
    if (!games) continue;
    const mine = prot.filter((p) => inp.conf[p.a] === c && inp.conf[p.b] === c);
    const div = inp.divisions && inp.divisions.conf === c ? inp.divisions : null;
    const make = () => div
      ? divisionRounds(shuffle(div.east.slice(), r), shuffle(div.west.slice(), r))
      : { rs: rounds(shuffle(teams.slice(), r)), forced: [] as number[] };
    let best: { order: [number, number][][]; score: number } | null = null;
    for (let tries = 0; tries < 400 && (!best || best.score > 0); tries++) {
      const { rs, forced } = make();
      const roundOf = (p: { a: number; b: number }) => rs.findIndex((rd) => rd.some(([x, y]) => key(x, y) === key(p.a, p.b)));
      // Division rounds first (the whole division), then the rounds that hold protected games.
      let need = [...new Set([...forced, ...mine.map(roundOf)])];
      if (need.length > games) {
        if (!div) continue;
        need = need.slice(0, games);
      }
      const others = shuffle(rs.map((_, i) => i).filter((i) => !need.includes(i)), r).slice(0, games - need.length);
      const pick = shuffle([...need, ...others], r);
      // The finale's round goes last (the one with the most finales).
      const finales = (i: number) => mine.filter((p) => isLast(p) && roundOf(p) === i).length;
      if (start + games - 1 === last) pick.sort((x, y) => finales(x) - finales(y));
      const score = start + games - 1 === last ? mine.filter(isLast).length - finales(pick[pick.length - 1]) : 0;
      if (!best || score < best.score) best = { order: pick.map((i) => rs[i]), score };
    }
    if (!best) {
      // No order holds every protected game: plain rounds (the missing ones are placed below where they fit).
      const { rs } = make();
      best = { order: rs.slice(0, games), score: 0 };
    }
    best.order.forEach((rd, i) => rd.forEach(([a, b]) => g.add(start + i, a, b)));
  }

  // 2. Rivalries with a week (the finales, and any week the user picked) into that week: when one isn't there,
  //    the two teams leave their games that week (those games move to a week where both teams are free).
  //    A team in two rivalries for the same week keeps the later one; the other is placed below.
  const moved: [number, number][] = [];
  for (const p of prot.filter((x) => x.week !== null)) {
    const w = p.week!;
    if (g.opp[w][p.a] === p.b) continue;
    const before = g.weekOf(p.a, p.b);
    if (before >= 0) g.remove(before, p.a);
    for (const t of [p.a, p.b]) {
      const o = g.remove(w, t);
      if (o >= 0) moved.push([t, o]);
    }
    g.add(w, p.a, p.b);
  }
  const placeAnywhere = (a: number, b: number, prefer: 'late' | 'any') => {
    const weeks = Array.from({ length: WEEKS }, (_, w) => w).filter((w) => g.free(w, a) && g.free(w, b));
    if (!weeks.length) return false;
    g.add(prefer === 'late' ? weeks[weeks.length - 1] : weeks[Math.floor(r() * weeks.length)], a, b);
    return true;
  };
  for (const [a, b] of moved) if (!g.met.has(key(a, b))) placeAnywhere(a, b, 'late');

  // 3. The other protected games not in yet (across conferences, or a conference that couldn't hold them).
  for (const p of prot) if (!g.met.has(key(p.a, p.b))) placeAnywhere(p.a, p.b, 'any');

  // 4. Everyone else, week by week: another conference first, then anyone new, then anyone (the game's passes).
  for (let w = 0; w < WEEKS; w++) {
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
  for (let w = 0; w < WEEKS; w++) for (let a = 0; a < n; a++) { const b = g.opp[w][a]; if (b > a) pairs.push({ week: w, a, b }); }
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
  return addWeekZero({ games, seed: inp.seed, weeks: WEEKS }, inp, isProt, r);
}

/** The conferences counted as power ones for Week 0 (its games lean to the others). */
const POWER = ['SEC', 'Big Ten', 'ACC', 'Big 12', 'Big Eight', 'Southwest', 'Pac-10', 'Big East'];

/** Week 0 (see DSchedule.week0) and the season's named opening game (DSchedule.kickoffs). */
function addWeekZero(s: DSchedule, inp: ScheduleInput, isProt: Set<number>, r: () => number): DSchedule {
  const W = weeksOf(s) + 1;
  const last = W - 1;
  const games = s.games.map((x) => ({ ...x, week: x.week + 1 }));
  const conf = inp.conf;
  const names = inp.confNames ?? [];
  const confsNamed = (list: string[]) => new Set(names.map((nm, c) => (list.includes(nm) ? c : -1)).filter((c) => c >= 0));
  const power = confsNamed(POWER);
  const nonConf = (x: SchedGame) => conf[x.visitor] !== conf[x.home] || conf[x.home] === INDEPENDENT;
  const movable = (x: SchedGame) => x.week >= 1 && x.week < last && nonConf(x) && !isProt.has(key(x.visitor, x.home));
  const met = new Set(games.map((x) => key(x.visitor, x.home)));
  const gameOf = (t: number, w: number) => games.find((x) => x.week === w && (x.visitor === t || x.home === t));
  const other = (x: SchedGame, t: number) => (x.visitor === t ? x.home : x.visitor);
  // A conference's teams, strongest first; its top n, or its top half.
  const ranked = (c: number) => conf.map((cc, t) => (cc === c ? t : -1)).filter((t) => t >= 0)
    .sort((a, b) => inp.strength![b] - inp.strength![a]);
  const topOf = (cs: Set<number>, n?: number) => [...cs].flatMap((c) => { const t = ranked(c); return t.slice(0, n ?? Math.ceil(t.length / 2)); });
  const zero = new Set<number>();
  const kickoffs: NonNullable<DSchedule['kickoffs']> = [];
  const site = (a: number, b: number) => (r() < 0.5 ? { visitor: a, home: b } : { visitor: b, home: a });

  if (inp.strength && names.length && inp.edition === '1994') {
    // The Kickoff Classic, Week 0: as in the real series, a headliner (a top-4 team in its conference) against a team
    // from the top half of another; one season in five, both just from the top half. Their games in one week give
    // way (their opponents play each other then), so they have that week off.
    const all = new Set(conf);
    const heads = shuffle(topOf(all, r() < 0.2 ? undefined : 4), r), opps = shuffle(topOf(all), r);
    search: for (const a of heads) for (const b of opps) {
      if (a === b || conf[a] === conf[b] || met.has(key(a, b))) continue;
      for (const w of shuffle(Array.from({ length: last - 1 }, (_, k) => k + 1), r)) {
        const ga = gameOf(a, w), gb = gameOf(b, w);
        if (!ga || !gb || ga === gb || !movable(ga) || !movable(gb)) continue;
        const x = other(ga, a), y = other(gb, b);
        if (x === y || met.has(key(x, y))) continue;
        games.splice(games.indexOf(ga), 1);
        games.splice(games.indexOf(gb), 1);
        games.push(ga.home === x ? { week: w, visitor: y, home: x } : { week: w, visitor: x, home: y });
        const k = { name: 'Kickoff Classic', week: 0, ...site(a, b) };
        games.push({ week: 0, visitor: k.visitor, home: k.home });
        kickoffs.push(k);
        zero.add(a).add(b);
        break search;
      }
    }
  }
  if (inp.strength && names.length && inp.edition !== '1994') {
    // The Aflac Kickoff Game, Week 1, one a season: as in the real series, a top-4 SEC team against a team from the
    // top half of the ACC (one season in five, of the Big Ten or Big 12); one season in five, the SEC team is just
    // from the top half too. Both teams' Week 1 games give way: their opponents play each other that week.
    const B = confsNamed(r() < 0.2 ? ['Big Ten', 'Big 12'] : ['ACC']);
    const A = shuffle(topOf(confsNamed(['SEC']), r() < 0.2 ? undefined : 4), r), Bt = shuffle(topOf(B), r);
    search: for (const a of A) for (const b of Bt) {
      const ga = gameOf(a, 1), gb = gameOf(b, 1);
      if (met.has(key(a, b)) || !ga || !gb || ga === gb || !movable(ga) || !movable(gb)) continue;
      const x = other(ga, a), y = other(gb, b);
      if (x === y || met.has(key(x, y))) continue;
      games.splice(games.indexOf(ga), 1);
      games.splice(games.indexOf(gb), 1);
      games.push(ga.home === x ? { week: 1, visitor: y, home: x } : { week: 1, visitor: x, home: y });
      const k = { name: 'Aflac Kickoff Game', week: 1, ...site(a, b) };
      games.push({ week: 1, visitor: k.visitor, home: k.home });
      kickoffs.push(k);
      break search;
    }
  }
  // Week 0's other games, mostly between teams outside the power conferences, one game a team; not the named game's.
  const named = new Set(kickoffs.flatMap((k) => [k.visitor, k.home]));
  let want = (inp.edition === '1994' ? 4 : 8) - kickoffs.filter((k) => k.week === 0).length;
  const pool = shuffle(games.filter((x) => movable(x) && !named.has(x.visitor) && !named.has(x.home)), r);
  const weight = (x: SchedGame) => 1 + (power.has(conf[x.visitor]) ? 0 : 2) + (power.has(conf[x.home]) ? 0 : 2);
  while (want > 0) {
    const open = pool.filter((x) => x.week > 0 && !zero.has(x.visitor) && !zero.has(x.home));
    if (!open.length) break;
    let pick = r() * open.reduce((a, x) => a + weight(x), 0);
    const x = open.find((y) => (pick -= weight(y)) < 0) ?? open[0];
    x.week = 0;
    zero.add(x.visitor).add(x.home);
    want--;
  }
  games.sort((x, y) => x.week - y.week || x.home - y.home);
  return { ...s, games, weeks: W, week0: true, ...(kickoffs.length ? { kickoffs } : {}) };
}

/** A game's name when it is the season's named opening game (DSchedule.kickoffs), else undefined. */
export function kickoffOf(season: { schedule?: DSchedule }, g: { week: number; visitor: number | null; home: number | null }) {
  return season.schedule?.kickoffs?.find((k) => k.week === g.week && g.visitor !== null && g.home !== null && key(k.visitor, k.home) === key(g.visitor, g.home));
}

// ---- reading and editing

/** Each week, each team's game (index into games), or -1. */
export function weekGrid(s: DSchedule, n: number): number[][] {
  const out = Array.from({ length: weeksOf(s) }, () => new Array<number>(n).fill(-1));
  s.games.forEach((x, i) => { out[x.week][x.visitor] = i; out[x.week][x.home] = i; });
  return out;
}

const opponentIn = (x: SchedGame, t: number) => (x.visitor === t ? x.home : x.visitor);

/**
 * Gives `team` a new opponent in a week (user, 2026-11-12: the user's teams only, conference games too).
 * His old opponent plays the new opponent's old opponent instead, so every team still plays once that week.
 * With a bye that week (an odd number of teams), the bye goes to whoever is left over.
 */
export function setOpponent(s: DSchedule, week: number, team: number, opp: number): DSchedule {
  if (opp === team) return s;
  const games = s.games.map((x) => ({ ...x }));
  const ia = games.findIndex((x) => x.week === week && (x.visitor === team || x.home === team));
  const ib = games.findIndex((x) => x.week === week && (x.visitor === opp || x.home === opp));
  if (ia >= 0 && ia === ib) return s;
  if (ia < 0 && ib < 0) return { ...s, games: [...games, { week, visitor: opp, home: team }], edited: true };
  if (ia < 0 || ib < 0) {
    // One of the two has the bye: the game that has the other one becomes team vs opp, its other team gets the bye.
    const k = ia < 0 ? ib : ia;
    const homeSide = games[k].home === (ia < 0 ? opp : team) ? (ia < 0 ? opp : team) : null;
    games[k] = homeSide === null ? { week, visitor: ia < 0 ? opp : team, home: ia < 0 ? team : opp } : { week, visitor: homeSide === team ? opp : team, home: homeSide };
    return { ...s, games, edited: true };
  }
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
  const out: ({ opp: number; home: boolean } | null)[] = new Array(weeksOf(s)).fill(null);
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
  /** Protected rivalries on the schedule but not in their week: [team, team, wanted week (0-based)]. */
  offWeek: [number, number, number][];
  /** Per team: conference games and home games. */
  confGames: number[];
  homeGames: number[];
}

export function checkSchedule(s: DSchedule, schools: string[], conf: number[], edition?: EditionId, rivalries?: Rivalry[]): ScheduleCheck {
  const n = schools.length;
  const count = Array.from({ length: weeksOf(s) }, () => new Int16Array(n));
  const met = new Map<number, number>();
  const confGames = new Array<number>(n).fill(0), homeGames = new Array<number>(n).fill(0);
  for (const x of s.games) {
    count[x.week][x.visitor]++; count[x.week][x.home]++;
    met.set(key(x.visitor, x.home), (met.get(key(x.visitor, x.home)) ?? 0) + 1);
    homeGames[x.home]++;
    if (conf[x.visitor] === conf[x.home] && conf[x.home] !== INDEPENDENT) { confGames[x.visitor]++; confGames[x.home]++; }
  }
  const broken: string[] = [];
  // Every team plays once a week; with an odd number of teams (the 1994 Season Edition's 107) one team a week has a bye.
  // Week 0 (week0): its teams have one bye later; nobody else plays then.
  const inZero = new Set(s.week0 ? s.games.filter((x) => x.week === 0).flatMap((x) => [x.visitor, x.home]) : []);
  for (let w = 0; w < weeksOf(s); w++) {
    const free: number[] = [];
    for (let t = 0; t < n; t++) {
      if (count[w][t] > 1) broken.push(`${schools[t]} has ${count[w][t]} games in week ${w}`);
      else if (!count[w][t] && !(s.week0 && (w === 0 || inZero.has(t)))) free.push(t);
    }
    // The real schedule has byes (teams play 10-12 games in 14 weeks).
    if (!s.real && free.length > n % 2) for (const t of free) broken.push(`${schools[t]} has no game in week ${w}`);
  }
  const repeats = [...met].filter(([, c]) => c > 1).map(([k]) => [Math.floor(k / 1000), k % 1000] as [number, number]);
  const prot = protectedPairs(schools, edition, rivalries);
  const missing = prot.filter((p) => !met.has(key(p.a, p.b))).map((p) => [p.a, p.b] as [number, number]);
  // A rivalry's wanted week counts the app's weeks without Week 0 (RivalriesEditor), so it's a week later with one.
  const at = (p: { week: number | null }) => (p.week === null ? null : p.week + (s.week0 ? 1 : 0));
  const offWeek = prot
    .filter((p) => at(p) !== null && at(p)! < weeksOf(s) && met.has(key(p.a, p.b)) && !s.games.some((x) => x.week === at(p) && key(x.visitor, x.home) === key(p.a, p.b)))
    .map((p) => [p.a, p.b, at(p)!] as [number, number, number]);
  return { broken, repeats, missing, offWeek, confGames, homeGames };
}

// ---- the real schedule (setup, user 2026-11-20: "a simple team swap … and then still be able to use the real 2026
// schedules (tulane and kentucky just swap schedules)")

/** The ROM's real schedule (REALTAB, read by REALGEN's `lea REALTAB(pc),a2` at 0x211528), or null if it isn't there. */
export function readRealSchedule(rom: Uint8Array, teams: number): DSchedule | null {
  const at = 0x211528;
  if (rom.length < at + 4 || rom[at] !== 0x45 || rom[at + 1] !== 0xfa) return null;
  const tab = at + 2 + ((rom[at + 2] << 24) >> 16 | rom[at + 3]);
  const weeks = rom[tab];
  if (!(weeks >= 1 && weeks <= 14)) return null;
  const games: SchedGame[] = [];
  let i = tab + 1;
  for (let w = 0; w < weeks; w++) {
    const n = rom[i++];
    for (let k = 0; k < n; k++, i += 2) {
      if (rom[i] >= teams || rom[i + 1] >= teams || i + 1 >= rom.length) return null;
      games.push({ week: w, visitor: rom[i], home: rom[i + 1] });
    }
  }
  return { games, weeks, seed: 0, real: true };
}

/**
 * Who takes whose schedule when conferences change (`from` → `to`, each team's conference): every team that leaves a
 * conference is replaced there by one that arrives, and the arriving team takes the leaving team's games. A team that
 * stays keeps its own. Null when a conference's number of teams changes (then the real schedule can't be used).
 * Returns m: m[t] = the team whose games t plays.
 */
export function swapPlan(from: number[], to: number[]): number[] | null {
  const n = from.length;
  const m = Array.from({ length: n }, (_, t) => t);
  const leave = new Map<number, number[]>(), arrive = new Map<number, number[]>();
  for (let t = 0; t < n; t++) {
    if (from[t] === to[t]) continue;
    leave.set(from[t], [...(leave.get(from[t]) ?? []), t]);
    arrive.set(to[t], [...(arrive.get(to[t]) ?? []), t]);
  }
  for (const c of new Set([...leave.keys(), ...arrive.keys()])) {
    const l = leave.get(c) ?? [], a = arrive.get(c) ?? [];
    if (l.length !== a.length) return null;
    a.forEach((t, i) => { m[t] = l[i]; });
  }
  return m;
}

/** A schedule with teams moved: team t plays the games team m[t] had. */
export function moveTeams(s: DSchedule, m: number[]): DSchedule {
  const inv = new Array<number>(m.length);
  m.forEach((src, t) => { inv[src] = t; });
  return { ...s, games: s.games.map((x) => ({ week: x.week, visitor: inv[x.visitor], home: inv[x.home] })) };
}

/** The real schedule for these conferences (the ROM's teams moved by swaps), or null if counts changed. */
export function realScheduleFor(rom: Uint8Array, romConf: number[], conf: number[]): DSchedule | null {
  const real = readRealSchedule(rom, conf.length);
  const m = real && swapPlan(romConf, conf);
  return real && m ? moveTeams(real, m) : null;
}

// ---- the ROM's copy

/**
 * The schedule set for the dynasty area ("SCH1"; the ROM reads it at New Season instead of making one):
 * "SCH1", weeks (byte), then per week a game count (byte) and visitor/home team bytes, as the ROM's
 * real 2026 table (REALTAB).
 */
export function scheduleSet(s: DSchedule): Uint8Array {
  const out: number[] = [0x53, 0x43, 0x48, 0x31, weeksOf(s)];
  for (let w = 0; w < weeksOf(s); w++) {
    const games = s.games.filter((x) => x.week === w);
    out.push(games.length);
    for (const x of games) out.push(x.visitor, x.home);
  }
  return new Uint8Array(out);
}

// ---- the dynasty's current season

import type { DSeason, Dynasty } from './model';
import { editionOf } from './edition';
import { divisionsOf, SEC_EAST_1994 } from '../seasonWide';
import { seasonPrestige } from './prestige';

/** A season's East list: its own, else the 1994 East schools (the ROM's list as released). */
export const seasonEast = (d: Dynasty, s: Pick<DSeason, 'secEast'>): number[] | null =>
  s.secEast !== undefined ? s.secEast : d.teams.filter((t) => SEC_EAST_1994.includes(t.school)).map((t) => t.index);

/** The divisions a season's schedule follows (1994 SEC divisions switched on, even halves), or null. */
export const seasonDivisions = (d: Dynasty, s: Pick<DSeason, 'conf' | 'titleGames' | 'secEast'>) =>
  editionOf(d).id === '1994' ? divisionsOf(s.conf, s.titleGames ?? editionOf(d).titleGames, seasonEast(d, s)) : null;

/** Why the season's schedule can't be changed now, or null. */
export function scheduleLock(s: DSeason): string | null {
  if (!s.schedule) return 'The first season plays the schedule the game makes at New Season.';
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
  const rivalries = rivalriesOf(d);
  const s = d.seasons[d.seasons.length - 1];
  const prev = d.seasons[d.seasons.length - 2];
  return editSchedule(d, () => makeSchedule({
    schools: d.teams.map((t) => t.school),
    conf: s.conf,
    confWeeks: s.confWeeks ?? RELEASE_CONF_WEEKS,
    last: prev ? lastGames(d, prev) : undefined,
    seed,
    weeks: editionOf(d).regWeeks,
    edition: editionOf(d).id,
    rivalries,
    divisions: seasonDivisions(d, s),
    strength: seasonPrestige(d, s),
    confNames: s.confNames,
  }));
}

/** Why this rivalry list can't be used; empty if it can. */
export function rivalryIssues(d: Dynasty, list: Rivalry[]): string[] {
  const schools = new Set(d.teams.map((t) => t.school));
  const weeks = editionOf(d).regWeeks;
  const out: string[] = [];
  const seen = new Set<string>();
  const inWeek = new Map<string, string>();
  list.forEach((r, i) => {
    const row = `Rivalry ${i + 1}`;
    if (!schools.has(r.a) || !schools.has(r.b)) { out.push(`${row}: pick two teams.`); return; }
    if (r.a === r.b) { out.push(`${row}: pick two different teams.`); return; }
    const k = [r.a, r.b].sort().join('|');
    if (seen.has(k)) out.push(`${r.a} and ${r.b} are listed twice.`);
    seen.add(k);
    if (r.week !== undefined) {
      if (!Number.isInteger(r.week) || r.week < 0 || r.week >= weeks) out.push(`${row}: the week must be 1 to ${weeks}.`);
      for (const t of [r.a, r.b]) {
        const other = inWeek.get(`${t}|${r.week}`);
        if (other) out.push(`${t} has two rivalries in week ${r.week + 1} (${other} and this one).`);
        inWeek.set(`${t}|${r.week}`, `${r.a}-${r.b}`);
      }
    }
  });
  return out;
}

/**
 * Sets the dynasty's protected rivalries (user, 2026-11-16). The newest season's schedule is made again with them
 * when it can still change (an offseason's new season before its first import); otherwise they apply from the next
 * season's schedule on. `null` goes back to the edition's built-in list.
 */
export function setRivalries(d: Dynasty, list: Rivalry[] | null): Dynasty {
  if (list) {
    const issues = rivalryIssues(d, list);
    if (issues.length) throw new Error(issues[0]);
  }
  const next: Dynasty = { ...d };
  if (list) next.rivalries = list.map((r) => ({ a: r.a, b: r.b, ...(r.week !== undefined ? { week: r.week } : {}) }));
  else delete next.rivalries;
  const s = d.seasons[d.seasons.length - 1];
  return rivalriesCanRemake(d) ? remakeSchedule(next, s.schedule!.seed) : next;
}

/** Whether saving rivalries makes the newest season's schedule again (else they apply from the next one). */
export const rivalriesCanRemake = (d: Dynasty) => {
  const s = d.seasons[d.seasons.length - 1];
  return (s.index > 0 || !!d.seasonOneRom) && !!s.schedule && !s.schedule.real && !scheduleLock(s);
};
