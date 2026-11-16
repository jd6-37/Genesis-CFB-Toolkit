// The coaching carousel and what feeds it (spec: claude.ai project notes bw95-dynasty-coaches-spec.md, part 2):
// each head coach's goals for a season, how they went, his hot seat, the XP he earns, and the offseason's first
// step: retirements, firings, job offers to the coaches the user manages, the user's own changes, and the
// computer's hiring.
//
// Goals, results and the hot seat are read from the dynasty (the seasons, their coaches and results); only the
// carousel's decisions are kept (OffseasonState.carousel, then the coaches themselves).
import { COACH_RATINGS, coachAge, coachOvr, type CoachRating, type CoachRatings, type DCoach } from './coaches';
import { INDEPENDENT, seasonView, standings, type SeasonView } from './derive';
import { rng, type DPlayer, type Dynasty, type OffseasonEvent } from './model';
import { protectedPairs, rivalriesOf } from './schedule';
import { seasonPrestige, MAX_PRESTIGE } from './prestige';
import { editionOf } from './edition';

type Rand = () => number;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---- goals

export type GoalKind = 'wins' | 'rival' | 'conf' | 'class' | 'postseason';
export interface Goal { kind: GoalKind; text: string; n?: number; rival?: number }
export interface GoalResult extends Goal { met: boolean | null; result: string }

/** The share of regular-season games a school of this prestige (1-6 stars) is expected to win. */
const WIN_SHARE = [0, 0.42, 0.5, 0.58, 0.66, 0.75, 0.83];
/** The signing class rank a school of this prestige is expected to reach. */
export const CLASS_TARGET = [0, 110, 85, 55, 35, 20, 10];

const regularGames = (d: Pick<Dynasty, 'edition'>) => editionOf(d as Dynasty).regWeeks === 11 ? 11 : 12;

/** A team's prestige for a season (the season's stars). */
const starsIn = (d: Dynasty, seasonIndex: number, team: number) => seasonPrestige(d, d.seasons[seasonIndex])[team];

/** The season's goals for a team's head coach: a win total, its rival, and one more by the school's prestige. */
export function goalsFor(d: Dynasty, seasonIndex: number, team: number): Goal[] {
  const p = starsIn(d, seasonIndex, team);
  const wins = Math.round(regularGames(d) * WIN_SHARE[p]);
  const out: Goal[] = [{ kind: 'wins', n: wins, text: `Win ${wins} regular-season games` }];
  const pair = protectedPairs(d.teams.map((t) => t.school), d.edition, rivalriesOf(d)).find((x) => x.a === team || x.b === team);
  if (pair) { const rival = pair.a === team ? pair.b : pair.a; out.push({ kind: 'rival', rival, text: `Beat ${d.teams[rival].school}` }); }
  const conf = d.seasons[seasonIndex].conf[team];
  if (p >= 5 && conf !== INDEPENDENT) out.push({ kind: 'conf', text: 'Win the conference' });
  else if (p >= 3) out.push({ kind: 'class', n: CLASS_TARGET[p], text: `A top-${CLASS_TARGET[p]} signing class` });
  else out.push({ kind: 'postseason', text: editionOf(d).postseason === 'bowls' ? 'Reach a bowl game' : 'Win 6 games' });
  return out;
}

/** Regular-season wins and losses. */
export function regularRecord(v: SeasonView, team: number) {
  let w = 0, l = 0;
  for (const g of v.games) {
    if (g.week > v.lastRegularWeek || g.vs === null || g.hs === null || g.visitor === null || g.home === null) continue;
    if (g.visitor !== team && g.home !== team) continue;
    const us = g.home === team ? g.hs : g.vs, them = g.home === team ? g.vs : g.hs;
    if (us > them) w++; else if (us < them) l++;
  }
  return { w, l };
}

/** Postseason wins (title games, bowls, playoff games). */
export function postseasonWins(v: SeasonView, team: number) {
  return v.games.filter((g) => g.week > v.lastRegularWeek && g.vs !== null && g.hs !== null && ((g.home === team && g.hs > g.vs) || (g.visitor === team && g.vs > g.hs))).length;
}

/** The conference champion: the winner of its title game if it played one, else the standings leader. */
export function conferenceChampion(v: SeasonView, conf: number): number | null {
  if (conf === INDEPENDENT || !v.done) return null;
  const inConf = (t: number | null) => t !== null && v.season.conf[t] === conf;
  const titleWeek = v.lastRegularWeek + 1;
  const g = v.games.find((x) => x.week === titleWeek && inConf(x.visitor) && inConf(x.home) && x.vs !== null && x.hs !== null && !(v.bowls && x.week === v.weeks - 1));
  if (g) return g.vs! > g.hs! ? g.visitor : g.home;
  return standings(v, conf)[0]?.team ?? null;
}

/** The class a team signed before season `seasonIndex + 1` (the offseason after it), if that offseason has run. */
function classRankAfter(d: Dynasty, seasonIndex: number, team: number): number | null {
  const events = d.seasons[seasonIndex + 1]?.events ?? (seasonIndex === d.seasons.length - 1 ? d.offseason?.events : undefined) ?? [];
  const e = events.find((x) => x.kind === 'class' && x.team === team) as Extract<OffseasonEvent, { kind: 'class' }> | undefined;
  return e?.rank ?? null;
}

/** The class a team signed before season `seasonIndex` (the offseason before it). */
function classRankBefore(d: Dynasty, seasonIndex: number, team: number): number | null {
  const e = (d.seasons[seasonIndex]?.events ?? []).find((x) => x.kind === 'class' && x.team === team) as Extract<OffseasonEvent, { kind: 'class' }> | undefined;
  return e?.rank ?? null;
}

/** How the season's goals went (met null until the season is over; the class goal is the class signed before the season). */
export function goalResults(d: Dynasty, seasonIndex: number, team: number, v = seasonView(d, d.seasons[seasonIndex])): GoalResult[] {
  const rec = regularRecord(v, team);
  return goalsFor(d, seasonIndex, team).map((g) => {
    if (g.kind === 'wins') return { ...g, met: v.done ? rec.w >= g.n! : null, result: `${rec.w}-${rec.l}` };
    if (g.kind === 'rival') {
      const games = v.games.filter((x) => x.vs !== null && x.hs !== null && ((x.home === team && x.visitor === g.rival) || (x.visitor === team && x.home === g.rival)));
      const won = games.some((x) => (x.home === team ? x.hs! > x.vs! : x.vs! > x.hs!));
      const lost = games.some((x) => (x.home === team ? x.hs! < x.vs! : x.vs! < x.hs!));
      // Not on the schedule: it doesn't count either way.
      const scheduled = v.games.some((x) => (x.home === team && x.visitor === g.rival) || (x.visitor === team && x.home === g.rival));
      return { ...g, met: won ? true : lost ? false : null, result: won ? 'Won' : lost ? 'Lost' : scheduled ? '' : 'Not on the schedule' };
    }
    if (g.kind === 'conf') {
      const c = conferenceChampion(v, v.season.conf[team]);
      return { ...g, met: v.done ? c === team : null, result: v.done ? (c === team ? 'Champions' : c !== null ? `${d.teams[c].school} won it` : '') : '' };
    }
    if (g.kind === 'class') {
      const rank = classRankBefore(d, seasonIndex, team);
      return { ...g, met: rank === null ? null : rank <= g.n!, result: rank === null ? 'No class signed in the dynasty yet' : `No. ${rank}` };
    }
    const post = editionOf(d).postseason === 'bowls';
    if (post) {
      const played = v.games.some((x) => x.week > v.lastRegularWeek && (x.home === team || x.visitor === team));
      return { ...g, met: v.done ? played : null, result: v.done ? (played ? 'Played in one' : 'No bowl') : '' };
    }
    return { ...g, met: v.done ? v.records[team].w >= 6 : null, result: `${v.records[team].w} wins` };
  });
}

// ---- tenure and the hot seat

/** Seasons a coach has been head coach of the team he coached in `seasonIndex`, counting that one (real seasons before the dynasty too). */
export function tenure(d: Dynasty, coach: DCoach, seasonIndex: number): number {
  const team = d.seasons[seasonIndex]?.coach?.indexOf(coach.id) ?? -1;
  if (team < 0) return 0;
  let n = 0, k = seasonIndex;
  while (k >= 0 && d.seasons[k].coach?.[team] === coach.id) { n++; k--; }
  if (k < 0) {
    // He has coached here since the dynasty started: add his real seasons there just before it.
    const school = d.teams[team].school;
    for (let y = d.startYear - 1; coach.irl.some((r) => r.year === y && r.role === 'HC' && r.school === school); y--) n++;
  }
  return n;
}

/** One season's heat, 0-100: wins against the goal, the other goals, the signing class. */
function seasonHeat(d: Dynasty, seasonIndex: number, team: number, v: SeasonView): number {
  const res = goalResults(d, seasonIndex, team, v);
  const wins = res.find((g) => g.kind === 'wins')!;
  const rec = regularRecord(v, team);
  let h = 38 - (rec.w - wins.n!) * 8;
  for (const g of res) if (g.kind !== 'wins' && g.met !== null) h += g.met ? -6 : 6;
  const p = starsIn(d, seasonIndex, team);
  const cls = classRankBefore(d, seasonIndex, team);
  if (cls !== null) h += cls <= CLASS_TARGET[p] ? -6 : cls > CLASS_TARGET[p] * 1.5 + 10 ? 8 : 0;
  return clamp(Math.round(h), 0, 100);
}

/**
 * His hot seat after season `seasonIndex` at his school, 0-100 (null if he wasn't a head coach that season or it
 * isn't over): each season's heat, the latest counting most (60%), carried from season to season at his school.
 */
export function hotSeat(d: Dynasty, coach: DCoach, seasonIndex = d.seasons.length - 1): number | null {
  const team = d.seasons[seasonIndex]?.coach?.indexOf(coach.id) ?? -1;
  if (team < 0) return null;
  let first = seasonIndex;
  while (first > 0 && d.seasons[first - 1].coach?.[team] === coach.id) first--;
  let heat = 30; // a new coach's honeymoon, or where a returning coach starts in the dynasty
  if (first === 0) {
    // He was already there: his last real season's record against the school's win goal.
    const last = coach.irl.filter((r) => r.role === 'HC' && r.school === d.teams[team].school && r.w !== undefined).at(-1);
    if (last && last.year === d.startYear - 1) {
      const goal = Math.round(regularGames(d) * WIN_SHARE[starsIn(d, 0, team)]);
      heat = clamp(38 - (last.w! - goal) * 8, 0, 100);
    }
  }
  let any = false;
  for (let k = first; k <= seasonIndex; k++) {
    const v = seasonView(d, d.seasons[k]);
    if (!v.done) continue;
    heat = Math.round(0.4 * heat + 0.6 * seasonHeat(d, k, team, v));
    any = true;
  }
  return any ? heat : seasonIndex === d.seasons.length - 1 ? heat : null;
}

export const heatLabel = (h: number) => (h >= 75 ? 'Very hot' : h >= 55 ? 'Hot' : h >= 40 ? 'Warm' : 'Safe');

/**
 * His chance of being fired after the season (spec: never in years 1-2; year 3 only after a disaster; then the hot
 * seat: from 55, rising to 90% at 90, less for a coach with a big name). Tuned with cli/carouselstudy.ts.
 */
export function firingChance(d: Dynasty, coach: DCoach, seasonIndex: number): number {
  const team = d.seasons[seasonIndex]?.coach?.indexOf(coach.id) ?? -1;
  if (team < 0) return 0;
  const years = tenure(d, coach, seasonIndex);
  if (years <= 2) return 0;
  const v = seasonView(d, d.seasons[seasonIndex]);
  if (!v.done) return 0;
  if (years === 3) {
    const p = starsIn(d, seasonIndex, team);
    const goal = Math.round(regularGames(d) * WIN_SHARE[p]);
    const rec = regularRecord(v, team);
    const cls = classRankBefore(d, seasonIndex, team);
    const disaster = rec.w <= Math.max(1, goal - 6) && (cls === null || cls > CLASS_TARGET[p] * 1.5 + 10);
    return disaster ? 0.9 : 0;
  }
  const h = hotSeat(d, coach, seasonIndex) ?? 0;
  // A coach with a big name lasts longer (a 5-star coach about half as likely as a 1-star one).
  return h < 55 ? 0 : clamp(0.9 * (h - 55) / 35, 0, 0.9) * (1 - 0.12 * (coach.prestige - 1));
}

// ---- XP

/** XP for +1 in a rating at this value (mockup: cheap to 70, dear past 90). */
export const xpCost = (v: number) => (v < 70 ? 40 : v < 80 ? 80 : v < 90 ? 150 : 300);

/** What a head coach earned in a season (spec: wins, postseason wins, titles, goals, the signing class). */
export function seasonXp(d: Dynasty, seasonIndex: number, team: number, v = seasonView(d, d.seasons[seasonIndex])): { total: number; parts: { label: string; xp: number }[] } {
  const parts: { label: string; xp: number }[] = [];
  const rec = regularRecord(v, team);
  if (rec.w) parts.push({ label: `${rec.w} wins`, xp: 40 * rec.w });
  const pw = postseasonWins(v, team);
  if (pw) parts.push({ label: `${pw} postseason ${pw === 1 ? 'win' : 'wins'}`, xp: 150 * pw });
  if (v.champion === team) parts.push({ label: 'National title', xp: 400 });
  if (conferenceChampion(v, v.season.conf[team]) === team) parts.push({ label: 'Conference title', xp: 200 });
  const met = goalResults(d, seasonIndex, team, v).filter((g) => g.met).length;
  if (met) parts.push({ label: `${met} ${met === 1 ? 'goal' : 'goals'} met`, xp: 100 * met });
  const cls = classRankAfter(d, seasonIndex, team) ?? classRankBefore(d, seasonIndex, team);
  if (cls !== null && cls <= 25) parts.push({ label: `No. ${cls} signing class`, xp: cls <= 10 ? 200 : 100 });
  return { total: parts.reduce((a, p) => a + p.xp, 0), parts };
}

/** Spends XP for a coach the user doesn't manage: mostly on his best ratings, some spread. */
export function autoSpend(ratings: CoachRatings, xp: number, r: Rand): { ratings: CoachRatings; xp: number } {
  const out = { ...ratings };
  for (let guard = 0; guard < 200; guard++) {
    // Weight each rating by how good it already is (his strengths grow), plus a little for the rest.
    const w = COACH_RATINGS.map((k) => (out[k] >= 99 ? 0 : Math.max(1, out[k] - 50) + 6));
    const sum = w.reduce((a, x) => a + x, 0);
    if (!sum) break;
    let x = r() * sum, k: CoachRating = COACH_RATINGS[0];
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { k = COACH_RATINGS[i]; break; } }
    const cost = xpCost(out[k]);
    if (cost > xp) break;
    xp -= cost; out[k]++;
  }
  return { ratings: out, xp };
}

/** The user's purchase for a managed coach: +n in each rating, paid from his XP (refused if he can't pay). */
export function spendXp(d: Dynasty, coachId: number, add: Partial<Record<CoachRating, number>>): Dynasty {
  const c = d.coaches?.[coachId];
  if (!c) throw new Error('No such coach.');
  if (!c.manageXp) throw new Error('Turn on Manage XP first.');
  let xp = c.xp ?? 0;
  const r = { ...c.ratings };
  for (const k of COACH_RATINGS) for (let i = 0; i < (add[k] ?? 0); i++) {
    if (r[k] >= 99) throw new Error(`${k} is already at 99.`);
    xp -= xpCost(r[k]); r[k]++;
  }
  if (xp < 0) throw new Error('Not enough XP.');
  return setCoach(d, { ...c, ratings: r, xp });
}

export function setManageXp(d: Dynasty, coachId: number, on: boolean): Dynasty {
  const c = d.coaches?.[coachId];
  if (!c) throw new Error('No such coach.');
  return setCoach(d, { ...c, manageXp: on || undefined });
}

export const setCoach = (d: Dynasty, c: DCoach): Dynasty => ({ ...d, coaches: d.coaches!.map((x) => (x.id === c.id ? c : x)) });

// ---- the carousel

export interface CoachMove { coach: number; from: number | null; to: number; kind: 'hired' | 'moved' | 'yours' }

export interface CarouselState {
  /** XP each head coach earned last season (for the summary). */
  xp: Record<number, number>;
  retired: { coach: number; team: number | null; age: number }[];
  fired: { coach: number; team: number; heat: number }[];
  /** Job offers to the coaches the user manages: coach → schools. */
  offers: Record<number, number[]>;
  /** Done: the computer has hired for every opening. */
  done?: boolean;
  moves: CoachMove[];
  /** The coaches as they were when the offseason started (to start it over). */
  before: DCoach[];
  /** The queue of drafted players coming back as coaches, as it was (to start it over). */
  queueBefore?: { player: number; year: number }[];
  /** Former players who joined the pool this offseason (coach ids). */
  former?: number[];
}

/** Teams without a head coach now. */
export const openings = (d: Dynasty) => d.teams.map((t) => t.index).filter((t) => !d.coaches!.some((c) => c.team === t));

/** A coach's pull for a school: his OVR and prestige against the school's level. */
const quality = (c: DCoach) => coachOvr(c.ratings) + 3 * c.prestige;
const schoolBar = (stars: number) => 58 + 5 * stars; // 1 star 63 … 6 stars 88

/** Prestige toward his OVR's level, one star a season at most; a national title is worth a star. */
export function nextCoachPrestige(c: DCoach, title: boolean, fired: boolean) {
  const o = coachOvr(c.ratings);
  let target = o >= 86 ? 5 : o >= 78 ? 4 : o >= 70 ? 3 : o >= 62 ? 2 : 1;
  if (title) target = Math.min(5, target + 1);
  if (fired) target = Math.max(1, target - 1);
  return clamp(c.prestige + Math.sign(target - c.prestige), 1, 5);
}

/**
 * The season is over: every head coach's XP (spent for him unless the user manages him), aging, prestige; then
 * retirements, firings, and the job offers to the coaches the user manages. The coaches change in the dynasty;
 * the rest waits in the carousel state for the user (offers, changes) and `finishCarousel` (the hiring).
 */
export function startCarousel(d: Dynasty, seed: number): { coaches: DCoach[]; carousel: CarouselState; events: OffseasonEvent[]; coachQueue: { player: number; year: number }[] } {
  const r = rng((seed ^ 0xc0ac4) >>> 0);
  const si = d.seasons.length - 1;
  const v = seasonView(d, d.seasons[si]);
  const year = d.seasons[si].year;
  const before = d.coaches!;
  const st: CarouselState = { xp: {}, retired: [], fired: [], offers: {}, moves: [], before, queueBefore: d.coachQueue };
  const events: OffseasonEvent[] = [];
  let coaches = before.map((c) => ({ ...c }));
  // XP, aging and prestige for the season's head coaches.
  for (const c of coaches) {
    if (c.status === 'retired') continue;
    const team = d.seasons[si].coach?.indexOf(c.id) ?? -1;
    if (team >= 0 && v.done) {
      const xp = seasonXp(d, si, team, v).total;
      st.xp[c.id] = xp;
      c.xp = (c.xp ?? 0) + xp;
      if (!c.manageXp) { const s = autoSpend(c.ratings, c.xp, r); c.ratings = s.ratings; c.xp = s.xp; }
      c.prestige = nextCoachPrestige(c, v.champion === team, false);
    }
    // From about 65 his ratings slip a little each year (spec, aging).
    if (coachAge(c, year + 1) >= 65) for (const k of COACH_RATINGS) if (r() < 0.4) c.ratings[k] = Math.max(30, c.ratings[k] - 1);
  }
  // Retirements: from 60 a yearly chance that rises with age (most are gone by about 75).
  for (const c of coaches) {
    if (c.status === 'retired') continue;
    const age = coachAge(c, year + 1);
    const chance = age < 60 ? 0 : clamp(0.04 + (age - 60) * 0.04, 0, 0.9) * (c.team === null ? 1.5 : 1);
    if (r() < chance) {
      st.retired.push({ coach: c.id, team: c.team, age });
      if (c.team !== null) events.push({ kind: 'coachRetired', coach: c.id, team: c.team });
      c.status = 'retired'; c.team = null; c.poolNote = undefined; c.retiredYear = year;
    }
  }
  // Firings (the user's teams' coaches only if the dynasty allows it).
  for (const c of coaches) {
    if (c.team === null || c.status !== 'coach') continue;
    if (d.userTeams.includes(c.team) && d.yourCoachFired === false) continue;
    const chance = firingChance(d, before[c.id], si);
    if (chance > 0 && r() < chance) {
      const heat = hotSeat(d, before[c.id], si) ?? 0;
      st.fired.push({ coach: c.id, team: c.team, heat });
      events.push({ kind: 'coachFired', coach: c.id, team: c.team, heat });
      c.prestige = nextCoachPrestige(c, false, true);
      c.poolNote = `Fired by ${d.teams[c.team].school} (${year})`;
      c.team = null; c.status = 'pool';
    }
  }
  // Former players (spec): this offseason's departures get a small chance, higher Awareness (INTEL) first;
  // undrafted ones join the pool now, drafted ones after a pro career of 2-10 years. The queue's due players join.
  const queue = (d.coachQueue ?? []).slice();
  const joining: { p: DPlayer; drafted: boolean }[] = [];
  for (const p of d.players) {
    if (p.leftYear !== year || (p.status !== 'graduated' && p.status !== 'pro')) continue;
    const aw = p.ratings.Awareness ?? 50;
    const posF = p.pos === 'QB' ? 2 : p.pos === 'MLB' || p.pos === 'LOLB' || p.pos === 'ROLB' ? 1.5 : 1;
    if (r() >= clamp(0.0025 * posF * Math.pow(aw / 80, 6), 0, 0.05)) continue;
    if (p.status === 'pro') queue.push({ player: p.id, year: year + 2 + Math.floor(r() * 9) });
    else joining.push({ p, drafted: false });
  }
  const due = queue.filter((q) => q.year <= year);
  for (const q of due) joining.push({ p: d.players[q.player - 1], drafted: true });
  for (const { p, drafted } of joining) {
    const c = coachFromPlayer(p, coaches.length, year, drafted, r);
    coaches.push(c);
    events.push({ kind: 'coachFormer', coach: c.id, player: p.id, drafted });
  }
  st.former = joining.map((j, i) => coaches.length - joining.length + i);
  const next: Dynasty = { ...d, coaches };
  st.offers = jobOffers(next, r);
  return { coaches, carousel: st, events, coachQueue: queue.filter((q) => q.year > year) };
}

/** A former player as a young coach: ratings from his position and his Awareness, below an established coach's. */
export function coachFromPlayer(p: DPlayer, id: number, year: number, drafted: boolean, r: Rand): DCoach {
  const aw = p.ratings.Awareness ?? 50;
  const base = clamp(44 + (aw - 50) * 0.35 + (drafted ? 4 : 0), 40, 66);
  const lean: Record<CoachRating, number> = { passing: 0, running: 0, defense: 0, recruiting: 0, development: 0 };
  if (['QB', 'WR', 'TE'].includes(p.pos)) lean.passing += 8;
  else if (['HB', 'FB', 'LT', 'LG', 'C', 'RG', 'RT'].includes(p.pos)) lean.running += 8;
  else if (!['K', 'P'].includes(p.pos)) lean.defense += 8;
  if (drafted) lean.recruiting += 4; // the name
  const ratings = Object.fromEntries(COACH_RATINGS.map((k) => [k, clamp(Math.round(base + lean[k] + (r() - 0.5) * 8), 30, 99)])) as CoachRatings;
  // His age: about 22 when he leaves school; a drafted player returns after his pro years.
  const left = p.leftYear ?? year;
  const born = left - 22 - Math.floor(r() * 2);
  return {
    id, name: `${p.first} ${p.last}`.trim() || `${p.pos} #${p.jersey}`, born, hometown: p.hometown && p.state ? `${p.hometown}, ${p.state}` : p.hometown || undefined,
    team: null, status: 'pool', poolNote: drafted ? 'Former NFL player' : 'Former player',
    ratings, prestige: drafted ? 2 : 1, irl: [], formerPlayer: { player: p.id, drafted },
  };
}

/** Offers to each coach the user manages (spec: every year): schools that are open, roughly his level, at most three. */
function jobOffers(d: Dynasty, r: Rand): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  const open = openings(d);
  const stars = d.offseason?.prestige ?? seasonPrestige(d, d.seasons[d.seasons.length - 1]);
  for (const c of d.coaches!) {
    if (!c.manageXp || c.status === 'retired') continue;
    const mine = c.team === null ? 0 : stars[c.team];
    const fit = open
      .filter((t) => t !== c.team && stars[t] >= mine && stars[t] <= mine + 2 && quality(c) >= schoolBar(stars[t]) - 3)
      .sort((a, b) => stars[b] - stars[a] || r() - 0.5);
    if (fit.length) out[c.id] = fit.slice(0, 3);
  }
  return out;
}

/** The user puts a coach on a team (carousel step): the team's coach goes to the pool; a head coach's old job opens. */
export function placeCoach(d: Dynasty, coachId: number, team: number): Dynasty {
  carouselOpen(d);
  if (d.coaches![coachId]?.status === 'retired') throw new Error('He has retired.');
  if (d.coaches![coachId]?.team === team) return d;
  const year = d.offseason!.year;
  const coaches = d.coaches!.map((c) => {
    if (c.id === coachId) return { ...c, team, status: 'coach' as const, poolNote: undefined };
    if (c.team === team) return { ...c, team: null, status: 'pool' as const, poolNote: `Replaced at ${d.teams[team].school} (${year})` };
    return c;
  });
  const from = d.coaches![coachId].team;
  return withCarousel({ ...d, coaches }, (st) => ({ ...st, moves: [...st.moves, { coach: coachId, from, to: team, kind: 'yours' }] }));
}

/** The user fires a team's coach (carousel step): he goes to the pool, the job opens for the hiring. */
export function fireCoach(d: Dynasty, team: number): Dynasty {
  carouselOpen(d);
  const c = d.coaches!.find((x) => x.team === team);
  if (!c) throw new Error(`${d.teams[team].school} has no head coach.`);
  const year = d.offseason!.year;
  const next = { ...d, coaches: d.coaches!.map((x) => (x.id === c.id ? { ...x, team: null, status: 'pool' as const, poolNote: `Fired by ${d.teams[team].school} (${year})` } : x)) };
  return withCarousel(next, (st) => ({ ...st, fired: [...st.fired, { coach: c.id, team, heat: hotSeat(d, c) ?? 0 }] }));
}

/** A new coach the user makes (any time): in the pool, ratings as given. */
export function createCoach(d: Dynasty, c: { name: string; age: number; ratings: CoachRatings; hometown?: string; alma?: string }): Dynasty {
  const name = c.name.trim();
  if (!name) throw new Error('The coach needs a name.');
  if (!(c.age >= 25 && c.age <= 85)) throw new Error('Age must be 25-85.');
  for (const k of COACH_RATINGS) if (!(c.ratings[k] >= 30 && c.ratings[k] <= 99)) throw new Error('Ratings must be 30-99.');
  const year = d.offseason ? d.offseason.year + 1 : d.seasons[d.seasons.length - 1].year;
  const id = d.coaches!.length;
  const o = coachOvr(c.ratings);
  const coach: DCoach = {
    id, name, born: year - c.age, hometown: c.hometown?.trim() || undefined, alma: c.alma?.trim() || undefined,
    team: null, status: 'pool', poolNote: 'Created in this dynasty', ratings: { ...c.ratings },
    prestige: o >= 86 ? 3 : o >= 70 ? 2 : 1, irl: [], created: true,
  };
  return { ...d, coaches: [...d.coaches!, coach] };
}

function carouselOpen(d: Dynasty) {
  if (!d.coaches) throw new Error('This dynasty has no coaches yet.');
  if (!d.offseason?.carousel || d.offseason.carousel.done || d.offseason.step !== 'carousel') throw new Error('Coaches change teams only in the coaching carousel (the offseason\'s first step).');
}
const withCarousel = (d: Dynasty, f: (st: CarouselState) => CarouselState): Dynasty => ({ ...d, offseason: { ...d.offseason!, carousel: f(d.offseason!.carousel!) } });

/**
 * The user's answers to the offers (coach → the school he takes; absent = he stays), then the computer fills
 * every opening from the most prestigious school down: the pool and head coaches moving up from less prestigious
 * schools (whose jobs open in turn). The user's teams' coaches and the coaches the user manages aren't hired away.
 * `teams`: for a coach of one of the user's teams who takes another job, whether to add the new school to the user's
 * teams and keep the old one (both by default).
 */
export function finishCarousel(d: Dynasty, picks: Record<number, number> = {}, teams: Record<number, { add: boolean; keep: boolean }> = {}): Dynasty {
  carouselOpen(d);
  const st = d.offseason!.carousel!;
  const year = d.offseason!.year;
  const r = rng((d.offseason!.seed ^ 0x41ce) >>> 0);
  let coaches = d.coaches!.map((c) => ({ ...c }));
  let userTeams = d.userTeams.slice();
  const moves = st.moves.slice();
  const events: OffseasonEvent[] = [];
  const free = (t: number) => !coaches.some((c) => c.team === t);
  // The managed coaches' choices first.
  for (const [cid, to] of Object.entries(picks).map(([k, t]) => [Number(k), t] as [number, number])) {
    if (!(st.offers[cid] ?? []).includes(to)) throw new Error(`${coaches[cid].name} has no offer from ${d.teams[to].school}.`);
    if (!free(to)) continue;
    const c = coaches[cid];
    const from = c.team;
    if (from !== null && userTeams.includes(from)) {
      const t = teams[cid] ?? { add: true, keep: true };
      if (!t.keep) userTeams = userTeams.filter((x) => x !== from);
      if (t.add && !userTeams.includes(to)) userTeams.push(to);
    }
    c.team = to; c.status = 'coach'; c.poolNote = undefined;
    moves.push({ coach: cid, from, to, kind: 'moved' });
    events.push({ kind: 'coachHired', coach: cid, team: to, from });
  }
  const stars = d.offseason!.prestige ?? seasonPrestige(d, d.seasons[d.seasons.length - 1]);
  const protectedCoach = (c: DCoach) => c.manageXp || (c.team !== null && userTeams.includes(c.team));
  // Openings from the best school down; a head coach who moves up opens his job.
  for (let guard = 0; guard < 500; guard++) {
    const open = d.teams.map((t) => t.index).filter(free).sort((a, b) => stars[b] - stars[a] || a - b);
    if (!open.length) break;
    const t = open[0];
    const bar = schoolBar(stars[t]);
    const cands = coaches.filter((c) => c.status !== 'retired' && !(c.team !== null && protectedCoach(c)) && !c.manageXp
      && (c.team === null || (stars[c.team] < stars[t] && quality(c) >= bar)));
    if (!cands.length) break;
    const score = (c: DCoach) => quality(c) + r() * 6 + (c.alma && d.teams[t].school.startsWith(c.alma) ? 3 : 0) - (c.team === null ? 0 : 2);
    const best = cands.reduce((a, c) => (score(c) > score(a) ? c : a));
    const from = best.team;
    best.team = t; best.status = 'coach'; best.poolNote = undefined;
    moves.push({ coach: best.id, from, to: t, kind: from === null ? 'hired' : 'moved' });
    events.push({ kind: 'coachHired', coach: best.id, team: t, from });
  }
  // A coach who left a coordinator job stays known by it until hired; one who left a team and wasn't hired is in the pool.
  coaches = coaches.map((c) => (c.team === null && c.status === 'coach' ? { ...c, status: 'pool' as const, poolNote: c.poolNote ?? `Out of work (${year})` } : c));
  const off = d.offseason!;
  return { ...d, coaches, userTeams, offseason: { ...off, step: 'depth', events: [...off.events, ...events], carousel: { ...st, moves, done: true } } };
}

export const MAX_COACH_STARS = 5;
export { MAX_PRESTIGE };

/** The user's change to a coach's headshot (any time; only the app's portrait). */
export function setCoachLook(d: Dynasty, coachId: number, look: import('./coachLook').CoachLookEdit): Dynasty {
  const c = d.coaches?.[coachId];
  if (!c) throw new Error('No such coach.');
  return setCoach(d, { ...c, look: { ...(c.look ?? {}), ...look } });
}
