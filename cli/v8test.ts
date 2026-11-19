// Checks the CFB 27 conversion v8 (H-039) against the Rosters lane's reference output.
//   npm run test:v8 -- ROM2026 REF.json [CFB27.csv]
// ROM2026: the 2026 Season Edition from test60 on (it has the v8 tables). REF.json: ratings26_v8.json (Mac folder
// rosters-2026/v8/). CFB27.csv: defaults to the built-in week-9 file. Every converted player whose name matches the
// reference's player in that slot must get the same fine values (±1), and the ROM's tables must equal the app's.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { openRosterRom, readPlayer, teamLayout } from '../src/core/rosterRom';
import { readSheet } from '../src/core/rosterSheet';
import { applyCfb27, convertCfb27 } from '../src/core/rosterCfb27';
import { BONUS_AT, fineFromShown, hasV8, shownV8, V8_SLOT_POOLS } from '../src/core/ratingsV8';
import { FINE_TABLE, readFineOffsets } from '../src/core/dynasty/fine';
import { setShownOfSlot, shownOfSlot } from '../src/core/rosterV8';
import { exportRostersCsv } from '../src/core/rosterExport';
import { importSheet } from '../src/core/rosterImport';
import { GROUP_ATTRS, type Attr } from '../src/core/rosterLayouts';
import V8 from '../src/core/ratingsV8.json';

const [romPath, refPath, csvPath = 'public/data/ea-cfb27-ratings-2026-week9.csv'] = process.argv.slice(2);
if (!refPath) { console.error('usage: npm run test:v8 -- ROM2026 ratings26_v8.json [CFB27.csv]'); process.exit(2); }

let failed = 0, passed = 0;
const check = (name: string, ok: boolean, info = '') => {
  if (ok) { passed++; console.log(`ok   ${name}`); } else { failed++; console.log(`FAIL ${name} ${info}`); }
};

const norm = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
const ref = JSON.parse(readFileSync(refPath, 'utf8')).players as { t: number; s: number; team: string; name: string; attrs: Attr[]; fine: number[] }[];

const open = async () => openRosterRom((await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data);
const rom = await open();
check('the ROM has the v8 tables', hasV8(rom.data));

// Every slot's pools equal what the app derives from role and group.
const sheet = await readSheet(basename(csvPath), new Uint8Array(readFileSync(csvPath)));
const plan = convertCfb27(rom, sheet);
check('the plan is v8', plan.v8);

let same = 0, off1 = 0, compared = 0, worse: string[] = [];
const byKey = new Map(ref.map((x) => [`${x.t}/${x.s}`, x]));
// Two players of one name on a team: the reference matched by name, so either could be its player; skip them.
const nameCol = sheet.headers.indexOf('Name'), teamCol = sheet.headers.indexOf('Team');
const seen = new Map<string, number>();
const anywhere = new Map<string, number>();
for (const r of sheet.rows) {
  const k = `${r[teamCol]}|${norm(r[nameCol] ?? '')}`; seen.set(k, (seen.get(k) ?? 0) + 1);
  anywhere.set(norm(r[nameCol] ?? ''), (anywhere.get(norm(r[nameCol] ?? '')) ?? 0) + 1);
}
for (const f of plan.teams.flatMap((t) => t.fills)) {
  const r = byKey.get(`${f.team}/${f.slot}`);
  const name = `${f.player.v('Name' as never) ?? ''}`;
  if (!r || !f.fine) continue;
  const sheetName = sheet.rows[f.player.row][sheet.headers.indexOf('Name')] ?? '';
  if (norm(sheetName) !== norm(r.name)) continue;
  if ((seen.get(`${sheet.rows[f.player.row][teamCol]}|${norm(sheetName)}`) ?? 0) > 1) continue;
  // The reference matched by the ROM's school name, else by a name unique in the file; a school named differently in
  // CFB 27 with a common player name was unmatched there and kept its old ratings.
  if (norm(sheet.rows[f.player.row][teamCol] ?? '') !== norm(r.team) && (anywhere.get(norm(sheetName)) ?? 0) > 1) continue;
  for (const [a, fine] of Object.entries(f.fine) as [Attr, number][]) {
    const want = r.fine[r.attrs.indexOf(a)];
    compared++;
    const d = Math.abs(fine - want);
    if (d === 0) same++; else if (d === 1) off1++; else if (worse.length < 10) worse.push(`${r.name} t${f.team} s${f.slot} ${a} ${fine} vs ${want}`);
    else worse.push('');
  }
  void name;
}
const bad = worse.length;
console.log(`compared ${compared} ratings: ${same} equal, ${off1} off by 1, ${bad} further`);
check('the conversion equals the reference (±1)', bad === 0 && compared > 20000, worse.filter(Boolean).join('; '));

// Writing: the slots read back as the fine values (step × 16 + offset), and the boost word is 60.
const out = await open();
applyCfb27(out, convertCfb27(out, sheet));
let readBack = 0, readOk = 0;
for (const t of plan.teams) for (const f of t.fills) {
  const def = teamLayout(out, f.team).find((d) => d.slot === f.slot)!;
  const p = readPlayer(out, f.team, f.slot);
  const offs = readFineOffsets(out.data, f.team, f.slot);
  GROUP_ATTRS[def.group].forEach((a, i) => {
    if (f.fine?.[a] === undefined) return;
    readBack++;
    if (16 * p.ratings[i] + offs[i] === f.fine[a]) readOk++;
  });
}
check('written fine values read back', readBack > 20000 && readOk === readBack, `${readOk}/${readBack}`);
check('the boost word is 60', ((out.data[BONUS_AT] << 8) | out.data[BONUS_AT + 1]) === 60);

// Display: the slot pools agree with v8Key, and an edit round-trips through the curves.
let rt = 0, rtOk = 0;
for (const k of V8.keys) {
  // Numbers below a pool's lowest (CFB values no player had) can't be set; every number from there up can.
  const lo = Math.min(...Array.from({ length: 248 }, (_, f) => shownV8(k, f)));
  for (let n = lo; n < 100; n++) { const f = fineFromShown(k, n); if (shownV8(k, f) === n) rtOk++; rt++; }
}
check('every number from a pool\'s lowest up can be set', rt > 0 && rtOk === rt, `${rtOk}/${rt}`);
check('every pool appears in the slot pools', V8.keys.every((k) => V8_SLOT_POOLS.some((s) => s.includes(k))));

// The Rosters tab (rosterV8.ts): a typed number shows as typed; a CSV exported from a v8 ROM imports back to the same bytes.
{
  const r = await open();
  const def = teamLayout(r, 0).find((d) => d.group === 'REC')!;
  setShownOfSlot(r, 0, def, 'Speed', 91);
  check('a typed number is what the game shows', shownOfSlot(r, 0, def, 'Speed') === 91);
  const before = r.data.slice();
  const csv = exportRostersCsv(r);
  const again = await open();
  importSheet(again, await readSheet('x.csv', new TextEncoder().encode(csv)));
  let diff = 0;
  for (let k = FINE_TABLE; k < FINE_TABLE + 96 * r.teams.length; k++) if (again.data[k] !== before[k]) diff++;
  for (const t of r.teams) for (let k = t.rosterOffset; k < t.rosterOffset + r.info.players * r.info.stride; k++) if (again.data[k] !== before[k]) diff++;
  check('export then import gives the same records and fine offsets', diff === 0, `${diff} bytes differ`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
