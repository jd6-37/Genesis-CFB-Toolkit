// The dynasty area of the 138-team 2026 Season Edition (Elevated v2.0.1-test8 on; claude.ai project notes:
// bw95-dynasty-spec.md, sections 4-5; the ROM side is the Elevated patch's dynasty.py).
//
// 0x3E0000-0x3FFFFF (all 0xFF until the app writes it), big-endian:
//   +0x00 ID block, 16 bytes: "DYN1", dynasty ID (long), season number (word, 1 = the first season),
//         roster version (word), export time (long, Unix seconds)
//   +0x10 format (word, 1)   +0x12 team count (word, 138)
//   +0x14 season roster set (long, ROM address): 138 × 32 × 4 bytes, the game's roster records
//   +0x18 season OVR table (long): "OVR1" + 138 × {OFF, DEF} bytes, like 0x218000
//   +0x1C season sim words (long): 138 × {offense, defense} words (0-100), like the ratings groups
// Season mode reads the sets when +0 is "DYN1" and the long at +0x10 is 0x0001008A; Exhibition keeps
// the 2026 data. New Season copies the ID block into the save (the season block's +0x1330), so an
// imported save says which dynasty and season it belongs to.

import { simFromOvr } from '../teamRatings';

export const DYN_AREA = 0x3e0000;
export const DYN_END = 0x400000;
/** Where the hooks mark is: "BW95DYN" + a version byte (1 on). */
export const DYN_MARK = 0x2b0000;
const MARK = [0x42, 0x57, 0x39, 0x35, 0x44, 0x59, 0x4e]; // BW95DYN
const MAGIC = [0x44, 0x59, 0x4e, 0x31]; // DYN1
const FORMAT = 0x0001008a; // format 1, 138 teams
export const DYN_TEAMS = 138;
/** What a dynasty needs (no older ROMs or saves until the first public release, user 2026-11-12). */
export const DYNASTY_EDITION = "the 138-team 2026 Season Edition with dynasty support (Bill Walsh '95 Elevated v2.0.1-test8 or later)";

/** The sets' places (the patch's suggestion). */
const ROSTERS = DYN_AREA + 0x100;
const OVRS = ROSTERS + DYN_TEAMS * 128; // 0x3E4600
const SIMS = OVRS + 0x200; // 0x3E4800
const USED_END = SIMS + 4 * DYN_TEAMS;

const u32 = (d: Uint8Array, a: number) => ((d[a] << 24) >>> 0) + (d[a + 1] << 16) + (d[a + 2] << 8) + d[a + 3];
const u16 = (d: Uint8Array, a: number) => (d[a] << 8) | d[a + 1];
const put32 = (d: Uint8Array, a: number, v: number) => { d[a] = v >>> 24; d[a + 1] = (v >>> 16) & 255; d[a + 2] = (v >>> 8) & 255; d[a + 3] = v & 255; };
const put16 = (d: Uint8Array, a: number, v: number) => { d[a] = (v >> 8) & 255; d[a + 1] = v & 255; };

/** Whether the ROM has the Season-mode hooks that read the dynasty area. */
export const hasDynastyHooks = (d: Uint8Array) =>
  d.length >= DYN_END && MARK.every((b, k) => d[DYN_MARK + k] === b) && d[DYN_MARK + 7] >= 1 && d[DYN_MARK + 7] !== 0xff;

/** Whether the area holds a header the game accepts. */
export const dynastyHeaderValid = (d: Uint8Array) => MAGIC.every((b, k) => d[DYN_AREA + k] === b) && u32(d, DYN_AREA + 0x10) === FORMAT;

/** Why the dynasty area can't be written, or null: it must be free (all 0xFF) or hold a dynasty header. */
export function dynastyAreaProblem(d: Uint8Array): string | null {
  if (!hasDynastyHooks(d)) return `This ROM doesn't have the dynasty support: the dynasty needs ${DYNASTY_EDITION}.`;
  if (dynastyHeaderValid(d)) return null;
  for (let a = DYN_AREA; a < DYN_END; a++) if (d[a] !== 0xff) return `The dynasty area (0x3E0000) isn't free: something else is at 0x${a.toString(16).toUpperCase()}.`;
  return null;
}

/** A dynasty's 32-bit ID in the ROM and saves (FNV-1a of its app ID; never 0). */
export function dynastyRomId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return h || 1;
}

export interface DynastyStamp { dynasty: number; season: number; rosterVersion: number; time: number }

/** Reads an ID block (the area's first 16 bytes, or a save's stamp); null when it isn't one. */
export function readStamp(b: Uint8Array | null): DynastyStamp | null {
  if (!b || b.length < 16 || !MAGIC.every((x, k) => b[k] === x)) return null;
  return { dynasty: u32(b, 4), season: u16(b, 8), rosterVersion: u16(b, 10), time: u32(b, 12) };
}

export interface DynastyAreaData {
  stamp: DynastyStamp;
  /** Per team, the 32 roster records (4 bytes each, slot order). */
  records: Uint8Array[];
  ovr: { off: number; def: number }[];
}

/** Writes the dynasty area (in place); check dynastyAreaProblem first. */
export function writeDynastyArea(d: Uint8Array, data: DynastyAreaData): void {
  const problem = dynastyAreaProblem(d);
  if (problem) throw new Error(problem);
  d.fill(0xff, DYN_AREA, USED_END);
  for (let t = 0; t < DYN_TEAMS; t++) d.set(data.records[t].subarray(0, 128), ROSTERS + 128 * t);
  d.set([0x4f, 0x56, 0x52, 0x31], OVRS); // OVR1
  for (let t = 0; t < DYN_TEAMS; t++) {
    const off = Math.max(0, Math.min(99, Math.round(data.ovr[t].off)));
    const def = Math.max(0, Math.min(99, Math.round(data.ovr[t].def)));
    d[OVRS + 4 + 2 * t] = off;
    d[OVRS + 5 + 2 * t] = def;
    put16(d, SIMS + 4 * t, simFromOvr(off));
    put16(d, SIMS + 4 * t + 2, simFromOvr(def));
  }
  put32(d, DYN_AREA + 0x10, FORMAT);
  put32(d, DYN_AREA + 0x14, ROSTERS);
  put32(d, DYN_AREA + 0x18, OVRS);
  put32(d, DYN_AREA + 0x1c, SIMS);
  // The ID block last.
  const s = data.stamp;
  put32(d, DYN_AREA + 4, s.dynasty);
  put16(d, DYN_AREA + 8, s.season);
  put16(d, DYN_AREA + 10, s.rosterVersion);
  put32(d, DYN_AREA + 12, s.time);
  d.set(MAGIC, DYN_AREA);
}
