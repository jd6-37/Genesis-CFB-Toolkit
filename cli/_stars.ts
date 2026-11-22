import { loadRom, newDynasty, playSeason, runOffseason } from './dynastysim';
import { enableNil } from '../src/core/dynasty/nil';
const rom = await loadRom('/tmp/t22/t26.md');
let d = newDynasty(rom, 3); if (process.argv[2] === 'nil') d = enableNil(d);
const P4 = new Set(['SEC', 'Big Ten', 'ACC', 'Big 12']);
for (let y = 0; y < 3; y++) {
  d = playSeason(d, rom, 50 + y); d = runOffseason(d, 90 + y);
  const s = d.seasons.at(-1)!;
  const tier = (t: number) => (P4.has(s.confNames[s.conf[t]]) ? 'P4' : 'G5');
  const ev = (s.events ?? []).filter((e) => e.kind === 'signed') as { team: number; stars: number }[];
  const c: Record<string, number> = {};
  for (const e of ev) c[`${tier(e.team)}${e.stars}`] = (c[`${tier(e.team)}${e.stars}`] ?? 0) + 1;
  console.log(s.year, 'signed', ev.length, 'walkons', (s.events ?? []).filter((e) => e.kind === 'walkon').length, Object.keys(c).sort().map((k) => `${k}:${c[k]}`).join(' '));
}
