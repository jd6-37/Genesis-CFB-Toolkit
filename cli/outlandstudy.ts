// The Outland Trophy's split between offensive linemen and defensive tackles (awards.ts awardWatch), on finished
// season saves: each save is read 20 times as if from 20 different years. Usage: npx tsx cli/outlandstudy.ts ROM SAVE...
import { readFileSync } from 'node:fs';
import { loadRom, newDynasty } from './dynastysim';
import { importSave } from '../src/core/dynasty/model';
import { seasonView } from '../src/core/dynasty/derive';
import { awardWatch, candidates, POSITION_AWARDS } from '../src/core/dynasty/awards';
const rom = await loadRom(process.argv[2]);
const base = newDynasty(rom, 1);
let ol = 0, dt = 0;
const out = POSITION_AWARDS.find((a) => a.key === 'outland')!;
for (const f of process.argv.slice(3)) {
  const d = importSave(base, new Uint8Array(readFileSync(f))).dynasty;
  const v0 = seasonView(d, d.seasons[0]);
  const all = candidates(v0);
  for (let y = 2026; y < 2046; y++) {
    const v = { ...v0, season: { ...v0.season, year: y } };
    if (awardWatch(v, out, all, 1)[0]?.role === 'OL') ol++; else dt++;
  }
}
console.log('OL', ol, 'DT', dt, (100 * ol / (ol + dt)).toFixed(0) + '% OL');
