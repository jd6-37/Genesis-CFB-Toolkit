// A game's history inside the dynasty (user, 2026-11-26: "the series in the dynasty … The more historical data we can
// save and use to enrich the storytelling, the better"). Everything comes from the seasons' kept saves: every game of
// every season, and the ranks each week kicked off with (kickoffRanks.ts).
import type { DSeason, Dynasty } from './model';
import { seasonView, type SeasonView } from './derive';
import { kickoffRanks } from './kickoffRanks';

export interface Meeting { year: number; week: number; visitor: number; home: number; vs: number; hs: number; winner: number | null }

const views = new WeakMap<DSeason, SeasonView>();
const viewOf = (d: Dynasty, s: DSeason) => { let v = views.get(s); if (!v) { v = seasonView(d, s); views.set(s, v); } return v; };

type At = { year: number; week: number };

/** Every played game of a team in the dynasty, oldest first, up to and including `at`. */
function gamesOf(d: Dynasty, team: number, at: At): (Meeting & { rank: number })[] {
  const out: (Meeting & { rank: number })[] = [];
  for (const s of d.seasons) {
    if (s.year > at.year) continue;
    const v = viewOf(d, s);
    const ranks = kickoffRanks(d, s);
    for (const g of v.games) {
      if (g.vs === null || g.hs === null || g.visitor === null || g.home === null) continue;
      if (g.visitor !== team && g.home !== team) continue;
      if (s.year === at.year && g.week > at.week) continue;
      const opp = g.visitor === team ? g.home : g.visitor;
      out.push({ year: s.year, week: g.week, visitor: g.visitor, home: g.home, vs: g.vs, hs: g.hs,
        winner: g.vs === g.hs ? null : g.vs > g.hs ? g.visitor : g.home, rank: ranks[g.week]?.[opp] ?? 0 });
    }
  }
  return out.sort((x, y) => x.year - y.year || x.week - y.week);
}

/** Every meeting of a and b in the dynasty, oldest first, up to and including `at`. */
export function meetings(d: Dynasty, a: number, b: number, at: At): Meeting[] {
  return gamesOf(d, a, at).filter((m) => m.visitor === b || m.home === b);
}

export interface SeriesStory {
  /** "Tulane leads 3-1 in this dynasty", "Tied 2-2 …", "First meeting in this dynasty". */
  record: string;
  /** Short facts: streaks, the biggest win, firsts and droughts. */
  facts: string[];
  /** The meetings before this one, newest first (at most five). */
  last: Meeting[];
}

/** The story of a game's series, as of that game (the game itself counted). */
export function seriesStory(d: Dynasty, a: number, b: number, at: At, name: (t: number) => string): SeriesStory {
  const all = meetings(d, a, b, at);
  const game = all[all.length - 1];
  const prior = all.slice(0, -1);
  const wins = (t: number) => all.filter((m) => m.winner === t).length;
  const ties = all.filter((m) => m.winner === null).length;
  const [wa, wb] = [wins(a), wins(b)];
  const t = ties ? `-${ties}` : '';
  const record = all.length <= 1 ? 'First meeting in this dynasty'
    : wa === wb ? `Tied ${wa}-${wb}${t} in this dynasty`
      : `${name(wa > wb ? a : b)} leads ${Math.max(wa, wb)}-${Math.min(wa, wb)}${t} in this dynasty`;
  const facts: string[] = [];
  const w = game?.winner ?? null;
  if (game && w !== null) {
    const l = w === a ? b : a;
    // Series streaks: the winner's run, or the one the game ended.
    let run = 0;
    for (let i = all.length - 1; i >= 0 && all[i].winner === w; i--) run++;
    let ended = 0;
    for (let i = prior.length - 1; i >= 0 && prior[i].winner === l; i--) ended++;
    if (run >= 2) facts.push(`${name(w)} has won ${run} straight in the series`);
    else if (ended >= 2) facts.push(`${name(w)} ends ${name(l)}'s ${ended}-game run in the series`);
    // First win in the series after losses, and the first win at the other team's stadium.
    if (prior.length >= 2 && prior.every((m) => m.winner === l)) facts.push(`${name(w)}'s first win over ${name(l)} in this dynasty`);
    else if (w === game.visitor) {
      const there = prior.filter((m) => m.home === l);
      if (there.length >= 2 && there.every((m) => m.winner === l)) facts.push(`${name(w)}'s first win at ${name(l)} in this dynasty`);
    }
    // The biggest win in the series.
    if (all.length >= 3) {
      const margin = (m: Meeting) => Math.abs(m.vs - m.hs);
      const big = all.filter((m) => m.winner !== null).sort((x, y) => margin(y) - margin(x) || y.year - x.year)[0];
      if (big) facts.push(`Biggest win: ${name(big.winner!)} ${Math.max(big.vs, big.hs)}-${Math.min(big.vs, big.hs)} (${big.year})${big === game ? ', this game' : ''}`);
    }
    // A win over a ranked team: the first in the dynasty, or the first in a while.
    const lr = gamesOf(d, w, at).at(-1)?.rank ?? 0;
    if (lr >= 1 && lr <= 25) {
      const earlier = gamesOf(d, w, at).slice(0, -1).filter((m) => m.winner === w && m.rank >= 1 && m.rank <= 25);
      const seasons = d.seasons.filter((s) => s.year <= at.year).length;
      if (!earlier.length && seasons > 1) facts.push(`${name(w)}'s first win over a ranked team in this dynasty`);
      else if (earlier.length && earlier[earlier.length - 1].year < at.year - 1) facts.push(`${name(w)}'s first win over a ranked team since ${earlier[earlier.length - 1].year}`);
    }
  }
  return { record, facts, last: prior.slice(-5).reverse() };
}
