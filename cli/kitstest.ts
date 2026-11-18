// Tests of the alternate-uniforms table (src/core/kits.ts; handoff H-004).
// usage: tsx cli/kitstest.ts ROM: the 138-team 2026 Season Edition (v2.0.1-test14 or later) or the 107-team
// 1994 Season Edition (test14 or later; H-012)
import { parseBw95 } from '../src/core/bw95';
import { ownChanges, ownUniforms, partPalette, readKitSprite, withPiece, writeOwnUniforms } from '../src/core/kits';
import { renderSprites } from '../src/core/render';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { openRosterRom, fixChecksums } from '../src/core/rosterRom';
import { emptyKit, hasKits, helmetOf, kitIssues, KTAB, KTAB_SIZE, readKits, shadesOf, writeKits } from '../src/core/kits';
import { editsSince, carryEdits } from '../src/core/workRom';

const path = process.argv[2];
if (!path) { console.error('usage: tsx cli/kitstest.ts ELEVATED_2026_138 | ELEVATED_1994'); process.exit(2); }
const rom = (await openRom(basename(path), new Uint8Array(readFileSync(path)))).data;
let n = 0;
const ok = (m: string) => { n++; console.log(`ok - ${m}`); };
assert.ok(hasKits(rom), 'the ROM has the uniforms table');
const names = openRosterRom(rom).teams.map((t) => t.school);
const kits = readKits(rom);
const N = kits.length;
assert.ok(N === 138 || N === 107, `team count ${N}`);
assert.equal(N, names.length);
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
for (let t = 0; t < N; t++) { const o = ((out[KTAB + 6 + 4 * t] << 24) >>> 0) + (out[KTAB + 7 + 4 * t] << 16) + (out[KTAB + 8 + 4 * t] << 8) + out[KTAB + 9 + 4 * t]; assert.ok(o === 0 || (o % 2 === 0 && o >= 6 + 4 * N && o < KTAB_SIZE)); }
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
const blocks = parseBw95(rom, N);
for (const t of [0, ala, Math.min(96, N - 1), N - 1]) assert.deepEqual(ownUniforms(rom, t), { home: blocks[t].home, away: blocks[t].away }, `team ${t}`);
const prev = withPiece(blocks[ala].home, 'pants', [1, 2, 3, 4]);
assert.deepEqual([prev[3], prev[13], prev[14], prev[15], prev[5]], [1, 2, 3, 4, blocks[ala].home[5]]);
ok('own uniforms match the team blocks; a preview swaps only the piece');

// Editing a team's own uniforms (user, 2026-11-18: "Editable too", behind a warning): only the uniform places of
// that team's two palettes change; the work ROM counts it and carries it over.
{
  const w = rom.slice();
  const o = ownUniforms(w, ala);
  const next = { home: o.home.slice(), away: o.away.slice() };
  next.home[11] = 0x0e00; next.away[9] = 0x000e; next.home[2] = 0x0222; // [2] isn't a uniform place: left as it is
  writeOwnUniforms(w, ala, next);
  const back = ownUniforms(w, ala);
  assert.equal(back.home[11], 0x0e00); assert.equal(back.away[9], 0x000e); assert.equal(back.home[2], o.home[2]);
  assert.deepEqual(ownChanges(rom, w), [ala]);
  const diff = [...w].flatMap((x, i) => (x === rom[i] ? [] : [i]));
  assert.ok(diff.length <= 4, `bytes changed: ${diff.length}`);
  assert.ok(editsSince(rom, w, 'bw95').teams, 'a Teams edit');
  const to = rom.slice();
  carryEdits(w, to, rom);
  assert.deepEqual(ownUniforms(to, ala), back, 'carried');
  assert.throws(() => writeOwnUniforms(w, ala, { home: [...next.home.slice(0, 15), 0x1000], away: next.away }), /Genesis color/);
}
ok('own uniforms: only the uniform places change, counted as a Teams edit and carried over');

// The editor's player: the picker's sprite (frame 497) from the ROM, drawn with one part in color and the rest gray.
{
  const sp = readKitSprite(rom);
  assert.ok(sp && sp.sprites.length >= 1 && sp.tiles.length % 32 === 0, 'the sprite');
  const pic = renderSprites(sp!.tiles, partPalette(blocks[ala].home, 'dark'), [sp!.sprites]);
  assert.ok(pic.width >= 16 && pic.height >= 32, `${pic.width} x ${pic.height}`);
  const g = partPalette(blocks[ala].home, 'helmets');
  assert.deepEqual([g[5], g[6], g[7]], [5, 6, 7].map((i) => blocks[ala].home[i]), 'the part keeps its colors');
  assert.ok([1, 2, 4, 8, 9, 10, 13].every((i) => { const c = g[i]; return (c & 0xe) === ((c >> 4) & 0xe) && (c & 0xe) === ((c >> 8) & 0xe); }), 'the rest is gray');
}
ok('preview: the picker\'s player sprite from the ROM, one part in color, the rest gray');
console.log(`${n} passed (${N} teams)`);
