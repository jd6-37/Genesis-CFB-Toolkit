// Team style tests against real ROMs (bring your own; .md/.bin/.gen or .zip):
//   npx tsx cli/stylestest.ts BW95 CF97 [more BW95 ROMs, e.g. Elevated builds]
// The emulator check (the CPU calling the new style's plays) is described in docs/styles.md.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import { openRom } from '../src/core/romfile';
import { eaChecksumOk, fixChecksums, openRosterRom, refreshThreeFour, teamLayout } from '../src/core/rosterRom';
import { parseBw95 } from '../src/core/bw95';
import { parseCf97 } from '../src/core/cf97';
import { buildRom, defaultSlot, isSwapFile, swapFile } from '../src/core/build';
import { carryEdits, editsSince, workFileName } from '../src/core/workRom';
import {
  DEFENSE, OFFENSE, POWER, RULE_TABLE, STYLE_RANGES, STYLE_TABLE, TEAMS, parseStyle, readStyle, readStyles, restoreStyle,
  rosterIs34, styleChanges, styleInfo, styleProblems, writeStyle,
} from '../src/core/styles';
import { readSeason, setName, writeSeason } from '../src/core/season';
import { CFB27, findCfb27 } from '../src/core/cfb27Styles';

const paths = process.argv.slice(2);
if (paths.length < 2) {
  console.error('usage: tsx cli/stylestest.ts BW95 CF97 [more BW95 ROMs]');
  process.exit(2);
}
const read = async (p: string) => (await openRom(basename(p), new Uint8Array(readFileSync(p)))).data;
const bw = await read(paths[0]);
const cf = await read(paths[1]);
const extra = await Promise.all(paths.slice(2).map(async (p) => ({ name: basename(p), data: await read(p) })));
let passed = 0;
const ok = (name: string) => {
  passed++;
  console.log('ok -', name);
};
const names = openRosterRom(bw).teams.map((t) => t.school);
const T = (n: string) => {
  const i = names.indexOf(n);
  assert.ok(i >= 0, n);
  return i;
};
/** Offsets where two ROMs differ. */
const diff = (a: Uint8Array, b: Uint8Array) => {
  const out: number[] = [];
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) out.push(k);
  return out;
};
const inRanges = (k: number, r: [number, number][]) => r.some(([s, e]) => k >= s && k < e);
const CHECKSUMS: [number, number][] = [[0x18e, 0x190], [0x1e6430, 0x1e6434]];

// 1. The original game's styles, as documented (claude notes / docs/styles.md).
{
  const want: Record<string, string[]> = {
    Option: ['Air Force', 'Army'],
    'Pro Style': ['Alabama', 'Arizona', 'Auburn', 'Boston College', 'Clemson', 'Florida State', 'Georgia', 'Kansas State', 'Navy',
      'Nebraska', 'North Carolina', 'Ohio State', 'Oklahoma', 'Penn State', 'Tennessee', 'Texas', 'Texas A&M', 'USC', 'Virginia',
      'West Virginia', 'Wisconsin'],
    Multiple: ['BYU', 'California', 'Colorado', 'Louisville', 'Michigan', 'Washington', 'Washington State'],
    Shotgun: ['Florida', 'LSU', 'Miami', 'Pitt', 'Stanford'],
    Power: ['Notre Dame'],
  };
  const wantD: Record<string, string[]> = {
    '3-4': ['Air Force', 'Army', 'Clemson', 'Colorado', 'Michigan', 'North Carolina', 'Notre Dame', 'Oklahoma', 'Texas', 'Texas A&M',
      'USC', 'Washington', 'Wisconsin'],
    '4-3': ['Alabama', 'Auburn', 'Boston College', 'BYU', 'California', 'Florida State', 'Georgia', 'Kansas State', 'LSU',
      'Louisville', 'Miami', 'Nebraska', 'Ohio State', 'Penn State', 'Pitt', 'Stanford', 'Tennessee', 'Virginia', 'Washington State',
      'West Virginia'],
    Multiple: ['Arizona', 'Florida', 'Navy'],
  };
  assert.deepEqual(styleProblems(bw), []);
  const st = readStyles(bw);
  for (const [n, teams] of Object.entries(want)) assert.deepEqual(names.filter((_, t) => OFFENSE[st[t].offense] === n), teams, n);
  for (const [n, teams] of Object.entries(wantD)) assert.deepEqual(names.filter((_, t) => DEFENSE[st[t].defense] === n), teams, n);
  // The original 3-4 roster flag is clear for exactly the 3-4 teams.
  for (let t = 0; t < TEAMS; t++) assert.equal(rosterIs34(bw, t), st[t].defense === 0, names[t]);
  assert.deepEqual(styleInfo(bw), { veer: false, elevated: false });
  ok('original ROM: 5 offense and 3 defense styles read as documented; 3-4 flags match');
}

// 2. Every team × every style: reads back, touches only the style table (and the 3-4 flag on the
//    original layout), keeps set 4 and the unused bits, and restores exactly.
for (const rom of [{ name: basename(paths[0]), data: bw }, ...extra]) {
  const info = styleInfo(rom.data);
  assert.deepEqual(styleProblems(rom.data), [], rom.name);
  const d = new Uint8Array(rom.data);
  for (let t = 0; t < TEAMS; t++) {
    for (let o = 0; o <= POWER; o++) {
      for (let df = 0; df < 3; df++) {
        writeStyle(d, t, { offense: o, defense: df });
        assert.deepEqual(readStyle(d, t), { offense: o, defense: df });
        let offSets = 0;
        for (let s = 0; s < 4; s++) offSets += (d[STYLE_TABLE + 8 * s + (t >> 3)] >> (t & 7)) & 1;
        assert.equal(offSets, o === POWER ? 0 : 1, 'one offense set at most');
        let defSets = 0;
        for (let s = 5; s < 8; s++) defSets += (d[STYLE_TABLE + 8 * s + (t >> 3)] >> (t & 7)) & 1;
        assert.equal(defSets, 1, 'exactly one defense set');
        if (!info.elevated) assert.equal(rosterIs34(d, t), df === 0, 'flag follows the defense');
      }
    }
    // Other teams untouched.
    for (let u = 0; u < TEAMS; u++) if (u !== t) assert.deepEqual(readStyle(d, u), readStyle(rom.data, u));
    restoreStyle(d, rom.data, t);
    assert.deepEqual(diff(d, rom.data), [], `restore ${names[t]}`);
  }
  // Only the style table and the 3-4 flags can change; never on Elevated's one roster layout.
  for (let t = 0; t < TEAMS; t++) writeStyle(d, t, { offense: (t * 7) % 5, defense: t % 3 });
  const changedAt = diff(d, rom.data);
  assert.ok(changedAt.every((k) => inRanges(k, STYLE_RANGES)));
  if (info.elevated) assert.ok(changedAt.every((k) => inRanges(k, [STYLE_RANGES[0]])), 'no flag change on Elevated');
  assert.deepEqual(d.subarray(STYLE_TABLE + 32, STYLE_TABLE + 40), rom.data.subarray(STYLE_TABLE + 32, STYLE_TABLE + 40), 'set 4');
  assert.deepEqual(styleProblems(d), []);
  fixChecksums(d, 'bw95');
  assert.ok(eaChecksumOk(d, 'bw95'));
  ok(`${rom.name}: every style on every team (veer ${info.veer}, Elevated layout ${info.elevated})`);
}

// 3. Damaged or moved tables are refused.
{
  const d = new Uint8Array(bw);
  d[STYLE_TABLE + 5] = 1;
  assert.ok(styleProblems(d).length);
  assert.throws(() => writeStyle(d, 0, { offense: 1, defense: 1 }), /can't be changed/);
  const e = new Uint8Array(bw);
  e[RULE_TABLE + 15] ^= 2;
  assert.ok(styleProblems(e).length);
  assert.throws(() => writeStyle(new Uint8Array(bw), 36, { offense: 1, defense: 1 }));
  assert.throws(() => writeStyle(new Uint8Array(bw), 0, { offense: 5, defense: 1 }));
  assert.equal(parseStyle('offense', 'pro style'), 1);
  assert.equal(parseStyle('defense', ' 4-3 '), 1);
  assert.equal(parseStyle('offense', 4), 4);
  assert.throws(() => parseStyle('offense', 'Spread'), /unknown offense style/);
  ok('damaged tables refused; bad teams and styles refused; names parsed');
}

// 4. The 3-4 flag drives the Rosters layout on the original ROM.
{
  const d = new Uint8Array(bw);
  const rom = openRosterRom(d, true);
  const fsu = T('Florida State');
  assert.equal(teamLayout(rom, fsu).find((s) => s.slot === 21)!.label, 'RDT');
  writeStyle(d, fsu, { offense: 1, defense: 0 });
  refreshThreeFour(rom);
  assert.equal(teamLayout(rom, fsu).find((s) => s.slot === 21)!.label, 'RILB');
  assert.equal(openRosterRom(d).teams[fsu].threeFour, true);
  writeStyle(d, fsu, { offense: 1, defense: 2 });
  refreshThreeFour(rom);
  assert.equal(teamLayout(rom, fsu).find((s) => s.slot === 21)!.label, 'RDT');
  ok('original layout: Rosters labels follow the defense (RDT ↔ RILB)');
}

// 5. Team Swap: no styles = the same bytes as before; styles change only the style bytes.
{
  const bwT = parseBw95(bw);
  const cfT = parseCf97(cf);
  const pitt = T('Pitt');
  const army = T('Army');
  const tul = cfT.find((c) => c.school === 'Tulane')!;
  const ind = cfT.find((c) => c.school === 'Indiana')!;
  const plain = [defaultSlot(bwT[pitt], tul), defaultSlot(bwT[army], ind)];
  const a = buildRom(bw, bwT, cfT, plain).rom;
  const b = buildRom(bw, bwT, cfT, plain.map((s) => ({ ...s, offense: undefined, defense: undefined }))).rom;
  assert.deepEqual(diff(a, b), []);
  const styled = [{ ...plain[0], offense: 'Option', defense: '3-4' }, { ...plain[1], offense: 'Pro Style', defense: '4-3' }];
  const c = buildRom(bw, bwT, cfT, styled).rom;
  assert.ok(diff(a, c).every((k) => inRanges(k, [...STYLE_RANGES, ...CHECKSUMS])));
  assert.deepEqual(readStyle(c, pitt), { offense: 0, defense: 0 });
  assert.deepEqual(readStyle(c, army), { offense: 1, defense: 1 });
  assert.equal(rosterIs34(c, pitt), true);
  assert.equal(rosterIs34(c, army), false);
  assert.deepEqual(styleChanges(a, c), [army, pitt].sort((x, y) => x - y));
  assert.ok(eaChecksumOk(c, 'bw95'));
  // Only one of the two given: the other stays the slot's.
  const d = buildRom(bw, bwT, cfT, [{ ...plain[0], defense: 'Multiple' }]).rom;
  assert.deepEqual(readStyle(d, pitt), { offense: 3, defense: 2 });
  // Swap files: styles round-trip; files without them still load.
  const f = JSON.parse(JSON.stringify(swapFile(styled)));
  assert.ok(isSwapFile(f));
  assert.equal(f.swaps[0].offense, 'Option');
  const old = JSON.parse(JSON.stringify(swapFile(plain)));
  assert.ok(isSwapFile(old) && old.swaps.every((s: object) => !('offense' in s)));
  assert.throws(() => buildRom(bw, bwT, cfT, [{ ...plain[0], offense: 'Spread' }]), /unknown offense style/);
  ok('Team Swap: unchanged without styles; with styles only the style bytes change; swap files round-trip');
}

// 6. The working ROM: edits, file names, carrying.
{
  const base = new Uint8Array(bw);
  const work = new Uint8Array(bw);
  writeStyle(work, T('Oklahoma'), { offense: 3, defense: 1 });
  let e = editsSince(base, work, 'bw95');
  assert.deepEqual({ ...e }, { season: false, teams: true, rosters: false, any: true });
  writeSeason(work, setName(readSeason(work), 0, 'SEC'));
  e = editsSince(base, work, 'bw95');
  assert.deepEqual({ ...e }, { season: true, teams: true, rosters: false, any: true });
  assert.equal(workFileName('BW [Season] [Styles].md', e), 'BW [Season] [Teams].md');
  assert.equal(workFileName('BW.md', { season: false, teams: true, rosters: true }), 'BW [Teams] [Rosters].md');
  restoreStyle(work, base, T('Oklahoma'));
  assert.equal(editsSince(base, work, 'bw95').teams, false);

  // Carry: with the base, only styles changed since loading go over (a new Team Swap result may
  // set its own); without it, every style that differs.
  const bwT = parseBw95(bw);
  const cfT = parseCf97(cf);
  const army = T('Army');
  const swapA = buildRom(bw, bwT, cfT, [{ ...defaultSlot(bwT[army], cfT.find((c) => c.school === 'Indiana')!), offense: 'Pro Style' }]).rom;
  const w = new Uint8Array(swapA);
  writeStyle(w, T('Oklahoma'), { offense: 3, defense: 1 });
  const swapB = buildRom(bw, bwT, cfT, [{ ...defaultSlot(bwT[army], cfT.find((c) => c.school === 'Indiana')!), offense: 'Multiple' }]).rom;
  const to = new Uint8Array(swapB);
  const r = carryEdits(w, to, swapA);
  assert.equal(r.teams, 1);
  assert.deepEqual(readStyle(to, T('Oklahoma')), { offense: 3, defense: 1 });
  assert.equal(readStyle(to, army).offense, 2, "the new swap's own style stays");
  const to2 = new Uint8Array(swapB);
  assert.equal(carryEdits(w, to2).teams, 2);
  assert.equal(readStyle(to2, army).offense, 1);
  ok('working ROM: style edits tracked and named; carried by slot (changed ones with a base)');
}

// 7. College Football 27 reference: the agreed mapping, and name matching for BW95 and CF97 teams.
{
  assert.equal(CFB27.length, 138);
  const count = (f: (t: (typeof CFB27)[number]) => string) =>
    Object.fromEntries(Object.entries(CFB27.reduce<Record<string, number>>((m, t) => ((m[f(t)] = (m[f(t)] ?? 0) + 1), m), {})).sort());
  assert.deepEqual(count((t) => OFFENSE[t.recommended.offense]), { Multiple: 31, Option: 3, Power: 4, 'Pro Style': 22, Shotgun: 78 });
  assert.deepEqual(count((t) => DEFENSE[t.recommended.defense]), { '3-4': 58, '4-3': 63, Multiple: 17 });
  assert.deepEqual(CFB27.filter((t) => t.recommended.offense === 0).map((t) => t.school), ['Air Force', 'Army', 'Navy']);
  // Every original BW95 team has a match.
  assert.deepEqual(names.filter((n) => !findCfb27(n)), []);
  assert.equal(findCfb27('Pitt')!.school, 'Pittsburgh');
  assert.equal(findCfb27('Miami')!.school, 'Miami FL');
  // CF97: all but Idaho (not in College Football 27).
  const cfNames = parseCf97(cf).map((c) => c.school);
  assert.equal(cfNames.length, 111);
  assert.deepEqual(cfNames.filter((n) => !findCfb27(n)), ['Idaho']);
  assert.equal(findCfb27('USMA')!.school, 'Army');
  assert.equal(findCfb27('Northeast LA.')!.school, 'UL Monroe');
  assert.equal(findCfb27('N.C. State')!.school, 'NC State');
  // Two CF97 names never point at the same CFB 27 team.
  const hits = cfNames.flatMap((n) => (findCfb27(n) ? [findCfb27(n)!.school] : []));
  assert.equal(new Set(hits).size, hits.length);
  // Examples: Army = Option + Multiple (the less trusted source's 3-4 isn't used), Iowa = Pro Style + 4-3.
  assert.deepEqual(findCfb27('USMA')!.recommended, { offense: 0, defense: 2 });
  assert.deepEqual(findCfb27('Iowa')!.recommended, { offense: 1, defense: 1 });
  assert.deepEqual(findCfb27('Michigan')!.recommended, { offense: 2, defense: 1 });
  assert.deepEqual(findCfb27('Texas')!.recommended, { offense: 3, defense: 0 });
  ok('College Football 27 reference: mapping totals, BW95 and CF97 names match (Idaho has none)');
}

console.log(`${passed} passed`);
