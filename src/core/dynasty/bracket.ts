// The playoff bracket (Scores → CFP Bracket): the field, its pairings as the game plays them, results from the save,
// and the bowls that host each round. Pure functions.

import type { Dynasty } from './model';
import type { SeasonView } from './derive';
import { playoffPicture, type PlayoffPicture } from './outlook';
import type { Story } from './news';

/** One team's place in a game of the bracket: a known team, or the winner of an earlier game still to be played. */
export interface BracketSlot {
  team: number | null;
  seed: number;
  pts: number | null;
  won: boolean;
  lost: boolean;
  /** For a team still to be decided: the game it comes from ("8/9", "QF 1"). */
  from?: string;
}

export interface BracketGame {
  /** Round index (0 = the first round played). */
  round: number;
  /** Index inside the round, in bracket order. */
  index: number;
  a: BracketSlot;
  b: BracketSlot;
  /** The bowl that hosts it (quarterfinals and later in the CFP, from the real rotation), or null. */
  bowl: string | null;
  /** The save's game, once found. */
  game: number | null;
}

export interface Bracket {
  size: number;
  /** Round names, first round first ("First Round", …, "National Championship"). */
  rounds: string[];
  /** Short round names for "Winner of" lines ("R1", "QF"). */
  short: string[];
  games: BracketGame[][];
  /** Rounds played 1:1 into the next (the bye rounds: CFP 12's first round feeds the quarterfinals game for game). */
  pods: number;
  /** True once the game has set the field (seeds in the save). */
  final: boolean;
  /** The season's champion, once the title game is played. */
  champion: number | null;
  picture: PlayoffPicture;
}

/** CFP 12: first round 8-9, 5-12, 7-10, 6-11; hosts 1, 4, 2, 3 (the ROM's CFPR1). */
const R12 = [[8, 9], [5, 12], [7, 10], [6, 11]];
const H12 = [1, 4, 2, 3];
/** CFP 24: first round 16-17, 9-24, 13-20, 12-21, 15-18, 10-23, 14-19, 11-22; hosts 1, 8, 4, 5, 2, 7, 3, 6 (CFPR24). */
const R24 = [[16, 17], [9, 24], [13, 20], [12, 21], [15, 18], [10, 23], [14, 19], [11, 22]];
const H24 = [1, 8, 4, 5, 2, 7, 3, 6];

/**
 * The bowls of the CFP's quarterfinals and semifinals by season (collegefootballplayoff.com, 2026-02-03):
 * quarterfinals in bracket order, then the two semifinals. Later seasons alternate the two.
 * Which quarterfinal each bowl gets is the committee's pick in real life; here it goes by bracket order.
 */
const BOWLS: Record<number, { qf: string[]; sf: string[] }> = {
  2026: { qf: ['Rose Bowl', 'Peach Bowl', 'Cotton Bowl', 'Fiesta Bowl'], sf: ['Orange Bowl', 'Sugar Bowl'] },
  2027: { qf: ['Rose Bowl', 'Peach Bowl', 'Sugar Bowl', 'Fiesta Bowl'], sf: ['Orange Bowl', 'Cotton Bowl'] },
};
export function cfpBowls(year: number): { qf: string[]; sf: string[] } {
  const keys = Object.keys(BOWLS).map(Number);
  const first = keys[0];
  const k = year < first ? first : first + ((year - first) % keys.length);
  return BOWLS[k];
}

const NAMES: Record<number, { rounds: string[]; short: string[] }> = {
  2: { rounds: ['National Championship'], short: ['NC'] },
  4: { rounds: ['Semifinal', 'National Championship'], short: ['SF', 'NC'] },
  12: { rounds: ['First Round', 'Quarterfinal', 'Semifinal', 'National Championship'], short: ['R1', 'QF', 'SF', 'NC'] },
  24: { rounds: ['First Round', 'Second Round', 'Quarterfinal', 'Semifinal', 'National Championship'], short: ['R1', 'R2', 'QF', 'SF', 'NC'] },
};

/** The season's bracket, or null without a playoff (1994's bowls, Finals: None). */
export function bracketOf(d: Dynasty, v: SeasonView): Bracket | null {
  const pic = playoffPicture(d, v);
  if (!pic || !NAMES[pic.size]) return null;
  const { size } = pic;
  const { rounds, short } = NAMES[size];
  const seedOf = (s: number) => pic.field[s - 1] ?? null;
  const slot = (s: number): BracketSlot => ({ team: seedOf(s), seed: s, pts: null, won: false, lost: false });
  // The CFP's first round is played the week after the title games (the ROM's CFPSET; BCS 2 / CFP 4 the same).
  const week = (r: number) => v.lastRegularWeek + 2 + r;
  const bowls = size === 2 ? null : cfpBowls(v.season.year);

  const play = (r: number, i: number, a: BracketSlot, b: BracketSlot): BracketGame => {
    let bowl: string | null = null;
    if (bowls) {
      const fromEnd = rounds.length - 1 - r; // 0 = title game, 1 = semifinals, 2 = quarterfinals
      if (fromEnd === 1) bowl = bowls.sf[i] ?? null;
      if (fromEnd === 2 && size >= 12) bowl = bowls.qf[i] ?? null;
    }
    const out: BracketGame = { round: r, index: i, a, b, bowl, game: null };
    if (!pic.final || a.team === null || b.team === null) return out;
    const g = v.games.find((x) => x.week === week(r) && ((x.visitor === a.team && x.home === b.team) || (x.visitor === b.team && x.home === a.team)));
    if (!g) return out;
    out.game = g.index;
    if (g.vs === null || g.hs === null) return out;
    const pa = g.visitor === a.team ? g.vs : g.hs, pb = g.visitor === a.team ? g.hs : g.vs;
    out.a = { ...a, pts: pa, won: pa > pb, lost: pa < pb };
    out.b = { ...b, pts: pb, won: pb > pa, lost: pb < pa };
    return out;
  };
  const next = (g: BracketGame, from: string): BracketSlot => {
    const w = g.a.won ? g.a : g.b.won ? g.b : null;
    return w ? { team: w.team, seed: w.seed, pts: null, won: false, lost: false } : { team: null, seed: 0, pts: null, won: false, lost: false, from };
  };

  const games: BracketGame[][] = [];
  let pods = 0;
  let level: BracketGame[];
  if (size === 12 || size === 24) {
    const [first, hosts] = size === 12 ? [R12, H12] : [R24, H24];
    const r1 = first.map(([x, y], i) => play(0, i, slot(x), slot(y)));
    const r2 = hosts.map((h, i) => play(1, i, slot(h), next(r1[i], `${first[i][0]}/${first[i][1]}`)));
    games.push(r1, r2);
    pods = 1;
    level = r2;
  } else {
    // CFP 4: semifinals 1-4, 2-3; BCS 2: the final 1-2 (the ROM's CFPR4 / CFPR2).
    level = size === 4 ? [play(0, 0, slot(1), slot(4)), play(0, 1, slot(2), slot(3))] : [play(0, 0, slot(1), slot(2))];
    games.push(level);
  }
  while (level.length > 1) {
    const r = games.length;
    const prev = short[r - 1];
    level = Array.from({ length: level.length / 2 }, (_, i) => play(r, i, next(level[2 * i], `${prev} ${2 * i + 1}`), next(level[2 * i + 1], `${prev} ${2 * i + 2}`)));
    games.push(level);
  }
  const title = games[games.length - 1][0];
  const champion = title.a.won ? title.a.team : title.b.won ? title.b.team : null;
  return { size, rounds, short, games, pods, final: pic.final, champion, picture: pic };
}

/** The CFP art's label for a story about the playoff ("Rose Bowl · Quarterfinal"), or null for any other story. */
export function cfpLabel(story: Pick<Story, 'kind' | 'game'>, b: Bracket | null): string | null {
  if (!b) return null;
  if (story.kind === 'cfp') return b.size === 2 ? 'BCS National Championship' : 'College Football Playoff';
  if (story.game === undefined) return null;
  for (const round of b.games) {
    for (const g of round) {
      if (g.game !== story.game) continue;
      const name = b.rounds[g.round];
      if (story.kind === 'champion') return `${b.size === 2 ? 'BCS' : 'CFP'} National Champion`;
      return g.bowl ? `${g.bowl} · ${name}` : `${b.size === 2 ? 'BCS' : 'CFP'} ${name}`;
    }
  }
  return null;
}


/** Each bowl's own trophy art (cli/trophy-art.py, `bowl-*`; user, 2026-11-28: "unique trophies for each one"). */
const BOWL_ART: Record<string, string> = {
  'Rose Bowl': 'bowl-rose', 'Sugar Bowl': 'bowl-sugar', 'Orange Bowl': 'bowl-orange', 'Cotton Bowl': 'bowl-cotton', 'Fiesta Bowl': 'bowl-fiesta',
  'Peach Bowl': 'bowl-peach', 'Florida Citrus Bowl': 'bowl-citrus', 'Holiday Bowl': 'bowl-holiday', 'Gator Bowl': 'bowl-gator', 'Sun Bowl': 'bowl-sun',
  'Hall of Fame Bowl': 'bowl-halloffame', 'Freedom Bowl': 'bowl-freedom', 'Alamo Bowl': 'bowl-alamo', 'Copper Bowl': 'bowl-copper',
  'Aloha Bowl': 'bowl-aloha', 'Carquest Bowl': 'bowl-carquest', 'Liberty Bowl': 'bowl-liberty', 'Independence Bowl': 'bowl-independence',
  'Las Vegas Bowl': 'bowl-lasvegas',
};
export const bowlArt = (name: string): string => BOWL_ART[name] ?? 'playoff';
/** The CFP National Championship Trophy's art. */
export const CFP_TITLE_ART = 'bowl-cfp';
/** Every bowl with its own trophy, in the 1994 ROM's order then the CFP's (Manage → Trophy art). */
export const BOWL_TROPHIES = Object.keys(BOWL_ART);
