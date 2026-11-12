// A dynasty team is 64 players (user, 2026-11-12): the 32 in the game and a bench of one backup for
// each of those slots. Both come from the Rosters tool's CFB 27 conversion: the 32 are its picks, the
// bench is what the same conversion picks from the players left over (so every slot's backup plays
// the slot's position), rated on the 32's scale.

import { convertCfb27, rateAgainst, type Cfb27Fill } from '../rosterCfb27';
import { GROUP_COLUMNS } from '../rosterLayouts';
import { hasOlPatch, OL_PATCH } from '../rosterOlPatch';
import type { RosterRom } from '../rosterRom';
import type { Sheet } from '../rosterSheet';
import type { BwSlot } from './model';

export const SLOTS = 32;
/** Players a dynasty team keeps: the 32 in the game and one backup for each. */
export const TEAM_SIZE = 2 * SLOTS;

export interface RosterBuild {
  /** Per team and slot, the sheet row of the player in the game / on the bench (null = nobody). */
  slots: (number | null)[][];
  bench: (number | null)[][];
  bw: (BwSlot | null)[][];
  benchBw: (BwSlot | null)[][];
}

const slotOf = (f: Cfb27Fill, olPlus: number): BwSlot => {
  const attrs = GROUP_COLUMNS[f.group];
  return { label: f.label, group: f.group, attrs, steps: attrs.map((a) => f.steps[a] ?? 0), weightPlus: f.group === 'OL' ? olPlus : 0 };
};

/** The 32 and the bench of every team the sheet has, with their game ratings. */
export function buildRosters(rom: RosterRom, sheet: Sheet): RosterBuild {
  const n = rom.teams.length;
  const empty = <T>() => Array.from({ length: n }, () => new Array<T | null>(SLOTS).fill(null));
  const out: RosterBuild = { slots: empty(), bench: empty(), bw: empty(), benchBw: empty() };
  const olPlus = hasOlPatch(rom) ? OL_PATCH.pounds : 0;

  const first = convertCfb27(rom, sheet);
  const used = new Set<number>();
  for (const t of first.teams) {
    for (const f of t.fills) {
      out.slots[t.team][f.slot] = f.player.row;
      out.bw[t.team][f.slot] = slotOf(f, olPlus);
      used.add(f.player.row);
    }
  }
  // The bench: the same conversion over the players left over.
  const rest = sheet.rows.map((_, i) => i).filter((i) => !used.has(i));
  const second = convertCfb27(rom, { headers: sheet.headers, rows: rest.map((i) => sheet.rows[i]) });
  const fills = second.teams.flatMap((t) => t.fills);
  rateAgainst(first, fills);
  for (const f of fills) {
    out.bench[f.team][f.slot] = rest[f.player.row];
    out.benchBw[f.team][f.slot] = slotOf(f, olPlus);
  }
  return out;
}

/** A bench for the 32 already set: the conversion of `benchSheet` (its own slots), rated on the scale of `startersSheet`'s conversion. */
export function benchFor(rom: RosterRom, startersSheet: Sheet, benchSheet: Sheet): Pick<RosterBuild, 'bench' | 'benchBw'> {
  const n = rom.teams.length;
  const empty = <T>() => Array.from({ length: n }, () => new Array<T | null>(SLOTS).fill(null));
  const out = { bench: empty<number>(), benchBw: empty<BwSlot>() };
  const olPlus = hasOlPatch(rom) ? OL_PATCH.pounds : 0;
  const first = convertCfb27(rom, startersSheet);
  const second = convertCfb27(rom, benchSheet);
  const fills = second.teams.flatMap((t) => t.fills);
  rateAgainst(first, fills);
  for (const f of fills) {
    out.bench[f.team][f.slot] = f.player.row;
    out.benchBw[f.team][f.slot] = slotOf(f, olPlus);
  }
  return out;
}
