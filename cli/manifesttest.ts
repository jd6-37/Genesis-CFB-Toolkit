// Checks a mainline ROM's manifest "ELV1" and, given saves made on it, the save layout 2 reader and ELVB (H-033 / H-037).
//   npm run test:manifest -- ROM [SAVE.srm …]
// ROM: 2026 test63 / 1994 test64 or later (a .md or .zip). SAVE: battery saves of that ROM with a season started.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { entryOf, KNOWN_BUILDS, KNOWN_ENTRIES, MANIFEST_AT, midSeasonProblem, newerRomMessage, readManifest, unknownRequired } from '../src/core/manifest';
import { editionOfRom } from '../src/core/dynasty/edition';
import { hasFineRatings } from '../src/core/dynasty/fine';
import { openSave, readDynastySave, STAT_SLOTS } from '../src/core/dynasty/save';
import { readStamp } from '../src/core/dynasty/dynastyArea';

const [romPath, ...saves] = process.argv.slice(2);
if (!romPath) { console.error('usage: npm run test:manifest -- ROM [SAVE.srm …]'); process.exit(2); }
let passed = 0;
const ok = (name: string) => { passed++; console.log(`ok - ${name}`); };

const rom = (await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data;
const m = readManifest(rom);
assert.ok(m, `no manifest at 0x${MANIFEST_AT.toString(16)}`);
const ed = editionOfRom(rom);
assert.ok(ed, 'an Elevated Season Edition');
assert.equal(m.editionYear, Number(ed.id), 'edition year');
assert.equal(m.seasonTeams, ed.teams, 'season team count');
assert.ok(m.setupTeams >= m.seasonTeams, 'Game Setup teams ≥ season teams');
assert.ok(m.serial > 0 && m.midSeasonFrom <= m.serial, 'serial and mid-season-from');
assert.ok(/^v\d/.test(m.name), `build name "${m.name}"`);
ok(`${ed.name} ${m.name}: serial ${m.serial}, generation ${m.generation}, class ${m.releaseClass}, mid-season-from ${m.midSeasonFrom}, variant ${m.variant}, ${m.entries.length} entries`);

// Every entry within the ROM; every required entry known to this app (else the app refuses the ROM).
for (const e of m.entries) assert.ok(e.address + e.size <= rom.length, `${e.tag} inside the ROM`);
assert.deepEqual(unknownRequired(m).map((e) => `${e.tag} ${e.version}`), [], 'required entries this app knows');
assert.equal(newerRomMessage(m), null);
const tags = new Set(m.entries.map((e) => e.tag));
assert.deepEqual(Object.keys(KNOWN_ENTRIES[m.generation]).filter((t) => !tags.has(t)), [], 'every entry the app expects is there');
assert.equal(entryOf(m, 'SAVE')?.version, 2, 'save layout 2');
ok('entries: all inside the ROM, every required one known to the app');

// Addresses the app used to find by itself agree with the manifest's.
const at = (tag: string) => entryOf(m, tag)!.address;
assert.equal(at('DYNA'), 0x3e0000); assert.equal(at('KIT1'), 0x2b6000); assert.equal(at('NAM1'), 0x2c0000);
assert.equal(at('FINE'), 0x2e0000); assert.equal(at('WLSH'), 0x218800); assert.equal(at('DHOK'), 0x2b0000);
assert.ok(hasFineRatings(rom), 'fine ratings found through FINE');
assert.ok(KNOWN_BUILDS[m.editionYear]?.[m.serial], `the app's table of known builds has serial ${m.serial} (add it to KNOWN_BUILDS)`);
ok('addresses match the app\'s; the build is in KNOWN_BUILDS');

for (const p of saves) {
  const srm = new Uint8Array(readFileSync(p));
  const s = readDynastySave(srm);
  assert.equal(s.layout, 2, `${basename(p)}: save layout 2`);
  assert.equal(s.teams, m.seasonTeams);
  assert.ok(s.season, 'a season');
  const e = s.elvb;
  assert.ok(e, 'ELVB');
  assert.equal(e.editionYear, m.editionYear);
  assert.equal(e.saveLayout, 2);
  assert.equal(e.lastSerial, m.serial, 'saved last on this ROM');
  assert.ok(e.startSerial <= e.lastSerial);
  assert.equal(midSeasonProblem(e, m), e.startSerial < m.midSeasonFrom && e.startSerial !== e.lastSerial ? midSeasonProblem(e, m) : null);
  // The same save with only its data bytes reads the same.
  const packed = openSave(srm).format === 'window' ? srm.filter((_, i) => i & 1) : srm;
  assert.deepEqual(readDynastySave(packed), { ...s, format: 'packed' });
  // Stats: every played game's team has some, and the packed defenders stay in their limits.
  const played = s.season.games.filter((g) => g.vs !== null);
  const teams = new Set(played.flatMap((g) => [g.home!, g.visitor!]));
  for (const t of teams) {
    const st = s.stats[t];
    assert.ok(st.passing[0].s.att + st.rushing.reduce((a, r) => a + r.s.att, 0) > 0, `team ${t} has offensive stats`);
    for (const d of st.defense) assert.ok(d.s.tkl <= 1023 && d.s.sacks <= 63 && d.s.int <= 255);
  }
  const tkl = [...teams].reduce((a, t) => a + s.stats[t].defense.reduce((b, d) => b + d.s.tkl, 0), 0);
  assert.ok(tkl > played.length * 20, 'tackles add up to a few dozen a game');
  assert.equal(STAT_SLOTS.defense.length, 15);
  const last = readStamp(s.lastPlayed);
  ok(`${basename(p)}: layout 2, ${played.length} results, ${teams.size} teams with stats (${tkl} tackles), ELVB start ${e.startSerial} last ${e.lastSerial} variant ${e.variant}, last-played ID ${last ? `season ${last.season} version ${last.rosterVersion}` : 'none (no dynasty area)'}`);
}

console.log(`\n${passed} passed`);
