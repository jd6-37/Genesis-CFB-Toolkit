// CFB 27 → BW95 conversion v8 and the CFB-style numbers on screen (H-038 / H-039, Rosters lane, 2026-11-18;
// claude.ai project notes bw95-conversion-v2-notes.md).
//
// Each rating has one fixed curve per pool: a CFB value (0-99, a weighted average of CFB 27 ratings, `cfbValue`) gives
// the game's fine value (0-247) for that rating. The pool is "all" positions, except where a rating means something
// else (Power of linemen and of ball carriers, the kickers' Quickness = kick distance, Range and Accuracy per role).
// The curves are fixed, so a number means the same thing in every season and in both editions.
// Screens show the curve reversed: a table per pool from fine 0-247 to 0-99, the same bytes the ROM's Team Rosters
// uses (2026 test60 on, at 0x2D7DC0), so the apps and the game show the same number.
import type { Attr, Group } from './rosterLayouts';
import V8 from './ratingsV8.json';

/** A "Rating|pool" key, e.g. "Speed|all" or "Power|olpower". */
export type V8Key = string;

const CURVES = V8.curves as Record<V8Key, number[]>;
const TABLES = V8.tables as Record<V8Key, number[]>;
/** Per roster slot (0-31), the key of each record nibble (index 0 = Weight: null). */
export const V8_SLOT_POOLS = V8.slotPools as (V8Key | null)[][];

/** Where the ROM keeps the display tables (2026 test60 on), in `V8.keys` order, 248 bytes each. */
export const V8_TABLES_AT = 0x2d7dc0;
/** The rusher speed boost (H-038): fine points defenders chasing the QB get. CFB 27-converted rosters use 60. */
export const BONUS_AT = 0x2d7c40;
export const BONUS_CFB27 = 60;

/** Whether the ROM shows ratings through the v8 tables (2026 test60 on; 1994 once H-040 is built). */
export function hasV8(d: Uint8Array): boolean {
  if (d.length < V8_TABLES_AT + V8.keys.length * 248) return false;
  let a = V8_TABLES_AT;
  for (const k of V8.keys) {
    const t = TABLES[k];
    for (let i = 0; i < 248; i++) if (d[a + i] !== t[i]) return false;
    a += 248;
  }
  return true;
}

/** The pool of a rating for a position role (QB, HB, FB, WR, TE, OL, DE, DT, LB, CB, S, K, P) and slot group. */
export function v8Key(role: string, group: Group, attr: Attr): V8Key | null {
  switch (attr) {
    case 'Weight': return null;
    case 'Quickness': return role === 'K' || role === 'P' ? `Quickness|kick:${role}` : 'Quickness|all';
    case 'Power': return group === 'OL' ? 'Power|olpower' : group === 'DL' ? 'Power|dlpower' : 'Power|runpower';
    case 'Range': return `Range|range:${role === 'K' || role === 'P' ? role : 'QB'}`;
    case 'Accuracy': return `Accuracy|acc:${role === 'P' ? 'P' : 'K'}`;
    default: return `${attr}|all`;
  }
}

/** The on-screen number (0-99) for a fine value. */
export const shownV8 = (key: V8Key, fine: number) => TABLES[key][Math.max(0, Math.min(247, Math.round(fine)))];

/** The fine value (0-247) for a CFB value; fractions interpolate between neighbors. */
export function fineFromCfb(key: V8Key, cfb: number): number {
  const t = CURVES[key];
  const c = Math.max(0, Math.min(99, cfb));
  const lo = Math.floor(c);
  const y = lo >= 99 ? t[99] : t[lo] + (t[lo + 1] - t[lo]) * (c - lo);
  return Math.max(0, Math.min(247, Math.round(y)));
}

/**
 * The CFB value (0-99, with fractions) a fine value stands for: the curve reversed, continuous (progression works on
 * this scale, so +1 is one shown point at every position). Where the curve is flat (the bottom), the highest CFB value
 * that still gives this fine value.
 */
export function cfbOfFine(key: V8Key, fine: number): number {
  const t = CURVES[key];
  const f = Math.max(0, Math.min(247, fine));
  if (f >= t[99]) return 99;
  for (let c = 98; c >= 0; c--) {
    if (t[c] <= f) {
      const span = t[c + 1] - t[c];
      return span > 0 ? c + (f - t[c]) / span : c;
    }
  }
  return 0;
}

/** The fine value for an on-screen number (editing): the curve at that number, then the nearest fine that shows it. */
export function fineFromShown(key: V8Key, shown: number): number {
  const n = Math.max(0, Math.min(99, Math.round(shown)));
  let f = fineFromCfb(key, n);
  if (shownV8(key, f) === n) return f;
  // The curve is flat at the bottom (several numbers share fine 0): take the nearest fine that shows n, if any.
  for (let d = 1; d < 248; d++) {
    if (f + d <= 247 && shownV8(key, f + d) === n) return f + d;
    if (f - d >= 0 && shownV8(key, f - d) === n) return f - d;
  }
  return f;
}

/** CFB 27 values by column name (0 for a blank). */
export type Cfb27Values = (column: string) => number;

/** The group a role's CFB value formulas use (src8.py: the role's group, not the slot's). */
const ROLE_GROUP: Record<string, Group> = {
  QB: 'QB', HB: 'RB', FB: 'RB', WR: 'REC', TE: 'REC', OL: 'OL', DE: 'DL', DT: 'DL', LB: 'LB', CB: 'DB', S: 'DB', K: 'KP', P: 'KP',
};

const avg = (v: Cfb27Values, ...pairs: [string, number][]) => pairs.reduce((s, [c, w]) => s + v(c) * w, 0) / pairs.reduce((s, [, w]) => s + w, 0);

/**
 * The CFB value (0-99) behind a BW95 rating (src8.py, v8). `group` is the slot's rating group: a linebacker in a slot
 * with Power (a DL slot) is rated like a lineman for Power and Awareness.
 */
export function cfbValue(role: string, group: Group, attr: Attr, v: Cfb27Values): number {
  const g = ROLE_GROUP[role] ?? group;
  const dlset = g === 'DL' || (role === 'LB' && group === 'DL');
  switch (attr) {
    case 'Weight': return v('Weight');
    case 'Speed': return v('Speed');
    case 'Quickness':
      return g === 'KP' ? v('Kick Power') : avg(v, ['Acceleration', 1], ['Agility', 1], ['Change of Direction', 1]);
    case 'Awareness':
      if (g === 'QB') return avg(v, ['Awareness', 3], ['Throw Accuracy Short', 1], ['Throw Accuracy Mid', 1], ['Throw Accuracy Deep', 1],
        ['Throw Under Pressure', 1], ['Throw on the Run', 1], ['Play Action', 1]);
      if (g === 'REC') return avg(v, ['Awareness', 2], ['Short Route Running', 1], ['Medium Route Running', 1], ['Deep Route Running', 1], ['Release', 1]);
      if (g === 'RB') return avg(v, ['Awareness', 1], ['Ball Carrier Vision', 1]);
      if (g === 'DB') return avg(v, ['Awareness', 1], ['Play Recognition', 1], ['Man Coverage', 1], ['Zone Coverage', 1], ['Press', 1]);
      if (g === 'LB' && !dlset) return avg(v, ['Awareness', 1], ['Play Recognition', 1], ['Zone Coverage', 1], ['Pursuit', 1]);
      if (dlset) return avg(v, ['Awareness', 1], ['Play Recognition', 1]);
      return v('Awareness');
    case 'Hands':
      if (g === 'REC') return avg(v, ['Catching', 2], ['Spectacular Catch', 1], ['Catch in Traffic', 1], ['Carrying', 1], ['Jumping', 1]);
      if (g === 'RB') return avg(v, ['Catching', 1], ['Catch in Traffic', 1], ['Carrying', 2]);
      if (g === 'DB') return avg(v, ['Catching', 2], ['Jumping', 1]);
      return v('Catching');
    case 'Power':
      if (g === 'OL') return avg(v, ['Strength', 1], ['Run Block Power', 1], ['Pass Block Power', 1], ['Run Block Finesse', 1], ['Pass Block Finesse', 1]);
      if (dlset) return (v('Strength') + v('Block Shedding') + 2 * Math.max(v('Power Moves'), v('Finesse Moves'))) / 4;
      if (g === 'QB') return avg(v, ['Break Sack', 2], ['Break Tackle', 1], ['Strength', 1]);
      return avg(v, ['Break Tackle', 2], ['Trucking', 1], ['Stiff Arm', 1], ['Spin Move', 1], ['Juke Move', 1], ['Strength', 1]);
    case 'Blocking': return avg(v, ['Run Block', 1], ['Pass Block', 1], ['Impact Blocking', 1], ['Strength', 1]);
    case 'Tackling': return avg(v, ['Tackle', 1], ['Hit Power', 1], ['Pursuit', 1]);
    case 'Range': return g === 'QB' ? v('Throw Power') : v('Kick Power');
    case 'Accuracy': return v('Kick Accuracy');
  }
}

/** CFB 27 columns the v8 conversion reads besides those of the older conversion. */
export const V8_COLUMNS = ['Change of Direction', 'Throw Under Pressure', 'Throw on the Run', 'Play Action', 'Short Route Running',
  'Medium Route Running', 'Deep Route Running', 'Release', 'Ball Carrier Vision', 'Man Coverage', 'Zone Coverage', 'Press',
  'Spectacular Catch', 'Catch in Traffic', 'Jumping', 'Run Block Finesse', 'Pass Block Finesse', 'Finesse Moves', 'Break Sack',
  'Stiff Arm', 'Spin Move', 'Juke Move', 'Impact Blocking'] as const;

/** A fine value as the roster record's step (0-15) and the fine table's offset (−8..+7). */
export function stepAndOffset(fine: number): { step: number; off: number } {
  const f = Math.max(0, Math.min(247, Math.round(fine)));
  const step = Math.max(0, Math.min(15, (f + 8) >> 4));
  return { step, off: Math.max(-8, Math.min(7, f - 16 * step)) };
}
