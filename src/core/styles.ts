// BW95 team styles: which CPU offense and defense each team runs. Pure functions, no DOM: used by
// the Team Swap build, the Teams tab, the Rosters tab and the Node CLI.
//
// The game keeps 8 team sets in one bit table (team t is in set s when bit t & 7 of byte
// TABLE + 8·s + (t >> 3) is set). The CPU's play-calling rules test them:
// - offense: sets 0-3 (Option, Pro Style, Multiple, Shotgun); a team in none of them runs Power;
// - defense: sets 5-7 (3-4, 4-3, Multiple).
// Set 4 holds only Notre Dame and no rule tests it, so it's left alone. Every edit is in place
// (no free space used). Details: docs/styles.md.
// The 138-team 2026 Season Edition keeps the same 8 sets in its own table, 32 bytes per set (WIDE.styles);
// its set lookup at 0x079A82 reads them from there.

import { rw } from './bytes';
import { isWideBw95 } from './romfile';
import { BW95_DEFENSE_BITS } from './rosterLayouts';
import { hasElevatedLayout } from './rosterRom';
import { isWide, teamsOf, WIDE } from './wide';

export const TEAMS = 36;
/** The CPU rule table; its 8th word is the offset of the team set table. */
export const RULE_TABLE = 0x06106e;
export const STYLE_TABLE = 0x062d87;
export const STYLE_TABLE_SIZE = 64;
/** Bill Walsh '95 Elevated v1.1.0-beta.6 and later jump from here to their own offense lists, which
 *  give the Option and Power styles the Veer plays. The original code is `ext.w d0 ; lea $6106E,a0`. */
const OFFTAB_PICK = 0x079aae;

export const OFFENSE = ['Option', 'Pro Style', 'Multiple', 'Shotgun', 'Power'] as const;
export const DEFENSE = ['3-4', '4-3', 'Multiple'] as const;
export const POWER = 4;

export interface TeamStyle {
  offense: number; // 0-4, index in OFFENSE
  defense: number; // 0-2, index in DEFENSE
}

/** What the ROM's styles do: the CPU's calls differ between the original game and Elevated builds. */
export interface StyleInfo {
  /** Elevated beta.6+: the Option and Power styles also call the Veer plays. */
  veer: boolean;
  /** Elevated beta.7+: reworked CPU defense and one roster layout for every team. */
  elevated: boolean;
}

export function styleInfo(d: Uint8Array): StyleInfo {
  return { veer: d[OFFTAB_PICK] === 0x4e && d[OFFTAB_PICK + 1] === 0xf9, elevated: hasElevatedLayout(d) };
}

/** Formations each offense style calls, for hints. */
export function offenseFormations(style: number, info: StyleInfo): string {
  const veer = info.veer ? ', Veer' : '';
  return [
    `Wishbone, Flexbone${veer}, Goal Line`,
    'I-Form, Pro Form, Near, Far, Goal Line',
    'Trap, I-Form, Pro Form, Shotgun, Near, Far, Goal Line',
    'I-Form, Pro Form, Shotgun, Near, Far, Goal Line',
    `Trap, I-Form, Tee${veer}, Pro Form, Near, Far`,
  ][style];
}

/** What each defense style calls, for hints. */
export function defensePlan(style: number, info: StyleInfo): string {
  if (info.elevated) {
    return [
      '3-4 on early downs with some 4-4 against the run, Nickel on 3rd down, Dime on 3rd and long',
      '4-3 on early downs with some 4-4 against the run, Nickel on 3rd down, Dime on 3rd and long',
      '3-4 and 4-3 half and half on early downs, 4-4 on 3rd and 4th and 3, Nickel on 3rd down',
    ][style];
  }
  return [
    '3-4 on early downs, Nickel on 3rd down',
    '4-3 on early downs, Nickel on 3rd down',
    '3-4 on early downs, 4-4 on 3rd down',
  ][style];
}

/** Where a ROM keeps its team sets: the address, the bytes per set and the team count. */
export function styleTable(d: Uint8Array): { at: number; set: number; teams: number } {
  return isWide(d) ? { at: WIDE.styles, set: WIDE.styleSet, teams: teamsOf(d) } : { at: STYLE_TABLE, set: 8, teams: TEAMS };
}

const bit = (d: Uint8Array, set: number, t: number) => {
  const tb = styleTable(d);
  return (d[tb.at + tb.set * set + (t >> 3)] >> (t & 7)) & 1;
};
function put(d: Uint8Array, set: number, t: number, on: boolean) {
  const tb = styleTable(d);
  const a = tb.at + tb.set * set + (t >> 3);
  d[a] = on ? d[a] | (1 << (t & 7)) : d[a] & ~(1 << (t & 7));
}

/** The 138-team edition's set lookup: `asl.w #5,d2 ; lea $218200.l,a0` (the original has `asl.w #3,d2 ;
 *  lea $6106E.l,a0 ; adda.w 14(a0),a0`) at 0x079A82. */
const WIDE_LOOKUP = 0x079a82;
const WIDE_LOOKUP_CODE = [0xeb, 0x42, 0x41, 0xf9, 0x00, 0x21, 0x82, 0x00];

/** Why this ROM's styles can't be read or changed. Empty if they can. */
export function styleProblems(d: Uint8Array): string[] {
  if (d.length < 0x100000) return ['this is not a Bill Walsh College Football 95 ROM'];
  if (isWideBw95(d)) {
    if (!isWide(d)) return ["this ROM's team tables aren't where the 138-team 2026 Season Edition has them"];
    if (WIDE_LOOKUP_CODE.some((b, k) => d[WIDE_LOOKUP + k] !== b)) return ["the CPU's team table isn't where the 138-team edition has it"];
  } else if (RULE_TABLE + rw(d, RULE_TABLE + 14) !== STYLE_TABLE) return ["the CPU's team table isn't where the original game has it"];
  const tb = styleTable(d);
  for (let s = 0; s < 8; s++) {
    // Bits past the last team are never used: anything there means the table isn't what it seems.
    for (let t = tb.teams; t < tb.set * 8; t++) {
      if ((d[tb.at + tb.set * s + (t >> 3)] >> (t & 7)) & 1) return ["the CPU's team table has been changed in a way this tool doesn't know"];
    }
  }
  return [];
}

/** The style the game uses for a team: the first offense set it's in (rule order), else Power;
 *  for defense set 5 before 6 (rule order), else Multiple. */
export function readStyle(d: Uint8Array, t: number): TeamStyle {
  let offense = POWER;
  for (let s = 0; s < 4; s++) {
    if (bit(d, s, t)) {
      offense = s;
      break;
    }
  }
  const defense = bit(d, 5, t) ? 0 : bit(d, 6, t) ? 1 : 2;
  return { offense, defense };
}

export const readStyles = (d: Uint8Array): TeamStyle[] => Array.from({ length: styleTable(d).teams }, (_, t) => readStyle(d, t));

/** True when the ROM's 3-4 roster flag says 3-4 for this team (only the original layout uses it). */
export const rosterIs34 = (d: Uint8Array, t: number) => ((d[BW95_DEFENSE_BITS + (t >> 3)] >> (t & 7)) & 1) === 0;

/**
 * Sets a team's styles in place: the team goes in exactly one offense set (none for Power) and
 * exactly one defense set. On ROMs with the original roster layout, the 3-4 roster flag follows the
 * defense (3-4 = clear), as in the original game, so the roster screen and the Rosters import put
 * the right players in slot 21 (a defensive tackle in the 4-3, an inside linebacker in the 3-4).
 * Returns true when that flag changed. Checksums aren't fixed here.
 */
export function writeStyle(d: Uint8Array, t: number, st: TeamStyle): boolean {
  const p = styleProblems(d);
  if (p.length) throw new Error(`Styles can't be changed in this ROM: ${p.join('; ')}.`);
  if (!(t >= 0 && t < styleTable(d).teams)) throw new Error(`bad team ${t}`);
  if (!(st.offense >= 0 && st.offense <= POWER) || !(st.defense >= 0 && st.defense <= 2)) throw new Error('bad style');
  for (let s = 0; s < 4; s++) put(d, s, t, s === st.offense);
  for (let s = 0; s < 3; s++) put(d, 5 + s, t, s === st.defense);
  if (isWide(d) || hasElevatedLayout(d)) return false;
  const want34 = st.defense === 0;
  if (rosterIs34(d, t) === want34) return false;
  const a = BW95_DEFENSE_BITS + (t >> 3);
  d[a] = want34 ? d[a] & ~(1 << (t & 7)) : d[a] | (1 << (t & 7));
  return true;
}

/** Puts a team's bits back as they are in `base` (all eight sets and the 3-4 roster flag). */
export function restoreStyle(d: Uint8Array, base: Uint8Array, t: number): void {
  const m = 1 << (t & 7);
  const tb = styleTable(d);
  for (let s = 0; s < 8; s++) {
    const a = tb.at + tb.set * s + (t >> 3);
    d[a] = (d[a] & ~m) | (base[a] & m);
  }
  if (isWide(d)) return;
  const a = BW95_DEFENSE_BITS + (t >> 3);
  d[a] = (d[a] & ~m) | (base[a] & m);
}

/** Teams whose style differs between two ROMs. */
export function styleChanges(a: Uint8Array, b: Uint8Array): number[] {
  const out: number[] = [];
  for (let t = 0; t < Math.min(styleTable(a).teams, styleTable(b).teams); t++) {
    const x = readStyle(a, t);
    const y = readStyle(b, t);
    if (x.offense !== y.offense || x.defense !== y.defense) out.push(t);
  }
  return out;
}

/** The bytes a style edit can change in the 36-team game, as [start, end) ranges. */
export const STYLE_RANGES: [number, number][] = [
  [STYLE_TABLE, STYLE_TABLE + STYLE_TABLE_SIZE],
  [BW95_DEFENSE_BITS, BW95_DEFENSE_BITS + 5],
];

/** The bytes a style edit can change in this ROM. */
export const styleRanges = (d: Uint8Array): [number, number][] =>
  isWide(d) ? [[WIDE.styles, WIDE.styles + 8 * WIDE.styleSet]] : STYLE_RANGES;

/** Parses "Pro Style" or "4-3" (any case, also the style number) for the CLI and swap files. */
export function parseStyle(kind: 'offense' | 'defense', v: string | number): number {
  const names: readonly string[] = kind === 'offense' ? OFFENSE : DEFENSE;
  if (typeof v === 'number') {
    if (Number.isInteger(v) && v >= 0 && v < names.length) return v;
  } else {
    const k = names.findIndex((n) => n.toLowerCase() === v.trim().toLowerCase());
    if (k >= 0) return k;
  }
  throw new Error(`unknown ${kind} style "${v}" (${names.join(', ')})`);
}
