// A study of the coaching carousel's numbers (not a test): firings, retirements, hires and offers over many
// seeds, on a dynasty with one full season imported (the 1994 edition).
//   npx tsx cli/carouselstudy.ts ELEVATED_1994 SAVE.srm [SEEDS]
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { createDynasty1994 } from '../src/core/dynasty/create1994';
import { ROSTERS_1994 } from '../src/core/dynasty/rosters1994';
import { importSave } from '../src/core/dynasty/model';
import { withCoaches, coachOvr } from '../src/core/dynasty/coaches';
import { setManageXp, hotSeat, finishCarousel } from '../src/core/dynasty/carousel';
import { startOffseason } from '../src/core/dynasty/offseason';
import type { CoachData } from '../src/core/dynasty/coachData';

const [romPath, savePath, n = '20'] = process.argv.slice(2);
const rom = (await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data;
const csv = readFileSync(new URL(`../public/${ROSTERS_1994.file}`, import.meta.url), 'utf8');
const d0 = createDynasty1994(rom, csv, { name: 'Study', seed: 7, id: 'study', created: '2026-11-15T00:00:00Z' });
const d1 = withCoaches(importSave(d0, new Uint8Array(readFileSync(savePath))).dynasty, JSON.parse(readFileSync('public/data/coaches-1994.json', 'utf8')) as CoachData);
const heats = d1.coaches!.filter((c) => c.team !== null).map((c) => hotSeat(d1, c)!).sort((a, b) => a - b);
console.log('hot seat after the season: min', heats[0], 'median', heats[heats.length >> 1], 'p90', heats[Math.floor(heats.length * 0.9)], 'max', heats.at(-1), '≥60:', heats.filter((h) => h >= 60).length);
const managed = setManageXp(d1, d1.coaches!.find((c) => c.team === 0)!.id, true);
let fired = 0, retired = 0, hired = 0, offers = 0, former = 0, queued = 0;
const names: Record<string, number> = {};
for (let s = 1; s <= +n; s++) {
  const o = startOffseason(managed, { seed: s, force: true });
  const st = o.offseason!.carousel!;
  fired += st.fired.length; retired += st.retired.filter((x) => x.team !== null).length;
  offers += Object.values(st.offers).flat().length;
  former += st.former?.length ?? 0; queued += o.coachQueue?.length ?? 0;
  for (const f of st.fired) names[o.coaches![f.coach].name] = (names[o.coaches![f.coach].name] ?? 0) + 1;
  hired += finishCarousel(o).offseason!.carousel!.moves.length;
}
console.log(`per offseason: fired ${(fired / +n).toFixed(1)}, head coaches retired ${(retired / +n).toFixed(1)}, hires ${(hired / +n).toFixed(1)}, offers to Air Force's coach ${(offers / +n).toFixed(1)}, former players into the pool ${(former / +n).toFixed(1)} now and ${(queued / +n).toFixed(1)} after a pro career`);
console.log('fired most often:', Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('Air Force coach OVR', coachOvr(d1.coaches!.find((c) => c.team === 0)!.ratings));
