// Coach of the year study (user, 2026-11-27): the Bear Bryant and AFCA top 3 on full-season saves. Usage: npx tsx cli/coachstudy.ts ROM SAVE...
import { readFileSync } from 'node:fs';
import { loadRom, newDynasty } from './dynastysim';
import { importSave } from '../src/core/dynasty/model';
import { seasonView } from '../src/core/dynasty/derive';
import { coachWatch } from '../src/core/dynasty/awards';
import { kickoffRanks } from '../src/core/dynasty/kickoffRanks';
const rom = await loadRom(process.argv[2]);
const base = newDynasty(rom, 1);
let same = 0, n = 0;
for (const f of process.argv.slice(3)) {
  const d = importSave(base, new Uint8Array(readFileSync(f))).dynasty;
  const s = d.seasons[0], v = seasonView(d, s), pre = kickoffRanks(d, s)[0] ?? null;
  const b = coachWatch(v, 'bryant', pre, 3), a = coachWatch(v, 'afca', pre, 3);
  n++; if (b[0].team === a[0].team) same++;
  console.log(f.split('/').pop(), '| Bryant:', b.map((x) => `${d.teams[x.team].school} ${x.line}`).join('; '), '| AFCA:', a.map((x) => `${d.teams[x.team].school} ${x.line}`).join('; '));
}
console.log('same winner', same, 'of', n);
