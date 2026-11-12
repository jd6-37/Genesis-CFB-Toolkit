// The front page's side column: the playoff picture as it stands and a Heisman watch. Pure functions.

import type { Dynasty } from './model';
import type { SaveGame } from './save';
import { INDEPENDENT, playerLines, standings, type PlayerLine, type SeasonView } from './derive';

/** The season's postseason format (save flags, season block +3): teams in the field, or 0 for none. */
export function playoffSize(v: SeasonView): number {
  const s = v.save?.season;
  if (!s || !s.postseason) return 0;
  if (s.flags & 0x10) return 2; // BCS 2
  if (s.flags & 0x08) return 4; // CFP 4
  if (s.flags & 0x04) return 24; // CFP 24
  return 12; // CFP 12
}

const POWER4 = ['SEC', 'Big Ten', 'ACC', 'Big 12'];

export interface PlayoffPicture {
  size: number;
  /** The field, seed 1 first. */
  field: number[];
  /** The next teams by rank that miss the field. */
  out: number[];
  /** True when the game has set the seeds (the postseason has started). */
  final: boolean;
  /** Teams in by an automatic bid (conference champions, Notre Dame). */
  auto: Set<number>;
}

/**
 * The field as the game picks it (claude.ai project notes, the 138-team season plan): CFP 12 and 24 take
 * the Power 4 champions, the best-ranked Group of 6 champion (and in CFP 12 Notre Dame in the top 12),
 * then the best-ranked teams; seeds by rank. CFP 4 and BCS 2 take the top teams. Before the title games,
 * each conference's leader stands in for its champion ("if the season ended today").
 */
export function playoffPicture(d: Dynasty, v: SeasonView, outCount = 4): PlayoffPicture | null {
  const size = playoffSize(v);
  if (!size) return null;
  const seeds = v.save?.season?.seeds ?? [];
  const byRank = (a: number, b: number) => v.rank[a] - v.rank[b];
  if (seeds.length >= size) {
    const inField = new Set(seeds.slice(0, size));
    return { size, field: seeds.slice(0, size), out: v.order.filter((t) => !inField.has(t)).slice(0, outCount), final: true, auto: new Set() };
  }
  const auto = new Set<number>();
  if (size >= 12) {
    const names = v.season.confNames;
    const leaders = names.map((_, c) => c).filter((c) => c !== INDEPENDENT && v.season.conf.includes(c)).map((c) => ({ c, t: standings(v, c)[0]?.team }));
    for (const { c, t } of leaders) if (t !== undefined && POWER4.includes(names[c])) auto.add(t);
    const g6 = leaders.filter(({ c, t }) => t !== undefined && !POWER4.includes(names[c])).map(({ t }) => t!).sort(byRank)[0];
    if (g6 !== undefined) auto.add(g6);
    const nd = d.teams.find((t) => t.school === 'Notre Dame')?.index;
    if (size === 12 && nd !== undefined && v.rank[nd] <= 12) auto.add(nd);
  }
  const field = [...auto];
  for (const t of v.order) {
    if (field.length >= size) break;
    if (!auto.has(t)) field.push(t);
  }
  field.sort(byRank);
  const inField = new Set(field);
  return { size, field, out: v.order.filter((t) => !inField.has(t)).slice(0, outCount), final: false, auto };
}

export interface HeismanEntry { player: number; team: number; score: number; lines: PlayerLine[] }

/**
 * A simple Heisman watch: points from the season's stats (passing yards / 20, passing TD × 4,
 * interceptions × −2, rushing and receiving yards / 10, their TDs × 6) plus 2 per team win.
 */
export function heismanWatch(v: SeasonView, n = 5): HeismanEntry[] {
  const by = new Map<number, HeismanEntry>();
  for (const l of playerLines(v)) {
    if (l.player === null || (l.cat !== 'passing' && l.cat !== 'rushing' && l.cat !== 'receiving')) continue;
    const s = l.s as unknown as Record<string, number>;
    const pts = l.cat === 'passing' ? s.yds / 20 + 4 * s.td - 2 * s.int : s.yds / 10 + 6 * s.td;
    const e = by.get(l.player) ?? { player: l.player, team: l.team, score: 2 * (v.records[l.team]?.w ?? 0), lines: [] };
    e.score += pts;
    e.lines.push(l);
    by.set(l.player, e);
  }
  return [...by.values()].filter((e) => e.score > 2 * (v.records[e.team]?.w ?? 0)).sort((a, b) => b.score - a.score).slice(0, n);
}

/**
 * Next week's big games (user, 2026-11-12), in this order: both teams ranked (by their ranks added up);
 * one ranked team against a team whose power rating is at least 85% of its own (an upset is possible);
 * a conference game between two teams in the top two of the conference with a conference win each.
 */
export function bigGames(v: SeasonView, week: number, n = 8): SaveGame[] {
  const power = v.save?.season?.power ?? [];
  const ranked = (t: number | null) => t !== null && v.rank[t] <= 25;
  const top2 = new Map<number, number[]>();
  const conf = (t: number) => v.season.conf[t];
  const leaders = (c: number) => {
    if (!top2.has(c)) top2.set(c, standings(v, c).slice(0, 2).filter((r) => r.cw >= 1).map((r) => r.team));
    return top2.get(c)!;
  };
  const scored: { g: SaveGame; tier: number; key: number }[] = [];
  for (const g of v.games) {
    if (g.week !== week || g.visitor === null || g.home === null) continue;
    const [a, b] = [g.visitor, g.home];
    const ra = v.rank[a], rb = v.rank[b];
    if (ranked(a) && ranked(b)) { scored.push({ g, tier: 0, key: ra + rb }); continue; }
    if (ranked(a) || ranked(b)) {
      const [r, o] = ranked(a) ? [a, b] : [b, a];
      if ((power[o] ?? 0) >= 0.85 * (power[r] ?? 0)) { scored.push({ g, tier: 1, key: v.rank[r] }); continue; }
    }
    if (conf(a) === conf(b) && conf(a) !== INDEPENDENT && leaders(conf(a)).includes(a) && leaders(conf(a)).includes(b)) {
      scored.push({ g, tier: 2, key: Math.min(ra, rb) });
    }
  }
  return scored.sort((x, y) => x.tier - y.tier || x.key - y.key).slice(0, n).map((x) => x.g);
}
