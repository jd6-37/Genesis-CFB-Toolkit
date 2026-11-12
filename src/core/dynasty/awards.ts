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

/** Position awards (named for what they are, not after real trophies, except the Heisman). */
export const POSITION_AWARDS: { key: string; label: string; spot: string }[] = [
  { key: 'qb', label: 'Best quarterback', spot: 'QB' },
  { key: 'rb', label: 'Best running back', spot: 'RB' },
  { key: 'wr', label: 'Best receiver', spot: 'WR' },
  { key: 'ol', label: 'Best offensive lineman', spot: 'OL' },
  { key: 'def', label: 'Best defensive player', spot: 'DEF' },
  { key: 'k', label: 'Best kicker', spot: 'K' },
];

export interface Candidate {
  player: number;
  team: number;
  slot: number;
  role: string;
  ovr: number;
  score: number;
  /** A short line of his season ("1,204 rushing yards, 14 TD"). */
  line: string;
}

export interface SeasonAwards {
  year: number;
  heisman: { player: number; team: number; score: number }[];
  position: { key: string; label: string; winner: Candidate | null }[];
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
    out.push({ player, team, slot, role, ovr, score: score + ovr / 1000, line });
  }));
  return out;
}

/** The best at each spot, skipping players already picked (a kicker who also punts counts once per team). */
function pickTeam(pool: Candidate[], skip: Set<number>): Candidate[] {
  const team: Candidate[] = [];
  for (const spot of AWARD_SPOTS) {
    const best = pool.filter((c) => spot.roles.includes(c.role) && !skip.has(c.player) && c.score > 0).sort((a, b) => b.score - a.score).slice(0, spot.n);
    best.forEach((c) => skip.add(c.player));
    team.push(...best);
  }
  return team;
}

/** A finished season's awards, or null while games are left. */
export function seasonAwards(d: Dynasty, season: DSeason): SeasonAwards | null {
  const v = seasonView(d, season);
  return v.save && v.done ? awardsOf(v) : null;
}

/** The awards from a season's stats so far (seasonAwards hands them out only once it's over). */
export function awardsOf(v: SeasonView): SeasonAwards {
  const season = v.season;
  const all = candidates(v);
  const first = pickTeam(all, new Set());
  const second = pickTeam(all, new Set(first.map((c) => c.player)));
  const allConference: Record<number, Candidate[]> = {};
  for (const c of new Set(season.conf)) {
    if (c === INDEPENDENT) continue;
    allConference[c] = pickTeam(all.filter((x) => season.conf[x.team] === c), new Set());
  }
  const bestOf = (roles: string[]) => all.filter((c) => roles.includes(c.role) && c.score > 0).sort((a, b) => b.score - a.score)[0] ?? null;
  const position = POSITION_AWARDS.map((a) => ({
    key: a.key, label: a.label,
    winner: a.spot === 'DEF' ? bestOf(['DE', 'DT', 'LB', 'CB', 'S']) : bestOf(AWARD_SPOTS.find((s) => s.label === a.spot)!.roles),
  }));
  const heisman = heismanWatch(v, 5).map((h) => ({ player: h.player, team: h.team, score: h.score }));
  return { year: season.year, heisman, position, allAmerican: [first, second], allConference };
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
