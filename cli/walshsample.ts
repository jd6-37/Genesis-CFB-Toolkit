// Prints generated Walsh Reports for a few teams: a dynasty made from the ROM, a full season's save imported,
// the offseason run by the computer, then the second season's reports.
//   npx tsx cli/walshsample.ts ELEVATED_ROM FULL_SEASON.srm "Team,Team,..." [variant] [--csv out.csv]
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { createDynasty, importSave } from '../src/core/dynasty/model';
import { createDynasty1994 } from '../src/core/dynasty/create1994';
import { editionOfRom } from '../src/core/dynasty/edition';
import * as Off from '../src/core/dynasty/offseason';
import { walshReports } from '../src/core/dynasty/walshGen';
import { CFB27_LATEST } from '../src/core/cfb27Latest';

const [romPath, savePath, teamsArg, variantArg] = process.argv.slice(2);
const rom = (await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data;
const is94 = editionOfRom(rom)?.id === '1994';
const d0 = is94
  ? createDynasty1994(rom, readFileSync('public/data/rosters-1994.csv', 'utf8'), { name: 'w', seed: 5, id: 'walsh' })
  : createDynasty(rom, readFileSync(new URL(`../public/${CFB27_LATEST.file}`, import.meta.url), 'utf8'), { name: 'w', seed: 5, id: 'walsh' });
const d1 = importSave(d0, new Uint8Array(readFileSync(savePath)), { allowOlder: true }).dynasty;
let o = Off.startOffseason(d1, { seed: 3, force: true });
o = Off.confirmDepth(o);
o = Off.runPortal(o);
o = Off.runSigningDay(o, Off.recruitTemplates(o));
o = Off.applyCuts(o, {}, Off.recruitTemplates(o));
o = Off.finishOffseason(o);
const season = o.seasons[1];
const variant = Number(variantArg ?? 0);
const rs = walshReports(o, season, Object.fromEntries(o.teams.map((_, t) => [t, variant])))!;
const want = teamsArg === '*' ? o.teams.map((t) => t.school) : teamsArg.split(',');
for (const name of want) {
  const t = o.teams.findIndex((x) => x.school === name);
  if (t < 0) { console.log(`?? ${name}`); continue; }
  console.log(`\n== ${name} (${rs[t].offense.length + rs[t].defense.length})\nOFF: ${rs[t].offense}\nDEF: ${rs[t].defense}`);
}
const lens = rs.map((r) => r.offense.length + r.defense.length);
console.log(`\n${rs.length} reports: ${Math.min(...lens)}-${Math.max(...lens)} characters, average ${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)}`);
const csvOut = process.argv.indexOf('--csv');
if (csvOut > 0) writeFileSync(process.argv[csvOut + 1], 'team,offense,defense\n' + rs.map((r, t) => [o.teams[t].school, r.offense, r.defense].map((x) => `"${x.replace(/"/g, '""')}"`).join(',')).join('\n'));
import { reportProblems, readReports } from '../src/core/walshReports';
const bad = rs.flatMap((r, t) => reportProblems(r).map((p) => `${o.teams[t].school}: ${p}`));
console.log(bad.length ? bad.join('\n') : 'every report fits the game');
const out = Off.seasonRom(o, season, rom);
if (process.env.OUTROM) writeFileSync(process.env.OUTROM, out);
const back = readReports(out);
console.log('in the ROM:', back.every((r, t) => r.offense === rs[t].offense && r.defense === rs[t].defense) ? 'all match' : 'MISMATCH');
