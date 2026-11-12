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
import { rulesOf, type OffseasonRules } from './rules';
import { academicsOf } from './academics';
import { seasonView } from './derive';
import { POSITIONS, POS_TARGET, ROSTER_LIMIT, STAR_POINTS, chooseTransfers, drawStars, fillMinimums, makeRecruit, prestige, prestigeStars, suggestCuts, type RecruitTemplates } from './offseason';
import { SCHOOL_STATE, closeness, stateCode } from './schoolStates';

// The numbers below come from the dynasty's offseason rules (rules.ts): weeks, points, board, scouting,
// thresholds, pitches. Defaults: 5 weeks, 1,000 points a week, 60 a prospect, a board of 35.
/**
 * Scouting (user, 2026-11-12): a user team sees a high-school prospect's stars, position, hometown and
 * size; scouting reveals his OVR (10 points), then all his ratings (20 more; both in one week is fine).
 * The points come out of the week's 1,000 and don't count toward a prospect's 60. What's revealed stays
 * revealed. Portal players have played college ball: everything shows. CPU teams don't scout.
 */
/** Scouting costs by level (0, OVR, all ratings). */
export const scoutCosts = (R: OffseasonRules) => [0, R.scoutOvr, R.scoutRatings];
export type ScoutLevel = 0 | 1 | 2;

export interface Prospect {
  /** Negative for high-school recruits (a player ID only when he signs), the player's ID for portal players. */
  id: number;
  player: DPlayer;
  stars: number;
  /** Team he left, for a portal player. */
  from: number | null;
  /** How much he cares about playing time, prestige and being close to home (they add up to 1). */
  wants: Wants;
  interest: Record<number, number>;
  offers: number[];
  committed: number | null;
}

export interface TeamPlan {
  /** Points per prospect this week (rules: per prospect and in all). */
  points: Record<number, number>;
  /** Prospects to offer a scholarship (offers stay). */
  offers: number[];
  /** The pitch made to a prospect this week (optional). */
  pitches?: Record<number, PitchKey>;
}

/** The five pitches. */
export type PitchKey = 'pt' | 'prestige' | 'home' | 'academics' | 'contender';
export const PITCHES: PitchKey[] = ['pt', 'prestige', 'home', 'academics', 'contender'];
/** A prospect's reaction to a pitch: his interest and the school strong (good), in between (ok), weak (bad); not his interest (no). */
export type PitchReaction = 'good' | 'ok' | 'bad' | 'no';

export interface RecruitingState {
  week: number;
  prospects: Prospect[];
  /** Open scholarships per team when recruiting started. */
  spots: Record<number, number>;
  /** Each week's commitments and flips, newest last. */
  log: { week: number; prospect: number; team: number; flipFrom?: number }[];
  /** The user teams' plans as they were last used (the page starts from them). */
  plans: Record<number, TeamPlan>;
  /** Per user team, how far it has scouted each prospect (1 OVR, 2 all ratings). */
  scouted: Record<number, Record<number, ScoutLevel>>;
  /** Per user team, points spent on scouting this week. */
  scoutSpent: Record<number, number>;
  /** Per user team and prospect, his reactions to the pitches made so far (user, 2026-11-12). */
  reactions?: Record<number, Record<number, Partial<Record<PitchKey, PitchReaction>>>>;
}

type Rand = () => number;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const seeded = (seed: number, salt: number) => rng((seed ^ Math.imul(salt + 11, 0x85ebca6b)) >>> 0);

/**
 * What a prospect cares about (his pitches), adding up to 1: random, then by stars (user, 2026-11-12: "3
 * star and lower should have more chance of Location pitch. Higher star recruits, Program Prestige").
 */
export interface Wants { pt: number; prestige: number; home: number; academics: number; contender: number }
const exp1 = (r: Rand) => -Math.log(1 - r());
/** His pitches (rules: pitch weights by stars; academics and championship contender from 2026-11-12). */
function wants(R: OffseasonRules, r: Rand, stars = 3, pt?: number): Wants {
  const w = { pt: pt ?? exp1(r), prestige: exp1(r) * R.pitchPrestige[stars], home: exp1(r) * R.pitchHome[stars], academics: exp1(r) * R.pitchAcademics[stars], contender: exp1(r) * R.pitchContender[stars] };
  const s = w.pt + w.prestige + w.home + w.academics + w.contender || 1;
  return { pt: w.pt / s, prestige: w.prestige / s, home: w.home / s, academics: w.academics / s, contender: w.contender / s };
}

/** Stars a portal player counts as (by OVR). */
const portalStars = (ovr: number) => (ovr >= 85 ? 5 : ovr >= 80 ? 4 : ovr >= 74 ? 3 : ovr >= 68 ? 2 : 1);

const roster = (d: Dynasty, team: number) => d.players.filter((p) => p.status === 'active' && p.team === team);

// ---- 1. the portal: who leaves

/** Who enters the portal (full recruiting): the players chosen with the departures (transferChance). */
export function portalEntries(d: Dynasty, seed: number): DPlayer[] {
  return (d.offseason?.portal ?? chooseTransfers(d, seed)).map((id) => d.players[id - 1]).filter((p) => p.status === 'active' && p.team !== null);
}

// ---- 2. the pool

/** The high-school pool and the portal players, as prospects with priorities. */
export function startRecruiting(d: Dynasty, tpl: RecruitTemplates, portal: DPlayer[], seed: number, year: number): RecruitingState {
  const R = rulesOf(d);
  const r = seeded(seed, 22);
  const portalIds = new Set(portal.map((p) => p.id));
  const spots: Record<number, number> = {};
  const need: Record<string, number> = {};
  for (const t of d.teams) {
    const team = roster(d, t.index).filter((p) => !portalIds.has(p.id));
    spots[t.index] = clamp(ROSTER_LIMIT - team.length, 0, R.classMax);
    for (const pos of POSITIONS) need[pos] = (need[pos] ?? 0) + Math.max(0, POS_TARGET[pos] - team.filter((p) => p.pos === pos).length);
  }
  const totalSpots = Object.values(spots).reduce((a, b) => a + b, 0);
  const totalNeed = Object.values(need).reduce((a, b) => a + b, 0) || 1;
  // About 1.4 prospects per open spot; positions in proportion to the country's needs.
  const size = Math.round(totalSpots * R.poolPerSpot) - portal.length;
  const prospects: Prospect[] = [];
  let tempId = -1;
  for (let k = 0; k < size; k++) {
    let x = r() * totalNeed, pos = POSITIONS[0];
    for (const p of POSITIONS) if ((x -= need[p]) <= 0) { pos = p; break; }
    const stars = drawStars(r, 0.45);
    const player = makeRecruit(d, tpl, r, tempId, -1, pos, stars, year);
    prospects.push({ id: tempId--, player: { ...player, team: null }, stars, from: null, wants: wants(R, r, stars), interest: {}, offers: [], committed: null });
  }
  for (const p of portal) {
    prospects.push({ id: p.id, player: p, stars: portalStars(p.ovr), from: p.team, wants: wants(R, r, portalStars(p.ovr), R.portalPlayingTime + 0.5 * r()), interest: {}, offers: [], committed: null });
  }
  topSchools(d, prospects, r);
  // A user team's own players in the portal start on its board (user: "i should have a good chance at
  // being able to recruit him back").
  const plans: Record<number, TeamPlan> = {};
  for (const u of d.userTeams) {
    const own = prospects.filter((pr) => pr.from === u);
    if (own.length) plans[u] = { points: Object.fromEntries(own.map((pr) => [pr.id, 0])), offers: [] };
  }
  return { week: 0, prospects, spots, log: [], plans, scouted: {}, scoutSpent: {} };
}

/** Interest a prospect needs from a school to commit (portal players less: rules). */
export const commitNeed = (R: OffseasonRules, pr: Pick<Prospect, 'stars' | 'id'>) => R.commitThreshold[pr.stars] * (pr.id > 0 ? R.portalThreshold : 1);

/**
 * Every prospect starts with five interested schools (user, 2026-11-12: "every recruit should start with a
 * list of his interested/top schools. Maybe 5?"): schools whose prestige reaches him, close to home, that
 * need his position, with chance. A portal player's old school is his third (user: "Players transferring
 * from a school should have that school somewhere in their top schools. 3rd?").
 */
function topSchools(d: Dynasty, prospects: Prospect[], r: Rand) {
  const R = rulesOf(d);
  const stars = new Map(d.teams.map((t) => [t.index, prestigeStars(d, t.index)]));
  const counts = new Map(d.teams.map((t) => [t.index, new Map<string, number>()]));
  for (const p of d.players) if (p.status === 'active' && p.team !== null) counts.get(p.team)!.set(p.pos, (counts.get(p.team)!.get(p.pos) ?? 0) + 1);
  for (const pr of prospects) {
    const need = commitNeed(R, pr);
    const scored = d.teams.filter((t) => t.index !== pr.from).map((t) => {
      const short = (POS_TARGET[pr.player.pos] ?? 0) - (counts.get(t.index)!.get(pr.player.pos) ?? 0) > 0;
      return { t: t.index, w: reach(pr.stars, stars.get(t.index)!) * (0.4 + closeness(pr.player.state, t.school)) * (short ? 1.3 : 1) * (0.5 + r()) };
    }).sort((a, b) => b.w - a.w);
    const top = scored.slice(0, 5).map((x) => x.t);
    if (pr.from !== null) top.splice(2, 0, pr.from), top.pop();
    top.forEach((t, i) => { pr.interest[t] = Math.round(R.topStart[i] * need); });
  }
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
  /** Championship Contender, 0-1 (contenderScores). */
  contender: Map<number, number>;
  /** Each team's pipeline states (pipelineStates). */
  pipelines: Map<number, Set<string>>;
}

/**
 * Pipeline states (user, 2026-11-12: "if a team has 4(?) players from a state, it becomes a pipeline and
 * slightly lowers (not as much as in-state) the recruiting cost"): states with at least pipelineMin players
 * on the team (its active roster), with the count.
 */
export function pipelineStates(d: Dynasty, team: number): { state: string; n: number }[] {
  const R = rulesOf(d);
  const c = new Map<string, number>();
  for (const p of d.players) if (p.status === 'active' && p.team === team) { const s = stateCode(p.state); if (s) c.set(s, (c.get(s) ?? 0) + 1); }
  return [...c].filter(([, n]) => n >= R.pipelineMin).map(([state, n]) => ({ state, n })).sort((a, b) => b.n - a.n || a.state.localeCompare(b.state));
}

/** How far a school's points go with a prospect (user: "In-state recruits should have lower recruiting costs"). */
export function pointValue(d: Dynasty, ctx: Pick<WeekContext, 'pipelines'>, pr: Prospect, team: number): number {
  const R = rulesOf(d);
  const s = stateCode(pr.player.state);
  if (s && SCHOOL_STATE[d.teams[team].school] === s) return R.inStateBoost;
  return s && ctx.pipelines.get(team)?.has(s) ? R.pipelineBoost : 1;
}

/**
 * Championship Contender (user, 2026-11-12: "look at last year's results and the current roster so far,
 * eg. a top returning class means the team has a shot"), 0-1 per team: last season's final poll place
 * (top 4: 1, then less down to 0 at 64th) and the roster as it stands (its best 22 OVRs, commitments in,
 * portal players out), ranked against the country; weighted by the rules (contenderLastSeason).
 */
export function contenderScores(d: Dynasty, depth: Map<number, Map<string, number[]>>): Map<number, number> {
  const R = rulesOf(d);
  const v = seasonView(d, d.seasons[d.seasons.length - 1]);
  const strength = d.teams.map((t) => {
    const all = [...depth.get(t.index)!.values()].flat().sort((a, b) => b - a).slice(0, 22);
    return { t: t.index, s: all.reduce((a, b) => a + b, 0) / Math.max(1, all.length) };
  }).sort((a, b) => b.s - a.s);
  const n = strength.length;
  const out = new Map<number, number>();
  strength.forEach((x, i) => {
    const rank = v.save ? v.rank[x.t] : 69;
    const last = rank <= 4 ? 1 : clamp(1 - (rank - 4) / 60, 0, 1);
    const now = (1 - i / (n - 1)) ** 2;
    out.set(x.t, R.contenderLastSeason * last + (1 - R.contenderLastSeason) * now);
  });
  return out;
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
  return { depth, prestige: new Map(d.teams.map((t) => [t.index, prestige(d, t.index)])), stars: new Map(d.teams.map((t) => [t.index, prestigeStars(d, t.index)])), portalIds, contender: contenderScores(d, depth), pipelines: new Map(d.teams.map((t) => [t.index, new Set(pipelineStates(d, t.index).map((x) => x.state))])) };
}

/** How well a team fits what a prospect wants, 0-1. */
/** How good a school is at each pitch for this prospect, 0-1. */
export function pitchScores(d: Dynasty, ctx: WeekContext, pr: Prospect, team: number): Record<PitchKey, number> {
  const ahead = (ctx.depth.get(team)!.get(pr.player.pos) ?? []).filter((o) => o > pr.player.ovr).length;
  const starters = Math.max(1, Math.round((POS_TARGET[pr.player.pos] ?? 4) / 3));
  const pt = ahead < starters ? 1 : ahead < starters + 1 ? 0.65 : ahead < starters + 3 ? 0.35 : 0.15;
  return {
    pt, prestige: ctx.prestige.get(team)!, home: closeness(pr.player.state, d.teams[team].school),
    academics: academicsOf(d.teams[team].school), contender: ctx.contender.get(team)!,
  };
}

/** How well a school fits what he wants: each pitch's weight for him × the school's score (his old school too). */
export function fit(d: Dynasty, ctx: WeekContext, pr: Prospect, team: number): number {
  const sc = pitchScores(d, ctx, pr, team);
  return PITCHES.reduce((a, k) => a + (pr.wants[k] ?? 0) * sc[k], 0);
}

/** The next pitch from the reactions so far: + kept, untried pitches before a ~, never − or ✗ again. */
export function learnedPitch(known: Partial<Record<PitchKey, PitchReaction>>, r: () => number): PitchKey {
  const good = PITCHES.find((k) => known[k] === 'good');
  if (good) return good;
  const untried = PITCHES.filter((k) => !known[k]);
  if (untried.length) return untried[Math.floor(r() * untried.length)];
  return PITCHES.find((k) => known[k] === 'ok') ?? PITCHES[Math.floor(r() * PITCHES.length)];
}

/** His interests: his top pitches (rules: pitchInterests). */
export const interestsOf = (R: OffseasonRules, pr: Prospect): PitchKey[] =>
  PITCHES.slice().sort((a, b) => (pr.wants[b] ?? 0) - (pr.wants[a] ?? 0)).slice(0, R.pitchInterests);

/**
 * A pitch's reaction (user, 2026-11-12: "you get rewarded if your school matches what the player is
 * interested in"): his interest and the school strong, in between or weak at it; or not his interest.
 */
export function pitchReaction(R: OffseasonRules, pr: Prospect, scores: Record<PitchKey, number>, pitch: PitchKey): PitchReaction {
  if (!interestsOf(R, pr).includes(pitch)) return 'no';
  const v = scores[pitch];
  return v >= R.pitchStrongAt ? 'good' : v < R.pitchWeakBelow ? 'bad' : 'ok';
}
export const reactionValue = (R: OffseasonRules, x: PitchReaction) =>
  x === 'good' ? R.pitchGood : x === 'ok' ? R.pitchOk : x === 'bad' ? R.pitchBad : R.pitchNotInterested;

/** A CPU team's plan for the week: targets by need and level, points by fit and stars. */
export function cpuPlan(d: Dynasty, rs: RecruitingState, ctx: WeekContext, team: number, r: Rand): TeamPlan {
  const R = rulesOf(d);
  const pres = ctx.prestige.get(team)!;
  const committed = rs.prospects.filter((p) => p.committed === team);
  const open = rs.spots[team] - committed.length;
  if (open <= 0) return { points: {}, offers: [] };
  const counts: Record<string, number> = {};
  for (const [pos, list] of ctx.depth.get(team)!) counts[pos] = list.length;
  const maxStar = clamp(2 + Math.round(pres * 4), 1, 5);
  const minStar = Math.max(1, maxStar - 2);
  const cands = rs.prospects
    .filter((p) => (p.committed === null || (p.committed !== team && p.stars >= 4 && ctx.stars.get(team)! > ctx.stars.get(p.committed)! + 1)) && p.stars <= maxStar && p.stars >= minStar && (POS_TARGET[p.player.pos] ?? 0) - (counts[p.player.pos] ?? 0) > 0)
    .map((p) => ({ p, score: (p.stars + 1) * (0.3 + fit(d, ctx, p, team)) * ((POS_TARGET[p.player.pos] ?? 0) - (counts[p.player.pos] ?? 0)) * (0.7 + 0.6 * r()) + (p.interest[team] ?? 0) / 400 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(R.boardSize, open + 6));
  // Points go mostly to the best targets (score squared), up to the most one prospect can take.
  const total = cands.reduce((a, c) => a + c.score * c.score, 0) || 1;
  const points: Record<number, number> = {};
  let left = R.cpuPoints;
  for (const c of cands) {
    const pts = Math.min(R.maxPerProspect, left, Math.round((R.cpuPoints * c.score * c.score) / total));
    if (pts <= 0) continue;
    points[c.p.id] = pts;
    left -= pts;
  }
  // Its pitch for each target, learned the way the user learns it (user, 2026-11-12: prestige shouldn't
  // make a school better at reading recruits): keep a pitch that got +, try one not tried yet over a ~,
  // never repeat − or ✗; with nothing better left, the best reaction so far.
  const pitches: Record<number, PitchKey> = {};
  const memory = rs.reactions?.[team] ?? {};
  for (const c of cands) {
    if (!points[c.p.id]) continue;
    pitches[c.p.id] = learnedPitch(memory[c.p.id] ?? {}, r);
  }
  return { points, offers: cands.slice(0, open + 6).map((c) => c.p.id), pitches };
}

/** Why a user team's plan can't be used (empty when it can). */
/** How far a team sees a prospect: portal players fully, high-school recruits as far as it scouted. */
export const scoutLevel = (rs: RecruitingState, team: number, p: Prospect): ScoutLevel =>
  p.id > 0 ? 2 : rs.scouted?.[team]?.[p.id] ?? 0;

/** Points to scout a prospect from where the team stands up to a level. */
export function scoutCost(R: OffseasonRules, rs: RecruitingState, team: number, p: Prospect, level: ScoutLevel): number {
  let c = 0;
  const costs = scoutCosts(R);
  for (let l = scoutLevel(rs, team, p) + 1; l <= level; l++) c += costs[l];
  return c;
}

/**
 * A user team scouts a prospect up to a level, at once (the page shows what's revealed right away);
 * `planned` = the points already planned for the week on the board, which must still fit.
 */
export function scoutProspect(d: Dynasty, team: number, id: number, level: ScoutLevel, planned = 0): Dynasty {
  const st = d.offseason;
  const rs = st?.recruiting;
  const R = rulesOf(d);
  if (!st || !rs || st.step !== 'recruiting' || rs.week >= R.weeks) throw new Error('Scouting is only during the recruiting weeks.');
  if (!d.userTeams.includes(team)) throw new Error('Only your teams scout.');
  const p = rs.prospects.find((x) => x.id === id);
  if (!p) throw new Error('No such prospect.');
  const cost = scoutCost(R, rs, team, p, level);
  if (cost === 0) return d;
  const spent = rs.scoutSpent?.[team] ?? 0;
  if (spent + cost + planned > R.userPoints) throw new Error(`Scouting him costs ${cost} points: you have ${R.userPoints - spent - planned} left this week.`);
  const recruiting: RecruitingState = {
    ...rs,
    scouted: { ...rs.scouted, [team]: { ...rs.scouted?.[team], [id]: level } },
    scoutSpent: { ...rs.scoutSpent, [team]: spent + cost },
  };
  return { ...d, offseason: { ...st, recruiting } };
}

export function planProblems(R: OffseasonRules, plan: TeamPlan, scoutSpent = 0): string[] {
  const out: string[] = [];
  const vals = Object.values(plan.points);
  const total = vals.reduce((a, b) => a + b, 0) + scoutSpent;
  if (vals.some((v) => v < 0 || !Number.isFinite(v))) out.push('Points must be zero or more.');
  if (vals.some((v) => v > R.maxPerProspect)) out.push(`At most ${R.maxPerProspect} points for one prospect a week.`);
  if (total > R.userPoints) out.push(`That's ${total} points${scoutSpent ? `, ${scoutSpent} of them on scouting` : ''}: you have ${R.userPoints} a week.`);
  if (Object.keys(plan.points).length > R.boardSize) out.push(`At most ${R.boardSize} prospects on your board.`);
  return out;
}

/**
 * One week of recruiting: every team spends its points (CPU teams by their own plan, user teams by
 * theirs), interest grows, prospects commit or flip. Returns the new state (the input is left as it is).
 */
export function runRecruitingWeek(d: Dynasty, rs0: RecruitingState, userPlans: Record<number, TeamPlan>, seed: number, sim: number[] = []): RecruitingState {
  const R = rulesOf(d);
  if (rs0.week >= R.weeks) throw new Error('Recruiting is over: it\'s signing day.');
  for (const [t, p] of Object.entries(userPlans)) {
    const bad = planProblems(R, p, rs0.scoutSpent?.[Number(t)] ?? 0);
    if (bad.length) throw new Error(`${d.teams[Number(t)].school}: ${bad.join(' ')}`);
  }
  const r = seeded(seed, 100 + rs0.week);
  const rs: RecruitingState = { ...rs0, prospects: rs0.prospects.map((p) => ({ ...p, interest: { ...p.interest }, offers: p.offers.slice() })), log: rs0.log.slice(), plans: { ...rs0.plans, ...userPlans }, scouted: rs0.scouted ?? {}, scoutSpent: {}, reactions: JSON.parse(JSON.stringify(rs0.reactions ?? {})) };
  const ctx = weekContext(d, rs);
  const byId = new Map(rs.prospects.map((p) => [p.id, p]));
  // Plans: user teams as given, the rest by the computer.
  const plans = new Map<number, TeamPlan>();
  // Simmed user teams (`sim`) recruit as the computer does.
  for (const t of d.teams) {
    const own = d.userTeams.includes(t.index) && !sim.includes(t.index);
    plans.set(t.index, own ? (userPlans[t.index] ?? { points: {}, offers: [] }) : cpuPlan(d, rs, ctx, t.index, r));
  }
  for (const [team, plan] of plans) {
    for (const id of plan.offers) {
      const p = byId.get(id);
      if (p && !p.offers.includes(team)) p.offers.push(team);
    }
    for (const [idS, pts] of Object.entries(plan.points)) {
      const p = byId.get(Number(idS));
      if (!p || pts <= 0) continue;
      const sc = pitchScores(d, ctx, p, team);
      const f = PITCHES.reduce((a, k) => a + (p.wants[k] ?? 0) * sc[k], 0);
      const pitch = plan.pitches?.[p.id];
      let pv = 1;
      if (pitch) {
        const x = pitchReaction(R, p, sc, pitch);
        pv = reactionValue(R, x);
        const mine = (rs.reactions ??= {})[team] ??= {};
        mine[p.id] = { ...mine[p.id], [pitch]: x };
      }
      p.interest[team] = (p.interest[team] ?? 0) + pts * pv * pointValue(d, ctx, p, team) * (0.5 + f) * (p.offers.includes(team) ? R.offerBoost : R.noOffer) * reach(p.stars, ctx.stars.get(team)!) * (0.85 + 0.3 * r());
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
    const need = commitNeed(R, p);
    if (rs.week + 1 < R.firstWeek[p.stars] - (p.id > 0 ? 1 : 0)) continue;
    if (p.committed === null) {
      if (top.v >= need && top.v >= R.commitLead * second) {
        p.committed = top.t;
        count.set(top.t, committedCount(top.t) + 1);
        rs.log.push({ week: rs.week + 1, prospect: p.id, team: top.t });
      }
    } else if (top.t !== p.committed && top.v >= R.flipMargin * (p.interest[p.committed] ?? 0) && r() < R.flipChance) {
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
  for (let round = 0; round < rulesOf(d).classMax && left.length; round++) {
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
      // Nobody signed him, or his old school got him back: he stays (no transfer).
      const old = players[p.id - 1];
      const to = p.committed;
      if (to === null || to === old.team) continue;
      players[p.id - 1] = { ...old, team: to, transfers: [...(old.transfers ?? []), { year: year - 1, from: old.team!, to }] };
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

/** One recruiting week with the user teams' plans; teams in `sim` let the computer recruit for them. */
export function recruitingWeek(d: Dynasty, userPlans: Record<number, TeamPlan>, sim: number[] = []): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'recruiting' || !st.recruiting) throw new Error('It isn\'t recruiting time.');
  return { ...d, offseason: { ...st, recruiting: runRecruitingWeek(d, st.recruiting, userPlans, st.seed, sim) } };
}

/** Sims recruiting weeks for every user team (all that are left, or `weeks` of them); signing day stays a step. */
export function simRecruiting(d: Dynasty, weeks = Infinity): Dynasty {
  const W = rulesOf(d).weeks;
  let x = d;
  for (let i = 0; i < weeks && x.offseason?.recruiting && x.offseason.recruiting.week < W; i++) x = recruitingWeek(x, {}, x.userTeams);
  return x;
}

/** After the last week: signing day, then the cuts. */
export function finishRecruiting(d: Dynasty, tpl: RecruitTemplates): Dynasty {
  const st = d.offseason;
  if (!st || st.step !== 'recruiting' || !st.recruiting) throw new Error('It isn\'t recruiting time.');
  const W = rulesOf(d).weeks;
  if (st.recruiting.week < W) throw new Error(`Recruiting has ${W - st.recruiting.week} weeks left.`);
  const { players: signed, events } = signingDay(d, st.recruiting, st.year + 1);
  const players = fillMinimums(d, signed, tpl, seeded(st.seed, 30), st.year + 1, events);
  const next: Dynasty = { ...d, players, offseason: { ...st, step: 'cuts', recruiting: undefined, events: [...st.events, ...events] } };
  const suggestedCuts: Record<number, number[]> = {};
  for (const t of d.userTeams) suggestedCuts[t] = suggestCuts(next, t);
  return { ...next, offseason: { ...next.offseason!, suggestedCuts } };
}
