// Team Swap tests, against real ROMs (bring your own; .md/.bin/.gen or .zip): the original BW95, CF97
// and, optionally, the Elevated 2026 Season Edition (the original game with that patch):
//   npx tsx cli/swaptest.ts BW95 CF97 [ELEVATED_2026]   (the 2026 Season Edition v1.1.0, the 36-team one Team Swap swapped)
// Covers swapping a ROM that Team Swap swapped before: new slots, slots swapped before, the Walsh
// Report text (always in its own space), and ROMs swapped by other tools.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import { isWideBw95, openRom } from '../src/core/romfile';
import { parseBw95 } from '../src/core/bw95';
import { CfTeam, parseCf97 } from '../src/core/cf97';
import { buildRom, defaultSlot, hasSwappedTeams, SlotConfig, swappedByTeamSwap, swappedSlots, swapProblemText } from '../src/core/build';
import { MENU_ORDER } from '../src/core/helpers68k';
import { readWalsh, walshAt, WALSH_BASE, WALSH_END, WALSH_RELOC } from '../src/core/walsh';
import { sha1Hex } from '../src/core/bytes';

const [bwPath, cfPath, e26Path] = process.argv.slice(2);
if (!cfPath) {
  console.error('usage: tsx cli/swaptest.ts BW95 CF97 [ELEVATED_2026]');
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
const CF = (n: string): CfTeam => {
  const t = cfTeams.find((c) => c.school === n);
  assert.ok(t, n);
  return t;
};
/** Swaps by slot or name (current school in the ROM → CF97 school). */
const swap = (rom: Uint8Array, pairs: [string | number, string][], tweak?: (sc: SlotConfig) => void) => {
  const teams = parseBw95(rom);
  const swaps = pairs.map(([from, to]) => {
    const slot = typeof from === 'number' ? from : teams.findIndex((t) => t.school === from);
    assert.ok(slot >= 0, String(from));
    const sc = defaultSlot(teams[slot], CF(to));
    tweak?.(sc);
    return sc;
  });
  return buildRom(rom, teams, cfTeams, swaps);
};
const walshArea = (k: number) => (k >= WALSH_BASE && k < WALSH_END) || (k >= WALSH_RELOC && k < 0x200000);
const checksum = (k: number) => k === 0x18e || k === 0x18f || (k >= 0x1e6430 && k < 0x1e6434);
/** Byte offsets that differ outside the Walsh Report text and the checksums. */
const diffOutsideText = (a: Uint8Array, b: Uint8Array) => {
  const out: number[] = [];
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k] && !walshArea(k) && !checksum(k)) out.push(k);
  return out;
};
const flat = (paras: string[]) => paras.map((p) => p.replace(/([.!?])  /g, '$1 '));
const schools = (rom: Uint8Array) => parseBw95(rom).map((t) => t.school);
const menu = (rom: Uint8Array) => {
  const s = schools(rom);
  return Array.from(rom.subarray(MENU_ORDER.addr + MENU_ORDER.ORD, MENU_ORDER.addr + MENU_ORDER.ORD + 36), (t) => s[t]);
};

// 1. Fresh swaps build exactly as before (reference SHA-1s from the README and the notes).
{
  const ref = swap(bw, [['Pitt', 'Tulane'], ['Wisconsin', 'Idaho'], [schools(bw)[0], 'Oregon']]).rom;
  assert.equal(await sha1Hex(ref), '35f8e48ec3acd3ff8d188b25e6972e7c33b89583');
  const old = swap(bw, [['Pitt', 'Tulane'], ['Wisconsin', 'Idaho'], [schools(bw)[0], 'Oregon']], (sc) => {
    delete sc.ovr;
    delete sc.weather;
  }).rom;
  assert.equal(await sha1Hex(old), 'a6965f7206c9d5b7ca8a0f3d7f4d24a124ee79c2');
  ok('fresh swaps: same bytes as before (35f8e48e, and a6965f72 without ratings and weather)');
}

// 2. Which ROMs Team Swap can swap (again).
const one = swap(bw, [['Pitt', 'Tulane']]).rom;
{
  assert.equal(swappedByTeamSwap(bw), false);
  assert.equal(swapProblemText(bw), null);
  assert.equal(swappedByTeamSwap(one), true);
  assert.equal(hasSwappedTeams(one), true);
  assert.equal(swapProblemText(one), null);
  assert.deepEqual(swappedSlots(one), [schools(bw).indexOf('Pitt')]);
  // Another tool's helper at 0x1F0000 (like the private Tulane builds'): refused.
  const other = one.slice();
  other[MENU_ORDER.addr + 2] ^= 0xff;
  assert.equal(swappedByTeamSwap(other), false);
  assert.match(swapProblemText(other)!, /swapped with another tool/);
  assert.throws(() => buildRom(other, parseBw95(other), cfTeams, []), /another tool/);
  // A broken menu table isn't Team Swap's either.
  const broken = one.slice();
  broken[MENU_ORDER.addr + MENU_ORDER.ORD] = broken[MENU_ORDER.addr + MENU_ORDER.ORD + 1];
  assert.equal(swappedByTeamSwap(broken), false);
  ok('a ROM Team Swap swapped can take another swap; one swapped by another tool is refused');
}

// 3. More slots on a swapped ROM = all of them at once (outside the Walsh text, whose gaps may differ).
{
  const both = swap(bw, [['Pitt', 'Tulane'], ['Wisconsin', 'Idaho']]).rom;
  const again = swap(one, [['Wisconsin', 'Idaho']]).rom;
  assert.deepEqual(diffOutsideText(both, again), []);
  assert.deepEqual(flat(readWalsh(again)), flat(readWalsh(both)));
  assert.deepEqual(menu(again), menu(both));
  assert.equal(swappedSlots(again).length, 2);
  ok('a second swap adds teams and keeps the first one (names, art, end zone, card stunt, menu place)');
}

// 4. A slot swapped before takes another team: the same as swapping that team in directly.
{
  const direct = swap(bw, [['Pitt', 'Oregon']]).rom;
  const again = swap(one, [['Tulane', 'Oregon']]).rom;
  assert.deepEqual(diffOutsideText(direct, again), []);
  const slot = schools(bw).indexOf('Pitt');
  const text = readWalsh(again).slice(6 + 2 * slot, 8 + 2 * slot).join(' ');
  assert.match(text, /Oregon|Ducks/);
  assert.doesNotMatch(text, /Tulane|Green Wave/);
  assert.deepEqual(menu(again), menu(direct));
  ok('a swapped slot takes another CF97 team (same ROM as a direct swap, outside the Walsh text)');
}

// 5. The Walsh text never leaves its own space: very long names drop last sentences instead; a text
//    an older version moved to 0x1F8000 is read from there and put back (its copy freed); shorter
//    names leave spaces that a later, longer rename can use.
{
  const long = 'W'.repeat(16);
  const all = schools(bw).map((_, i) => [i, cfTeams[i * 3].school] as [number, string]);
  const tight = swap(bw, all, (sc) => {
    sc.school = long;
    sc.nickname = 'W'.repeat(15);
  });
  assert.equal(tight.walsh, 'trimmed');
  assert.equal(walshAt(tight.rom), WALSH_BASE);
  assert.ok(tight.rom.subarray(WALSH_RELOC, 0x200000).every((b) => b === 0xff));
  const used = readWalsh(tight.rom).map((p) => p + '\r').join('').length;
  assert.ok(used <= WALSH_END - WALSH_BASE && tight.rom.subarray(WALSH_BASE + used, WALSH_END).every((b) => b === 0x20));
  assert.ok(readWalsh(tight.rom).slice(6).every((p) => p.length > 0));
  // An older build's moved text: the same ROM as if it had stayed in place.
  const moved = one.slice();
  const text = readWalsh(one).map((p) => p + '\r').join('');
  for (let i = 0; i < text.length; i++) moved[WALSH_RELOC + i] = text.charCodeAt(i);
  moved.set(bw.subarray(WALSH_BASE, WALSH_END), WALSH_BASE); // what an older build left in place
  moved[0x078fc0] = 0x00; moved[0x078fc1] = 0x1f; moved[0x078fc2] = 0x80; moved[0x078fc3] = 0x00;
  assert.equal(walshAt(moved), WALSH_RELOC);
  assert.equal(swappedByTeamSwap(moved), true);
  const back = swap(moved, [['Wisconsin', 'Idaho']]);
  assert.equal(walshAt(back.rom), WALSH_BASE);
  assert.ok(back.rom.subarray(WALSH_RELOC, 0x200000).every((b) => b === 0xff));
  assert.deepEqual(Array.from(back.rom.subarray(0x200, 0x1e6430)), Array.from(swap(one, [['Wisconsin', 'Idaho']]).rom.subarray(0x200, 0x1e6430)));
  // Short names for all 36, then a longer rename fills the spaces they left.
  const short = swap(one, schools(one).map((_, i) => [i, cfTeams[i * 3 + 1].school] as [number, string]), (sc) => {
    sc.school = 'A';
    sc.nickname = 'Bs';
  });
  assert.equal(short.walsh, 'in place');
  const grow = swap(short.rom, [[0, 'Tulane']], (sc) => (sc.school = 'Tulane Green Wave'.slice(0, 16)));
  assert.equal(grow.walsh, 'in place');
  const gaps = (rom: Uint8Array) => readWalsh(rom).join('').split(/[.!?]  /).length;
  assert.equal(gaps(grow.rom), gaps(short.rom)); // no sentence gap had to give way
  ok('Walsh text: stays in its space (long names trim), an older moved text comes back, spaces reused');
}

// 6. The Elevated 2026 Season Edition: its 11 swapped teams stay, two more slots change.
if (e26Path && isWideBw95(await read(e26Path))) {
  console.log("skip - that is the 138-team 2026 Season Edition (v2.0.0 on), which Team Swap doesn't take; this test takes v1.1.0's 36-team edition");
} else if (e26Path) {
  const e26 = await read(e26Path);
  assert.equal(swappedByTeamSwap(e26), true);
  assert.equal(swapProblemText(e26), null);
  const before = swappedSlots(e26);
  assert.equal(before.length, 11);
  const res = swap(e26, [['Iowa', 'Arizona State'], ['Navy', 'Baylor']]);
  const out = res.rom;
  const teams = parseBw95(e26);
  const changed = new Set([teams.findIndex((t) => t.school === 'Iowa'), teams.findIndex((t) => t.school === 'Navy')]);
  // Only the two blocks, their card stunt pointers, OVR table entries and the helper tables change.
  const allowed = (k: number) =>
    [...changed].some((s) => {
      const t = teams[s];
      return (k >= t.block && k < t.block + t.rosterOff) || (k >= 0x034a68 + 4 * s && k < 0x034a6c + 4 * s) || k === 0x10dfb4 + 2 * s || k === 0x10dfb5 + 2 * s;
    }) || (k >= MENU_ORDER.addr && k < 0x1f043c);
  assert.deepEqual(diffOutsideText(e26, out).filter((k) => !allowed(k)), []);
  for (const s of before) if (!changed.has(s)) assert.deepEqual(out.subarray(teams[s].block, teams[s].block + teams[s].rosterOff), e26.subarray(teams[s].block, teams[s].block + teams[s].rosterOff));
  const names = menu(out);
  assert.ok(names.includes('Arizona State') && names.includes('Baylor') && !names.includes('Iowa') && !names.includes('Navy'));
  const keep = menu(e26).filter((n) => n !== 'Iowa' && n !== 'Navy');
  assert.deepEqual(names.filter((n) => keep.includes(n)), keep);
  assert.equal(swappedSlots(out).length, 12);
  ok('Elevated 2026 Season Edition: Iowa → Arizona State and Navy → Baylor, the other teams untouched');
}

console.log(`${passed} passed`);
