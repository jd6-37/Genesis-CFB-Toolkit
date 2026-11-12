// A dynasty team is 64 players (user, 2026-11-12): the 32 in the game and a bench of one backup for
// each of those slots. Both come from the Rosters tool's CFB 27 conversion: the 32 are its picks, the
// bench is what the same conversion picks from the players left over (so every slot's backup plays
// the slot's position), rated on the 32's scale.

import { convertCfb27, rateAgainst, type Cfb27Fill, type Cfb27Plan } from '../rosterCfb27';
import { GROUP_ATTRS, GROUP_COLUMNS, type Attr, type Group } from '../rosterLayouts';
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
  /**
   * Per sheet row, the steps a player would have in the related position group a lineup change can move
   * him to (defensive linemen as linebackers and the other way round), rated on the same scale.
   */
  extra: Map<number, Partial<Record<Attr, number>>>;
}

/** The role a player of a role may move to with a different rating group (lineup.ts MOVES: DE/OLB). */
const ALT: Record<string, { role: string; group: Group }> = { DE: { role: 'LB', group: 'LB' }, DT: { role: 'LB', group: 'LB' }, LB: { role: 'DE', group: 'DL' } };

/** The extra steps of every fill (see RosterBuild.extra); `rowOf` maps a fill's player row to the sheet's. */
function extras(plan: Cfb27Plan, fills: Cfb27Fill[], rowOf: (row: number) => number, out: RosterBuild['extra']) {
  const clones = fills.filter((f) => ALT[f.role]).map((f) => ({ ...f, role: ALT[f.role].role, group: ALT[f.role].group, steps: {} }));
  rateAgainst(plan, clones);
  for (const c of clones) {
    const own = new Set(GROUP_ATTRS[fills.find((f) => f.player === c.player)!.group]);
    const add: Partial<Record<Attr, number>> = {};
    for (const [a, v] of Object.entries(c.steps) as [Attr, number][]) if (!own.has(a)) add[a] = v;
    out.set(rowOf(c.player.row), { ...out.get(rowOf(c.player.row)), ...add });
  }
}

const slotOf = (f: Cfb27Fill, olPlus: number): BwSlot => {
  const attrs = GROUP_COLUMNS[f.group];
  return { label: f.label, group: f.group, attrs, steps: attrs.map((a) => f.steps[a] ?? 0), weightPlus: f.group === 'OL' ? olPlus : 0 };
};

/** The 32 and the bench of every team the sheet has, with their game ratings. */
export function buildRosters(rom: RosterRom, sheet: Sheet): RosterBuild {
  const n = rom.teams.length;
  const empty = <T>() => Array.from({ length: n }, () => new Array<T | null>(SLOTS).fill(null));
  const out: RosterBuild = { slots: empty(), bench: empty(), bw: empty(), benchBw: empty(), extra: new Map() };
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
  extras(first, first.teams.flatMap((t) => t.fills), (row) => row, out.extra);
  extras(first, fills, (row) => rest[row], out.extra);
  return out;
}
