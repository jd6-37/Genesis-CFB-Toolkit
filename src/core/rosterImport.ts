// Spreadsheet → roster import, following CFB-Walsh.exe's rules:
// rows are grouped by team, each slot takes the best unused player of its position
// (by "Overall Rating"), ratings 0-99 and weights in lb are bucketed into the game's 0-F scale.
// A sheet with a "Slot" column (as exported by this app) is written slot by slot instead.
import {
  GROUP_ATTRS, rosterLayout, sheetColumn, ratingToNibble, weightToNibble, type SlotDef,
} from './rosterLayouts';
import {
  readPlayer, writePlayer, jerseyByte, setRating, teamLayout, teamName, type RosterRom,
} from './rosterRom';
import { EXE_TEAM_NAMES } from './rosterNames';
import { cellNumber, type Sheet } from './rosterSheet';

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

/** Slot label (any spelling the editor, the exe or the game uses) → slot index. */
function slotLabels(rom: RosterRom): Map<string, number> {
  const m = new Map<string, number>();
  const layouts = rom.game === 'bw95' ? [rosterLayout('bw95', false), rosterLayout('bw95', true)] : [rosterLayout(rom.game)];
  for (const l of layouts) for (const s of l) m.set(key(s.label), s.slot);
  if (rom.game === 'bw95') {
    for (const [label, slot] of [['LE', 16], ['RE', 18], ['DLT', 17], ['DRT', 21], ['KICK', 15], ['PUNT', 31], ['FS1', 29]] as const) {
      m.set(key(label), slot);
    }
  }
  return m;
}

export function importSheet(rom: RosterRom, sheet: Sheet): ImportReport {
  const col = new Map<string, number>();
  sheet.headers.forEach((h, i) => { if (!col.has(key(h))) col.set(key(h), i); });
  const c = (name: string) => col.get(key(name));
  const cTeam = c('Team');
  const cPos = c('Position');
  const cSlot = c('Slot');
  if (cTeam === undefined) throw new Error('The sheet has no "Team" column.');
  if (cPos === undefined && cSlot === undefined) throw new Error('The sheet has no "Position" (or "Slot") column.');
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

  const labels = slotLabels(rom);
  const knownPositions = new Set(rosterLayout(rom.game, false).concat(rosterLayout(rom.game, true)).flatMap((s) => s.pool));
  const unknownPositions = new Map<string, number>();
  const unknownSlots = new Map<string, number>();

  const apply = (team: number, def: SlotDef, r: string[]) => {
    const p = readPlayer(rom, team, def.slot);
    const n = cNumber === undefined ? NaN : cellNumber(r[cNumber]);
    if (Number.isFinite(n)) p.numberByte = jerseyByte(n);
    GROUP_ATTRS[def.group].forEach((attr) => {
      const ci = c(sheetColumn(def.group, attr));
      const v = ci === undefined ? NaN : cellNumber(r[ci]);
      if (!Number.isFinite(v)) return;
      setRating(p, def, attr, attr === 'Weight' ? weightToNibble(v) : ratingToNibble(v));
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
    const bySlotLabel = cSlot !== undefined && rows.some((i) => sheet.rows[i][cSlot]);
    const filled: SlotFill[] = [];
    const used = new Set<number>();

    if (bySlotLabel) {
      for (const i of rows) {
        const r = sheet.rows[i];
        const s = r[cSlot!];
        if (!s) continue;
        const slot = labels.get(key(s));
        const def = slot === undefined ? undefined : layout.find((d) => d.slot === slot);
        if (!def) { unknownSlots.set(s, (unknownSlots.get(s) ?? 0) + 1); continue; }
        apply(team, def, r);
        used.add(i);
        const prev = filled.findIndex((f) => f.slot === def.slot);
        if (prev >= 0) filled.splice(prev, 1);
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
    teams.push({
      team, teamName: teamName(rom.teams[team]), sheetTeam,
      mode: bySlotLabel ? 'slots' : 'ranked',
      filled,
      unfilled: layout.filter((d) => !filled.some((f) => f.slot === d.slot)).map((d) => d.label),
      unusedRows: rows.length - used.size,
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
