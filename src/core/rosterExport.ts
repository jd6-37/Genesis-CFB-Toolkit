// Roster → CSV export. Same column names as the import, plus "Slot", so the file can be edited
// and loaded back exactly (the importer writes slot by slot when a Slot column is present).
// Ratings and weights are written as the game shows them (step 14 → 93, step 15 → 100,
// weight 140 + 16 lb per step), which land in the same step when re-imported.
import { GROUP_ATTRS, nibbleToRating, nibbleToWeight, sheetColumn } from './rosterLayouts';
import { jerseyNumber, readPlayer, teamLayout, teamName, type RosterRom } from './rosterRom';
import { toCsv } from './rosterSheet';

export const EXPORT_COLUMNS = [
  'Team', 'Slot', 'Position', 'Jersey Number', 'Weight', 'Speed', 'Quickness', 'Awareness', 'Power',
  'Catching', 'Blocking', 'Tackling', 'Throw Power', 'Kick Power', 'Kick Accuracy',
];

export function exportRostersCsv(rom: RosterRom, teams?: number[]): string {
  const rows: (string | number)[][] = [];
  for (const t of teams ?? rom.teams.map((x) => x.index)) {
    for (const def of teamLayout(rom, t)) {
      const p = readPlayer(rom, t, def.slot);
      const row: (string | number)[] = EXPORT_COLUMNS.map(() => '');
      row[0] = teamName(rom.teams[t]);
      row[1] = def.label;
      row[2] = def.pool[0];
      const n = jerseyNumber(p.numberByte);
      row[3] = n === null ? '' : n;
      GROUP_ATTRS[def.group].forEach((attr, i) => {
        const ci = EXPORT_COLUMNS.indexOf(sheetColumn(def.group, attr));
        row[ci] = attr === 'Weight' ? nibbleToWeight(p.ratings[i]) : nibbleToRating(p.ratings[i]);
      });
      rows.push(row);
    }
  }
  return toCsv(EXPORT_COLUMNS, rows);
}
