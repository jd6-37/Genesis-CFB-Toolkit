// The offseason between two dynasty seasons, as steps the app runs one after another (user's rules:
// 5-in-5 eligibility with SR+, juniors and seniors may go pro, transfer portal, random signing
// classes for now, cuts to the roster limit after signing day, then walk-ons and the depth chart).
//
//   startOffseason   departures (graduates, early pros, seniors back as SR+), classes move up,
//                    players develop toward their potential
//   runPortal        players without a spot enter the portal; teams with needs take them
//   runSigningDay    random signing classes by need and prestige (recruits made from the built-in
//                    CFB 27 freshmen as templates)
//   applyCuts        every team down to the roster limit (CPU automatically, user teams by choice),
//                    walk-ons for positions below their minimum
//   finishOffseason  depth chart through the Rosters tool's CFB 27 conversion, unique jersey
//                    numbers, the next season
//
// Pure functions: each returns a new dynasty. Randomness is seeded, so the same choices give the
// same offseason. The players before the offseason are kept so it can be started over.

import { CLASSES, rng, type ClassYear, type DPlayer, type DSeason, type Dynasty, type OffseasonEvent, type BwSlot } from './model';
import { seasonView } from './derive';
import { parseCsv, type Sheet } from '../rosterSheet';
import { convertCfb27 } from '../rosterCfb27';
import { fixChecksums, jerseyByte, openRosterRom, readPlayer, setRating, teamLayout, writePlayer } from '../rosterRom';
import { GROUP_ATTRS, GROUP_COLUMNS } from '../rosterLayouts';
import { hasOlPatch, OL_PATCH } from '../rosterOlPatch';
import CFB_OVR from './cfbOvr.json';
import { MAX_PRESTIGE, nextPrestige, seasonPrestige } from './prestige';
import { playerOvr } from './ovr';
import { ratingProblems, starterOvr, writeRating } from '../teamRatings';

export const ROSTER_LIMIT = 85;
export const CLASS_MAX = 25;
/** Walk-ons fill a team up to this many players. */
export const ROSTER_MIN = 65;
const CLASS_MIN = 3;

/** How many players a team wants at each position (adds up to 85). */
export const POS_TARGET: Record<string, number> = {
  QB: 4, HB: 6, FB: 1, WR: 10, TE: 4, LT: 3, LG: 3, C: 3, RG: 3, RT: 3,
  LE: 4, RE: 4, DT: 6, LOLB: 3, MLB: 4, ROLB: 3, CB: 9, FS: 4, SS: 4, K: 2, P: 2,
};
/** The fewest a team may have at each position (cuts stop there; walk-ons fill up to it). */
export const POS_MIN: Record<string, number> = {
  QB: 2, HB: 3, FB: 0, WR: 5, TE: 2, LT: 2, LG: 2, C: 2, RG: 2, RT: 2,
  LE: 2, RE: 2, DT: 3, LOLB: 1, MLB: 2, ROLB: 1, CB: 5, FS: 2, SS: 2, K: 1, P: 1,
};
export const POSITIONS = Object.keys(POS_TARGET);

export type OffseasonStep = 'portal' | 'recruiting' | 'signing' | 'cuts' | 'ready';

export interface OffseasonState {
  /** The season that just ended. */
  year: number;
  step: OffseasonStep;
  seed: number;
  /** The players as they were when the offseason started (to start it over). */
  before: DPlayer[];
  events: OffseasonEvent[];
  /** Development of every returning player: OVR before and after. */
  growth: { player: number; from: number; to: number }[];
  /** After signing day: the cuts suggested for each user team (the user can change them). */
  suggestedCuts?: Record<number, number[]>;
  /** Next season's prestige stars, set when the season ends (one star at most toward the final poll's tier). */
  prestige?: number[];
  /** 'random' signing classes (the default) or 'full' recruiting weeks. */
  mode?: 'random' | 'full';
  recruiting?: import('./recruiting').RecruitingState;
}

// ---- small helpers

type Rand = () => number;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const between = (r: Rand, lo: number, hi: number) => lo + (hi - lo) * r();
const pick = <T>(r: Rand, a: T[]): T => a[Math.floor(r() * a.length)];
/** Normal(0, 1) by Box-Muller. */
const gauss = (r: Rand) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const stepRand = (st: { seed: number }, salt: number) => rng((st.seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0);

const FORMULAS = (CFB_OVR as { positions: Record<string, { base: number; weights: Record<string, number> }> }).positions;

/** A CFB 27-style Overall from a player's ratings (fitted to the built-in ratings; within 1 for most players). */
export function cfbOvr(d: Pick<Dynasty, 'attrKeys'>, pos: string, attrs: number[]): number {
  const f = FORMULAS[pos];
  if (!f) return 0;
  let v = f.base;
  for (const [k, w] of Object.entries(f.weights)) {
    const i = d.attrKeys.indexOf(k);
    if (i >= 0) v += w * attrs[i];
  }
  return clamp(Math.round(v), 0, 99);
}

/** Ratings that don't grow much with training. */
const PHYSICAL = new Set(['Speed', 'Acceleration', 'Agility', 'Change of Direction', 'Jumping']);

const active = (d: Dynasty) => d.players.filter((p) => p.status === 'active' && p.team !== null);
const lastSeason = (d: Dynasty) => d.seasons[d.seasons.length - 1];

/** Potential for a player who has none yet: more room the younger he is. */
function givePotential(p: DPlayer, r: Rand): number {
  const gap: Record<ClassYear, [number, number]> = { FR: [6, 18], SO: [4, 14], JR: [2, 9], SR: [0, 5], 'SR+': [0, 3] };
  const [lo, hi] = gap[p.cls];
  return clamp(Math.round(p.ovr + between(r, lo, hi)), p.ovr, 99);
}

/** A school's prestige stars now: the offseason's new stars once it has started, else the season's. */
export function prestigeStars(d: Dynasty, team: number): number {
  return d.offseason?.prestige?.[team] ?? seasonPrestige(d, lastSeason(d))[team];
}

/** A team's standing for recruiting and the portal, 0-1, from its prestige stars (1-6). */
export function prestige(d: Dynasty, team: number): number {
  return (prestigeStars(d, team) - 1) / (MAX_PRESTIGE - 1);
}

/** Whether the season can end: every game played (or the user forces it). */
export function seasonDone(d: Dynasty): boolean {
  return seasonView(d, lastSeason(d)).done;
}

// ---- 1. departures, classes, development

/** Grows a player toward his potential: the gain goes to the ratings his position's Overall counts. */
function develop(d: Dynasty, p: DPlayer, gain: number, r: Rand): DPlayer {
  const f = FORMULAS[p.pos];
  if (!f || Math.abs(gain) < 0.5) return p;
  const keys = Object.entries(f.weights).filter(([, w]) => w > 0);
  const sum = keys.reduce((a, [, w]) => a + w, 0);
  if (sum <= 0) return p;
  const attrs = p.attrs.slice();
  const per = gain / sum;
  for (const [k] of keys) {
    const i = d.attrKeys.indexOf(k);
    if (i < 0) continue;
    const slow = PHYSICAL.has(k) ? 0.4 : 1;
    attrs[i] = clamp(Math.round(attrs[i] + per * slow * between(r, 0.6, 1.4)), 0, 99);
  }
  // Keep his own offset from the formula (CFB 27's Overall isn't exactly linear, e.g. QB archetypes).
  return { ...p, attrs, ovr: clamp(p.ovr + cfbOvr(d, p.pos, attrs) - cfbOvr(d, p.pos, p.attrs), 0, 99) };
}

/** How much of the room to his potential a player closes in one offseason, by the class he's leaving. */
const GROWTH_RATE: Record<ClassYear, number> = { FR: 0.45, SO: 0.4, JR: 0.35, SR: 0.3, 'SR+': 0.25 };

/**
 * Ends the season: SR+ leave; seniors go pro, come back as SR+ or graduate; juniors may go pro; the
 * others move up a class and develop. Then the transfer portal is next.
 */
export function startOffseason(d: Dynasty, opt: { seed?: number; force?: boolean } = {}): Dynasty {
  if (d.offseason) throw new Error('The offseason has already started.');
  if (!opt.force && !seasonDone(d)) throw new Error('The season isn\'t over yet: import the save after the last game first.');
  const year = lastSeason(d).year;
  const st: OffseasonState = { year, step: 'portal', seed: opt.seed ?? (Date.now() >>> 0), before: d.players, events: [], growth: [] };
  // Prestige: one star toward the tier of the final poll place (no change without a save).
  const v = seasonView(d, lastSeason(d));
  const was = seasonPrestige(d, lastSeason(d));
  st.prestige = was.map((stars, t) => (v.save ? nextPrestige(stars, v.rank[t]) : stars));
  st.prestige.forEach((to, t) => { if (to !== was[t]) st.events.push({ kind: 'prestige', team: t, from: was[t], to, finalRank: v.rank[t] }); });
  const r = stepRand(st, 1);
  const inGame = new Set(lastSeason(d).slots.flat().filter((x): x is number => x !== null));
  const players = d.players.map((p0) => {
    if (p0.status !== 'active' || p0.team === null) return p0;
    let p = p0.pot === undefined ? { ...p0, pot: givePotential(p0, r) } : p0;
    const team = p.team!;
    const leave = (kind: 'graduated' | 'pro'): DPlayer => {
      st.events.push({ kind, player: p.id, team, ovr: p.ovr });
      return { ...p, status: kind === 'pro' ? 'pro' : 'graduated', team: null, leftYear: year };
    };
    if (p.cls === 'SR+') return leave('graduated');
    if (p.cls === 'SR') {
      if (r() < clamp((p.ovr - 80) / 14, 0, 0.85)) return leave('pro');
      if (r() < 0.3) st.events.push({ kind: 'returns', player: p.id, team, ovr: p.ovr });
      else return leave('graduated');
    }
    if (p.cls === 'JR' && r() < clamp((p.ovr - 84) / 12, 0, 0.7)) return leave('pro');
    // Moves up a class and develops.
    const from = p.ovr;
    const room = (p.pot ?? p.ovr) - p.ovr;
    const gain = room * GROWTH_RATE[p.cls] * between(r, 0.5, 1.5) + (inGame.has(p.id) ? 1 : 0) + gauss(r);
    p = develop(d, { ...p, cls: CLASSES[Math.min(4, CLASSES.indexOf(p.cls) + 1)] }, gain, r);
    if (p.ovr > (p.pot ?? 99)) p = { ...p, pot: p.ovr };
    st.growth.push({ player: p.id, from, to: p.ovr });
    return p;
  });
  return { ...d, players, offseason: st };
}

/** Starts the offseason over (the players as they were before it). */
export function cancelOffseason(d: Dynasty): Dynasty {
  if (!d.offseason) return d;
  return { ...d, players: d.offseason.before, offseason: undefined };
}

// ---- 2. transfer portal

const countBy = (ps: DPlayer[], team: number) => {
  const m: Record<string, number> = {};
  for (const p of ps) if (p.team === team) m[p.pos] = (m[p.pos] ?? 0) + 1;
  return m;
};

/** How badly a team needs a position: target minus what it has (negative = too many). */
const need = (counts: Record<string, number>, pos: string) => (POS_TARGET[pos] ?? 0) - (counts[pos] ?? 0);

/**
 * Players who didn't have one of their team's 32 spots may enter the portal (good players stuck
 * behind a starter more often); teams that need the position take them, the best players first.
 * Players nobody takes leave the dynasty (they transfer down).
 */
export function runPortal(d: Dynasty): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'portal') throw new Error('The transfer portal comes after the season ends.');
  const r = stepRand(st, 2);
  const season = lastSeason(d);
  const inGame = new Set(season.slots.flat().filter((x): x is number => x !== null));
  let players = d.players.slice();
  const byTeam = new Map<number, DPlayer[]>();
  for (const p of players) if (p.status === 'active' && p.team !== null) byTeam.set(p.team, [...(byTeam.get(p.team) ?? []), p]);

  // Who enters.
  const entries: DPlayer[] = [];
  for (const roster of byTeam.values()) {
    for (const p of roster) {
      if (inGame.has(p.id) || p.recruit?.year === st.year + 1) continue;
      const better = roster.filter((x) => x.pos === p.pos && x.ovr > p.ovr).length;
      const blocked = p.ovr >= 72 && better <= 2 ? 0.18 : 0;
      const buried = better >= 4 ? 0.05 : 0;
      if (r() < 0.04 + blocked + buried) entries.push(p);
    }
  }
  entries.sort((a, b) => b.ovr - a.ovr || a.id - b.id);

  // Where they go: teams that need the position, the better programs first in line.
  const pres = new Map(d.teams.map((t) => [t.index, prestige(d, t.index)]));
  const took = new Map<number, number>();
  const counts = new Map(d.teams.map((t) => [t.index, countBy(players, t.index)]));
  const events: OffseasonEvent[] = [];
  const moved = new Map<number, number | null>();
  for (const p of entries) {
    const from = p.team!;
    const fits = d.teams
      .map((t) => t.index)
      .filter((t) => t !== from && (took.get(t) ?? 0) < 4 && need(counts.get(t)!, p.pos) > 0)
      .map((t) => ({ t, w: need(counts.get(t)!, p.pos) * (0.5 + pres.get(t)!) * between(r, 0.5, 1.5) * (p.ovr >= 78 ? 0.5 + pres.get(t)! : 1) }))
      .sort((a, b) => b.w - a.w);
    const to = fits.length ? fits[0].t : null;
    moved.set(p.id, to);
    counts.get(from)![p.pos]--;
    if (to !== null) {
      counts.get(to)![p.pos] = (counts.get(to)![p.pos] ?? 0) + 1;
      took.set(to, (took.get(to) ?? 0) + 1);
    }
    events.push({ kind: 'transfer', player: p.id, from, to, ovr: p.ovr });
  }
  players = players.map((p) => {
    if (!moved.has(p.id)) return p;
    const to = moved.get(p.id)!;
    const transfers = [...(p.transfers ?? []), { year: st.year, from: p.team!, to }];
    return to === null ? { ...p, team: null, status: 'transferred' as const, leftYear: st.year, transfers } : { ...p, team: to, transfers };
  });
  return { ...d, players, offseason: { ...st, step: 'signing', events: [...st.events, ...events] } };
}

// ---- 3. signing day (random classes)

export interface RecruitTemplates {
  /** Freshmen of each position from the built-in CFB 27 ratings, as rating arrays in attrKeys order, lowest Overall first. */
  byPos: Record<string, { attrs: number[]; ovr: number; heightIn: number; weight: number }[]>;
  firstNames: string[];
  lastNames: string[];
  towns: { hometown: string; state: string }[];
}

/** Recruit templates from the built-in CFB 27 ratings CSV (its freshmen, names and hometowns). */
export function recruitTemplates(d: Pick<Dynasty, 'attrKeys'>, csvText: string): RecruitTemplates {
  const sheet: Sheet = parseCsv(csvText);
  const H = (n: string) => sheet.headers.indexOf(n);
  const [cPos, cOvr, cCls, cFirst, cLast, cTown, cState, cH, cW] =
    ['Position', 'Overall', 'Class', 'First Name', 'Last Name', 'Hometown', 'Home State', 'Height (in)', 'Weight'].map(H);
  const ks = d.attrKeys.map(H);
  const byPos: RecruitTemplates['byPos'] = {};
  const first = new Set<string>(), last = new Set<string>();
  const towns: RecruitTemplates['towns'] = [];
  for (const row of sheet.rows) {
    const pos = row[cPos].trim().replace(/^LEDG$/, 'LE').replace(/^REDG$/, 'RE');
    if (row[cFirst]?.trim()) first.add(row[cFirst].trim());
    if (row[cLast]?.trim()) last.add(row[cLast].trim());
    // Hometowns in the US (CFB 27 writes "Non-US" as the state of the others).
    if (row[cTown]?.trim() && row[cState]?.trim() && row[cState].trim() !== 'Non-US') towns.push({ hometown: row[cTown].trim(), state: row[cState].trim() });
    if (!/^freshman$/i.test(row[cCls]?.trim() ?? '')) continue;
    (byPos[pos] ??= []).push({ attrs: ks.map((k) => Number(row[k]) || 0), ovr: Number(row[cOvr]) || 0, heightIn: Number(row[cH]) || 72, weight: Number(row[cW]) || 200 });
  }
  for (const list of Object.values(byPos)) list.sort((a, b) => a.ovr - b.ovr);
  return { byPos, firstNames: [...first].sort(), lastNames: [...last].sort(), towns };
}

/** Where in the freshmen of a position a recruit of each star rating comes from (Overall percentile). */
const STAR_BAND: Record<number, [number, number]> = { 5: [0.97, 1], 4: [0.8, 0.97], 3: [0.35, 0.8], 2: [0.05, 0.35], 1: [0, 0.05], 0: [0, 0.08] };
/** Potential range by stars (walk-ons 0). */
const STAR_POT: Record<number, [number, number]> = { 5: [86, 99], 4: [80, 93], 3: [72, 86], 2: [65, 79], 1: [58, 72], 0: [55, 70] };

/** Stars for one recruit of a program with this prestige (0-1). */
export function drawStars(r: Rand, pres: number): number {
  const w = [0.12 * (1 - pres), 0.38 * (1 - pres) + 0.05, 0.42, 0.06 + 0.42 * pres, 0.005 + 0.12 * pres * pres]; // 1★ … 5★
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) if ((x -= w[i]) <= 0) return i + 1;
  return 3;
}

/** One new player made from a CFB 27 freshman of the position, with fresh ratings, name and hometown. */
export function makeRecruit(d: Dynasty, tpl: RecruitTemplates, r: Rand, id: number, team: number, pos: string, stars: number, year: number): DPlayer {
  const pool = tpl.byPos[pos] ?? tpl.byPos.WR;
  const [lo, hi] = STAR_BAND[stars];
  const t = pool[Math.min(pool.length - 1, Math.floor(between(r, lo, hi) * pool.length))];
  const attrs = t.attrs.map((a) => (a === 0 ? 0 : clamp(Math.round(a + 3 * gauss(r)), 1, 99)));
  const ovr = cfbOvr(d, pos, attrs);
  const [plo, phi] = STAR_POT[stars];
  const town = pick(r, tpl.towns);
  return {
    id, first: pick(r, tpl.firstNames), last: pick(r, tpl.lastNames), pos, team, cls: 'FR', jersey: 0,
    heightIn: clamp(Math.round(t.heightIn + gauss(r)), 64, 82), weight: clamp(Math.round(t.weight + 6 * gauss(r)), 150, 380),
    hometown: town.hometown, state: town.state, ovr, attrs, skin: Math.floor(r() * 5), status: 'active',
    pot: clamp(Math.round(between(r, plo, phi)), ovr + 3, 99), recruit: { stars, year },
  };
}

/** Class points for rankings: 5★ 100, 4★ 60, 3★ 30, 2★ 12, 1★ 4. */
export const STAR_POINTS = [0, 4, 12, 30, 60, 100];

/**
 * Every team signs a class: as many as it has open spots (at most 25, at least 3, and a few more
 * for strong programs, who cut later), position by position where the need is biggest, stars by
 * the program's prestige.
 */
export function runSigningDay(d: Dynasty, tpl: RecruitTemplates): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'signing') throw new Error('Signing day comes after the transfer portal.');
  const r = stepRand(st, 3);
  const players = d.players.slice();
  let nextId = players.reduce((a, p) => Math.max(a, p.id), 0) + 1;
  const events: OffseasonEvent[] = [];
  const classes: { team: number; points: number; signed: number }[] = [];
  for (const t of d.teams) {
    const pres = prestige(d, t.index);
    const counts = countBy(players, t.index);
    const roster = Object.values(counts).reduce((a, b) => a + b, 0);
    const over = r() < 0.3 + 0.5 * pres ? Math.floor(between(r, 1, 4)) : 0;
    const n = clamp(ROSTER_LIMIT - roster, CLASS_MIN, CLASS_MAX) + (ROSTER_LIMIT - roster >= CLASS_MAX ? 0 : over);
    let points = 0;
    for (let k = 0; k < Math.min(n, CLASS_MAX); k++) {
      // The biggest need (ties at random).
      const pos = POSITIONS.map((p) => ({ p, g: need(counts, p) + r() * 0.9 })).sort((a, b) => b.g - a.g)[0].p;
      const stars = drawStars(r, pres);
      const rec = makeRecruit(d, tpl, r, nextId++, t.index, pos, stars, st.year + 1);
      players.push(rec);
      counts[pos] = (counts[pos] ?? 0) + 1;
      points += STAR_POINTS[stars];
      events.push({ kind: 'signed', player: rec.id, team: t.index, stars, ovr: rec.ovr });
    }
    classes.push({ team: t.index, points, signed: Math.min(n, CLASS_MAX) });
  }
  classes.sort((a, b) => b.points - a.points || a.team - b.team);
  classes.forEach((c, i) => events.push({ kind: 'class', team: c.team, rank: i + 1, signed: c.signed, points: c.points }));
  const next: Dynasty = { ...d, players, offseason: { ...st, step: 'cuts', events: [...st.events, ...events] } };
  const suggestedCuts: Record<number, number[]> = {};
  for (const t of d.userTeams) suggestedCuts[t] = suggestCuts(next, t);
  return { ...next, offseason: { ...next.offseason!, suggestedCuts } };
}

// ---- 4. cuts and walk-ons

/** What a player is worth to his team when it has to cut: rating now, room to grow, years left. */
export function keepValue(p: DPlayer): number {
  const yearsLeft = { FR: 3, SO: 2, JR: 1, SR: 0.5, 'SR+': 0 }[p.cls];
  return p.ovr + 0.5 * Math.max(0, (p.pot ?? p.ovr) - p.ovr) + yearsLeft;
}

/** The players a team should cut to get to the roster limit: lowest value first, never below a position's minimum. */
export function suggestCuts(d: Dynasty, team: number): number[] {
  const roster = active(d).filter((p) => p.team === team);
  const extra = roster.length - ROSTER_LIMIT;
  if (extra <= 0) return [];
  const counts = countBy(roster, team);
  const out: number[] = [];
  for (const p of roster.slice().sort((a, b) => keepValue(a) - keepValue(b) || b.id - a.id)) {
    if (out.length >= extra) break;
    if ((counts[p.pos] ?? 0) <= (POS_MIN[p.pos] ?? 0)) continue;
    counts[p.pos]--;
    out.push(p.id);
  }
  return out;
}

/** Why a set of cuts can't be used for a team (empty when it can). */
export function cutProblems(d: Dynasty, team: number, cuts: number[]): string[] {
  const roster = active(d).filter((p) => p.team === team);
  const ids = new Set(roster.map((p) => p.id));
  const out: string[] = [];
  if (cuts.some((c) => !ids.has(c))) out.push('Some of the players aren\'t on the team.');
  const left = roster.length - new Set(cuts).size;
  if (left > ROSTER_LIMIT) out.push(`${left} players are still too many: cut ${left - ROSTER_LIMIT} more (the limit is ${ROSTER_LIMIT}).`);
  return out;
}

/**
 * Cuts every team to the roster limit (user teams: their own list, or the suggestion), then adds
 * walk-ons where a position is below its minimum. Cut players leave the dynasty.
 */
export function applyCuts(d: Dynasty, userCuts: Record<number, number[]> = {}, tpl?: RecruitTemplates): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'cuts') throw new Error('Cuts come after signing day.');
  for (const [t, c] of Object.entries(userCuts)) {
    const p = cutProblems(d, Number(t), c);
    if (p.length) throw new Error(`${d.teams[Number(t)].school}: ${p.join(' ')}`);
  }
  const r = stepRand(st, 4);
  const cut = new Set<number>();
  for (const t of d.teams) {
    const list = d.userTeams.includes(t.index) ? (userCuts[t.index] ?? st.suggestedCuts?.[t.index] ?? suggestCuts(d, t.index)) : suggestCuts(d, t.index);
    list.forEach((id) => cut.add(id));
  }
  const events: OffseasonEvent[] = [];
  let players = d.players.map((p) => {
    if (!cut.has(p.id)) return p;
    events.push({ kind: 'cut', player: p.id, team: p.team!, ovr: p.ovr });
    return { ...p, status: 'cut' as const, team: null, leftYear: st.year };
  });
  // Walk-ons for positions below their minimum.
  if (tpl) {
    let nextId = players.reduce((a, p) => Math.max(a, p.id), 0) + 1;
    for (const t of d.teams) {
      const counts = countBy(players, t.index);
      for (const pos of POSITIONS) {
        for (let k = counts[pos] ?? 0; k < POS_MIN[pos]; k++) {
          const w = makeRecruit({ ...d, players }, tpl, r, nextId++, t.index, pos, 0, st.year + 1);
          players = [...players, w];
          events.push({ kind: 'walkon', player: w.id, team: t.index, ovr: w.ovr });
        }
      }
      // Up to the roster minimum, where the need is biggest.
      for (let k = Object.values(countBy(players, t.index)).reduce((a, b) => a + b, 0); k < ROSTER_MIN; k++) {
        const c = countBy(players, t.index);
        const pos = POSITIONS.map((p) => ({ p, g: need(c, p) + r() * 0.9 })).sort((a, b) => b.g - a.g)[0].p;
        const w = makeRecruit({ ...d, players }, tpl, r, nextId++, t.index, pos, 0, st.year + 1);
        players = [...players, w];
        events.push({ kind: 'walkon', player: w.id, team: t.index, ovr: w.ovr });
      }
    }
  }
  return { ...d, players, offseason: { ...st, step: 'ready', events: [...st.events, ...events] } };
}

// ---- 5. depth chart and the next season

/** Jersey numbers each position may wear when it needs a new one (college rules, loosely). */
const NUMBER_POOL: Record<string, [number, number][]> = {
  QB: [[1, 19]], HB: [[1, 49]], FB: [[30, 49]], WR: [[1, 19], [80, 89]], TE: [[80, 89], [40, 49]],
  LT: [[50, 79]], LG: [[50, 79]], C: [[50, 79]], RG: [[50, 79]], RT: [[50, 79]],
  LE: [[90, 99], [40, 59]], RE: [[90, 99], [40, 59]], DT: [[90, 99], [50, 59]],
  LOLB: [[1, 59]], MLB: [[1, 59]], ROLB: [[1, 59]], CB: [[1, 39]], FS: [[1, 49]], SS: [[1, 49]], K: [[1, 49], [90, 99]], P: [[1, 49], [90, 99]],
};

/** Every team's players get distinct numbers: the best player keeps his, the others get a free one for their position. */
export function fixJerseys(players: DPlayer[], r: Rand): DPlayer[] {
  const out = players.slice();
  const teams = new Map<number, number[]>();
  out.forEach((p, i) => { if (p.status === 'active' && p.team !== null) teams.set(p.team, [...(teams.get(p.team) ?? []), i]); });
  for (const idx of teams.values()) {
    const used = new Set<number>();
    const order = idx.slice().sort((a, b) => Number(!!out[a].jersey === false) - Number(!!out[b].jersey === false) || out[b].ovr - out[a].ovr);
    for (const i of order) {
      const p = out[i];
      if (p.jersey > 0 && !used.has(p.jersey)) { used.add(p.jersey); continue; }
      const pool = (NUMBER_POOL[p.pos] ?? [[1, 99]]).flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)).filter((n) => !used.has(n));
      const any = Array.from({ length: 99 }, (_, k) => k + 1).filter((n) => !used.has(n));
      const n = pool.length ? pick(r, pool) : pick(r, any);
      used.add(n);
      out[i] = { ...p, jersey: n };
    }
  }
  return out;
}

/** The dynasty's players as a CFB 27 sheet the Rosters tool's conversion reads (EA Player ID = dynasty ID). */
export function rosterSheet(d: Dynasty): { sheet: Sheet; ids: number[] } {
  const headers = ['Team', 'Name', 'Position', 'Overall', 'Jersey Number', 'Weight', 'EA Player ID', ...d.attrKeys];
  const ps = active(d);
  return {
    sheet: {
      headers,
      rows: ps.map((p) => [d.teams[p.team!].school, `${p.first} ${p.last}`, p.pos, String(p.ovr), String(p.jersey), String(p.weight), String(p.id), ...p.attrs.map(String)]),
    },
    ids: ps.map((p) => p.id),
  };
}

/**
 * The next season's 32 per team, their game ratings and the team OVRs, from the Rosters tool's
 * CFB 27 conversion of the dynasty's players (the same conversion the dynasty started with).
 */
export function depthChart(d: Dynasty, rom: Uint8Array): Pick<DSeason, 'slots' | 'bw' | 'teamOvr'> {
  const roster = openRosterRom(rom);
  const { sheet, ids } = rosterSheet(d);
  const plan = convertCfb27(roster, sheet);
  const n = d.teams.length;
  const slots: (number | null)[][] = Array.from({ length: n }, () => new Array<number | null>(32).fill(null));
  const bw: (BwSlot | null)[][] = Array.from({ length: n }, () => new Array<BwSlot | null>(32).fill(null));
  const olPlus = hasOlPatch(roster) ? OL_PATCH.pounds : 0;
  for (const t of plan.teams) {
    for (const f of t.fills) {
      slots[t.team][f.slot] = ids[f.player.row];
      const attrs = GROUP_COLUMNS[f.group];
      bw[t.team][f.slot] = { label: f.label, group: f.group, attrs, steps: attrs.map((a) => f.steps[a] ?? 0), weightPlus: f.group === 'OL' ? olPlus : 0 };
    }
  }
  // Team OVRs from the starters' game-rating OVRs (the game's ratings are relative, so this keeps the
  // scale steady from season to season, where CFB 27-style OVRs drift with each class).
  const teamOvr = d.teams.map((t) => starterOvr(slots[t.index].flatMap((id, slot) => {
    const p = id ? d.players[id - 1] : undefined;
    const b = bw[t.index][slot];
    return p && b ? [{ pos: p.pos, ovr: playerOvr(slot, b) }] : [];
  })));
  return { slots, bw, teamOvr: teamOvr.map((o) => ({ off: o.off, def: o.def })) };
}

/** Ends the offseason: unique numbers, the depth chart, and the next season (same conferences). */
export function finishOffseason(d: Dynasty, rom: Uint8Array): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'ready') throw new Error('Finish the cuts first.');
  const r = stepRand(st, 5);
  const players = fixJerseys(d.players, r);
  const withNumbers = { ...d, players };
  const prev = lastSeason(d);
  const season: DSeason = {
    index: prev.index + 1,
    year: prev.year + 1,
    conf: prev.conf.slice(),
    confNames: prev.confNames.slice(),
    ...depthChart(withNumbers, rom),
    prestige: st.prestige ?? seasonPrestige(d, prev),
    imports: [],
    events: st.events,
  };
  return { ...withNumbers, seasons: [...d.seasons, season], offseason: undefined };
}

/** A signing class ranking (from the events of the offseason in progress or a season's offseason). */
export function classRankings(events: OffseasonEvent[]) {
  return events.filter((e): e is Extract<OffseasonEvent, { kind: 'class' }> => e.kind === 'class').sort((a, b) => a.rank - b.rank);
}

// ---- the season's rosters in the ROM

/**
 * A copy of the user's ROM with a season's 32 per team (jersey numbers and game ratings) and team
 * OVRs written in, checksums fixed: what the Rosters and Teams tabs write, so the game plays the
 * dynasty's rosters. (Until the Elevated mod has a separate dynasty roster set, Exhibition uses
 * them too.)
 */
export function seasonRom(d: Dynasty, season: DSeason, rom: Uint8Array): Uint8Array {
  const out = openRosterRom(rom);
  if (!out.wide) throw new Error("This isn't the 138-team 2026 Season Edition.");
  if (ratingProblems(out.data).length) throw new Error(`This ROM's team ratings can't be written: ${ratingProblems(out.data).join('; ')}.`);
  for (let t = 0; t < d.teams.length; t++) {
    const layout = teamLayout(out, t);
    for (const def of layout) {
      const id = season.slots[t][def.slot];
      const b = season.bw?.[t]?.[def.slot];
      if (!id || !b) continue;
      const p = readPlayer(out, t, def.slot);
      p.numberByte = jerseyByte(d.players[id - 1].jersey);
      for (const attr of GROUP_ATTRS[def.group]) {
        const i = b.attrs.indexOf(attr);
        if (i >= 0) setRating(p, def, attr, b.steps[i]);
      }
      writePlayer(out, t, def.slot, p);
    }
    const o = season.teamOvr?.[t];
    if (o) writeRating(out.data, t, o);
  }
  fixChecksums(out.data, out.game);
  return out.data;
}
