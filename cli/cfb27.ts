// Converts raw CFB 27 ratings into a BW95 ROM's rosters, the same way the Rosters tab does
// (distribution matching, OL weight display tweak, each converted team's OFF/DEF from its CFB 27
// starters, checksums fixed).
//   npx tsx cli/cfb27.ts ROM CFB27.csv OUT.md [--no-ol-tweak] [--no-ratings] [--teams "Texas,Ohio State"]
// CFB27.csv can be the built-in file, public/data/ea-cfb27-ratings-2026-week9.csv.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { fixChecksums, openRosterRom, teamName } from '../src/core/rosterRom';
import { readSheet } from '../src/core/rosterSheet';
import { detectImport } from '../src/core/rosterImport';
import { applyCfb27, convertCfb27 } from '../src/core/rosterCfb27';
import { installOlPatch } from '../src/core/rosterOlPatch';
import { writeRating } from '../src/core/teamRatings';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const noTweak = args.includes('--no-ol-tweak');
if (noTweak) args.splice(args.indexOf('--no-ol-tweak'), 1);
const noRatings = args.includes('--no-ratings');
if (noRatings) args.splice(args.indexOf('--no-ratings'), 1);
const teamsArg = flag('--teams');
const [romPath, csvPath, outPath] = args;
if (!outPath) {
  console.error('usage: tsx cli/cfb27.ts ROM CFB27.csv OUT.md [--no-ol-tweak] [--no-ratings] [--teams "A,B"]');
  process.exit(2);
}

const rom = openRosterRom((await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data);
const sheet = await readSheet(basename(csvPath), new Uint8Array(readFileSync(csvPath)));
const kind = detectImport(rom, sheet);
if (kind.path !== 'cfb27') {
  console.error(`not converted: the sheet takes the "${kind.path}" path${kind.path === 'refused' ? `: ${kind.problems.join(' ')}` : ''}`);
  process.exit(1);
}
const plan = convertCfb27(rom, sheet);
const only = teamsArg
  ? plan.teams.filter((t) => teamsArg.split(',').some((n) => [t.teamName, rom.teams[t.team].school, t.sheetTeam].includes(n.trim()))).map((t) => t.team)
  : undefined;
const written = applyCfb27(rom, plan, only);
const tweak = noTweak ? 'skipped' : installOlPatch(rom.data);
const rated = rom.game === 'bw95' && !noRatings ? plan.teams.filter((t) => !only || only.includes(t.team)) : [];
for (const t of rated) writeRating(rom.data, t.team, t.ovr);
const sums = fixChecksums(rom.data, rom.game);
writeFileSync(outPath, rom.data);
console.log(JSON.stringify({
  elevatedLayout: rom.elevated,
  teamsConverted: only?.length ?? plan.teams.length,
  slotsWritten: written,
  unmatchedRomTeams: plan.unmatchedRomTeams.map((t) => teamName(rom.teams[t])),
  otherSheetTeams: plan.otherSheetTeams,
  fallbacks: plan.teams.flatMap((t) => t.fills.filter((f) => f.how === 'fallback').map((f) => `${t.teamName} ${f.label} <- ${f.player.pos} ${f.player.name}`)).length,
  unfilled: plan.teams.flatMap((t) => t.unfilled.map((u) => `${t.teamName} ${u}`)),
  unknownPositions: plan.unknownPositions,
  blankCells: plan.blankCells,
  olTweak: tweak,
  ratings: rated.map((t) => `${t.teamName} ${t.ovr.off}/${t.ovr.def}`),
  checksums: sums,
}, null, 1));
