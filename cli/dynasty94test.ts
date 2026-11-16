// Dynasty tests for the 1994 Season Edition (bring your own ROM and save; the ROM may be a .zip):
//   npx tsx cli/dynasty94test.ts ELEVATED_1994 SAVE.srm
// The ROM is the 107-team 1994 Season Edition (Elevated v2.0.1-test29 or later). The save is a Genesis Plus GX
// (RetroArch) .srm of it with a season started and at least one week played (a whole season, bowls included,
// also tests the champion and the bowl stories); the test puts its dynasty's mark into it.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import { openRom } from '../src/core/romfile';
import { openRosterRom, readPlayer, teamLayout, jerseyNumber } from '../src/core/rosterRom';
import { GROUP_ATTRS, GROUP_COLUMNS } from '../src/core/rosterLayouts';
import { readDynastySave } from '../src/core/dynasty/save';
import { createDynasty, importSave, CLASSES } from '../src/core/dynasty/model';
import { createDynasty1994, CLASS_MIX_1994 } from '../src/core/dynasty/create1994';
import { EDITIONS, editionOf, editionOfRom, dynastyFormat } from '../src/core/dynasty/edition';
import { parseRosters1994, nameKey, ROSTERS_1994 } from '../src/core/dynasty/rosters1994';
import { DYN_AREA, dynastyHeaderValid, dynastyRomId, readNamesTable, readStamp, scheduleAddress, fineAddress } from '../src/core/dynasty/dynastyArea';
import { hasFineRatings, readFineOffsets } from '../src/core/dynasty/fine';
import { seasonView, weekName, bowlOf, bowlWeek, BOWLS_1994, champions, playerName } from '../src/core/dynasty/derive';
import { stories } from '../src/core/dynasty/news';
import { playoffSize } from '../src/core/dynasty/outlook';
import { checkSchedule, makeSchedule, protectedPairs, setOpponent, teamSchedule, scheduleSet, weeksOf } from '../src/core/dynasty/schedule';
import { readTitleGames, readWideSeason, TG_ON } from '../src/core/seasonWide';
import * as Conf from '../src/core/dynasty/conferences';
import { rivalriesOf, setRivalries } from '../src/core/dynasty/schedule';
import { numberAllowed, NO_NUMBER } from '../src/core/dynasty/numbers';
import { hasKits } from '../src/core/kits';
import { SCHOOL_STATE } from '../src/core/dynasty/schoolStates';
import { SCHOOL_COLORS } from '../src/core/dynasty/schoolColors';
import { CFB27_ACADEMICS } from '../src/core/dynasty/academics';
import { rivalryOf } from '../src/core/dynasty/rivalries';
import * as Off from '../src/core/dynasty/offseason';
import * as Sim from '../src/core/dynasty/sim';

const [romPath, savePath] = process.argv.slice(2);
if (!romPath || !savePath) {
  console.error('usage: tsx cli/dynasty94test.ts ELEVATED_1994 SAVE.srm');
  process.exit(2);
}
const rom = (await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data;
const csv = readFileSync(new URL(`../public/${ROSTERS_1994.file}`, import.meta.url), 'utf8');
let passed = 0;
const ok = (name: string) => { passed++; console.log('ok -', name); };

// ---- the ROM and the edition
assert.equal(editionOfRom(rom)?.id, '1994', 'a 107-team ROM is the 1994 Season Edition');
assert.ok(hasFineRatings(rom), 'the fine-ratings hook is found behind the impact players\' hook');
assert.ok(hasKits(rom), 'the uniforms table of 107 teams');
assert.throws(() => createDynasty(rom, '', { name: 'x' }), /1994 Season Edition/);
ok('edition: 107 teams, fine ratings, uniforms table; the 2026 creation refuses it');

// ---- the built-in 1994 lists
const rows = parseRosters1994(csv);
const roster = openRosterRom(rom);
const schools = new Set(roster.teams.map((t) => t.school));
assert.ok(rows.length > 8000, 'the merged lists');
assert.ok(rows.every((r) => schools.has(r.school)), 'every row has a school of the ROM');
assert.equal(new Set(rows.map((r) => r.school)).size, 107, 'every school has a list');
assert.ok(rows.every((r) => !r.state || r.state === 'Non-US' || /^[A-Z]{2}$/.test(r.state)), 'two-letter states');
ok(`1994 lists: ${rows.length} players at 107 schools`);

// ---- creation
const d0 = createDynasty1994(rom, csv, { name: 'Test 94', seed: 7, id: 'test94', created: '2026-11-15T00:00:00Z' });
assert.equal(d0.edition, '1994');
assert.equal(editionOf(d0).teams, 107);
assert.equal(d0.teams.length, 107);
assert.equal(d0.startYear, 1994);
const s0 = d0.seasons[0];
assert.equal(s0.year, 1994);
assert.deepEqual(s0.confNames, readWideSeason(rom).names);
assert.ok(d0.players.every((p, i) => p.id === i + 1), 'IDs in order');
const names = readNamesTable(rom, 107);
let named = 0, unnamed = 0, fromLists = 0;
for (const t of d0.teams) {
  const list = new Map(rows.filter((r) => r.school === t.school).map((r) => [nameKey(r.first, r.last), r]));
  for (const def of teamLayout(roster, t.index)) {
    const p = d0.players[s0.slots[t.index][def.slot]! - 1];
    const b = s0.bw![t.index][def.slot]!;
    // The game's ratings: the ROM's steps and offsets.
    const rec = readPlayer(roster, t.index, def.slot);
    const offs = readFineOffsets(rom, t.index, def.slot);
    GROUP_COLUMNS[def.group].forEach((a, i) => {
      const k = GROUP_ATTRS[def.group].indexOf(a);
      assert.equal(b.steps[i], rec.ratings[k], `${t.school} ${def.label} ${a} step`);
      const fine = Math.max(0, Math.min(240, 16 * rec.ratings[k] + offs[k]));
      assert.equal(16 * b.steps[i] + b.offs[i], fine, `${t.school} ${def.label} ${a} fine`);
    });
    assert.equal(p.jersey, jerseyNumber(rec.numberByte) ?? NO_NUMBER);
    const n = names[t.index][def.slot];
    if (n && (n.first || n.last)) {
      named++;
      assert.equal(`${p.first} ${p.last}`, `${n.first} ${n.last}`);
      if (list.has(nameKey(n.first, n.last))) fromLists++;
    } else {
      unnamed++;
      assert.equal(p.first + p.last, '', 'no name where the ROM has none (user: keep names blank)');
      assert.match(playerName(p), /^[A-Z]+ #\d+$|^Unnamed /);
    }
    assert.ok(CLASSES.includes(p.cls), 'everyone has a class');
  }
}
// Class mix: the teams' 32 lean to the 1994 mix (2 FR, 6 SO, 12 JR, 12 SR) where the ROM left classes open.
const mix = new Map(CLASS_MIX_1994);
const off = d0.teams.map((t) => {
  const c = new Map<string, number>();
  for (const id of s0.slots[t.index]) { const p = d0.players[id! - 1]; c.set(p.cls, (c.get(p.cls) ?? 0) + 1); }
  return [...mix].reduce((a, [k, want]) => a + Math.abs((c.get(k) ?? 0) - want), 0);
});
assert.ok(off.filter((x) => x <= 10).length >= 90, `most teams near the class mix (${off.filter((x) => x <= 10).length} of 107)`);
// Backups: real players of the school's list where it has one for the slot.
const real = d0.players.filter((p) => (p.srcId ?? 0) >= 200000);
assert.ok(real.length > 2800, 'most backups are real 1994 players');
for (const p of real) {
  const r = rows[p.srcId! - 200000];
  assert.equal(d0.teams[p.team!].school, r.school);
  assert.equal(`${p.first} ${p.last}`, `${r.first} ${r.last}`);
  if (p.jersey !== NO_NUMBER) assert.ok(numberAllowed(p.pos, p.jersey), `${p.pos} #${p.jersey}`);
}
const startNames = new Set(d0.players.filter((p) => (p.srcId ?? 0) < 200000 && p.first).map((p) => `${p.team}|${nameKey(p.first, p.last)}`));
assert.ok(real.every((p) => !startNames.has(`${p.team}|${nameKey(p.first, p.last)}`)), 'no backup is one of the ROM\'s named 32');
assert.equal(s0.bench!.flat().filter((x) => x !== null).length, 107 * 32, 'a backup for every slot');
assert.ok(s0.prestige!.every((x) => x >= 1 && x <= 6) && s0.prestige![d0.teams.findIndex((t) => t.school === 'Florida')] === 6, '1994 prestige: the preseason poll first');
ok(`creation: ${named} named and ${unnamed} unnamed in the ROM's 32 (${fromLists} found in the lists), ${real.length} real backups, ratings equal the ROM's steps and offsets`);

// ---- school data under the 1994 names
for (const s of ['California', 'Miami (Ohio)', 'N. Illinois', 'NE Louisiana', 'SW Louisiana', 'Pacific']) {
  assert.ok(SCHOOL_STATE[s] && SCHOOL_COLORS[s] && CFB27_ACADEMICS[s], s);
}
assert.equal(rivalryOf('California', 'Stanford'), rivalryOf('Cal', 'Stanford'));
ok('school states, colors, academics and rivalries know the 1994 names and Pacific');

// ---- the season ROM
const out = Off.seasonRom(d0, s0, rom, 1_800_000_000_000);
assert.ok(dynastyHeaderValid(out));
assert.equal(((out[DYN_AREA + 0x10] << 24) | (out[DYN_AREA + 0x11] << 16) | (out[DYN_AREA + 0x12] << 8) | out[DYN_AREA + 0x13]) >>> 0, dynastyFormat(107));
assert.deepEqual(readStamp(out.subarray(DYN_AREA, DYN_AREA + 16)), { dynasty: dynastyRomId('test94'), season: 1, rosterVersion: 1, time: 1_800_000_000 });
const setNames = readNamesTable(out, 107, (out[DYN_AREA + 0x20] << 24 | out[DYN_AREA + 0x21] << 16 | out[DYN_AREA + 0x22] << 8 | out[DYN_AREA + 0x23]) >>> 0);
for (const t of [0, 40, 106]) for (let k = 0; k < 32; k++) {
  const p = d0.players[s0.slots[t][k]! - 1];
  assert.equal(setNames[t][k]!.cls, CLASSES.indexOf(p.cls));
  assert.equal(`${setNames[t][k]!.first}|${setNames[t][k]!.last}`, `${p.first}|${p.last}`);
}
const fa = fineAddress(out)!;
for (const t of [3, 70]) for (let k = 0; k < 32; k++) assert.deepEqual(readFineOffsets(out, t, k, fa), readFineOffsets(rom, t, k).map((x, i) => {
  const step = readPlayer(roster, t, k).ratings[i];
  return Math.max(0, Math.min(240, 16 * step + x)) - 16 * step;
}), 'the first season\'s offsets are the ROM\'s');
assert.equal(scheduleAddress(out), null, 'no schedule in the first season');
assert.throws(() => Off.seasonRom({ ...d0, edition: '2026' }, s0, rom), /2026 Season Edition/);
ok('season ROM: format 0x0001006B, 107 teams, names with classes and blanks, the ROM\'s offsets; the other edition refused');

// ---- the save
const stamp = (file: Uint8Array) => {
  const f = file.slice();
  const id = dynastyRomId('test94');
  const b = [0x44, 0x59, 0x4e, 0x31, id >>> 24, (id >>> 16) & 255, (id >>> 8) & 255, id & 255, 0, 1, 0, 1, 0, 0, 0, 1];
  const window = f[1] === 0x94;
  b.forEach((x, k) => { f[window ? 0xe01 + 2 * (0x1330 + k) : 0x700 + 0x1330 + k] = x; });
  return f;
};
const srm = stamp(new Uint8Array(readFileSync(savePath)));
const save = readDynastySave(srm);
assert.equal(save.teams, 107);
assert.equal(save.stats.length, 107);
assert.ok(save.season && (save.season.lastRegularWeek === 10 || (save.season.realSchedule && save.season.lastRegularWeek === 13)), 'an 11-week regular season (Random), or Weeks 0-13 (Real 1994, test30 on)');
assert.ok(save.season!.games.every((g) => (g.visitor === null || g.visitor < 107) && (g.home === null || g.home < 107)));
const other = srm.slice(); other[1] = 0x6f; // the 2026 signature: a save of the other edition
assert.throws(() => importSave(d0, other), /2026 Season Edition/);
const imp = importSave(d0, srm);
assert.equal(imp.warning, undefined);
const d1 = imp.dynasty;
const v = seasonView(d1, d1.seasons[0]);
assert.ok(v.bowls && playoffSize(v) === 0, 'bowls, no playoff');
assert.equal(weekName(v, 0), save.season!.realSchedule ? 'Week 0' : 'Week 1');
const post = v.weeks - 1 - v.lastRegularWeek; // 1: the bowls; 2: the SEC Championship Game, then the bowls (test31 on)
if (save.season!.postseason) {
  assert.ok(post === 1 || post === 2, 'one or two postseason weeks');
  assert.equal(bowlWeek(v), v.weeks - 1);
  assert.equal(weekName(v, v.weeks - 1), 'Bowl Games');
  if (post === 2) {
    assert.equal(weekName(v, v.lastRegularWeek + 1), 'SEC Championship');
    const sec = v.games.filter((g) => g.week === v.lastRegularWeek + 1);
    assert.equal(sec.length, 1);
    assert.equal(bowlOf(v, sec[0]), null, 'the SEC title game is not a bowl');
    if (sec[0].visitor !== null) assert.ok([sec[0].visitor, sec[0].home].every((t) => d1.seasons[0].confNames[d1.seasons[0].conf[t!]] === 'SEC'));
  }
}
const bowls = v.games.filter((g) => g.week === bowlWeek(v));
if (bowls.length && bowls[0].visitor !== null) {
  assert.equal(bowls.length, 19);
  assert.deepEqual(bowls.map((g) => bowlOf(v, g)), BOWLS_1994);
}
if (v.done) {
  assert.equal(v.champion, v.order[0], 'the No. 1 team in the final poll is the champion');
  assert.deepEqual(champions(d1).map((c) => c.team), [v.order[0]]);
  const st = stories(d1, v);
  assert.ok(st.some((x) => x.kind === 'champion' && x.headline.includes('national champion')));
  assert.ok(st.filter((x) => x.kind === 'title' && / Bowl/.test(x.headline)).length >= 10, 'bowl result stories');
}
ok(`save: 107 teams, ${save.season!.games.filter((g) => g.vs !== null).length} results${v.done ? `, champion ${d1.teams[v.champion!].school}` : ''}; the other edition's save refused`);

// ---- schedules
const season = readWideSeason(rom);
const schoolList = d0.teams.map((t) => t.school);
const pairs = protectedPairs(schoolList, '1994');
assert.ok(pairs.length >= 40, 'the 1994 protected rivalries');
let finalesIn = 0, finales = 0;
for (let seed = 1; seed <= 20; seed++) {
  const sc = makeSchedule({ schools: schoolList, conf: season.conf, confWeeks: { start: season.start, games: season.games }, seed, weeks: 11, edition: '1994' });
  assert.equal(weeksOf(sc), 11);
  const chk = checkSchedule(sc, schoolList, season.conf, '1994');
  assert.deepEqual(chk.broken, [], 'one game a week, one bye a week (107 teams)');
  assert.deepEqual(chk.missing, [], 'every protected rivalry');
  assert.equal(sc.games.length, 11 * 53);
  for (const p of pairs.filter((x) => x.week === 10)) {
    finales++;
    if (sc.games.some((g) => g.week === 10 && ((g.visitor === p.a && g.home === p.b) || (g.visitor === p.b && g.home === p.a)))) finalesIn++;
  }
  const set = scheduleSet(sc);
  assert.equal(set[4], 11, 'the set says 11 weeks');
}
assert.ok(finalesIn / finales > 0.95, `finales in week 11 (${finalesIn} of ${finales})`);
// A bye: the user's team takes a game in its bye week; the other team's old opponent gets the bye.
const sc = makeSchedule({ schools: schoolList, conf: season.conf, confWeeks: { start: season.start, games: season.games }, seed: 3, weeks: 11, edition: '1994' });
const byeTeam = schoolList.findIndex((_, t) => teamSchedule(sc, t).some((x) => x === null));
const byeWeek = teamSchedule(sc, byeTeam).findIndex((x) => x === null);
const opp = schoolList.findIndex((_, t) => t !== byeTeam && teamSchedule(sc, t)[byeWeek] !== null && !teamSchedule(sc, t).some((x) => x?.opp === byeTeam));
const sc2 = setOpponent(sc, byeWeek, byeTeam, opp);
assert.equal(teamSchedule(sc2, byeTeam)[byeWeek]!.opp, opp);
assert.deepEqual(checkSchedule(sc2, schoolList, season.conf, '1994').broken, []);
ok(`schedules: 11 weeks with a bye a week, the 1994 rivalries, ${finalesIn} of ${finales} finales in week 11, bye edits`);

// ---- the offseason and the 1995 season
const o = Off.startOffseason(d1, { seed: 21, force: true });
const d2 = Sim.simOffseason(o, Off.recruitTemplates(o));
const s2 = d2.seasons[1];
assert.equal(s2.year, 1995);
assert.equal(weeksOf(s2.schedule), 11);
assert.deepEqual(checkSchedule(s2.schedule!, schoolList, s2.conf, '1994').broken, []);
assert.ok(d2.players.filter((p) => p.recruit && p.recruit.year === 1995).every((p) => p.first && p.last), 'new players have names');
const out2 = Off.seasonRom(d2, s2, rom, 1_800_000_100_000);
const sa = scheduleAddress(out2)!;
assert.equal(out2[sa + 4], 11);
assert.equal(readStamp(out2.subarray(DYN_AREA, DYN_AREA + 16))!.season, 2);
ok(`offseason: ${d2.players.filter((p) => p.status === 'active').length} players in 1995, an 11-week schedule in the 1995 ROM`);

// ---- user-defined rivalries in 1995 (user, 2026-11-16)
{
  const mine = [...rivalriesOf(d2).filter((r) => r.a !== 'Nebraska' && r.b !== 'Nebraska'), { a: 'Nebraska', b: 'Oklahoma', week: 2 }, { a: 'Pacific', b: 'Hawaii', week: 5 }];
  const r1 = setRivalries(d2, mine);
  const sc = r1.seasons[1].schedule!;
  const at = (n: string) => schoolList.indexOf(n);
  const inWeek = (a: string, b: string, w: number) => sc.games.some((x) => x.week === w && [x.visitor, x.home].sort().join() === [at(a), at(b)].sort().join());
  assert.ok(inWeek('Nebraska', 'Oklahoma', 2) && inWeek('Pacific', 'Hawaii', 5));
  const ck = checkSchedule(sc, schoolList, r1.seasons[1].conf, '1994', rivalriesOf(r1));
  assert.deepEqual(ck.broken, []);
  assert.deepEqual(ck.missing, []);
  assert.equal(weeksOf(sc), 11);
  ok(`rivalries: Nebraska-Oklahoma in week 3, Pacific-Hawaii in week 6 (${ck.offWeek.length} out of their week)`);
}

// ---- conferences in the 1995 offseason (user, 2026-11-16)
{
  assert.match(Conf.confLock(d1) ?? '', /first season/);
  assert.equal(Conf.confLock(d2), null);
  const c0 = Conf.confSetupOf(d2, s2);
  assert.deepEqual(c0.titleGames, readTitleGames(rom) ?? EDITIONS['1994'].titleGames, 'the SEC title game with its divisions');
  assert.deepEqual(c0.conf, readWideSeason(rom).conf, 'the first alignment is the ROM\'s');
  const at = (n: string) => schoolList.indexOf(n);
  const c1 = { ...c0, conf: c0.conf.slice(), names: c0.names.slice() };
  c1.conf[at('Penn State')] = 0; // to the SEC (it plays in the West of the title game)
  c1.conf[at('Notre Dame')] = 1;
  // 1994: only the first conference (the SEC title game) needs 2 teams.
  const oneBigEast = { ...c1, conf: c1.conf.map((c, t) => (c === 6 && t !== c1.conf.indexOf(6) ? 10 : c)) };
  assert.deepEqual(Conf.confIssues(d2, oneBigEast), []);
  const oneSec = { ...c1, conf: c1.conf.map((c, t) => (c === 0 && t !== c1.conf.indexOf(0) ? 10 : c)) };
  assert.ok(Conf.confIssues(d2, oneSec).some((x) => /title game/.test(x)));
  const tooLate = { ...c1, start: c1.start.map((x, i) => (i === 0 ? 4 : x)) };
  assert.ok(Conf.confIssues(d2, tooLate).some((x) => /run past week 11/.test(x)), '11 weeks');
  const d3 = Conf.setConferences(d2, c1);
  const s3 = d3.seasons[1];
  assert.equal(weeksOf(s3.schedule), 11);
  assert.deepEqual(checkSchedule(s3.schedule!, schoolList, s3.conf, '1994').broken, []);
  const ps = at('Penn State');
  const psSec = s3.schedule!.games.filter((x) => (x.visitor === ps || x.home === ps) && s3.conf[x.visitor === ps ? x.home : x.visitor] === 0).length;
  assert.ok(psSec >= 7, `Penn State plays an SEC schedule (${psSec}; 13 teams: a bye in one of the 8 rounds)`);
  const out3 = Off.seasonRom(d3, s3, rom, 1_800_000_100_000);
  assert.deepEqual(readWideSeason(out3).conf, c1.conf);
  assert.equal(out3[scheduleAddress(out3)! + 4], 11);
  // Title game switches (H-011): a Big Ten title game, the SEC's without divisions; no new schedule for them.
  const c2 = { ...c1, titleGames: c1.titleGames.slice() };
  c2.titleGames[1] = TG_ON; c2.titleGames[0] = TG_ON;
  const oneBig = { ...c2, conf: c2.conf.map((c, t) => (c === 1 && t !== c2.conf.indexOf(1) ? 10 : c)) };
  assert.ok(Conf.confIssues(d3, oneBig).some((x) => /title game/.test(x)), 'a conference with a title game needs 2 teams');
  const d4 = Conf.setConferences(d3, c2);
  assert.equal(d4.seasons[1].schedule, s3.schedule, 'title games keep the schedule');
  if (readTitleGames(rom)) {
    assert.deepEqual(readTitleGames(Off.seasonRom(d4, d4.seasons[1], rom, 1_800_000_100_000)), c2.titleGames);
  } else {
    assert.throws(() => Off.seasonRom(d4, d4.seasons[1], rom), /title games/, 'a ROM without the switches refuses changed ones');
    assert.ok(Off.seasonRom(d3, s3, rom), 'and takes the default ones');
  }
  ok(`conferences: Penn State to the SEC (${psSec} SEC games), Notre Dame to the Big Ten, into the 1995 ROM; title game switches${readTitleGames(rom) ? ' written' : ' refused by this older ROM'}`);
}

console.log(`\n${passed} passed (${EDITIONS['1994'].name})`);
