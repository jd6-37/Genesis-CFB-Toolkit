// Roster engine tests against real ROMs (bring your own; .md/.bin/.gen or .zip):
//   npx tsx cli/rostertest.ts BW95.md CF96.md CF97.md
// The sheet fixtures in cli/fixtures/ are made-up players.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import {
  openRosterRom, readPlayer, writePlayer, jerseyByte, teamLayout, fixChecksums, eaChecksumOk, findEaChecksum, jerseyNumber, getRating,
} from '../src/core/rosterRom';
import { exportRostersCsv } from '../src/core/rosterExport';
import { detectImport, importSheet, teamMatcher } from '../src/core/rosterImport';
import { parseCsv, readSheet, toCsv } from '../src/core/rosterSheet';
import { BW95_LABELS_43, GROUP_ATTRS, nibbleToWeight, ratingToNibble, weightToNibble, type Game } from '../src/core/rosterLayouts';
import { openRom } from '../src/core/romfile';
import { applyCfb27, bw95Role, CFB27_COLUMNS, convertCfb27 } from '../src/core/rosterCfb27';
import { installOlPatch, OL_PATCH, olPatchState, restoreOlPatch } from '../src/core/rosterOlPatch';
import { stockDistributionsJson } from './stockdists';
import STOCK from '../src/core/rosterStockDists.json';
import { createHash } from 'node:crypto';
import { writeRating, readRating } from '../src/core/teamRatings';
import { canCarry, carryEdits, editsSince } from '../src/core/workRom';

const paths = process.argv.slice(2);
const widePath = paths.length === 4 ? paths.pop()! : undefined; // optional: the 138-team 2026 Season Edition (v2.0.0)
if (paths.length !== 3) {
  console.error('usage: tsx cli/rostertest.ts BW95 CF96 CF97 [ELEVATED_2026_v2]');
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

// 7. Stock rating distributions: the committed table comes from the stock ROMs.
{
  const sha = (d: Uint8Array) => createHash('sha1').update(d).digest('hex');
  const stock = (['bw95', 'cf96', 'cf97'] as Game[]).every((g) => sha(raw[g]) === STOCK.games[g].romSha1);
  if (stock) {
    const fresh = stockDistributionsJson((['bw95', 'cf96', 'cf97'] as Game[]).map((g) => raw[g]));
    assert.equal(fresh, readFileSync(new URL('../src/core/rosterStockDists.json', import.meta.url), 'utf8'));
    ok('stock distribution table = the stock ROMs');
  } else {
    console.log('skip - stock distribution table (these are not the three stock ROMs)');
  }
}

// 8. CFB 27 conversion on made-up players.
// A league for all 36 BW95 schools, every rating random. Pitt is written "Pittsburgh" and California "Cal"
// (CFB 27's names). Odd-numbered teams have no FB, Air Force has no K, Army has no LOLB.
let seed = 27;
const rnd = (lo: number, hi: number) => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return lo + Math.floor((((x ^ (x >>> 14)) >>> 0) / 4294967296) * (hi - lo + 1));
};
const CFB_HEAD = [...CFB27_COLUMNS, 'Height (in)'];
function cfbLeague(teams: { name: string; positions: string[] }[]): string {
  let id = 1000;
  const rows: (string | number)[][] = [];
  for (const t of teams) {
    for (const pos of t.positions) {
      rows.push(CFB_HEAD.map((h) => {
        if (h === 'Team') return t.name;
        if (h === 'Name') return `${pos} ${id}`;
        if (h === 'Position') return pos;
        if (h === 'EA Player ID') return id++;
        if (h === 'Overall') return rnd(60, 95);
        if (h === 'Jersey Number') return rnd(0, 99);
        if (h === 'Weight') return rnd(170, 340);
        if (h === 'Height (in)') return 74;
        return rnd(40, 99);
      }));
    }
  }
  return toCsv(CFB_HEAD, rows);
}
const FULL = ['QB', 'QB', 'HB', 'HB', 'HB', 'FB', 'WR', 'WR', 'WR', 'WR', 'WR', 'TE', 'TE', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'RT',
  'K', 'P', 'LE', 'RE', 'RE', 'DT', 'DT', 'DT', 'LOLB', 'MLB', 'MLB', 'MLB', 'ROLB', 'ROLB', 'CB', 'CB', 'CB', 'CB', 'CB', 'FS', 'FS', 'SS'];
{
  const rom = openRosterRom(load('bw95'));
  const league = rom.teams.map((t, i) => {
    let positions = [...FULL];
    if (i % 2) positions = positions.filter((p) => p !== 'FB');
    if (t.school === 'Air Force') positions = positions.filter((p) => p !== 'K');
    if (t.school === 'Army') positions = positions.filter((p) => p !== 'LOLB');
    return { name: t.school === 'Pitt' ? 'Pittsburgh' : t.school === 'California' ? 'Cal' : t.school, positions };
  });
  league.push({ name: 'Atlantis', positions: ['QB', 'HB'] }); // not in the ROM
  const sheet = parseCsv(cfbLeague(league));
  assert.equal(detectImport(rom, sheet).path, 'cfb27');
  const plan = convertCfb27(rom, sheet);
  assert.equal(plan.teams.length, 36);
  assert.deepEqual(plan.unmatchedRomTeams, []);
  assert.equal(plan.otherSheetTeams, 1);
  assert.ok(plan.teams.every((t) => t.unfilled.length === 0));
  const byName = (s: string) => plan.teams.find((t) => rom.teams[t.team].school === s)!;
  assert.equal(byName('Pitt').sheetTeam, 'Pittsburgh');
  assert.equal(byName('California').sheetTeam, 'Cal');
  ok('CFB 27: sheet detected, 36 teams matched (Cal, Pittsburgh), Atlantis skipped');

  assert.equal(applyCfb27(rom, plan), 36 * 32);
  // Every role × rating has exactly the stock distribution (N = M for every role).
  const counts: Record<string, Record<string, number[]>> = {};
  for (const t of rom.teams) for (const def of teamLayout(rom, t.index)) {
    const p = readPlayer(rom, t.index, def.slot);
    for (const a of GROUP_ATTRS[def.group]) ((counts[bw95Role(def.slot, t.threeFour, false)] ??= {})[a] ??= Array(16).fill(0))[getRating(p, def, a)!]++;
  }
  for (const [role, ref] of Object.entries(STOCK.games.bw95.roles)) {
    for (const [a, c] of Object.entries(ref.ratings)) assert.deepEqual(counts[role][a], c, `${role} ${a}`);
  }
  ok('CFB 27: every role × rating keeps the stock distribution exactly');

  // Fallbacks: FB from the best blocking back (HB/TE), the punter kicks for Air Force, Army's LOLB from ROLB/MLB.
  const fill = (s: string, label: string) => byName(s).fills.find((f) => f.label === label)!;
  for (const t of plan.teams.filter((x) => x.team % 2)) {
    const f = t.fills.find((x) => x.slot === 3)!;
    assert.equal(f.how, 'fallback');
    const backs = sheet.rows.filter((r) => r[0] === t.sheetTeam && (r[2] === 'HB' || r[2] === 'TE'));
    const fb = (r: string[]) => ['Lead Block', 'Run Block', 'Strength', 'Trucking'].reduce((s, c) => s + Number(r[CFB_HEAD.indexOf(c)]), 0);
    const used = new Set(t.fills.filter((x) => x.slot !== 3).map((x) => x.player.id));
    const best = backs.filter((r) => !used.has(Number(r[6]))).sort((a, b) => fb(b) - fb(a))[0];
    assert.equal(f.player.id, Number(best[6]), `${t.teamName} FB`);
  }
  assert.equal(fill('Air Force', 'K').player, fill('Air Force', 'P').player);
  assert.equal(fill('Air Force', 'K').how, 'fallback');
  assert.ok(['ROLB', 'MLB'].includes(fill('Army', 'LOLB').player.pos) && fill('Army', 'LOLB').how === 'fallback');
  ok('CFB 27: fallbacks (FB from HB/TE by blocking, shared K/P, LOLB)');

  // Deterministic: the same sheet gives the same bytes.
  const again = openRosterRom(load('bw95'));
  applyCfb27(again, convertCfb27(again, sheet));
  assert.ok(again.data.every((b, i) => b === rom.data[i]));
  ok('CFB 27: same sheet, same bytes');
}
{
  // Ties: two QBs with the same ratings. Higher Overall gets the higher steps; same Overall, lower EA Player ID.
  const rom = openRosterRom(load('bw95'));
  const sheetFor = (ovrA: number, ovrB: number) => {
    const base = parseCsv(cfbLeague([{ name: 'Texas', positions: ['QB'] }, { name: 'Ohio State', positions: ['QB'] }]));
    const [a, b] = base.rows;
    for (let i = 7; i < CFB27_COLUMNS.length; i++) b[i] = a[i];
    b[CFB27_COLUMNS.indexOf('Weight')] = a[CFB27_COLUMNS.indexOf('Weight')];
    a[CFB27_COLUMNS.indexOf('Overall')] = String(ovrA);
    b[CFB27_COLUMNS.indexOf('Overall')] = String(ovrB);
    return base;
  };
  const qb = (plan: ReturnType<typeof convertCfb27>, s: string) => plan.teams.find((t) => rom.teams[t.team].school === s)!.fills[0].steps;
  const higher = (x: Record<string, number | undefined>, y: Record<string, number | undefined>) =>
    GROUP_ATTRS.QB.every((a) => x[a]! >= y[a]!) && GROUP_ATTRS.QB.some((a) => x[a]! > y[a]!);
  let plan = convertCfb27(rom, sheetFor(80, 90));
  assert.ok(higher(qb(plan, 'Ohio State'), qb(plan, 'Texas')));
  plan = convertCfb27(rom, sheetFor(85, 85)); // Texas has the lower EA Player ID
  assert.ok(higher(qb(plan, 'Texas'), qb(plan, 'Ohio State')));
  ok('CFB 27: ties go by Overall, then EA Player ID');
}
{
  // A few schools, one of them incomplete: converts what it can, the rest keeps its players.
  const rom = openRosterRom(load('bw95'));
  const before = openRosterRom(load('bw95'));
  const sheet = parseCsv(cfbLeague([{ name: 'Cal', positions: FULL }, { name: 'Navy', positions: ['QB', 'HB', 'WR'] }]));
  const plan = convertCfb27(rom, sheet);
  assert.equal(plan.teams.length, 2);
  assert.equal(plan.unmatchedRomTeams.length, 34);
  const navy = plan.teams.find((t) => rom.teams[t.team].school === 'Navy')!;
  assert.deepEqual(navy.fills.map((f) => f.label), ['QB', 'HB1', 'SE']);
  assert.ok(['HB2', 'FL', 'LT', 'K'].every((s) => navy.unfilled.includes(s)));
  applyCfb27(rom, plan, [navy.team]);
  const lt = teamLayout(rom, navy.team).find((d) => d.label === 'LT')!.slot;
  assert.deepEqual(readPlayer(rom, navy.team, lt), readPlayer(before, navy.team, lt));
  const cal = plan.teams.find((t) => rom.teams[t.team].school === 'California')!.team;
  assert.deepEqual(readPlayer(rom, cal, 0), readPlayer(before, cal, 0)); // not picked
  ok('CFB 27: partial file, incomplete team, only the picked teams written');
}
{
  // A CFB 27 sheet with a column missing is recognized and the column named.
  const rom = openRosterRom(load('bw95'));
  const full = parseCsv(cfbLeague([{ name: 'Texas', positions: FULL }]));
  const cut = full.headers.indexOf('Pursuit');
  const sheet = { headers: full.headers.filter((_, i) => i !== cut), rows: full.rows.map((r) => r.filter((_, i) => i !== cut)) };
  assert.equal(detectImport(rom, sheet).path, 'cfb27');
  assert.throws(() => convertCfb27(rom, sheet), /missing: Pursuit\./);
  ok('CFB 27: missing column named');
}

// 9. Import paths and defensive layouts (stock 4-3/3-4 vs Elevated).
{
  const elevate = (d: Uint8Array) => {
    const at = d.subarray(BW95_LABELS_43.start, BW95_LABELS_43.end);
    const i = String.fromCharCode(...at).indexOf('DLT');
    at.set([0x44, 0x54, 0x31], i); // "DT1": enough for the layout check
    return d;
  };
  const stock = openRosterRom(load('bw95'));
  const elevated = openRosterRom(elevate(load('bw95')));
  assert.ok(!stock.elevated && elevated.elevated);
  assert.deepEqual(teamLayout(elevated, 0).filter((d) => d.group === 'DL' || d.group === 'LB').map((d) => d.label),
    ['LDE', 'DT1', 'DT2', 'RDE', 'LOLB', 'MLB1', 'ROLB', 'MLB2']);
  const stockCsv = parseCsv(exportRostersCsv(stock));
  const elevatedCsv = parseCsv(exportRostersCsv(elevated));
  assert.equal(detectImport(stock, stockCsv).path, 'slots');
  assert.equal(detectImport(elevated, elevatedCsv).path, 'slots');
  const refused = detectImport(elevated, stockCsv);
  assert.equal(refused.path, 'refused');
  assert.match(refused.path === 'refused' ? refused.problems.join(' ') : '', /^13 teams use the Elevated .* NT, LILB, RILB\. Teams: Air Force, Army, Clemson/);
  assert.equal(detectImport(stock, elevatedCsv).path, 'refused');
  assert.throws(() => importSheet(stock, elevatedCsv), /doesn't fit this ROM/);
  // Elevated ROMs take the stock 4-3 labels for the same slots (LDT = DT1, MLB = MLB1, RDT = DT2, PLB = MLB2).
  const fourThree = { headers: stockCsv.headers, rows: stockCsv.rows.filter((r) => !rom3_4(r[0])) };
  function rom3_4(team: string) { return stock.teams.some((t) => t.threeFour && `${t.school} ${t.nickname}` === team); }
  assert.equal(detectImport(elevated, fourThree).path, 'slots');
  // Round trip on an Elevated ROM.
  const copy = openRosterRom(elevate(load('bw95')));
  importSheet(copy, elevatedCsv);
  assert.ok(copy.data.every((b, i) => b === elevated.data[i]));
  // New receiver and cornerback labels (Elevated from v2.0.1-test17 / test11): same slots, new text; a Slot
  // sheet may use either set on either kind of Elevated ROM, and the round trip stays byte-identical.
  const relabel = (d: Uint8Array) => {
    const at = d.subarray(BW95_LABELS_43.start, BW95_LABELS_43.end);
    const i = String.fromCharCode(...at).indexOf('LCB1');
    assert.ok(i >= 0);
    at.set([0x43, 0x42, 0x31, 0x20], i); // "CB1 ": enough for the label check
    return d;
  };
  const renamed = openRosterRom(relabel(elevate(load('bw95'))));
  assert.ok(!elevated.newLabels && !stock.newLabels && renamed.newLabels);
  const bySlot = (r: typeof renamed) => Object.fromEntries(teamLayout(r, 0).map((d) => [d.slot, d.label]));
  assert.deepEqual([11, 12, 24, 25, 26, 27].map((n) => bySlot(renamed)[n]), ['WR3', 'WR4', 'CB1', 'CB3', 'CB2', 'CB4']);
  assert.deepEqual([11, 12, 24, 25, 26, 27].map((n) => bySlot(elevated)[n]), ['WR1', 'WR2', 'LCB1', 'LCB2', 'RCB1', 'RCB2']);
  assert.deepEqual(teamLayout(renamed, 0).filter((d) => d.pool.includes('CB')).map((d) => d.label), ['CB1', 'CB2', 'CB3', 'CB4']);
  const renamedCsv = parseCsv(exportRostersCsv(renamed));
  assert.ok(renamedCsv.rows.some((r) => r[1] === 'CB2') && !renamedCsv.rows.some((r) => /^[LR]CB|^WR[12]$/.test(r[1])));
  for (const [target, sheet] of [[renamed, renamedCsv], [renamed, elevatedCsv], [elevated, renamedCsv]] as const) {
    assert.equal(detectImport(target, sheet).path, 'slots');
    const c = openRosterRom(target.data.slice());
    importSheet(c, sheet);
    assert.ok(c.data.every((x, i) => x === target.data[i]));
  }
  // Duplicate slots and teams the ROM doesn't have.
  const dup = { headers: stockCsv.headers, rows: [stockCsv.rows[0], stockCsv.rows[0], ['Atlantis Tritons', ...stockCsv.rows[1].slice(1)]] };
  const d = detectImport(stock, dup);
  assert.ok(d.path === 'refused' && /QB appears 2 times \(rows 2, 3\)/.test(d.problems.join(' ')));
  const unknown = { headers: stockCsv.headers, rows: [stockCsv.rows[0], ['Atlantis Tritons', ...stockCsv.rows[1].slice(1)]] };
  assert.equal(detectImport(stock, unknown).path, 'slots');
  assert.deepEqual(importSheet(openRosterRom(load('bw95')), unknown).unknownTeams, [{ name: 'Atlantis Tritons', rows: 1 }]);
  // Sheets without a Slot column and without CFB 27 columns use the ranked import.
  assert.equal(detectImport(stock, parseCsv(readFileSync(fixture('sample.csv'), 'utf8'))).path, 'ranked');
  ok('import paths: slots, refused (other layout, duplicates), ranked; Elevated layout and labels, old and new');
}

// 10. OL weight display tweak.
{
  const orig = load('bw95');
  const d = new Uint8Array(orig);
  assert.equal(olPatchState(d), 'absent');
  assert.equal(installOlPatch(d), 'installed');
  assert.equal(olPatchState(d), 'installed');
  assert.equal(installOlPatch(d), 'already');
  // Shown weights: OL rows + 25 lb in the export; the import takes it off again.
  const rom = openRosterRom(d);
  const csv = parseCsv(exportRostersCsv(rom));
  const lt = teamLayout(rom, 0).find((x) => x.label === 'LT')!;
  const row = csv.rows.find((r) => r[0] === `${rom.teams[0].school} ${rom.teams[0].nickname}` && r[1] === 'LT')!;
  assert.equal(Number(row[4]), nibbleToWeight(getRating(readPlayer(rom, 0, lt.slot), lt, 'Weight')!) + OL_PATCH.pounds);
  const back = openRosterRom(new Uint8Array(d));
  importSheet(back, csv);
  assert.ok(back.data.every((b, i) => b === d[i]));
  restoreOlPatch(d, orig);
  assert.ok(d.every((b, i) => b === orig[i]));
  // Refuses to overwrite something else.
  const busy = new Uint8Array(orig);
  busy[OL_PATCH.hook + 7] = 0;
  assert.throws(() => installOlPatch(busy), /already uses 0x1EFF20-0x1EFF3D/);
  const other = new Uint8Array(orig);
  other[OL_PATCH.site] = 0x4e;
  assert.equal(olPatchState(other), 'unknown');
  assert.throws(() => installOlPatch(other), /not the original/);
  ok('OL weight tweak: install, idempotent, export/import +25, restore, refuses busy space');
}

// The 138-team 2026 Season Edition (Elevated v2.0.0): all 138 teams open, the built-in CFB 27 rosters
// rebuild its rosters and OVRs byte for byte, edits are tracked and carried, and the 36-team ROMs don't mix.
if (widePath) {
  const wide = (await openRom(basename(widePath), new Uint8Array(readFileSync(widePath)))).data;
  const rom = openRosterRom(wide);
  assert.equal(rom.wide, true);
  assert.equal(rom.teams.length, 138);
  assert.equal(rom.elevated, true);
  assert.deepEqual(['Air Force', 'Miami of Ohio', 'Western Kentucky'].map((n) => rom.teams.some((t) => t.school === n)), [true, true, true]);
  const sheet = await readSheet('week9.csv', new Uint8Array(readFileSync('public/data/ea-cfb27-ratings-2026-week9.csv')));
  const again = openRosterRom(wide);
  const plan = convertCfb27(again, sheet);
  assert.equal(plan.teams.length, 138);
  assert.deepEqual(plan.unmatchedRomTeams, []);
  applyCfb27(again, plan);
  for (const t of plan.teams) writeRating(again.data, t.team, t.ovr);
  assert.ok(again.data.every((b, i) => b === wide[i]), 'the conversion rebuilds the release byte for byte');
  // An edit of the last team: only its roster changes; tracked as a roster edit; Sega checksum fixed, EA's unchanged.
  const ed = openRosterRom(wide);
  const last = ed.teams.length - 1;
  const p = readPlayer(ed, last, 0);
  writePlayer(ed, last, 0, { ...p, numberByte: jerseyByte(77) });
  const sums = fixChecksums(ed.data, 'bw95');
  const diff = [...ed.data.keys()].filter((i) => ed.data[i] !== wide[i]);
  assert.ok(diff.every((i) => (i >= ed.teams[last].rosterOffset && i < ed.teams[last].rosterOffset + 128) || i === 0x18e || i === 0x18f));
  assert.ok(eaChecksumOk(ed.data, 'bw95') && sums.ea !== null);
  assert.deepEqual(editsSince(wide, ed.data, 'bw95'), { season: false, teams: false, rosters: true, any: true });
  const carried = wide.slice();
  carryEdits(ed.data, carried, wide);
  assert.equal(readPlayer(openRosterRom(carried), last, 0).numberByte, jerseyByte(77));
  assert.equal(canCarry(wide, load('bw95')), false);
  // OVRs live in the edition's own table (one entry per team), not the 36-team one at 0x10DFB0.
  const rr = wide.slice();
  writeRating(rr, 137, { off: 70, def: 71 });
  assert.deepEqual(readRating(rr, 137), { off: 70, def: 71 });
  assert.deepEqual(editsSince(wide, rr, 'bw95'), { season: false, teams: true, rosters: false, any: true });
  assert.ok(rr.subarray(0x10dfb0, 0x10e000).every((b, i) => b === wide[0x10dfb0 + i]));
  ok('138-team 2026 Season Edition: 138 teams, the built-in CFB 27 rosters rebuild it byte for byte, edits tracked and carried');
}

console.log(`\n${passed} passed`);
