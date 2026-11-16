// The fine-ratings mod of the 2026 Season Edition (Elevated v2.0.1-test13 on; claude.ai project notes
// bw95-fine-ratings-plan.md, the patch's fineratings.py): the snap gives every on-field player a fine value per
// rating, 16 × step + offset, and Team Rosters shows fine × 100 / 240. The offsets of the 2026 rosters are a
// table at 0x2E0000: 138 teams × 32 slots × 3 bytes, six nibbles in the roster record's order, −8..+7 (the 1994
// Season Edition has the same table for its 107 teams, test23 on).
// A dynasty season's offsets go in the dynasty area (dynastyArea.ts, header +0x24).
import { GROUP_ATTRS } from '../rosterLayouts';
import type { BwSlot } from './model';

export const FINE_TABLE = 0x2e0000;
const FINE_CODE = 0x2b8000, FINE_CODE_END = 0x2bc000;
/** The impact players' code (v2.0.1-test20 on), which the snap's jump now reaches first. */
const IMPACT_CODE = 0x2bc400, IMPACT_CODE_END = 0x2c0000;
/** Bytes of a season's offsets set (this format) for a number of teams. */
export const fineSetBytes = (teams: number) => teams * 32 * 3;

const long = (d: Uint8Array, a: number) => ((d[a] << 24) >>> 0) + (d[a + 1] << 16) + (d[a + 2] << 8) + d[a + 3];

/**
 * Whether the ROM has the fine-ratings mod: the snap at 0x06FAF4 jumps into its code, or (v2.0.1-test20 on)
 * into the impact players' hook, which goes on into the fine-ratings code (a `jsr` / `jmp` into
 * 0x2B8000-0x2BBFFF within its first 64 bytes). Before this check knew the impact hook, the app made up
 * the first season's offsets on test20 and later.
 */
export function hasFineRatings(d: Uint8Array): boolean {
  if (d.length < 0x400000 || d[0x06faf4] !== 0x4e || d[0x06faf5] !== 0xf9) return false;
  const to = long(d, 0x06faf6);
  if (to >= FINE_CODE && to < FINE_CODE_END) return true;
  if (to < IMPACT_CODE || to >= IMPACT_CODE_END) return false;
  for (let a = to; a < to + 64; a += 2) {
    if (d[a] === 0x4e && (d[a + 1] === 0xb9 || d[a + 1] === 0xf9)) {
      const t = long(d, a + 2);
      if (t >= FINE_CODE && t < FINE_CODE_END) return true;
    }
  }
  return false;
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
