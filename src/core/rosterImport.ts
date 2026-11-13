// Spreadsheet → roster import. Three kinds of sheet (detectImport picks one):
// - Slot sheets (as exported by this app): every row goes to the slot its "Slot" column names.
//   The labels must belong to each team's layout on this ROM, so a sheet made for another
//   defensive layout is refused instead of putting players in the wrong slots.
// - Raw CFB 27 ratings: converted by rosterCfb27.ts (distribution matching), not here.
// - Other sheets (CFB-Walsh.exe's rules): rows are grouped by team, each slot takes the best
//   unused player of its position (by "Overall Rating"), ratings 0-99 and weights in lb are
//   bucketed into the game's 0-F scale.
import {
  GROUP_ATTRS, rosterLayout, sheetColumn, ratingToNibble, weightToNibble, type SlotDef,
} from './rosterLayouts';
import {
  readPlayer, writePlayer, jerseyByte, jerseyNumber, setRating, teamLayout, teamName, type RosterRom,
} from './rosterRom';
import { EXE_TEAM_NAMES } from './rosterNames';
import { cellNumber, type Sheet } from './rosterSheet';
import { shownWeightOffset } from './rosterOlPatch';
import { looksLikeCfb27 } from './rosterCfb27';
import { numberAllowed, replacementNumber, sideOf } from './dynasty/numbers';

export interface SlotFill {
  label: string;
  slot: number;
  /** Row number as a spreadsheet app shows it (header = row 1). */
  sheetRow: number;
  player: string;
}

export interface TeamImport {
  team: number;
  teamName: string;
  sheetTeam: string;
  mode: 'ranked' | 'slots';
  filled: SlotFill[];
  /** Slots with no player of that position in the sheet (they keep their current player). */
  unfilled: string[];
  /** Rows of this team that weren't needed (depth beyond the game's slots). */
  unusedRows: number;
  /** Players whose number in the sheet their slot's position can't wear in the game, and the number given instead. */
  renumbered: { label: string; player: string; from: number; to: number }[];
}

export interface ImportReport {
  teams: TeamImport[];
  unknownTeams: { name: string; rows: number }[];
  unknownPositions: { position: string; rows: number }[];
  unknownSlots: { slot: string; rows: number }[];
  /** Rating columns the sheet doesn't have; those ratings keep their current values. */
  missingColumns: string[];
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Team names: lowercase, no periods/apostrophes, "St" → "State". */
export const normTeam = (s: string) =>
  s.toLowerCase().replace(/[.'’`]/g, '').replace(/\bst\b/g, 'state').replace(/[^a-z0-9&]+/g, ' ').trim();

const POSITION_ALIASES: Record<string, string> = { RB: 'HB', ILB: 'MLB' };
const normPosition = (s: string) => {
  const p = s.trim().toUpperCase();
  return POSITION_ALIASES[p] ?? p;
};

/** Name → team index for every way a team can be written. Ambiguous names are dropped. */
export function teamMatcher(rom: RosterRom): (name: string) => number | undefined {
  const map = new Map<string, number | null>();
  const add = (name: string, team: number) => {
    const k = normTeam(name);
    if (!k) return;
    const prev = map.get(k);
    if (prev === undefined) map.set(k, team);
    else if (prev !== team) map.set(k, null);
  };
  for (const t of rom.teams) {
    add(teamName(t), t.index);
    add(t.school, t.index);
  }
  for (const [index, stockSchool, exeName] of EXE_TEAM_NAMES[rom.game]) {
    const t = rom.teams[index];
    if (!t || normTeam(t.school) !== normTeam(stockSchool)) continue; // slot was swapped
    add(exeName, index);
    const nick = normTeam(t.nickname);
    const full = normTeam(exeName);
    if (nick && full.endsWith(` ${nick}`)) add(full.slice(0, -nick.length - 1), index); // "Pittsburgh"
  }
  return (name) => map.get(normTeam(name)) ?? undefined;
}

type LayoutKind = 'four3' | 'three4' | 'elevated' | 'cf';
const layoutKind = (rom: RosterRom, team: number): LayoutKind =>
  rom.game !== 'bw95' ? 'cf' : rom.elevated ? 'elevated' : rom.teams[team].threeFour ? 'three4' : 'four3';
export const LAYOUT_NAMES: Record<LayoutKind, string> = {
  four3: '4-3', three4: '3-4', elevated: 'Elevated (DT1/DT2, MLB1/MLB2)', cf: '',
};

/**
 * Slot labels a team accepts in a Slot sheet: its own layout's labels plus the other spellings
 * the game uses for those same slots. Elevated ROMs also take the stock 4-3 labels (same slots:
 * LDT = DT1, MLB = MLB1, RDT = DT2, PLB = MLB2), as older exports and CSVs use them, and both sets of
 * cornerback and receiver labels (LCB1 = CB1, RCB1 = CB2, LCB2 = CB3, RCB2 = CB4, WR1 = WR3, WR2 = WR4:
 * the game's labels changed in v2.0.1-test17 / test11, the slots didn't).
 */
function teamSlotLabels(rom: RosterRom, team: number): Map<string, number> {
  const m = new Map<string, number>();
  const kind = layoutKind(rom, team);
  for (const s of teamLayout(rom, team)) m.set(key(s.label), s.slot);
  if (rom.game === 'bw95') {
    const extra: [string, number][] = [['LE', 16], ['RE', 18], ['KICK', 15], ['PUNT', 31], ['FS1', 29]];
    if (kind !== 'three4') extra.push(['DLT', 17], ['DRT', 21]);
    if (kind === 'elevated') {
      for (const s of rosterLayout('bw95', false)) extra.push([s.label, s.slot]);
      for (const s of rosterLayout('bw95', false, true, !rom.newLabels)) extra.push([s.label, s.slot]);
    }
    for (const [label, slot] of extra) if (!m.has(key(label))) m.set(key(label), slot);
  }
  return m;
}

/** Columns a Slot sheet must have (the export's columns, Position aside). */
export const SLOT_SHEET_COLUMNS = ['Team', 'Slot', 'Jersey Number', 'Weight', 'Speed', 'Quickness', 'Awareness', 'Power',
  'Catching', 'Blocking', 'Tackling', 'Throw Power', 'Kick Power', 'Kick Accuracy'];

/**
 * Why a sheet with a Slot column doesn't fit this ROM (empty = it fits). Teams that aren't in the
 * ROM are not a problem: they're skipped and listed in the report.
 */
export function slotSheetProblems(rom: RosterRom, sheet: Sheet): string[] {
  const col = columnIndex(sheet);
  const missing = SLOT_SHEET_COLUMNS.filter((n) => col(n) === undefined);
  if (missing.length) return [`Columns missing: ${missing.join(', ')}.`];
  const cTeam = col('Team')!, cSlot = col('Slot')!;
  const match = teamMatcher(rom);
  const problems: string[] = [];
  const noSlot: number[] = [];
  const wrong = new Map<string, { kind: LayoutKind; labels: Set<string>; teams: number[] }>();
  const bad = new Map<number, Set<string>>();
  const seen = new Map<number, Map<number, number[]>>();
  sheet.rows.forEach((r, i) => {
    const t = r[cTeam] ? match(r[cTeam]) : undefined;
    if (t === undefined) return;
    const label = (r[cSlot] ?? '').trim();
    if (!label) { noSlot.push(i + 2); return; }
    const slot = teamSlotLabels(rom, t).get(key(label));
    if (slot === undefined) { (bad.get(t) ?? bad.set(t, new Set()).get(t)!).add(label); return; }
    const s = seen.get(t) ?? seen.set(t, new Map()).get(t)!;
    (s.get(slot) ?? s.set(slot, []).get(slot)!).push(i + 2);
  });
  // Group teams with the same layout and the same foreign labels into one message.
  for (const [t, labels] of [...bad].sort((a, b) => a[0] - b[0])) {
    const kind = layoutKind(rom, t);
    const k = `${kind}|${[...labels].sort().join(',')}`;
    (wrong.get(k) ?? wrong.set(k, { kind, labels, teams: [] }).get(k)!).teams.push(t);
  }
  for (const { kind, labels, teams } of wrong.values()) {
    const who = teams.length === 1 ? rom.teams[teams[0]].school : `${teams.length} teams`;
    const list = [...labels].join(', ');
    if (kind === 'cf') {
      problems.push(`${who}: the sheet has slot labels this game doesn't use: ${list}.`);
    } else {
      const defense = teamLayout(rom, teams[0]).filter((d) => d.group === 'DL' || d.group === 'LB').map((d) => d.label).join(' ');
      problems.push(`${who} use${teams.length === 1 ? 's' : ''} the ${LAYOUT_NAMES[kind]} defense on this ROM (${defense}), ` +
        `but the sheet has slots that don't belong to it: ${list}.` +
        (teams.length > 1 ? ` Teams: ${teams.map((x) => rom.teams[x].school).join(', ')}.` : ''));
    }
  }
  for (const [t, slots] of seen) {
    for (const [slot, rows] of slots) {
      if (rows.length < 2) continue;
      const def = teamLayout(rom, t).find((d) => d.slot === slot)!;
      problems.push(`${rom.teams[t].school}: ${def.label} appears ${rows.length} times (rows ${rows.join(', ')}).`);
    }
  }
  if (noSlot.length) problems.push(`Rows without a Slot: ${noSlot.slice(0, 10).join(', ')}${noSlot.length > 10 ? ` and ${noSlot.length - 10} more` : ''}.`);
  return problems;
}

export type ImportKind =
  | { path: 'slots' }
  | { path: 'cfb27' }
  | { path: 'ranked' }
  | { path: 'refused'; problems: string[] };

/**
 * Picks how a sheet is imported: a Slot sheet that fits this ROM goes in slot by slot; raw CFB 27
 * ratings get converted; any other sheet without a Slot column uses the ranked import. A Slot
 * sheet that doesn't fit (and isn't CFB 27 data) is refused, with the reasons.
 */
export function detectImport(rom: RosterRom, sheet: Sheet): ImportKind {
  const cSlot = columnIndex(sheet)('Slot');
  const hasSlots = cSlot !== undefined && sheet.rows.some((r) => (r[cSlot] ?? '').trim());
  const cfb27 = looksLikeCfb27(sheet);
  if (hasSlots) {
    const problems = slotSheetProblems(rom, sheet);
    if (!problems.length) return { path: 'slots' };
    if (cfb27) return { path: 'cfb27' };
    return { path: 'refused', problems };
  }
  return cfb27 ? { path: 'cfb27' } : { path: 'ranked' };
}

function columnIndex(sheet: Sheet): (name: string) => number | undefined {
  const col = new Map<string, number>();
  sheet.headers.forEach((h, i) => { if (!col.has(key(h))) col.set(key(h), i); });
  return (name) => col.get(key(name));
}

/**
 * Slot or ranked import (see detectImport). A Slot sheet that doesn't fit this ROM throws with the
 * reasons. Weights are what the roster screen shows: with the OL weight tweak installed, OL rows
 * show 25 lb more, so that much comes off before bucketing.
 */
export function importSheet(rom: RosterRom, sheet: Sheet): ImportReport {
  const c = columnIndex(sheet);
  const cTeam = c('Team');
  const cPos = c('Position');
  const cSlotCol = c('Slot');
  const cSlot = cSlotCol !== undefined && sheet.rows.some((r) => (r[cSlotCol] ?? '').trim()) ? cSlotCol : undefined;
  if (cTeam === undefined) throw new Error('The sheet has no "Team" column.');
  if (cPos === undefined && cSlot === undefined) throw new Error('The sheet has no "Position" (or "Slot") column.');
  if (cSlot !== undefined) {
    const problems = slotSheetProblems(rom, sheet);
    if (problems.length) throw new Error(`This sheet doesn't fit this ROM. ${problems.join(' ')}`);
  }
  const cOverall = c('Overall Rating') ?? c('Overall') ?? c('OVR');
  const cNumber = c('Jersey Number') ?? c('Number') ?? c('No');
  const cName = c('Name') ?? c('Player') ?? c('Full Name');
  const cFirst = c('First Name'), cLast = c('Last Name');

  const ratingColumns = ['Weight', 'Speed', 'Quickness', 'Awareness', 'Power', 'Catching', 'Blocking',
    'Tackling', 'Throw Power', 'Kick Power', 'Kick Accuracy'];
  const missingColumns = [...(cNumber === undefined ? ['Jersey Number'] : []), ...ratingColumns.filter((n) => c(n) === undefined)];

  const playerName = (r: string[]) => {
    if (cName !== undefined && r[cName]) return r[cName];
    const parts = [cFirst, cLast].map((i) => (i === undefined ? '' : r[i])).filter(Boolean);
    return parts.join(' ');
  };
  const overall = (r: string[]) => {
    const v = cOverall === undefined ? NaN : cellNumber(r[cOverall]);
    return Number.isFinite(v) ? v : -Infinity;
  };

  const matchTeam = teamMatcher(rom);
  const byTeam = new Map<number, { sheetTeam: string; rows: number[] }>();
  const unknownTeams = new Map<string, number>();
  sheet.rows.forEach((r, i) => {
    const name = r[cTeam];
    if (!name) return;
    const t = matchTeam(name);
    if (t === undefined) { unknownTeams.set(name, (unknownTeams.get(name) ?? 0) + 1); return; }
    const e = byTeam.get(t) ?? { sheetTeam: name, rows: [] };
    e.rows.push(i);
    byTeam.set(t, e);
  });

  const knownPositions = new Set([false, true].flatMap((tf) => rosterLayout(rom.game, tf, rom.elevated, rom.newLabels)).flatMap((s) => s.pool));
  const unknownPositions = new Map<string, number>();
  const unknownSlots = new Map<string, number>();

  // A number the slot's position can't wear in the game (numbers.ts: offensive linemen 50-79, nobody else on
  // offense) is replaced once the team is done, unless it is the number the slot already had: a sheet exported
  // from a ROM comes back unchanged.
  let pendingNumbers: { def: SlotDef; from: number }[] = [];
  const apply = (team: number, def: SlotDef, r: string[]) => {
    const p = readPlayer(rom, team, def.slot);
    const n = cNumber === undefined ? NaN : cellNumber(r[cNumber]);
    if (Number.isFinite(n) && !numberAllowed(def.pool[0], n) && jerseyNumber(p.numberByte) !== n) pendingNumbers.push({ def, from: n });
    if (Number.isFinite(n)) p.numberByte = jerseyByte(n);
    GROUP_ATTRS[def.group].forEach((attr) => {
      const ci = c(sheetColumn(def.group, attr));
      const v = ci === undefined ? NaN : cellNumber(r[ci]);
      if (!Number.isFinite(v)) return;
      setRating(p, def, attr, attr === 'Weight' ? weightToNibble(v - shownWeightOffset(rom, def)) : ratingToNibble(v));
    });
    writePlayer(rom, team, def.slot, p);
  };
  const label = (r: string[], i: number) => {
    const name = playerName(r);
    const num = cNumber === undefined ? '' : r[cNumber];
    return [num ? `#${num.replace(/\.0+$/, '')}` : '', name].filter(Boolean).join(' ') || `row ${i + 2}`;
  };

  const teams: TeamImport[] = [];
  for (const [team, { sheetTeam, rows }] of [...byTeam.entries()].sort((a, b) => a[0] - b[0])) {
    const layout = teamLayout(rom, team);
    const bySlotLabel = cSlot !== undefined;
    const filled: SlotFill[] = [];
    const used = new Set<number>();

    if (bySlotLabel) {
      const labels = teamSlotLabels(rom, team);
      for (const i of rows) {
        const r = sheet.rows[i];
        const s = r[cSlot!];
        if (!s) continue;
        const slot = labels.get(key(s));
        const def = slot === undefined ? undefined : layout.find((d) => d.slot === slot);
        if (!def) { unknownSlots.set(s, (unknownSlots.get(s) ?? 0) + 1); continue; }
        apply(team, def, r);
        used.add(i);
        filled.push({ label: def.label, slot: def.slot, sheetRow: i + 2, player: label(r, i) });
      }
    } else {
      const pools = new Map<string, number[]>();
      for (const i of rows) {
        const pos = normPosition(sheet.rows[i][cPos!] ?? '');
        if (!pos) continue;
        if (!knownPositions.has(pos)) { unknownPositions.set(pos, (unknownPositions.get(pos) ?? 0) + 1); continue; }
        const list = pools.get(pos) ?? [];
        list.push(i);
        pools.set(pos, list);
      }
      // Best first; rows with the same (or no) overall keep the sheet's order.
      for (const list of pools.values()) list.sort((a, b) => overall(sheet.rows[b]) - overall(sheet.rows[a]) || a - b);
      const take = (def: SlotDef) => {
        const candidates = def.pool.flatMap((p) => pools.get(p) ?? []).filter((i) => !used.has(i));
        if (!candidates.length) return undefined;
        candidates.sort((a, b) => overall(sheet.rows[b]) - overall(sheet.rows[a]) || a - b);
        return candidates[0];
      };
      const order = [...layout.filter((d) => !d.leftover), ...layout.filter((d) => d.leftover)];
      for (const def of order) {
        const i = take(def);
        if (i === undefined) continue;
        used.add(i);
        apply(team, def, sheet.rows[i]);
        filled.push({ label: def.label, slot: def.slot, sheetRow: i + 2, player: label(sheet.rows[i], i) });
      }
    }
    const order = new Map(layout.map((d, k) => [d.slot, k]));
    filled.sort((a, b) => order.get(a.slot)! - order.get(b.slot)!);
    const renumbered: TeamImport['renumbered'] = [];
    const waiting = new Set(pendingNumbers.map((x) => x.def.slot));
    for (const { def, from } of pendingNumbers.sort((a, b) => order.get(a.def.slot)! - order.get(b.def.slot)!)) {
      const side = sideOf(def.pool[0]);
      const taken = new Set(layout.filter((d) => !waiting.has(d.slot) && sideOf(d.pool[0]) === side)
        .map((d) => jerseyNumber(readPlayer(rom, team, d.slot).numberByte)).filter((x): x is number => x !== null));
      const to = replacementNumber(def.pool[0], from, taken);
      if (to === null) continue;
      const p = readPlayer(rom, team, def.slot);
      p.numberByte = jerseyByte(to);
      writePlayer(rom, team, def.slot, p);
      waiting.delete(def.slot);
      renumbered.push({ label: def.label, player: (filled.find((f) => f.slot === def.slot)?.player ?? '').replace(/^#\S+\s*/, ''), from, to });
    }
    pendingNumbers = [];
    teams.push({
      team, teamName: teamName(rom.teams[team]), sheetTeam,
      mode: bySlotLabel ? 'slots' : 'ranked',
      filled,
      unfilled: layout.filter((d) => !filled.some((f) => f.slot === d.slot)).map((d) => d.label),
      unusedRows: rows.length - used.size,
      renumbered,
    });
  }

  const list = (m: Map<string, number>) => [...m.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  return {
    teams,
    unknownTeams: list(unknownTeams).map(({ k, v }) => ({ name: k, rows: v })),
    unknownPositions: list(unknownPositions).map(({ k, v }) => ({ position: k, rows: v })),
    unknownSlots: list(unknownSlots).map(({ k, v }) => ({ slot: k, rows: v })),
    missingColumns,
  };
}
