// How much the coaches' sim effect (coachEffects.ts `simNudge`) changes simulated games, before it is turned on.
// A Monte Carlo copy of the season sim's touchdown rule with the shipped settings (H-016: K 8, 5 chances a quarter,
// roll 1100, home edge 16; field goals left out, so scores are a little lower than the game's), and the nudges the
// edition's real head coaches would get.
//   npx tsx cli/coachsimstudy.ts
import { readFileSync } from 'node:fs';
import { simFromOvr } from '../src/core/teamRatings';
import { simNudges } from '../src/core/dynasty/coachEffects';
import type { CoachData } from '../src/core/dynasty/coachData';
import { coachesFromData } from '../src/core/dynasty/coaches';

const K = 8, CHANCES = 5, R = 1100, H = 16;
let seed = 12345;
const rand = (n: number) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
const d3 = (off: number, def: number, home: boolean) => Math.max(20, Math.min(300, 150 + (K / 4) * (simFromOvr(off) - simFromOvr(def)) + (home ? H : 0)));
function game(a: { off: number; def: number }, b: { off: number; def: number }, aHome: boolean): [number, number] {
  let sa = 0, sb = 0;
  const da = d3(a.off, b.def, aHome), db = d3(b.off, a.def, !aHome);
  for (let q = 0; q < 4 * CHANCES; q++) {
    if (rand(R - 2 * da) <= da) sa += 7;
    if (rand(R - 2 * db) <= db) sb += 7;
  }
  return [sa, sb];
}
function winRate(a: { off: number; def: number }, b: { off: number; def: number }, n = 200000): number {
  let w = 0, t = 0;
  for (let i = 0; i < n; i++) { const [x, y] = game(a, b, i % 2 === 0); if (x > y) w++; else if (x === y) t++; }
  return (w + t / 2) / n;
}
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

console.log('Win rate against an equal team (home and away alternating), by the nudge to both OFF and DEF:');
for (const base of [72, 80, 88]) {
  const even = { off: base, def: base };
  const row = [-1, 0, 1].map((n) => `${n >= 0 ? '+' : ''}${n}: ${pct(winRate({ off: base + n, def: base + n }, even))}`);
  console.log(`  OVR ${base}: ${row.join('  ')}`);
}
console.log('One side only (+1 OFF):', pct(winRate({ off: 81, def: 80 }, { off: 80, def: 80 })));

for (const year of [1994, 2026]) {
  const data = JSON.parse(readFileSync(`public/data/coaches-${year}.json`, 'utf8')) as CoachData;
  // The edition's schools: every head coach's school (the dynasty's teams have the same names).
  const schools = [...new Set(data.coaches.filter((c) => c.role === 'HC').map((c) => c.school as string))];
  const heads = coachesFromData({ startYear: year, teams: schools.map((school, index) => ({ school, index })) as never }, data).filter((c) => c.team !== null);
  const nudges = simNudges({ coachSim: true, coaches: heads } as never, heads.map((_, i) => i));
  const hist = new Map<string, number>();
  for (const n of nudges) hist.set(`${n.off}/${n.def}`, (hist.get(`${n.off}/${n.def}`) ?? 0) + 1);
  const best = nudges.reduce((a, n) => Math.max(a, n.off + n.def), -9), worst = nudges.reduce((a, n) => Math.min(a, n.off + n.def), 9);
  const extra = (n: { off: number; def: number }) => 12 * (winRate({ off: 80 + n.off, def: 80 + n.def }, { off: 80, def: 80 }, 40000) - 0.5);
  console.log(`\n${year}: ${heads.length} head coaches; OFF/DEF nudges: ${[...hist].sort().map(([k, v]) => `${k} ×${v}`).join(', ')}`);
  console.log(`  best coach ${best >= 0 ? '+' : ''}${best} in all (about ${extra({ off: Math.ceil(best / 2), def: Math.floor(best / 2) }).toFixed(2)} wins in 12 games against equal teams), worst ${worst} (${extra({ off: Math.ceil(worst / 2), def: Math.floor(worst / 2) }).toFixed(2)})`);
}
