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
// - H-031 (user, 2026-11-18: "yes change it!"): the values are the fine ratings the game plays with, 16 × step + the
//   slot's offset (−8..+7), clamped 0-255; bases and penalties × 16. With every offset 0 this picks as the steps did.
//   Reference: the ROM lane's `finepick.py` (the ROM since 2026 test57 / 1994 test58).
//
// H-028 (user, 2026-11-17/18): the app picks for every team, the user may change his own teams' three in the offseason
// ("Max 2 per side of the ball"), and the season ROM carries every team's three as the table "IMP1" (address at the
// dynasty header +0x2C): "IMP1", team count (word), 0 (word), then 3 roster slots per team (0xFF = none). The ROM
// reads it in Season mode on the dynasty's roster set; Exhibition keeps its own pick.
import { GROUP_ATTRS } from '../rosterLayouts';
import type { BwSlot, DSeason, Dynasty } from './model';
import { bwSlotOf } from './ratings';
import { SLOT_DEFS, spotLabel } from './lineup';
import { editionOf } from './edition';

const SLOT_DEF = SLOT_DEFS.reduce<Record<number, (typeof SLOT_DEFS)[number]>>((m, x) => ((m[x.slot] = x), m), {});

/** A slot's fine values (16 × step + offset, 0-255) in the ROM's nibble order: 0 weight, 1 quickness (power for
 * linemen), 2 speed, 3 INTEL, 4 hands / range, 5 power / tackle. */
type Fine = number[];

// H-044 (user, 2026-11-19: "the dynasty app should follow suit"; the ROM since 2026 test64 / 1994 test65, reference
// the ROM lane's finepick.py): DE and DT are separate groups (both on the DL ratings) with penalties of 3 and 6 steps
// ("penalize DT more than DE"); each group's base is per edition, in fine units (the mean of each team's best starter's
// rating sum, fitted on 2026 test63 / 1994 test64); a second pick of the first offensive pick's group scores less (RB
// and TE 6 steps, WR 3: "two HBs or two TEs … difficult. 2x WR is slightly more acceptable"); and a second defensive
// lineman is never picked ("Definitely never two dline"). The H-031 formula (one DL group, DLP 1, DL2P 5) is gone.
// Group name: rating bits over nibbles 1-5 (bit 0 = nibble 1).
const MASKS = { QB: 0b01110, RB: 0b10111, WR: 0b01111, TE: 0b01111, DE: 0b10111, DT: 0b10111, LB: 0b10110, DB: 0b11110 } as const;
type ImpactGroup = keyof typeof MASKS;
/** Per edition and group, the base in fine units (16 = one step). */
export const IMPACT_BASES: Record<'2026' | '1994', Record<ImpactGroup, number>> = {
  2026: { QB: 483, RB: 688, WR: 714, TE: 539, DE: 682, DT: 622, LB: 557, DB: 650 },
  1994: { QB: 430, RB: 643, WR: 673, TE: 410, DE: 598, DT: 592, LB: 557, DB: 687 },
};
const SLOTG: Record<number, ImpactGroup> = {
  0: 'QB', 1: 'RB', 2: 'RB', 3: 'RB', 9: 'WR', 10: 'WR', 11: 'WR', 12: 'WR', 13: 'TE', 14: 'TE',
  16: 'DE', 17: 'DT', 18: 'DE', 19: 'LB', 20: 'LB', 21: 'DT', 22: 'LB', 23: 'LB',
  24: 'DB', 25: 'DB', 26: 'DB', 27: 'DB', 28: 'DB', 29: 'DB', 30: 'DB',
};
const QBB = -3, FBP = 10;
/** Group penalties and the same-group penalty, in steps. */
const PEN: Partial<Record<ImpactGroup, number>> = { DE: 3, DT: 6 };
const SAMEP: Partial<Record<ImpactGroup, number>> = { RB: 6, TE: 6, WR: 3 };
const OFF = [0, 1, 2, 3, 9, 10, 11, 12, 13, 14];
const DEF = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

/**
 * The three impact slots of a roster (offense, defense, the third), from each slot's ROM nibbles (null = empty).
 * `fourThree`: slot 21 is a defensive lineman (every team of both Elevated editions is 4-3 by the ROM's bit table).
 */
export function impactSlots(nib: (Fine | null)[], edition: '2026' | '1994', fourThree = true): number[] {
  const groupOf = (s: number): ImpactGroup => (s === 21 && !fourThree ? 'LB' : SLOTG[s]);
  const isDl = (s: number) => s === 16 || s === 17 || s === 18 || (s === 21 && fourThree);
  const bases = IMPACT_BASES[edition];
  const score = (s: number): number | null => {
    const n = nib[s];
    if (!n) return null;
    const g = groupOf(s);
    let sum = 0;
    for (let i = 0; i < 5; i++) if ((MASKS[g] >> i) & 1) sum += n[i + 1];
    return 2 * (sum - bases[g]) + 16 * ((s === 0 ? QBB : 0) - (s === 3 ? FBP : 0) - (PEN[g] ?? 0));
  };
  const best = (list: number[], except: number, noFb: boolean): [number, number] => {
    let b = -1, bv = -Infinity;
    for (const s of list) {
      if (s === except || (s === 3 && noFb)) continue;
      if (except >= 0 && isDl(except) && isDl(s)) continue; // never a second defensive lineman
      const v0 = score(s);
      if (v0 === null) continue;
      const v = v0 - (except >= 0 && SLOTG[except] && groupOf(except) === groupOf(s) ? 16 * (SAMEP[groupOf(s)] ?? 0) : 0);
      if (v > bv) { b = s; bv = v; }
    }
    return [b, bv];
  };
  for (const noFb of [true, false]) {
    const [o1] = best(OFF, -1, noFb);
    const [d1] = best(DEF, -1, noFb);
    const [o2, vo] = best(OFF, o1, noFb);
    const [d2, vd] = best(DEF, d1, noFb);
    const third = vd > vo ? d2 : o2;
    if (!noFb || o1 === 1 || o1 === 2 || third === 1 || third === 2) return [o1, d1, third].filter((s) => s >= 0);
  }
  return [];
}

/** A fine value as the game plays it: 16 × step + offset, clamped 0-255. */
export const fineValue = (step: number, off: number) => Math.max(0, Math.min(255, 16 * step + off));

/** A slot's fine values in the ROM's nibble order, from the app's slot record (its steps are in the editor's column order). */
export function fineOf(b: BwSlot): Fine {
  return GROUP_ATTRS[b.group].map((a) => {
    const i = b.attrs.indexOf(a);
    return i < 0 ? 0 : fineValue(b.steps[i] ?? 0, b.offs?.[i] ?? 0);
  });
}

/** The game's own pick for a team (player ids in pick order), from the season ROM's slot records (`bw`), or, where a
 * season has none (the first season, played on the user's own ROM), from the players' ratings the same way. */
export function gameImpact(d: Pick<Dynasty, 'players' | 'edition'>, s: Pick<DSeason, 'slots' | 'bw'>, team: number): number[] {
  const ids = s.slots[team] ?? [];
  const nib = ids.map((id, slot) => {
    if (!id) return null;
    const b = s.bw?.[team]?.[slot] ?? (SLOT_DEF[slot] ? bwSlotOf(d.players[id - 1], SLOT_DEF[slot]!) : null);
    return b ? fineOf(b) : null;
  });
  return impactSlots(nib, editionOf(d).id).map((slot) => ids[slot]).filter((id): id is number => !!id);
}

/** The roster slots a player may be picked from (QB, HB1, HB2, FB, WR, TE, every defender; no linemen, K or P). */
export const IMPACT_SLOTS = [0, 1, 2, 3, 9, 10, 11, 12, 13, 14, ...DEF];
/** At most this many of a team's three on one side of the ball (user, 2026-11-18). */
export const IMPACT_SIDE_MAX = 2;
const isDefense = (slot: number) => slot >= 16;

/** The players of a team who may be impact players: the Active Roster at QB, HB, FB, WR, TE and on defense. */
export function impactChoices(s: Pick<DSeason, 'slots'>, team: number): { id: number; slot: number; label: string; defense: boolean }[] {
  const ids = s.slots[team] ?? [];
  return IMPACT_SLOTS.filter((slot) => ids[slot]).map((slot) => ({ id: ids[slot]!, slot, label: spotLabel(slot), defense: isDefense(slot) }));
}

/** Why three picks can't be a team's impact players (null if they can). */
export function impactPicksProblem(s: Pick<DSeason, 'slots'>, team: number, ids: number[]): string | null {
  if (ids.length !== 3) return 'Pick three impact players.';
  if (new Set(ids).size !== 3) return 'Pick three different players.';
  const choices = new Map(impactChoices(s, team).map((c) => [c.id, c]));
  const picked = ids.map((id) => choices.get(id));
  if (picked.some((c) => !c)) return 'Impact players come from the Active Roster: a QB, a back, a receiver, a tight end or a defender.';
  const def = picked.filter((c) => c!.defense).length;
  if (def > IMPACT_SIDE_MAX) return `At most ${IMPACT_SIDE_MAX} of the three can be defenders.`;
  if (3 - def > IMPACT_SIDE_MAX) return `At most ${IMPACT_SIDE_MAX} of the three can be on offense.`;
  return null;
}

/**
 * A season's impact players of a team, as player ids: the user's three if he picked and they still qualify (a later
 * lineup change can move one out; then the team gets the game's pick again), else the game's pick.
 */
export function teamImpact(d: Pick<Dynasty, 'players' | 'edition'>, s: Pick<DSeason, 'slots' | 'bw' | 'impact'>, team: number): number[] {
  const own = s.impact?.[team];
  if (own && !impactPicksProblem(s, team, own)) return own.slice();
  return gameImpact(d, s, team);
}

/** Whether a team's impact players are the user's own picks this season. */
export const ownImpact = (s: Pick<DSeason, 'slots' | 'impact'>, team: number) => {
  const own = s.impact?.[team];
  return !!own && !impactPicksProblem(s, team, own);
};

/** Every team's impact players this season (player ids), for marking them in lists. */
export function impactSet(d: Pick<Dynasty, 'players' | 'teams'>, s: Pick<DSeason, 'slots' | 'bw' | 'impact'>): Set<number> {
  const out = new Set<number>();
  for (const t of d.teams) for (const id of teamImpact(d, s, t.index)) out.add(id);
  return out;
}

/** Why the newest season's impact players can't be changed (null if they can). */
export function impactLock(d: Dynasty): string | null {
  const s = d.seasons[d.seasons.length - 1];
  if (s.index === 0) return "The first season is played on your own ROM, so it keeps the game's picks. You can pick your teams' impact players in the offseason, for the next season.";
  if (s.imports.length) return `The ${s.year} season has started: its impact players are in the ROM you played. Pick them again in the next offseason.`;
  return null;
}

/** The user's three impact players for one of his teams (null: back to the game's pick). */
export function setImpactPicks(d: Dynasty, team: number, ids: number[] | null): Dynasty {
  const lock = impactLock(d);
  if (lock) throw new Error(lock);
  if (!d.userTeams.includes(team)) throw new Error('You can pick the impact players of your own teams.');
  const s = d.seasons[d.seasons.length - 1];
  if (ids) {
    const problem = impactPicksProblem(s, team, ids);
    if (problem) throw new Error(problem);
  }
  const impact = { ...(s.impact ?? {}) };
  if (ids && [...ids].sort().join() !== gameImpact(d, s, team).sort().join()) impact[team] = ids.slice();
  else delete impact[team];
  const next: DSeason = {
    ...s,
    impact,
    ...(s.romDownloaded ? { lineupEdited: true, rosterVersion: s.lineupEdited ? s.rosterVersion ?? 1 : (s.rosterVersion ?? 1) + 1 } : {}),
  };
  return { ...d, seasons: [...d.seasons.slice(0, -1), next] };
}

/** The season ROM's "IMP1" table: every team's three impact players as roster slots, best offense first. */
export function impactTable(d: Pick<Dynasty, 'players' | 'teams'>, s: Pick<DSeason, 'slots' | 'bw' | 'impact'>): Uint8Array {
  const n = d.teams.length;
  const out = new Uint8Array(8 + 3 * n).fill(0xff);
  out.set([0x49, 0x4d, 0x50, 0x31, n >> 8, n & 255, 0, 0]); // IMP1
  for (let t = 0; t < n; t++) {
    const ids = s.slots[t] ?? [];
    const slots = teamImpact(d, s, t).map((id) => ids.indexOf(id)).filter((x) => x >= 0);
    // Offense first, then defense (the ROM doesn't care about the order inside a team).
    slots.sort((a, b) => Number(isDefense(a)) - Number(isDefense(b)));
    slots.slice(0, 3).forEach((slot, k) => { out[8 + 3 * t + k] = slot; });
  }
  return out;
}

/** The impact table in a season ROM (dynasty header +0x2C), as 3 slots per team (0xFF = none), or null. */
export function readImpactTable(rom: Uint8Array): number[][] | null {
  const u32 = (a: number) => ((rom[a] << 24) >>> 0) + (rom[a + 1] << 16) + (rom[a + 2] << 8) + rom[a + 3];
  const at = u32(0x3e002c);
  if (at === 0xffffffff || at < 0x3e0000 || at + 8 > rom.length) return null;
  if (String.fromCharCode(...rom.subarray(at, at + 4)) !== 'IMP1') return null;
  const n = (rom[at + 4] << 8) | rom[at + 5];
  return Array.from({ length: n }, (_, t) => Array.from(rom.subarray(at + 8 + 3 * t, at + 11 + 3 * t)));
}
