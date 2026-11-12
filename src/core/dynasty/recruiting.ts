// Full recruiting for the offseason (the later replacement of the random signing classes): five
// weeks in which every team spends recruiting points on prospects, high-school recruits and players
// in the transfer portal alike; prospects commit when one team's interest is high enough and clearly
// ahead; signing day settles the rest.
//
//   portalEntries    who leaves his team for the portal (bench players after two seasons; see
//                    transferChance); they become prospects
//   startRecruiting  the high-school pool (sized to the open spots, positions by the country's needs),
//                    each prospect's priorities (playing time, prestige, close to home)
//   runRecruitingWeek  CPU teams pick targets and offers; the user teams' plans; interest, commitments,
//                    flips
//   signingDay       uncommitted prospects pick among the teams that offered; then cuts as before
//
// Interest gained in a week = points × (0.5 + fit) × (1.2 with an offer, 0.6 without) × reach (a
// prospect above the school's prestige level is harder to reach), where fit =
// his priorities · (playing time he'd get, prestige, closeness to home). He commits when the leader
// reaches the threshold for his stars, leads the second by 25% and has offered with a spot open; the
// best prospects don't decide before week 3 (4★) or 4 (5★).

import { rng, type DPlayer, type Dynasty, type OffseasonEvent } from './model';
import { CLASS_MAX, POSITIONS, POS_TARGET, ROSTER_LIMIT, STAR_POINTS, benchSeasons, drawStars, fillMinimums, makeRecruit, prestige, prestigeStars, suggestCuts, transferChance, type RecruitTemplates } from './offseason';
import { closeness } from './schoolStates';

export const WEEKS = 5;
export const WEEKLY_POINTS = 1000;
export const MAX_PER_PROSPECT = 60;
export const BOARD_SIZE = 35;
/** Interest a prospect needs from a team before he commits, by stars (portal players decide sooner). */
const THRESHOLD = [40, 60, 100, 160, 230, 320];
/** The first week a prospect may commit, by stars (the best take their time; portal players a week sooner). */
const FIRST_WEEK = [1, 1, 2, 2, 3, 4];

export interface Prospect {
  /** Negative for high-school recruits (a player ID only when he signs), the player's ID for portal players. */
  id: number;
  player: DPlayer;
  stars: number;
  /** Team he left, for a portal player. */
  from: number | null;
  /** How much he cares about playing time, prestige and being close to home (they add up to 1). */
  wants: { pt: number; prestige: number; home: number };
  interest: Record<number, number>;
  offers: number[];
  committed: number | null;
}

export interface TeamPlan {
  /** Points per prospect this week (at most 150 each, 1,000 in all). */
  points: Record<number, number>;
  /** Prospects to offer a scholarship (offers stay). */
  offers: number[];
}

export interface RecruitingState {
  week: number;
  prospects: Prospect[];
  /** Open scholarships per team when recruiting started. */
  spots: Record<number, number>;
  /** Each week's commitments and flips, newest last. */
  log: { week: number; prospect: number; team: number; flipFrom?: number }[];
  /** The user teams' plans as they were last used (the page starts from them). */
  plans: Record<number, TeamPlan>;
}

type Rand = () => number;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const seeded = (seed: number, salt: number) => rng((seed ^ Math.imul(salt + 11, 0x85ebca6b)) >>> 0);

/** Random priorities that add up to 1. */
function wants(r: Rand) {
  const a = -Math.log(1 - r()), b = -Math.log(1 - r()), c = -Math.log(1 - r());
  const s = a + b + c;
  return { pt: a / s, prestige: b / s, home: c / s };
}

/** Stars a portal player counts as (by OVR). */
const portalStars = (ovr: number) => (ovr >= 85 ? 5 : ovr >= 80 ? 4 : ovr >= 74 ? 3 : ovr >= 68 ? 2 : 1);

const roster = (d: Dynasty, team: number) => d.players.filter((p) => p.status === 'active' && p.team === team);

// ---- 1. the portal: who leaves

/** Who enters the portal (full recruiting): the same rule as the random version (transferChance). */
export function portalEntries(d: Dynasty, seed: number): DPlayer[] {
  const r = seeded(seed, 21);
  const benched = benchSeasons(d);
  return d.players.filter((p) => p.status === 'active' && p.team !== null && r() < transferChance(d, p, benched));
}

// ---- 2. the pool

/** The high-school pool and the portal players, as prospects with priorities. */
export function startRecruiting(d: Dynasty, tpl: RecruitTemplates, portal: DPlayer[], seed: number, year: number): RecruitingState {
  const r = seeded(seed, 22);
  const portalIds = new Set(portal.map((p) => p.id));
  const spots: Record<number, number> = {};
  const need: Record<string, number> = {};
  for (const t of d.teams) {
    const team = roster(d, t.index).filter((p) => !portalIds.has(p.id));
    spots[t.index] = clamp(ROSTER_LIMIT - team.length, 0, CLASS_MAX);
    for (const pos of POSITIONS) need[pos] = (need[pos] ?? 0) + Math.max(0, POS_TARGET[pos] - team.filter((p) => p.pos === pos).length);
  }
  const totalSpots = Object.values(spots).reduce((a, b) => a + b, 0);
  const totalNeed = Object.values(need).reduce((a, b) => a + b, 0) || 1;
  // About 1.4 prospects per open spot; positions in proportion to the country's needs.
  const size = Math.round(totalSpots * 1.4) - portal.length;
  const prospects: Prospect[] = [];
  let tempId = -1;
  for (let k = 0; k < size; k++) {
    let x = r() * totalNeed, pos = POSITIONS[0];
    for (const p of POSITIONS) if ((x -= need[p]) <= 0) { pos = p; break; }
    const stars = drawStars(r, 0.45);
    const player = makeRecruit(d, tpl, r, tempId, -1, pos, stars, year);
    prospects.push({ id: tempId--, player: { ...player, team: null }, stars, from: null, wants: wants(r), interest: {}, offers: [], committed: null });
  }
  for (const p of portal) {
    prospects.push({ id: p.id, player: p, stars: portalStars(p.ovr), from: p.team, wants: { ...wants(r), pt: 0.5 + 0.5 * r() }, interest: {}, offers: [], committed: null });
  }
  // Portal players' priorities: mostly playing time (renormalized).
  for (const pr of prospects) {
    const s = pr.wants.pt + pr.wants.prestige + pr.wants.home;
    pr.wants = { pt: pr.wants.pt / s, prestige: pr.wants.prestige / s, home: pr.wants.home / s };
  }
  return { week: 0, prospects, spots, log: [], plans: {} };
}

// ---- 3. a week

/**
 * How far a school's pitch reaches a prospect of some stars: full when its prestige is at or above
 * his level (a 6-star program for a 5-star player), 20% less for each star he is above it.
 */
export const reach = (stars: number, prestigeStars: number) => clamp(1 - 0.2 * (stars - (prestigeStars - 1)), 0.3, 1.15);

/** What the week's decisions read, computed once: each team's OVRs by position (portal players out) and prestige. */
export interface WeekContext {
  depth: Map<number, Map<string, number[]>>;
  prestige: Map<number, number>;
  stars: Map<number, number>;
  portalIds: Set<number>;
}

export function weekContext(d: Dynasty, rs: RecruitingState): WeekContext {
  const portalIds = new Set(rs.prospects.filter((p) => p.id > 0).map((p) => p.id));
  const depth = new Map<number, Map<string, number[]>>(d.teams.map((t) => [t.index, new Map()]));
  const add = (team: number, pos: string, ovr: number) => {
    const m = depth.get(team)!;
    m.set(pos, [...(m.get(pos) ?? []), ovr]);
  };
  for (const p of d.players) if (p.status === 'active' && p.team !== null && !portalIds.has(p.id)) add(p.team, p.pos, p.ovr);
  for (const q of rs.prospects) if (q.committed !== null) add(q.committed, q.player.pos, q.player.ovr);
  return { depth, prestige: new Map(d.teams.map((t) => [t.index, prestige(d, t.index)])), stars: new Map(d.teams.map((t) => [t.index, prestigeStars(d, t.index)])), portalIds };
}

/** How well a team fits what a prospect wants, 0-1. */
export function fit(d: Dynasty, ctx: WeekContext, pr: Prospect, team: number): number {
  const ahead = (ctx.depth.get(team)!.get(pr.player.pos) ?? []).filter((o) => o > pr.player.ovr).length;
  const starters = Math.max(1, Math.round((POS_TARGET[pr.player.pos] ?? 4) / 3));
  const pt = ahead < starters ? 1 : ahead < starters + 1 ? 0.65 : ahead < starters + 3 ? 0.35 : 0.15;
  const home = closeness(pr.player.state, d.teams[team].school);
  const v = pr.wants.pt * pt + pr.wants.prestige * ctx.prestige.get(team)! + pr.wants.home * home;
  return pr.from === team ? v * 0.3 : v; // a portal player rarely goes back
}

/** A CPU team's plan for the week: targets by need and level, points by fit and stars. */
export function cpuPlan(d: Dynasty, rs: RecruitingState, ctx: WeekContext, team: number, r: Rand): TeamPlan {
  const pres = ctx.prestige.get(team)!;
  const committed = rs.prospects.filter((p) => p.committed === team);
  const open = rs.spots[team] - committed.length;
  if (open <= 0) return { points: {}, offers: [] };
  const counts: Record<string, number> = {};
  for (const [pos, list] of ctx.depth.get(team)!) counts[pos] = list.length;
  const maxStar = clamp(2 + Math.round(pres * 4), 1, 5);
  const minStar = Math.max(1, maxStar - 2);
  const cands = rs.prospects
    .filter((p) => (p.committed === null || (p.committed !== team && p.stars >= 4 && ctx.stars.get(team)! > ctx.stars.get(p.committed)! + 1)) && p.stars <= maxStar && p.stars >= minStar && (POS_TARGET[p.player.pos] ?? 0) - (counts[p.player.pos] ?? 0) > 0 && p.from !== team)
    .map((p) => ({ p, score: (p.stars + 1) * (0.3 + fit(d, ctx, p, team)) * ((POS_TARGET[p.player.pos] ?? 0) - (counts[p.player.pos] ?? 0)) * (0.7 + 0.6 * r()) + (p.interest[team] ?? 0) / 400 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(BOARD_SIZE, open + 6));
  // Points go mostly to the best targets (score squared), up to the most one prospect can take.
  const total = cands.reduce((a, c) => a + c.score * c.score, 0) || 1;
  const points: Record<number, number> = {};
  let left = WEEKLY_POINTS;
  for (const c of cands) {
    const pts = Math.min(MAX_PER_PROSPECT, left, Math.round((WEEKLY_POINTS * c.score * c.score) / total));
    if (pts <= 0) continue;
    points[c.p.id] = pts;
    left -= pts;
  }
  return { points, offers: cands.slice(0, open + 6).map((c) => c.p.id) };
}

/** Why a user team's plan can't be used (empty when it can). */
export function planProblems(plan: TeamPlan): string[] {
  const out: string[] = [];
  const vals = Object.values(plan.points);
  const total = vals.reduce((a, b) => a + b, 0);
  if (vals.some((v) => v < 0 || !Number.isFinite(v))) out.push('Points must be zero or more.');
  if (vals.some((v) => v > MAX_PER_PROSPECT)) out.push(`At most ${MAX_PER_PROSPECT} points for one prospect a week.`);
  if (total > WEEKLY_POINTS) out.push(`That's ${total} points: you have ${WEEKLY_POINTS} a week.`);
  if (Object.keys(plan.points).length > BOARD_SIZE) out.push(`At most ${BOARD_SIZE} prospects on your board.`);
  return out;
}

/**
 * One week of recruiting: every team spends its points (CPU teams by their own plan, user teams by
 * theirs), interest grows, prospects commit or flip. Returns the new state (the input is left as it is).
 */
export function runRecruitingWeek(d: Dynasty, rs0: RecruitingState, userPlans: Record<number, TeamPlan>, seed: number): RecruitingState {
  if (rs0.week >= WEEKS) throw new Error('Recruiting is over: it\'s signing day.');
  for (const [t, p] of Object.entries(userPlans)) {
    const bad = planProblems(p);
    if (bad.length) throw new Error(`${d.teams[Number(t)].school}: ${bad.join(' ')}`);
  }
  const r = seeded(seed, 100 + rs0.week);
  const rs: RecruitingState = { ...rs0, prospects: rs0.prospects.map((p) => ({ ...p, interest: { ...p.interest }, offers: p.offers.slice() })), log: rs0.log.slice(), plans: { ...rs0.plans, ...userPlans } };
  const ctx = weekContext(d, rs);
  const byId = new Map(rs.prospects.map((p) => [p.id, p]));
  // Plans: user teams as given, the rest by the computer.
  const plans = new Map<number, TeamPlan>();
  for (const t of d.teams) plans.set(t.index, d.userTeams.includes(t.index) ? (userPlans[t.index] ?? { points: {}, offers: [] }) : cpuPlan(d, rs, ctx, t.index, r));
  for (const [team, plan] of plans) {
    for (const id of plan.offers) {
      const p = byId.get(id);
      if (p && !p.offers.includes(team)) p.offers.push(team);
    }
    for (const [idS, pts] of Object.entries(plan.points)) {
      const p = byId.get(Number(idS));
      if (!p || pts <= 0) continue;
      const f = fit(d, ctx, p, team);
      p.interest[team] = (p.interest[team] ?? 0) + pts * (0.5 + f) * (p.offers.includes(team) ? 1.2 : 0.6) * reach(p.stars, ctx.stars.get(team)!) * (0.85 + 0.3 * r());
    }
  }
  // Commitments and flips (best prospects decide first, so spots go to them).
  const count = new Map<number, number>();
  for (const p of rs.prospects) if (p.committed !== null) count.set(p.committed, (count.get(p.committed) ?? 0) + 1);
  const committedCount = (team: number) => count.get(team) ?? 0;
  for (const p of rs.prospects.slice().sort((a, b) => b.stars - a.stars || b.player.ovr - a.player.ovr)) {
    const ranked = Object.entries(p.interest).map(([t, v]) => ({ t: Number(t), v })).sort((a, b) => b.v - a.v);
    const top = ranked.find((x) => p.offers.includes(x.t) && (committedCount(x.t) < rs.spots[x.t] || p.committed === x.t));
    if (!top) continue;
    const second = ranked.find((x) => x.t !== top.t)?.v ?? 0;
    const need = THRESHOLD[p.stars] * (p.id > 0 ? 0.7 : 1);
    if (rs.week + 1 < FIRST_WEEK[p.stars] - (p.id > 0 ? 1 : 0)) continue;
    if (p.committed === null) {
      if (top.v >= need && top.v >= 1.25 * second) {
        p.committed = top.t;
        count.set(top.t, committedCount(top.t) + 1);
        rs.log.push({ week: rs.week + 1, prospect: p.id, team: top.t });
      }
    } else if (top.t !== p.committed && top.v >= 1.5 * (p.interest[p.committed] ?? 0) && r() < 0.5) {
      rs.log.push({ week: rs.week + 1, prospect: p.id, team: top.t, flipFrom: p.committed });
      count.set(p.committed, committedCount(p.committed) - 1);
      count.set(top.t, committedCount(top.t) + 1);
      p.committed = top.t;
    }
  }
  rs.week++;
  return rs;
}

/**
 * Signing day: committed prospects sign; the others pick the team that offered with the most interest
 * and a spot left; portal players nobody takes leave, unsigned high-school players aren't kept.
 * Returns the players (recruits get real IDs) and the events.
 */
export function signingDay(d: Dynasty, rs: RecruitingState, year: number): { players: DPlayer[]; events: OffseasonEvent[] } {
  const prs = rs.prospects.map((p) => ({ ...p }));
  const count = new Map<number, number>();
  for (const p of prs) if (p.committed !== null) count.set(p.committed, (count.get(p.committed) ?? 0) + 1);
  // Who each team has at each position (portal players out), with its commitments.
  const portalIds = new Set(prs.filter((p) => p.id > 0).map((p) => p.id));
  const counts = new Map(d.teams.map((t) => [t.index, new Map<string, number>()]));
  const bump = (team: number, pos: string) => counts.get(team)!.set(pos, (counts.get(team)!.get(pos) ?? 0) + 1);
  for (const p of d.players) if (p.status === 'active' && p.team !== null && !portalIds.has(p.id)) bump(p.team, p.pos);
  for (const p of prs) if (p.committed !== null) bump(p.committed, p.player.pos);
  const needs = (team: number, pos: string) => (POS_TARGET[pos] ?? 0) - (counts.get(team)!.get(pos) ?? 0) > 0;
  // The uncommitted pick the school that offered with the most interest, a spot left and a need at his position.
  for (const p of prs.filter((x) => x.committed === null).sort((a, b) => b.stars - a.stars || b.player.ovr - a.player.ovr)) {
    const best = Object.entries(p.interest).map(([t, v]) => ({ t: Number(t), v }))
      .filter((x) => p.offers.includes(x.t) && (count.get(x.t) ?? 0) < rs.spots[x.t] && needs(x.t, p.player.pos)).sort((a, b) => b.v - a.v)[0];
    if (best) {
      p.committed = best.t;
      count.set(best.t, (count.get(best.t) ?? 0) + 1);
      bump(best.t, p.player.pos);
    }
  }
  // Late signings: teams with spots left take the best high-school players nobody signed, at
  // positions they need first (round by round, the stronger programs first in each round).
  const left = prs.filter((p) => p.committed === null && p.id < 0).sort((a, b) => b.stars - a.stars || b.player.ovr - a.player.ovr);
  const order = d.teams.map((t) => ({ t: t.index, pres: prestige(d, t.index) })).sort((a, b) => b.pres - a.pres).map((x) => x.t);
  for (let round = 0; round < CLASS_MAX && left.length; round++) {
    for (const t of order) {
      if ((count.get(t) ?? 0) >= rs.spots[t] || !left.length) continue;
      const c = counts.get(t)!;
      const k = left.findIndex((p) => (POS_TARGET[p.player.pos] ?? 0) - (c.get(p.player.pos) ?? 0) > 0);
      if (k < 0) continue;
      const p = left.splice(k, 1)[0];
      p.committed = t;
      count.set(t, (count.get(t) ?? 0) + 1);
      c.set(p.player.pos, (c.get(p.player.pos) ?? 0) + 1);
    }
  }
  const players = d.players.slice();
  let nextId = players.reduce((a, p) => Math.max(a, p.id), 0) + 1;
  const events: OffseasonEvent[] = [];
  const points = new Map<number, { points: number; signed: number }>();
  for (const p of prs) {
    if (p.id > 0) {
      // A portal player.
      const old = players[p.id - 1];
      const to = p.committed;
      players[p.id - 1] = to === null
        ? { ...old, team: null, status: 'transferred', leftYear: year - 1, transfers: [...(old.transfers ?? []), { year: year - 1, from: old.team!, to: null }] }
        : { ...old, team: to, transfers: [...(old.transfers ?? []), { year: year - 1, from: old.team!, to }] };
      events.push({ kind: 'transfer', player: p.id, from: old.team!, to, ovr: old.ovr });
    } else if (p.committed !== null) {
      const id = nextId++;
      players.push({ ...p.player, id, team: p.committed, recruit: { stars: p.stars, year } });
      events.push({ kind: 'signed', player: id, team: p.committed, stars: p.stars, ovr: p.player.ovr });
      const c = points.get(p.committed) ?? { points: 0, signed: 0 };
      points.set(p.committed, { points: c.points + STAR_POINTS[p.stars], signed: c.signed + 1 });
    }
  }
  [...points.entries()].sort((a, b) => b[1].points - a[1].points || a[0] - b[0])
    .forEach(([team, c], i) => events.push({ kind: 'class', team, rank: i + 1, signed: c.signed, points: c.points }));
  return { players, events };
}

/** A prospect's interest from each team, best first. */
export const interestRanking = (p: Prospect) => Object.entries(p.interest).map(([t, v]) => ({ team: Number(t), v })).sort((a, b) => b.v - a.v);

// ---- the offseason steps (full recruiting instead of random signing classes)

/** After departures: who enters the portal, the high-school pool, week 0 of recruiting. */
export function openRecruiting(d: Dynasty, tpl: RecruitTemplates): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'portal') throw new Error('Recruiting starts after the departures.');
  const portal = portalEntries(d, st.seed);
  const recruiting = startRecruiting(d, tpl, portal, st.seed, st.year + 1);
  return { ...d, offseason: { ...st, step: 'recruiting', mode: 'full', recruiting } };
}

/** One recruiting week with the user teams' plans. */
export function recruitingWeek(d: Dynasty, userPlans: Record<number, TeamPlan>): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'recruiting' || !st.recruiting) throw new Error('It isn\'t recruiting time.');
  return { ...d, offseason: { ...st, recruiting: runRecruitingWeek(d, st.recruiting, userPlans, st.seed) } };
}

/** After the last week: signing day, then the cuts. */
export function finishRecruiting(d: Dynasty, tpl: RecruitTemplates): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'recruiting' || !st.recruiting) throw new Error('It isn\'t recruiting time.');
  if (st.recruiting.week < WEEKS) throw new Error(`Recruiting has ${WEEKS - st.recruiting.week} weeks left.`);
  const { players: signed, events } = signingDay(d, st.recruiting, st.year + 1);
  const players = fillMinimums(d, signed, tpl, seeded(st.seed, 30), st.year + 1, events);
  const next: Dynasty = { ...d, players, offseason: { ...st, step: 'cuts', recruiting: undefined, events: [...st.events, ...events] } };
  const suggestedCuts: Record<number, number[]> = {};
  for (const t of d.userTeams) suggestedCuts[t] = suggestCuts(next, t);
  return { ...next, offseason: { ...next.offseason!, suggestedCuts } };
}
