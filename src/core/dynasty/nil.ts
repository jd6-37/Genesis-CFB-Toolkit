// NIL (user, 2026-11-21): a yearly football budget in dollars per school, one-year deals, money in recruiting
// offers, raises in the offseason, richer schools luring players away. 2026 dynasties only (no NIL in 1994).
// Dollars come on top of the weekly recruiting points (points = a coach's time; dollars = the budget).
//
// Real 2026 figures it starts from (claude/bw95-app-lane-log.md, 2026-11-21):
//   revenue-sharing cap $20.5M per school in 2025-26, +4% a year, 65-75% of it to football; Power 4 football
//   rosters average $24.8M with outside NIL (Opendorse); Mountain West about $5M, MAC about $2M of revenue sharing.
//   College Sports Commission medians (Power 4, revenue share + NIL): QB $295,550, DL $176,500, OL $154,600,
//   WR $140,285, DB $140,000, RB $134,550, LB $134,000, TE $113,000; 90th percentile QB about $2.6M.
//
// Market value: what a top program pays a player, by position group and OVR, fitted so a Power 4 roster's median
// and 90th-percentile players get the real medians and 90th percentiles (fit on 2026 v2.1.1-test20; cli/nilstudy.ts).
// A school pays its players at its own rate: its budget over what its roster is worth (at most 1). That is why a
// Group of Five team pays a fraction of market value, as in real life (non-Power 4 medians are 7-9 times lower).

import type { DPlayer, Dynasty, DSeason } from './model';
import { editionOf } from './edition';
import { seasonView } from './derive';
import { seasonPrestige } from './prestige';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The tunable numbers (cli/nilstudy.ts). */
export const NIL = {
  /** Dollars grow this much a year (the cap's +4%), budgets and values alike. */
  growth: 1.04,
  /** Each conference's football budget in 2026 for a 3-star program (Independents: by prestige). */
  confBase: { SEC: 24e6, 'Big Ten': 23e6, ACC: 16.5e6, 'Big 12': 16.5e6, 'PAC 12': 5e6, American: 4.5e6, 'Mountain West': 4e6, 'Sun Belt': 3e6, 'C-USA': 2.2e6, MAC: 2e6 } as Record<string, number>,
  /** Budget × (prestigeBase + prestigeStep × stars), stars 1-6. */
  prestigeBase: 0.7, prestigeStep: 0.1,
  /** Booster money after a season, as a share of the budget: champion, top 4, top 12, top 25; a losing record. */
  boostChamp: 0.2, boostTop4: 0.14, boostTop12: 0.09, boostTop25: 0.05, boostLosing: -0.05,
  /** Booster money carries over at this share (so a few good years build up). */
  boostKeep: 0.6, boostMin: -0.15, boostMax: 0.6,
  /** Share of the budget kept for the incoming class and the portal when the returning players are paid. */
  reserve: 0.2,
  /** A school's pay rate (budget over roster value) is kept within these. */
  rateMin: 0.08, rateMax: 1.6,
  /** The most a school offers a newcomer, as a share of his market value. */
  offerMax: 1.25,
  /** Value never under this (dollars a year). */
  floor: 2000,
  /** Recruiting: the dollars' weight on interest (offer / expected offer) ^ moneyPower, within moneyMin-moneyMax. */
  moneyPower: 0.7, moneyMin: 0.4, moneyMax: 1.8,
  /** The share of market value a prospect expects, by stars (0-5): schools at his level pay about that. */
  expectRate: [0.2, 0.2, 0.3, 0.5, 0.75, 0.95],
  /** Transfers: a player another school would start and pay `ratio` times his pay gets poachSlope × (ratio − poachFrom), at most poachMax. */
  poachFrom: 1.5, poachSlope: 0.05, poachMax: 0.3,
  /** Kept at his old pay (the user's Keep): + underpaidSlope × the share he's short. */
  underpaidSlope: 0.5,
  /** How much prospects care about NIL opportunities, by stars (0-5; 1 = average, as the other pitch weights). */
  pitchWeight: [0.7, 0.7, 0.8, 1, 1.2, 1.4],
  /** A computer team offers only with room for at least this share of the dollars it means to offer. */
  offerAtLeast: 0.5,
};

/** Position groups for value. */
const GROUP: Record<string, string> = { QB: 'QB', HB: 'RB', FB: 'RB', WR: 'WR', TE: 'TE', LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL', OT: 'OL', OG: 'OL', LE: 'DL', RE: 'DL', DE: 'DL', DT: 'DL', LOLB: 'LB', MLB: 'LB', ROLB: 'LB', OLB: 'LB', LB: 'LB', CB: 'DB', FS: 'DB', SS: 'DB', S: 'DB', K: 'K', P: 'K' };
/**
 * Median value at the Power 4 median OVR, and growth per OVR point (fit to the medians and 90th percentiles).
 * The Power 4 median OVR isn't fixed: it's the group's OVR at `pct` among every player in the league each season
 * (the share below the Power 4 median at the start, 2026 v2.1.1-test20), so values follow the league if its
 * ratings drift over the years.
 */
const CURVE: Record<string, { v50: number; pct: number; k: number; max: number }> = {
  QB: { v50: 295550, pct: 0.638, k: 0.218, max: 6e6 },
  RB: { v50: 134550, pct: 0.694, k: 0.248, max: 2.5e6 },
  WR: { v50: 140285, pct: 0.65, k: 0.201, max: 3e6 },
  TE: { v50: 113000, pct: 0.665, k: 0.2, max: 1.5e6 },
  OL: { v50: 154600, pct: 0.643, k: 0.193, max: 3e6 },
  DL: { v50: 176500, pct: 0.71, k: 0.205, max: 3e6 },
  LB: { v50: 134000, pct: 0.579, k: 0.144, max: 2e6 },
  DB: { v50: 140000, pct: 0.637, k: 0.165, max: 2.5e6 },
  K: { v50: 40000, pct: 0.662, k: 0.22, max: 250000 },
};

/** A season's market: the money index and each group's anchor OVR (the Power 4 median's place in the league). */
export interface Market { index: number; anchor: Record<string, number>; /** Price level: makes the richer half's rosters worth what they can spend (absent = 1). */ scale?: number }

/**
 * The market of a season, from the league's players then. With the budgets, the price level clears the market: the
 * richer half of the schools' rosters are worth what those schools can spend on them (budget less the reserve), so
 * the money at the top is spent however the league's talent spreads out over the years.
 */
export function marketOf(players: DPlayer[], year: number, budgets?: number[]): Market {
  const by: Record<string, number[]> = {};
  for (const p of players) if (p.status === 'active' && p.team !== null) (by[GROUP[p.pos] ?? 'LB'] ??= []).push(p.ovr);
  const anchor: Record<string, number> = {};
  for (const [g, c] of Object.entries(CURVE)) {
    const xs = (by[g] ?? []).sort((a, b) => a - b);
    anchor[g] = xs.length ? xs[Math.min(xs.length - 1, Math.floor(c.pct * xs.length))] : 76;
  }
  const m: Market = { index: moneyIndex(year), anchor };
  if (budgets) {
    const rich = budgets.map((b, t) => ({ b, t })).sort((a, b) => b.b - a.b).slice(0, Math.ceil(budgets.length / 2));
    const want = rich.reduce((a, x) => a + x.b * (1 - NIL.reserve), 0);
    const have = rich.reduce((a, x) => a + rosterValue(activeOn(players, x.t), m), 0);
    if (have > 0) m.scale = clamp(want / have, 0.5, 3);
  }
  return m;
}
/** A high-school prospect's value by stars (QB), and by position as a share of a QB's. */
const STAR_VALUE = [2000, 5000, 15000, 75000, 400000, 1500000];
const POS_SHARE: Record<string, number> = { QB: 1, OL: 0.75, DL: 0.75, WR: 0.67, DB: 0.6, RB: 0.5, TE: 0.45, LB: 0.5, K: 0.04 };

/** Whether a dynasty has NIL. */
export const hasNil = (d: Dynasty) => !!d.nil && editionOf(d).id === '2026';

/** The money index of a year (2026 = 1). */
export const moneyIndex = (year: number) => NIL.growth ** Math.max(0, year - 2026);

/** A player's market value in a year: what a top program would pay him. */
export function marketValue(p: Pick<DPlayer, 'pos' | 'ovr'>, m: Market): number {
  const g = GROUP[p.pos] ?? 'LB', c = CURVE[g];
  return Math.round(clamp(c.v50 * Math.exp(c.k * (p.ovr - m.anchor[g])) * (m.scale ?? 1), NIL.floor, c.max) * m.index);
}

/** A high-school prospect's market value by stars. */
export function prospectValue(pos: string, stars: number, m: Market): number {
  return Math.round(Math.max(NIL.floor, STAR_VALUE[clamp(stars, 0, 5)] * (POS_SHARE[GROUP[pos] ?? 'LB'] ?? 0.5)) * m.index);
}

/** The conference base of a team in a season. */
function confBase(season: DSeason, team: number, stars: number): number {
  const name = season.confNames[season.conf[team]] ?? '';
  if (name in NIL.confBase) return NIL.confBase[name];
  // Independents and renamed conferences: by the school's prestige (Notre Dame near the top).
  return 1.5e6 + 4.2e6 * (stars - 1);
}

/** Booster money after a season: final poll place and record. */
function boostOf(rank: number, wins: number, losses: number, champ: boolean): number {
  let b = champ ? NIL.boostChamp : rank <= 4 ? NIL.boostTop4 : rank <= 12 ? NIL.boostTop12 : rank <= 25 ? NIL.boostTop25 : 0;
  if (losses > wins) b += NIL.boostLosing;
  return b;
}

/** Each team's NIL for a season: budget and booster share. */
export interface SeasonNil { budget: number[]; boost: number[]; market: Market }

/**
 * Next season's budgets, at the start of the offseason: the conference base (season `next` is the season about to
 * start; its conferences), the program's prestige stars, booster money built up from last season, the money index.
 */
export function nextBudgets(d: Dynasty, stars: number[]): SeasonNil {
  const s = d.seasons[d.seasons.length - 1];
  const v = seasonView(d, s);
  const prev = s.nil;
  const year = s.year + 1;
  const boost: number[] = [], budget: number[] = [];
  for (const t of d.teams) {
    const rec = v.records[t.index];
    const b = clamp((prev?.boost[t.index] ?? 0) * NIL.boostKeep + (v.save ? boostOf(v.rank[t.index], rec.w, rec.l, v.champion === t.index) : 0), NIL.boostMin, NIL.boostMax);
    boost.push(b);
    budget.push(Math.round(confBase(s, t.index, stars[t.index]) * (NIL.prestigeBase + NIL.prestigeStep * stars[t.index]) * (1 + b) * moneyIndex(year)));
  }
  return { budget, boost, market: marketOf(d.players, year, budget) };
}

/** The first season's budgets (no booster money yet). */
export function firstBudgets(d: Dynasty, stars: number[]): SeasonNil {
  const s = d.seasons[d.seasons.length - 1];
  const budget = d.teams.map((t) => Math.round(confBase(s, t.index, stars[t.index]) * (NIL.prestigeBase + NIL.prestigeStep * stars[t.index]) * moneyIndex(s.year)));
  return { budget, boost: d.teams.map(() => 0), market: marketOf(d.players, s.year, budget) };
}

const activeOn = (players: DPlayer[], team: number) => players.filter((p) => p.status === 'active' && p.team === team);

/** What a roster is worth at market value. */
export const rosterValue = (players: DPlayer[], m: Market) => players.reduce((a, p) => a + marketValue(p, m), 0);

/** A school's pay rate for its own players: its budget (less the reserve for newcomers) over what its roster is worth. */
export function payRate(budget: number, value: number): number {
  return clamp((budget * (1 - NIL.reserve)) / Math.max(1, value), NIL.rateMin, NIL.rateMax);
}

/**
 * What a school offers newcomers, as a share of their market value: its budget against a typical rich program's
 * (the median of the richer half), so the richest schools bid the most whatever their roster is worth.
 */
export function offerRates(budgets: number[], rates: number[]): number[] {
  const rich = budgets.slice().sort((a, b) => b - a).slice(0, Math.ceil(budgets.length / 2));
  const ref = rich[Math.floor(rich.length / 2)] || 1;
  // Never less than what it pays its own players.
  return budgets.map((b, t) => clamp(Math.max(b / ref, rates[t]), NIL.rateMin, NIL.offerMax));
}

/** Every team's pay rate now (for the players it has). */
export function payRates(players: DPlayer[], budgets: number[], m: Market): number[] {
  return budgets.map((b, t) => payRate(b, rosterValue(activeOn(players, t), m)));
}

/** What a player asks for next season at his school: his value at its pay rate. */
export const askOf = (p: DPlayer, rate: number, m: Market) => Math.max(NIL.floor, Math.round(marketValue(p, m) * rate));

/** A team's payroll (its active players' pay). */
export const payroll = (players: DPlayer[], team: number) => activeOn(players, team).reduce((a, p) => a + (p.nil ?? 0), 0);

/**
 * The NIL deals (one-year deals): every returning player gets his ask, except the ones a user team keeps at their
 * old pay (`keep`). Returns the players with their new pay and each kept player's shortfall (0-1, for the portal).
 */
export function nilDeals(players: DPlayer[], budgets: number[], m: Market, keep: Set<number> = new Set()): { players: DPlayer[]; short: Map<number, number> } {
  const rates = payRates(players, budgets, m);
  const short = new Map<number, number>();
  const out = players.map((p) => {
    if (p.status !== 'active' || p.team === null) return p;
    const ask = askOf(p, rates[p.team], m);
    if (keep.has(p.id) && p.nil !== undefined && p.nil < ask) { short.set(p.id, 1 - p.nil / ask); return p; }
    return { ...p, nil: ask };
  });
  return { players: out, short };
}

/** The pay every player starts a dynasty with: his ask at his school (no reserve kept). */
export function startingPay(players: DPlayer[], budgets: number[], m: Market): DPlayer[] {
  return nilDeals(players, budgets, m).players;
}

/**
 * The extra transfer chance money gives a player: another school that would start him pays `ratio` times as much
 * (he'd get his value at its rate), and a shortfall when his team kept him at his old pay.
 * `bestRate` = the highest pay rate among the schools that would start him (not his own).
 */
export function moneyPull(p: DPlayer, bestRate: number, m: Market, short = 0): number {
  const pay = Math.max(NIL.floor, p.nil ?? 0);
  const ratio = (marketValue(p, m) * bestRate) / pay;
  return clamp(NIL.poachSlope * (ratio - NIL.poachFrom), 0, NIL.poachMax) + NIL.underpaidSlope * short;
}

/** What a school's offer does to a prospect's interest: its dollars against what he expects. */
export function moneyFactor(offer: number, value: number, stars: number): number {
  const expect = Math.max(NIL.floor, value * NIL.expectRate[clamp(stars, 0, 5)]);
  return clamp((Math.max(0, offer) / expect) ** NIL.moneyPower, NIL.moneyMin, NIL.moneyMax);
}

/** The NIL opportunities pitch, 0-1: the school's budget against the richest program's base (money index out). */
export function nilPitch(budget: number, m: Market): number {
  return clamp(Math.sqrt(budget / m.index / 30e6), 0, 1);
}

/** Format dollars as the pages show them ($1.2M, $350K, $8K). */
export function money(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  return `$${Math.round(v / 1000)}K`;
}

/** Turns NIL on for a new 2026 dynasty: the first season's budgets and every player's starting pay. */
export function enableNil(d: Dynasty): Dynasty {
  if (editionOf(d).id !== '2026') return d;
  const s = d.seasons[d.seasons.length - 1];
  const nil = firstBudgets(d, seasonPrestige(d, s));
  return { ...d, nil: { on: true }, players: startingPay(d.players, nil.budget, nil.market), seasons: [...d.seasons.slice(0, -1), { ...s, nil }] };
}
