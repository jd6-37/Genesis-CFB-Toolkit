// Team ratings and home weather tests (Teams tab, Team Swap, CFB 27 conversion), against real ROMs
// (bring your own; .md/.bin/.gen or .zip): the original BW95, CF97, and the two Elevated v1.1.0
// editions (the original game with the Elevated and the Elevated 2026 Season Edition patches):
//   npx tsx cli/teamstest.ts BW95 CF97 ELEVATED ELEVATED_2026
// The CFB 27 data is the built-in file, public/data/ea-cfb27-ratings-2026-week9.csv.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { strict as assert } from 'node:assert';
import { openRom } from '../src/core/romfile';
import { parseBw95 } from '../src/core/bw95';
import { parseCf97 } from '../src/core/cf97';
import { buildRom, defaultSlot, swapFile } from '../src/core/build';
import { openRosterRom } from '../src/core/rosterRom';
import { readSheet } from '../src/core/rosterSheet';
import { applyCfb27, convertCfb27 } from '../src/core/rosterCfb27';
import { carryEdits, editsSince } from '../src/core/workRom';
import { CFB27_LATEST } from '../src/core/cfb27Latest';
import {
  OVR_TABLE, groupAt, hasOvrTable, ovrFromSim, ratingChanges, ratingProblems, readRating, readSim, readWeather, restoreTeam,
  simFromOvr, starterOvr, weatherChances, weatherWord, writeRating, writeWeather,
} from '../src/core/teamRatings';
import { rw } from '../src/core/bytes';

const [bwPath, cfPath, e94Path, e26Path] = process.argv.slice(2);
if (!e26Path) {
  console.error('usage: tsx cli/teamstest.ts BW95 CF97 ELEVATED ELEVATED_2026');
  process.exit(2);
}
const read = async (p: string) => (await openRom(basename(p), new Uint8Array(readFileSync(p)))).data;
const bw = await read(bwPath);
const cf = await read(cfPath);
const e94 = await read(e94Path);
const e26 = await read(e26Path);
const csvBytes = new Uint8Array(readFileSync(join(import.meta.dirname, '..', 'public', CFB27_LATEST.file)));
let passed = 0;
const ok = (name: string) => {
  passed++;
  console.log('ok -', name);
};
const names = parseBw95(bw).map((t) => t.school);
const T = (n: string) => {
  const i = names.indexOf(n);
  assert.ok(i >= 0, n);
  return i;
};
const diff = (a: Uint8Array, b: Uint8Array) => {
  const out: number[] = [];
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) out.push(k);
  return out;
};

// 1. The original game: EA's words, no OVR table.
{
  assert.deepEqual(ratingProblems(bw), []);
  assert.equal(hasOvrTable(bw), false);
  const off = names.map((_, t) => readSim(bw, t).off).sort((a, b) => a - b);
  const def = names.map((_, t) => readSim(bw, t).def).sort((a, b) => a - b);
  assert.deepEqual(off, [15, 18, 18, 23, 25, 28, 28, 30, 40, 45, 48, 48, 50, 53, 53, 55, 55, 55, 58, 58, 58, 60, 60, 60, 65, 68, 70, 73, 76, 77, 80, 80, 83, 93, 95, 100]);
  assert.deepEqual(def, [0, 24, 38, 38, 38, 40, 42, 43, 46, 48, 52, 54, 56, 58, 58, 60, 64, 66, 68, 70, 70, 74, 76, 78, 80, 82, 84, 84, 84, 86, 86, 88, 88, 90, 92, 100]);
  assert.deepEqual(readSim(bw, T('BYU')), { off: 55, def: 0 });
  assert.deepEqual(readRating(bw, T('BYU')), { off: 82, def: 62 }); // the OVRs the words stand for
  assert.deepEqual(readWeather(bw, T('Washington')), [1, 2, 7, 0]);
  assert.deepEqual(readWeather(bw, T('Wisconsin')), [1, 1, 1, 7]);
  assert.deepEqual(readWeather(bw, T('Texas')), [9, 1, 0, 0]);
  ok('original ROM: EA offense/defense words and home weather read as documented; no OVR table');
}

// 2. Writing without a table: the words only; OVRs 62-98 round-trip, others clamp.
{
  const d = new Uint8Array(bw);
  const t = T('Texas');
  for (let o = 62; o <= 98; o++) {
    writeRating(d, t, { off: o, def: 160 - o });
    assert.equal(readRating(d, t).off, o);
  }
  writeRating(d, t, { off: 50, def: 99 });
  assert.deepEqual(readSim(d, t), { off: 0, def: 100 });
  assert.deepEqual(readRating(d, t), { off: 62, def: 98 });
  writeWeather(d, t, [5, 2, 2, 1]);
  assert.equal(rw(d, groupAt(d, t)), 0x5221);
  const g = groupAt(d, t);
  assert.deepEqual(diff(bw, d).filter((k) => k < g || k >= g + 6), [], 'only the group changes');
  assert.equal(rw(d, g + 6), rw(bw, g + 6), 'the conference word stays');
  assert.deepEqual(ratingChanges(bw, d), [t]);
  restoreTeam(d, bw, t);
  assert.deepEqual(diff(bw, d), []);
  assert.deepEqual(weatherChances([5, 2, 2, 1]), [50, 20, 20, 10]);
  assert.deepEqual(weatherChances([0, 0, 0, 0]), [100, 0, 0, 0]);
  assert.equal(weatherWord([15, 0, 0, 16]), 0xf00f);
  assert.equal(simFromOvr(80), 50);
  assert.equal(ovrFromSim(50), 80);
  ok('original ROM: ratings write the 0-100 words only (62-98 exact, clamped outside); weather word; undo');
}

// 3. Elevated v1.1.0: the OVR table (Game Setup) and the words written together.
{
  assert.equal(hasOvrTable(e94), true);
  assert.deepEqual(readRating(e94, T('Florida State')), { off: 96, def: 98 });
  assert.deepEqual(readRating(e94, T('BYU')), { off: 82, def: 62 });
  const d = new Uint8Array(e94);
  const t = T('Navy');
  writeRating(d, t, { off: 75, def: 81 });
  assert.deepEqual(readRating(d, t), { off: 75, def: 81 });
  assert.deepEqual(readSim(d, t), { off: simFromOvr(75), def: simFromOvr(81) });
  const g = groupAt(d, t);
  const at = OVR_TABLE + 4 + 2 * t;
  assert.deepEqual(diff(e94, d).filter((k) => !(k >= g + 2 && k < g + 6) && !(k >= at && k < at + 2)), []);
  assert.deepEqual(ratingChanges(e94, d), [t]);
  restoreTeam(d, e94, t);
  assert.deepEqual(diff(e94, d), []);
  ok('Elevated v1.1.0: OVRs from its table; a change writes the table and the sim words, nothing else');
}

// 4. The 2026 Season Edition was made with the same starter method: the built-in CFB 27 data gives its table.
const sheet = await readSheet(CFB27_LATEST.file, csvBytes);
{
  assert.equal(hasOvrTable(e26), true);
  const rom = openRosterRom(e26);
  const plan = convertCfb27(rom, sheet);
  assert.equal(plan.teams.length, 36);
  for (const t of plan.teams) {
    assert.deepEqual({ off: t.ovr.off, def: t.ovr.def }, readRating(e26, t.team), `${t.teamName} OVR`);
    assert.deepEqual(readSim(e26, t.team), { off: simFromOvr(t.ovr.off), def: simFromOvr(t.ovr.def) }, `${t.teamName} sim`);
  }
  // starterOvr by hand for one team
  const idx = sheet.headers.indexOf('Team'), ip = sheet.headers.indexOf('Position'), io = sheet.headers.indexOf('Overall');
  const tex = sheet.rows.filter((r) => r[idx] === 'Texas').map((r) => ({ pos: r[ip], ovr: Number(r[io]) }));
  const s = starterOvr(tex);
  assert.equal(s.nOff, 11);
  assert.equal(s.nDef, 11);
  ok(`2026 Season Edition: all 36 OVRs and sim words = the built-in ${CFB27_LATEST.season} Week ${CFB27_LATEST.week} starters (e.g. Texas ${s.off}/${s.def})`);
}

// 5. Team Swap: the new team's CF97 ratings and weather by default; old swap files unchanged.
const bwT = parseBw95(bw);
const cfT = parseCf97(cf);
const cfOf = (n: string) => cfT.find((c) => c.school === n)!;
{
  const tul = defaultSlot(bwT[T('Pitt')], cfOf('Tulane'));
  assert.deepEqual(tul.ovr, [74, 75]);
  assert.deepEqual(tul.weather, [9, 1, 0, 0]);
  const out = buildRom(bw, bwT, cfT, [tul]).rom;
  assert.deepEqual(readRating(out, T('Pitt')), { off: 74, def: 75 });
  assert.deepEqual(readWeather(out, T('Pitt')), [9, 1, 0, 0]);
  // A swap file from before (no ovr/weather): the slot keeps its own, as before.
  const { ovr: _o, weather: _w, ...old } = tul;
  const before = buildRom(bw, bwT, cfT, [old]).rom;
  assert.deepEqual(readSim(before, T('Pitt')), readSim(bw, T('Pitt')));
  assert.equal(rw(before, groupAt(before, T('Pitt'))), rw(bw, groupAt(bw, T('Pitt'))));
  const g = groupAt(out, T('Pitt'));
  assert.deepEqual(diff(before, out).filter((k) => !(k >= g && k < g + 6) && k !== 0x18e && k !== 0x18f && (k < 0x1e6430 || k > 0x1e6433)), []);
  // Edited values, and the swap file keeps them.
  const mine = { ...tul, ovr: [88, 61] as [number, number], weather: [0, 0, 3, 7] };
  const mineOut = buildRom(bw, bwT, cfT, [mine]).rom;
  assert.deepEqual(readRating(mineOut, T('Pitt')), { off: 88, def: 62 }); // 61 is below what the words hold
  assert.deepEqual(JSON.parse(JSON.stringify(swapFile([mine]))).swaps[0].weather, [0, 0, 3, 7]);
  // On Elevated v1.1.0 the table gets the exact OVRs, so Game Setup shows them.
  const eOut = buildRom(e94, parseBw95(e94), cfT, [defaultSlot(parseBw95(e94)[T('Pitt')], cfOf('Tulane'))]).rom;
  assert.deepEqual(readRating(eOut, T('Pitt')), { off: 74, def: 75 });
  assert.equal(eOut[OVR_TABLE + 4 + 2 * T('Pitt')], 74);
  ok('Team Swap: CF97 ratings and weather by default (Tulane 74/75, Fair 9 Windy 1); edits kept; old swap files build as before; Elevated table');
}

// 6. CFB 27 conversion sets OFF/DEF from the starters (on request), and the working ROM tracks and carries them.
{
  const swap = buildRom(bw, bwT, cfT, [defaultSlot(bwT[T('Pitt')], cfOf('Kentucky'))]).rom;
  const work = new Uint8Array(swap);
  const rom = openRosterRom(work, true);
  const plan = convertCfb27(rom, sheet);
  const ky = plan.teams.find((t) => t.team === T('Pitt'))!;
  assert.equal(ky.sheetTeam, 'Kentucky');
  applyCfb27(rom, plan);
  for (const t of plan.teams) writeRating(work, t.team, t.ovr);
  assert.deepEqual(readRating(work, T('Pitt')), { off: Math.max(62, ky.ovr.off), def: Math.max(62, ky.ovr.def) });
  const e = editsSince(swap, work, 'bw95');
  assert.equal(e.teams, true);
  assert.equal(e.rosters, true);
  // Carry to a new swap result (Pitt → Kentucky plus Army → Indiana), with the base as the app does.
  const two = buildRom(bw, bwT, cfT, [defaultSlot(bwT[T('Pitt')], cfOf('Kentucky')), defaultSlot(bwT[T('Army')], cfOf('Indiana'))]).rom;
  const kept = new Uint8Array(two);
  const r = carryEdits(work, kept, swap);
  assert.ok(r.teams >= 30, `${r.teams} teams carried`);
  assert.deepEqual(readRating(kept, T('Pitt')), readRating(work, T('Pitt')));
  writeWeather(work, T('Texas'), [1, 2, 3, 4]);
  const kept2 = new Uint8Array(two);
  carryEdits(work, kept2, swap);
  assert.deepEqual(readWeather(kept2, T('Texas')), [1, 2, 3, 4]);
  ok(`CFB 27 conversion: OFF/DEF from the starters (Kentucky ${ky.ovr.off}/${ky.ovr.def}); tracked as a Teams edit and carried by slot`);
}

// 7. Damaged ROMs are refused.
{
  const d = new Uint8Array(bw);
  d[groupAt(d, 0) + 3] = 200;
  assert.ok(ratingProblems(d).length);
  ok('ratings outside 0-100 refused');
}

console.log(`${passed} passed`);
