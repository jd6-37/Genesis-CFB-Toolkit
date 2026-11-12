// A player's OVR from his Bill Walsh '95 ratings, by roster role.
//
// OVR = base + scale x (weighted average of the ratings as the game shows them, 0-99, from the fine values). Only ratings
// the game uses at that position count (claude.ai notes bw95-cfb27-ratings-notes.md, "How BW95 uses
// the ratings"): kickers' and punters' Quick is kick distance and Range isn't used for kicks; Weight is
// mass, not quality, so it's left out everywhere. Linemen's Block keeps them on their feet after hard
// hits, so it counts. QB Speed is set to 15% (he runs in the game; CFB 27's Overall ignores it). The shares,
// base and scale were fitted to the CFB 27 Overall of the 4,416 starters of the 138-team 2026 Season
// Edition (2026-11-12), so the numbers read like CFB 27's.

import { bw95Role } from '../rosterCfb27';
import type { Attr } from '../rosterLayouts';
import { fineAt, shownFine } from './ratings';
import type { BwSlot } from './model';

export interface OvrFormula {
  base: number;
  scale: number;
  /** Share of each rating in percent (they add up to 100). */
  weights: Partial<Record<Attr, number>>;
}

export const OVR_FORMULAS: Record<string, OvrFormula> = {
  QB: { base: 57, scale: 0.42, weights: { Quickness: 25, Awareness: 45, Range: 10, Power: 5, Speed: 15 } }, // 138 starters: within 3 of CFB 27 for 82%, average miss 2.2
  HB: { base: 48, scale: 0.51, weights: { Speed: 35, Quickness: 30, Awareness: 15, Hands: 5, Power: 15 } }, // 276 starters: within 3 of CFB 27 for 96%, average miss 1.3
  FB: { base: 46, scale: 0.4, weights: { Speed: 40, Awareness: 20, Hands: 15, Power: 25 } }, // 138 starters: within 3 of CFB 27 for 80%, average miss 2.2
  WR: { base: 52, scale: 0.5, weights: { Speed: 15, Quickness: 25, Awareness: 25, Hands: 15, Power: 20 } }, // 552 starters: within 3 of CFB 27 for 95%, average miss 1.4
  TE: { base: 55, scale: 0.51, weights: { Speed: 20, Quickness: 25, Awareness: 20, Hands: 25, Power: 10 } }, // 276 starters: within 3 of CFB 27 for 89%, average miss 1.6
  OL: { base: 53, scale: 0.48, weights: { Power: 30, Blocking: 30, Speed: 25, Awareness: 15 } }, // 690 starters: within 3 of CFB 27 for 98%, average miss 1.2
  DE: { base: 48, scale: 0.52, weights: { Power: 15, Speed: 35, Awareness: 20, Tackling: 30 } }, // 276 starters: within 3 of CFB 27 for 97%, average miss 1.2
  DT: { base: 56, scale: 0.38, weights: { Power: 60, Speed: 10, Awareness: 15, Tackling: 15 } }, // 276 starters: within 3 of CFB 27 for 97%, average miss 1.0
  LB: { base: 35, scale: 0.55, weights: { Speed: 10, Quickness: 15, Awareness: 35, Tackling: 40 } }, // 552 starters: within 3 of CFB 27 for 96%, average miss 1.4
  CB: { base: 38, scale: 0.55, weights: { Speed: 30, Quickness: 25, Awareness: 30, Hands: 5, Tackling: 10 } }, // 552 starters: within 3 of CFB 27 for 93%, average miss 1.5
  S: { base: 43, scale: 0.51, weights: { Speed: 20, Quickness: 20, Awareness: 40, Hands: 5, Tackling: 15 } }, // 414 starters: within 3 of CFB 27 for 99%, average miss 1.1
  K: { base: 65, scale: 0.22, weights: { Quickness: 50, Accuracy: 50 } }, // 138 starters: within 3 of CFB 27 for 93%, average miss 1.6
  P: { base: 62, scale: 0.24, weights: { Quickness: 55, Accuracy: 45 } }, // 138 starters: within 3 of CFB 27 for 91%, average miss 1.5
};

/** The role of a roster slot in the 138-team edition (one 4-3 layout for every team). */
export const roleOfSlot = (slot: number) => bw95Role(slot, false, true);

export function playerOvr(slot: number, b: BwSlot): number {
  const f = OVR_FORMULAS[roleOfSlot(slot)];
  if (!f) return 0;
  let avg = 0;
  for (const [a, w] of Object.entries(f.weights) as [Attr, number][]) {
    const i = b.attrs.indexOf(a);
    if (i >= 0) avg += (w / 100) * shownFine(fineAt(b, i));
  }
  return Math.max(0, Math.min(99, Math.round(f.base + f.scale * avg)));
}
