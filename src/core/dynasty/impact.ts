// Impact players (user, 2026-11-17: mark them in the Dynasty app, on Rosters and the team page): the game picks three
// per team at a game's first snap, from the Active Roster in the ROM. This is the ROM's pick (the ROM lane's
// `impact.py` PK1 / BEST, checked against its `impact_ut.py` reference `ref_pick`), on the steps the season ROM holds,
// so the app marks the same three players as the yellow dot on the game's Team Rosters.
//
// - A player is scored inside his position group on the ratings that matter there (INTEL always among them):
//   2 x (the sum of those steps - the group's base), the base being the league average of each team's best in the
//   group. The QB scores 3 less, a defensive lineman 1 less (5 more for a second one once the first defender picked
//   is a lineman), the fullback 10 less, and the fullback only counts when the pick without him has no halfback.
// - Pick order: the best offensive skill player, the best defender, then the better of the next offense and the next
//   defense (offense on a tie). Inside a list, ties go to the lower slot.
import { GROUP_ATTRS } from '../rosterLayouts';
import type { BwSlot, DSeason, Dynasty } from './model';
import { bwSlotOf } from './ratings';
import { SLOT_DEFS } from './lineup';

const SLOT_DEF = SLOT_DEFS.reduce<Record<number, (typeof SLOT_DEFS)[number]>>((m, x) => ((m[x.slot] = x), m), {});

/** The ROM's nibble order per slot: 0 weight, 1 quickness (power for linemen), 2 speed, 3 INTEL, 4 hands / range, 5 the sixth. */
type Nibbles = number[];

// name: rating bits over nibbles 1-5 (bit 0 = nibble 1), base. impact.py GROUPS (impact-test6 on).
const GROUPS = {
  QB: { mask: 0b01110, base: 27 },
  RB: { mask: 0b10111, base: 42 },
  WR: { mask: 0b01111, base: 44 },
  TE: { mask: 0b01111, base: 28 },
  DL: { mask: 0b10111, base: 41 },
  LB: { mask: 0b10110, base: 37 },
  DB: { mask: 0b11110, base: 45 },
} as const;
type ImpactGroup = keyof typeof GROUPS;
const SLOTG: Record<number, ImpactGroup> = {
  0: 'QB', 1: 'RB', 2: 'RB', 3: 'RB', 9: 'WR', 10: 'WR', 11: 'WR', 12: 'WR', 13: 'TE', 14: 'TE',
  16: 'DL', 17: 'DL', 18: 'DL', 19: 'LB', 20: 'LB', 21: 'DL', 22: 'LB', 23: 'LB',
  24: 'DB', 25: 'DB', 26: 'DB', 27: 'DB', 28: 'DB', 29: 'DB', 30: 'DB',
};
const QBB = -3, DLP = 1, FBP = 10, DL2P = 5;
const OFF = [0, 1, 2, 3, 9, 10, 11, 12, 13, 14];
const DEF = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

/**
 * The three impact slots of a roster (offense, defense, the third), from each slot's ROM nibbles (null = empty).
 * `fourThree`: slot 21 is a defensive lineman (every team of both Elevated editions is 4-3 by the ROM's bit table).
 */
export function impactSlots(nib: (Nibbles | null)[], fourThree = true): number[] {
  const isDl = (s: number) => s === 16 || s === 17 || s === 18 || (s === 21 && fourThree);
  const score = (s: number): number | null => {
    const n = nib[s];
    if (!n) return null;
    const g = s === 21 && !fourThree ? GROUPS.LB : GROUPS[SLOTG[s]];
    let sum = 0;
    for (let i = 0; i < 5; i++) if ((g.mask >> i) & 1) sum += n[i + 1];
    return 2 * (sum - g.base) + (s === 0 ? QBB : 0) - (s === 3 ? FBP : 0) - (isDl(s) ? DLP : 0);
  };
  const best = (list: number[], except: number, noFb: boolean, secondDl: boolean): [number, number] => {
    let b = -1, bv = -1000;
    for (const s of list) {
      if (s === except || (s === 3 && noFb)) continue;
      const v0 = score(s);
      if (v0 === null) continue;
      const v = v0 - (secondDl && isDl(s) ? DL2P : 0);
      if (v > bv) { b = s; bv = v; }
    }
    return [b, bv];
  };
  for (const noFb of [true, false]) {
    const [o1] = best(OFF, -1, noFb, false);
    const [d1] = best(DEF, -1, noFb, false);
    const [o2, vo] = best(OFF, o1, noFb, false);
    const [d2, vd] = best(DEF, d1, noFb, isDl(d1));
    const third = vd > vo ? d2 : o2;
    if (!noFb || o1 === 1 || o1 === 2 || third === 1 || third === 2) return [o1, d1, third].filter((s) => s >= 0);
  }
  return [];
}

/** A slot's ROM nibbles from the app's slot record (its steps are in the editor's column order). */
export function nibblesOf(b: BwSlot): Nibbles {
  return GROUP_ATTRS[b.group].map((a) => b.steps[b.attrs.indexOf(a)] ?? 0);
}

/**
 * A season's impact players of a team, as player ids in pick order: from the season ROM's slot records (`bw`), or,
 * where a season has none (the first season, played on the user's own ROM), from the players' ratings the same way.
 */
export function teamImpact(d: Pick<Dynasty, 'players'>, s: Pick<DSeason, 'slots' | 'bw'>, team: number): number[] {
  const ids = s.slots[team] ?? [];
  const nib = ids.map((id, slot) => {
    if (!id) return null;
    const b = s.bw?.[team]?.[slot] ?? (SLOT_DEF[slot] ? bwSlotOf(d.players[id - 1], SLOT_DEF[slot]!) : null);
    return b ? nibblesOf(b) : null;
  });
  return impactSlots(nib).map((slot) => ids[slot]).filter((id): id is number => !!id);
}

/** Every team's impact players this season (player id → team), for marking them in lists. */
export function impactSet(d: Pick<Dynasty, 'players' | 'teams'>, s: Pick<DSeason, 'slots' | 'bw'>): Set<number> {
  const out = new Set<number>();
  for (const t of d.teams) for (const id of teamImpact(d, s, t.index)) out.add(id);
  return out;
}
