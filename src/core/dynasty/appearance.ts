// Names and skin tones of the dynasty's players (user, 2026-11-12). Players are White or Black in the app
// (the share by position follows the user's numbers); that decides the skin tone, two of each, half and
// half, and for generated players which names fit. Name odds: nameOdds.json (cli/nameodds.ts), how
// likely a CFB 27 first or last name is a Black player's (Census 2010 surnames, Tzioumis 2018 first names,
// and for names they don't have, the CFB 27 players with that name).

import NAME_ODDS from './nameOdds.json';

/** Share of Black players by position (user, 2026-11-12; QB about 45%). */
export const BLACK_SHARE: Record<string, number> = {
  QB: 0.45, HB: 0.955, FB: 0.47, WR: 0.811, TE: 0.354, LT: 0.488, LG: 0.495, C: 0.343, RG: 0.479, RT: 0.487,
  LE: 0.759, RE: 0.7, DT: 0.735, LOLB: 0.751, MLB: 0.696, ROLB: 0.734, CB: 0.982, FS: 0.896, SS: 0.892, K: 0.038, P: 0.048,
};
export const blackShare = (pos: string) => BLACK_SHARE[pos] ?? 0.5;

/** The four skin tones (0-1 light, for White players; 2-3 dark, for Black players). For the app's portraits. */
export const SKIN_TONES = [
  { label: 'Light', color: '#e0b494' },
  { label: 'Tan', color: '#c38e72' },
  { label: 'Brown', color: '#8a6d58' },
  { label: 'Dark', color: '#524234' },
] as const;
export const skinFor = (black: boolean, r: () => number) => (black ? 2 : 0) + (r() < 0.5 ? 0 : 1);

const ODDS = NAME_ODDS as { first: Record<string, number>; last: Record<string, number> };
const BASE = 0.13;
const logit = (p: number) => Math.log(p / (1 - p));
const clampP = (p: number) => Math.min(0.99, Math.max(0.01, p));
/** How likely a name is a Black player's (0-1); BASE when unknown. */
export const firstOdds = (n: string) => ODDS.first[n] ?? BASE;
export const lastOdds = (n: string) => ODDS.last[n] ?? BASE;

/** Name evidence for a player: higher = more likely Black (log odds against the average). */
export const nameScore = (first: string, last: string) =>
  logit(clampP(firstOdds(first))) + logit(clampP(lastOdds(last))) - 2 * logit(BASE);

/**
 * Which of a position's players are Black: the share for the position, given to the players whose names
 * point that way most, with random noise (a logistic draw), so names lean the choice without fixing it.
 */
export function assignBlack(players: { first: string; last: string; pos: string }[], r: () => number): boolean[] {
  const out = new Array<boolean>(players.length).fill(false);
  const byPos = new Map<string, number[]>();
  players.forEach((p, i) => byPos.set(p.pos, [...(byPos.get(p.pos) ?? []), i]));
  for (const [pos, idx] of byPos) {
    const n = Math.round(blackShare(pos) * idx.length);
    const noise = () => { const u = Math.min(1 - 1e-9, Math.max(1e-9, r())); return Math.log(u / (1 - u)); };
    const ranked = idx.map((i) => ({ i, s: nameScore(players[i].first, players[i].last) + noise() })).sort((a, b) => b.s - a.s);
    for (let k = 0; k < n; k++) out[ranked[k].i] = true;
  }
  return out;
}

/** Longest names for generated players (the game's Team Rosters print first and last name in 26 characters). */
export const MAX_FIRST = 10;
export const MAX_LAST = 12;
/** Characters the game's font has. */
const FONT_OK = /^[A-Za-z0-9'. -]+$/;
export const nameFits = (n: string, max: number) => n.length <= max && FONT_OK.test(n);

export interface NamePool {
  names: string[];
  /** Cumulative weights for White and Black players. */
  cum: [number[], number[]];
}

/** A pool of names (with how often each appears) for weighted picks by group. */
export function namePool(counts: Map<string, number>, odds: (n: string) => number, max: number): NamePool {
  const names = [...counts.keys()].filter((n) => nameFits(n, max)).sort();
  const cum: [number[], number[]] = [[], []];
  let w = 0, b = 0;
  for (const n of names) {
    const c = counts.get(n)!, p = odds(n);
    cum[0].push((w += c * (1 - p)));
    cum[1].push((b += c * p));
  }
  return { names, cum };
}

export function pickName(pool: NamePool, black: boolean, r: () => number): string {
  const cum = pool.cum[black ? 1 : 0];
  const x = r() * cum[cum.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
  return pool.names[lo];
}
