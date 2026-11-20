// Starting a dynasty in steps (src/core/dynasty/setup.ts; user, 2026-11-20).
// npm run test:setup -- ELEVATED_2026 [ELEVATED_1994] [PLAIN_SAVE_2026]
// - startSetup: the first season on an app-built ROM, with the ROM's real schedule (REALTAB).
// - Conferences: two teams that trade conferences trade schedules (the real one stays); a change of team counts makes
//   a new schedule (losesRealSchedule says so first).
// - Coaches: hire from the pool (the school's coach goes to the pool), fire, swap, open jobs filled; coaches stay with
//   their schools when conferences change.
// - The season-1 ROM: the schedule set (14 weeks, the real games moved), the impact table, the coaches' sim effect.
// - A save from a season not started on the dynasty's ROM is refused (optional third argument).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openRom } from '../src/core/romfile';
import { createDynasty, importSave, type Dynasty } from '../src/core/dynasty/model';
import { createDynasty1994 } from '../src/core/dynasty/create1994';
import { withCoaches } from '../src/core/dynasty/coaches';
import { confSetupOf, losesRealSchedule, setConferences } from '../src/core/dynasty/conferences';
import { coachChanges, fillOpenJobs, openJobs, realScheduleNow, setupFire, setupHire, setupLock, setupSchedule, setupSwap, startSetup } from '../src/core/dynasty/setup';
import { readRealSchedule } from '../src/core/dynasty/schedule';
import { seasonRom } from '../src/core/dynasty/offseason';
import { readImpactTable } from '../src/core/dynasty/impact';
import { scheduleAddress } from '../src/core/dynasty/dynastyArea';
import { editionOfRom } from '../src/core/dynasty/edition';

let n = 0;
const ok = (what: string) => { n++; console.log(`ok - ${what}`); };
const [p26, p94, plain] = process.argv.slice(2);
const u32 = (d: Uint8Array, a: number) => ((d[a] << 24) >>> 0) + (d[a + 1] << 16) + (d[a + 2] << 8) + d[a + 3];

for (const path of [p26, p94].filter(Boolean)) {
  const rom = (await openRom(path, new Uint8Array(readFileSync(path)))).data;
  const is94 = editionOfRom(rom)?.id === '1994';
  let d: Dynasty = is94
    ? createDynasty1994(rom, readFileSync('public/data/rosters-1994.csv', 'utf8'), { name: 'x', seed: 1 })
    : createDynasty(rom, readFileSync('public/data/ea-cfb27-ratings-2026-week9.csv', 'utf8'), { name: 'x', seed: 1 });
  d = withCoaches(d, JSON.parse(readFileSync(`public/data/coaches-${is94 ? '1994' : '2026'}.json`, 'utf8')));
  d = startSetup(d, rom);
  const real = readRealSchedule(rom, d.teams.length)!;
  const s0 = d.seasons[0];
  assert.ok(d.seasonOneRom && s0.schedule?.real && s0.schedule.weeks === 14 && s0.schedule.games.length === real.games.length);
  assert.equal(setupLock(d), null);
  const [A, B] = is94 ? ['Kansas', 'Kentucky'] : ['Tulane', 'Kentucky'];
  const a = d.teams.find((t) => t.school === A)!.index, b = d.teams.find((t) => t.school === B)!.index;
  const games = (dd: Dynasty, t: number) => dd.seasons[0].schedule!.games.filter((x) => x.visitor === t || x.home === t)
    .map((x) => `${x.week}:${x.home === t ? 'h' : 'v'}`).join();
  const opps = (dd: Dynasty, t: number) => dd.seasons[0].schedule!.games.filter((x) => x.visitor === t || x.home === t).map((x) => (x.home === t ? x.visitor : x.home)).sort().join();
  const coachA = d.seasons[0].coach![a];
  ok(`${is94 ? '1994' : '2026'}: the real schedule (${real.games.length} games, 14 weeks) for the first season`);

  // A swap keeps the real schedule: A plays B's games and B plays A's.
  const c = confSetupOf(d, d.seasons[0]);
  const ca = c.conf[a]; c.conf[a] = c.conf[b]; c.conf[b] = ca;
  assert.equal(losesRealSchedule(d, c), false);
  const before = d;
  d = setConferences(d, c);
  assert.ok(d.seasons[0].schedule!.real);
  assert.equal(games(d, a), games(before, b));
  assert.equal(games(d, b), games(before, a));
  assert.equal(opps(d, a).split(',').length, opps(before, b).split(',').length);
  assert.equal(d.seasons[0].coach![a], coachA, 'coaches stay with their schools');
  assert.ok(realScheduleNow(d, rom), 'the real schedule is still available');
  ok(`${A} and ${B} trade conferences and schedules; coaches stay`);

  // A move that changes counts: warned, then a new schedule; the real one isn't available until counts match again.
  const c2 = confSetupOf(d, d.seasons[0]);
  const third = d.teams.find((t) => t.index !== a && t.index !== b && c2.conf[t.index] !== c2.conf[a])!.index;
  c2.conf[third] = c2.conf[a];
  assert.equal(losesRealSchedule(d, c2), true);
  const d2 = setConferences(d, c2);
  assert.ok(!d2.seasons[0].schedule!.real);
  assert.equal(realScheduleNow(d2, rom), null);
  assert.throws(() => setupSchedule(d2, rom, 'real'), /can't be used/);
  const d3 = setupSchedule(d, rom, 'new', 7);
  assert.ok(!d3.seasons[0].schedule!.real && setupSchedule(d3, rom, 'real').seasons[0].schedule!.real);
  ok('a count change makes a new schedule; the real one comes back when counts match');

  // Coaches: fire, hire from the pool, swap; open jobs filled.
  const start = d.setupCoaches!;
  let e = setupFire(d, a);
  assert.deepEqual(openJobs(e), [a]);
  const pool = e.coaches!.filter((x) => x.status === 'pool');
  e = setupHire(e, pool[0].id, a);
  assert.equal(e.seasons[0].coach![a], pool[0].id);
  e = setupSwap(e, a, b);
  assert.equal(e.seasons[0].coach![b], pool[0].id);
  assert.equal(e.coaches![coachA!].status, 'pool');
  e = fillOpenJobs(setupFire(e, b));
  assert.equal(openJobs(e).length, 0);
  assert.ok(coachChanges(e, start).length >= 2);
  ok('coaches: fire, hire from the pool, swap, open jobs filled');

  // The season-1 ROM.
  e = { ...e, coachSim: true };
  const out = seasonRom(e, e.seasons[0], rom);
  const at = scheduleAddress(out)!;
  assert.equal(String.fromCharCode(...out.subarray(at, at + 4)), 'SCH1');
  assert.equal(out[at + 4], 14);
  assert.equal(readImpactTable(out)?.length, d.teams.length, 'the impact table in season 1');
  const ovrs = u32(out, 0x3e0018);
  const plainOut = seasonRom({ ...e, coachSim: false }, e.seasons[0], rom);
  let moved = 0;
  for (let t = 0; t < d.teams.length; t++) moved += Number(out[ovrs + 4 + 2 * t] !== plainOut[ovrs + 4 + 2 * t]) + Number(out[ovrs + 5 + 2 * t] !== plainOut[ovrs + 5 + 2 * t]);
  assert.ok(moved > 0, 'coaches affect the sim: team OVRs in the dynasty area');
  ok(`season-1 ROM: SCH1 (14 weeks), IMP1, ${moved} team sides moved by coaches`);

  if (!is94 && plain) {
    assert.throws(() => importSave(e, new Uint8Array(readFileSync(plain))), /isn't from your dynasty's 2026 ROM/);
    ok('a save from another ROM is refused');
  }
}
console.log(`${n} passed`);
