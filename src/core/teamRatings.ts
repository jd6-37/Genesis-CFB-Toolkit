// BW95 team ratings and home weather. Pure functions, no DOM: used by the Team Swap build, the
// Teams tab, the Rosters tab (CFB 27 conversion) and the Node CLI.
//
// Each team block has a 4-word group (header word [3], the group Team Swap keeps per slot):
//   +0 home weather: one nibble per kind, high to low = Fair, Windy, Rain, Snow (weights; the
//      game picks a season game's weather from the home team's word)
//   +2 offense rating, +4 defense rating (0-100): the season sim and the preseason poll read these
//   +6 conference (the Season tool's)
// Elevated v1.1.0 shows a team OVR for offense and defense on Game Setup, from its own table at
// 0x10DFB0 ("OVR1", then 36 x {OFF, DEF} bytes by slot). The sim keeps reading the 0-100 words,
// which follow the OVR on a fixed line: word = (OVR - 62) x 100 / 36 (OVR 62 -> 0, 98 -> 100,
// about the original game's spread). Without that table (the original game, older builds) the app
// shows the OVR the words stand for. Details: docs/teams.md.

import { rl, rw, ww } from './bytes';
import { isWide, teamsOf, WIDE } from './wide';

export const TEAMS = 36;
export const BW_TABLE = 0x0028dc;
export const OVR_TABLE = 0x10dfb0;
export const OVR_TABLE_SIZE = 4 + 2 * TEAMS;
const OVR_MAGIC = [0x4f, 0x56, 0x52, 0x31]; // "OVR1"

export const WEATHER = ['Fair', 'Windy', 'Rain', 'Snow'] as const;
/** Weights for Fair, Windy, Rain, Snow, 0-15 each. */
export type Weather = [number, number, number, number];

export interface TeamRating {
  /** Shown OVR, 0-99. */
  off: number;
  def: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** The sim's 0-100 word for a shown OVR. */
export const simFromOvr = (ovr: number) => clamp(Math.round(((ovr - 62) * 100) / 36), 0, 100);
/** The shown OVR a 0-100 sim word stands for. */
export const ovrFromSim = (word: number) => clamp(Math.round(62 + (word * 36) / 100), 0, 99);

/** Address of a team's group (block + header word [3]). */
export function groupAt(d: Uint8Array, t: number): number {
  const b = rl(d, BW_TABLE + 4 * t);
  return b + rw(d, b + 6);
}

/** Where the OVR table is: 0x10DFB0, or in the 138-team edition 0x218000 (one entry per team). */
const ovrAt = (d: Uint8Array) => (isWide(d) ? WIDE.ovr : OVR_TABLE);
/** Whether the ROM has Elevated's OVR table (Game Setup shows these numbers). */
export const hasOvrTable = (d: Uint8Array) => OVR_MAGIC.every((b, k) => d[ovrAt(d) + k] === b);

/** Why this ROM's ratings and weather can't be read or changed. Empty if they can. */
export function ratingProblems(d: Uint8Array): string[] {
  const out: string[] = [];
  for (let t = 0; t < teamsOf(d); t++) {
    const b = rl(d, BW_TABLE + 4 * t);
    const g = b + rw(d, b + 6);
    if (b < 0x200 || b >= d.length || g + 8 > d.length) {
      out.push('the team table doesn\'t point at team blocks');
      break;
    }
    if (rw(d, g + 2) > 100 || rw(d, g + 4) > 100) {
      out.push(`team ${t + 1}'s offense or defense rating isn't 0-100`);
      break;
    }
  }
  return out;
}

export function readRating(d: Uint8Array, t: number): TeamRating {
  if (hasOvrTable(d)) return { off: d[ovrAt(d) + 4 + 2 * t], def: d[ovrAt(d) + 5 + 2 * t] };
  const g = groupAt(d, t);
  return { off: ovrFromSim(rw(d, g + 2)), def: ovrFromSim(rw(d, g + 4)) };
}

/** The 0-100 words the sim reads. */
export function readSim(d: Uint8Array, t: number): TeamRating {
  const g = groupAt(d, t);
  return { off: rw(d, g + 2), def: rw(d, g + 4) };
}

/** Writes a team's OVRs: the sim words always, the OVR table when the ROM has one. */
export function writeRating(d: Uint8Array, t: number, r: TeamRating): void {
  const off = clamp(Math.round(r.off), 0, 99);
  const def = clamp(Math.round(r.def), 0, 99);
  const g = groupAt(d, t);
  ww(d, g + 2, simFromOvr(off));
  ww(d, g + 4, simFromOvr(def));
  if (hasOvrTable(d)) {
    d[ovrAt(d) + 4 + 2 * t] = off;
    d[ovrAt(d) + 5 + 2 * t] = def;
  }
}

export const weatherFromWord = (w: number): Weather => [(w >> 12) & 15, (w >> 8) & 15, (w >> 4) & 15, w & 15];
export const weatherWord = (w: Weather) => w.reduce((a, v) => (a << 4) | clamp(Math.round(v), 0, 15), 0);

export const readWeather = (d: Uint8Array, t: number): Weather => weatherFromWord(rw(d, groupAt(d, t)));
export function writeWeather(d: Uint8Array, t: number, w: Weather): void {
  ww(d, groupAt(d, t), weatherWord(w));
}

/** Chance of each kind in percent (a sum of 0 means always Fair, as in the game). */
export function weatherChances(w: Weather): number[] {
  const sum = w.reduce((a, b) => a + b, 0);
  return sum ? w.map((v) => Math.round((100 * v) / sum)) : [100, 0, 0, 0];
}

/** Puts a team's ratings and weather back to how they are in `base`. */
export function restoreTeam(d: Uint8Array, base: Uint8Array, t: number): void {
  const g = groupAt(d, t);
  d.set(base.subarray(g, g + 6), g);
  const o = ovrAt(d);
  if (hasOvrTable(d) && hasOvrTable(base)) d.set(base.subarray(o + 4 + 2 * t, o + 6 + 2 * t), o + 4 + 2 * t);
}

/** Teams whose ratings or weather differ between two ROMs with the same team blocks. */
export function ratingChanges(a: Uint8Array, b: Uint8Array): number[] {
  const out: number[] = [];
  const tables = hasOvrTable(a) && hasOvrTable(b);
  for (let t = 0; t < Math.min(teamsOf(a), teamsOf(b)); t++) {
    const ga = groupAt(a, t);
    const gb = groupAt(b, t);
    let diff = false;
    for (let k = 0; k < 6 && !diff; k++) diff = a[ga + k] !== b[gb + k];
    if (!diff && tables) diff = rw(a, ovrAt(a) + 4 + 2 * t) !== rw(b, ovrAt(b) + 4 + 2 * t);
    if (diff) out.push(t);
  }
  return out;
}

/** Bytes the ratings and weather live in, as [start, end) ranges (for "what changed" checks). */
export function ratingRanges(d: Uint8Array): [number, number][] {
  const r: [number, number][] = [];
  for (let t = 0; t < teamsOf(d); t++) {
    const g = groupAt(d, t);
    r.push([g, g + 6]);
  }
  if (hasOvrTable(d)) r.push([ovrAt(d) + 4, ovrAt(d) + 4 + 2 * teamsOf(d)]);
  return r;
}

// ---- College Football 27 starters -> team OVR ----------------------------------------------------
// The method the Elevated 2026 Season Edition uses: the team's best player by Overall at each
// starting position, OFF = QB, HB, 3 WR, TE, LT, LG, C, RG, RT and DEF = LE, RE, 2 DT, LOLB, MLB,
// ROLB, 2 CB, FS, SS (fewer if the team has fewer); OVR = 65 + 3 x (mean Overall - 77), 0-99.

const OFF_STARTERS: [string, number][] = [['QB', 1], ['HB', 1], ['WR', 3], ['TE', 1], ['LT', 1], ['LG', 1], ['C', 1], ['RG', 1], ['RT', 1]];
const DEF_STARTERS: [string, number][] = [['LE', 1], ['RE', 1], ['DT', 2], ['LOLB', 1], ['MLB', 1], ['ROLB', 1], ['CB', 2], ['FS', 1], ['SS', 1]];

export interface StarterOvr extends TeamRating {
  /** Mean Overall of the starters, and how many there were. */
  avgOff: number;
  avgDef: number;
  nOff: number;
  nDef: number;
}

export const ovrFromStarters = (avg: number) => clamp(Math.round(65 + 3 * (avg - 77)), 0, 99);

export function starterOvr(players: { pos: string; ovr: number }[]): StarterOvr {
  const mean = (spec: [string, number][]) => {
    const v: number[] = [];
    for (const [p, n] of spec) v.push(...players.filter((x) => x.pos === p).map((x) => x.ovr).sort((a, b) => b - a).slice(0, n));
    return { avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, n: v.length };
  };
  const o = mean(OFF_STARTERS);
  const d = mean(DEF_STARTERS);
  return { off: ovrFromStarters(o.avg), def: ovrFromStarters(d.avg), avgOff: o.avg, avgDef: d.avg, nOff: o.n, nDef: d.n };
}
