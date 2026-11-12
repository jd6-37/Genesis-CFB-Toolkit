// Reads a battery save of the 138-team 2026 Season Edition (Elevated v2.0.0 on). Pure functions, no DOM.
//
// The game keeps its save in the odd bytes of the cartridge window at 0x200000. Genesis Plus GX (RetroArch)
// writes the window as it is (file offset k = address 0x200000 + k, data on odd offsets); other tools may
// write only the data bytes. Layout (claude.ai project notes: bw95-dynasty-spec.md, section 3):
//   $200001 signature 0x6F, $200003 0 once a season exists, $200E01 season block (0x1330 data bytes),
//   $203951 team season stats (138 × 0xB8 data bytes).

export const SAVE_SIG = 0x6f;
const SB_ADDR = 0xe01; // address − 0x200000
const ST_ADDR = 0x3951;
const SB_LEN = 0x1330;
const ST_LEN = 0xb8;
const SB_SIG = 0x5a;

/** A data byte of the save by its window offset (address − 0x200000). */
type Peek = (offset: number) => number;

export type SaveFormat = 'window' | 'packed';

/** Detects the layout and returns a reader of data bytes, or why it isn't a save of this game. */
export function openSave(file: Uint8Array): { format: SaveFormat; peek: Peek } {
  // Genesis Plus GX: the whole window, data on odd offsets (32-64 KB).
  if (file.length >= 2 * (ST_ADDR >> 1) + 2 * 138 * ST_LEN && file[1] === SAVE_SIG) {
    return { format: 'window', peek: (o) => file[o] ?? 0xff };
  }
  // Only the data bytes: offset k holds window offset 2k + 1.
  if (file.length >= (ST_ADDR >> 1) + 138 * ST_LEN && file[0] === SAVE_SIG) {
    return { format: 'packed', peek: (o) => file[o >> 1] ?? 0xff };
  }
  throw new Error("This isn't a battery save of Bill Walsh '95 Elevated's 138-team 2026 Season Edition (no save signature found).");
}

function bytes(peek: Peek, addr: number, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = peek(addr + 2 * i);
  return out;
}

const word = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const sword = (b: Uint8Array, i: number) => ((word(b, i) << 16) >> 16);
const sbyte = (b: Uint8Array, i: number) => ((b[i] << 24) >> 24);

export interface SaveGame {
  /** Index in the season's game list. */
  index: number;
  /** Week index (0-based; with the Real 2026 schedule week 0 is "Week #0"). */
  week: number;
  visitor: number | null;
  home: number | null;
  /** Scores once played. */
  vs: number | null;
  hs: number | null;
  /** Unplayed and set to HOLD (a user's game). */
  hold: boolean;
}

export interface SaveSeason {
  /** Number of weeks, regular season and postseason. */
  weeks: number;
  /** Index of the last regular-season week. */
  lastRegularWeek: number;
  postseason: boolean;
  realSchedule: boolean;
  cfp24: boolean;
  flags: number;
  /** First game index of each week, and one past the last game. */
  weekStart: number[];
  games: SaveGame[];
  /** Power rating per team (the game's rankings come from these). */
  power: number[];
  /** Rank per team as of the end of last week (0 = none yet). */
  lastRanks: number[];
  /** CFP seeds (team numbers, seed 1 first), once set. */
  seeds: number[];
  userTeams: number[];
}

export interface PassingStats { att: number; comp: number; yds: number; int: number; td: number }
export interface RushingStats { att: number; yds: number; long: number; short: number; fum: number; td: number }
export interface ReceivingStats { rec: number; yds: number; long: number; drops: number; fum: number; td: number }
export interface KickingStats { fga: number; fgm: number; long: number; blocked: number; xpa: number; xpm: number }
export interface PuntingStats { punts: number; yds: number; long: number; in10: number }
export interface DefenseStats { tkl: number; sacks: number; int: number }

/** One team's season stats, by roster slot (the game keeps season totals per slot, not per game). */
export interface TeamSaveStats {
  passing: { slot: number; s: PassingStats }[];
  rushing: { slot: number; s: RushingStats }[];
  receiving: { slot: number; s: ReceivingStats }[];
  kicking: { slot: number; s: KickingStats }[];
  punting: { slot: number; s: PuntingStats }[];
  defense: { slot: number; s: DefenseStats }[];
}

/** Which slots each category records (the game's Season Stats table at 0x0DFB08). */
export const STAT_SLOTS = {
  passing: [0],
  rushing: [0, 1, 2, 3],
  receiving: [1, 2, 3, 9, 10, 11, 12, 13, 14],
  kicking: [15],
  punting: [31],
  defense: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
} as const;

export interface DynastySave {
  format: SaveFormat;
  /** False before the first New Season (or after the save was cleared). */
  hasSeason: boolean;
  season: SaveSeason | null;
  stats: TeamSaveStats[];
  /** The season's stamp (dynasty ID block), when the ROM wrote one (Elevated, later). */
  stamp: Uint8Array | null;
}

export const TEAMS = 138;

/** Parses a save. Throws with a reason when it isn't one. */
export function readDynastySave(file: Uint8Array): DynastySave {
  const { format, peek } = openSave(file);
  const sb = bytes(peek, SB_ADDR, SB_LEN + 16);
  const hasSeason = peek(3) === 0 && sb[0] === SB_SIG;
  let season: SaveSeason | null = null;
  if (hasSeason) {
    const weeks = sb[2];
    const lastRegularWeek = sb[1];
    const count = word(sb, 6);
    if (!weeks || weeks > 24 || count > 1100) throw new Error("The save's season block isn't laid out as expected.");
    const weekStart = Array.from({ length: weeks + 1 }, (_, i) => word(sb, 8 + 2 * i));
    const games: SaveGame[] = [];
    for (let w = 0; w < weeks; w++) {
      for (let i = weekStart[w]; i < weekStart[w + 1]; i++) {
        const a = 0x200 + 4 * i;
        const [vs, v, hs, h] = [sb[a], sb[a + 1], sb[a + 2], sb[a + 3]];
        const played = vs <= 0xfc;
        games.push({
          index: i,
          week: w,
          visitor: v < TEAMS ? v : null,
          home: h < TEAMS ? h : null,
          vs: played ? vs : null,
          hs: played ? hs : null,
          hold: vs === 0xfe,
        });
      }
    }
    const flags = sb[3];
    const seeds: number[] = [];
    for (let i = 0; i < 24 && sb[0x34 + i] < TEAMS && sb[0x34 + i] !== 0xff; i++) seeds.push(sb[0x34 + i]);
    season = {
      weeks,
      lastRegularWeek,
      postseason: (flags & 1) !== 0,
      realSchedule: (flags & 2) !== 0,
      cfp24: (flags & 4) !== 0,
      flags,
      weekStart,
      games,
      power: Array.from({ length: TEAMS }, (_, t) => sword(sb, 0x50 + 2 * t)),
      lastRanks: Array.from(sb.subarray(0x164, 0x164 + TEAMS)),
      // A season without a set field has zeros there; a field always has more than one team.
      seeds: seeds.length > 1 && new Set(seeds).size === seeds.length ? seeds : [],
      userTeams: Array.from({ length: TEAMS }, (_, t) => t).filter((t) => (sb[0x1ee + (t >> 3)] >> (t & 7)) & 1),
    };
  }
  const stamp = sb.subarray(SB_LEN, SB_LEN + 16);
  const stats = Array.from({ length: TEAMS }, (_, t) => teamStats(bytes(peek, ST_ADDR + 2 * ST_LEN * t, ST_LEN)));
  return {
    format,
    hasSeason,
    season,
    stats,
    stamp: stamp[0] === 0x44 && stamp[1] === 0x59 ? new Uint8Array(stamp) : null, // "DY…"
  };
}

function teamStats(b: Uint8Array): TeamSaveStats {
  // Bytes still 0xFF mean the stats were never cleared (no season played since the save was made).
  const blank = b.every((x) => x === 0xff);
  const z = (n: number) => (blank ? 0 : n);
  return {
    passing: STAT_SLOTS.passing.map((slot) => ({
      slot,
      s: { att: z(word(b, 0)), comp: z(word(b, 2)), yds: z(sword(b, 4)), int: z(b[6]), td: z(b[7]) },
    })),
    rushing: STAT_SLOTS.rushing.map((slot, k) => {
      const o = 8 + 8 * k;
      return { slot, s: { att: z(word(b, o)), yds: z(sword(b, o + 2)), long: z(sbyte(b, o + 4)), short: z(sbyte(b, o + 5)), fum: z(b[o + 6]), td: z(b[o + 7]) } };
    }),
    receiving: STAT_SLOTS.receiving.map((slot, k) => {
      const o = 40 + 8 * k;
      return { slot, s: { rec: z(word(b, o)), yds: z(sword(b, o + 2)), long: z(sbyte(b, o + 4)), drops: z(b[o + 5]), fum: z(b[o + 6]), td: z(b[o + 7]) } };
    }),
    kicking: [{ slot: 15, s: { fga: z(b[112]), fgm: z(b[113]), long: z(b[114]), blocked: z(b[115]), xpa: z(b[116]), xpm: z(b[117]) } }],
    punting: [{ slot: 31, s: { punts: z(word(b, 118)), yds: z(sword(b, 120)), long: z(b[122]), in10: z(b[123]) } }],
    defense: STAT_SLOTS.defense.map((slot, k) => {
      const o = 124 + 4 * k;
      return { slot, s: { tkl: z(word(b, o)), sacks: z(b[o + 2]), int: z(b[o + 3]) } };
    }),
  };
}

/** Teams in rank order and each team's rank, as the game ranks them (by power; ties keep team order). */
export function ranksFromPower(power: number[]): { order: number[]; rank: number[] } {
  const order: number[] = [];
  for (let t = 0; t < power.length; t++) {
    let k = order.length;
    while (k > 0 && power[order[k - 1]] < power[t]) k--;
    order.splice(k, 0, t);
  }
  const rank = new Array<number>(power.length);
  order.forEach((t, i) => (rank[t] = i + 1));
  return { order, rank };
}
