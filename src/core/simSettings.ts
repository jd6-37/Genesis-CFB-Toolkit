// The season sim's three settings (the ROM lane's simfix.py, H-016; both Elevated editions from 2026 test33 /
// 1994 test36 on). The sim decides every CPU-vs-CPU game of a season (claude.ai project notes:
// bw95-sim-upsets-notes.md). For each scoring chance:
//   d3 = 150 + K/4 × (own OFF word − opponent's DEF word), clamped 20-300; a touchdown when random(R − 2·d3) ≤ d3.
// Each quarter a team gets 2^n + 1 chances (Game Length 0; longer games get more).
//
//   K  rating weight      word at 0x2D6008 (the `muls #K` immediate in SK)   default 8, stock BW95 4
//   n  scoring chances    word at 0x06F120 = 0xE142 | n << 9 (`asl.w #n,d2`) default 2 (5 chances), stock 1 (3)
//   R  roll range         word at 0x06F124 = R − 550                         default 1100, stock 1350
//
// The mod is there when 0x06F10C is `jsr $2D6000` and 0x2D6000 starts `04 43 00 96`; without it the settings
// can't be changed (older ROMs, the 36-team game).

export interface SimSettings {
  /** Rating weight: higher = the better team wins more often. */
  weight: number;
  /** Scoring chances a quarter: 3, 5 or 9. */
  chances: 3 | 5 | 9;
  /** Roll range: lower = more points. */
  roll: number;
}

export const SIM_DEFAULTS: SimSettings = { weight: 8, chances: 5, roll: 1100 };
export const SIM_STOCK: SimSettings = { weight: 4, chances: 3, roll: 1350 };
export const SIM_LIMITS = { weight: [1, 16], roll: [700, 1600] } as const;
export const SIM_CHANCES: SimSettings['chances'][] = [3, 5, 9];

const HOOK = 0x06f10c;
const SK = 0x2d6000;
const K_AT = 0x2d6008;
const N_AT = 0x06f120;
const R_AT = 0x06f124;

const word = (d: Uint8Array, a: number) => (d[a] << 8) | d[a + 1];
const put = (d: Uint8Array, a: number, v: number) => { d[a] = (v >> 8) & 0xff; d[a + 1] = v & 0xff; };

/** True when the ROM has the sim settings mod. */
export function hasSimSettings(d: Uint8Array): boolean {
  if (d.length < SK + 0x28) return false;
  const hook = [0x4e, 0xb9, 0x00, 0x2d, 0x60, 0x00].every((b, i) => d[HOOK + i] === b);
  const sk = [0x04, 0x43, 0x00, 0x96].every((b, i) => d[SK + i] === b);
  return hook && sk && d[K_AT - 2] === 0xc7 && d[K_AT - 1] === 0xfc && (word(d, N_AT) & 0xf1ff) === 0xe142;
}

export function readSimSettings(d: Uint8Array): SimSettings | null {
  if (!hasSimSettings(d)) return null;
  const n = (word(d, N_AT) >> 9) & 7;
  return { weight: word(d, K_AT), chances: (2 ** n + 1) as SimSettings['chances'], roll: word(d, R_AT) + 550 };
}

/** Why settings can't be written; empty if they can. */
export function simProblems(s: SimSettings): string[] {
  const out: string[] = [];
  const [k0, k1] = SIM_LIMITS.weight;
  const [r0, r1] = SIM_LIMITS.roll;
  if (!Number.isInteger(s.weight) || s.weight < k0 || s.weight > k1) out.push(`Rating weight must be a whole number from ${k0} to ${k1}.`);
  if (!SIM_CHANCES.includes(s.chances)) out.push(`Scoring chances must be ${SIM_CHANCES.join(', ')}.`);
  if (!Number.isInteger(s.roll) || s.roll < r0 || s.roll > r1) out.push(`Roll range must be a whole number from ${r0} to ${r1}.`);
  return out;
}

/** Writes the settings (the ROM must have the mod; check readSimSettings first). The caller fixes the checksum. */
export function writeSimSettings(d: Uint8Array, s: SimSettings): void {
  if (!hasSimSettings(d)) throw new Error("This ROM doesn't have the season sim settings (2026 test33 / 1994 test36 or later).");
  const bad = simProblems(s);
  if (bad.length) throw new Error(bad.join(' '));
  put(d, K_AT, s.weight);
  put(d, N_AT, 0xe142 | (Math.log2(s.chances - 1) << 9));
  put(d, R_AT, s.roll - 550);
}

export const sameSim = (a: SimSettings, b: SimSettings) => a.weight === b.weight && a.chances === b.chances && a.roll === b.roll;

/** The bytes the settings occupy (for the Toolkit's change lists). */
export const SIM_RANGES: [number, number][] = [[K_AT, K_AT + 2], [N_AT, N_AT + 2], [R_AT, R_AT + 2]];
