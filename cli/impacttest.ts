// Impact players in the Dynasty app (src/core/dynasty/impact.ts): the ROM's pick on each team.
// npm run test:impact -- ELEVATED_2026_138 [ELEVATED_1994]
// - On the ROM's own rosters, and on a new dynasty's first season (the steps the app derives from the players), the
//   same three slots for every team (so the app marks the same players as the game's Team Rosters).
// - Three different players a team: the first an offensive skill player, the second a defender; a fullback only
//   when no halfback is picked.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openRom } from '../src/core/romfile';
import { openRosterRom, readPlayer } from '../src/core/rosterRom';
import { impactSlots, impactSet, teamImpact } from '../src/core/dynasty/impact';
import { createDynasty } from '../src/core/dynasty/model';
import { createDynasty1994 } from '../src/core/dynasty/create1994';
import { editionOfRom } from '../src/core/dynasty/edition';

let n = 0;
const ok = (what: string) => { n++; console.log(`ok - ${what}`); };
const OFF = new Set([0, 1, 2, 3, 9, 10, 11, 12, 13, 14]);

for (const path of process.argv.slice(2)) {
  const rom = (await openRom(path, new Uint8Array(readFileSync(path)))).data;
  const rr = openRosterRom(rom);
  const fromRom = rr.teams.map((t) => impactSlots(Array.from({ length: 32 }, (_, s) => readPlayer(rr, t.index, s).ratings)));
  for (const picks of fromRom) {
    assert.equal(picks.length, 3);
    assert.equal(new Set(picks).size, 3);
    assert.ok(OFF.has(picks[0]) && !OFF.has(picks[1]), 'offense first, then defense');
    if (picks.includes(3)) assert.ok(!picks.includes(1) && !picks.includes(2), 'a fullback only without a halfback');
  }
  const is94 = editionOfRom(rom)?.id === '1994';
  const d = is94
    ? createDynasty1994(rom, readFileSync('public/data/rosters-1994.csv', 'utf8'), { name: 'x', seed: 1 })
    : createDynasty(rom, readFileSync('public/data/ea-cfb27-ratings-2026-week9.csv', 'utf8'), { name: 'x', seed: 1 });
  const s = d.seasons[0];
  for (const t of d.teams) {
    const want = fromRom[t.index].map((slot) => s.slots[t.index][slot]);
    assert.deepEqual(teamImpact(d, s, t.index), want, `${t.school}: the dynasty's first season picks as the ROM`);
  }
  assert.equal(impactSet(d, s).size, 3 * d.teams.length);
  if (!is94) {
    const om = d.teams.find((t) => t.school === 'Ole Miss')!.index;
    const pos = teamImpact(d, s, om).map((id) => s.slots[om].indexOf(id));
    assert.ok(pos.includes(0) && pos.includes(1), 'Ole Miss: QB and HB1 (as the game marks them)');
  }
  ok(`${is94 ? '1994' : '2026'}: ${d.teams.length} teams, the ROM's picks and the dynasty's agree`);
}
console.log(`${n} passed`);
