// The dynasty area of the 138-team 2026 Season Edition (Elevated v2.0.1-test9 on; claude.ai project notes:
// bw95-dynasty-spec.md, sections 4-5; the ROM side is the Elevated patch's dynasty.py).
//
// 0x3E0000-0x3FFFFF (all 0xFF until the app writes it), big-endian:
//   +0x00 ID block, 16 bytes: "DYN1", dynasty ID (long), season number (word, 1 = the first season),
//         roster version (word), export time (long, Unix seconds)
//   +0x10 format (word, 1)   +0x12 team count (word, 138)
//   +0x14 season roster set (long, ROM address): 138 × 32 × 4 bytes, the game's roster records
//   +0x18 season OVR table (long): "OVR1" + 138 × {OFF, DEF} bytes, like 0x218000
//   +0x1C season sim words (long): 138 × {offense, defense} words (0-100), like the ratings groups
//   +0x20 season names set (long, v2.0.1-test9 on; Team Rosters' names view): "NAM1", team count (word), 0
//         (word), a long per team = address of its 32 records in slot order: class byte (0 FR … 4 SR+,
//         0xFF none), first name, NUL, last name, NUL (the game's font: A-Z a-z 0-9 ' - . space)
//   +0x24 season fine-ratings offsets (long; 0xFFFFFFFF = none): "FRC1", then 138 × 32 × 3 bytes, six nibbles a
//         slot in the roster record's order, −8..+7, like the 2026 table at 0x2E0000 (fine.ts). Needs ROM support
//         (the snap and Team Rosters use no offsets for a dynasty roster up to v2.0.1-test14).
//   +0x28 season schedule (long; 0xFFFFFFFF = none, the first season): "SCH1", weeks (byte), then per week a
//         game count (byte) and visitor/home team bytes, like the real 2026 table (REALTAB). Needs ROM support:
//         New Season plays it instead of making a Random one or copying the real 2026 schedule.
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
export const DYNASTY_EDITION = "the 138-team 2026 Season Edition with dynasty support (Bill Walsh '95 Elevated v2.0.1-test9 or later)";

/** The sets' places (the patch's suggestion). */
const ROSTERS = DYN_AREA + 0x100;
const OVRS = ROSTERS + DYN_TEAMS * 128; // 0x3E4600
const SIMS = OVRS + 0x200; // 0x3E4800
const NAMES = DYN_AREA + 0x5000; // 0x3E5000
const FINE = 0x3fb000; // "FRC1" + 13,248 bytes
const SCHEDULE = 0x3ff000; // up to 4 KB (12 weeks of 69 games: 1,673 bytes)

const u32 = (d: Uint8Array, a: number) => ((d[a] << 24) >>> 0) + (d[a + 1] << 16) + (d[a + 2] << 8) + d[a + 3];
const u16 = (d: Uint8Array, a: number) => (d[a] << 8) | d[a + 1];
const put32 = (d: Uint8Array, a: number, v: number) => { d[a] = v >>> 24; d[a + 1] = (v >>> 16) & 255; d[a + 2] = (v >>> 8) & 255; d[a + 3] = v & 255; };
const put16 = (d: Uint8Array, a: number, v: number) => { d[a] = (v >> 8) & 255; d[a + 1] = v & 255; };

/**
 * Whether the ROM has what a dynasty needs (v2.0.1-test9 on, user 2026-11-12): the Season-mode hooks that
 * read the dynasty area (the mark at 0x2B0000) and Team Rosters' names view (its 2026 names table "NAM1"
 * at 0x2C0000 and its row hook at 0x06AFC0).
 */
export const hasDynastyHooks = (d: Uint8Array) =>
  d.length >= DYN_END && MARK.every((b, k) => d[DYN_MARK + k] === b) && d[DYN_MARK + 7] >= 1 && d[DYN_MARK + 7] !== 0xff &&
  [0x4e, 0x41, 0x4d, 0x31].every((b, k) => d[0x2c0000 + k] === b) && d[0x06afc0] === 0x4e && d[0x06afc1] === 0xb9;

/** The fine-ratings offsets table's address in a written dynasty area (after its "FRC1"), or null (none). */
export function fineAddress(d: Uint8Array): number | null {
  if (!dynastyHeaderValid(d)) return null;
  const a = u32(d, DYN_AREA + 0x24);
  return a >= DYN_AREA && a < DYN_END && d[a] === 0x46 && d[a + 1] === 0x52 && d[a + 2] === 0x43 && d[a + 3] === 0x31 ? a + 4 : null;
}

/** The schedule set's address in a written dynasty area, or null (none). */
export function scheduleAddress(d: Uint8Array): number | null {
  if (!dynastyHeaderValid(d)) return null;
  const a = u32(d, DYN_AREA + 0x28);
  return a >= DYN_AREA && a < DYN_END && d[a] === 0x53 && d[a + 1] === 0x43 && d[a + 2] === 0x48 && d[a + 3] === 0x31 ? a : null;
}

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

export interface DynastyName { cls: number; first: string; last: string }

/** A name in the game's font: accents dropped, other characters out; last names at most 23 (the screen's room). */
export function gameText(s: string, max: number): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9'. -]/g, '').trim().slice(0, max).trim();
}

/** The names set ("NAM1") for writing at `base`. */
export function namesSet(names: (DynastyName | null)[][], base: number): Uint8Array {
  const body: number[] = [];
  const ptrs: number[] = [];
  const head = 8 + 4 * names.length;
  for (const team of names) {
    ptrs.push(base + head + body.length);
    for (let slot = 0; slot < 32; slot++) {
      const n = team[slot];
      if (!n) { body.push(0xff, 0, 0); continue; }
      body.push(n.cls & 0xff);
      for (const c of gameText(n.first, 23)) body.push(c.charCodeAt(0));
      body.push(0);
      for (const c of gameText(n.last, 23)) body.push(c.charCodeAt(0));
      body.push(0);
    }
  }
  const out = new Uint8Array(head + body.length);
  out.set([0x4e, 0x41, 0x4d, 0x31], 0); // NAM1
  put16(out, 4, names.length);
  ptrs.forEach((a, t) => put32(out, 8 + 4 * t, a));
  out.set(body, head);
  return out;
}

export interface DynastyAreaData {
  stamp: DynastyStamp;
  /** Per team and slot, the player's class and name for Team Rosters (null = none). */
  names: (DynastyName | null)[][];
  /** Per team, the 32 roster records (4 bytes each, slot order). */
  records: Uint8Array[];
  ovr: { off: number; def: number }[];
  /** The season's fine-ratings offsets (fine.ts: 138 × 32 × 3 bytes). */
  fine?: Uint8Array;
  /** The season's schedule set (schedule.ts `scheduleSet`), from the second season. */
  schedule?: Uint8Array;
}

/** Writes the dynasty area (in place); check dynastyAreaProblem first. */
export function writeDynastyArea(d: Uint8Array, data: DynastyAreaData): void {
  const problem = dynastyAreaProblem(d);
  if (problem) throw new Error(problem);
  const names = namesSet(data.names, NAMES);
  if (NAMES + names.length > FINE) throw new Error('The names don\'t fit in the dynasty area.');
  if (data.schedule && data.schedule.length > DYN_END - SCHEDULE) throw new Error('The schedule doesn\'t fit in the dynasty area.');
  d.fill(0xff, DYN_AREA, DYN_END);
  d.set(names, NAMES);
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
  put32(d, DYN_AREA + 0x20, NAMES);
  if (data.fine) {
    if (data.fine.length !== DYN_TEAMS * 96) throw new Error('The fine-ratings offsets have the wrong size.');
    d.set([0x46, 0x52, 0x43, 0x31], FINE);
    d.set(data.fine, FINE + 4);
    put32(d, DYN_AREA + 0x24, FINE);
  }
  if (data.schedule) {
    d.set(data.schedule, SCHEDULE);
    put32(d, DYN_AREA + 0x28, SCHEDULE);
  }
  // The ID block last.
  const s = data.stamp;
  put32(d, DYN_AREA + 4, s.dynasty);
  put16(d, DYN_AREA + 8, s.season);
  put16(d, DYN_AREA + 10, s.rosterVersion);
  put32(d, DYN_AREA + 12, s.time);
  d.set(MAGIC, DYN_AREA);
}
