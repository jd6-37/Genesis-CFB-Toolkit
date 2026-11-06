// Roster layouts for Bill Walsh College Football '95 and College Football USA 96/97.
// Derived from CFB-Walsh.exe ("Genesis College Football Editor v2.0") and checked against
// the ROMs (team tables, BW95's own label lists at 0x62DC8 / 0x62E6E, CF97 rating patterns).

export type Game = 'bw95' | 'cf96' | 'cf97';
export type Group = 'QB' | 'RB' | 'OL' | 'REC' | 'KP' | 'DL' | 'LB' | 'DB';
export type Attr =
  | 'Weight' | 'Quickness' | 'Speed' | 'Awareness' | 'Range'
  | 'Power' | 'Hands' | 'Blocking' | 'Accuracy' | 'Tackling';

/** Nibble order of the six ratings in a player record (after the jersey number byte). */
export const GROUP_ATTRS: Record<Group, Attr[]> = {
  QB: ['Weight', 'Quickness', 'Speed', 'Awareness', 'Range', 'Power'],
  RB: ['Weight', 'Quickness', 'Speed', 'Awareness', 'Hands', 'Power'],
  OL: ['Weight', 'Power', 'Speed', 'Awareness', 'Hands', 'Blocking'],
  REC: ['Weight', 'Quickness', 'Speed', 'Awareness', 'Hands', 'Power'],
  KP: ['Weight', 'Quickness', 'Speed', 'Awareness', 'Range', 'Accuracy'],
  DL: ['Weight', 'Power', 'Speed', 'Awareness', 'Hands', 'Tackling'],
  LB: ['Weight', 'Quickness', 'Speed', 'Awareness', 'Hands', 'Tackling'],
  DB: ['Weight', 'Quickness', 'Speed', 'Awareness', 'Hands', 'Tackling'],
};

/** Column order in the editor grid (same as the exe: Weight, Speed, then the rest). */
export const GROUP_COLUMNS: Record<Group, Attr[]> = {
  QB: ['Weight', 'Speed', 'Quickness', 'Awareness', 'Range', 'Power'],
  RB: ['Weight', 'Speed', 'Quickness', 'Awareness', 'Hands', 'Power'],
  OL: ['Weight', 'Speed', 'Power', 'Awareness', 'Hands', 'Blocking'],
  REC: ['Weight', 'Speed', 'Quickness', 'Awareness', 'Hands', 'Power'],
  KP: ['Weight', 'Speed', 'Quickness', 'Awareness', 'Range', 'Accuracy'],
  DL: ['Weight', 'Speed', 'Power', 'Awareness', 'Hands', 'Tackling'],
  LB: ['Weight', 'Speed', 'Quickness', 'Awareness', 'Hands', 'Tackling'],
  DB: ['Weight', 'Speed', 'Quickness', 'Awareness', 'Hands', 'Tackling'],
};

export const GROUP_TITLES: Record<Group, string> = {
  QB: 'Quarterbacks', RB: 'Running backs', OL: 'Offensive line', REC: 'Receivers',
  KP: 'Kickers & punters', DL: 'Defensive line', LB: 'Linebackers', DB: 'Defensive backs',
};

/** Spreadsheet column for each rating (the exe's names). Range and Accuracy depend on the group. */
export function sheetColumn(group: Group, attr: Attr): string {
  switch (attr) {
    case 'Hands': return 'Catching';
    case 'Range': return group === 'QB' ? 'Throw Power' : 'Kick Power';
    case 'Accuracy': return 'Kick Accuracy';
    default: return attr;
  }
}

/** Every spreadsheet column the importer reads (plus Team, Position, Overall Rating, Slot). */
export const SHEET_COLUMNS = [
  'Jersey Number', 'Weight', 'Speed', 'Quickness', 'Awareness', 'Power', 'Catching',
  'Blocking', 'Tackling', 'Throw Power', 'Kick Power', 'Kick Accuracy',
] as const;

export interface SlotDef {
  /** Index of the player record in the team's roster. */
  slot: number;
  /** Label shown in the editor (the exe's labels). */
  label: string;
  /** Rating group (decides the meaning of the six nibbles). */
  group: Group;
  /** Spreadsheet positions this slot is filled from, best player first. */
  pool: string[];
  /** Filled after all primary slots, with the best player of the pool not used yet. */
  leftover?: boolean;
}

export interface GameInfo {
  game: Game;
  title: string;
  /** First 16 bytes of the ROM (stack pointer + entry point), as the exe identifies the game. */
  signature: string;
  teamTable: number;
  teamCount: number;
  /** Header word that points at the name strings (school, city or stadium, nickname). */
  namesHeader: number;
  /** Players per roster and bytes per player record. */
  players: number;
  stride: number;
}

export const GAMES: Record<Game, GameInfo> = {
  bw95: {
    game: 'bw95', title: "Bill Walsh College Football '95",
    signature: '00FFFFF6000002000007A31A0007A31A',
    teamTable: 0x0028dc, teamCount: 36, namesHeader: 2, players: 32, stride: 4,
  },
  cf96: {
    game: 'cf96', title: "College Football USA '96",
    signature: '00FFFFF6000002000006209E0006209E',
    teamTable: 0x002cea, teamCount: 108, namesHeader: 1, players: 45, stride: 5,
  },
  cf97: {
    game: 'cf97', title: "College Football USA '97",
    signature: '00FFFFF60000020000069D7A00069D7A',
    // 112 entries; the last one is the "Division 1AA" placeholder, not a selectable team.
    teamTable: 0x002cea, teamCount: 111, namesHeader: 1, players: 45, stride: 5,
  },
};

/** BW95: one bit per team, clear = 3-4 defense (read by the roster screen at 0x06B0FA). */
export const BW95_DEFENSE_BITS = 0x061068;

const s = (slot: number, label: string, group: Group, pool: string | string[], leftover = false): SlotDef =>
  ({ slot, label, group, pool: Array.isArray(pool) ? pool : [pool], leftover });

/** Slots in editor order (the exe's grid order). */
export function rosterLayout(game: Game, threeFour = false): SlotDef[] {
  if (game === 'bw95') {
    const dl = threeFour
      ? [s(16, 'LDE', 'DL', 'LE'), s(17, 'NT', 'DL', 'DT'), s(18, 'RDE', 'DL', 'RE')]
      : [s(16, 'LDE', 'DL', 'LE'), s(17, 'LDT', 'DL', 'DT'), s(21, 'RDT', 'DL', 'DT'), s(18, 'RDE', 'DL', 'RE')];
    const lb = threeFour
      ? [s(19, 'LOLB', 'LB', 'LOLB'), s(20, 'LILB', 'LB', 'MLB'), s(21, 'RILB', 'LB', 'MLB'),
         s(22, 'ROLB', 'LB', 'ROLB'), s(23, 'PLB', 'LB', ['LOLB', 'ROLB'], true)]
      : [s(19, 'LOLB', 'LB', 'LOLB'), s(20, 'MLB', 'LB', 'MLB'), s(22, 'ROLB', 'LB', 'ROLB'),
         s(23, 'PLB', 'LB', ['LOLB', 'ROLB'], true)];
    return [
      s(0, 'QB', 'QB', 'QB'),
      s(1, 'HB1', 'RB', 'HB'), s(2, 'HB2', 'RB', 'HB'), s(3, 'FB', 'RB', 'FB'),
      s(4, 'LT', 'OL', 'LT'), s(5, 'LG', 'OL', 'LG'), s(6, 'C', 'OL', 'C'), s(7, 'RG', 'OL', 'RG'), s(8, 'RT', 'OL', 'RT'),
      s(9, 'SE', 'REC', 'WR'), s(10, 'FL', 'REC', 'WR'), s(11, 'WR1', 'REC', 'WR'), s(12, 'WR2', 'REC', 'WR'),
      s(13, 'TE1', 'REC', 'TE'), s(14, 'TE2', 'REC', 'TE'),
      s(15, 'K', 'KP', 'K'), s(31, 'P', 'KP', 'P'),
      ...dl, ...lb,
      s(24, 'LCB1', 'DB', 'CB'), s(26, 'RCB1', 'DB', 'CB'), s(25, 'LCB2', 'DB', 'CB'), s(27, 'RCB2', 'DB', 'CB'),
      s(28, 'SS', 'DB', 'SS'), s(29, 'FS', 'DB', 'FS'), s(30, 'FS2', 'DB', 'FS'),
    ];
  }
  // CF96 / CF97: 45 players, 5-byte records (the 5th byte is kept as it is).
  // Slots 26/27 = RDT/DT2 (the exe's save order; its loader shows them swapped).
  return [
    s(0, 'QB1', 'QB', 'QB'), s(1, 'QB2', 'QB', 'QB'),
    s(2, 'HB1', 'RB', 'HB'), s(3, 'HB2', 'RB', 'HB'), s(4, 'HB3', 'RB', 'HB'),
    s(5, 'FB1', 'RB', 'FB'), s(6, 'FB2', 'RB', 'FB'),
    s(14, 'LT', 'OL', 'LT'), s(17, 'LG', 'OL', 'LG'), s(20, 'C', 'OL', 'C'), s(18, 'RG', 'OL', 'RG'), s(15, 'RT', 'OL', 'RT'),
    s(16, 'T2', 'OL', ['LT', 'RT'], true), s(19, 'G2', 'OL', ['LG', 'RG'], true), s(21, 'C2', 'OL', 'C'),
    s(7, 'WR1', 'REC', 'WR'), s(8, 'WR2', 'REC', 'WR'), s(9, 'WR3', 'REC', 'WR'), s(10, 'WR4', 'REC', 'WR'),
    s(11, 'TE1', 'REC', 'TE'), s(12, 'TE2', 'REC', 'TE'), s(13, 'TE3', 'REC', 'TE'),
    s(41, 'K', 'KP', 'K'), s(42, 'K2', 'KP', 'K'), s(43, 'P', 'KP', 'P'), s(44, 'P2', 'KP', 'P'),
    s(22, 'LDE', 'DL', 'LE'), s(25, 'LDT', 'DL', 'DT'), s(26, 'RDT', 'DL', 'DT'), s(23, 'RDE', 'DL', 'RE'),
    s(27, 'DT2', 'DL', 'DT'), s(24, 'DE2', 'DL', ['LE', 'RE'], true),
    s(28, 'LOLB', 'LB', 'LOLB'), s(29, 'LILB', 'LB', 'MLB'), s(30, 'RILB', 'LB', 'MLB'), s(31, 'ROLB', 'LB', 'ROLB'),
    s(32, 'LB2', 'LB', 'MLB', true),
    s(33, 'LCB1', 'DB', 'CB'), s(34, 'RCB1', 'DB', 'CB'), s(35, 'LCB2', 'DB', 'CB'), s(36, 'RCB2', 'DB', 'CB'),
    s(37, 'SS', 'DB', 'SS'), s(39, 'FS', 'DB', 'FS'), s(38, 'SS2', 'DB', 'SS'), s(40, 'FS2', 'DB', 'FS'),
  ];
}

export const GROUP_ORDER: Group[] = ['QB', 'RB', 'OL', 'REC', 'KP', 'DL', 'LB', 'DB'];

// ---- Scales (the exe's buckets) ----

/** Lowest 0-99 rating of each nibble value: 0-5 → 0, 6-12 → 1, … 93-98 → 14, 99+ → 15. */
export const RATING_LOW = [0, 6, 13, 20, 26, 33, 40, 46, 53, 60, 66, 73, 80, 86, 93, 99];
/** Lowest weight (lb) of each nibble value: ≤155 → 0, then 16 lb per step from 156, 380+ → 15. */
export const WEIGHT_LOW = [0, 156, 172, 188, 204, 220, 236, 252, 268, 284, 300, 316, 332, 348, 364, 380];

function bucket(lows: number[], v: number): number {
  let n = 0;
  for (let i = 0; i < lows.length; i++) if (v >= lows[i]) n = i;
  return n;
}
export const ratingToNibble = (v: number) => bucket(RATING_LOW, Math.round(v));
export const weightToNibble = (lb: number) => bucket(WEIGHT_LOW, Math.round(lb));

/**
 * What BW95's roster screen shows for a step (checked in the game): ratings ⌊n·100/15⌋
 * (0, 6, 13 … 93, 100), weight 140 + 16·n lb (140 … 380). Both land in the same step again
 * when imported.
 */
export const nibbleToRating = (n: number) => Math.floor((n * 100) / 15);
export const nibbleToWeight = (n: number) => 140 + 16 * n;

export function ratingRangeLabel(n: number): string {
  const lo = RATING_LOW[n];
  return n === 15 ? `${lo}+` : `${lo}-${RATING_LOW[n + 1] - 1}`;
}
export function weightRangeLabel(n: number): string {
  if (n === 0) return '0-155';
  return n === 15 ? '380+' : `${WEIGHT_LOW[n]}-${WEIGHT_LOW[n + 1] - 1}`;
}
