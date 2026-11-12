// The records book (user, 2026-11-12): career and single-season player records and team records,
// league-wide or for one school, across every season of the dynasty. Pure functions.
import type { Dynasty } from './model';
import { playerLines, RECORD_STATS, seasonView, statValue, type SeasonView } from './derive';

export interface CareerEntry { player: number; team: number; value: number; first: number; last: number }

/** The top career totals of a stat (one school's: only what he did there). */
export function careerRecords(d: Dynasty, stat: (typeof RECORD_STATS)[number], team?: number, n = 10): CareerEntry[] {
  const by = new Map<number, CareerEntry>();
  for (const s of d.seasons) {
    for (const l of playerLines(seasonView(d, s))) {
      if (l.cat !== stat.cat || l.player === null || (team !== undefined && l.team !== team)) continue;
      const value = statValue(l, stat.key);
      if (value <= 0) continue;
      const e = by.get(l.player) ?? { player: l.player, team: l.team, value: 0, first: s.year, last: s.year };
      e.value += value; e.last = s.year; e.team = l.team;
      by.set(l.player, e);
    }
  }
  return [...by.values()].sort((a, b) => b.value - a.value).slice(0, n);
}

export interface TeamRecordEntry { team: number; year: number; value: number; note: string }
export interface TeamRecordList { label: string; list: TeamRecordEntry[] }

const score = (a: number, b: number) => `${a}-${b}`;

/** Team records: season wins, points and fewest allowed (finished seasons), points in a game and the biggest wins. */
export function teamRecords(d: Dynasty, team?: number, n = 5): TeamRecordList[] {
  const views: SeasonView[] = d.seasons.map((s) => seasonView(d, s)).filter((v) => v.save);
  const mine = (t: number) => team === undefined || t === team;
  const wins: TeamRecordEntry[] = [], pts: TeamRecordEntry[] = [], allowed: TeamRecordEntry[] = [], game: TeamRecordEntry[] = [], margin: TeamRecordEntry[] = [];
  for (const v of views) {
    const year = v.season.year;
    for (const r of v.records) {
      if (!mine(r.team) || r.w + r.l === 0) continue;
      wins.push({ team: r.team, year, value: r.w, note: `${r.w}-${r.l}` });
      pts.push({ team: r.team, year, value: r.pf, note: `${(r.pf / (r.w + r.l)).toFixed(1)} a game` });
      if (v.done) allowed.push({ team: r.team, year, value: r.pa, note: `${(r.pa / (r.w + r.l)).toFixed(1)} a game` });
    }
    for (const g of v.games) {
      if (g.vs === null || g.hs === null || g.visitor === null || g.home === null) continue;
      for (const [t, us, them, opp] of [[g.visitor, g.vs, g.hs, g.home], [g.home, g.hs, g.vs, g.visitor]] as const) {
        if (!mine(t)) continue;
        const vs = `${score(us, them)} vs. ${d.teams[opp].school}`;
        game.push({ team: t, year, value: us, note: vs });
        if (us > them) margin.push({ team: t, year, value: us - them, note: vs });
      }
    }
  }
  const top = (l: TeamRecordEntry[], low = false) => l.sort((a, b) => (low ? a.value - b.value : b.value - a.value) || a.year - b.year).slice(0, n);
  return [
    { label: 'Most wins in a season', list: top(wins) },
    { label: 'Most points in a season', list: top(pts) },
    { label: 'Fewest points allowed in a season', list: top(allowed, true) },
    { label: 'Most points in a game', list: top(game) },
    { label: 'Biggest wins', list: top(margin) },
  ];
}
