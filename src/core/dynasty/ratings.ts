// A dynasty player's ratings (user, 2026-11-12): the Bill Walsh '95 ratings are the truth. Each player keeps
// a number for every rating (0-100, one decimal), the ones his position doesn't use too (so a position change
// has numbers to use). Since the fine-ratings mod (Elevated 2026 v2.0.1-test13 on; user, 2026-11-12: "We've
// completed the fine-ratings mod … show those ratings, adjust progression, recruits, etc.") the game plays with
// a fine value per rating: 16 × step + offset (step 0-15 in the roster record, offset −8..+7 in a table), and
// its Team Rosters shows ⌊fine × 100 / 240⌋, at most 99. So a player's number × 2.4 is his fine value, every
// point counts in games, and the app shows the number the game shows. Weight is in pounds: 140 + fine.
// CFB 27 data is only used to build the first season (the Rosters tool's conversion).

import { GROUP_ATTRS, GROUP_COLUMNS, type Attr, type Group, type SlotDef } from '../rosterLayouts';
import type { BwSlot, DPlayer } from './model';
import { OVR_FORMULAS, OVR_FORMULAS_V8 } from './ovr';
import { cfbOfFine, fineFromCfb, fineFromShown, shownV8, v8Key, V8_SLOT_POOLS } from '../ratingsV8';

// The v8 scale (H-039; user, 2026-11-18): dynasties made on a ROM with the v8 tables (2026 test60 on) show every rating
// as CFB 27 would (the tables in ratingsV8.ts, the same as the game's Team Rosters) and use the v8 OVR formulas.
// Older dynasties keep the old numbers (user: "Start new dynasties"). The app has one dynasty open at a time, so the
// scale is set when one opens or is made (setRatingScale) instead of being passed to every number on every page.
let v8 = false;
/** Use the v8 numbers (a dynasty with `ratingsV: 8`) or the old ones. */
export const setRatingScale = (on: boolean) => { v8 = on; };
export const ratingScaleIsV8 = () => v8;

/** Every rating a player keeps (Weight in pounds, the others 0-100). */
export const RATINGS: Attr[] = ['Weight', 'Speed', 'Quickness', 'Power', 'Awareness', 'Hands', 'Range', 'Accuracy', 'Blocking', 'Tackling'];
export type Ratings = Partial<Record<Attr, number>>;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The fine value (0-247) of a rating's number: 2.4 a point, so 100 is 240 (step 15). */
export const fineOf = (value: number) => clamp(Math.round(value * 2.4), 0, 247);
/** The fine value of a weight in pounds. */
export const fineWeight = (lbs: number) => clamp(Math.round(lbs) - 140, 0, 247);
/** A fine value as the game keeps it: the nearest step and what's left over (−8..+7). */
export function splitFine(fine: number): { step: number; off: number } {
  const step = clamp((fine + 8) >> 4, 0, 15);
  return { step, off: clamp(fine - 16 * step, -8, 7) };
}
/** What the game's Team Rosters shows for a fine value. */
export const shownFine = (fine: number) => Math.min(99, Math.floor((Math.max(0, fine) * 100) / 240));
/** The number of a fine value (one decimal; a number gives the same fine value back). */
export const valueOfFine = (fine: number) => Math.min(100, Math.round((Math.max(0, fine) / 2.4) * 10) / 10);
/** The step (0-15) the game's roster record gets for a number. */
export const stepOf = (value: number) => splitFine(fineOf(value)).step;
/** The weight step (0-15) for the game's pounds. */
export const weightStep = (lbs: number) => splitFine(fineWeight(lbs)).step;
/** The number the game shows for a rating (0-99), on the old scale (fine × 100 / 240). */
export const shownOf = (value: number) => shownFine(fineOf(value));
/** The number the game shows for a role's rating: the v8 table for a v8 dynasty, else shownOf. */
export function shownAt(value: number, attr: Attr, role: string): number {
  if (!v8) return shownOf(value);
  const k = v8Key(role, GROUP_OF_ROLE[role] ?? 'QB', attr);
  return k ? shownV8(k, fineOf(value)) : shownOf(value);
}
/** The number Team Rosters shows for a slot's i-th rating (a role's slot pools on the v8 scale). */
export const shownInSlot = (slot: number, b: Pick<BwSlot, 'steps' | 'offs' | 'attrs' | 'group'>, i: number) =>
  shownFineInSlot(slot, b.group, b.attrs[i], fineAt(b, i));
/** The number Team Rosters shows for a fine value of a rating in a slot. */
export function shownFineInSlot(slot: number, group: Group, attr: Attr, fine: number): number {
  const k = v8 ? V8_SLOT_POOLS[slot]?.[GROUP_ATTRS[group].indexOf(attr)] : null;
  return k ? shownV8(k, fine) : shownFine(fine);
}
/**
 * A rating on the scale progression works on: the v8 CFB value (continuous shown points) on a v8 dynasty, else the
 * number itself. `fromScale` turns it back into the stored number.
 */
export function toScale(value: number, attr: Attr, role: string): number {
  const k = v8 ? v8Key(role, GROUP_OF_ROLE[role] ?? 'QB', attr) : null;
  return k ? cfbOfFine(k, fineOf(value)) : value;
}
export function fromScale(c: number, attr: Attr, role: string): number {
  const k = v8 ? v8Key(role, GROUP_OF_ROLE[role] ?? 'QB', attr) : null;
  return k ? valueOfFine(fineFromCfb(k, c)) : Math.round(c * 10) / 10;
}

/** The number a shown number stands for (editing): its fine value through the curve on the v8 scale. */
export function valueOfShown(shown: number, attr: Attr, role: string): number {
  const k = v8 ? v8Key(role, GROUP_OF_ROLE[role] ?? 'QB', attr) : null;
  return k ? valueOfFine(fineFromShown(k, shown)) : shown;
}
/** A slot's fine value for its i-th rating. */
export const fineAt = (b: Pick<BwSlot, 'steps' | 'offs'>, i: number) => Math.max(0, 16 * b.steps[i] + (b.offs?.[i] ?? 0));

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
  const f = (v8 ? OVR_FORMULAS_V8 : OVR_FORMULAS)[role];
  if (!f) return 0;
  let avg = 0;
  for (const [a, w] of Object.entries(f.weights) as [Attr, number][]) avg += (w / 100) * shownAt(r[a] ?? 0, a, role);
  return clamp(Math.round(f.base + f.scale * avg), 0, 99);
}
/** A player's OVR at his own position. */
export const ovrOf = (p: Pick<DPlayer, 'pos' | 'ratings'>) => ovrAt(p.ratings, roleOfPos(p.pos));

/** What the game gets for a player in a slot: the slot group's six ratings as steps and offsets. */
export function bwSlotOf(p: Pick<DPlayer, 'ratings'>, def: Pick<SlotDef, 'label' | 'group'>, weightPlus = 0): BwSlot {
  const attrs = GROUP_COLUMNS[def.group];
  const fine = attrs.map((a) => splitFine(a === 'Weight' ? fineWeight(p.ratings.Weight ?? 140) : fineOf(p.ratings[a] ?? 0)));
  return { label: def.label, group: def.group, attrs, steps: fine.map((x) => x.step), offs: fine.map((x) => x.off), weightPlus: def.group === 'OL' ? weightPlus : 0 };
}

/** The numbers a slot's fine values stand for (the first season: the ROM's steps and offsets). */
export function ratingsFromSlot(b: BwSlot, into: Ratings = {}): Ratings {
  const out = { ...into };
  b.attrs.forEach((a, i) => { out[a] = a === 'Weight' ? 140 + fineAt(b, i) : valueOfFine(fineAt(b, i)); });
  return out;
}
