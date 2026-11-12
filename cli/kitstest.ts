// Tests of the alternate-uniforms table (src/core/kits.ts; handoff H-004).
// usage: tsx cli/kitstest.ts ELEVATED_2026_138 (v2.0.1-test14 or later)
import { parseBw95 } from '../src/core/bw95';
import { ownUniforms, withPiece } from '../src/core/kits';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { openRosterRom, fixChecksums } from '../src/core/rosterRom';
import { emptyKit, hasKits, helmetOf, kitIssues, KTAB, KTAB_SIZE, readKits, shadesOf, writeKits } from '../src/core/kits';
import { editsSince, carryEdits } from '../src/core/workRom';

const path = process.argv[2];
if (!path) { console.error('usage: tsx cli/kitstest.ts ELEVATED_2026_138'); process.exit(2); }
const rom = (await openRom(basename(path), new Uint8Array(readFileSync(path)))).data;
let n = 0;
const ok = (m: string) => { n++; console.log(`ok - ${m}`); };
assert.ok(hasKits(rom), 'the ROM has the uniforms table');
const names = openRosterRom(rom).teams.map((t) => t.school);
const kits = readKits(rom);
assert.equal(kits.length, 138);
const flagged = kits.map((k, t) => (k.whiteHome ? names[t] : '')).filter(Boolean);
const withExtras = kits.map((k, t) => (k.helmets.length + k.dark.length + k.white.length + k.pants.length ? `${names[t]} ${k.helmets.length}/${k.dark.length}/${k.white.length}/${k.pants.length}` : '')).filter(Boolean);
ok(`read: white at home ${flagged.join(', ') || 'nobody'}; extras ${withExtras.join(', ') || 'none'}`);

// An unchanged write gives the same bytes.
const same = rom.slice(); writeKits(same, kits);
assert.deepEqual(same.subarray(KTAB, KTAB + KTAB_SIZE), rom.subarray(KTAB, KTAB + KTAB_SIZE), 'unchanged write');
assert.ok(same.every((b, i) => b === rom[i]), 'nothing else changes');
ok('an unchanged write is byte-identical');

// Edits read back, stay inside the 4 KB, and only touch the table.
const ala = names.indexOf('Alabama'), tex = names.indexOf('Texas');
const edit = kits.map((k) => ({ ...k }));
edit[ala] = { ...emptyKit(), helmets: [helmetOf(0x0eee, 0x000e)], dark: [shadesOf(0x0008, 0x0eee)], pants: [shadesOf(0x0888, 0x000e)] };
edit[tex] = { ...edit[tex], whiteHome: true };
const out = rom.slice(); writeKits(out, edit);
assert.deepEqual(readKits(out), edit);
for (let i = 0; i < out.length; i++) if (out[i] !== rom[i]) assert.ok(i >= KTAB && i < KTAB + KTAB_SIZE, `byte ${i.toString(16)} outside the table`);
for (let t = 0; t < 138; t++) { const o = ((out[KTAB + 6 + 4 * t] << 24) >>> 0) + (out[KTAB + 7 + 4 * t] << 16) + (out[KTAB + 8 + 4 * t] << 8) + out[KTAB + 9 + 4 * t]; assert.ok(o === 0 || (o % 2 === 0 && o >= 558 && o < KTAB_SIZE)); }
assert.deepEqual(shadesOf(0x0008, 0x0eee), [0x0eee, 0x022a, 0x0008, 0x0006]);
assert.deepEqual(helmetOf(0x0eee, 0x000e), [0x0eee, 0x0ccc, 0x000e]);
ok(`edits: Alabama gets a helmet, a dark jersey and pants, Texas wears white at home; read back, only the table changes`);

// Limits and bad colors are refused.
const many = kits.map((k) => ({ ...k })); many[ala] = { ...emptyKit(), helmets: Array.from({ length: 8 }, () => helmetOf(0x0eee, 0)) };
assert.match(kitIssues(many, names)[0], /Alabama: at most 7 extra helmets/);
const big = kits.map(() => ({ ...emptyKit(), dark: Array.from({ length: 4 }, () => shadesOf(0x0008, 0)) }));
assert.match(kitIssues(big, names).join(' '), /room for 4096/);
const odd = kits.map((k) => ({ ...k })); odd[ala] = { ...emptyKit(), pants: [[0x0111, 0, 0, 0]] };
assert.match(kitIssues(odd, names)[0], /isn't a Genesis color/);
assert.throws(() => writeKits(rom.slice(), many));
ok('limits: too many extras, a full table and a non-Genesis color are refused');

// The working ROM: a uniform change is a Teams edit and carries to another ROM; checksums fixed on save.
assert.equal(editsSince(rom, out, 'bw95').teams, true);
const other = rom.slice();
const r = carryEdits(out, other, rom);
assert.deepEqual(readKits(other), edit, 'carried');
assert.ok(r.teams >= 2);
const before = (out[0x18e] << 8) | out[0x18f];
fixChecksums(out, 'bw95');
assert.notEqual((out[0x18e] << 8) | out[0x18f], before, 'the header checksum follows');
ok('working ROM: counted as a Teams edit, carried over, checksum fixed');

// A team's own palettes (the picker's first choices) and a preview with one piece put in.
const blocks = parseBw95(rom, 138);
for (const t of [0, ala, 96, 137]) assert.deepEqual(ownUniforms(rom, t), { home: blocks[t].home, away: blocks[t].away }, `team ${t}`);
const prev = withPiece(blocks[ala].home, 'pants', [1, 2, 3, 4]);
assert.deepEqual([prev[3], prev[13], prev[14], prev[15], prev[5]], [1, 2, 3, 4, blocks[ala].home[5]]);
ok('own uniforms match the team blocks; a preview swaps only the piece');
console.log(`${n} passed`);
