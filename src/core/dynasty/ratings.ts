// A dynasty player's ratings (user, 2026-11-12): the Bill Walsh '95 ratings are the truth. Each player keeps
// the numbers the game shows (0-100) for every rating, the ones his position doesn't use too (so a position
// change has numbers to use), and the game gets the step each number has reached (0-15: shown as
// ⌊step × 100 / 15⌋, so 86 is step 13, 93 step 14, 100 step 15). Development raises the numbers, so a
// player shows his progress toward the next step. Weight is the game's weight in pounds (140 + 16 × step).
// CFB 27 data is only used to build the first season (the Rosters tool's conversion).

import { GROUP_COLUMNS, nibbleToRating, nibbleToWeight, type Attr, type Group, type SlotDef } from '../rosterLayouts';
import type { BwSlot, DPlayer } from './model';
import { OVR_FORMULAS } from './ovr';

/** Every rating a player keeps (Weight in pounds, the others 0-100). */
export const RATINGS: Attr[] = ['Weight', 'Speed', 'Quickness', 'Power', 'Awareness', 'Hands', 'Range', 'Accuracy', 'Blocking', 'Tackling'];
export type Ratings = Partial<Record<Attr, number>>;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The step (0-15) a shown number has reached. */
export function stepOf(value: number): number {
  let n = 0;
  while (n < 15 && nibbleToRating(n + 1) <= value + 1e-9) n++;
  return n;
}
/** The weight step (0-15) for the game's pounds. */
export const weightStep = (lbs: number) => clamp(Math.round((lbs - 140) / 16), 0, 15);
/** The number shown for a value: the step's number (the game only has steps). */
export const shownOf = (value: number) => nibbleToRating(stepOf(value));

/** Progress toward the next step, 0-1 (1 at the top). */
export function progressOf(value: number): { step: number; shown: number; next: number | null; frac: number } {
  const step = stepOf(value);
  if (step >= 15) return { step, shown: 100, next: null, frac: 1 };
  const lo = nibbleToRating(step), hi = nibbleToRating(step + 1);
  return { step, shown: lo, next: hi, frac: clamp((value - lo) / (hi - lo), 0, 1) };
}

/** A position's role (the OVR formulas' and the conversion's roles). */
export function roleOfPos(pos: string): string {
  if (['LT', 'LG', 'C', 'RG', 'RT', 'OL'].includes(pos)) return 'OL';
  if (pos === 'LE' || pos === 'RE') return 'DE';
  if (['LOLB', 'ROLB', 'MLB'].includes(pos)) return 'LB';
  if (pos === 'FS' || pos === 'SS') return 'S';
  return pos;
}
/** The game's rating group for a role (which six ratings it uses). */
export const GROUP_OF_ROLE: Record<string, Group> = {
  QB: 'QB', HB: 'RB', FB: 'RB', WR: 'REC', TE: 'REC', OL: 'OL', DE: 'DL', DT: 'DL', LB: 'LB', CB: 'DB', S: 'DB', K: 'KP', P: 'KP',
};

/** OVR at a role from the shown numbers (the OVR formulas, ovr.ts). */
export function ovrAt(r: Ratings, role: string): number {
  const f = OVR_FORMULAS[role];
  if (!f) return 0;
  let avg = 0;
  for (const [a, w] of Object.entries(f.weights) as [Attr, number][]) avg += (w / 100) * shownOf(r[a] ?? 0);
  return clamp(Math.round(f.base + f.scale * avg), 0, 99);
}
/** A player's OVR at his own position. */
export const ovrOf = (p: Pick<DPlayer, 'pos' | 'ratings'>) => ovrAt(p.ratings, roleOfPos(p.pos));

/** What the game gets for a player in a slot: the slot group's six ratings as steps. */
export function bwSlotOf(p: Pick<DPlayer, 'ratings'>, def: Pick<SlotDef, 'label' | 'group'>, weightPlus = 0): BwSlot {
  const attrs = GROUP_COLUMNS[def.group];
  const steps = attrs.map((a) => (a === 'Weight' ? weightStep(p.ratings.Weight ?? 140) : stepOf(p.ratings[a] ?? 0)));
  return { label: def.label, group: def.group, attrs, steps, weightPlus: def.group === 'OL' ? weightPlus : 0 };
}

/** The numbers a slot's steps stand for (the first season: exactly the converted steps). */
export function ratingsFromSlot(b: BwSlot, into: Ratings = {}): Ratings {
  const out = { ...into };
  b.attrs.forEach((a, i) => { out[a] = a === 'Weight' ? nibbleToWeight(b.steps[i]) : nibbleToRating(b.steps[i]); });
  return out;
}
