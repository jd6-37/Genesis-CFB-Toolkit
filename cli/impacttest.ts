// Impact players in the Dynasty app (src/core/dynasty/impact.ts): the ROM's pick on each team.
// npm run test:impact -- ELEVATED_2026_138 [ELEVATED_1994]
// - On the ROM's own rosters, and on a new dynasty's first season (the steps the app derives from the players), the
//   same three slots for every team (so the app marks the same players as the game's Team Rosters).
// - H-028: the season ROM's IMP1 table (dynasty header +0x2C) holds, for every team, the ROM's own pick on the
//   season's roster set, except the user's own picks; the picks' rules (three different players of the Active
//   Roster at allowed spots, at most two on a side) and the first season (no table).
// - H-031: the values are the fine ratings (16 × step + offset, 0-255): offsets from the ROM's table at 0x2E0000 for
//   its built-in rosters, from the season ROM's FRC1 (header +0x24) for a dynasty set; 1994 Florida State: #88, #90, #10.
// - Every team is 4-3 by the ROM's Team Rosters bit table (the long at 0x06B100), which the port assumes.
// - Three different players a team: the first an offensive skill player, the second a defender; a fullback only
//   when no halfback is picked.
// - H-047 (2026 / 1994 v2.1.1-test3 on): starters only, scored by position OVR in tenths on the display tables; the
//   app's tables are the ROM's (Team Rosters at 0x2D7DC0, slot map at 0x2D7D00), and its OVR in tenths is the ROM's
//   integer math (checked here on every slot against the tables read from the ROM); 2026 Tulsa: HB1, CB1, DE.
import { hasV8, V8_TABLES_AT } from '../src/core/ratingsV8';
import { OVR_FORMULAS_V8 } from '../src/core/dynasty/ovr';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openRom } from '../src/core/romfile';
import { openRosterRom, readPlayer } from '../src/core/rosterRom';
import { fineValue, gameImpact, impactOvr10, impactChoices, impactSlots, impactSet, readImpactTable, setImpactPicks, teamImpact } from '../src/core/dynasty/impact';
import { seasonRom } from '../src/core/dynasty/offseason';
import type { Dynasty } from '../src/core/dynasty/model';
import { createDynasty } from '../src/core/dynasty/model';
import { createDynasty1994 } from '../src/core/dynasty/create1994';
import { editionOfRom } from '../src/core/dynasty/edition';

let n = 0;
const ok = (what: string) => { n++; console.log(`ok - ${what}`); };
const OFF = new Set([0, 1, 3, 9, 10, 11, 13]);
const STARTERS = new Set([0, 1, 3, 9, 10, 11, 13, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 29]);

for (const path of process.argv.slice(2)) {
  const rom = (await openRom(path, new Uint8Array(readFileSync(path)))).data;
  const rr = openRosterRom(rom);
  // Fine values: the record's steps and the offsets (3 bytes a slot, six signed nibbles in the record's order).
  const fineFrom = (steps: number[], off: Uint8Array) => steps.map((st, k) => {
    let o = k % 2 === 0 ? off[k >> 1] >> 4 : off[k >> 1] & 15;
    if (o > 7) o -= 16;
    return fineValue(st, o);
  });
  const FT = 0x2e0000;
  const ed = editionOfRom(rom)?.id === '1994' ? '1994' : '2026';
  const fromRom = rr.teams.map((t) => impactSlots(Array.from({ length: 32 }, (_, s) => fineFrom(readPlayer(rr, t.index, s).ratings, rom.subarray(FT + 96 * t.index + 3 * s, FT + 96 * t.index + 3 * s + 3))), ed));
  const isDl = (s: number) => s === 16 || s === 17 || s === 18 || s === 21;
  for (const picks of fromRom) {
    assert.ok(picks.filter(isDl).length <= 1, 'never two defensive linemen (H-044)');
    assert.equal(picks.length, 3);
    assert.equal(new Set(picks).size, 3);
    assert.ok(OFF.has(picks[0]) && !OFF.has(picks[1]), 'offense first, then defense');
    if (picks.includes(3)) assert.ok(!picks.includes(1), 'a fullback only without a halfback');
    assert.ok(picks.every((p) => STARTERS.has(p)), 'starters only (H-047)');
  }
  // H-047: the OVR in tenths from the ROM's own display tables, the pick's integer math, for every scored slot.
  const NIB: Record<string, string[]> = {
    QB: ['Quickness', 'Speed', 'Awareness', 'Range', 'Power'], RB: ['Quickness', 'Speed', 'Awareness', 'Hands', 'Power'],
    DL: ['Power', 'Speed', 'Awareness', 'Hands', 'Tackling'], DB: ['Quickness', 'Speed', 'Awareness', 'Hands', 'Tackling'],
  };
  const roleOf = (s: number): [string, string] => s === 0 ? ['QB', 'QB'] : s === 1 ? ['HB', 'RB'] : s === 3 ? ['FB', 'RB'] : s <= 11 ? ['WR', 'RB']
    : s === 13 ? ['TE', 'RB'] : s === 16 || s === 18 ? ['DE', 'DL'] : s === 17 || s === 21 ? ['DT', 'DL'] : s <= 22 ? ['LB', 'DB'] : s <= 26 ? ['CB', 'DB'] : ['S', 'DB'];
  let slotsChecked = 0;
  for (const t of rr.teams) {
    for (const slot of STARTERS) {
      const fine = fineFrom(readPlayer(rr, t.index, slot).ratings, rom.subarray(FT + 96 * t.index + 3 * slot, FT + 96 * t.index + 3 * slot + 3));
      const [role, g] = roleOf(slot);
      const f = OVR_FORMULAS_V8[role];
      let sum = 0;
      for (let k = 1; k <= 5; k++) {
        const w = (f.weights as Record<string, number>)[NIB[g][k - 1]] ?? 0;
        if (w) sum += w * rom[V8_TABLES_AT + 248 * rom[0x2d7d00 + 6 * slot + k] + Math.min(247, fine[k])];
      }
      const want = Math.max(0, Math.min(990, Math.round(f.base * 10) + Math.floor((Math.round(f.scale * 1000) * sum + 5000) / 10000)));
      assert.equal(impactOvr10(fine, slot), want, `${t.school} slot ${slot}: OVR in tenths as the ROM computes it`);
      slotsChecked++;
    }
  }
  ok(`${editionOfRom(rom)?.id}: OVR in tenths of ${slotsChecked} starters as the ROM's display tables give it`);
  const is94 = editionOfRom(rom)?.id === '1994';
  const u32 = (a: number) => ((rom[a] << 24) >>> 0) + (rom[a + 1] << 16) + (rom[a + 2] << 8) + rom[a + 3];
  const bits = u32(0x06b100);
  assert.ok(rr.teams.every((t) => (rom[bits + (t.index >> 3)] >> (t.index & 7)) & 1), 'every team is 4-3 by the ROM table');
  const d = is94
    ? createDynasty1994(rom, readFileSync('public/data/rosters-1994.csv', 'utf8'), { name: 'x', seed: 1 })
    : createDynasty(rom, readFileSync('public/data/ea-cfb27-ratings-2026-week9.csv', 'utf8'), { name: 'x', seed: 1 });
  const s = d.seasons[0];
  for (const t of d.teams) {
    const want = fromRom[t.index].map((slot) => s.slots[t.index][slot]);
    assert.deepEqual(teamImpact(d, s, t.index), want, `${t.school}: the dynasty's first season picks as the ROM`);
  }
  assert.equal(impactSet(d, s).size, 3 * d.teams.length);
  if (!is94) {
    const tulsa = d.teams.find((t) => t.school === 'Tulsa')!.index;
    assert.deepEqual(fromRom[tulsa], [1, 24, 16], 'Tulsa 2026: HB1 Jones, CB1, DE (H-047)');
  }
  if (is94) {
    const fsu = d.teams.find((t) => t.school === 'Florida State')!.index;
    assert.deepEqual([...fromRom[fsu]].sort((a, b) => a - b), [11, 18, 19], 'Florida State 1994: #88, #90, #10 Brooks (H-031)');
  }
  // The user's Ole Miss screenshot (QB and HB1) was on the older ratings; v8 changes the picks (H-038, expected).
  if (!is94 && !hasV8(rom)) {
    const om = d.teams.find((t) => t.school === 'Ole Miss')!.index;
    const pos = teamImpact(d, s, om).map((id) => s.slots[om].indexOf(id));
    assert.ok(pos.includes(0) && pos.includes(1), 'Ole Miss: QB and HB1 (as the game marks them)');
  }
  ok(`${is94 ? '1994' : '2026'}: ${d.teams.length} teams, the ROM's picks and the dynasty's agree`);

  // The first season's ROM has no table (the ROM picks itself).
  assert.equal(readImpactTable(seasonRom(d, s, rom)), null, 'no IMP1 in the first season');
  // A later season (the first season's lineup, as the newest season of a dynasty in its offseason): the user's team.
  const me = d.teams[5].index;
  let d2: Dynasty = { ...d, userTeams: [me], seasons: [{ ...s, index: 1, year: s.year + 1, imports: [] }] };
  const s2 = d2.seasons[0];
  const choices = impactChoices(s2, me);
  const defs = choices.filter((c) => c.defense), offs = choices.filter((c) => !c.defense);
  assert.throws(() => setImpactPicks(d2, me, defs.slice(0, 3).map((c) => c.id)), /At most 2 of the three can be defenders/);
  assert.throws(() => setImpactPicks(d2, me, offs.slice(0, 3).map((c) => c.id)), /At most 2 of the three can be on offense/);
  assert.throws(() => setImpactPicks(d2, (me + 1) % d.teams.length, gameImpact(d2, s2, (me + 1) % d.teams.length)), /your own teams/);
  const ol = s2.slots[me][5]!; // LG: not allowed
  assert.throws(() => setImpactPicks(d2, me, [offs[0].id, defs[0].id, ol]), /Active Roster/);
  assert.ok(choices.every((c) => STARTERS.has(c.slot)), 'the user picks from the starters only (H-047)');
  assert.throws(() => setImpactPicks(d2, me, [offs[0].id, defs[0].id, s2.slots[me][2]!]), /starters/, 'HB2 refused');
  const mine = [offs[offs.length - 1].id, defs[defs.length - 1].id, defs[defs.length - 2].id];
  d2 = setImpactPicks(d2, me, mine);
  assert.deepEqual(teamImpact(d2, d2.seasons[0], me), mine);
  const out = seasonRom(d2, d2.seasons[0], rom);
  const table = readImpactTable(out);
  assert.ok(table && table.length === d.teams.length, 'IMP1 with every team');
  assert.equal(((out[0x3e002c] << 24) >>> 0) + (out[0x3e002d] << 16) + (out[0x3e002e] << 8) + out[0x3e002f], 0x3e4e40);
  // Every other team: the ROM's own pick on the roster set the season ROM carries (header +0x14).
  const set = ((out[0x3e0014] << 24) >>> 0) + (out[0x3e0015] << 16) + (out[0x3e0016] << 8) + out[0x3e0017];
  const frc = ((out[0x3e0024] << 24) >>> 0) + (out[0x3e0025] << 16) + (out[0x3e0026] << 8) + out[0x3e0027];
  assert.equal(String.fromCharCode(...out.subarray(frc, frc + 4)), 'FRC1', 'the season ROM has its offsets');
  let same = 0;
  for (const t of d.teams) {
    const got: number[] = table![t.index];
    if (t.index === me) {
      assert.deepEqual([...got].sort((a, b) => a - b), mine.map((id) => s2.slots[me].indexOf(id)).sort((a, b) => a - b), 'the user\'s picks written');
      continue;
    }
    const nib = Array.from({ length: 32 }, (_, k) => {
      const r = out.subarray(set + 128 * t.index + 4 * k, set + 128 * t.index + 4 * k + 4);
      const o = frc + 4 + (32 * t.index + k) * 3;
      return fineFrom([r[1] >> 4, r[1] & 15, r[2] >> 4, r[2] & 15, r[3] >> 4, r[3] & 15], out.subarray(o, o + 3));
    });
    assert.deepEqual([...got].sort((a, b) => a - b), impactSlots(nib, ed).sort((a, b) => a - b), `${t.school}: the table is the ROM's own pick (fine values from FRC1)`);
    same++;
  }
  // Back to the game's pick.
  d2 = setImpactPicks(d2, me, null);
  assert.equal(d2.seasons[0].impact?.[me], undefined);
  ok(`${is94 ? '1994' : '2026'}: IMP1 at 0x3E4E40, ${same} teams the ROM's pick, the user's team as chosen, the rules hold`);
}
console.log(`${n} passed`);
