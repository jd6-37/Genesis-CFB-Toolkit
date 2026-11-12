// The fine-ratings mod of the 2026 Season Edition (Elevated v2.0.1-test13 on; claude.ai project notes
// bw95-fine-ratings-plan.md, the patch's fineratings.py): the snap gives every on-field player a fine value per
// rating, 16 × step + offset, and Team Rosters shows fine × 100 / 240. The offsets of the 2026 rosters are a
// table at 0x2E0000: 138 teams × 32 slots × 3 bytes, six nibbles in the roster record's order, −8..+7.
// A dynasty season's offsets go in the dynasty area (dynastyArea.ts, header +0x24).
import { GROUP_ATTRS } from '../rosterLayouts';
import type { BwSlot } from './model';

export const FINE_TABLE = 0x2e0000;
const FINE_CODE = 0x2b8000, FINE_CODE_END = 0x2bc000;
export const FINE_TEAMS = 138;
export const FINE_SET_BYTES = FINE_TEAMS * 32 * 3;

/** Whether the ROM has the fine-ratings mod: the snap at 0x06FAF4 jumps into its code. */
export function hasFineRatings(d: Uint8Array): boolean {
  if (d.length < 0x400000 || d[0x06faf4] !== 0x4e || d[0x06faf5] !== 0xf9) return false;
  const to = ((d[0x06faf6] << 24) >>> 0) + (d[0x06faf7] << 16) + (d[0x06faf8] << 8) + d[0x06faf9];
  return to >= FINE_CODE && to < FINE_CODE_END;
}

const signed = (n: number) => (n & 8 ? (n & 15) - 16 : n & 15);

/** A slot's six offsets from a table at `at`, in the roster record's order. */
export function readFineOffsets(d: Uint8Array, team: number, slot: number, at = FINE_TABLE): number[] {
  const o = at + (team * 32 + slot) * 3;
  return [d[o] >> 4, d[o], d[o + 1] >> 4, d[o + 1], d[o + 2] >> 4, d[o + 2]].map(signed);
}

/** Writes a slot's offsets (the slot's ratings are in the roster screen's order) into a table. */
export function putFineOffsets(table: Uint8Array, team: number, slot: number, b: BwSlot): void {
  const n = GROUP_ATTRS[b.group].map((a) => (b.offs?.[b.attrs.indexOf(a)] ?? 0) & 15);
  table.set([(n[0] << 4) | n[1], (n[2] << 4) | n[3], (n[4] << 4) | n[5]], (team * 32 + slot) * 3);
}
