// Walsh Report editor tests, against real ROMs (bring your own; .md/.bin/.gen or .zip): the original
// BW95, CF97 and, optionally, the Elevated 2026 Season Edition v1.1.0 (the 36-team one; the 138-team
// edition of v2.0.0 isn't edited by these tools):
//   npx tsx cli/walshtest.ts BW95 CF97 [ELEVATED_2026_v1.1.0]
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import { isWideBw95, openRom } from '../src/core/romfile';
import { openRosterRom } from '../src/core/rosterRom';
import { readSheet } from '../src/core/rosterSheet';
import { applyCfb27, convertCfb27 } from '../src/core/rosterCfb27';
import { CFB27_LATEST } from '../src/core/cfb27Latest';
import { reportsForSlots, walshDataProblems, WALSH_DATA, type WalshData } from '../src/core/walsh2026';
import { parseBw95 } from '../src/core/bw95';
import { parseCf97 } from '../src/core/cf97';
import { buildRom, defaultSlot, swapFile, validateSlot } from '../src/core/build';
import { readSeason, writeSeason } from '../src/core/season';
import { carryEdits, editsSince } from '../src/core/workRom';
import { readWalsh, walshAt, WALSH_BASE, WALSH_END, WALSH_RELOC } from '../src/core/walsh';
import {
  REPORT_LIMIT, cleanText, editedReports, longReports, readReport, readReports, reportLength, reportProblems, restoreAllReports,
  restoreReport, showText, trimReport, wrapLines, writeReports,
} from '../src/core/walshReports';

const [bwPath, cfPath, e26Path] = process.argv.slice(2);
if (!cfPath) {
  console.error('usage: tsx cli/walshtest.ts BW95 CF97 [ELEVATED_2026]');
  process.exit(2);
}
const read = async (p: string) => (await openRom(basename(p), new Uint8Array(readFileSync(p)))).data;
const bw = await read(bwPath);
const cfTeams = parseCf97(await read(cfPath));
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
/** Every byte that differs, outside the Walsh text's own space and the checksums. */
const outside = (a: Uint8Array, b: Uint8Array) => {
  const out: number[] = [];
  for (let k = 0; k < a.length; k++) {
    if (a[k] === b[k] || (k >= WALSH_BASE && k < WALSH_END) || k === 0x18e || k === 0x18f || (k >= 0x1e6430 && k < 0x1e6434)) continue;
    out.push(k);
  }
  return out;
};
const textFits = (rom: Uint8Array) => {
  const used = readWalsh(rom).map((p) => p + '\r').join('').length;
  return walshAt(rom) === WALSH_BASE && used <= WALSH_END - WALSH_BASE && rom.subarray(WALSH_BASE + used, WALSH_END).every((b) => b === 0x20);
};
const mine = { offense: 'Pitt runs the ball. They pass when they must.', defense: 'The Panthers blitz on third down.' };

// 1. EA's reports: lengths, the long ones, and how they're trimmed.
{
  const rs = readReports(bw);
  const lens = rs.map(reportLength);
  assert.equal(Math.min(...lens), 457);
  assert.equal(Math.max(...lens), 1010);
  assert.equal(lens[T('Ohio State')], 1010);
  assert.deepEqual(longReports(bw).map((s) => names[s]), [
    'Air Force', 'Arizona', 'BYU', 'California', 'Clemson', 'Nebraska', 'North Carolina', 'Notre Dame', 'Ohio State', 'Oklahoma',
    'Penn State', 'Pitt', 'Stanford', 'USC', 'Washington',
  ]);
  for (const s of longReports(bw)) {
    const r = rs[s];
    const t = trimReport(r);
    assert.ok(reportLength(t) <= REPORT_LIMIT && reportLength(t) > 450, names[s]);
    // whole sentences dropped from the end: each paragraph is a beginning of the original, ending a sentence
    for (const k of ['offense', 'defense'] as const) {
      assert.ok(r[k].startsWith(t[k]), names[s]);
      assert.match(t[k], /[.!?]["'\xd3\xd5)]*$/, names[s]);
    }
    assert.deepEqual(trimReport(t), t);
  }
  for (const s of rs.keys()) if (reportLength(rs[s]) <= REPORT_LIMIT) assert.deepEqual(trimReport(rs[s]), rs[s]);
  // A single long sentence is cut at a word and ends with a period.
  const one = trimReport({ offense: 'word '.repeat(200).trim(), defense: 'Short.' }, 100);
  assert.ok(reportLength(one) <= 100 && one.offense.endsWith('word.'));
  ok('EA reports: 457-1,010 characters, 15 over 650, trimmed at sentence ends to 650 or less');
}

// 2. What the editor accepts, and the preview's line wrapping.
{
  assert.deepEqual(reportProblems(mine), []);
  assert.deepEqual(reportProblems({ offense: 'Q X Z q x z 0-9 (a/b): 50% + "c" = #1; ok? yes! A&M.', defense: "It's fine." }), []);
  assert.match(reportProblems({ offense: 'A $ sign', defense: 'x' })[0], /can't show \$/);
  for (const c of ['*', '[', ']', '|', '<', '>', '@', '\\', '^', '`', '{', '}', '~', '_']) {
    assert.equal(reportProblems({ offense: `a ${c} b`, defense: 'x' }).length, 1, c);
  }
  assert.match(reportProblems({ offense: 'ABCDEFGHIJKLMNOPQRSTU is long', defense: 'x' })[0], /at most 20 characters/);
  assert.deepEqual(reportProblems({ offense: 'ABCDEFGHIJKLMNOPQRST fits', defense: 'x' }), []);
  assert.match(reportProblems({ offense: ' ', defense: 'x' })[0], /both the offense and the defense/);
  assert.match(reportProblems({ offense: 'a'.repeat(20).concat(' ').repeat(31), defense: 'x' })[0], /the most is 650/);
  assert.equal(cleanText('“Hi” ‘x’ a—b\nc'), '"Hi" \'x\' a-b c');
  assert.equal(showText('\xd2Okie\xd3 look, don\xd4t'), '"Okie" look, don\'t');
  assert.deepEqual(wrapLines('Ohio State aligns in a 4-3 defensive formation.'), ['Ohio State aligns in', 'a 4-3 defensive', 'formation.']);
  ok("the editor's checks: characters the font draws, 20-character words, 650 in all; line wrapping");
}

// 3. Saving a report: every long report is trimmed, the text stays in its space, nothing else changes.
{
  const rom = bw.slice();
  const trimmed = writeReports(rom, new Map([[T('Pitt'), mine]]));
  assert.equal(trimmed.length, 14); // the 15 long ones minus Pitt, which was written
  assert.deepEqual(readReport(rom, T('Pitt')), mine);
  assert.ok(textFits(rom));
  assert.deepEqual(outside(bw, rom), []);
  assert.deepEqual(longReports(rom), []);
  const before = readReports(bw);
  readReports(rom).forEach((r, s) => {
    if (s === T('Pitt')) return;
    assert.deepEqual(r, reportLength(before[s]) > REPORT_LIMIT ? trimReport(before[s]) : before[s], names[s]);
  });
  assert.deepEqual(readWalsh(rom).slice(0, 6), readWalsh(bw).slice(0, 6)); // the intro lines
  // Only Pitt counts as edited; the trims don't.
  assert.deepEqual(editedReports(bw, rom), [T('Pitt')]);
  assert.equal(editsSince(bw, rom, 'bw95').teams, true);
  // A second save trims nothing more.
  assert.deepEqual(writeReports(rom, new Map([[T('Texas'), mine]])), []);
  assert.deepEqual(editedReports(bw, rom), [T('Pitt'), T('Texas')]);
  assert.throws(() => writeReports(rom, new Map([[0, { offense: 'a $ b', defense: 'x' }]])), /can't show/);
  ok('saving a report trims the 14 other long ones once, stays in place, changes nothing else');
}

// 4. Undo: one report back (trimmed, since the others are), then all of them (the trims go too).
{
  const rom = bw.slice();
  writeReports(rom, new Map([[T('Pitt'), mine], [T('Texas'), mine]]));
  restoreReport(rom, bw, T('Pitt'));
  assert.deepEqual(readReport(rom, T('Pitt')), trimReport(readReport(bw, T('Pitt'))));
  restoreReport(rom, bw, T('Texas'));
  assert.deepEqual(readReport(rom, T('Texas')), readReport(bw, T('Texas')));
  assert.deepEqual(editedReports(bw, rom), []);
  restoreAllReports(rom, bw);
  assert.deepEqual(Array.from(rom), Array.from(bw));
  assert.equal(editsSince(bw, rom, 'bw95').any, false);
  ok('undo: a report comes back (trimmed if the others are), undo of all of them restores every byte');
}

// 5. Team Swap: an edited report in the swap file; without one the build is as before.
{
  const pitt = parseBw95(bw)[T('Pitt')];
  const sc = defaultSlot(pitt, cfTeams.find((c) => c.school === 'Tulane')!);
  const plain = buildRom(bw, parseBw95(bw), cfTeams, [sc]).rom;
  const withReport = { ...sc, walsh: ['Tulane runs the option.', 'The Green Wave play a 3-4.'] as [string, string] };
  assert.deepEqual(validateSlot(withReport), []);
  const built = buildRom(bw, parseBw95(bw), cfTeams, [withReport]);
  assert.deepEqual(readReport(built.rom, T('Pitt')), { offense: withReport.walsh[0], defense: withReport.walsh[1] });
  assert.deepEqual(longReports(built.rom), []);
  assert.ok(textFits(built.rom));
  assert.deepEqual(outside(plain, built.rom), []);
  // Same result as building without the report and saving it in the Teams tab.
  const after = plain.slice();
  writeReports(after, new Map([[T('Pitt'), { offense: withReport.walsh[0], defense: withReport.walsh[1] }]]));
  assert.deepEqual(readReports(after), readReports(built.rom));
  // The swap file keeps it; a bad one is caught.
  const sf = JSON.parse(JSON.stringify(swapFile([withReport])));
  assert.deepEqual(sf.swaps[0].walsh, withReport.walsh);
  assert.match(validateSlot({ ...sc, walsh: ['a * b', 'x'] }).join(), /Walsh Report/);
  ok('Team Swap: an edited report goes in (long ones trimmed), an unedited one is renamed as before');
}

// 6. Carrying edits to a new Team Swap result: by slot, only where the slot holds the same team.
{
  const teams = parseBw95(bw);
  const one = buildRom(bw, teams, cfTeams, [defaultSlot(teams[T('Pitt')], cfTeams.find((c) => c.school === 'Tulane')!)]).rom;
  const work = one.slice();
  writeReports(work, new Map([[T('Texas'), mine], [T('Pitt'), mine]])); // Pitt's slot holds Tulane here
  const next = buildRom(bw, teams, cfTeams, [defaultSlot(teams[T('Pitt')], cfTeams.find((c) => c.school === 'Oregon')!)]).rom;
  const res = carryEdits(work, next, one);
  assert.deepEqual(readReport(next, T('Texas')), mine);
  assert.notDeepEqual(readReport(next, T('Pitt')), mine);
  assert.ok(res.skipped.some((l) => /Walsh Report of Tulane: its slot now holds Oregon/.test(l)));
  assert.ok(textFits(next));
  assert.deepEqual(longReports(next), []);
  ok('carried to a new swap: reports by slot when the team is the same, skipped when it changed');
}

// 7. A renamed conference (Season tab) changes Air Force's report but isn't a report edit.
{
  const rom = bw.slice();
  const s = readSeason(rom);
  s.names = s.names.map((n, i) => (i === 0 ? 'Southern' : n));
  writeSeason(rom, s);
  assert.match(readReport(rom, T('Air Force')).offense, /teams of the Southern\. *$/);
  assert.deepEqual(editedReports(bw, rom), []);
  assert.equal(editsSince(bw, rom, 'bw95').teams, false);
  // …and a report edit after it still counts.
  writeReports(rom, new Map([[T('Texas'), mine]]));
  assert.deepEqual(editedReports(bw, rom), [T('Texas')]);
  ok("a renamed conference's mention in Air Force's report doesn't count as a Walsh Report edit");
}

// 8. The Elevated 2026 Season Edition.
if (e26Path && isWideBw95(await read(e26Path))) {
  console.log('skip - 8: that is the 138-team 2026 Season Edition (v2.0.0 on); this test takes v1.1.0\'s 36-team edition');
} else if (e26Path) {
  const e26 = await read(e26Path);
  const n26 = parseBw95(e26).map((t) => t.school);
  const longBefore = longReports(e26).length; // 15 in the first build; 0 since its own 2026 reports (v1.1.0 as released)
  const rom = e26.slice();
  const tulane = n26.indexOf('Oklahoma');
  assert.ok(tulane >= 0);
  writeReports(rom, new Map([[tulane, mine]]));
  assert.ok(textFits(rom));
  assert.deepEqual(longReports(rom), []);
  assert.deepEqual(outside(e26, rom), []);
  assert.equal(rom.subarray(WALSH_RELOC, 0x200000).every((b) => b === 0xff), true);
  ok(`Elevated 2026 Season Edition: a report saved, ${longBefore ? `its ${longBefore} long ones trimmed, ` : ''}nothing else changed`);
}

// 9. The built-in 2026 Walsh Reports: one per team of the built-in CFB 27 rosters, all valid, and the
// Rosters tab's import puts them in the converted teams' slots.
{
  const data = JSON.parse(readFileSync(`public/${WALSH_DATA.file}`, 'utf8')) as WalshData;
  assert.deepEqual(walshDataProblems(data), []);
  assert.equal(data.season, CFB27_LATEST.season);
  assert.equal(data.week, CFB27_LATEST.week);
  const csvBytes = new Uint8Array(readFileSync(`public/${CFB27_LATEST.file}`));
  const sheet = await readSheet('week9.csv', csvBytes);
  const teamCol = sheet.headers.indexOf('Team');
  const csvTeams = new Set(sheet.rows.map((r) => r[teamCol]));
  assert.deepEqual(Object.keys(data.reports).sort(), [...csvTeams].sort());
  assert.deepEqual(walshDataProblems({ ...data, version: 2 }), ['version 2 isn\'t supported']);
  assert.ok(walshDataProblems({ ...data, reports: { X: { offense: 'a {c}', defense: 'b' } } }).length > 0);

  const rom = openRosterRom(bw.slice());
  const plan = convertCfb27(rom, sheet);
  assert.equal(plan.teams.length, 36);
  applyCfb27(rom, plan);
  const picked = reportsForSlots(data, plan.teams);
  assert.equal(picked.size, 36);
  assert.deepEqual(writeReports(rom.data, picked), []);
  assert.ok(textFits(rom.data));
  for (const t of plan.teams) assert.deepEqual(readReport(rom.data, t.team), data.reports[t.sheetTeam]);
  assert.deepEqual(readReport(rom.data, T('Pitt')), data.reports.Pittsburgh);
  assert.deepEqual(longReports(rom.data), []);
  // Some teams only: theirs replaced, the long EA reports of the others trimmed, the rest kept.
  const some = openRosterRom(bw.slice());
  const two = plan.teams.filter((t) => ['Pittsburgh', 'Ohio State'].includes(t.sheetTeam));
  const trimmed = writeReports(some.data, reportsForSlots(data, two));
  assert.ok(trimmed.length > 0 && !trimmed.includes(T('Ohio State')));
  assert.deepEqual(readReport(some.data, T('Ohio State')), data.reports['Ohio State']);
  assert.deepEqual(readReport(some.data, T('Miami')), readReport(bw, T('Miami')));
  ok(`built-in ${data.season} Walsh Reports: ${Object.keys(data.reports).length} teams = the CFB 27 CSV's, valid; all 36 written with the conversion, or some with the long others trimmed`);
}

console.log(`${passed} passed`);
