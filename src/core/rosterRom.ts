// Reading and writing team rosters in BW95, CF96 and CF97 ROMs, plus the checksums.
import { rl as u32, rw as u16, wl as w32 } from './bytes';
import {
  BW95_DEFENSE_BITS, BW95_LABELS_43, GAMES, GROUP_ATTRS, rosterLayout,
  type Attr, type Game, type GameInfo, type SlotDef,
} from './rosterLayouts';
import { isWideBw95 } from './romfile';
import { wideLayoutProblems, wideTeamCount } from './wide';

export interface Player {
  /** Jersey number byte as stored (BCD). Use jerseyNumber() to read it. */
  numberByte: number;
  /** Six 4-bit ratings in the record's nibble order (GROUP_ATTRS of the slot's group). */
  ratings: number[];
}

export interface RosterTeam {
  /** Index in the game's team table (= internal team number). */
  index: number;
  school: string;
  /** BW95: city; CF96/97: stadium. */
  other: string;
  nickname: string;
  rosterOffset: number;
  /** BW95 only: the roster screen labels this team as 3-4 (NT, LILB, RILB). Never on Elevated ROMs. */
  threeFour: boolean;
}

export interface RosterRom {
  game: Game;
  info: GameInfo;
  data: Uint8Array;
  teams: RosterTeam[];
  /** BW95 only: Bill Walsh '95 Elevated's defensive layout (DT1/DT2, MLB1/MLB2 for every team). */
  elevated: boolean;
  /** Elevated from v2.0.1-test17 / test11: the game's labels read CB1-CB4 and WR3 / WR4 (see rosterLayout). */
  newLabels: boolean;
  /** BW95 only: the 138-team 2026 Season Edition (src/core/wide.ts). */
  wide: boolean;
}

/** BW95: the roster screen's 4-3 labels read DT1 (Elevated, v1.1.0-beta.7 and later) instead of DLT. */
export function hasElevatedLayout(data: Uint8Array): boolean {
  const labels = String.fromCharCode(...data.subarray(BW95_LABELS_43.start, BW95_LABELS_43.end));
  return labels.includes('DT1');
}

/** BW95 Elevated from v2.0.1-test17 / test11: the label list reads CB1 (it read LCB1 before). */
export function hasNewLabels(data: Uint8Array): boolean {
  const labels = String.fromCharCode(...data.subarray(BW95_LABELS_43.start, BW95_LABELS_43.end));
  return labels.includes('CB1') && !labels.includes('LCB1');
}

const hexBytes = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();

export function detectGame(data: Uint8Array): Game | null {
  if (data.length < 0x200) return null;
  const sig = hexBytes(data.subarray(0, 16));
  for (const g of Object.values(GAMES)) if (g.signature === sig) return g.game;
  return null;
}

function readStrings(d: Uint8Array, p: number, n: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const len = u16(d, p);
    if (len < 2 || len > 64 || p + len > d.length) throw new Error('bad name string');
    let s = '';
    for (let i = p + 2; i < p + len && d[i] !== 0; i++) s += String.fromCharCode(d[i]);
    out.push(s);
    p += (len + 1) & ~1;
  }
  return out;
}

/** Opens a ROM for roster editing: on a copy, or with `inPlace` on the bytes given (the shared
 *  working ROM). Throws with a readable message. */
export function openRosterRom(input: Uint8Array, inPlace = false): RosterRom {
  const game = detectGame(input);
  if (!game) {
    throw new Error("Not a Bill Walsh College Football '95, College Football USA '96 or '97 ROM.");
  }
  const info = GAMES[game];
  const data = inPlace ? input : new Uint8Array(input);
  const teams: RosterTeam[] = [];
  const wide = game === 'bw95' && isWideBw95(data);
  if (wide) {
    const p = wideLayoutProblems(data);
    if (p.length) throw new Error(`This 4 MB Bill Walsh '95 ROM isn't laid out like the 138-team 2026 Season Edition: ${p.join('; ')}.`);
  }
  const count = wide ? wideTeamCount(data) : info.teamCount;
  for (let i = 0; i < count; i++) {
    const block = u32(data, info.teamTable + 4 * i);
    if (block < 0x200 || block + 0x20 > data.length) throw new Error(`Team table entry ${i} is invalid.`);
    const rosterOffset = block + u16(data, block);
    if (rosterOffset + info.players * info.stride > data.length) throw new Error(`Team ${i}: roster out of range.`);
    let names: string[];
    try {
      names = readStrings(data, block + u16(data, block + 2 * info.namesHeader), 3);
    } catch {
      throw new Error(`Team ${i}: names not readable — is this a modified ROM with a different layout?`);
    }
    teams.push({ index: i, school: names[0], other: names[1], nickname: names[2], rosterOffset, threeFour: false });
  }
  const elevated = game === 'bw95' && hasElevatedLayout(data);
  if (game === 'bw95' && !elevated) {
    for (const t of teams) t.threeFour = ((data[BW95_DEFENSE_BITS + (t.index >> 3)] >> (t.index & 7)) & 1) === 0;
  }
  return { game, info, data, teams, elevated, newLabels: elevated && hasNewLabels(data), wide };
}

/** BW95, original layout: re-reads the 3-4 flags, which follow a team's defense when its style
 *  changes (src/core/styles.ts). */
export function refreshThreeFour(rom: RosterRom): void {
  if (rom.game !== 'bw95' || rom.elevated) return;
  for (const t of rom.teams) t.threeFour = ((rom.data[BW95_DEFENSE_BITS + (t.index >> 3)] >> (t.index & 7)) & 1) === 0;
}

export const teamLayout = (rom: RosterRom, team: number): SlotDef[] =>
  rosterLayout(rom.game, rom.teams[team].threeFour, rom.elevated, rom.newLabels);

export function readPlayer(rom: RosterRom, team: number, slot: number): Player {
  const o = rom.teams[team].rosterOffset + slot * rom.info.stride;
  const d = rom.data;
  return {
    numberByte: d[o],
    ratings: [d[o + 1] >> 4, d[o + 1] & 15, d[o + 2] >> 4, d[o + 2] & 15, d[o + 3] >> 4, d[o + 3] & 15],
  };
}

export function writePlayer(rom: RosterRom, team: number, slot: number, p: Player): void {
  const o = rom.teams[team].rosterOffset + slot * rom.info.stride;
  const d = rom.data;
  const r = p.ratings.map((x) => Math.max(0, Math.min(15, x | 0)));
  d[o] = p.numberByte & 255;
  d[o + 1] = (r[0] << 4) | r[1];
  d[o + 2] = (r[2] << 4) | r[3];
  d[o + 3] = (r[4] << 4) | r[5];
  // CF96/97: the 5th byte of the record is left as it is (the exe doesn't touch it either).
}

/** Jersey number from a BCD byte; null when the byte isn't valid BCD (a few CF96 players). */
export function jerseyNumber(byte: number): number | null {
  const hi = byte >> 4, lo = byte & 15;
  return hi > 9 || lo > 9 ? null : hi * 10 + lo;
}
export const jerseyByte = (n: number) => {
  const v = Math.max(0, Math.min(99, Math.round(n)));
  return ((Math.floor(v / 10)) << 4) | (v % 10);
};

export function getRating(p: Player, slotDef: SlotDef, attr: Attr): number | undefined {
  const i = GROUP_ATTRS[slotDef.group].indexOf(attr);
  return i < 0 ? undefined : p.ratings[i];
}
export function setRating(p: Player, slotDef: SlotDef, attr: Attr, v: number): void {
  const i = GROUP_ATTRS[slotDef.group].indexOf(attr);
  if (i >= 0) p.ratings[i] = Math.max(0, Math.min(15, v | 0));
}

export const teamName = (t: RosterTeam) => `${t.school} ${t.nickname}`.trim();

// ---- Checksums ----
// All three games run EA's sum at boot: add up the ROM's longwords from 0 to a fixed end,
// minus the long at 0x18C, and compare with a stored constant. CFB-Walsh.exe disables that
// check (bne → nop); here the constant is recomputed and the check restored, then the Sega
// header checksum (0x18E) is recomputed.

interface EaCheck { end: number; constAt: number; bneAt: number }

function findBytes(d: Uint8Array, pat: (number | null)[], from = 0): number {
  outer: for (let i = from; i + pat.length <= d.length; i++) {
    for (let k = 0; k < pat.length; k++) if (pat[k] !== null && d[i + k] !== pat[k]) continue outer;
    return i;
  }
  return -1;
}

/** `bne.s *+4` (stock) or `nop` (patched by CFB-Walsh.exe). */
const bneOrNop = (d: Uint8Array, o: number) =>
  (d[o] === 0x66 && d[o + 1] === 0x02) || (d[o] === 0x4e && d[o + 1] === 0x71);

export function findEaChecksum(d: Uint8Array, game: Game): EaCheck | null {
  const _ = null;
  if (game === 'bw95') {
    // moveq #0,d0 ; suba.l a0,a0 ; move.l #count,d1 ; cmpa.w #$18c,a0 ; … ; cmpi.l #const,d0 ; bne ; rts
    const at = findBytes(d, [0x70, 0x00, 0x91, 0xc8, 0x22, 0x3c, _, _, _, _, 0xb0, 0xfc, 0x01, 0x8c], 0x100000);
    if (at < 0) return null;
    const cmp = findBytes(d, [0x0c, 0x80, _, _, _, _, _, _, 0x4e, 0x75], at);
    if (cmp < 0 || cmp - at > 0x40 || !bneOrNop(d, cmp + 6)) return null;
    return { end: u32(d, at + 6) * 4, constAt: cmp + 2, bneAt: cmp + 6 };
  }
  // CF96/97: sub.l ($018c).w,d0 ; cmp.l (d16,pc),d0 ; bne ; rts — count long right before the constant.
  const at = findBytes(d, [0x90, 0xb8, 0x01, 0x8c, 0xb0, 0xba, _, _, _, _, 0x4e, 0x75], 0x100000);
  if (at < 0 || !bneOrNop(d, at + 8)) return null;
  const disp = (u16(d, at + 6) << 16) >> 16;
  const constAt = at + 6 + disp;
  return { end: u32(d, constAt - 4) * 4, constAt, bneAt: at + 8 };
}

export interface ChecksumResult { ea: number | null; sega: number; restoredCheck: boolean }

export function fixChecksums(d: Uint8Array, game: Game): ChecksumResult {
  let restoredCheck = false;
  let ea: number | null = null;
  const c = findEaChecksum(d, game);
  if (c && c.end > 0x200 && c.end <= c.constAt && c.constAt + 4 <= d.length) {
    if (d[c.bneAt] === 0x4e && d[c.bneAt + 1] === 0x71) {
      d[c.bneAt] = 0x66; d[c.bneAt + 1] = 0x02; // undo CFB-Walsh.exe's "nop" patch
      restoredCheck = true;
    }
    let sum = 0;
    for (let o = 0; o < c.end; o += 4) if (o !== 0x18c) sum = (sum + u32(d, o)) >>> 0;
    ea = sum;
    w32(d, c.constAt, sum);
  }
  let sega = 0;
  for (let o = 0x200; o + 1 < d.length; o += 2) sega = (sega + u16(d, o)) & 0xffff;
  d[0x18e] = sega >> 8; d[0x18f] = sega & 255;
  return { ea, sega, restoredCheck };
}

/** True when EA's boot check would pass. */
export function eaChecksumOk(d: Uint8Array, game: Game): boolean {
  const c = findEaChecksum(d, game);
  if (!c) return false;
  let sum = 0;
  for (let o = 0; o < c.end; o += 4) if (o !== 0x18c) sum = (sum + u32(d, o)) >>> 0;
  return sum === u32(d, c.constAt);
}
