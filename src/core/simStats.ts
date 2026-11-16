// Stat multipliers for simulated games (H-021, the ROM lane's simstats.py; 2026 test39 / 1994 test42 on).
// User (2026-11-16): "multiply the CPU stats (individually by category – passing, rushing, INTs, sacks, tackles), and
// give the user the ability to edit those multipliers to tweak the stats to match their game style".
//
// Table "SST1" at 0x2D6400, then six big-endian words:
//   0x2D6404 Passing %         pass attempts, completions, passing yards; receivers' catches, yards, drops
//   0x2D6406 Rushing %         rushing attempts and yards
//   0x2D6408 Interceptions %   interceptions thrown and by defenders
//   0x2D640A Sacks %           sacks by defenders
//   0x2D640C Tackles %         tackles
//   0x2D640E reserved (the ROM lane's "TDs match the score" switch until 2026 test39 / 1994 test42; gone since
//            test40 / test43: the game already matches box-score TDs to the score). The apps never write it.
// 100 = x1 (the game's own numbers). Only simulated games; touchdowns are never multiplied.

export interface SimStats {
  passing: number;
  rushing: number;
  interceptions: number;
  sacks: number;
  tackles: number;
}

export type StatKey = keyof SimStats;
export const STAT_KEYS: StatKey[] = ['passing', 'rushing', 'interceptions', 'sacks', 'tackles'];
export const STAT_LABELS: Record<StatKey, string> = {
  passing: 'Passing', rushing: 'Rushing', interceptions: 'Interceptions', sacks: 'Sacks', tackles: 'Tackles',
};
export const STAT_SCALES: Record<StatKey, string> = {
  passing: 'pass attempts, completions and yards; catches, receiving yards and drops',
  rushing: 'rushing attempts and yards',
  interceptions: 'interceptions thrown and caught',
  sacks: 'sacks',
  tackles: 'tackles',
};

export const STATS_DEFAULTS: SimStats = { passing: 100, rushing: 100, interceptions: 100, sacks: 100, tackles: 100 };
/** The range the apps offer (the ROM takes 0-1000; the ROM lane suggests 50-300 in steps of 10). */
export const STAT_LIMITS = [50, 300] as const;
export const STAT_STEP = 10;

const TAG_AT = 0x2d6400;
const AT: Record<StatKey, number> = { passing: 0x2d6404, rushing: 0x2d6406, interceptions: 0x2d6408, sacks: 0x2d640a, tackles: 0x2d640c };
const END = 0x2d640e;
/** The bytes a write may change (the checksum aside). */
export const STAT_RANGES: [number, number][] = [[0x2d6404, END]];

const word = (d: Uint8Array, a: number) => (d[a] << 8) | d[a + 1];
const put = (d: Uint8Array, a: number, v: number) => { d[a] = (v >> 8) & 0xff; d[a + 1] = v & 0xff; };

/** The ROM has the multipliers table ("SST1"). */
export const hasSimStats = (d: Uint8Array) =>
  d.length >= END && d[TAG_AT] === 0x53 && d[TAG_AT + 1] === 0x53 && d[TAG_AT + 2] === 0x54 && d[TAG_AT + 3] === 0x31;

export function readSimStats(d: Uint8Array): SimStats | null {
  if (!hasSimStats(d)) return null;
  return Object.fromEntries(STAT_KEYS.map((k) => [k, word(d, AT[k])])) as unknown as SimStats;
}

/** Why settings can't be written; empty if they can. */
export function statsProblems(s: SimStats): string[] {
  const [lo, hi] = STAT_LIMITS;
  return STAT_KEYS.filter((k) => !Number.isInteger(s[k]) || s[k] < lo || s[k] > hi || s[k] % STAT_STEP !== 0)
    .map((k) => `${STAT_LABELS[k]} must be from ${lo}% to ${hi}% in steps of ${STAT_STEP}.`);
}

/** Writes the multipliers (the ROM must have the table). The caller fixes the checksum. */
export function writeSimStats(d: Uint8Array, s: SimStats): void {
  if (!hasSimStats(d)) throw new Error("This ROM doesn't have the sim stat multipliers (2026 test39 / 1994 test42 or later).");
  const bad = statsProblems(s);
  if (bad.length) throw new Error(bad.join(' '));
  for (const k of STAT_KEYS) put(d, AT[k], s[k]);
}

export const sameStats = (a: SimStats, b: SimStats) => STAT_KEYS.every((k) => a[k] === b[k]);
