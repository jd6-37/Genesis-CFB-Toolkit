// Alternate uniforms of the 138-team 2026 Season Edition (Elevated v2.0.1-test14 on): the picker on the
// controller select screen reads a per-team table, KTAB, that the apps may edit (project handoff H-004,
// claude/handoffs/H-004-uniform-presets-editor.md; the ROM side is the patch's uniforms.py).
//
// KTAB at 0x2B6000, at most 4 KB (0x2B6000-0x2B6FFF), big-endian:
//   +0 "KIT1"   +4 team count (word, 138)   +6 a long per team: its record's offset from 0x2B6000, 0 = none
//   record (even address): NH, NJH, NJA, NP (extra helmets, dark jerseys, white jerseys, pants), FLAGS
//   (bit 0 = wears white at home), 0; then NH × 3 words, NJH × 4, NJA × 4, NP × 4.
// Colors are Genesis CRAM words in the uniform palette's places:
//   helmet [5] shell, [6] shadow, [7] stripe · jersey [9] numbers and trim, [10] light, [11] middle, [12] dark ·
//   pants [3] side stripe, [13] light, [14] middle, [15] dark.
// A team's own home and away uniforms are always the first choices and aren't in the table.
import { fromLevels, toLevels } from './colors';

export const KTAB = 0x2b6000;
export const KTAB_SIZE = 0x1000;
const TAG = [0x4b, 0x49, 0x54, 0x31]; // KIT1
const TEAMS = 138;
const HEAD = 6 + 4 * TEAMS;

export interface TeamKit {
  /** Extra helmets: [shell, shadow, stripe]. */
  helmets: number[][];
  /** Extra dark jerseys: [numbers, light, middle, dark]. */
  dark: number[][];
  /** Extra white jerseys, the same four. */
  white: number[][];
  /** Extra pants: [side stripe, light, middle, dark]. */
  pants: number[][];
  /** Wears its white jersey at home by default. */
  whiteHome: boolean;
}

export const emptyKit = (): TeamKit => ({ helmets: [], dark: [], white: [], pants: [], whiteHome: false });
const isEmpty = (k: TeamKit) => !k.helmets.length && !k.dark.length && !k.white.length && !k.pants.length && !k.whiteHome;

const u16 = (d: Uint8Array, a: number) => (d[a] << 8) | d[a + 1];
const u32 = (d: Uint8Array, a: number) => ((d[a] << 24) >>> 0) + (d[a + 1] << 16) + (d[a + 2] << 8) + d[a + 3];

/** Whether the ROM has the uniform picker's table. */
export const hasKits = (d: Uint8Array) => d.length >= KTAB + KTAB_SIZE && TAG.every((b, k) => d[KTAB + k] === b) && u16(d, KTAB + 4) === TEAMS;

/** Every team's extras and flag. */
export function readKits(d: Uint8Array): TeamKit[] {
  if (!hasKits(d)) throw new Error("This ROM has no alternate uniforms (they came with Bill Walsh '95 Elevated 2026 v2.0.1-test14).");
  const out: TeamKit[] = [];
  for (let t = 0; t < TEAMS; t++) {
    const off = u32(d, KTAB + 6 + 4 * t);
    const k = emptyKit();
    if (off >= HEAD && off + 6 <= KTAB_SIZE && off % 2 === 0) {
      let a = KTAB + off;
      const [nh, njh, nja, np, flags] = [d[a], d[a + 1], d[a + 2], d[a + 3], d[a + 4]];
      a += 6;
      const take = (n: number, words: number) => Array.from({ length: n }, () => { const c = Array.from({ length: words }, (_, i) => u16(d, a + 2 * i)); a += 2 * words; return c; });
      if (off + 6 + 6 * nh + 8 * (njh + nja + np) <= KTAB_SIZE) {
        k.helmets = take(nh, 3); k.dark = take(njh, 4); k.white = take(nja, 4); k.pants = take(np, 4);
        k.whiteHome = (flags & 1) === 1;
      }
    }
    out.push(k);
  }
  return out;
}

/** The most extras the picker's single-digit menu can show beside the team's own (which can take two places). */
export const KIT_LIMITS = { helmets: 7, pants: 7, jerseys: 7 };
const CRAM = 0x0eee;

/** Why these kits can't be written (empty when they can). */
export function kitIssues(kits: TeamKit[], names?: string[]): string[] {
  const out: string[] = [];
  if (kits.length !== TEAMS) return [`Expected ${TEAMS} teams, got ${kits.length}.`];
  let size = HEAD;
  kits.forEach((k, t) => {
    const who = names?.[t] ?? `Team ${t}`;
    if (k.helmets.length > KIT_LIMITS.helmets) out.push(`${who}: at most ${KIT_LIMITS.helmets} extra helmets.`);
    if (k.pants.length > KIT_LIMITS.pants) out.push(`${who}: at most ${KIT_LIMITS.pants} extra pants.`);
    if (k.dark.length + k.white.length > KIT_LIMITS.jerseys) out.push(`${who}: at most ${KIT_LIMITS.jerseys} extra jerseys (dark and white together).`);
    const bad = [...k.helmets.map((c) => c.length !== 3), ...[...k.dark, ...k.white, ...k.pants].map((c) => c.length !== 4)].some(Boolean) ||
      [...k.helmets, ...k.dark, ...k.white, ...k.pants].flat().some((c) => (c & ~CRAM) !== 0);
    if (bad) out.push(`${who}: a uniform color isn't a Genesis color.`);
    if (!isEmpty(k)) size += 6 + 6 * k.helmets.length + 8 * (k.dark.length + k.white.length + k.pants.length);
  });
  if (size > KTAB_SIZE) out.push(`The uniforms need ${size} bytes; the ROM has room for ${KTAB_SIZE}. Remove some extras.`);
  return out;
}

/** Rebuilds the table from the kits (the checksum at 0x18E is the caller's to fix). */
export function writeKits(d: Uint8Array, kits: TeamKit[]): void {
  if (!hasKits(d)) throw new Error('This ROM has no alternate uniforms table.');
  const issues = kitIssues(kits);
  if (issues.length) throw new Error(issues[0]);
  const t8 = new Uint8Array(KTAB_SIZE).fill(0xff);
  t8.set(TAG, 0); t8[4] = TEAMS >> 8; t8[5] = TEAMS & 255;
  let at = HEAD;
  kits.forEach((k, t) => {
    const o = 6 + 4 * t;
    if (isEmpty(k)) { t8.set([0, 0, 0, 0], o); return; }
    t8.set([(at >>> 24) & 255, (at >> 16) & 255, (at >> 8) & 255, at & 255], o);
    t8.set([k.helmets.length, k.dark.length, k.white.length, k.pants.length, k.whiteHome ? 1 : 0, 0], at);
    at += 6;
    for (const c of [...k.helmets, ...k.dark, ...k.white, ...k.pants]) for (const w of c) { t8[at] = w >> 8; t8[at + 1] = w & 255; at += 2; }
  });
  d.set(t8, KTAB);
}

export const kitRanges = (): [number, number][] => [[KTAB, KTAB + KTAB_SIZE]];
/** Whether the uniform tables of two ROMs differ. */
export const kitsDiffer = (a: Uint8Array, b: Uint8Array) => hasKits(a) && hasKits(b) && !a.subarray(KTAB, KTAB + KTAB_SIZE).every((x, i) => x === b[KTAB + i]);

// ---- colors from one pick (user, 2026-11-12: "a jersey has three … different colors … you would take that and
// then make the two shades … I can handle that in the toolkit")

const step = (c: number, by: number) => { const [r, g, b] = toLevels(c).map((x) => Math.max(0, Math.min(7, x + by))); return fromLevels(r, g, b); };
/** A jersey or pants from its main color: [numbers or stripe, a step lighter, the color, a step darker]. */
export const shadesOf = (main: number, accent: number): number[] => [accent, step(main, 1), main, step(main, -1)];
/** A helmet from its shell color: [shell, a step darker, stripe]. */
export const helmetOf = (shell: number, stripe: number): number[] => [shell, step(shell, -1), stripe];

/** A team's own home and away uniform palettes (16 words each), the picker's first choices. */
export function ownUniforms(d: Uint8Array, team: number): { home: number[]; away: number[] } {
  const block = u32(d, 0x0028dc + 4 * team); // the team blocks' table (bw95.ts)
  const at = block + u16(d, block + 2);
  const words = (a: number) => Array.from({ length: 16 }, (_, k) => u16(d, a + 2 * k));
  return { home: words(at), away: words(at + 32) };
}

export type KitPart = 'helmets' | 'dark' | 'white' | 'pants';
/** Where a part's colors go in a uniform palette. */
export const KIT_PLACES: Record<KitPart, number[]> = { helmets: [5, 6, 7], dark: [9, 10, 11, 12], white: [9, 10, 11, 12], pants: [3, 13, 14, 15] };
/** A uniform palette with one extra piece put in (for a preview). */
export function withPiece(palette: number[], part: KitPart, colors: number[]): number[] {
  const out = palette.slice();
  KIT_PLACES[part].forEach((p, i) => { out[p] = colors[i]; });
  return out;
}
