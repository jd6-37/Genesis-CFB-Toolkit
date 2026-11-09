// Season tool tests against real ROMs (bring your own; .md/.bin/.gen or .zip):
//   npx tsx cli/seasontest.ts BW95 CF97 [more BW95 ROMs, e.g. Elevated builds]
// The emulator checks (the game's own deal and schedule) are described in docs/season.md.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import { openRom } from '../src/core/romfile';
import { eaChecksumOk, fixChecksums, openRosterRom } from '../src/core/rosterRom';
import { parseBw95 } from '../src/core/bw95';
import { parseCf97 } from '../src/core/cf97';
import { buildRom, defaultSlot, swapProblems } from '../src/core/build';
import { installOlPatch, olPatchState } from '../src/core/rosterOlPatch';
import { canCarry, carryEdits, editsSince, workFileName } from '../src/core/workRom';
import {
  CONFERENCES, LOCK_TABLE_SIZE, SEASON_AREAS, SLOTS, WEEKS, dealMode, isLocked, lockAll, lockTeam, readSeason,
  seasonFile, seasonFromFile, seasonProblems, setConference, setGame, setHome, setName, slotOf, teamGames, unlockAll,
  unlockTeam, writeSeason, type Season,
} from '../src/core/season';

const paths = process.argv.slice(2);
if (paths.length < 2) {
  console.error('usage: tsx cli/seasontest.ts BW95 CF97 [more BW95 ROMs]');
  process.exit(2);
}
const read = async (p: string) => (await openRom(basename(p), new Uint8Array(readFileSync(p)))).data;
const bw = await read(paths[0]);
const cf = await read(paths[1]);
const extra = await Promise.all(paths.slice(2).map(read));
let passed = 0;
const ok = (name: string) => {
  passed++;
  console.log('ok -', name);
};
const names = openRosterRom(bw).teams.map((t) => t.school);
const T = (n: string) => names.indexOf(n);

// A seeded PRNG, so the random edit runs are the same every time.
let seed = 12345;
const rnd = (n: number) => {
  seed = (seed * 1103515245 + 12345) >>> 0;
  return (seed >>> 8) % n;
};

/** Checks that a setup holds together: every week is a full set of games, pools fit. */
function valid(s: Season) {
  assert.deepEqual(seasonProblems(s), []);
  for (const row of s.weeks) assert.deepEqual([...row].sort((a, b) => a - b), Array.from({ length: SLOTS }, (_, i) => i));
}

/** Compares two setups the way the game sees them (team space), ignoring slot numbering. */
function sameSeason(a: Season, b: Season) {
  assert.deepEqual(a.names, b.names);
  assert.deepEqual(a.conf, b.conf);
  for (let t = 0; t < SLOTS; t++) {
    assert.equal(isLocked(a, t), isLocked(b, t), `lock of team ${t}`);
    assert.deepEqual(teamGames(a, t), teamGames(b, t), `games of team ${t}`);
  }
  for (let c = 0; c < CONFERENCES; c++) {
    const pool = (s: Season) => s.slotTeam.filter((t, k) => t === null && s.slotConf[k] === c).length;
    assert.equal(pool(a), pool(b), `random places of conference ${c}`);
  }
}

function roundTrip(base: Uint8Array, s: Season): Uint8Array {
  const out = new Uint8Array(base);
  writeSeason(out, s);
  fixChecksums(out, 'bw95');
  assert.ok(eaChecksumOk(out, 'bw95'));
  sameSeason(readSeason(out), s);
  return out;
}

// 1. The stock setup.
const stock = readSeason(bw);
assert.deepEqual(stock.names, ['Southern Conference', 'Mid Western Conference', 'Far Western Conference', 'Eastern Conference']);
assert.deepEqual([0, 1, 2, 3].map((c) => stock.conf.filter((x) => x === c).length), [10, 10, 8, 8]);
assert.equal(stock.slotTeam.filter((t) => t !== null).length, 0);
assert.equal(dealMode(bw), 'stock');
valid(stock);
ok('stock ROM: four conferences of 10, 10, 8 and 8 teams, all random');

// 2. Writing an unchanged setup changes nothing (also on the extra ROMs).
for (const [i, d] of [bw, ...extra].entries()) {
  const out = new Uint8Array(d);
  writeSeason(out, readSeason(d));
  assert.ok(out.every((b, k) => b === d[k]), `ROM ${i}: unchanged write differs`);
}
ok(`unchanged setup writes back byte-identical (${1 + extra.length} ROM${extra.length ? 's' : ''})`);

// 3. Setting a game locks both teams, keeps the side, and their old opponents meet.
{
  let s = lockTeam(stock, T('Pitt'));
  const r = setGame(s, T('Pitt'), 0, { team: T('Alabama') }, names);
  s = r.season;
  valid(s);
  assert.ok(isLocked(s, T('Alabama')));
  const g = teamGames(s, T('Pitt'))[0];
  assert.deepEqual(g.opponent, { team: T('Alabama') });
  assert.deepEqual(teamGames(s, T('Alabama'))[0].opponent, { team: T('Pitt') });
  assert.equal(teamGames(s, T('Alabama'))[0].home, !g.home);
  s = setHome(s, T('Pitt'), 0, true);
  assert.equal(teamGames(s, T('Pitt'))[0].home, true);
  assert.equal(teamGames(s, T('Alabama'))[0].home, false);
  s = setGame(s, T('Pitt'), 1, { conf: 1 }, names).season;
  const g2 = teamGames(s, T('Pitt'))[1].opponent;
  assert.deepEqual(g2, { conf: 1 });
  assert.throws(() => setGame(s, T('Pitt'), 2, { team: T('Pitt') }, names), /itself/);
  roundTrip(bw, s);
  ok('a set game locks both teams; home/away; "any team from a conference"; round trip');
}

// 4. Moving teams between conferences; at least 2 teams per conference; names.
{
  let s = stock;
  for (const n of ['Texas', 'Texas A&M', 'Oklahoma']) s = setConference(s, T(n), 0);
  for (const n of ['Miami', 'Clemson', 'Florida State', 'North Carolina']) s = setConference(s, T(n), 3);
  s = setName(setName(setName(setName(s, 0, 'SEC'), 1, 'Big Ten'), 2, 'PAC'), 3, 'ACC');
  valid(s);
  assert.deepEqual([0, 1, 2, 3].map((c) => s.conf.filter((x) => x === c).length), [9, 7, 8, 12]);
  const out = roundTrip(bw, s);
  assert.equal(dealMode(out), 'stock');
  let t = s;
  const pac = [...Array(SLOTS).keys()].filter((k) => t.conf[k] === 2);
  for (const k of pac.slice(0, 6)) t = setConference(t, k, 1);
  assert.throws(() => setConference(t, pac[6], 1), /at least 2/);
  assert.match(seasonProblems(setName(s, 1, ''))[0], /needs a name/);
  assert.match(seasonProblems(setName(s, 1, 'Big Ten / Pac'))[0], /font/);
  assert.match(seasonProblems(setName(s, 1, 'A'.repeat(23)))[0], /22 characters/);
  // The Walsh Report's one conference mention follows the name, when it fits.
  const text = String.fromCharCode(...out.subarray(0x05b2e0, 0x061067));
  assert.ok(text.includes('powered teams of the SEC.'));
  assert.ok(!text.includes('Southern Conference'));
  const long = new Uint8Array(bw);
  const res = writeSeason(long, setName(stock, 0, 'Southeastern Athletic'));
  assert.deepEqual(res.walshSkipped, ['Southern Conference']); // longer than the room in that paragraph: left alone
  assert.ok(String.fromCharCode(...long.subarray(0x05b2e0, 0x061067)).includes('teams of the Southern Conference.'));
  ok('conferences: move teams (sizes 9/7/8/12), rename, at least 2 teams, name rules, Walsh mention');
}

// 5. Lock everything, edit, unlock everything: the stock loop and free space come back.
{
  let s = lockAll(stock);
  valid(s);
  s = setGame(s, T('Michigan'), 11, { team: T('Ohio State') }, names).season;
  const out = roundTrip(bw, s);
  assert.equal(dealMode(out), 'locks');
  assert.ok(out.subarray(SEASON_AREAS.lockTable, SEASON_AREAS.lockTable + LOCK_TABLE_SIZE).some((b) => b !== 0xff));
  const back = unlockAll(readSeason(out));
  const out2 = new Uint8Array(out);
  writeSeason(out2, back);
  assert.equal(dealMode(out2), 'stock');
  assert.ok(out2.subarray(SEASON_AREAS.lockTable, SEASON_AREAS.lockTable + LOCK_TABLE_SIZE).every((b) => b === 0xff));
  ok('lock every team → locks code + table; unlock all → stock code, table area free again');
}

// 6. Random edit runs keep everything consistent and survive a write/read round trip.
{
  let s = stock;
  let rounds = 0;
  for (let i = 0; i < 4000; i++) {
    const t = rnd(SLOTS);
    const op = rnd(10);
    try {
      if (op < 4) {
        const opp = rnd(3) ? { team: rnd(SLOTS) } : { conf: rnd(CONFERENCES) };
        s = setGame(s, t, rnd(WEEKS), opp, names).season;
      } else if (op < 5) s = setHome(s, t, rnd(WEEKS), !!rnd(2));
      else if (op < 6) s = unlockTeam(s, t);
      else if (op < 7) s = lockTeam(s, t);
      else if (op < 8) s = setConference(s, t, rnd(CONFERENCES));
    } catch (e) {
      assert.match((e as Error).message, /itself|at least 2|no random/);
    }
    valid(s);
    if (i % 400 === 399) {
      roundTrip(bw, s);
      rounds++;
    }
  }
  ok(`4,000 random edits stay valid; ${rounds} write/read round trips match`);
}

// 7. Season files.
{
  const s = setGame(lockTeam(stock, T('Navy')), T('Navy'), 9, { team: T('Army') }, names).season;
  const f = JSON.parse(JSON.stringify(seasonFile(s, names)));
  assert.equal(f.app, 'genesis-cfb-toolkit');
  assert.equal(f.tool, 'season');
  assert.equal(f.version, 1);
  sameSeason(seasonFromFile(f).season, s);
  assert.throws(() => seasonFromFile({ app: 'genesis-cfb-toolkit', tool: 'team-swap', version: 1 }), /Not a season file/);
  assert.throws(() => seasonFromFile({ ...f, version: 2 }), /version 2/);
  const bad = JSON.parse(JSON.stringify(f));
  bad.season.weeks[3][0] = bad.season.weeks[3][1];
  assert.throws(() => seasonFromFile(bad), /damaged/);
  ok('season file: app/tool/version, round trip, refuses other files and damaged ones');
}

// 8. Safety: foreign code or data where the tool writes.
{
  const used = new Uint8Array(bw);
  used[SEASON_AREAS.lockTable + 5] = 0x12;
  writeSeason(new Uint8Array(used), setName(stock, 0, 'SEC')); // no locks: the area isn't touched
  assert.throws(() => writeSeason(new Uint8Array(used), lockTeam(stock, 0)), /already in use/);
  const code = new Uint8Array(bw);
  code[SEASON_AREAS.dealLoop + 3] ^= 1;
  assert.throws(() => readSeason(code), /changed by another tool/);
  ok('refuses: lock table area in use (only when locking), changed deal code');
}

// 9. Works with the other tools: Team Swap before or after, the Rosters OL hook next door.
{
  const cfTeams = parseCf97(cf);
  const tulane = cfTeams.find((t) => t.school === 'Tulane')!;
  const pitt = T('Pitt');
  const edited = setGame(lockTeam(stock, pitt), pitt, 0, { team: T('Notre Dame') }, names).season;
  // Season first, then Team Swap: the swap still takes the ROM and keeps the conference and lock.
  const seasonRom = roundTrip(bw, setConference(edited, pitt, 0));
  assert.deepEqual(swapProblems(seasonRom), []);
  const swapped = buildRom(seasonRom, parseBw95(seasonRom), cfTeams, [defaultSlot(parseBw95(seasonRom)[pitt], tulane)]).rom;
  const after = readSeason(swapped);
  assert.equal(after.conf[pitt], 0);
  assert.deepEqual(teamGames(after, pitt)[0].opponent, { team: T('Notre Dame') });
  // Team Swap first, then Season.
  const swapFirst = buildRom(bw, parseBw95(bw), cfTeams, [defaultSlot(parseBw95(bw)[pitt], tulane)]).rom;
  const both = roundTrip(swapFirst, edited);
  assert.equal(openRosterRom(both).teams[pitt].school, 'Tulane');
  // The Rosters OL hook (0x1EFF20-0x1EFF3D) and the lock table (0x1EFF40-0x1EFF87) live side by side.
  const ol = new Uint8Array(both);
  installOlPatch(ol);
  roundTrip(ol, lockAll(readSeason(ol)));
  ok('Team Swap before or after; Rosters OL hook next to the lock table');
}

// 10. The shared working ROM: what changed, the download name, and carrying edits to another ROM.
{
  const cfTeams = parseCf97(cf);
  const swap = (pairs: [string, string][]) => {
    const teams = parseBw95(bw);
    return buildRom(bw, teams, cfTeams, pairs.map(([slot, school]) => defaultSlot(teams[T(slot)], cfTeams.find((c) => c.school === school)!))).rom;
  };
  const one = swap([['Pitt', 'Tulane']]);
  const work = new Uint8Array(one);
  assert.deepEqual(editsSince(one, work, 'bw95'), { season: false, teams: false, rosters: false, any: false });
  writeSeason(work, setGame(lockTeam(readSeason(work), T('Pitt')), T('Pitt'), 0, { team: T('Alabama') }, names).season);
  assert.deepEqual(editsSince(one, work, 'bw95'), { season: true, teams: false, rosters: false, any: true });
  const rom = openRosterRom(work, true);
  work[rom.teams[T('Texas')].rosterOffset + 1] ^= 0x11; // a roster edit
  installOlPatch(work);
  assert.deepEqual(editsSince(one, work, 'bw95'), { season: true, teams: false, rosters: true, any: true });
  assert.equal(workFileName('X [Team Swap] [Season] [Rosters].md', { season: true, rosters: true }), 'X [Team Swap] [Season] [Rosters].md');
  assert.equal(workFileName('X [Rosters].md', { season: true, rosters: false }), 'X [Season].md');
  // A new swap (two teams) with the edits kept: same season and rosters by slot, the tweak too.
  const two = swap([['Pitt', 'Tulane'], ['Wisconsin', 'Idaho']]);
  const kept = new Uint8Array(two);
  // With the base the app passes (the ROM as loaded), Idaho's own ratings and weather from the new swap stay.
  const res = carryEdits(work, kept, one);
  assert.deepEqual(res, { rosters: 36, olTweak: true, season: true, teams: 0, skipped: [] });
  sameSeason(readSeason(kept), readSeason(work));
  const a = openRosterRom(work), b2 = openRosterRom(kept);
  for (let t = 0; t < 36; t++) {
    const o1 = a.teams[t].rosterOffset, o2 = b2.teams[t].rosterOffset;
    assert.deepEqual(kept.subarray(o2, o2 + 128), work.subarray(o1, o1 + 128), `roster of slot ${t}`);
  }
  assert.equal(olPatchState(kept), 'installed');
  assert.equal(openRosterRom(kept).teams[T('Wisconsin')].school, 'Idaho');
  // Only the edits move: the new swap's own bytes are untouched elsewhere.
  const ed = editsSince(two, kept, 'bw95');
  assert.ok(ed.season && ed.rosters);
  assert.ok(!canCarry(bw, cf));
  assert.throws(() => carryEdits(bw, new Uint8Array(cf)), /same game/);
  ok('working ROM: edits detected per tool, download names, edits carried to a new Team Swap result by slot');
}

console.log(`\n${passed} passed`);
