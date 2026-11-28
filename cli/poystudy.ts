// Defenders in the Maxwell and Walter Camp races (user, 2026-11-28): on finished season saves, the gap between the
// best defender's blend and the offensive winner's, per award. Usage: npx tsx cli/poystudy.ts ROM SAVE...
import { readFileSync } from 'node:fs';
import { loadRom, newDynasty } from './dynastysim';
import { importSave } from '../src/core/dynasty/model';
import { seasonView } from '../src/core/dynasty/derive';
import { awardWatch, candidates, POSITION_AWARDS, poyDefenders, blendOf } from '../src/core/dynasty/awards';
const rom = await loadRom(process.argv[2]);
const base = newDynasty(rom, 1);
for (const f of process.argv.slice(3)) {
  const d = importSave(base, new Uint8Array(readFileSync(f))).dynasty;
  const v = seasonView(d, d.seasons[0]);
  const all = candidates(v);
  const out: string[] = [];
  for (const key of ['maxwell', 'camp']) {
    const a = POSITION_AWARDS.find((x) => x.key === key)!;
    const w = a.weight!;
    const win = awardWatch(v, a, all, 1)[0];
    const def = poyDefenders(v, all)[0];
    const got = awardWatch(v, a, all, 1)[0];
    out.push(`${key} → ${got.role}`);
    out.push(`gap ${(blendOf(def, w) - blendOf(win, w)).toFixed(3)} (${def.role} ${def.line} vs ${win.role} ${win.line.slice(0, 40)})`);
  }
  console.log(f.split('/').pop(), '|', out.join(' | '));
}
