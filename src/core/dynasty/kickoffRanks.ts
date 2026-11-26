// Every team's rank going into each week of a season (user, 2026-11-26: on Scores, "the rankings next to the team
// names should reflect their rank going into that game"). The save keeps two rankings: lastRanks, as of the week
// before the last week played (what the games of that week kicked off with), and power, today's (what the next
// week kicks off with). So each imported save gives the ranks for up to two weeks, and a season imported every week
// has them all. Week 0 without a save that has them: the preseason poll. A week no save covers: null (no ranks).
import { fromBase64, type DSeason, type Dynasty } from './model';
import { ranksFromPower, readDynastySave } from './save';
import { preseasonPoll } from './poll';

const cache = new WeakMap<DSeason, (number[] | null)[]>();

/** rank[team] going into each week (1 = No. 1; 0 = not known for that team), or null for a week no save covers. */
export function kickoffRanks(d: Dynasty, season: DSeason): (number[] | null)[] {
  const hit = cache.get(season);
  if (hit) return hit;
  const out: (number[] | null)[] = [];
  for (const imp of season.imports) {
    const save = readDynastySave(fromBase64(imp.data));
    const s = save.season;
    if (!s) continue;
    let last = -1;
    for (const g of s.games) if (g.vs !== null && g.week > last) last = g.week;
    if (last < 0) {
      // Nothing played yet: today's ranks are week 0's, when the save has them.
      if (s.power.some((p) => p !== 0)) out[0] ??= ranksFromPower(s.power).rank;
      continue;
    }
    if (s.lastRanks.some((r) => r > 0)) out[last] = s.lastRanks.slice();
    // Today's ranks are next week's kickoff ranks only once the last week is complete.
    const done = s.games.filter((g) => g.week === last).every((g) => g.vs !== null || g.hold || g.visitor === null || g.home === null);
    if (done && last + 1 < s.weeks) out[last + 1] = ranksFromPower(s.power).rank;
  }
  if (!out[0]) {
    const poll = preseasonPoll(d, season);
    if (poll) {
      const r = new Array<number>(d.teams.length).fill(0);
      for (const e of poll) r[e.team] = e.rank;
      out[0] = r;
    }
  }
  const weeks = Math.max(out.length, 0);
  const full = Array.from({ length: weeks }, (_, w) => out[w] ?? null);
  cache.set(season, full);
  return full;
}
