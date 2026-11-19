// The Rosters tab's numbers on ROMs with the v8 tables (H-039; 2026 test60 / 1994 test61 on): every rating but weight
// is shown and edited as the 0-99 number the game's Team Rosters shows (ratingsV8.ts), and stored as the record's
// step plus the fine table's offset. Other ROMs (the stock game, Elevated v1.1.0) keep the 16 steps (user, 2026-11-19).
import { fineFromShown, hasV8, shownV8, stepAndOffset, V8_SLOT_POOLS } from './ratingsV8';
import { FINE_TABLE, readFineOffsets } from './dynasty/fine';
import { GROUP_ATTRS, type Attr, type SlotDef } from './rosterLayouts';
import { readPlayer, writePlayer, type RosterRom } from './rosterRom';

const v8Of = new WeakMap<Uint8Array, boolean>();
/** Whether the ROM shows ratings through the v8 tables (cached per ROM bytes). */
export function romIsV8(rom: RosterRom): boolean {
  let v = v8Of.get(rom.data);
  if (v === undefined) { v = hasV8(rom.data); v8Of.set(rom.data, v); }
  return v;
}

const keyOf = (def: SlotDef, attr: Attr) => V8_SLOT_POOLS[def.slot]?.[GROUP_ATTRS[def.group].indexOf(attr)] ?? null;

/** The game's fine value (0-247) of a slot's rating, or null for weight / a rating the slot doesn't have. */
export function fineOfSlot(rom: RosterRom, team: number, def: SlotDef, attr: Attr): number | null {
  const i = GROUP_ATTRS[def.group].indexOf(attr);
  if (i < 0 || attr === 'Weight') return null;
  return Math.max(0, 16 * readPlayer(rom, team, def.slot).ratings[i] + readFineOffsets(rom.data, team, def.slot)[i]);
}

/** The 0-99 number Team Rosters shows for a slot's rating on a v8 ROM, or null. */
export function shownOfSlot(rom: RosterRom, team: number, def: SlotDef, attr: Attr): number | null {
  const k = keyOf(def, attr), f = fineOfSlot(rom, team, def, attr);
  return k && f !== null ? shownV8(k, f) : null;
}

/** Sets a slot's rating on a v8 ROM from a shown number: the step in the record, the rest in the fine table. */
export function setShownOfSlot(rom: RosterRom, team: number, def: SlotDef, attr: Attr, shown: number): void {
  const k = keyOf(def, attr), i = GROUP_ATTRS[def.group].indexOf(attr);
  if (!k || i < 0) return;
  // A number covers 2-3 fine values: the same number again keeps the rating as it is (a sheet comes back unchanged).
  if (shownOfSlot(rom, team, def, attr) === Math.max(0, Math.min(99, Math.round(shown)))) return;
  const { step, off } = stepAndOffset(fineFromShown(k, shown));
  const p = readPlayer(rom, team, def.slot);
  p.ratings[i] = step;
  writePlayer(rom, team, def.slot, p);
  const a = FINE_TABLE + (team * 32 + def.slot) * 3 + (i >> 1);
  rom.data[a] = i & 1 ? (rom.data[a] & 0xf0) | (off & 15) : (rom.data[a] & 0x0f) | ((off & 15) << 4);
}
