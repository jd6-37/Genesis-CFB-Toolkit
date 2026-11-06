// Roster engine tests against real ROMs (bring your own; .md/.bin/.gen or .zip):
//   npx tsx cli/rostertest.ts BW95.md CF96.md CF97.md
// The sheet fixtures in cli/fixtures/ are made-up players.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import {
  openRosterRom, readPlayer, teamLayout, fixChecksums, eaChecksumOk, findEaChecksum, jerseyNumber,
} from '../src/core/rosterRom';
import { exportRostersCsv } from '../src/core/rosterExport';
import { importSheet, teamMatcher } from '../src/core/rosterImport';
import { parseCsv, readSheet, toCsv } from '../src/core/rosterSheet';
import { ratingToNibble, weightToNibble, type Game } from '../src/core/rosterLayouts';
import { openRom } from '../src/core/romfile';

const paths = process.argv.slice(2);
if (paths.length !== 3) {
  console.error('usage: tsx cli/rostertest.ts BW95 CF96 CF97');
  process.exit(2);
}
const raw: Record<string, Uint8Array> = {};
for (const [g, p] of (['bw95', 'cf96', 'cf97'] as Game[]).map((g, i) => [g, paths[i]] as const)) {
  raw[g] = (await openRom(basename(p), new Uint8Array(readFileSync(p)))).data;
}
const load = (g: Game) => new Uint8Array(raw[g]);
const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);
let passed = 0;
const ok = (name: string) => { passed++; console.log('ok -', name); };

// 1. Buckets match the exe's tables.
const exeRating = (r: number) => [[0, 5], [6, 12], [13, 19], [20, 25], [26, 32], [33, 39], [40, 45], [46, 52], [53, 59], [60, 65], [66, 72], [73, 79], [80, 85], [86, 92], [93, 98]].findIndex(([a, b]) => r >= a && r <= b);
for (let r = 0; r <= 120; r++) assert.equal(ratingToNibble(r), r >= 99 ? 15 : exeRating(r), `rating ${r}`);
for (let w = 100; w <= 420; w++) {
  const exp = w <= 155 ? 0 : w >= 380 ? 15 : Math.floor((w - 156) / 16) + 1;
  assert.equal(weightToNibble(w), exp, `weight ${w}`);
}
ok('rating and weight buckets = exe');

// 2. Export → import round-trip leaves every ROM byte-identical; checksums still valid.
for (const g of ['bw95', 'cf96', 'cf97'] as const) {
  const orig = load(g);
  const rom = openRosterRom(orig);
  const csv = exportRostersCsv(rom);
  const sheet = parseCsv(csv);
  const fresh = openRosterRom(orig);
  const rep = importSheet(fresh, sheet);
  assert.equal(rep.unknownTeams.length, 0, `${g} unknown teams ${JSON.stringify(rep.unknownTeams)}`);
  assert.equal(rep.teams.length, rom.teams.length);
  assert.ok(rep.teams.every((t) => t.mode === 'slots' && t.unfilled.length === 0));
  fixChecksums(fresh.data, g);
  assert.ok(fresh.data.every((b, i) => b === orig[i]), `${g} round-trip differs`);
  assert.ok(eaChecksumOk(fresh.data, g));
  ok(`${g}: export → import is byte-identical (${rom.teams.length} teams, ${sheet.rows.length} rows)`);
}

// 3. Team names: ROM names, schools, the exe's names, "Pittsburgh", case/punctuation.
{
  const m = teamMatcher(openRosterRom(load('bw95')));
  const cases: [string, string][] = [
    ['Army Cadets', 'Army'], ['Stanford Cardinals', 'Stanford'], ['Pittsburgh Panthers', 'Pitt'], ['pittsburgh', 'Pitt'],
    ['TEXAS A&M', 'Texas A&M'], ['Texas', 'Texas'], ['Washington St.', 'Washington State'], ['Washington', 'Washington'],
  ];
  const rom = openRosterRom(load('bw95'));
  for (const [name, school] of cases) assert.equal(rom.teams[m(name)!]?.school, school, name);
  const m97 = teamMatcher(openRosterRom(load('cf97')));
  const r97 = openRosterRom(load('cf97'));
  for (const [name, school] of [['Miami', 'Miami'], ['Miami of Ohio Redskins', 'Miami of Ohio'], ['Mississippi State Bulldogs', 'Mississippi St.'],
    ['Virginia Tech Hokies', 'Virginia Tech'], ['North Texas Mean Green', 'North Texas'], ['USMA Black Knights', 'USMA']] as [string, string][]) {
    assert.equal(r97.teams[m97(name)!]?.school, school, name);
  }
  ok('team name matching');
}

// 4. Ranked import (the exe's rules) on a synthetic sheet.
{
  const H = ['Team', 'Position', 'First Name', 'Last Name', 'Overall Rating', 'Jersey Number', 'Weight', 'Speed',
    'Quickness', 'Awareness', 'Power', 'Catching', 'Blocking', 'Tackling', 'Throw Power', 'Throw Accuracy', 'Kick Power', 'Kick Accuracy'];
  const rows: (string | number)[][] = [];
  const add = (team: string, pos: string, name: string, ovr: number | '', no: number, extra: Record<string, number> = {}) => {
    const base: Record<string, number> = { Weight: 200, Speed: 80, Quickness: 70, Awareness: 60, Power: 50, Catching: 40, Blocking: 30, Tackling: 20, 'Throw Power': 90, 'Kick Power': 10, 'Kick Accuracy': 99 };
    const v = { ...base, ...extra };
    rows.push(H.map((h) => (h === 'Team' ? team : h === 'Position' ? pos : h === 'First Name' ? name : h === 'Last Name' ? 'X' : h === 'Overall Rating' ? ovr : h === 'Jersey Number' ? no : v[h] ?? '')));
  };
  // Alabama (4-3)
  add('Alabama', 'QB', 'qb2', 70, 12); add('Alabama', 'QB', 'qb1', 90, 7, { Weight: 222, Speed: 99, Quickness: 93, Awareness: 5, 'Throw Power': 86, Power: 0 });
  add('Alabama', 'HB', 'hb3', 60, 30); add('Alabama', 'RB', 'hb1', 95, 22); add('Alabama', 'HB', 'hb2', 80, 25);
  for (let k = 0; k < 6; k++) add('Alabama', 'WR', `wr${k}`, 90 - k, 80 + k);
  add('Alabama', 'LOLB', 'lolb1', 88, 40); add('Alabama', 'LOLB', 'lolb2', 70, 41); add('Alabama', 'ROLB', 'rolb1', 85, 42); add('Alabama', 'ROLB', 'rolb2', 75, 43);
  add('Alabama', 'MLB', 'mlb1', 90, 50); add('Alabama', 'MLB', 'mlb2', 89, 51);
  add('Alabama', 'DT', 'dt1', 91, 90); add('Alabama', 'DT', 'dt2', 85, 91); add('Alabama', 'DT', 'dt3', 80, 92);
  for (let k = 0; k < 5; k++) add('Alabama', 'CB', `cb${k}`, 90 - k, 1 + k);
  add('Alabama', 'K', 'k', 77, 99, { 'Kick Power': 95, 'Kick Accuracy': 60 });
  add('Alabama', 'LS', 'ls', 50, 60); add('Atlantis', 'QB', 'nobody', 99, 1);
  // Washington (3-4 in the game, 4-3 in the exe's list because of a typo)
  add('Washington Huskies', 'DT', 'nt1', 80, 95); add('Washington Huskies', 'DT', 'dt2', 70, 96);
  add('Washington Huskies', 'MLB', 'ilb1', 88, 52); add('Washington Huskies', 'MLB', 'ilb2', 87, 53);

  const rom = openRosterRom(load('bw95'));
  const before = openRosterRom(load('bw95'));
  const rep = importSheet(rom, parseCsv(toCsv(H, rows)));
  const team = (school: string) => rom.teams.find((t) => t.school === school)!.index;
  const al = team('Alabama'), wa = team('Washington');
  const slotOf = (t: number, label: string) => teamLayout(rom, t).find((d) => d.label === label)!;
  const num = (t: number, label: string) => jerseyNumber(readPlayer(rom, t, slotOf(t, label).slot).numberByte);
  const expect: [string, number][] = [['QB', 7], ['HB1', 22], ['HB2', 25], ['SE', 80], ['FL', 81], ['WR1', 82], ['WR2', 83],
    ['LOLB', 40], ['MLB', 50], ['ROLB', 42], ['PLB', 43], ['LDT', 90], ['RDT', 91], ['LCB1', 1], ['RCB1', 2], ['LCB2', 3], ['RCB2', 4], ['K', 99]];
  for (const [label, n] of expect) assert.equal(num(al, label), n, `Alabama ${label}`);
  // QB ratings: Weight 222 → 5, Quickness 93 → E, Speed 99 → F, Awareness 5 → 0, Range (Throw Power 86) → D, Power 0 → 0.
  assert.deepEqual(readPlayer(rom, al, 0).ratings, [5, 14, 15, 0, 13, 0]);
  // K: Range ← Kick Power 95 → E, Accuracy ← Kick Accuracy 60 → 9.
  const k = readPlayer(rom, al, slotOf(al, 'K').slot).ratings;
  assert.deepEqual([k[4], k[5]], [14, 9]);
  // Slots with no players keep their bytes (e.g. FB, LT, P, RDE, SS).
  for (const label of ['FB', 'LT', 'P', 'RDE', 'SS', 'TE1']) {
    const s = slotOf(al, label).slot;
    assert.deepEqual(readPlayer(rom, al, s), readPlayer(before, al, s), `Alabama ${label} untouched`);
  }
  const ra = rep.teams.find((t) => t.team === al)!;
  assert.ok(ra.unfilled.includes('FB') && ra.unfilled.includes('RDE'));
  assert.equal(ra.unusedRows, 9); // qb2, hb3, wr4, wr5, lolb2, mlb2, dt3, cb4, ls
  ok('ranked import: slot assignment, buckets, untouched slots');
  // Washington is 3-4 in the game: best DT → NT, MLBs → LILB/RILB.
  assert.equal(rom.teams[wa].threeFour, true);
  assert.equal(num(wa, 'NT'), 95);
  assert.equal(num(wa, 'LILB'), 52);
  assert.equal(num(wa, 'RILB'), 53);
  ok('Washington uses the 3-4 slots (NT, LILB, RILB)');
  assert.deepEqual(rep.unknownTeams, [{ name: 'Atlantis', rows: 1 }]);
  assert.deepEqual(rep.unknownPositions, [{ position: 'LS', rows: 1 }]);
  ok('unknown teams and positions are reported');
}

// 5. Checksum check patched out by the exe is restored.
for (const g of ['bw95', 'cf96', 'cf97'] as const) {
  const orig = load(g);
  const d = new Uint8Array(orig);
  const c = findEaChecksum(d, g)!;
  d[c.bneAt] = 0x4e; d[c.bneAt + 1] = 0x71;
  d[c.constAt] ^= 0xff; // wrong constant, like after the exe's edits
  const res = fixChecksums(d, g);
  assert.ok(res.restoredCheck);
  assert.ok(d.every((b, i) => b === orig[i]), `${g} not restored`);
  ok(`${g}: exe's checksum patch undone`);
}

// 6. CSV dialects and XLSX.
{
  const semi = '﻿Team;Position;Overall Rating;Weight\r\n"Texas";QB;85,0;"2""10"\r\n';
  const s = parseCsv(semi);
  assert.deepEqual(s.headers, ['Team', 'Position', 'Overall Rating', 'Weight']);
  assert.deepEqual(s.rows, [['Texas', 'QB', '85,0', '2"10']]);
  ok('CSV: BOM, semicolons, quotes, decimal comma');
  const sheet = await readSheet('sample.xlsx', new Uint8Array(readFileSync(fixture('sample.xlsx'))));
  const csv = parseCsv(readFileSync(fixture('sample.csv'), 'utf8'));
  assert.deepEqual(sheet.headers, csv.headers);
  assert.deepEqual(sheet.rows, csv.rows);
  ok(`XLSX = CSV (${sheet.rows.length} rows)`);
}

console.log(`\n${passed} passed`);
