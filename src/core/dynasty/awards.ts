// Season awards (user, 2026-11-12: "Awards at season's end: Heisman, All-Conference and All-American teams,
// worked out from the stats"). Derived from a finished season's imports, like everything else on the pages,
// so nothing is stored: the same saves always give the same awards.
//
// Each Active Roster player (the 32 in the game) gets a score at his role: offense from his stats, linemen
// (who have no stats) from their OVR, defense from tackles, sacks and interceptions, kickers from field goals,
// punters from their average. The best scores make the teams; the Heisman goes by the Heisman watch formula.

import { INDEPENDENT, playerLines, seasonView, statValue, type PlayerLine, type SeasonView } from './derive';
import type { DSeason, Dynasty } from './model';
import { playerOvr, roleOfSlot } from './ovr';
import { heismanWatch } from './outlook';
import { kickoffRanks } from './kickoffRanks';

/** The spots on an All-American or All-Conference team, in order (11 on offense, 11 on defense, 2 kickers). */
export const AWARD_SPOTS: { label: string; roles: string[]; n: number }[] = [
  { label: 'QB', roles: ['QB'], n: 1 },
  { label: 'RB', roles: ['HB', 'FB'], n: 2 },
  { label: 'WR', roles: ['WR'], n: 3 },
  { label: 'TE', roles: ['TE'], n: 1 },
  { label: 'OL', roles: ['OL'], n: 5 },
  { label: 'DL', roles: ['DE', 'DT'], n: 4 },
  { label: 'LB', roles: ['LB'], n: 3 },
  { label: 'CB', roles: ['CB'], n: 2 },
  { label: 'S', roles: ['S'], n: 2 },
  { label: 'K', roles: ['K'], n: 1 },
  { label: 'P', roles: ['P'], n: 1 },
];

/**
 * The real awards (user, 2026-11-27: "Use the real names, eg. Davey O'Brien Award (best QB), Doak Walker Award (best
 * RB), etc. and watches"), each with the year it was first given: a 1994 dynasty gets the Biletnikoff from 1994, the
 * Mackey and the Ray Guy from 2000, and so on. `roles` is who's in the running; 'poy' takes the Heisman watch's
 * players (the player-of-the-year awards), 'interior' the Outland's offensive linemen and defensive tackles.
 * `weight` is the stats share of the blend (AWARD_STATS_WEIGHT unless set): the player-of-the-year awards differ
 * that way, so they can go to different players.
 */
export interface NamedAward { key: string; name: string; what: string; roles: string[] | 'poy' | 'interior'; since: number; art: string; weight?: number }
export const POSITION_AWARDS: NamedAward[] = [
  { key: 'maxwell', name: 'Maxwell Award', what: 'Best all-around player', roles: 'poy', since: 1937, art: 'maxwell', weight: 0.5 },
  { key: 'camp', name: 'Walter Camp Award', what: 'Player of the year', roles: 'poy', since: 1967, art: 'camp', weight: 0.7 },
  { key: 'obrien', name: "Davey O'Brien Award", what: 'Best quarterback', roles: ['QB'], since: 1981, art: 'qb' },
  { key: 'walker', name: 'Doak Walker Award', what: 'Best running back', roles: ['HB', 'FB'], since: 1990, art: 'rb' },
  { key: 'biletnikoff', name: 'Biletnikoff Award', what: 'Best receiver', roles: ['WR'], since: 1994, art: 'wr' },
  { key: 'mackey', name: 'John Mackey Award', what: 'Best tight end', roles: ['TE'], since: 2000, art: 'te' },
  { key: 'outland', name: 'Outland Trophy', what: 'Best interior lineman (Off. or Def.)', roles: 'interior', since: 1946, art: 'ol' },
  { key: 'nagurski', name: 'Bronko Nagurski Trophy', what: 'Best defensive player', roles: ['DE', 'DT', 'LB', 'CB', 'S'], since: 1993, art: 'def' },
  { key: 'bednarik', name: 'Chuck Bednarik Award', what: 'Defensive player of the year', roles: ['DE', 'DT', 'LB', 'CB', 'S'], since: 1995, art: 'def2', weight: 0.7 },
  { key: 'butkus', name: 'Butkus Award', what: 'Best linebacker', roles: ['LB'], since: 1985, art: 'lb' },
  { key: 'thorpe', name: 'Jim Thorpe Award', what: 'Best defensive back', roles: ['CB', 'S'], since: 1986, art: 'db' },
  { key: 'groza', name: 'Lou Groza Award', what: 'Best place-kicker', roles: ['K'], since: 1992, art: 'k' },
  { key: 'guy', name: 'Ray Guy Award', what: 'Best punter', roles: ['P'], since: 2000, art: 'p' },
];
export const HEISMAN = { key: 'heisman', name: 'Heisman Trophy', what: 'Most outstanding player', since: 1935, art: 'heisman' };
/** Coach of the year (user, 2026-11-27): the Bear Bryant Award and the AFCA Coach of the Year. */
export const COACH_AWARDS = [
  { key: 'bryant', name: 'Bear Bryant Award', what: 'Coach of the best team', how: 'the best season at the top: record, rank, title games and postseason wins', since: 1986, art: 'coach' },
  { key: 'afca', name: 'AFCA Coach of the Year', what: 'Coach who beat expectations', how: 'the most wins beyond what the team was expected to win, from where it started in the preseason poll', since: 1935, art: 'coach2' },
] as const;
export const awardsIn = (year: number) => POSITION_AWARDS.filter((a) => a.since <= year);

export interface Candidate {
  player: number;
  team: number;
  slot: number;
  role: string;
  ovr: number;
  score: number;
  /** Where his stat score and his OVR rank among the players of his award spot, 0 (last) to 1 (first). */
  statPct: number;
  /** The stats score against the best at the award spot's (0-1): how far ahead or behind, not just the order. */
  statRel: number;
  ovrPct: number;
  /** A short line of his season ("1,204 rushing yards, 14 TD"). */
  line: string;
}

export interface SeasonAwards {
  year: number;
  heisman: { player: number; team: number; score: number }[];
  /** The named awards given that year (`label` is the award's name). */
  position: { key: string; label: string; winner: Candidate | null }[];
  /** Coach of the year awards: the coach's id (null when the dynasty has no coaches) and his team. */
  coach: { key: string; label: string; coach: number | null; team: number }[];
  /** First and second team. */
  allAmerican: [Candidate[], Candidate[]];
  /** First team per conference (conference index → players), independents left out. */
  allConference: Record<number, Candidate[]>;
}

const n = (x: number) => x.toLocaleString('en-US');
const pl = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;

/** Every Active Roster player's score at his role for the season. */
export function candidates(v: SeasonView): Candidate[] {
  const lines = new Map<string, PlayerLine[]>();
  for (const l of playerLines(v)) {
    const k = `${l.team}/${l.slot}`;
    lines.set(k, [...(lines.get(k) ?? []), l]);
  }
  const out: Candidate[] = [];
  v.season.slots.forEach((slots, team) => slots.forEach((player, slot) => {
    if (player === null) return;
    const bw = v.season.bw?.[team]?.[slot];
    const ovr = bw ? playerOvr(slot, bw) : 0;
    const role = roleOfSlot(slot);
    const ls = lines.get(`${team}/${slot}`) ?? [];
    const get = (cat: string, key: string) => ls.filter((l) => l.cat === cat).reduce((a, l) => a + statValue(l, key), 0);
    const pass = { yds: get('passing', 'yds'), td: get('passing', 'td'), int: get('passing', 'int') };
    const rush = { yds: get('rushing', 'yds'), td: get('rushing', 'td') };
    const rec = { n: get('receiving', 'rec'), yds: get('receiving', 'yds'), td: get('receiving', 'td') };
    const def = { tkl: get('defense', 'tkl'), sacks: get('defense', 'sacks'), int: get('defense', 'int') };
    const kick = { fgm: get('kicking', 'fgm'), fga: get('kicking', 'fga'), xpm: get('kicking', 'xpm') };
    const punt = { n: get('punting', 'punts'), yds: get('punting', 'yds') };
    const wins = v.records[team]?.w ?? 0;
    let score = 0, line = '';
    switch (role) {
      case 'QB':
        score = pass.yds / 20 + 4 * pass.td - 2 * pass.int + rush.yds / 10 + 6 * rush.td;
        line = `${n(pass.yds)} passing yards, ${pass.td} TD, ${pass.int} INT${rush.yds > 100 ? `; ${n(rush.yds)} rushing yards` : ''}`;
        break;
      case 'HB': case 'FB':
        score = rush.yds / 10 + 6 * rush.td + rec.yds / 10 + 6 * rec.td;
        line = `${n(rush.yds)} rushing yards, ${rush.td} TD${rec.yds > 100 ? `; ${n(rec.yds)} receiving yards` : ''}`;
        break;
      case 'WR': case 'TE':
        score = rec.yds / 10 + 6 * rec.td + rec.n / 4;
        line = `${pl(rec.n, 'catch', 'catches')}, ${n(rec.yds)} yards, ${rec.td} TD`;
        break;
      case 'OL':
        score = ovr + wins / 2;
        line = `${ovr} OVR, ${wins} wins`;
        break;
      case 'DE': case 'DT': case 'LB':
        score = def.tkl + 3 * def.sacks + 4 * def.int;
        line = `${pl(def.tkl, 'tackle')}, ${pl(def.sacks, 'sack')}${def.int ? `, ${def.int} INT` : ''}`;
        break;
      case 'CB': case 'S':
        score = def.tkl + 3 * def.sacks + 5 * def.int;
        line = `${pl(def.tkl, 'tackle')}, ${def.int} INT${def.sacks ? `, ${pl(def.sacks, 'sack')}` : ''}`;
        break;
      case 'K':
        score = 3 * kick.fgm - (kick.fga - kick.fgm) + kick.xpm / 2;
        line = `${kick.fgm} of ${kick.fga} field goals, ${kick.xpm} extra points`;
        break;
      case 'P':
        score = punt.n >= 10 ? punt.yds / punt.n : 0;
        line = punt.n ? `${(punt.yds / punt.n).toFixed(1)} yards a punt (${punt.n} punts)` : 'No punts';
        break;
      default:
        return;
    }
    // Ties (common for linemen) go to the better OVR.
    if (role !== 'OL' && ovr) line += `; ${ovr} OVR`;
    out.push({ player, team, slot, role, ovr, score: score + ovr / 1000, statPct: 0, statRel: 0, ovrPct: 0, line });
  }));
  // Percentiles within each award spot (HB and FB together, all linemen together, and so on).
  for (const spot of AWARD_SPOTS) {
    const group = out.filter((c) => spot.roles.includes(c.role));
    const scores = group.filter((c) => c.score > 0).map((c) => c.score).sort((a, b) => a - b);
    const ovrs = group.map((c) => c.ovr).sort((a, b) => a - b);
    const top = scores[scores.length - 1] || 0;
    for (const c of group) { c.statPct = pct(c.score, scores); c.statRel = top > 0 ? Math.max(0, c.score) / top : 0; c.ovrPct = pct(c.ovr, ovrs); }
  }
  return out;
}

/** The share of the list below the value (ties count half), 0-1. */
function pct(x: number, sorted: number[]): number {
  if (sorted.length < 2) return 1;
  let below = 0, same = 0;
  for (const y of sorted) { if (y < x) below++; else if (y === x) same++; }
  return Math.min(1, (below + Math.max(0, same - 1) / 2) / (sorted.length - 1));
}

/**
 * Stats and OVR together (user, 2026-11-12: "stats are very important in the decision-making, they aren't
 * everything"): only the leaders by stats are considered (the shortlist), then stats and OVR are blended.
 * The Heisman and the position awards lean 60/40, the All-American and All-Conference teams 70/30 ("a little
 * bit more stats based").
 */
export const AWARD_STATS_WEIGHT = 0.6;
export const TEAM_STATS_WEIGHT = 0.7;
// The stats part: mostly the percentile, a quarter how close to the spot's best (user, 2026-11-27: a back with 1,608
// rushing yards led the Heisman race but missed the Doak Walker top 5 behind 89+ OVR backs with ~650; the leaders'
// percentiles are all near 1, so OVR decided). "I'd still make OVR matter … but someone with those stats deserves top
// 5": on the sample dynasty a back with 2.2x the leader's stats and 84 OVR lands 3rd, behind two 90 OVR backs.
const statPart = (c: Candidate) => (3 * c.statPct + Math.sqrt(c.statRel)) / 4;
const blend = (c: Candidate, w: number) => w * statPart(c) + (1 - w) * c.ovrPct;
/** The top `n` by stats, then ordered by the blend. */
export function shortlist(pool: Candidate[], n: number, w: number): Candidate[] {
  return pool.filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, n)
    .sort((a, b) => blend(b, w) - blend(a, w) || b.score - a.score);
}

/** The best at each spot, skipping players already picked (a kicker who also punts counts once per team). */
function pickTeam(pool: Candidate[], skip: Set<number>): Candidate[] {
  const team: Candidate[] = [];
  for (const spot of AWARD_SPOTS) {
    const best = shortlist(pool.filter((c) => spot.roles.includes(c.role) && !skip.has(c.player)), Math.max(6, 4 * spot.n), TEAM_STATS_WEIGHT).slice(0, spot.n);
    best.forEach((c) => skip.add(c.player));
    team.push(...best);
  }
  return team;
}

/** A finished season's awards, or null while games are left. */
export function seasonAwards(d: Dynasty, season: DSeason): SeasonAwards | null {
  const v = seasonView(d, season);
  return v.save && v.done ? awardsOf(v, kickoffRanks(d, season)[0] ?? null) : null;
}

/** The awards from a season's stats so far (seasonAwards hands them out only once it's over). */
export function awardsOf(v: SeasonView, pre: number[] | null = null): SeasonAwards {
  const season = v.season;
  const all = candidates(v);
  const first = pickTeam(all, new Set());
  const second = pickTeam(all, new Set(first.map((c) => c.player)));
  const allConference: Record<number, Candidate[]> = {};
  for (const c of new Set(season.conf)) {
    if (c === INDEPENDENT) continue;
    allConference[c] = pickTeam(all.filter((x) => season.conf[x.team] === c), new Set());
  }
  // The Heisman: the 15 at the top of the Heisman watch (stats and team wins), blended with OVR.
  const byPlayer = new Map(all.map((c) => [c.player, c]));
  const watch = heismanWatch(v, 15);
  const heisman = watch
    .map((h, i) => ({ player: h.player, team: h.team, score: h.score, r: AWARD_STATS_WEIGHT * (watch.length > 1 ? 1 - i / (watch.length - 1) : 1) + (1 - AWARD_STATS_WEIGHT) * (byPlayer.get(h.player)?.ovrPct ?? 0) }))
    .sort((a, b) => b.r - a.r || b.score - a.score).slice(0, 5)
    .map(({ player, team, score }) => ({ player, team, score }));
  const position = awardsIn(season.year).map((a) => ({ key: a.key, label: a.name, winner: awardWatch(v, a, all, 1)[0] ?? null }));
  return { year: season.year, heisman, position, coach: coachAwards(v, pre), allAmerican: [first, second], allConference };
}

/** How much the Outland leaders' margins tilt the odds (see awardWatch). */
export const OUTLAND_TILT = 1.5;
/** Tackles' margins run wider than linemen's (stats spread more than OVR): this evens the split out (measured on 13
 * emulator seasons, 2026 v2.2.0-rc.3: about half each). */
export const OUTLAND_OL_BIAS = 0.085;
/** A number in [0, 1) from a string (FNV-1a), the same every time. */
function hash01(x: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 0x100000000;
}

/** Real stats (not just the OVR tie-break): an award's watch leaves out players who haven't done anything yet. */
const hasStats = (c: Candidate) => c.role === 'OL' || c.score > c.ovr / 1000 + 1e-9;

/**
 * An award's top `n` so far (its watch; the first is the winner once the season is over). The Outland weighs the
 * best offensive lineman against the best defensive tackle on how far each stands above his own group (each only
 * against his own side: linemen have no stats, tackles do), so it goes to either side (user, 2026-11-27: "Be sure
 * to balance that").
 */
export function awardWatch(v: SeasonView, a: NamedAward, all = candidates(v), n = 5): Candidate[] {
  const w = a.weight ?? AWARD_STATS_WEIGHT;
  if (a.roles === 'poy') {
    const byPlayer = new Map(all.map((c) => [c.player, c]));
    const pool = heismanWatch(v, 15).map((h) => byPlayer.get(h.player)).filter((c): c is Candidate => !!c && hasStats(c));
    return pool.sort((x, y) => blend(y, w) - blend(x, w) || y.score - x.score).slice(0, n);
  }
  if (a.roles === 'interior') {
    const side = (roles: string[]) => shortlist(all.filter((c) => roles.includes(c.role) && hasStats(c)), 10, w);
    const ol = side(['OL']), dt = side(['DT']);
    // The leader's margin over the next four of his side.
    const edge = (xs: Candidate[]) => (xs.length ? blend(xs[0], w) - xs.slice(1, 5).reduce((t, c) => t + blend(c, w), 0) / Math.max(1, Math.min(4, xs.length - 1)) : -1);
    // Each leader's margins usually differ by little, and tackles' stats spread wider than linemen's OVR, so the
    // margin alone would nearly always pick a tackle. The margin sets the odds instead (an even split when they're
    // even, at most 85/15), and a number from the season and the two leaders settles it: the same saves always
    // give the same winner. Checked on 13 emulator seasons and the simulator (docs/dynasty.md).
    const pOl = Math.max(0.15, Math.min(0.85, 0.5 + OUTLAND_OL_BIAS + (edge(ol) - edge(dt)) * OUTLAND_TILT));
    const roll = ol[0] && dt[0] ? hash01(`${v.season.year}-${ol[0].player}-${dt[0].player}`) : 0;
    const first = !dt.length || (ol.length && roll < pOl) ? ol : dt, second = first === ol ? dt : ol;
    // Alternate the two sides' lists after the leader, best first.
    const out: Candidate[] = [];
    for (let i = 0; out.length < n && (i < first.length || i < second.length); i++) {
      if (first[i]) out.push(first[i]);
      if (out.length < n && second[i]) out.push(second[i]);
    }
    return out;
  }
  return shortlist(all.filter((c) => (a.roles as string[]).includes(c.role) && hasStats(c)), Math.max(10, n), w).slice(0, n);
}

/**
 * Coach of the year (user, 2026-11-27: make the two differ). The Bear Bryant Award goes to a contender's coach: the
 * record, the rank now (the final rank once the season is over) and postseason wins (title games, playoff or bowl
 * games). The AFCA's goes to the biggest overachiever: wins, and the climb from the preseason rank (unranked = 70).
 */
export function coachWatch(v: SeasonView, key: 'bryant' | 'afca', pre: number[] | null, n = 5): { team: number; coach: number | null; score: number; line: string }[] {
  const post = new Array<number>(v.records.length).fill(0);
  for (const g of v.games) {
    if (g.week <= v.lastRegularWeek || g.vs === null || g.hs === null || g.visitor === null || g.home === null || g.vs === g.hs) continue;
    post[g.vs > g.hs ? g.visitor : g.home]++;
  }
  const out = v.records.map((r, team) => {
    const rank = v.rank[team] || 99;
    let score: number, line: string;
    if (key === 'bryant') {
      score = 3 * r.w - 3 * r.l + Math.max(0, 26 - rank) * 0.8 + 4 * post[team];
      line = `${r.w}-${r.l}${rank <= 25 ? `, Ranked #${rank}` : ''}${post[team] ? `, ${post[team]} postseason ${post[team] === 1 ? 'win' : 'wins'}` : ''}`;
    } else {
      const climb = pre ? Math.max(-30, Math.min(60, (pre[team] || 70) - (v.rank[team] || 70))) : 0;
      score = 2 * r.w - 2 * r.l + climb / 2;
      line = `${r.w}-${r.l}${!pre ? '' : pre[team] && pre[team] <= 25 ? `, ranked #${pre[team]} before the season` : ', unranked before the season'}${rank <= 25 ? `, Ranked #${rank} now` : ''}`;
    }
    return { team, coach: v.season.coach?.[team] ?? null, score, line };
  });
  return out.filter((x) => (v.records[x.team].w + v.records[x.team].l) > 0).sort((a, b) => b.score - a.score).slice(0, n);
}

function coachAwards(v: SeasonView, pre: number[] | null): SeasonAwards['coach'] {
  return COACH_AWARDS.filter((a) => a.since <= v.season.year).map((a) => {
    const top = coachWatch(v, a.key, pre, 1)[0];
    return { key: a.key, label: a.name, coach: top?.coach ?? null, team: top?.team ?? -1 };
  });
}

export interface PlayerHonor { year: number; label: string }

/** A player's honors across the dynasty, newest first (for his page). */
export function playerHonors(d: Dynasty, player: number, awards: (SeasonAwards | null)[]): PlayerHonor[] {
  const out: PlayerHonor[] = [];
  for (const a of awards) {
    if (!a) continue;
    if (a.heisman[0]?.player === player) out.push({ year: a.year, label: 'Heisman Trophy' });
    else if (a.heisman.some((h) => h.player === player)) out.push({ year: a.year, label: 'Heisman finalist' });
    for (const p of a.position) if (p.winner?.player === player) out.push({ year: a.year, label: p.label });
    if (a.allAmerican[0].some((c) => c.player === player)) out.push({ year: a.year, label: 'All-American, first team' });
    else if (a.allAmerican[1].some((c) => c.player === player)) out.push({ year: a.year, label: 'All-American, second team' });
    const season = d.seasons.find((s) => s.year === a.year);
    for (const [conf, team] of Object.entries(a.allConference)) {
      if (team.some((c) => c.player === player)) out.push({ year: a.year, label: `All-${season?.confNames[Number(conf)] ?? 'Conference'}` });
    }
  }
  return out.sort((x, y) => y.year - x.year);
}
