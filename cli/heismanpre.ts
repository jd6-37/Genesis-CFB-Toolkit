// Prints the preseason Heisman favorites: the first season of a new dynasty and, with a full season's save, the
// second season after the computer runs the offseason.
//   npx tsx cli/heismanpre.ts ELEVATED_ROM [FULL_SEASON.srm]
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { createDynasty, importSave, type Dynasty, type DSeason } from '../src/core/dynasty/model';
import { createDynasty1994 } from '../src/core/dynasty/create1994';
import { editionOfRom } from '../src/core/dynasty/edition';
import * as Off from '../src/core/dynasty/offseason';
import { preseasonHeisman } from '../src/core/dynasty/heismanPre';
import { preseasonPoll } from '../src/core/dynasty/poll';
import { CFB27_LATEST } from '../src/core/cfb27Latest';

const [romPath, savePath] = process.argv.slice(2);
const rom = (await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data;
const is94 = editionOfRom(rom)?.id === '1994';
const d0 = is94
  ? createDynasty1994(rom, readFileSync('public/data/rosters-1994.csv', 'utf8'), { name: 'h', seed: 5, id: 'h' })
  : createDynasty(rom, readFileSync(new URL(`../public/${CFB27_LATEST.file}`, import.meta.url), 'utf8'), { name: 'h', seed: 5, id: 'h' });

function show(d: Dynasty, s: DSeason) {
  const rank = new Map((preseasonPoll(d, s) ?? []).map((e) => [e.team, e.rank]));
  console.log(`\n${s.year} preseason Heisman favorites (${is94 ? '1994' : '2026'} edition, season ${d.seasons.indexOf(s) + 1})`);
  preseasonHeisman(d, s).forEach((h, i) => {
    const p = d.players[h.player - 1];
    const r = rank.get(h.team);
    console.log(`${String(i + 1).padStart(2)}. ${h.role.padEnd(2)} #${p.jersey} ${p.first} ${p.last}, ${d.teams[h.team].school}${r && r <= 25 ? ` (No. ${r})` : ''}: OVR ${h.ovr}${h.last ? `; last year ${h.last}` : ''}  [${h.score.toFixed(3)}]`);
  });
}
show(d0, d0.seasons[0]);
if (savePath) {
  const d1 = importSave(d0, new Uint8Array(readFileSync(savePath)), { allowOlder: true }).dynasty;
  let o = Off.startOffseason(d1, { seed: 3, force: true });
  o = Off.confirmDepth(o);
  o = Off.runPortal(o);
  o = Off.runSigningDay(o, Off.recruitTemplates(o));
  o = Off.applyCuts(o, {}, Off.recruitTemplates(o));
  o = Off.finishOffseason(o);
  show(o, o.seasons[1]);
}
