// CFB 27 → BW95 roster conversion (distribution matching).
//
// CFB 27 decides the order of the players; the stock game decides how many get each step. For every
// position role and rating, the converted players are ranked by a CFB 27 score and handed the stock
// game's own steps for that role in the same order, so each rating keeps the stock spread (and the
// game its balance) while every team reflects its own CFB 27 roster.
//
// Steps:
//   1. Pick CFB 27 players for each slot of every ROM team found in the sheet: primary slots from
//      their own positions, then the leftover slot (stock PLB), then empty slots from fallback
//      positions. Within a pool: Overall high first, then EA Player ID low first.
//   2. Group the picked players of all teams by role (QB, HB, FB, OL, WR, TE, K, P, DE, DT, LB, CB, S).
//   3. Per role and rating: sort low to high by score (then Overall low first, then EA Player ID
//      high first); player k of N gets the stock step at index ⌊(k + 0.5) / N × M⌋ of the role's M
//      stock steps sorted low to high. With N = M the stock distribution comes out exactly.
//   4. Jersey numbers straight from CFB 27.
// Reference implementation and the decisions behind it: docs/rosters.md, "CFB 27 conversion".
// BW95 only for now; the stock tables for CF96/97 are in rosterStockDists.json already.
import { starterOvr, type StarterOvr } from './teamRatings';
import { GROUP_ATTRS, type Attr, type Group, type SlotDef } from './rosterLayouts';
import { jerseyByte, readPlayer, setRating, teamLayout, teamName, writePlayer, type RosterRom } from './rosterRom';
import { teamMatcher } from './rosterImport';
import { cellNumber, type Sheet } from './rosterSheet';
import STOCK from './rosterStockDists.json';

interface StockRole { group: string; slots: number; ratings: Record<string, number[]> }
const STOCK_ROLES = (game: 'bw95' | 'cf96' | 'cf97') => STOCK.games[game].roles as Record<string, StockRole>;

/** Columns the conversion reads (EA's ratings site names; other columns are ignored). */
export const CFB27_COLUMNS = ['Team', 'Name', 'Position', 'Overall', 'Jersey Number', 'Weight', 'EA Player ID', 'Speed',
  'Acceleration', 'Agility', 'Strength', 'Awareness', 'Play Recognition', 'Catching', 'Carrying', 'Throw Power',
  'Throw Accuracy Short', 'Throw Accuracy Mid', 'Throw Accuracy Deep', 'Break Tackle', 'Trucking', 'Run Block',
  'Pass Block', 'Run Block Power', 'Pass Block Power', 'Power Moves', 'Block Shedding', 'Tackle', 'Hit Power', 'Pursuit',
  'Kick Power', 'Kick Accuracy', 'Lead Block'] as const;
type Column = (typeof CFB27_COLUMNS)[number];

/** Columns only CFB 27 data has (a BW95-style sheet has none of them). */
const CFB27_ONLY = CFB27_COLUMNS.filter((c) => !['Team', 'Name', 'Position', 'Overall', 'Jersey Number', 'Weight', 'Speed',
  'Awareness', 'Catching', 'Throw Power', 'Kick Power', 'Kick Accuracy'].includes(c));

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function columns(sheet: Sheet) {
  const m = new Map<string, number>();
  sheet.headers.forEach((h, i) => { if (!m.has(key(h))) m.set(key(h), i); });
  return (name: string) => m.get(key(name));
}

/** True when the sheet has at least three columns only CFB 27 data has (Acceleration, Break Tackle, …). */
export const looksLikeCfb27 = (sheet: Sheet) => {
  const col = columns(sheet);
  return CFB27_ONLY.filter((c) => col(c) !== undefined).length >= 3;
};

/** Conversion columns the sheet doesn't have. */
export const missingCfb27Columns = (sheet: Sheet) => {
  const col = columns(sheet);
  return CFB27_COLUMNS.filter((c) => col(c) === undefined);
};

/** CFB 27 positions; Dynasty Central writes the edge rushers as LEDG/REDG. */
const POSITIONS = new Set(['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB',
  'CB', 'FS', 'SS', 'K', 'P']);
const POSITION_ALIASES: Record<string, string> = { LEDG: 'LE', REDG: 'RE' };
/** CFB 27 school names that differ from the ROM's. */
const TEAM_ALIASES: Record<string, string> = {
  Cal: 'California',
  Pittsburgh: 'Pitt',
  // The 138-team 2026 Season Edition's (and CF97's) names for these schools.
  'Appalachian State': 'App State',
  'Coastal Carolina': 'Coastal',
  FAU: 'Florida Atlantic',
  'Jacksonville State': 'Jax State',
  'Miami (Ohio)': 'Miami of Ohio',
  'Middle Tennessee State': 'Middle Tennessee',
  'Mississippi State': 'Mississippi St.',
  'Northern Illinois': 'NIU',
  'North Dakota State': 'North Dakota St.',
  USF: 'South Florida',
  Connecticut: 'UConn',
};

interface Cfb27Player {
  row: number;
  team: string;
  name: string;
  pos: string;
  id: number;
  ovr: number;
  jersey: number;
  v: (c: Column) => number;
}

export interface Cfb27Fill {
  team: number;
  slot: number;
  label: string;
  group: Group;
  role: string;
  player: Cfb27Player;
  how: 'position' | 'fallback';
  /** Converted steps (0-15) for the slot group's six ratings. */
  steps: Partial<Record<Attr, number>>;
}

export interface Cfb27Team {
  team: number;
  teamName: string;
  sheetTeam: string;
  fills: Cfb27Fill[];
  /** Slots no CFB 27 player could fill (they keep their current player). */
  unfilled: string[];
  /** Team OVRs from the team's CFB 27 starters (src/core/teamRatings.ts). */
  ovr: StarterOvr;
}

export interface Cfb27Plan {
  teams: Cfb27Team[];
  /** ROM teams with no CFB 27 team in the sheet (they keep their rosters). */
  unmatchedRomTeams: number[];
  /** CFB 27 schools that aren't in this ROM (normal: CFB 27 has 138). */
  otherSheetTeams: number;
  unknownPositions: { position: string; rows: number }[];
  /** Rating cells that were empty or not a number (counted as 0). */
  blankCells: number;
}

const byOvr = (a: Cfb27Player, b: Cfb27Player) => b.ovr - a.ovr || a.id - b.id || a.row - b.row;

/** Conversion slot pools where they differ from the ranked import's (BW95). */
function defensePools(rom: RosterRom, threeFour: boolean): Record<number, { pool: string[]; leftover?: boolean }> {
  if (rom.elevated) return { 17: { pool: ['DT'] }, 21: { pool: ['DT'] }, 19: { pool: ['LOLB'] }, 20: { pool: ['MLB'] }, 22: { pool: ['ROLB'] }, 23: { pool: ['MLB'] } };
  return threeFour
    ? { 17: { pool: ['DT'] }, 19: { pool: ['LOLB'] }, 20: { pool: ['MLB'] }, 21: { pool: ['MLB'] }, 22: { pool: ['ROLB'] },
        23: { pool: ['LOLB', 'ROLB', 'MLB'], leftover: true } }
    : { 17: { pool: ['DT'] }, 21: { pool: ['DT'] }, 19: { pool: ['LOLB'] }, 20: { pool: ['MLB'] }, 22: { pool: ['ROLB'] },
        23: { pool: ['LOLB', 'ROLB', 'MLB'], leftover: true } };
}

/** Role of a BW95 slot (the stock tables are per role). */
export function bw95Role(slot: number, threeFour: boolean, elevated: boolean): string {
  if (slot === 0) return 'QB'; if (slot <= 2) return 'HB'; if (slot === 3) return 'FB'; if (slot <= 8) return 'OL';
  if (slot <= 12) return 'WR'; if (slot <= 14) return 'TE'; if (slot === 15) return 'K'; if (slot === 31) return 'P';
  if (slot === 16 || slot === 18) return 'DE'; if (slot === 17) return 'DT';
  if (slot === 21) return elevated || !threeFour ? 'DT' : 'LB';
  if (slot <= 23) return 'LB'; if (slot <= 27) return 'CB'; return 'S';
}

/** Positions that stand in when a team has nobody left at a slot's own position. */
const FALLBACK: Record<string, string[]> = {
  QB: [], HB: ['FB', 'WR'], WR: ['TE', 'HB'], TE: ['WR', 'FB'], K: ['P'], P: ['K'],
  LT: ['RT', 'LG', 'RG', 'C'], RT: ['LT', 'RG', 'LG', 'C'], LG: ['RG', 'C', 'LT', 'RT'], RG: ['LG', 'C', 'RT', 'LT'], C: ['LG', 'RG', 'LT', 'RT'],
  LE: ['RE', 'DT'], RE: ['LE', 'DT'], DT: ['LE', 'RE'],
  LOLB: ['ROLB', 'MLB'], ROLB: ['LOLB', 'MLB'], MLB: ['LOLB', 'ROLB'], CB: ['FS', 'SS'], SS: ['FS', 'CB'], FS: ['SS', 'CB'],
};

/** CFB 27 score behind each BW95 rating (integer sums; only the order matters). See docs/rosters.md. */
function score(f: Cfb27Fill, attr: Attr): number {
  const v = f.player.v, g = f.group;
  switch (attr) {
    case 'Weight': return v('Weight');
    case 'Speed': return v('Speed');
    // BW95's kick routines read the kicker's QUICK as kick distance.
    case 'Quickness': return g === 'KP' ? v('Kick Power') : v('Acceleration') + v('Agility');
    case 'Power':
      if (g === 'OL') return v('Strength') + v('Run Block Power') + v('Pass Block Power');
      if (g === 'DL') return v('Strength') + v('Power Moves') + v('Block Shedding');
      return v('Break Tackle') + v('Trucking') + v('Strength'); // QB, RB, REC: break tackles
    case 'Awareness':
      if (g === 'QB') return 3 * v('Awareness') + v('Throw Accuracy Short') + v('Throw Accuracy Mid') + v('Throw Accuracy Deep');
      if (g === 'DL' || g === 'LB' || g === 'DB') return v('Awareness') + v('Play Recognition');
      return v('Awareness');
    case 'Hands': return g === 'RB' || g === 'REC' ? v('Catching') + v('Carrying') : v('Catching');
    case 'Range': return g === 'QB' ? v('Throw Power') : v('Kick Power');
    case 'Accuracy': return v('Kick Accuracy');
    case 'Blocking': return v('Run Block') + v('Pass Block') + v('Strength');
    case 'Tackling': return v('Tackle') + v('Hit Power') + v('Pursuit');
  }
}

/**
 * Works out the converted rosters for every ROM team the sheet has (nothing is written yet; see
 * applyCfb27). Throws if a column is missing or two CFB 27 teams match the same ROM team.
 */
export function convertCfb27(rom: RosterRom, sheet: Sheet): Cfb27Plan {
  if (rom.game !== 'bw95') {
    throw new Error("CFB 27 ratings can be converted for Bill Walsh College Football '95 so far, not for this game.");
  }
  const missing = missingCfb27Columns(sheet);
  if (missing.length) throw new Error(`This looks like CFB 27 data, but these columns are missing: ${missing.join(', ')}.`);
  const col = columns(sheet);
  const C = Object.fromEntries(CFB27_COLUMNS.map((n) => [n, col(n)!])) as Record<Column, number>;

  let blankCells = 0;
  const unknownPositions = new Map<string, number>();
  const players: Cfb27Player[] = [];
  sheet.rows.forEach((r, row) => {
    const team = (r[C.Team] ?? '').trim();
    if (!team) return;
    const raw = (r[C.Position] ?? '').trim().toUpperCase();
    const pos = POSITION_ALIASES[raw] ?? raw;
    if (!POSITIONS.has(pos)) { if (pos) unknownPositions.set(pos, (unknownPositions.get(pos) ?? 0) + 1); return; }
    const num = (c: Column) => {
      const x = cellNumber(r[C[c]]);
      if (Number.isFinite(x)) return x;
      blankCells++;
      return 0;
    };
    const cache = new Map<Column, number>();
    players.push({
      row, team, name: r[C.Name] ?? '', pos,
      id: Number.isFinite(cellNumber(r[C['EA Player ID']])) ? cellNumber(r[C['EA Player ID']]) : 0,
      ovr: Number.isFinite(cellNumber(r[C.Overall])) ? cellNumber(r[C.Overall]) : 0,
      jersey: cellNumber(r[C['Jersey Number']]),
      v: (c) => cache.get(c) ?? cache.set(c, num(c)).get(c)!,
    });
  });
  // Read every rating cell once up front, so the blank count doesn't depend on which scores get used.
  const ratingColumns = CFB27_COLUMNS.filter((c) => !['Team', 'Name', 'Position', 'Overall', 'Jersey Number', 'EA Player ID'].includes(c));
  for (const p of players) for (const c of ratingColumns) p.v(c);

  // ROM team → CFB 27 school
  const match = teamMatcher(rom);
  const teamOf = new Map<number, string>();
  let otherSheetTeams = 0;
  for (const name of [...new Set(players.map((p) => p.team))]) {
    const t = match(name) ?? (TEAM_ALIASES[name] ? match(TEAM_ALIASES[name]) : undefined);
    if (t === undefined) { otherSheetTeams++; continue; }
    if (teamOf.has(t)) throw new Error(`Two teams in the sheet match ${teamName(rom.teams[t])}: ${teamOf.get(t)} and ${name}.`);
    teamOf.set(t, name);
  }

  const fbScore = (p: Cfb27Player) => p.v('Lead Block') + p.v('Run Block') + p.v('Strength') + p.v('Trucking');
  const teams: Cfb27Team[] = [];
  for (const [t, school] of [...teamOf.entries()].sort((a, b) => a[0] - b[0])) {
    const tf = rom.teams[t].threeFour;
    const layout = teamLayout(rom, t);
    const pools = defensePools(rom, tf);
    const roster = players.filter((p) => p.team === school).sort(byOvr);
    const used = new Set<Cfb27Player>();
    const slots = layout.map((def) => ({ def, pool: pools[def.slot]?.pool ?? def.pool, leftover: pools[def.slot]?.leftover ?? false }));
    const got = new Map<number, Cfb27Fill>();
    const put = (def: SlotDef, player: Cfb27Player, how: Cfb27Fill['how']) =>
      got.set(def.slot, { team: t, slot: def.slot, label: def.label, group: def.group, role: bw95Role(def.slot, tf, rom.elevated), player, how, steps: {} });
    const take = (def: SlotDef, cands: Cfb27Player[], how: Cfb27Fill['how']) => {
      const p = cands.find((c) => !used.has(c));
      if (!p) return false;
      used.add(p);
      put(def, p, how);
      return true;
    };
    // 1. primary slots, 2. leftover slots (stock PLB): the slot's own positions, best Overall first
    for (const pass of [false, true]) {
      for (const s of slots.filter((x) => x.leftover === pass)) take(s.def, roster.filter((p) => s.pool.includes(p.pos)), 'position');
    }
    // 3. empty slots from fallback positions (FB: the best blocking back among HBs and TEs)
    const unfilled: string[] = [];
    for (const s of slots) {
      if (got.has(s.def.slot)) continue;
      const ok = s.def.slot === 3
        ? take(s.def, roster.filter((p) => p.pos === 'HB' || p.pos === 'TE').sort((a, b) => fbScore(b) - fbScore(a) || byOvr(a, b)), 'fallback')
        : take(s.def, roster.filter((p) => s.pool.flatMap((x) => FALLBACK[x] ?? []).includes(p.pos)), 'fallback');
      if (!ok && (s.def.slot === 15 || s.def.slot === 31)) {
        // No second kicker or punter on the team: the other specialist does both jobs.
        const other = got.get(s.def.slot === 15 ? 31 : 15);
        if (other) { put(s.def, other.player, 'fallback'); continue; }
      }
      if (!ok) unfilled.push(s.def.label);
    }
    const order = new Map(layout.map((d, k) => [d.slot, k]));
    teams.push({
      team: t, teamName: teamName(rom.teams[t]), sheetTeam: school,
      fills: [...got.values()].sort((a, b) => order.get(a.slot)! - order.get(b.slot)!),
      unfilled,
      ovr: starterOvr(roster),
    });
  }

  // Distribution matching per role × rating (weight included), over every converted team.
  const fills = teams.flatMap((x) => x.fills);
  for (const [role, ref] of Object.entries(STOCK_ROLES(rom.game))) {
    const members = fills.filter((f) => f.role === role);
    if (!members.length) continue;
    for (const attr of GROUP_ATTRS[ref.group as Group]) {
      const sorted = ref.ratings[attr].flatMap((n, step) => Array<number>(n).fill(step)); // stock steps, low to high
      const M = sorted.length;
      // Low to high by score; equal scores: lower Overall first, then higher EA Player ID first, so
      // the better player (then the lower ID) gets the higher step. No shared ranks.
      const list = members.map((f) => ({ f, s: score(f, attr) }))
        .sort((a, b) => a.s - b.s || a.f.player.ovr - b.f.player.ovr || b.f.player.id - a.f.player.id || b.f.player.row - a.f.player.row);
      const N = list.length;
      list.forEach(({ f }, k) => { f.steps[attr] = sorted[Math.min(Math.floor(((k + 0.5) / N) * M), M - 1)]; });
    }
  }

  const list = (m: Map<string, number>) => [...m].map(([position, rows]) => ({ position, rows })).sort((a, b) => b.rows - a.rows);
  return {
    teams,
    unmatchedRomTeams: rom.teams.filter((x) => !teamOf.has(x.index)).map((x) => x.index),
    otherSheetTeams,
    unknownPositions: list(unknownPositions),
    blankCells,
  };
}

/** Writes the converted rosters of the chosen teams (all by default). */
export function applyCfb27(rom: RosterRom, plan: Cfb27Plan, only?: Iterable<number>): number {
  const pick = only ? new Set(only) : null;
  let written = 0;
  for (const t of plan.teams) {
    if (pick && !pick.has(t.team)) continue;
    const layout = teamLayout(rom, t.team);
    for (const f of t.fills) {
      const def = layout.find((d) => d.slot === f.slot)!;
      const p = readPlayer(rom, t.team, f.slot);
      if (Number.isFinite(f.player.jersey)) p.numberByte = jerseyByte(f.player.jersey);
      for (const attr of GROUP_ATTRS[def.group]) {
        const step = f.steps[attr];
        if (step !== undefined) setRating(p, def, attr, step);
      }
      writePlayer(rom, t.team, f.slot, p);
      written++;
    }
  }
  return written;
}
