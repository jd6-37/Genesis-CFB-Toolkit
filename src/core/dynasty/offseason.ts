// The offseason between two dynasty seasons, as steps the app runs one after another (user's rules:
// 5-in-5 eligibility with SR+, juniors and seniors may go pro, transfer portal, random signing
// classes for now, cuts to the roster limit after signing day, then walk-ons and the depth chart).
//
//   startOffseason   departures (graduates, early pros, seniors back as SR+), classes move up,
//                    players develop toward their potential
//   runPortal        players without a spot enter the portal; teams with needs take them
//   runSigningDay    random signing classes by need and prestige (recruits made from the league's own
//                    players of the position, as freshmen)
//   applyCuts        every team down to the roster limit (CPU automatically, user teams by choice),
//                    walk-ons for positions below their minimum
//   finishOffseason  depth chart (the best OVR at each spot, depth.ts), unique jersey numbers, the
//                    next season
//
// Pure functions: each returns a new dynasty. Randomness is seeded, so the same choices give the
// same offseason. The players before the offseason are kept so it can be started over.

import { CLASSES, rng, type ClassYear, type DPlayer, type DSeason, type Dynasty, type OffseasonEvent } from './model';
import { playerLines, seasonView } from './derive';
import { fixChecksums, jerseyByte, openRosterRom, readPlayer, setRating, teamLayout } from '../rosterRom';
import { GROUP_ATTRS } from '../rosterLayouts';
import { MAX_PRESTIGE, nextPrestige, seasonPrestige } from './prestige';
import { OVR_FORMULAS } from './ovr';
import { readRating } from '../teamRatings';
import { DYNASTY_EDITION, dynastyAreaProblem, dynastyRomId, writeDynastyArea, type DynastyName } from './dynastyArea';
import { TEAM_SIZE } from './rosters';
import { depthChart, slotPosition, teamDepth } from './depth';
import { rosterLayout } from '../rosterLayouts';
import { roleOfSlot } from './ovr';
import { recordYear } from './career';
import { DEFAULT_RULES, growthRate, rulesOf, type OffseasonRules } from './rules';
import { ovrOf, roleOfPos, type Ratings } from './ratings';
import { blackShare, firstOdds, lastOdds, MAX_FIRST, MAX_LAST, namePool, pickName, skinFor, type NamePool } from './appearance';

/** A team is 64 players: the 32 in the game and one backup for each (rosters.ts). */
export const ROSTER_LIMIT = TEAM_SIZE;
export const CLASS_MAX = DEFAULT_RULES.classMax;
/** Walk-ons fill a team up to this many players. */
export const ROSTER_MIN = TEAM_SIZE;

/** How many players a team wants at each position: two for each of its slots in the game (adds up to 64). */
export const POS_TARGET: Record<string, number> = {
  QB: 2, HB: 4, FB: 2, WR: 8, TE: 4, LT: 2, LG: 2, C: 2, RG: 2, RT: 2,
  LE: 2, RE: 2, DT: 4, LOLB: 2, MLB: 4, ROLB: 2, CB: 8, FS: 4, SS: 2, K: 2, P: 2,
};
/** The fewest a team may have at each position: one for each of its slots (cuts stop there; walk-ons fill up to it). */
export const POS_MIN: Record<string, number> = Object.fromEntries(Object.entries(POS_TARGET).map(([p, n]) => [p, n / 2]));
export const POSITIONS = Object.keys(POS_TARGET);
/**
 * Roster minimums by position group (user, 2026-11-12: "do we really need to require the user have 8
 * CBs? Maybe we set min per position"): every Active Roster spot plus a backup (two on the line); the
 * rest of the 64 is the team's choice. Cuts never go below these (nor below POS_MIN at a position).
 */
export function groupMins(R: OffseasonRules = DEFAULT_RULES): { name: string; positions: string[]; min: number }[] {
  return [
    { name: 'QBs', positions: ['QB'], min: R.minQB },
    { name: 'HBs and FBs', positions: ['HB', 'FB'], min: R.minRB },
    { name: 'WRs', positions: ['WR'], min: R.minWR },
    { name: 'TEs', positions: ['TE'], min: R.minTE },
    { name: 'offensive linemen', positions: ['LT', 'LG', 'C', 'RG', 'RT'], min: R.minOL },
    { name: 'defensive linemen', positions: ['LE', 'RE', 'DT'], min: R.minDL },
    { name: 'linebackers', positions: ['LOLB', 'MLB', 'ROLB'], min: R.minLB },
    { name: 'CBs', positions: ['CB'], min: R.minCB },
    { name: 'safeties', positions: ['FS', 'SS'], min: R.minS },
    { name: 'kickers and punters', positions: ['K', 'P'], min: R.minKP },
  ];
}
/** The defaults (rules.ts has the dynasty's own). */
export const GROUP_MIN = groupMins();

export type OffseasonStep = 'depth' | 'portal' | 'recruiting' | 'signing' | 'cuts' | 'ready';

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
  /** Players who enter the transfer portal (decided after the projected depth chart; Players Leaving lists them). */
  portal?: number[];
  /**
   * The user teams' projected depth charts for next season (32 player IDs in slot order), as they set
   * them before the portal (user, 2026-11-12: "move a HB2 to HB1 if we really want to ensure he doesn't
   * transfer"). A player there in a starting spot counts as a starter for the transfer chances.
   */
  projected?: Record<number, (number | null)[]>;
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

/**
 * Grows a player toward his potential: an OVR gain raises the ratings his position's OVR formula counts
 * (Speed at half the pace), by the shown numbers, so he can be part of the way to the next step. Bigger
 * players also put on a few pounds.
 */
export function develop(p: DPlayer, gain: number, r: Rand, speedPace = DEFAULT_RULES.speedPace): DPlayer {
  const role = roleOfPos(p.pos);
  const f = OVR_FORMULAS[role];
  if (!f || Math.abs(gain) < 0.25) return p;
  const per = gain / f.scale; // the weighted average moves by this many points
  const ratings: Ratings = { ...p.ratings };
  for (const [a, w] of Object.entries(f.weights) as [keyof Ratings, number][]) {
    if (!w) continue;
    const pace = a === 'Speed' ? speedPace : 1.15;
    ratings[a] = clamp(Math.round(((ratings[a] ?? 0) + per * pace * between(r, 0.6, 1.4)) * 10) / 10, 0, 100);
  }
  let weight = p.weight;
  if (gain > 0 && ['OL', 'DE', 'DT', 'TE', 'LB', 'FB'].includes(role)) {
    const lbs = Math.round(between(r, 0, 6));
    ratings.Weight = clamp((ratings.Weight ?? 140) + lbs, 140, 380);
    weight = clamp(weight + lbs, 150, 400);
  }
  const q = { ...p, ratings, weight };
  return { ...q, ovr: ovrOf(q) };
}


/**
 * Ends the season: SR+ leave; seniors go pro, come back as SR+ or graduate; juniors may go pro; the
 * others move up a class and develop. Then the transfer portal is next.
 */
export function startOffseason(d: Dynasty, opt: { seed?: number; force?: boolean } = {}): Dynasty {
  if (d.offseason) throw new Error('The offseason has already started.');
  if (!opt.force && !seasonDone(d)) throw new Error('The season isn\'t over yet: import the save after the last game first.');
  const year = lastSeason(d).year;
  const st: OffseasonState = { year, step: 'depth', seed: opt.seed ?? (Date.now() >>> 0), before: d.players, events: [], growth: [] };
  // Prestige: one star toward the tier of the final poll place (no change without a save).
  const v = seasonView(d, lastSeason(d));
  const was = seasonPrestige(d, lastSeason(d));
  const R = rulesOf(d);
  st.prestige = was.map((stars, t) => (v.save ? nextPrestige(stars, v.rank[t], [R.tier6, R.tier5, R.tier4, R.tier3, R.tier2]) : stars));
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
      if (r() < clamp((p.ovr - R.proSeniorBase) / R.proSeniorScale, 0, R.proSeniorMax)) return leave('pro');
      if (r() < R.srPlusReturn) st.events.push({ kind: 'returns', player: p.id, team, ovr: p.ovr });
      else return leave('graduated');
    }
    if (p.cls === 'JR' && r() < clamp((p.ovr - R.proJuniorBase) / R.proJuniorScale, 0, R.proJuniorMax)) return leave('pro');
    // Moves up a class and develops.
    const from = p.ovr;
    const room = (p.pot ?? p.ovr) - p.ovr;
    const gain = room * growthRate(R, p.cls) * between(r, R.growthMin, R.growthMax) + (inGame.has(p.id) ? R.starterBonus : 0) + gauss(r);
    p = develop({ ...p, cls: CLASSES[Math.min(4, CLASSES.indexOf(p.cls) + 1)] }, gain, r, R.speedPace);
    if (p.ovr > (p.pot ?? 99)) p = { ...p, pot: p.ovr };
    st.growth.push({ player: p.id, from, to: p.ovr });
    return p;
  });
  return { ...d, players, offseason: st };
}

/** A team's projected depth chart for next season: the one the user set, else the computer's. */
export function projectedDepth(d: Dynasty, team: number): (number | null)[] {
  return d.offseason?.projected?.[team] ?? teamDepth(active(d).filter((p) => p.team === team)).slots;
}

/** Why a projected depth chart can't be used (empty when it can): his own players, each once. */
export function projectedProblems(d: Dynasty, team: number, slots: (number | null)[]): string[] {
  const ids = slots.filter((x): x is number => x !== null);
  const out: string[] = [];
  if (slots.length !== LAYOUT.length) out.push('The depth chart needs every spot.');
  if (ids.some((id) => d.players[id - 1]?.team !== team || d.players[id - 1]?.status !== 'active')) out.push('Some of the players aren\'t on the team.');
  // A player may hold two spots: before signing day rosters are thin, and the depth chart fills a spot
  // with someone from a close position (as it does for a kicker who also punts).
  return out;
}

/**
 * After the projected depth chart: the user teams' charts are kept, and who enters the transfer portal is
 * decided (Players Leaving shows them with the graduates and early entries).
 */
export function confirmDepth(d: Dynasty, projected: Record<number, (number | null)[]> = {}): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'depth') throw new Error('The projected depth chart comes first in the offseason.');
  for (const [t, slots] of Object.entries(projected)) {
    const bad = projectedProblems(d, Number(t), slots);
    if (bad.length) throw new Error(`${d.teams[Number(t)].school}: ${bad.join(' ')}`);
  }
  const next: Dynasty = { ...d, offseason: { ...st, projected: { ...st.projected, ...projected } } };
  return { ...next, offseason: { ...next.offseason!, step: 'portal', portal: chooseTransfers(next, st.seed) } };
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

/** Seasons each player spent on the bench (not one of his team's 32 in the game). */
export function benchSeasons(d: Dynasty): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of d.seasons) {
    const inGame = new Set(s.slots.flat());
    for (const id of new Set(s.bench?.flat() ?? [])) if (id !== null && !inGame.has(id)) out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

/**
 * The chance a player enters the transfer portal (user, 2026-11-12: nobody leaves too soon for
 * playing time, since the game can't give a backup a few snaps). Players in the game never; bench
 * players only after two seasons on the bench: 10%, +10% when the starter ahead of him stays, +10%
 * for a senior (graduate transfer).
 */
/**
 * Who may want to leave (user, 2026-11-12: "The third or fourth WR on a depth chart should try and find a
 * starting job elsewhere"; "they should have lower chances of transferring if they actually get playing
 * time … A player as the second WR who is still making a lot of catches and yards should be content").
 * By his role last season: starters 1%, the Active Roster's depth spots (HB2, the 3rd and 4th WRs, TE2, DT2,
 * MLB2, the 3rd and 4th CBs, FS2) 8%, backups 12%; +10% when next season's depth chart still has him
 * behind someone, +5% for seniors; then up to 80% less with playing time: his touches (carries and catches,
 * or tackles, sacks and interceptions) against half of what a typical starter at his position gets.
 * Linemen and backups have no stats, so they keep the full chance. Players signed this offseason never.
 */
export function transferChance(d: Dynasty, p: DPlayer, ctx: PortalContext = portalContext(d)): number {
  if (p.status !== 'active' || p.team === null || p.recruit?.year === lastSeason(d).year + 1) return 0;
  const R = rulesOf(d);
  const role = ctx.role.get(p.id) ?? 'backup';
  let c = role === 'starter' ? R.transferStarter : role === 'depth' ? R.transferDepth : R.transferBackup;
  if (!ctx.nextStarters.has(p.id)) c += R.transferBlocked;
  if (p.cls === 'SR' || p.cls === 'SR+') c += R.transferSenior;
  return clamp(c * (1 - R.playingTimeCut * playingTime(ctx, p, R.playingTimeShare)), 0, 1);
}

/** Labels of the Active Roster spots that aren't starting jobs. */
export const DEPTH_SLOTS = new Set(['HB2', 'WR1', 'WR2', 'TE2', 'DT2', 'MLB2', 'LCB2', 'RCB2', 'FS2']);
const LAYOUT = rosterLayout('bw95', false, true);

export interface PortalContext {
  /** His role last season. */
  role: Map<number, 'starter' | 'depth' | 'backup'>;
  /** Touches last season (carries + catches; tackles + sacks + interceptions). */
  touches: Map<number, number>;
  /** A typical starter's touches by role (HB, WR, LB …). */
  typical: Map<string, number>;
  /** Next season's projected starters (the depth chart the rosters would give now). */
  nextStarters: Set<number>;
  /** Per team and position, the weakest projected starter's OVR (who a transfer would have to beat). */
  starterBar: Map<number, Map<string, number>>;
}

/** What the transfer rules need from last season and the current rosters. */
export function portalContext(d: Dynasty): PortalContext {
  const s = lastSeason(d);
  const role = new Map<number, 'starter' | 'depth' | 'backup'>();
  s.slots.forEach((team) => team.forEach((id, slot) => { if (id !== null) role.set(id, DEPTH_SLOTS.has(LAYOUT[slot].label) ? (role.get(id) === 'starter' ? 'starter' : 'depth') : 'starter'); }));
  const touches = new Map<number, number>();
  const starterTouches = new Map<string, number[]>();
  const v = seasonView(d, s);
  const per = new Map<string, number>(); // team:slot → touches
  for (const l of playerLines(v)) {
    const st = l.s as unknown as Record<string, number>;
    const n = l.cat === 'rushing' ? st.att : l.cat === 'receiving' ? st.rec : l.cat === 'defense' ? st.tkl + st.sacks + st.int : 0;
    if (!n) continue;
    per.set(`${l.team}:${l.slot}`, (per.get(`${l.team}:${l.slot}`) ?? 0) + n);
    if (l.player !== null) touches.set(l.player, (touches.get(l.player) ?? 0) + n);
  }
  s.slots.forEach((team, t) => team.forEach((id, slot) => {
    if (id === null || DEPTH_SLOTS.has(LAYOUT[slot].label)) return;
    const n = per.get(`${t}:${slot}`);
    if (n === undefined) return;
    const r = roleOfSlot(slot);
    starterTouches.set(r, [...(starterTouches.get(r) ?? []), n]);
  }));
  const typical = new Map([...starterTouches].map(([r, xs]) => [r, xs.reduce((a, b) => a + b, 0) / xs.length]));
  const nextStarters = new Set<number>();
  const starterBar = new Map<number, Map<string, number>>();
  for (const t of d.teams) {
    const bar = new Map<string, number>();
    projectedDepth(d, t.index).forEach((id, slot) => {
      if (id === null || DEPTH_SLOTS.has(LAYOUT[slot].label)) return;
      nextStarters.add(id);
      const pos = slotPosition(LAYOUT[slot].label);
      bar.set(pos, Math.min(bar.get(pos) ?? 99, d.players[id - 1].ovr));
    });
    starterBar.set(t.index, bar);
  }
  return { role, touches, typical, nextStarters, starterBar };
}

/** His playing time last season, 0-1 (1 = at least half of a typical starter's touches at his position). */
export function playingTime(ctx: PortalContext, p: DPlayer, share = DEFAULT_RULES.playingTimeShare): number {
  const typ = ctx.typical.get(roleOfPos(p.pos));
  const n = ctx.touches.get(p.id) ?? 0;
  return typ ? clamp(n / (share * typ), 0, 1) : 0;
}

/** Whether he'd start at a team (beats its weakest projected starter at his position). */
export const wouldStart = (ctx: PortalContext, p: DPlayer, team: number) => p.ovr > (ctx.starterBar.get(team)?.get(p.pos) ?? 0);

/** The players who enter the portal this offseason (decided once, at the start: Players Leaving lists them). */
export function chooseTransfers(d: Dynasty, seed: number): number[] {
  const r = rng((seed ^ 0x51ed27) >>> 0);
  const ctx = portalContext(d);
  return d.players.filter((p) => p.status === 'active' && p.team !== null && r() < transferChance(d, p, ctx)).map((p) => p.id);
}

/**
 * Bench players who have waited two seasons may enter the portal (transferChance); teams that need the position take them, the best players first.
 * Players nobody takes leave the dynasty (they transfer down).
 */
export function runPortal(d: Dynasty): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'portal') throw new Error('The transfer portal comes after the season ends.');
  const r = stepRand(st, 2);
  let players = d.players.slice();
  const ctx = portalContext(d);

  // Who enters: decided with the departures (st.portal).
  const entries = (st.portal ?? chooseTransfers(d, st.seed)).map((id) => players[id - 1]).filter((p) => p.status === 'active' && p.team !== null);
  entries.sort((a, b) => b.ovr - a.ovr || a.id - b.id);

  // Where they go: only where they'd start (user, 2026-11-12: "find a starting job elsewhere, if
  // available"), the better programs first in line; nobody would start him: he stays.
  const pres = new Map(d.teams.map((t) => [t.index, prestige(d, t.index)]));
  const took = new Map<number, number>();
  const events: OffseasonEvent[] = [];
  const moved = new Map<number, number>();
  for (const p of entries) {
    const from = p.team!;
    const fits = d.teams
      .map((t) => t.index)
      .filter((t) => t !== from && (took.get(t) ?? 0) < rulesOf(d).transfersPerTeam && wouldStart(ctx, p, t))
      .map((t) => ({ t, w: (0.5 + pres.get(t)!) * between(r, 0.5, 1.5) }))
      .sort((a, b) => b.w - a.w);
    if (!fits.length) continue;
    const to = fits[0].t;
    moved.set(p.id, to);
    took.set(to, (took.get(to) ?? 0) + 1);
    // The job is his now: the next transfer at that position has to beat him.
    const bar = ctx.starterBar.get(to)!;
    bar.set(p.pos, Math.max(bar.get(p.pos) ?? 0, p.ovr));
    events.push({ kind: 'transfer', player: p.id, from, to, ovr: p.ovr });
  }
  players = players.map((p) => {
    if (!moved.has(p.id)) return p;
    const to = moved.get(p.id)!;
    return { ...p, team: to, transfers: [...(p.transfers ?? []), { year: st.year, from: p.team!, to }] };
  });
  return { ...d, players, offseason: { ...st, step: 'signing', events: [...st.events, ...events] } };
}

// ---- 3. signing day (random classes)

export interface RecruitTemplates {
  /** The league's players of each position (their ratings), lowest OVR first. */
  byPos: Record<string, { ratings: Ratings; ovr: number; heightIn: number; weight: number }[]>;
  /** Names of the starting (CFB 27) players, short enough for the game, weighted by how often and for whom they occur. */
  firstNames: NamePool;
  lastNames: NamePool;
  /** Every dynasty player's full name, never given to a new player. */
  realNames: Set<string>;
  towns: { hometown: string; state: string }[];
}

/**
 * What new players are made from, all from the dynasty itself: the league's players of each position now
 * (their ratings, size), and the starting players' names and hometowns.
 */
export function recruitTemplates(d: Dynasty): RecruitTemplates {
  const byPos: RecruitTemplates['byPos'] = {};
  const first = new Map<string, number>(), last = new Map<string, number>(), real = new Set<string>();
  const towns: RecruitTemplates['towns'] = [];
  for (const p of d.players) {
    real.add(`${p.first} ${p.last}`);
    if (p.srcId === undefined) continue; // names and towns from the starting players only
    first.set(p.first, (first.get(p.first) ?? 0) + 1);
    last.set(p.last, (last.get(p.last) ?? 0) + 1);
    if (p.hometown && p.state && p.state !== 'Non-US') towns.push({ hometown: p.hometown, state: p.state });
  }
  for (const p of active(d)) (byPos[p.pos] ??= []).push({ ratings: p.ratings, ovr: p.ovr, heightIn: p.heightIn, weight: p.weight });
  for (const list of Object.values(byPos)) list.sort((a, b) => a.ovr - b.ovr);
  return { byPos, firstNames: namePool(first, firstOdds, MAX_FIRST), lastNames: namePool(last, lastOdds, MAX_LAST), realNames: real, towns };
}

/** Where in the league's players of a position a recruit of each star rating is modeled on (OVR percentile), before the freshman gap. */
const STAR_BAND: Record<number, [number, number]> = { 5: [0.97, 1], 4: [0.8, 0.97], 3: [0.35, 0.8], 2: [0.05, 0.35], 1: [0, 0.05], 0: [0, 0.08] };
/** Potential range by stars (walk-ons 0). */
const STAR_POT: Record<number, [number, number]> = { 5: [86, 99], 4: [80, 93], 3: [72, 86], 2: [65, 79], 1: [58, 72], 0: [55, 70] };
/**
 * A diamond in the rough (user, 2026-11-12: "a few rare ones would be cool"): a walk-on with the potential
 * of a top recruit. He starts as weak as any walk-on and grows fast (development is a share of his room).
 */
export const DIAMOND_CHANCE = DEFAULT_RULES.diamondChance;
export const DIAMOND_POT: [number, number] = [DEFAULT_RULES.diamondPotMin, DEFAULT_RULES.diamondPotMax];

/** Stars for one recruit of a program with this prestige (0-1). */
export function drawStars(r: Rand, pres: number): number {
  const w = [0.12 * (1 - pres), 0.38 * (1 - pres) + 0.05, 0.42, 0.06 + 0.42 * pres, 0.005 + 0.12 * pres * pres]; // 1★ … 5★
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) if ((x -= w[i]) <= 0) return i + 1;
  return 3;
}

/**
 * One new player: modeled on a league player of the position at the star rating's place, younger (the
 * freshman gap, less for Speed), every rating a little different; a new name and hometown.
 */
export function makeRecruit(d: Dynasty, tpl: RecruitTemplates, r: Rand, id: number, team: number, pos: string, stars: number, year: number): DPlayer {
  const pool = (tpl.byPos[pos]?.length ?? 0) >= 5 ? tpl.byPos[pos] : tpl.byPos[pos === 'FB' ? 'TE' : 'WR'];
  const [lo, hi] = STAR_BAND[stars];
  const t = pool[Math.min(pool.length - 1, Math.floor(between(r, lo, hi) * pool.length))];
  const f = OVR_FORMULAS[roleOfPos(pos)];
  const R = rulesOf(d);
  const gap = between(r, R.freshmanGapMin, R.freshmanGapMax) / (f?.scale ?? 0.5);
  const ratings: Ratings = {};
  for (const [a, v] of Object.entries(t.ratings) as [keyof Ratings, number][]) {
    if (a === 'Weight') { ratings.Weight = clamp(Math.round(v + 8 * gauss(r)), 140, 380); continue; }
    const counts = !!f?.weights[a];
    const drop = counts ? gap * (a === 'Speed' ? 0.4 : 1) * between(r, 0.6, 1.4) : 0;
    ratings[a] = clamp(Math.round(v - drop + 3 * gauss(r)), 0, 100);
  }
  const ovr = ovrOf({ pos, ratings });
  const [plo, phi] = stars === 0 && r() < R.diamondChance ? [R.diamondPotMin, R.diamondPotMax] : STAR_POT[stars];
  const town = pick(r, tpl.towns);
  // White or Black by the position's share; names that fit, never a real player's full name.
  const black = r() < blackShare(pos);
  let first = '', last = '';
  for (let k = 0; k < 20 && (!first || tpl.realNames.has(`${first} ${last}`)); k++) {
    first = pickName(tpl.firstNames, black, r);
    last = pickName(tpl.lastNames, black, r);
  }
  return {
    id, first, last, pos, team, cls: 'FR', jersey: 0,
    heightIn: clamp(Math.round(t.heightIn + gauss(r)), 64, 82), weight: clamp(Math.round(t.weight + 6 * gauss(r)), 150, 380),
    hometown: town.hometown, state: town.state, ovr, ratings, skin: skinFor(black, r), status: 'active',
    pot: clamp(Math.round(between(r, plo, phi)), ovr + 3, 99), recruit: { stars, year },
  };
}

/** Class points for rankings: 5★ 100, 4★ 60, 3★ 30, 2★ 12, 1★ 4. */
export const STAR_POINTS = [0, 4, 12, 30, 60, 100];

/**
 * Every team signs a class: as many as it has open spots up to 64 (at most 25), position by
 * position where the need is biggest, stars by the program's prestige.
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
    const n = clamp(ROSTER_LIMIT - roster, 0, rulesOf(d).classMax);
    let points = 0;
    for (let k = 0; k < n; k++) {
      // The biggest need (ties at random).
      const pos = POSITIONS.map((p) => ({ p, g: need(counts, p) + r() * 0.9 })).sort((a, b) => b.g - a.g)[0].p;
      const stars = drawStars(r, pres);
      const rec = makeRecruit(d, tpl, r, nextId++, t.index, pos, stars, st.year + 1);
      players.push(rec);
      counts[pos] = (counts[pos] ?? 0) + 1;
      points += STAR_POINTS[stars];
      events.push({ kind: 'signed', player: rec.id, team: t.index, stars, ovr: rec.ovr });
    }
    if (n > 0) classes.push({ team: t.index, points, signed: n });
  }
  classes.sort((a, b) => b.points - a.points || a.team - b.team);
  classes.forEach((c, i) => events.push({ kind: 'class', team: c.team, rank: i + 1, signed: c.signed, points: c.points }));
  const filled = fillMinimums(d, players, tpl, r, st.year + 1, events);
  const next: Dynasty = { ...d, players: filled, offseason: { ...st, step: 'cuts', events: [...st.events, ...events] } };
  const suggestedCuts: Record<number, number[]> = {};
  for (const t of d.userTeams) suggestedCuts[t] = suggestCuts(next, t);
  return { ...next, offseason: { ...next.offseason!, suggestedCuts } };
}

// ---- 4. cuts and walk-ons

/**
 * Walk-ons for every position a team has fewer players at than it has slots for (so every slot in
 * the game has a player of its position). Run at the end of signing day, before the cuts.
 */
export function fillMinimums(d: Dynasty, players: DPlayer[], tpl: RecruitTemplates, r: Rand, year: number, events: OffseasonEvent[]): DPlayer[] {
  let out = players;
  let nextId = out.reduce((a, p) => Math.max(a, p.id), 0) + 1;
  for (const t of d.teams) {
    const counts = countBy(out, t.index);
    for (const pos of POSITIONS) {
      for (let k = counts[pos] ?? 0; k < POS_MIN[pos]; k++) {
        const w = makeRecruit({ ...d, players: out }, tpl, r, nextId++, t.index, pos, 0, year);
        out = [...out, w];
        events.push({ kind: 'walkon', player: w.id, team: t.index, ovr: w.ovr });
      }
    }
    // Then each group up to its minimum, at the group's position with the fewest players for its slots.
    for (const g of groupMins(rulesOf(d))) {
      const c = countBy(out, t.index);
      for (let k = g.positions.reduce((a, pos) => a + (c[pos] ?? 0), 0); k < g.min; k++) {
        const pos = g.positions.slice().sort((a, b) => (c[a] ?? 0) / POS_MIN[a] - (c[b] ?? 0) / POS_MIN[b])[0];
        const w = makeRecruit({ ...d, players: out }, tpl, r, nextId++, t.index, pos, 0, year);
        out = [...out, w];
        c[pos] = (c[pos] ?? 0) + 1;
        events.push({ kind: 'walkon', player: w.id, team: t.index, ovr: w.ovr });
      }
    }
  }
  return out;
}

/**
 * What a backup is worth to his team when it has to cut (user, 2026-11-12: "I'd rather not cut a 75 OVR FR
 * when i have a 76 OVR senior that i could cut"). Backups aren't in the game, so only the seasons he could
 * start count: his expected OVR next season and the one after (development by class and potential). A SR
 * or SR+ has no season left after this one: lowest of all, the better ones last.
 */
export function keepValue(p: DPlayer, R: OffseasonRules = DEFAULT_RULES): number {
  const i = CLASSES.indexOf(p.cls);
  const left = 3 - i; // seasons after this one: FR 3, SO 2, JR 1, SR 0, SR+ -1
  if (left <= 0) return p.ovr - 100;
  const pot = Math.max(p.pot ?? p.ovr, p.ovr);
  const n1 = p.ovr + (pot - p.ovr) * growthRate(R, p.cls);
  if (left === 1) return n1;
  const n2 = n1 + (pot - n1) * growthRate(R, CLASSES[i + 1]);
  return (n1 + n2) / 2;
}

/** Players under a team's minimums if these were cut (messages; empty when fine). */
function minimumProblems(roster: DPlayer[], cut: Set<number>, R: OffseasonRules): string[] {
  const c: Record<string, number> = {};
  for (const p of roster) if (!cut.has(p.id)) c[p.pos] = (c[p.pos] ?? 0) + 1;
  const out: string[] = [];
  const short = new Set<string>();
  for (const g of groupMins(R)) if (g.positions.reduce((a, pos) => a + (c[pos] ?? 0), 0) < g.min) { out.push(`Keep at least ${g.min} ${g.name}.`); g.positions.forEach((pos) => short.add(pos)); }
  // A position below its Active Roster spots (said once: not again when its group is short already).
  for (const pos of POSITIONS) if ((c[pos] ?? 0) < POS_MIN[pos] && !short.has(pos)) out.push(`Keep ${POS_MIN[pos] === 1 ? `a ${pos}` : `${POS_MIN[pos]} ${pos}s`} for the Active Roster.`);
  return out;
}

/** The order a team would cut in: backups by value (lowest first), then the Active Roster by OVR. */
export function cutOrder(roster: DPlayer[], R: OffseasonRules = DEFAULT_RULES): { order: DPlayer[]; active: Set<number> } {
  const active = new Set(teamDepth(roster).slots.filter((x): x is number => x !== null));
  const order = [
    ...roster.filter((p) => !active.has(p.id)).sort((a, b) => keepValue(a, R) - keepValue(b, R) || a.ovr - b.ovr || b.id - a.id),
    ...roster.filter((p) => active.has(p.id)).sort((a, b) => a.ovr - b.ovr || b.id - a.id),
  ];
  return { order, active };
}

/**
 * The players a team should cut to get to the roster limit: next season's Active Roster (the depth chart
 * the season would start with) stays; backups go lowest value first, across all positions; never below
 * the minimums (POS_MIN, GROUP_MIN).
 */
export function suggestCuts(d: Dynasty, team: number): number[] {
  const roster = active(d).filter((p) => p.team === team);
  const extra = roster.length - ROSTER_LIMIT;
  if (extra <= 0) return [];
  const cut = new Set<number>();
  const R = rulesOf(d);
  for (const p of cutOrder(roster, R).order) {
    if (cut.size >= extra) break;
    cut.add(p.id);
    if (minimumProblems(roster, cut, R).length) cut.delete(p.id);
  }
  return [...cut];
}

/** Why a set of cuts can't be used for a team (empty when it can). */
export function cutProblems(d: Dynasty, team: number, cuts: number[]): string[] {
  const roster = active(d).filter((p) => p.team === team);
  const ids = new Set(roster.map((p) => p.id));
  const out: string[] = [];
  if (cuts.some((c) => !ids.has(c))) out.push('Some of the players aren\'t on the team.');
  const left = roster.length - new Set(cuts).size;
  if (left > ROSTER_LIMIT) out.push(`${left} players are still too many: cut ${left - ROSTER_LIMIT} more (the limit is ${ROSTER_LIMIT}).`);
  out.push(...minimumProblems(roster, new Set(cuts), rulesOf(d)));
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
  // Walk-ons up to the roster size, where the need is biggest.
  if (tpl) {
    let nextId = players.reduce((a, p) => Math.max(a, p.id), 0) + 1;
    for (const t of d.teams) {
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

/** Ends the offseason: unique numbers, the depth chart, and the next season (same conferences). */
export function finishOffseason(d: Dynasty): Dynasty {
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
    ...depthChart(withNumbers),
    prestige: st.prestige ?? seasonPrestige(d, prev),
    imports: [],
    events: st.events,
  };
  return { ...withNumbers, players: recordYear(players, season.year), seasons: [...d.seasons, season], offseason: undefined };
}

/** A signing class ranking (from the events of the offseason in progress or a season's offseason). */
export function classRankings(events: OffseasonEvent[]) {
  return events.filter((e): e is Extract<OffseasonEvent, { kind: 'class' }> => e.kind === 'class').sort((a, b) => a.rank - b.rank);
}

// ---- the season's rosters in the ROM

/**
 * A copy of the user's ROM with a season's 32 per team (jersey numbers and game ratings, on each
 * slot's 2026 record) and team OVRs in the dynasty area, which Season mode reads, with the ID block
 * New Season stamps into the save; Exhibition keeps the real 2026 rosters. Checksums fixed.
 */
export function seasonRom(d: Dynasty, season: DSeason, rom: Uint8Array, now = Date.now()): Uint8Array {
  const out = openRosterRom(rom);
  const problem = out.wide ? dynastyAreaProblem(out.data) : `This isn't ${DYNASTY_EDITION}.`;
  if (problem) throw new Error(problem);
  const records: Uint8Array[] = [];
  const ovr: { off: number; def: number }[] = [];
  const names: (DynastyName | null)[][] = [];
  for (let t = 0; t < d.teams.length; t++) {
    const rec = new Uint8Array(128);
    const teamNames: (DynastyName | null)[] = new Array(32).fill(null);
    for (const def of teamLayout(out, t)) {
      const p = readPlayer(out, t, def.slot);
      const id = season.slots[t][def.slot];
      const b = season.bw?.[t]?.[def.slot];
      if (id && b) {
        const pl = d.players[id - 1];
        teamNames[def.slot] = { cls: CLASSES.indexOf(pl.cls), first: pl.first, last: pl.last };
        p.numberByte = jerseyByte(pl.jersey);
        for (const attr of GROUP_ATTRS[def.group]) {
          const i = b.attrs.indexOf(attr);
          if (i >= 0) setRating(p, def, attr, b.steps[i]);
        }
      }
      const r = p.ratings.map((x) => Math.max(0, Math.min(15, x | 0)));
      rec.set([p.numberByte & 255, (r[0] << 4) | r[1], (r[2] << 4) | r[3], (r[4] << 4) | r[5]], 4 * def.slot);
    }
    records.push(rec);
    names.push(teamNames);
    ovr.push(season.teamOvr?.[t] ?? readRating(out.data, t));
  }
  writeDynastyArea(out.data, {
    stamp: { dynasty: dynastyRomId(d.id), season: season.index + 1, rosterVersion: season.rosterVersion ?? 1, time: Math.floor(now / 1000) },
    records,
    ovr,
    names,
  });
  fixChecksums(out.data, out.game);
  return out.data;
}
