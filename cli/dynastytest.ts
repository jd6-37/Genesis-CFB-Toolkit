// Dynasty tests against a real ROM and battery save (bring your own; the ROM may be a .zip):
//   npx tsx cli/dynastytest.ts ELEVATED_2026_138_DYNASTY SAVE.srm
// The ROM is the 138-team 2026 Season Edition with the dynasty support (Elevated v2.0.1-test9 or later). The
// save is a Genesis Plus GX (RetroArch) .srm of the 138-team edition with a season started and at least one week
// played; the test puts its dynasty's mark (the ID block New Season copies) into it.
import { kickoffRanks } from '../src/core/dynasty/kickoffRanks';
import { hasV8 } from '../src/core/ratingsV8';
import { fromScale, toScale } from '../src/core/dynasty/ratings';
import { editionOfSig, layoutOfSig } from '../src/core/dynasty/edition';
import { rewriteWalshReport, seasonReports, setWalshReport, teamReport, walshLock } from '../src/core/dynasty/walshStore';
import { readReports, reportProblems } from '../src/core/walshReports';
import { walshReports } from '../src/core/dynasty/walshGen';
import { AP_2026_PRESEASON, VOTERS, pollSet, preseasonPoll } from '../src/core/dynasty/poll';
import { setSim, simOf, setStats } from '../src/core/dynasty/seasonSim';
import { STATS_DEFAULTS, readSimStats } from '../src/core/simStats';
import { SIM_DEFAULTS, readSimSettings, simForRom, type SimSettings } from '../src/core/simSettings';
import { careerRecords, teamRecords } from '../src/core/dynasty/records';
import { checkSchedule, editSchedule, flipHome, moveGame, protectedPairs, remakeSchedule, SCHED_WEEKS, weeksOf, setOpponent, teamSchedule, type SchedGame } from '../src/core/dynasty/schedule';
import { AWARD_SPOTS, AWARD_STATS_WEIGHT, POSITION_AWARDS, awardsIn, awardsOf, candidates, playerHonors, seasonAwards } from '../src/core/dynasty/awards';
import { readFileSync, writeFileSync } from 'node:fs';
import type { CoachData } from '../src/core/dynasty/coachData';
import { withCoaches } from '../src/core/dynasty/coaches';
import { hotSeat, tenure } from '../src/core/dynasty/carousel';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import { openRom } from '../src/core/romfile';
import { openSave, readDynastySave, ranksFromPower, STAT_SLOTS } from '../src/core/dynasty/save';
import { CLASSES, createDynasty, fromBase64, importSave, latestSave, rememberUser, rng, startingClass, weeksDone } from '../src/core/dynasty/model';
import { champions, INDEPENDENT, playerName, leaders, playerLines, seasonRecords, RECORD_STATS, seasonView, standings, teamHistory, weekName } from '../src/core/dynasty/derive';
import { offseasonStories, stories } from '../src/core/dynasty/news';
import { rivalryOf } from '../src/core/dynasty/rivalries';
import { meetings, seriesStory } from '../src/core/dynasty/series';
import { REAL94_THROUGH, REAL_THROUGH, TROPHIES, realSeries, trophyOf } from '../src/core/dynasty/trophies';
import { trophyRoom } from '../src/core/dynasty/trophyRoom';
import { teamArt } from '../src/core/dynasty/art';
import { dynastyFileName, dynastyFileText, readDynastyFile } from '../src/core/dynasty/storage';
import { CFB27_LATEST } from '../src/core/cfb27Latest';
import { OVR_FORMULAS, OVR_FORMULAS_V8, playerOvr, roleOfSlot } from '../src/core/dynasty/ovr';
import { readRating } from '../src/core/teamRatings';
import { hasKits, ktabOf, readKits } from '../src/core/kits';
import { ownUniforms } from '../src/core/kits';
import { kitOf, ownOf, setKit, setOwn, setWhiteHome, whiteHomeLock } from '../src/core/dynasty/kit';
import * as Off from '../src/core/dynasty/offseason';
import * as Num from '../src/core/dynasty/numbers';
import * as Rec from '../src/core/dynasty/recruiting';
import { conferencePitch, conferencePrestige } from '../src/core/dynasty/confPrestige';
import * as Sim from '../src/core/dynasty/sim';
import { DEFAULT_RULES as RD, readRulesFile, rulesFileText, rulesOf, setRules } from '../src/core/dynasty/rules';
import { academicsOf, CFB27_ACADEMICS } from '../src/core/dynasty/academics';
import { SCHOOL_STATE, stateCode } from '../src/core/dynasty/schoolStates';
import { experienceOf, recordRatings, trainingResults, trainingYears } from '../src/core/dynasty/career';
import { randomBench } from '../src/core/dynasty/bench';
import * as Conf from '../src/core/dynasty/conferences';
import { rivalriesOf, rivalryIssues, setRivalries } from '../src/core/dynasty/schedule';
import type { Rivalry } from '../src/core/dynasty/rivalries';
import { readTitleGames, readWideSeason } from '../src/core/seasonWide';
import { gameText, dynastyAreaProblem, dynastyHeaderValid, dynastyRomId, DYN_AREA, DYN_END, fineAddress, hasDynastyHooks, readStamp, scheduleAddress, readPollSet, POLL_AT } from '../src/core/dynasty/dynastyArea';
import { simFromOvr } from '../src/core/teamRatings';
import { parseCsv } from '../src/core/rosterSheet';
import { rosterLayout } from '../src/core/rosterLayouts';
import * as Depth from '../src/core/dynasty/depth';
import { bwSlotOf, fineOf, ovrOf, shownFine, splitFine, stepOf, valueOfFine } from '../src/core/dynasty/ratings';
import { hasFineRatings, putFineOffsets, readFineOffsets } from '../src/core/dynasty/fine';
import { GROUP_ATTRS } from '../src/core/rosterLayouts';
import { applyEdits, editLook, playersCsv, readPlayersCsv } from '../src/core/dynasty/edit';
import { lookChoices, lookOf } from '../src/core/dynasty/headshot';
import { blackShare, MAX_FIRST, MAX_LAST, SKIN_TONES } from '../src/core/dynasty/appearance';
import { backupLabel, lineupLock, moveToSpot, SPOTS, spotLabel, spotsFor } from '../src/core/dynasty/lineup';
import { nextPrestige, tierOfRank } from '../src/core/dynasty/prestige';
import { EVEN_TRAINING, trainingFactor, trainingOf, trainingProblems, weightGain } from '../src/core/dynasty/training';
import { openRosterRom, readPlayer, getRating, jerseyByte, jerseyNumber, teamLayout } from '../src/core/rosterRom';

const [romPath, savePath] = process.argv.slice(2);
if (!romPath || !savePath) {
  console.error('usage: tsx cli/dynastytest.ts ELEVATED_2026_138_DYNASTY SAVE.srm');
  process.exit(2);
}
const rom = (await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data;
// The ID block New Season copies into the season block (+0x1330), for the test dynasty ('test'), season 1.
const stampSave = (file: Uint8Array, id: number, season: number, version: number) => {
  const f = file.slice();
  const b = [0x44, 0x59, 0x4e, 0x31, id >>> 24, (id >>> 16) & 255, (id >>> 8) & 255, id & 255, season >> 8, season & 255, version >> 8, version & 255, 0, 0, 0, 1];
  const window = editionOfSig(f[1]) !== null; // layout 1 or 2 (0x6F / 0xE6)
  b.forEach((x, k) => { f[window ? 0xe01 + 2 * (0x1330 + k) : 0x700 + 0x1330 + k] = x; });
  return f;
};
const rawSrm = new Uint8Array(readFileSync(savePath));
const srm = stampSave(rawSrm, dynastyRomId('test'), 1, 1);
const csv = readFileSync(new URL(`../public/${CFB27_LATEST.file}`, import.meta.url), 'utf8');
let passed = 0;
import { coachChecks } from './coachchecks';
const ok = (name: string) => {
  passed++;
  console.log('ok -', name);
};

// ---- the save
const save = readDynastySave(srm);
assert.ok(save.hasSeason && save.season, 'the save has a season');
const s = save.season!;
assert.equal(s.weekStart[s.weeks], s.games.length);
assert.ok(s.games.every((g) => g.visitor !== null || g.home !== null || g.week > s.lastRegularWeek), 'regular-season games have teams');
assert.ok(s.games.every((g) => (g.vs === null) === (g.hs === null)));
assert.equal(save.stats.length, 138);
ok(`save read: ${s.weeks} weeks, ${s.games.length} games, ${s.games.filter((g) => g.vs !== null).length} played, user teams ${s.userTeams.join(',')}`);

// The packed form (data bytes only) reads the same.
const packedSrm = openSave(srm).format === 'window' ? srm.filter((_, i) => i & 1) : srm;
assert.deepEqual(readDynastySave(packedSrm).season, s);
assert.deepEqual(readDynastySave(packedSrm).stats, save.stats);
ok('packed save reads the same');

// Passing and receiving add up across the league (not always per team: the game sometimes credits a
// catch without a completion, or the other way round).
const sum = (f: (t: (typeof save.stats)[number]) => number) => save.stats.reduce((a, t) => a + f(t), 0);
const passYds = sum((t) => t.passing[0].s.yds), recYds = sum((t) => t.receiving.reduce((a, e) => a + e.s.yds, 0));
const comps = sum((t) => t.passing[0].s.comp), catches = sum((t) => t.receiving.reduce((a, e) => a + e.s.rec, 0));
assert.ok(passYds > 0 && Math.abs(passYds - recYds) <= passYds * 0.02, `passing ${passYds} vs receiving ${recYds} yards`);
assert.ok(Math.abs(comps - catches) <= comps * 0.02, `completions ${comps} vs receptions ${catches}`);
assert.deepEqual(Object.keys(save.stats[0]), Object.keys(STAT_SLOTS));
ok(`team stats add up: ${passYds} passing, ${recYds} receiving yards`);

// Ranks: a strict order, ties by team order.
const { order, rank } = ranksFromPower(s.power);
assert.equal(new Set(order).size, 138);
for (let i = 1; i < order.length; i++) {
  const a = order[i - 1], b = order[i];
  assert.ok(s.power[a] > s.power[b] || (s.power[a] === s.power[b] && a < b));
}
order.forEach((t, i) => assert.equal(rank[t], i + 1));
ok('ranks from power');

// Not a save.
assert.throws(() => readDynastySave(new Uint8Array(1000)));
const blank = srm.slice();
blank[openSave(srm).format === 'window' ? 3 : 1] = 1; // $200003 != 0: no season
assert.equal(readDynastySave(blank).hasSeason, false);
ok('refuses a file that is not a save; reads a save without a season');

// ---- creating a dynasty
assert.equal(startingClass('Freshman', 'Redshirted'), 'SO');
assert.equal(startingClass('Senior', 'Redshirted'), 'SR+');
assert.equal(startingClass('Junior', 'Not Redshirted'), 'JR');
const t0 = Date.now();
let renumbered: { player: number; from: number; to: number }[] = [];
const d0 = createDynasty(rom, csv, { name: 'Test', seed: 1, id: 'test', created: '2026-01-01T00:00:00.000Z', onNumbers: (l) => { renumbered = l; } });
const took = Date.now() - t0;
assert.equal(d0.teams.length, 138);
{
  // Numbers a position can't wear in the game are replaced at the start. The built-in file has none left since
  // 2026-11-20 (user: "Fix their numbers in whatever source they're coming from!"); other files still get the fix.
  assert.ok(d0.players.every((p) => Num.numberAllowed(p.pos, p.jersey)), 'every starting number is one the position may wear');
  assert.equal(renumbered.length, 0, 'the built-in file has only numbers the game allows');
  for (const n of renumbered) {
    const p = d0.players[n.player - 1];
    assert.ok(p.jersey === n.to && !Num.numberAllowed(p.pos, n.from));
    assert.equal(d0.players.filter((q) => q.team === p.team && q.jersey === p.jersey && Num.sideOf(q.pos) === Num.sideOf(p.pos)).length, 1, 'a replaced number is nobody else\'s on his side');
  }
  ok(`starting numbers: every one allowed at its position (${renumbered.length} replaced)`);
}
assert.ok(d0.players.length > 8000 && d0.players.length <= 138 * 64, 'players: the 32 and the bench of every team');
assert.ok(d0.players.every((p) => first0Has(p.id)), 'every player is in the game or on the bench');
assert.ok(d0.players.every((p) => CLASSES.includes(p.cls) && p.skin >= 0 && p.skin < 4 && (p.ratings.Weight ?? 0) >= 140 && p.ovr === ovrOf(p)));
// Every player's own ratings are his converted steps, as the game shows them (the first season = the ROM).
for (const [grid, rated] of [[first0().slots, first0().bw], [first0().bench, first0().benchBw]] as const) {
  grid!.forEach((sl, t) => sl.forEach((id, slot) => {
    const b = rated![t][slot];
    if (!id || !b) return;
    const spots = first0().slots[t].filter((x) => x === id).length + (first0().bench?.[t].filter((x) => x === id).length ?? 0);
    if (spots > 1) return; // a kicker who also punts keeps the kicker's ratings (the season keeps both slots' steps)
    const mine = bwSlotOf(d0.players[id - 1], b);
    // The player's number stops at 100 (fine 240); the slot keeps the ROM's offset above it (H-031).
    const capped = b.offs.map((o, i) => Math.min(240, 16 * b.steps[i] + o) - 16 * b.steps[i]);
    assert.deepEqual([mine.steps, mine.offs], [b.steps, capped], `team ${t} slot ${slot}`);
  }));
}
// Fine ratings (v2.0.1-test13 on): the Active Roster's offsets are the ROM's table, so the app shows what the
// game's Team Rosters shows; backups' are drawn evenly.
{
  const fineRom = hasFineRatings(rom);
  let slots = 0, nonzero = 0, sum = 0, cnt = 0;
  first0().bw!.forEach((sl, t) => sl.forEach((b, slot) => {
    if (!b) return;
    slots++;
    assert.ok(b.offs.length === 6 && b.offs.every((o) => Number.isInteger(o) && o >= -8 && o <= 7));
    if (fineRom) {
      const want = readFineOffsets(rom, t, slot);
      const rec = GROUP_ATTRS[b.group].map((a) => b.steps[b.attrs.indexOf(a)]);
      assert.deepEqual(GROUP_ATTRS[b.group].map((a) => b.offs[b.attrs.indexOf(a)]), want.map((o, i) => Math.max(0, 16 * rec[i] + o) - 16 * rec[i]), `offsets team ${t} slot ${slot}`);
    }
    if (b.offs.some((o) => o)) nonzero++;
  }));
  first0().benchBw!.forEach((sl) => sl.forEach((b) => { if (b) for (const o of b.offs) { sum += o; cnt++; } }));
  // Older ROMs: backups' offsets are drawn evenly. v8 ROMs (H-039): they come from the conversion's fine values.
  assert.ok(nonzero / slots > 0.9 && (hasV8(rom) || Math.abs(sum / cnt + 0.5) < 0.3), 'offsets everywhere, backups centered');
  // Numbers ↔ fine values ↔ what the game shows.
  assert.deepEqual([fineOf(0), fineOf(50), fineOf(100)], [0, 120, 240]);
  assert.deepEqual([splitFine(0), splitFine(206), splitFine(216), splitFine(247)], [{ step: 0, off: 0 }, { step: 13, off: -2 }, { step: 14, off: -8 }, { step: 15, off: 7 }]);
  assert.deepEqual([shownFine(0), shownFine(206), shownFine(239), shownFine(240), shownFine(247)], [0, 85, 99, 99, 99]);
  for (let f = 0; f <= 240; f++) assert.equal(fineOf(valueOfFine(f)), f, `fine ${f} survives as a number`);
  ok(`fine ratings: ${fineRom ? 'the ROM\'s offsets on' : 'drawn offsets on'} ${slots} Active Roster slots (${Math.round((nonzero / slots) * 100)}% not on a step), backups average ${(sum / cnt).toFixed(2)}`);
}
function first0() { return d0.seasons[0]; }
// Linemen and linebackers also have the related group's rating (lineup moves DE/OLB).
assert.ok(d0.players.filter((p) => ['LE', 'RE', 'DT'].includes(p.pos)).every((p) => p.ratings.Quickness !== undefined));
assert.ok(d0.players.filter((p) => ['LOLB', 'ROLB', 'MLB'].includes(p.pos)).every((p) => p.ratings.Power !== undefined));
assert.equal(new Set(d0.players.map((p) => p.id)).size, d0.players.length);
const first = d0.seasons[0];
function first0Has(id: number) { return d0.seasons[0].slots.some((sl) => sl.includes(id)) || !!d0.seasons[0].bench?.some((sl) => sl.includes(id)); }
assert.ok(first.bench!.flat().filter((x) => x !== null).length > 4000, 'nearly every slot has a backup');
first.bench!.forEach((sl, t) => sl.forEach((id, slot) => {
  if (id === null) return;
  assert.equal(d0.players[id - 1].team, t);
  assert.ok(!first.slots[t].includes(id), 'a backup isn\'t also in the game');
  assert.equal(first.benchBw![t][slot]!.label, first.bw![t][slot]!.label, 'the backup is rated for his slot');
}));
assert.equal(first.year, 2026);
assert.equal(first.conf.length, 138);
assert.equal(first.slots.length, 138);
for (const [t, sl] of first.slots.entries()) {
  assert.equal(sl.length, 32);
  for (const id of sl) if (id !== null) assert.equal(d0.players[id - 1].team, t, 'a slot holds a player of the team');
}
assert.ok(first.slots.every((sl) => sl[0] !== null && d0.players[sl[0]! - 1].pos === 'QB'), 'every team has a QB in slot 0');
// Every filled slot has the game's ratings: six 0-15 steps in the roster screen's order, Weight and Speed first.
for (const [t, sl] of first.slots.entries()) {
  sl.forEach((id, slot) => {
    const b = first.bw![t][slot];
    assert.equal(b !== null, id !== null, 'ratings exactly for the filled slots');
    if (!b) return;
    assert.equal(b.steps.length, 6);
    assert.deepEqual(b.attrs.slice(0, 2), ['Weight', 'Speed']);
    assert.ok(b.steps.every((x) => Number.isInteger(x) && x >= 0 && x <= 15));
  });
}
// Same inputs, same dynasty.
assert.deepEqual(createDynasty(rom, csv, { name: 'Test', seed: 1, id: 'test', created: '2026-01-01T00:00:00.000Z' }), d0);
// Another starting year (user, 2026-11-17: a 2027 dynasty on a ROM with 2027 rosters): the seasons count from it, the
// real 2026 coaches come along (a year older), and the first season still starts from the ROM's real AP poll.
{
  const d27 = createDynasty(rom, csv, { name: 'Test', seed: 1, id: 'test27', created: '2026-01-01T00:00:00.000Z', startYear: 2027 });
  assert.equal(d27.startYear, 2027);
  assert.equal(d27.seasons[0].year, 2027);
  const data = JSON.parse(readFileSync('public/data/coaches-2026.json', 'utf8')) as CoachData;
  const c27 = withCoaches(d27, data);
  assert.equal(c27.coachYear, 2026);
  const c26 = withCoaches(d0, data);
  assert.equal(c26.coachYear, undefined);
  assert.deepEqual(c27.coaches!.map((x) => [x.name, x.team, x.born, x.ratings]), c26.coaches!.map((x) => [x.name, x.team, x.born, x.ratings]), 'the same coaches');
  const smart = c27.coaches!.find((x) => x.name === 'Kirby Smart')!;
  assert.equal(tenure(c27, smart, 0), tenure(c26, smart, 0), 'real seasons before the dynasty count the same');
  assert.ok(tenure(c27, smart, 0) > 5);
  assert.equal(hotSeat(c27, smart, 0), hotSeat(c26, smart, 0));
  assert.deepEqual(preseasonPoll(c27, c27.seasons[0])!.slice(0, 25).map((e) => e.team), preseasonPoll(c26, c26.seasons[0])!.slice(0, 25).map((e) => e.team), 'the ROM\'s real poll');
  ok('another starting year: seasons from 2027, the real 2026 coaches and poll');
}
// Team OVRs are the ROM's.
assert.equal(first.teamOvr!.length, 138);
first.teamOvr!.forEach((r, t) => assert.deepEqual(r, readRating(rom, t)));
// Player OVRs from the game ratings: every formula's shares add up to 100, and the OVRs land near CFB 27's.
for (const f of [...Object.values(OVR_FORMULAS), ...Object.values(OVR_FORMULAS_V8)]) assert.equal(Object.values(f.weights).reduce((a, b) => a + b!, 0), 100);
const misses = new Map<string, number[]>();
const sheet27 = parseCsv(csv);
const cfbOverall = new Map(sheet27.rows.map((r) => [Number(r[sheet27.headers.indexOf('EA Player ID')]), Number(r[sheet27.headers.indexOf('Overall')])]));
first.slots.forEach((sl, t) => sl.forEach((id, slot) => {
  if (id === null) return;
  const o = playerOvr(slot, first.bw![t][slot]!);
  assert.ok(o >= 0 && o <= 99);
  const role = roleOfSlot(slot);
  misses.set(role, [...(misses.get(role) ?? []), Math.abs(o - cfbOverall.get(d0.players[id - 1].srcId!)!)]);
}));
const allMiss = [...misses.values()].flat();
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
// v8 (H-039): FB fits worst (CFB 27's FB Overall leans on blocking, which BW95 has no rating for), about 2.5 off.
for (const [role, m] of misses) assert.ok(mean(m) < (role === 'FB' && hasV8(rom) ? 3 : 2.5), `${role} OVR is ${mean(m).toFixed(1)} off CFB 27 on average`);
ok(`player OVRs: average miss ${mean(allMiss).toFixed(2)} from CFB 27, ${((allMiss.filter((x) => x <= 3).length / allMiss.length) * 100).toFixed(0)}% within 3`);
ok(`dynasty created in ${took} ms: ${d0.players.length} players, ${CLASSES.map((c) => `${c} ${d0.players.filter((p) => p.cls === c).length}`).join(', ')}`);

// ---- importing saves
const r1 = importSave(d0, srm, { at: '2026-01-02T00:00:00.000Z' });
const d1 = r1.dynasty;
assert.equal(d0.seasons[0].imports.length, 0, 'the input is left as it is');
assert.equal(r1.season.imports.length, 1);
assert.deepEqual(d1.userTeams, s.userTeams);
assert.deepEqual(latestSave(r1.season)!.season, s);
assert.equal(r1.season.imports[0].weeksDone, weeksDone(save));
{
  // Scores' ranks at kickoff (kickoffRanks): the save's lastRanks are the last week played's; a complete week's
  // power ranks the next week's (user, 2026-11-26).
  const kr = kickoffRanks(d1, r1.season);
  let last = -1;
  for (const g of s.games) if (g.vs !== null && g.week > last) last = g.week;
  if (last >= 0 && s.lastRanks.some((x) => x > 0)) assert.deepEqual(kr[last], s.lastRanks);
  assert.ok(kr[0], 'week 0 has ranks (a save or the preseason poll)');
  ok('Scores ranks at kickoff come from the save (lastRanks; power for the next week) and the preseason poll');
}
// The same save again replaces the import for that week.
const d2 = importSave(d1, srm).dynasty;
assert.equal(d2.seasons[0].imports.length, 1);
// An older save (one result taken away) is refused.
const older = srm.slice();
const g = s.games.find((x) => x.vs !== null)!;
const fmt = openSave(srm).format;
// Season block byte j is at cartridge $200E01 + 2j: file offset 0xE01 + 2j, or 0x700 + j packed.
const j = 0x200 + 4 * g.index;
const off = (k: number) => (fmt === 'window' ? 0xe01 + 2 * k : 0x700 + k);
older[off(j)] = 0xff;
older[off(j + 2)] = 0xff;
assert.throws(() => importSave(d1, older), /older save/);
assert.doesNotThrow(() => importSave(d1, older, { allowOlder: true }));
// A save without a season is refused.
assert.throws(() => importSave(d0, blank), /no season/);
ok('saves import (same save replaces, older and empty saves refused)');

// ---- views
const v = seasonView(d1, d1.seasons[0]);
assert.equal(v.weeks, s.weeks);
const played = v.games.filter((x) => x.vs !== null).length;
assert.equal(v.records.reduce((a, r) => a + r.w + r.l, 0), 2 * played - 2 * v.games.filter((x) => x.vs !== null && x.vs === x.hs).length);
assert.equal(v.records.reduce((a, r) => a + r.w, 0), v.records.reduce((a, r) => a + r.l, 0));
assert.equal(v.records.reduce((a, r) => a + r.pf, 0), v.records.reduce((a, r) => a + r.pa, 0));
assert.ok(v.currentWeek <= v.weeks);
const names = Array.from({ length: v.weeks }, (_, w) => weekName(v, w));
assert.equal(names[v.weeks - 1], s.postseason ? 'National Championship' : names[v.weeks - 1]);
if (s.realSchedule) assert.equal(names[0], 'Week 0');
for (let c = 0; c < first.confNames.length; c++) {
  const st = standings(v, c);
  assert.equal(st.length, first.conf.filter((x) => x === c).length);
}
ok(`season view: ${names[v.currentWeek] ?? 'done'} next; ${names.slice(-3).join(', ')}`);

const lines = playerLines(v);
assert.ok(lines.length > 0);
assert.ok(lines.every((l) => l.player === null || d1.players[l.player - 1].team === l.team));
const top = leaders(lines, 'passing', 'yds', 5);
for (let i = 1; i < top.length; i++) assert.ok((top[i - 1].s as { yds: number }).yds >= (top[i].s as { yds: number }).yds);
assert.ok(seasonRecords(d1, RECORD_STATS[0]).length > 0);
assert.equal(teamHistory(d1, s.userTeams[0] ?? 0).length, 1);
assert.ok(champions(d1).length <= 1);
ok(`player stats: ${lines.length} lines; passing leader ${top[0] ? `${d1.players[top[0].player! - 1]?.last} ${(top[0].s as { yds: number }).yds}` : 'none'}`);

const st = stories(d1);
assert.ok(st.length > 0, 'stories');
assert.equal(new Set(st.map((x) => x.id)).size, st.length, 'story ids are unique');
assert.ok(st.every((x) => x.teams.every((t) => t >= 0 && t < 138)));
assert.deepEqual(stories(d1), st, 'the same season gives the same stories');
ok(`news: ${st.length} stories, lead "${st[0].headline}"`);
// A user team in or out of the Top 25 (user, 2026-11-27): the rank going into the week against the new one.
{
  const v0 = seasonView(d1, d1.seasons[0]), u = d1.userTeams[0];
  if (u !== undefined && v0.save) {
    const fake = (was: number, now: number) => {
      const rank = v0.rank.slice(); rank[u] = now;
      const sv = v0.save!, season = sv.season!, lastRanks = season.lastRanks.slice(); lastRanks[u] = was;
      return stories(d1, { ...v0, rank, save: { ...sv, season: { ...season, lastRanks } } }).filter((x) => x.id.includes(`-top25-${u}`));
    };
    const inn = fake(31, 18), outt = fake(22, 30);
    assert.equal(inn.length, 1); assert.match(inn[0].headline, /Top 25|ranked/); assert.match(inn[0].dek!, /No\. 18/);
    assert.equal(outt.length, 1); assert.match(outt[0].headline, /Top 25|poll/); assert.match(outt[0].dek!, /No\. 22/);
    assert.equal(fake(12, 9).length + fake(40, 33).length, 0, 'no story inside or outside the poll');
    ok(`news: Top 25 in / out for your team ("${inn[0].headline}" / "${outt[0].headline}")`);
  }
}
// Headline windows (user, 2026-11-26): a game's story names its game; "holds off" only for close games; a user
// team's rivalry game gets one story; stat stories name their stat.
{
  const v1 = seasonView(d1, d1.seasons[0]);
  for (const x of st.filter((y) => y.game !== undefined)) {
    const g = v1.games.find((y) => y.index === x.game)!;
    assert.ok(g && g.vs !== null && g.week === x.week && x.teams.slice(0, 2).every((t) => t === g.visitor || t === g.home), `story ${x.id} names its game`);
    if (/holds off/.test(x.headline)) assert.ok(Math.abs(g.vs! - g.hs!) <= 7, `holds off only when close: ${x.headline}`);
  }
  assert.ok(st.filter((x) => ['upset', 'topgame', 'rout', 'yours', 'rivalry'].includes(x.kind) && !x.id.includes('hot')).every((x) => x.game !== undefined), 'game stories name their game');
  const games = new Map<number, string[]>();
  for (const x of st) if (x.game !== undefined) games.set(x.game, [...(games.get(x.game) ?? []), x.kind]);
  for (const kinds of games.values()) assert.ok(!(kinds.includes('yours') && kinds.includes('rivalry')), 'no second story for a user rivalry game');
  assert.ok(st.filter((x) => x.kind === 'leader').every((x) => x.stat), 'leader stories name their stat');
  const g0 = v1.games.find((g) => g.vs !== null && g.visitor !== null && g.home !== null)!;
  const ss = seriesStory(d1, g0.visitor!, g0.home!, { year: v1.season.year, week: g0.week }, (t) => d1.teams[t].school);
  assert.equal(ss.record, 'First meeting in this dynasty');
  assert.equal(ss.last.length, 0);
  ok(`headline windows: ${games.size} game stories name their game`);
}

// ---- dynasty files
const text = dynastyFileText(d1);
assert.deepEqual(readDynastyFile(text), JSON.parse(text));
assert.equal(readDynastyFile(text).id, d1.id);
assert.ok(dynastyFileName(d1).endsWith('-2026.dynasty.json'));
assert.throws(() => readDynastyFile('{"app":"other"}'), /isn't a dynasty file/);
assert.throws(() => readDynastyFile('not json'), /isn't JSON/);
assert.throws(() => readDynastyFile(JSON.stringify({ ...JSON.parse(text), version: 99 })), /newer version/);
// The file keeps the save bytes only, packed.
assert.equal(fromBase64(d1.seasons[0].imports[0].data).length, packedSrm.length);
ok(`dynasty file round trip (${(text.length / 1e6).toFixed(1)} MB)`);

// ---- art
const art = teamArt(rom);
assert.equal(art.length, 138);
assert.ok(art.every((a) => a.logo && a.logo.width > 0 && a.helmet && a.word));
ok('team art from the ROM');

// ---- offseason
assert.throws(() => Off.startOffseason(d1, { seed: 3 }), /isn't over/);
const o1 = Off.startOffseason(d1, { seed: 3, force: true });
const act = (x: typeof d1) => x.players.filter((p) => p.status === 'active' && p.team !== null);
assert.equal(act(o1).filter((p) => p.cls === 'SR+').length, o1.offseason!.events.filter((e) => e.kind === 'returns').length, 'only returning seniors are SR+');
assert.ok(d1.players.filter((p) => p.cls === 'SR+').every((p) => o1.players[p.id - 1].status === 'graduated'), 'every SR+ leaves');
assert.ok(act(o1).every((p) => p.pot !== undefined && p.pot >= p.ovr));
assert.deepEqual(Off.startOffseason(d1, { seed: 3, force: true }), o1, 'same seed, same offseason');
{
  // Players develop at the end of the offseason (after recruiting and cuts), not when it starts.
  const back = o1.offseason!.train!;
  assert.ok(back.length > 3000 && o1.offseason!.growth.length === 0, 'nobody develops yet');
  const p0 = back[0].player;
  assert.deepEqual(o1.players[p0 - 1].ratings, d1.players[p0 - 1].ratings, 'ratings unchanged at the start');
  assert.notEqual(o1.players[p0 - 1].cls, d1.players[p0 - 1].cls, 'but he moves up a class');
}
// Prestige: the starting stars follow the scale (10 six-star, 10 five, 15 four, 35 three, 30 two, 38 one);
// at the season's end each school moves at most one star toward its final poll place's tier.
assert.deepEqual([1, 10, 11, 20, 21, 35, 36, 70, 71, 100, 101].map((r) => tierOfRank(r)), [6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1]);
assert.equal(nextPrestige(3, 5), 4);
assert.equal(nextPrestige(3, 120), 2);
assert.equal(nextPrestige(3, 50), 3);
const p0 = first.prestige!;
assert.deepEqual([6, 5, 4, 3, 2, 1].map((n) => p0.filter((x) => x === n).length), [10, 10, 15, 35, 30, 38]);
const vEnd = seasonView(d1, d1.seasons[0]);
o1.offseason!.prestige!.forEach((to, t) => {
  assert.ok(Math.abs(to - p0[t]) <= 1);
  assert.equal(Math.sign(to - p0[t]), Math.sign(tierOfRank(vEnd.rank[t]) - p0[t]));
});
assert.deepEqual(Off.cancelOffseason(o1).players, d1.players);
// Projected depth chart first (step 'depth'), then who enters the portal (Players Leaving).
assert.equal(o1.offseason!.step, 'depth');
assert.throws(() => Off.runPortal(o1), /after the season/);
const ctx1 = Off.portalContext(o1);
const depthGuy = act(o1).find((p) => ctx1.role.get(p.id) === 'depth' && !ctx1.nextStarters.has(p.id) && Off.playingTime(ctx1, p) === 0 && p.cls !== 'SR' && p.cls !== 'SR+')!;
{ const R0 = rulesOf(o1); assert.ok(Math.abs(Off.transferChance(o1, depthGuy, ctx1) - (R0.transferDepth + R0.transferBlocked)) < 1e-9, 'a blocked depth player with no touches: depth + blocked'); }
const busy = { ...ctx1, touches: new Map(ctx1.touches).set(depthGuy.id, 1000) };
assert.ok(Math.abs(Off.transferChance(o1, depthGuy, busy) - (RD.transferDepth + RD.transferBlocked) * 0.2) < 1e-9, 'full playing time: 80% less');
// Promoting him to a starting spot on the projected depth chart takes away the "blocked" 10%.
const team1 = depthGuy.team!;
const chart = Off.projectedDepth(o1, team1).slice();
const lay = rosterLayout('bw95', false, true, true);
const spot = lay.find((def) => !Off.DEPTH_SLOTS.has(def.label) && chart[def.slot] !== null && o1.players[chart[def.slot]! - 1].pos === depthGuy.pos)?.slot ?? -1;
if (spot >= 0) {
  const was = chart.indexOf(depthGuy.id);
  if (was >= 0) chart[was] = chart[spot];
  chart[spot] = depthGuy.id;
  const promoted = { ...o1, offseason: { ...o1.offseason!, projected: { [team1]: chart } } };
  assert.ok(Math.abs(Off.transferChance(promoted, depthGuy) - RD.transferDepth) < 1e-9, 'a promised starting job: no longer blocked');
}
assert.ok(Off.projectedProblems(o1, team1, [...chart.slice(0, 31), 999999]).length > 0, 'a player from elsewhere is refused');
// A team with no quarterback: the projected chart leaves the spot open and nobody holds two spots;
// the season's chart still fills all 32.
{
  const noQb = act(o1).filter((p) => p.team === team1 && p.pos !== 'QB').slice(0, 28);
  const open = Depth.teamDepth(noQb, true).slots;
  const ids = open.filter((x) => x !== null);
  assert.equal(open[lay.findIndex((def) => def.label === 'QB')], null, 'no quarterback: the QB spot stays open');
  assert.equal(new Set(ids).size, ids.length, 'nobody holds two spots on the projected chart');
  assert.ok(lay.every((def) => open[def.slot] === null || o1.players[open[def.slot]! - 1].pos === Depth.slotPosition(def.label)), 'only players of the spot\'s own position');
  assert.ok(Depth.teamDepth(noQb).slots.every((x) => x !== null), "the season's chart fills every spot");
  // The layout's order is not the slot order (P is slot 31): the punter's spot holds a punter.
  const full = Depth.teamDepth(act(o1).filter((p) => p.team === team1)).slots;
  assert.equal(Depth.SLOT_DEF[31].label, 'P');
  assert.ok(lay.every((def) => Depth.SLOT_DEF[def.slot].label === def.label), 'every spot is found by its slot number');
  const punter = full[31] !== null ? o1.players[full[31]! - 1].pos : '';
  // Before signing day a team can have no kicker or punter left (both graduated); walk-ons fill that later.
  const kickers = act(o1).filter((p) => p.team === team1 && (p.pos === 'P' || p.pos === 'K')).length;
  assert.ok(!kickers || punter === 'P' || punter === 'K', `slot 31 holds the punter (${punter})`);
}
const o1p = Off.confirmDepth(o1);
assert.equal(o1p.offseason!.step, 'portal');
const entering = o1p.offseason!.portal!;
assert.ok(entering.length > 50 && entering.every((id) => o1p.players[id - 1].status === 'active'), `${entering.length} enter the portal`);
assert.ok(entering.filter((id) => ctx1.role.get(id) === 'starter').length < entering.length * 0.2, 'few starters leave');
const o2 = Off.runPortal(o1p);
const moves = o2.offseason!.events.filter((e) => e.kind === 'transfer');
const ctx2 = Off.portalContext(o1p);
for (const m of moves) if (m.kind === 'transfer') {
  assert.equal(o2.players[m.player - 1].team, m.to);
  assert.ok(m.to !== null && m.to !== m.from && o1p.players[m.player - 1].ovr > (ctx2.starterBar.get(m.to)!.get(o1p.players[m.player - 1].pos) ?? 0), 'only to a starting job');
}
const stayedHome = entering.filter((id) => !moves.some((m) => m.kind === 'transfer' && m.player === id));
assert.ok(stayedHome.every((id) => o2.players[id - 1].team === o1p.players[id - 1].team && o2.players[id - 1].status === 'active'), 'nobody would start him: he stays');
ok(`transfers: ${entering.length} enter the portal, ${moves.length} find a starting job, ${stayedHome.length} stay`);
const tpl = Off.recruitTemplates(o2);
const o3 = Off.runSigningDay(o2, tpl);
const signed = o3.offseason!.events.filter((e) => e.kind === 'signed');
for (const t of o3.teams) {
  const n = signed.filter((e) => e.kind === 'signed' && e.team === t.index).length;
  assert.ok(n <= Off.CLASS_MAX, `${t.school} signs ${n}`);
}
assert.ok(signed.every((e) => e.kind === 'signed' && e.stars >= 1 && e.stars <= 5));
assert.ok(Off.classRankings(o3.offseason!.events).length > 130);
const user = o3.userTeams[0];
const sug = o3.offseason!.suggestedCuts![user];
assert.deepEqual(Off.cutProblems(o3, user, sug), []);
// Smarter cuts: next season's Active Roster stays; backups by expected OVR the next two seasons (seniors first).
const fr = { ...act(o3)[0], cls: 'FR' as const, ovr: 75, pot: 82 }, sr = { ...act(o3)[0], cls: 'SR' as const, ovr: 76, pot: 76 };
assert.ok(Off.keepValue(fr) > Off.keepValue(sr), 'a 75 FR outranks a 76 SR backup');
let checkedCuts = 0;
// Random classes may stay under the limit, so put extra backups on the user team to make sure some team cuts.
const mine3 = act(o3).filter((p) => p.team === user);
const extra = Array.from({ length: Math.max(3, Off.ROSTER_LIMIT - mine3.length + 3) }, (_, k) => ({ ...mine3[mine3.length - 1 - (k % mine3.length)], id: o3.players.length + 1 + k }));
const o3x = { ...o3, players: [...o3.players, ...extra] };
for (const t of o3x.teams) {
  const roster = act(o3x).filter((p) => p.team === t.index);
  if (roster.length <= Off.ROSTER_LIMIT) continue;
  const cuts = Off.suggestCuts(o3x, t.index);
  const { active: starters } = Off.cutOrder(roster);
  assert.equal(cuts.length, roster.length - Off.ROSTER_LIMIT, `${t.school} cuts to the limit`);
  assert.ok(cuts.every((id) => !starters.has(id)), `${t.school} keeps its Active Roster`);
  assert.deepEqual(Off.cutProblems(o3x, t.index, cuts), []);
  checkedCuts++;
}
assert.ok(checkedCuts > 0, 'some teams had to cut');
const qbs = act(o3).filter((p) => p.team === user && p.pos === 'QB').map((p) => p.id);
assert.ok(Off.cutProblems(o3, user, qbs).some((m) => /QB/.test(m)), 'cuts below the minimums are refused');
ok(`smarter cuts: ${checkedCuts} teams over ${Off.ROSTER_LIMIT} keep their Active Rosters, cut backups by future value, stay above the minimums`);
const o4 = Off.applyCuts(o3, {}, tpl);
for (const t of o4.teams) {
  const roster = act(o4).filter((p) => p.team === t.index);
  assert.ok(roster.length >= Off.ROSTER_MIN && roster.length <= Off.ROSTER_LIMIT, `${t.school} has ${roster.length}`);
  for (const pos of Off.POSITIONS) assert.ok(roster.filter((p) => p.pos === pos).length >= Off.POS_MIN[pos], `${t.school} ${pos}`);
  for (const g of Off.GROUP_MIN) assert.ok(roster.filter((p) => g.positions.includes(p.pos)).length >= g.min, `${t.school} ${g.name}`);
}
const o5 = Off.finishOffseason(o4);
coachChecks(d1, ok, { seasonRom: (x) => Off.seasonRom(x, x.seasons[0], rom, 1_800_000_000_000), offseason: { at: o4, finish: Off.finishOffseason } });
// Career records: a record per season on a team, ratings as set up for the season.
const y26 = d1.seasons[0].year, y27 = o5.seasons[1].year;
assert.ok(d1.players.filter((p) => p.status === 'active' && p.team !== null).every((p) => p.years?.length === 1 && p.years[0].year === y26 && p.years[0].ovr === p.ovr), 'every starting player has his first season');
const stayed = act(o5).filter((p) => p.years?.some((y) => y.year === y26));
assert.ok(stayed.length > 1000 && stayed.every((p) => p.years!.at(-1)!.year === y27 && p.years!.at(-1)!.ovr === p.ovr && p.years!.at(-1)!.team === p.team), 'returning players get the new season');
const gone = o5.players.filter((p) => p.status !== 'active');
assert.ok(gone.every((p) => !p.years?.some((y) => y.year === y27)), 'players who left keep their old seasons only');
const ex = stayed[0];
assert.deepEqual(Object.keys(recordRatings(ex.years![0])).length, 10);
ok(`career records: ${stayed.length} players with ${y26} and ${y27}; file grows ${((dynastyFileText(o5).length - dynastyFileText({ ...o5, players: o5.players.map((p) => ({ ...p, years: undefined })) }).length) / 1e6).toFixed(1)} MB`);
// Experience at the current school: letters (one per completed season there), TR, HS.
const so = d1.players.find((p) => p.status === 'active' && p.team !== null && p.cls === 'SO')!;
assert.equal(experienceOf(so, y26 - 1, d1.startYear).label, '1L', 'a starting SO has lettered once');
const so27 = o5.players[so.id - 1];
if (so27.status === 'active' && so27.team === so.team) assert.equal(experienceOf(so27, y26, o5.startYear).label, '2L', 'and twice after 2026');
const hs = act(o5).find((p) => p.recruit && p.recruit.year === y27)!;
assert.equal(experienceOf(hs, y26, o5.startYear).label, 'HS');
const tr = act(o5).find((p) => p.transfers?.some((x) => x.to === p.team));
if (tr) { const x = experienceOf(tr, y26, o5.startYear); assert.ok(x.label === 'TR' && x.from !== null, 'a transfer shows TR and his old school'); }
ok(`experience: 1L/2L for starting players, HS for recruits${tr ? ', TR for transfers' : ''}`);
const walkons = o5.players.filter((p) => p.recruit?.stars === 0);
const diamonds = walkons.filter((p) => (p.pot ?? 0) >= Off.DIAMOND_POT[0]);
assert.ok(diamonds.length > 0 && diamonds.length < walkons.length * 0.08, `a few walk-ons are diamonds in the rough (${diamonds.length} of ${walkons.length})`);
assert.ok(o5.players.filter((p) => p.recruit && p.recruit.stars > 0).every((p) => p.recruit!.year === o5.seasons[1].year), 'recruits keep their stars and class year');
ok(`walk-ons: ${diamonds.length} of ${walkons.length} are diamonds in the rough; recruits keep their stars`);
// Jersey numbers (numbers.ts): returning players keep theirs, new players pick best first from where their
// position wears its numbers, nobody new shares one, and only computer teams' veterans may move to a single digit.
{
  const before = new Map(o4.players.map((p) => [p.id, p]));
  const { players: numbered, changes } = Num.assignNumbers(o4.players, o4.offseason!.year, o4.userTeams, () => 0.5);
  assert.deepEqual(Num.assignNumbers(o4.players, o4.offseason!.year, o4.userTeams, () => 0.5).changes, changes, 'same input, same numbers');
  const fresh = changes.filter((c) => c.why === 'new' || c.why === 'taken');
  const kept = numbered.filter((p) => p.status === 'active' && p.team !== null && !changes.some((c) => c.player === p.id));
  assert.ok(kept.every((p) => p.jersey === before.get(p.id)!.jersey), 'a player without a change keeps his number');
  for (const c of fresh) {
    const p = numbered[c.player - 1];
    assert.equal(numbered.filter((q) => q.status === 'active' && q.team === p.team && q.jersey === p.jersey).length, 1, 'a new number is nobody else\'s on the team');
    if (['LT', 'LG', 'C', 'RG', 'RT'].includes(p.pos)) assert.ok(p.jersey >= 50 && p.jersey <= 79, 'a lineman wears 50-79');
    if (p.pos === 'QB') assert.ok(p.jersey <= 19, 'a quarterback wears 0-19');
  }
  const shared = changes.filter((c) => c.why === 'shared'), ups = changes.filter((c) => c.why === 'upgrade');
  assert.ok(ups.every((c) => !o4.userTeams.includes(c.team) && c.to < 10 && c.from >= 10), 'only computer teams move a veteran to a single digit');
  assert.ok(new Set(ups.map((c) => c.team)).size === ups.length, 'one such move per team at most');
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const real = Num.assignNumbers(o4.players, o4.offseason!.year, o4.userTeams, rnd).changes;
  const realUps = real.filter((c) => c.why === 'upgrade');
  // At most one a team, each with UPGRADE_CHANCE: at most the mean of 138 tries plus three standard deviations (a
  // count just over the mean comes up with some saves: 23 with the v2.1.1-test4 emulator save).
  const mean = 138 * Num.UPGRADE_CHANCE, sd = Math.sqrt(mean * (1 - Num.UPGRADE_CHANCE));
  assert.ok(realUps.length <= mean + 3 * sd, `single-digit moves are rare (${realUps.length} on 138 teams)`);
  // The best new players get the single digits: among new skill players, the top quarter by OVR against the bottom.
  const newSkill = real.filter((c) => c.why === 'new').map((c) => ({ c, p: before.get(c.player)! })).filter(({ p }) => ['QB', 'HB', 'WR', 'CB', 'FS', 'SS'].includes(p.pos)).sort((a, b) => b.p.ovr - a.p.ovr);
  const q = Math.floor(newSkill.length / 4), share = (xs: typeof newSkill) => xs.filter((x) => x.c.to < 10).length / xs.length;
  assert.ok(share(newSkill.slice(0, q)) > share(newSkill.slice(-q)) + 0.1, `better new players wear single digits more often (${share(newSkill.slice(0, q)).toFixed(2)} vs ${share(newSkill.slice(-q)).toFixed(2)})`);
  assert.ok(real.some((c) => c.to === 0), 'number 0 is given out');
  // A transfer keeps his number when it's free at the new school.
  const moved = numbered.filter((p) => p.status === 'active' && p.transfers?.at(-1)?.year === o4.offseason!.year && p.transfers.at(-1)!.to === p.team);
  const keptMove = moved.filter((p) => p.jersey === before.get(p.id)!.jersey).length;
  assert.ok(moved.length > 0 && keptMove > 0 && keptMove < moved.length, `transfers keep a free number (${keptMove} of ${moved.length})`);
  ok(`jersey numbers: ${fresh.length} new, ${keptMove} of ${moved.length} transfers kept theirs, ${shared.length} shared on one side changed, ${realUps.length} veterans moved to a single digit; single digits among new skill players: top quarter ${Math.round(100 * share(newSkill.slice(0, q)))}%, bottom quarter ${Math.round(100 * share(newSkill.slice(-q)))}%`);
}
const next = o5.seasons[1];
assert.deepEqual(next.prestige, o1.offseason!.prestige, 'the new season has the new stars');
assert.equal(o5.offseason, undefined);
assert.equal(next.year, 2027);
assert.equal(next.slots.flat().filter((x) => x !== null).length, 138 * 32, 'every slot filled');
for (const t of o5.teams) {
  const mates = act(o5).filter((p) => p.team === t.index);
  assert.ok(mates.every((p) => Number.isInteger(p.jersey) && p.jersey >= 0 && p.jersey <= 99), `${t.school}: everybody has a number 0-99`);
  const perSide = mates.map((p) => `${Num.sideOf(p.pos)}${p.jersey}`);
  assert.equal(new Set(perSide).size, perSide.length, `${t.school}: a number is worn once on offense and once on defense at most`);
  next.slots[t.index].forEach((id) => assert.equal(o5.players[id! - 1].team, t.index));
}
ok(`offseason: ${o1.offseason!.events.filter((e) => e.kind !== 'returns').length} departures, ${moves.length} transfers, ${signed.length} signed, ${o4.offseason!.events.filter((e) => e.kind === 'cut').length} cut, ${o4.offseason!.events.filter((e) => e.kind === 'walkon').length} walk-ons; ${act(o5).length} players in ${next.year}`);

// Full recruiting: five weeks, then signing day; every team stays within its spots.
const f1 = Rec.openRecruiting(o1p, tpl);
const rs0 = f1.offseason!.recruiting!;

// Conference prestige (2026-11-21): the average stars of a conference's schools against the best conference;
// independents pitch their own; every new prospect cares about it a little or a lot; old prospects without it count 0.
{
  const cp = conferencePrestige(f1);
  assert.equal(cp[0].value, 1, 'the best conference is 100%');
  assert.ok(cp.every((c, i) => i === 0 || c.mean <= cp[i - 1].mean), 'best first');
  assert.ok(!cp.some((c) => /independent/i.test(c.name)), 'independents are no conference here');
  const s1 = f1.seasons[f1.seasons.length - 1];
  const pitch = conferencePitch(f1);
  const T = (n: string) => f1.teams.find((t) => t.school === n)!.index;
  const sec = cp.find((c) => c.conf === s1.conf[T('Alabama')])!;
  assert.equal(pitch.get(T('Alabama')), sec.value);
  const nd = T('Notre Dame');
  assert.equal(pitch.get(nd), Math.min(1, Off.prestigeStars(f1, nd) / cp[0].mean), 'an independent pitches its own stars');
  assert.ok(rs0.prospects.every((p) => p.wants.conference !== undefined && p.wants.conference >= 0), 'every prospect has the new interest');
  const ctx = Rec.weekContext(f1, rs0);
  const pr = rs0.prospects[0];
  const old = { ...pr, wants: { ...pr.wants, conference: undefined } };
  assert.ok(Number.isFinite(Rec.fit(f1, ctx, old, T('Alabama'))), 'an older prospect without it still fits');
  ok(`conference prestige: ${cp.map((c) => `${c.name} ${c.mean.toFixed(2)}`).slice(0, 3).join(', ')} …; independents pitch their own; every prospect has the interest`);
}
assert.equal(f1.offseason!.step, 'recruiting');
assert.ok(rs0.prospects.some((p) => p.id < 0) && rs0.prospects.filter((p) => p.id > 0).length === o1p.offseason!.portal!.length, 'high-school prospects and the portal players');
// Five top schools from the start; a portal player's old school is his third; pitches by stars.
assert.ok(rs0.prospects.every((p) => Rec.interestRanking(p).length === 5), 'five top schools each');
const portalPr = rs0.prospects.filter((p) => p.from !== null);
assert.ok(portalPr.every((p) => Rec.interestRanking(p)[2].team === p.from), 'old school third');
const hsW = (k: number, w: 'home' | 'prestige') => { const xs = rs0.prospects.filter((p) => p.id < 0 && p.stars === k); return xs.reduce((a, p) => a + p.wants[w], 0) / xs.length; };
assert.ok(hsW(2, 'home') > hsW(5, 'home') && hsW(5, 'prestige') > hsW(2, 'prestige'), 'low stars: home; high stars: prestige');
if (user !== undefined) assert.ok(portalPr.filter((p) => p.from === user).every((p) => p.id in (rs0.plans[user]?.points ?? {})), 'own portal players start on the board');
const targets = rs0.prospects.filter((p) => p.id < 0 && p.stars <= 3).slice(0, 10);
const plan = { points: Object.fromEntries(targets.map((p) => [p.id, 60])), offers: targets.map((p) => p.id) };
assert.deepEqual(Rec.planProblems(RD, plan), []);
assert.ok(Rec.planProblems(RD, { points: { [targets[0].id]: 61 }, offers: [] }).length > 0, 'at most 60 a prospect');
assert.ok(Rec.planProblems(RD, { points: Object.fromEntries(rs0.prospects.slice(0, 20).map((p) => [p.id, 60])), offers: [] }).length > 0, 'at most 1,000 a week');
// Scouting (user teams): OVR 10, all ratings 20 more, out of the week's points; kept; portal players fully known.
const sp = targets[0];
assert.equal(Rec.scoutLevel(rs0, user, sp), 0);
assert.equal(Rec.scoutCost(RD, rs0, user, sp, 2), 30);
let fs = Rec.scoutProspect(f1, user, sp.id, 1, 600);
assert.equal(Rec.scoutLevel(fs.offseason!.recruiting!, user, sp), 1);
assert.equal(Rec.scoutCost(RD, fs.offseason!.recruiting!, user, sp, 2), 20);
for (const t of targets) fs = Rec.scoutProspect(fs, user, t.id, 2, 600);
assert.equal(fs.offseason!.recruiting!.scoutSpent[user], 300);
assert.throws(() => Rec.scoutProspect(fs, user, targets[0].id - 1000000, 1, 600), /No such/);
const other = rs0.prospects.find((p) => p.id < 0 && !targets.includes(p))!;
assert.throws(() => Rec.scoutProspect(fs, user, other.id, 2, 700), /left this week/);
assert.deepEqual(Rec.planProblems(RD, plan, 300), []);
assert.ok(Rec.planProblems(RD, plan, 410).length > 0, 'scouting counts toward the 1,000');
assert.equal(Rec.scoutLevel(rs0, user, { ...sp, id: 5 }), 2, 'portal players show everything');
const fsw = Rec.recruitingWeek(fs, { [user]: plan });
assert.equal(fsw.offseason!.recruiting!.scoutSpent[user] ?? 0, 0, 'scouting points are per week');
assert.equal(Rec.scoutLevel(fsw.offseason!.recruiting!, user, sp), 2, 'scouting is kept');
ok('scouting: OVR 10 and all ratings 20 points, within the week\'s 1,000, kept across weeks');

let f2 = f1;
for (let w = 0; w < RD.weeks; w++) f2 = Rec.recruitingWeek(f2, { [user]: w === 0 ? plan : { points: plan.points, offers: [] } });
assert.throws(() => Rec.recruitingWeek(f2, {}), /signing day/);
const rsEnd = f2.offseason!.recruiting!;
for (const t of f2.teams) assert.ok(rsEnd.prospects.filter((p) => p.committed === t.index).length <= rsEnd.spots[t.index]);
const f3 = Rec.finishRecruiting(f2, tpl);
// Signing day records, for each user team, the prospects it offered who went elsewhere (the signing page lists them).
for (const u of f2.userTeams) {
  const missed = f3.offseason!.missed![u];
  const offered = f2.offseason!.recruiting!.prospects.filter((p) => p.offers.includes(u) && p.from !== u).length;
  assert.ok(missed.length <= Math.min(10, offered) && missed.every((m) => m.to !== u && m.place >= 0), 'the ones that got away: offered, not signed by the team, ten at most');
}
assert.equal(f3.offseason!.cutsPicked, undefined, 'the cuts are not picked yet after signing day');
const fSigned = f3.offseason!.events.filter((e) => e.kind === 'signed');
for (const t of f3.teams) assert.ok(fSigned.filter((e) => e.kind === 'signed' && e.team === t.index).length <= rsEnd.spots[t.index]);
assert.ok(f3.players.filter((p) => rsEnd.prospects.some((q) => q.id === p.id)).every((p) => p.status === 'transferred' ? p.team === null : p.team !== null), 'portal players moved or left');
const f5 = Off.finishOffseason(Off.applyCuts(f3, {}, tpl));
assert.equal(f5.seasons[1].slots.flat().filter((x) => x !== null).length, 138 * 32);
ok(`full recruiting: ${rs0.prospects.length} prospects, ${rsEnd.prospects.filter((p) => p.committed !== null).length} committed in ${RD.weeks} weeks, ${fSigned.length} signed; ${user === undefined ? '' : `${f3.teams[user].school} landed ${targets.filter((t) => rsEnd.prospects.find((p) => p.id === t.id)!.committed === user).length} of its 10 targets`}`);

const closenessState = (p: { player: { state: string } }) => (stateCode(p.player.state) === SCHOOL_STATE[f1.teams[user].school] ? 'same' : 'other');
// Offseason rules: changed numbers take effect; only changes are stored; rules files round-trip and are checked.
assert.equal(Object.keys(CFB27_ACADEMICS).length, 138 + 6, 'the 138 schools, the 1994 names of five of them and Pacific');
assert.ok(d1.teams.every((t) => CFB27_ACADEMICS[t.school]), 'every school has an academic grade');
assert.ok(academicsOf('Stanford') > academicsOf('Alabama'));
const ruled = setRules(f1, { ...RD, scoutOvr: 25, userPoints: 500, transferBackup: 0.5 });
assert.deepEqual(ruled.rules, { scoutOvr: 25, userPoints: 500, transferBackup: 0.5 }, 'only the changes are stored');
assert.equal(Rec.scoutCost(rulesOf(ruled), rs0, user, sp, 1), 25);
assert.ok(Rec.planProblems(rulesOf(ruled), plan).length > 0, 'fewer points: the 600-point plan is too much');
assert.throws(() => setRules(f1, { ...RD, srPlusReturn: 2 }), /between/);
const back = readRulesFile(rulesFileText(ruled));
assert.deepEqual(back, ruled.rules);
assert.throws(() => readRulesFile('{"app":"genesis-cfb-toolkit","tool":"dynasty"}'), /isn't an offseason rules file/);
assert.deepEqual(setRules(ruled, RD).rules, undefined, 'back to the defaults');
const moreTransfers = Off.confirmDepth(setRules(o1, { ...RD, transferBackup: 0.6, transferDepth: 0.6 }));
assert.ok(moreTransfers.offseason!.portal!.length > entering.length * 2, 'a higher transfer chance sends more players to the portal');
// Pitches: five, academics and contender included; contender 0-1, last season's best teams near the top; pipelines.
assert.ok(rs0.prospects.every((p) => Math.abs(p.wants.pt + p.wants.prestige + p.wants.home + p.wants.academics + p.wants.contender + (p.wants.conference ?? 0) - 1) < 1e-9));
const ctxW = Rec.weekContext(f1, rs0);
const v26 = seasonView(f1, f1.seasons[0]);
const no1 = d1.teams.findIndex((t) => v26.rank[t.index] === 1);
assert.ok([...ctxW.contender.values()].every((x) => x >= 0 && x <= 1) && ctxW.contender.get(no1)! > 0.6, 'No. 1 is a contender');
if (user !== undefined) {
  const pipes = Rec.pipelineStates(f1, user);
  assert.ok(pipes.every((x) => x.n >= RD.pipelineMin));
  const inState = rs0.prospects.find((p) => p.id < 0 && closenessState(p) === 'same')!;
  assert.equal(Rec.pointCost(f1, ctxW, inState, user), RD.inStateCost, 'in-state prospects cost less');
  assert.equal(Rec.costOf(f1, ctxW, inState, user, 60), 48, '60 points on an in-state prospect cost 48');
  const far = rs0.prospects.find((p) => p.id < 0 && Rec.pointCost(f1, ctxW, p, user) === 1)!;
  const mixed = { points: { [inState.id]: 60, [far.id]: 60 }, offers: [] };
  assert.equal(Rec.planCost(f1, ctxW, rs0, user, mixed), 108, 'a plan costs its points after the discounts');
  assert.deepEqual(Rec.planProblems({ ...RD, userPoints: 108 }, mixed, 0, 108), []);
  assert.ok(Rec.planProblems({ ...RD, userPoints: 108 }, mixed).length > 0, 'without the discount the same plan is too much');
  // Dynasties saved with the old "points count ×" settings keep their strength as a cost.
  assert.equal(rulesOf({ rules: { inStateBoost: 1.25, pipelineBoost: 1.25 } as never }).inStateCost, 0.8);
  assert.equal(rulesOf({ rules: { inStateBoost: 1.25, pipelineBoost: 1.25 } as never }).pipelineCost, 0.8);
}
ok(`rules: changes stored and applied, files round-trip; academics for all 138; contender and pipelines${user !== undefined ? ` (${f1.teams[user].school}: ${Rec.pipelineStates(f1, user).map((x) => x.state).join(', ') || 'none'})` : ''}`);

// Pitching (user teams pick a pitch per prospect; reactions +, ~, −, ✗): a good pitch adds more interest than none, a bad one less.
if (user !== undefined) {
  const ctxP = Rec.weekContext(f1, rs0);
  const tgt = rs0.prospects.find((p) => p.id < 0 && p.committed === null && p.stars <= 3)!;
  const sc = Rec.pitchScores(f1, ctxP, tgt, user);
  const ints = Rec.interestsOf(RD, tgt);
  const notInt = Rec.PITCHES.find((k) => !ints.includes(k))!;
  assert.equal(Rec.pitchReaction(RD, tgt, sc, notInt), 'no');
  for (const k of ints) assert.equal(Rec.pitchReaction(RD, tgt, sc, k), sc[k] >= RD.pitchStrongAt ? 'good' : sc[k] < RD.pitchWeakBelow ? 'bad' : 'ok');
  const gain = (pitch?: Rec.PitchKey) => {
    const w = Rec.recruitingWeek(f1, { [user]: { points: { [tgt.id]: 50 }, offers: [], pitches: pitch ? { [tgt.id]: pitch } : {} } });
    return { v: w.offseason!.recruiting!.prospects.find((p) => p.id === tgt.id)!.interest[user] - (tgt.interest[user] ?? 0), r: w.offseason!.recruiting!.reactions?.[user]?.[tgt.id] };
  };
  const none = gain(), withNo = gain(notInt);
  assert.ok(Math.abs(withNo.v - none.v * RD.pitchNotInterested) < 1e-6 * Math.max(1, none.v), 'not interested: a wrong guess costs a little');
  assert.equal(withNo.r?.[notInt], 'no', 'the reaction is recorded');
  for (const k of ints) {
    const g = gain(k), x = Rec.pitchReaction(RD, tgt, sc, k);
    assert.ok(Math.abs(g.v - none.v * Rec.reactionValue(RD, x, Rec.interestRank(RD, tgt, k))) < 1e-6 * Math.max(1, none.v), `pitch ${k} (${x}) scales the points`);
  }
  // Withdrawing an offer (user, 2026-11-13): gone at once, his interest stays, and he can't pick the team.
  {
    const w = Rec.recruitingWeek(f1, { [user]: { points: { [tgt.id]: 50 }, offers: [tgt.id] } });
    const got = w.offseason!.recruiting!.prospects.find((p) => p.id === tgt.id)!;
    assert.ok(got.offers.includes(user));
    if (got.committed !== user) {
      const back = Rec.withdrawOffer(w, user, tgt.id).offseason!.recruiting!.prospects.find((p) => p.id === tgt.id)!;
      assert.ok(!back.offers.includes(user) && back.interest[user] === got.interest[user], 'the offer is gone, the interest stays');
      assert.equal(Rec.withdrawOffer(Rec.withdrawOffer(w, user, tgt.id), user, tgt.id).offseason!.recruiting!.prospects.find((p) => p.id === tgt.id)!.offers.includes(user), false);
    } else assert.throws(() => Rec.withdrawOffer(w, user, tgt.id), /committed to you/);
    const cpu = f1.teams.find((t) => !f1.userTeams.includes(t.index))!.index;
    assert.throws(() => Rec.withdrawOffer(w, cpu, tgt.id), /Only your teams/);
  }
  // The offer cap (user, 2026-11-13): open spots plus offerExtra; committed prospects don't count; computer teams too.
  {
    const rsC = f1.offseason!.recruiting!;
    const cap = Rec.offerCap(RD, rsC, user);
    assert.equal(cap, rsC.spots[user] - rsC.prospects.filter((p) => p.committed === user).length + RD.offerExtra);
    const open = rsC.prospects.filter((p) => p.committed === null && !p.offers.includes(user));
    const room = Math.max(0, cap - Rec.offersOut(rsC, user));
    const tooMany = { points: {}, offers: open.slice(0, room + 1).map((p) => p.id) };
    assert.equal(Rec.newOffers(rsC, user, tooMany).length, room + 1);
    assert.throws(() => Rec.recruitingWeek(f1, { [user]: tooMany }), /offers out/, 'one offer over the cap is refused');
    const w = Rec.recruitingWeek(f1, { [user]: { points: {}, offers: open.slice(0, room).map((p) => p.id) } });
    const rsW = w.offseason!.recruiting!;
    for (const t of w.teams) assert.ok(Rec.offersOut(rsW, t.index) <= Math.max(Rec.offersOut(rsC, t.index), RD.offerExtra + rsC.spots[t.index]), `${t.school} stays within its cap`);
    const cpuT = w.teams.find((t) => !w.userTeams.includes(t.index) && rsC.spots[t.index] > 0)!.index;
    assert.ok(Rec.offersOut(rsW, cpuT) <= rsC.spots[cpuT] + RD.offerExtra, 'a computer team is within the cap');
  }
  // Computer teams learn: keep a +, try untried pitches, never repeat − or ✗.
  const rnd = () => 0.5;
  assert.equal(Rec.learnedPitch({ home: 'good', pt: 'no' }, rnd), 'home');
  assert.ok(!['pt', 'prestige', undefined].includes(Rec.learnedPitch({ pt: 'no', prestige: 'bad' }, rnd)));
  // Ranked interests (user, 2026-11-13): the main one swings more than a minor one, a miss costs a little.
  assert.deepEqual([Rec.interestRank(RD, tgt, ints[0]), Rec.interestRank(RD, tgt, ints[1]), Rec.interestRank(RD, tgt, notInt)], [1, 2, 0]);
  assert.ok(Rec.reactionValue(RD, 'good', 1) > Rec.reactionValue(RD, 'good', 2) && Rec.reactionValue(RD, 'bad', 1) < Rec.reactionValue(RD, 'bad', 2));
  assert.ok(Rec.reactionValue(RD, 'no') < 1 && Rec.reactionValue(RD, 'no', 2) === Rec.reactionValue(RD, 'no'));
  const minor = (v: number) => [() => v, () => false] as const;
  assert.equal(Rec.learnedPitch({ home: 'good' }, rnd, ...minor(1.2)), 'home', 'a minor + is kept');
  assert.notEqual(Rec.learnedPitch({ home: 'ok' }, rnd, ...minor(1.05)), 'home', 'a minor ~: keep looking for his main interest');
  assert.equal(Rec.learnedPitch({ home: 'bad', pt: 'bad' }, rnd, () => 0.9, (k) => k === 'pt'), undefined, 'both interests found, both weak: no pitch');
  assert.equal(Rec.learnedPitch({ pt: 'no', prestige: 'bad', home: 'ok', academics: 'no', contender: 'no' }, rnd), 'home');
  ok(`pitching: ${tgt.player.first} ${tgt.player.last}'s interests ${ints.join(', ')}; reactions ${ints.map((k) => Rec.pitchReaction(RD, tgt, sc, k)).join(', ')}, the rest ✗`);
}

// Development paces: Awareness grows fastest, Speed slowest; the OVR still moves by the gain.
{
  const hb = d0.players.find((p) => p.pos === 'HB' && (p.ratings.Speed ?? 100) < 85 && (p.ratings.Awareness ?? 100) < 85)!;
  const half = () => 0.5;
  const G = 1.5; // a small year, under the caps
  const g = Off.develop(hb, G, half);
  // On the v8 scale ratings move in shown points (toScale), on the old scale in stored numbers (the same thing there).
  const sd = (x: { ratings: object }, y: { ratings: object }, a: string) =>
    toScale((x.ratings as Record<string, number>)[a] ?? 0, a as 'Speed', 'HB') - toScale((y.ratings as Record<string, number>)[a] ?? 0, a as 'Speed', 'HB');
  const up = (a: 'Speed' | 'Awareness' | 'Quickness' | 'Power') => toScale(g.ratings[a] ?? 0, a, 'HB') - toScale(hb.ratings[a] ?? 0, a, 'HB');
  assert.ok(up('Awareness') > up('Power') && up('Power') > up('Quickness') && up('Quickness') > up('Speed') && up('Speed') > 0, 'Awareness > Power > Quickness > Speed');
  assert.ok(Math.abs(up('Awareness') / up('Speed') - RD.paceAwareness / RD.speedPace) < (hasV8(rom) ? 0.4 : 0.2), `by the paces (v8: the game's whole fine points round small moves): ${['Awareness', 'Power', 'Quickness', 'Speed'].map((a) => up(a as 'Speed').toFixed(3)).join(' ')}`);
  const f = (hasV8(rom) ? OVR_FORMULAS_V8 : OVR_FORMULAS).HB, raw = Object.entries(f.weights).reduce((t, [a, w]) => t + (w / 100) * f.scale * up(a as 'Speed'), 0);
  assert.ok(Math.abs(raw - G) < 0.1, `the ratings move by the gain before steps (${raw.toFixed(2)})`);
  const top = hasV8(rom) ? fromScale(99, 'Awareness', 'HB') : 99.5; // v8: the top of the scale is a shown 99
  const capped = { ...hb, ratings: { ...hb.ratings, Awareness: top } }, gc = Off.develop(capped, G, half);
  const rawC = Object.entries(f.weights).reduce((t, [a, w]) => t + (w / 100) * f.scale * sd(gc, capped, a), 0);
  assert.equal(gc.ratings.Awareness, hasV8(rom) ? top : 100);
  assert.ok(Math.abs(rawC - G) < 0.1, `a rating at 100 passes its share to the others (${rawC.toFixed(2)})`);
  // Training focus: 25 = normal, the cap +20%, 0 −20%; the OVR gain stays the same.
  assert.equal(trainingFactor(RD, 25), 1);
  assert.ok(Math.abs(trainingFactor(RD, RD.trainingMax) - (1 + RD.trainingEffect)) < 1e-9 && Math.abs(trainingFactor(RD, 0) - (1 - RD.trainingEffect)) < 1e-9);
  assert.deepEqual(trainingProblems(RD, EVEN_TRAINING), []);
  assert.equal(trainingProblems(RD, { strength: 45, speed: 25, technique: 15, knowledge: 15 }).length, 1, 'over the cap');
  assert.equal(trainingProblems(RD, { strength: 40, speed: 40, technique: 20, knowledge: 0 }).length, 0);
  assert.equal(trainingProblems(RD, { strength: 40, speed: 40, technique: 10, knowledge: 5 }).length, 1, 'not 100');
  const fast = Off.develop(hb, G, half, RD, { strength: 20, speed: 40, technique: 20, knowledge: 20 });
  const upF = (a: 'Speed' | 'Awareness') => sd(fast, hb, a);
  assert.ok(upF('Speed') > up('Speed') && (hasV8(rom) ? upF('Awareness') <= up('Awareness') : upF('Awareness') < up('Awareness')), `speed focus: more Speed, less Awareness (${upF('Speed').toFixed(3)} vs ${up('Speed').toFixed(3)}, ${upF('Awareness').toFixed(3)} vs ${up('Awareness').toFixed(3)})`);
  const rawF = Object.entries(f.weights).reduce((t, [a, w]) => t + (w / 100) * f.scale * sd(fast, hb, a), 0);
  assert.ok(Math.abs(rawF - G) < 0.1, 'same OVR gain');
  // v8 OVRs move about 1.7 a shown point, so a year that fills the caps is a bigger OVR gain.
  const BIG = hasV8(rom) ? 30 : 10;
  const tol = hasV8(rom) ? 0.3 : 0.05; // v8: whole fine points are about 0.13 shown points
  // Yearly caps: a big year stops at each rating's cap; what none can take is lost.
  const big = Off.develop(hb, BIG, half), upB = (a: string) => sd(big, hb, a);
  assert.ok(upB('Awareness') <= RD.capAwareness + tol && upB('Speed') <= RD.capSpeed + tol && upB('Quickness') <= RD.capQuickRange + tol && upB('Power') <= RD.capOther + tol && upB('Hands') <= RD.capOther + tol, 'capped');
  assert.ok(Math.abs(upB('Speed') - RD.capSpeed) < tol && Math.abs(upB('Awareness') - RD.capAwareness) < tol, `a big year fills the caps (SPD ${upB('Speed').toFixed(2)}, AWR ${upB('Awareness').toFixed(2)})`);
  const fastBig = Off.develop(hb, BIG, half, RD, { strength: 20, speed: 40, technique: 20, knowledge: 20 });
  assert.ok(Math.abs(sd(fastBig, hb, 'Speed') - RD.capSpeed * (1 + RD.trainingEffect)) < tol, 'training focus moves the cap');
  ok(`yearly caps: a +${BIG} OVR year for an HB stops at AWR +${upB('Awareness').toFixed(1)}, POW +${upB('Power').toFixed(1)}, QUI +${upB('Quickness').toFixed(1)}, SPD +${upB('Speed').toFixed(1)} (OVR ${hb.ovr} → ${big.ovr})`);
  const cpu = d0.teams.findIndex((_, t) => !d0.userTeams.includes(t));
  const dt = { ...d0, training: { [cpu]: { strength: 40, speed: 40, technique: 20, knowledge: 0 } } };
  assert.deepEqual(trainingOf(dt, RD, cpu), EVEN_TRAINING, 'computer teams train evenly');
  if (d0.userTeams.length) {
    const u0 = d0.userTeams[0], mine = { strength: 40, speed: 40, technique: 20, knowledge: 0 };
    assert.deepEqual(trainingOf({ ...d0, training: { [u0]: mine } }, RD, u0), mine);
  }
  ok(`training focus: on a +${G} year Speed development 40 gives SPD +${upF('Speed').toFixed(1)} (even +${up('Speed').toFixed(1)}), AWR +${upF('Awareness').toFixed(1)} (even +${up('Awareness').toFixed(1)}), same OVR gain`);
  ok(`development paces: an HB's +${G} OVR year gives AWR +${up('Awareness').toFixed(1)}, POW +${up('Power').toFixed(1)}, QUI +${up('Quickness').toFixed(1)}, SPD +${up('Speed').toFixed(1)}`);
}

// Appearance: editable any time (not in the ROM); back to the generated look.
{
  const p0 = d1.players.find((p) => p.status === 'active')!;
  const gen = lookChoices(p0);
  const e1 = editLook(d1, p0.id, { skin: 3, look: { hair: 'afro', beard: 'beard', eyeBlack: true } });
  const q = e1.players[p0.id - 1];
  assert.equal(q.skin, 3);
  assert.deepEqual([lookOf(q).hair, lookOf(q).beard, lookOf(q).acc?.eyeBlack], ['afro', 'beard', true]);
  assert.equal(lookOf(q).mouth, gen.mouth, 'the rest stays generated');
  {
    // Locs come long or short; adding the short style moved no other generated look.
    // Players made before the new styles (no lookV) keep the earlier draws.
    const styles = new Map<string, number>();
    for (const pl of d0.players.map((x) => ({ ...x, lookV: undefined }))) styles.set(lookOf(pl).hair, (styles.get(lookOf(pl).hair) ?? 0) + 1);
    const long = styles.get('locs') ?? 0, short = styles.get('locsShort') ?? 0;
    assert.ok(long > 0 && short > 0 && Math.abs(long - short) < (long + short) * 0.15, `locs ${long} long, ${short} short`);
    assert.equal(styles.size, 11);
    for (const st of ['short', 'afro', 'flow']) assert.ok(Math.abs((styles.get(st) ?? 0) - (long + short)) < (long + short) * 0.15, st);
    // New players (lookV 2) draw from every style; eye black on about 5%; never a wide jaw on a thin neck, never a
    // thin neck on a lineman.
    const v2 = new Set(d0.players.map((x) => lookOf(x).hair));
    assert.ok(v2.size >= 16 && v2.has('sidepart') && v2.has('cornrows'), `new players' styles: ${v2.size}`);
    const eb = d0.players.filter((x) => lookOf(x).acc?.eyeBlack).length / d0.players.length;
    assert.ok(eb > 0.03 && eb < 0.07, `eye black ${(eb * 100).toFixed(1)}%`);
    for (const x of d0.players) {
      const l = lookOf(x);
      assert.ok(!(l.jaw === 'wide' && l.neck === 'thin'), 'wide jaw on a thin neck');
      if (l.build === 'wide') assert.notEqual(l.neck, 'thin', 'a lineman with a thin neck');
    }
  }
  assert.deepEqual(e1.seasons, d1.seasons, 'nothing about the season changes');
  const back = editLook(e1, p0.id, { look: null }).players[p0.id - 1];
  assert.deepEqual(lookChoices(back), lookChoices({ ...p0, skin: 3 }), 'back to the generated look');
  assert.throws(() => editLook(d1, p0.id, { skin: 7 }), /skin tone/);
  ok('appearance: skin, hair, facial hair and eye black saved; the rest stays generated; reset works; new players get every style, eye black on about 5%, jaw and neck by position');
}

// Recruiting commitment stories: the latest week's 4-5★ commitments and the user teams' moves.
{
  const c1 = Rec.simRecruiting(f1, 2);
  const cs = offseasonStories(c1, c1.offseason!.events, c1.offseason!.year).filter((x) => x.kind === 'commit');
  assert.ok(cs.length > 0 && cs.length <= 6, `commitment stories (${cs.length})`);
  ok(`commitment stories: ${cs.slice(0, 2).map((x) => `"${x.headline}"`).join(', ')}`);
}

// Simming for the user teams: a week, the rest of recruiting, the cuts, the whole offseason.
const g1 = Rec.simRecruiting(f1, 1);
assert.equal(g1.offseason!.recruiting!.week, 1);
assert.ok(Object.values(g1.offseason!.recruiting!.prospects).some((p) => p.interest[user] > 0), 'the computer recruited for the user team');
const g2 = Rec.simRecruiting(g1);
assert.equal(g2.offseason!.recruiting!.week, RD.weeks);
assert.equal(g2.offseason!.step, 'recruiting', 'signing day stays a step');
const g3 = Sim.simCuts(Rec.finishRecruiting(g2, tpl), tpl);
assert.equal(g3.offseason!.step, 'ready');
{
  // Training results: the offseason at its last step, then the same rows once the season is set up.
  const y = g3.offseason!.year + 1;
  assert.deepEqual(trainingYears(g3), [y]);
  const tr = trainingResults(g3, user, y);
  const gainOf = (x: (typeof tr)[number]) => x.ovr - x.before.ovr;
  assert.ok(tr.length > 20 && tr.every((x, i) => i === 0 || gainOf(tr[i - 1]) >= gainOf(x)), 'most improved first');
  assert.ok(tr.every((x) => x.player.recruit?.year !== y), 'no new signees');
  const fin = Off.finishOffseason(g3);
  const tr2 = trainingResults(fin, user, y);
  assert.deepEqual(tr2.map((x) => [x.player.id, x.ovr]), tr.map((x) => [x.player.id, x.ovr]), 'the same after the season starts');
  ok(`training results: ${tr.length} returning players, best ${tr[0].before.ovr} → ${tr[0].ovr}`);
}
assert.ok(g3.offseason!.growth.length > 3000, `players develop with the cuts (${g3.offseason!.growth.length})`);
assert.ok(g3.offseason!.growth.every((g) => !g3.offseason!.events.some((e) => (e.kind === 'signed' || e.kind === 'walkon') && e.player === g.player)), 'new signees and walk-ons don\'t');
assert.ok(act(g3).filter((p) => p.team === user).length <= Off.ROSTER_LIMIT, 'user team cut to the limit');
assert.throws(() => Sim.simOffseason(d1, tpl), /isn.t over/);
const g4 = Sim.simOffseason(o1, tpl);
assert.equal(g4.offseason, undefined);
assert.equal(g4.seasons.length, 2);
assert.equal(g4.seasons[1].slots[user].filter((x) => x !== null).length, 32);
assert.equal(Sim.simOffseason(f1, tpl).seasons.length, 2, 'from the middle of recruiting');
ok(`sim: a recruiting week, the rest, the cuts, the whole offseason (${act(g4).filter((p) => p.team === user).length} players for ${g4.teams[user].school} in ${g4.seasons[1].year})`);

// Conferences in the offseason (user, 2026-11-16: "We can edit conferences/conf alignment in dynasty offseason like
// we can in toolkit, right? If not, build that (for 94 and 26)").
{
  assert.match(Conf.confLock(d1) ?? '', /first season/);
  assert.equal(Conf.confLock(g4), null);
  const s = g4.seasons[1];
  const c0 = Conf.confSetupOf(g4, s);
  assert.deepEqual(c0.titleGames, readTitleGames(rom) ?? [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0], 'every conference plays a title game');
  const at = (n: string) => g4.teams.findIndex((t) => t.school === n);
  const nd = at('Notre Dame');
  assert.equal(c0.conf[nd], INDEPENDENT, 'Notre Dame starts independent');
  const c1 = { ...c0, conf: c0.conf.slice(), names: c0.names.slice() };
  c1.conf[nd] = 1; // to the second conference (the Big Ten as released)
  const lone = { ...c1, conf: c1.conf.map((c, t) => (c === 9 && t !== c1.conf.indexOf(9) ? INDEPENDENT : c)) };
  assert.ok(Conf.confIssues(g4, lone).some((x) => /title game/.test(x)), 'a 2026 conference needs 2 teams for its title game');
  assert.throws(() => Conf.setConferences(g4, lone), /title game/);
  const g5 = Conf.setConferences(g4, c1);
  const s5 = g5.seasons[1];
  assert.equal(s5.conf[nd], 1);
  assert.notDeepEqual(s5.schedule, s.schedule, 'a move makes a new schedule');
  assert.deepEqual(checkSchedule(s5.schedule!, g5.teams.map((t) => t.school), s5.conf).broken, []);
  const ndConf = s5.schedule!.games.filter((x) => (x.visitor === nd || x.home === nd) && s5.conf[x.visitor === nd ? x.home : x.visitor] === 1).length;
  assert.ok(ndConf >= s5.confWeeks!.games[1] - 1, `Notre Dame plays its new conference (${ndConf})`);
  const c2 = { ...c1, names: c1.names.slice() };
  c2.names[1] = '  Big Fourteen ';
  const g6 = Conf.setConferences(g5, c2);
  assert.equal(g6.seasons[1].confNames[1], 'Big Fourteen');
  assert.equal(g6.seasons[1].schedule, s5.schedule, 'a new name keeps the schedule');
  assert.equal(Conf.setConferences(g6, c2), g6, 'no change, same dynasty');
  const out = Off.seasonRom(g6, g6.seasons[1], rom, 1_800_000_000_000);
  const w = readWideSeason(out);
  assert.deepEqual(w.conf, c1.conf);
  assert.equal(w.names[1], 'Big Fourteen');
  assert.deepEqual(readWideSeason(Off.seasonRom(g4, s, rom, 1_800_000_000_000)), readWideSeason(rom), 'unchanged conferences keep the ROM\'s');
  // After a download the ROM must be written again; a started season is locked.
  const dl = { ...g4, seasons: [g4.seasons[0], { ...s, romDownloaded: true }] };
  assert.equal(Conf.setConferences(dl, c1).seasons[1].lineupEdited, true);
  const started = { ...g4, seasons: [g4.seasons[0], { ...s, imports: [g4.seasons[0].imports[0] ?? ({} as never)] }] };
  assert.match(Conf.confLock(started) ?? '', /has started/);
  // Title game switches (H-011): the Power 4 only; no new schedule; written on a ROM with the table, refused on one without.
  const c3 = { ...c2, titleGames: c2.titleGames.map((f, k) => (k < 4 ? f : 0)) };
  const lone2 = { ...c3, conf: c3.conf.map((c, t) => (c === 9 && t !== c3.conf.indexOf(9) ? INDEPENDENT : c)) };
  assert.deepEqual(Conf.confIssues(g6, lone2), [], 'no title game, no 2-team rule');
  const g7 = Conf.setConferences(g6, c3);
  assert.equal(g7.seasons[1].schedule, s5.schedule);
  if (readTitleGames(rom)) assert.deepEqual(readTitleGames(Off.seasonRom(g7, g7.seasons[1], rom, 1_800_000_000_000)), c3.titleGames);
  else assert.throws(() => Off.seasonRom(g7, g7.seasons[1], rom), /title games/);
  ok(`conferences: a move makes a new schedule, a name keeps it, the season ROM carries them; title game switches${readTitleGames(rom) ? '' : ' (refused by this older ROM)'}, locks`);
}

// User-defined protected rivalries with a preferred week (user, 2026-11-16).
{
  const schools = g4.teams.map((t) => t.school);
  const base = rivalriesOf(g4);
  assert.ok(base.some((r) => r.a === 'Alabama' && r.b === 'Auburn' && r.week === SCHED_WEEKS - 1), 'built-in finales in the last week');
  const mine: Rivalry[] = [...base.filter((r) => r.a !== 'Alabama' && r.b !== 'Alabama'), { a: 'Alabama', b: 'Auburn', week: 3 }, { a: 'Oregon', b: 'Hawaii', week: 0 }];
  assert.ok(rivalryIssues(g4, [...mine, { a: 'Auburn', b: 'Georgia', week: 3 }]).some((x) => /two rivalries in week 4/.test(x)));
  assert.ok(rivalryIssues(g4, [...mine, { a: 'Hawaii', b: 'Oregon' }]).some((x) => /twice/.test(x)));
  assert.ok(rivalryIssues(g4, [{ a: 'Alabama', b: '' }]).length > 0);
  const r1 = setRivalries(g4, mine);
  const sc = r1.seasons[1].schedule!;
  const at = (n: string) => schools.indexOf(n);
  const inWeek = (a: string, b: string, w: number) => sc.games.some((x) => x.week === w && [x.visitor, x.home].sort().join() === [at(a), at(b)].sort().join());
  // A rivalry's week counts the app's weeks without Week 0, so a schedule with Week 0 has it a week later.
  const z = sc.week0 ? 1 : 0;
  assert.ok(inWeek('Alabama', 'Auburn', 3 + z), 'Alabama-Auburn in week 4');
  assert.ok(inWeek('Oregon', 'Hawaii', 0 + z), 'a new rivalry in week 1');
  const ck = checkSchedule(sc, schools, r1.seasons[1].conf, undefined, rivalriesOf(r1));
  assert.deepEqual(ck.broken, []);
  assert.deepEqual(ck.missing, []);
  assert.ok(ck.offWeek.length <= 2, `rivalries out of their week (${ck.offWeek.length})`);
  const r2 = setRivalries(r1, null);
  assert.equal(r2.rivalries, undefined, 'back to the built-in list');
  const started = { ...r1, seasons: [r1.seasons[0], { ...r1.seasons[1], imports: [g4.seasons[0].imports[0] ?? ({} as never)] }] };
  assert.equal(setRivalries(started, base).seasons[1].schedule, started.seasons[1].schedule, 'a started season keeps its schedule');
  ok(`rivalries: the user's list with weeks (Alabama-Auburn week 4, Oregon-Hawaii week 1), checks, back to built-in, a started season kept`);
}

// A second offseason: players signed in the first can transfer now; this year's class can't.
const y1 = Off.runPortal(Off.confirmDepth(Off.startOffseason(o5, { seed: 4, force: true })));
const y1moves = y1.offseason!.events.filter((e) => e.kind === 'transfer');
assert.ok(y1moves.length > 0);
ok(`second offseason: ${y1moves.length} transfers`);

// The dynasty area's sets (dynastyArea.ts).
const u32at = (d: Uint8Array, a: number) => ((d[a] << 24) >>> 0) + (d[a + 1] << 16) + (d[a + 2] << 8) + d[a + 3];
const areaRecord = (d: Uint8Array, t: number, slot: number) => {
  const a = u32at(d, DYN_AREA + 0x14) + 128 * t + 4 * slot;
  return { numberByte: d[a], ratings: [d[a + 1] >> 4, d[a + 1] & 15, d[a + 2] >> 4, d[a + 2] & 15, d[a + 3] >> 4, d[a + 3] & 15] };
};
const stockRosters = openRosterRom(rom);
/** Season one: the area holds the ROM's own rosters; nothing outside it changes but the checksums … */
const isRomOwn = (out: Uint8Array) => {
  let outside = 0;
  for (let i = 0; i < DYN_AREA; i++) if (out[i] !== rom[i]) outside++;
  const base = u32at(out, DYN_AREA + 0x14);
  // … except the numbers the dynasty replaced at its start (a position can't wear them in the game).
  const newNumber = new Map(renumbered.map((n) => [n.player, n.to]));
  const want = (t: number, k: number) => {
    const id = k % 4 === 0 ? d0.seasons[0].slots[t][k / 4] : null;
    return id !== null && newNumber.has(id) ? jerseyByte(newNumber.get(id)!) : rom[stockRosters.teams[t].rosterOffset + k];
  };
  return outside <= 4 && stockRosters.teams.every((t) => out.subarray(base + 128 * t.index, base + 128 * t.index + 128).every((b, k) => b === want(t.index, k)));
};

// A random bench for the first season: the 32 stay (the ROM is unchanged), every slot gets a backup.
const rb = randomBench(d0, 5);
assert.ok(isRomOwn(Off.seasonRom(rb, rb.seasons[0], rom)));
assert.equal(rb.seasons[0].bench!.flat().filter((x) => x !== null).length, 138 * 32);
assert.deepEqual(rb.seasons[0].slots.map((sl) => sl.map((id) => (id ? rb.players[id - 1].srcId : null))), first.slots.map((sl) => sl.map((id) => (id ? d0.players[id - 1].srcId : null))));
assert.throws(() => randomBench(o5), /first season/);
ok('random bench for the first season');

// The season's rosters in the ROM: the first season's are the ROM's own; the next one reads back.
assert.ok(isRomOwn(Off.seasonRom(d0, first, rom)), 'season 1 written = the ROM\'s rosters');
const rom2 = Off.seasonRom(o5, next, rom);
const rr = openRosterRom(rom2);
const ovr2 = u32at(rom2, DYN_AREA + 0x18);
for (let t = 0; t < 138; t++) {
  for (const def of teamLayout(rr, t)) {
    const b = next.bw![t][def.slot]!;
    assert.deepEqual(b.attrs.map((a) => getRating(areaRecord(rom2, t, def.slot), def, a)), b.steps);
    assert.equal(jerseyNumber(areaRecord(rom2, t, def.slot).numberByte), o5.players[next.slots[t][def.slot]! - 1].jersey);
  }
  assert.deepEqual({ off: rom2[ovr2 + 4 + 2 * t], def: rom2[ovr2 + 5 + 2 * t] }, next.teamOvr![t]);
  assert.deepEqual(readRating(rom2, t), readRating(rom, t)); // Exhibition's 2026 OVRs stay
}
assert.deepEqual(readStamp(rom2.subarray(DYN_AREA, DYN_AREA + 16))!.season, 2);
ok('season rosters written to the dynasty area and read back');

// The preseason poll (user, 2026-11-16: "let's make rankings in the app"): every team once, by points; the same every
// time; in the season ROM's dynasty area ("PRE1" at header +0x30). The first season's is the real 2026 AP poll the ROM
// sets (test35 on; the ROM lane's H-017 reply), shown without points and not written.
{
  const p1 = preseasonPoll(d0, first)!;
  assert.deepEqual(p1.slice(0, AP_2026_PRESEASON.length).map((p) => d0.teams[p.team].school), AP_2026_PRESEASON, 'every AP school found, in order');
  assert.ok(p1.every((p) => p.real && p.points === 0));
  assert.equal(new Set(p1.map((p) => p.team)).size, 138);
  assert.equal(readPollSet(Off.seasonRom(d0, first, rom)), null);
  const poll = preseasonPoll(o5, next)!;
  assert.equal(poll.length, 138);
  assert.deepEqual(new Set(poll.map((p) => p.team)).size, 138);
  assert.deepEqual(poll.map((p) => p.rank), poll.map((_, k) => k + 1));
  for (let k = 1; k < 138; k++) assert.ok(poll[k - 1].points >= poll[k].points, 'by points');
  assert.equal(poll.reduce((a, p) => a + p.points, 0), VOTERS * 325, 'all 62 ballots counted');
  assert.equal(poll.reduce((a, p) => a + p.firstVotes, 0), VOTERS);
  assert.deepEqual(preseasonPoll(o5, next), poll, 'the same every time');
  const top = poll.slice(0, 25);
  const avgOvr = (l: typeof poll) => l.reduce((a, p) => a + p.ovr, 0) / l.length;
  assert.ok(avgOvr(top) > avgOvr(poll.slice(50)) + 5, 'the Top 25 is rated well above the rest');
  assert.ok(top.filter((p) => p.lastRank !== null && p.lastRank <= 25).length >= 10, 'most of last year\'s Top 25 stay');
  assert.deepEqual(readPollSet(rom2), pollSet(poll));
  assert.equal(u32at(rom2, DYN_AREA + POLL_AT), DYN_AREA + 0x4c00);
  if (process.env.POLL) console.log(poll.slice(0, 30).map((p) => `${p.rank}. ${o5.teams[p.team].school} ${p.points} (${p.firstVotes}) ovr ${p.ovr.toFixed(1)} last ${p.lastRank} ret ${p.returning} pres ${p.prestige}`).join('\n'));
  if (process.env.WALSH) {
    const rs = walshReports(o5, next)!;
    const pick = process.env.WALSH.split(',').map((x) => o5.teams.findIndex((t) => t.school === x));
    for (const t of pick) console.log(`\n== ${o5.teams[t].school} (${rs[t].offense.length + rs[t].defense.length})\nOFF: ${rs[t].offense}\nDEF: ${rs[t].defense}`);
  }
  ok(`preseason poll: 138 teams by 62 ballots (No. 1 ${o5.teams[poll[0].team].school}, ${poll[0].firstVotes} first-place votes), in the season ROM`);

// Walsh Reports (user, 2026-11-16): every team's, from the second season; they fit the game, name players with their
// numbers, stay the same for the same inputs, change with "Write it again", and the user's own win; all in the ROM.
{
  assert.equal(seasonReports(d0, first), null);
  const all = seasonReports(o5, next)!;
  assert.equal(all.length, 138);
  for (const [t, x] of all.entries()) {
    assert.deepEqual(reportProblems(x.report), [], o5.teams[t].school);
    if (process.env.SHORT && x.report.offense.length + x.report.defense.length < 420) console.log(o5.teams[t].school, x.report);
    assert.ok(x.report.offense.length > 100 && x.report.defense.length > 80, `${o5.teams[t].school} has a full report`);
    // H-035: no theme closers; a position (or "transfer") before every jersey number; each paragraph ends on a verdict.
    const both = `${x.report.offense} ${x.report.defense}`;
    for (const closer of ['The arrow is pointing up', 'Patience will be needed', 'A bowl game is a fair target', 'There will be growing pains', 'built to win now', 'A winning record would be real progress']) {
      assert.ok(!both.includes(closer), `${o5.teams[t].school}: closer "${closer}"`);
    }
    for (const m of both.matchAll(/(\S+) #\d/g)) {
      assert.match(m[1], /^(QB|HB|FB|WR|TE|OT|OG|C|OL|DE|DT|DL|LB|CB|DB|S|K|P|transfer|quarterback|halfback|fullback|receiver|end|tackle|guard|center|lineman|linebacker|cornerback|back|safety|kicker|punter)$/, `${o5.teams[t].school}: "${m[0]}"`);
    }
    if (!x.edited) {
      for (const para of [x.report.offense, x.report.defense]) {
        const last = para.slice(para.lastIndexOf('. ', para.length - 2) + 2);
        assert.match(last, /(strength|question|wins)/, `${o5.teams[t].school} ends on a strength or weakness: "${last}"`);
      }
    }
    assert.ok(x.report.offense.includes(o5.teams[t].school) || x.report.offense.includes(o5.teams[t].nickname), 'names the team');
  }
  assert.ok(all.filter((x) => /#\d+ [A-Z]/.test(x.report.offense)).length > 120, 'players named with their numbers');
  assert.deepEqual(seasonReports(o5, next)!.map((x) => x.report), all.map((x) => x.report), 'the same every time');
  const openings = new Set(all.map((x) => x.report.offense.split('. ')[0].replace(new RegExp(o5.teams.map((t) => t.school.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'), 'X')));
  assert.ok(openings.size > 40, `${openings.size} different openings`);
  const T = 5;
  const again = rewriteWalshReport(o5, T);
  assert.notDeepEqual(teamReport(again, again.seasons[1], T)!.report, all[T].report, 'written again');
  const mine = { offense: `${o5.teams[T].school} runs the ball.`, defense: 'The defense is fast.' };
  const ed = setWalshReport(again, T, mine);
  assert.deepEqual(teamReport(ed, ed.seasons[1], T)!.report, mine);
  assert.equal(teamReport(ed, ed.seasons[1], T)!.edited, true);
  assert.throws(() => setWalshReport(ed, T, { offense: 'x'.repeat(700), defense: 'y' }), /characters/);
  const back0 = setWalshReport(ed, T, null);
  assert.equal(teamReport(back0, back0.seasons[1], T)!.edited, false);
  const romW = Off.seasonRom(ed, ed.seasons[1], rom);
  const back = readReports(romW);
  assert.deepEqual(back[T], mine);
  assert.deepEqual(back[0], all[0].report);
  assert.match(walshLock(d1) ?? '', /first season/);
  ok(`Walsh Reports: 138 written (${Math.min(...all.map((x) => x.report.offense.length + x.report.defense.length))}-${Math.max(...all.map((x) => x.report.offense.length + x.report.defense.length))} characters, ${openings.size} openings), edited, written again, in the season ROM`);
}
}

// Schedules from the second season (user, 2026-11-12: "Generate each year, and then the user can edit";
// "keep protected rivalries"): the game's Random rules, every protected rivalry in, the finales in the last week.
{
  assert.equal(first.schedule, undefined, 'the first season plays the game\'s schedule');
  const sc = next.schedule!;
  const schools = o5.teams.map((t) => t.school);
  const ck = checkSchedule(sc, schools, next.conf);
  assert.equal(ck.broken.length, 0, ck.broken[0]);
  assert.equal(ck.missing.length, 0, 'every protected rivalry');
  assert.ok(ck.repeats.length <= 2, `repeats ${ck.repeats.length}`);
  const pairs = protectedPairs(schools);
  assert.ok(pairs.length >= 40, `protected pairs (${pairs.length})`);
  const inLast = (a: number, b: number) => sc.games.some((g) => g.week === weeksOf(sc) - 1 && ((g.visitor === a && g.home === b) || (g.visitor === b && g.home === a)));
  const finales = pairs.filter((p) => p.week === SCHED_WEEKS - 1);
  // Week 0 and the Aflac Kickoff Game (user, 2026-11-26): 8 Week 0 games; Week 1's SEC team against an ACC (or Big Ten /
  // Big 12) team; nobody short of 12 games.
  assert.ok(sc.week0 && weeksOf(sc) === 13 && sc.games.filter((g) => g.week === 0).length === 8, 'a light Week 0 of 8 games');
  assert.equal(sc.kickoffs?.length, 1, 'one Aflac Kickoff Game a season');
  const ko = sc.kickoffs?.[0];
  assert.ok(ko && ko.name === 'Aflac Kickoff Game' && ko.week === 1, 'the Aflac Kickoff Game in Week 1');
  const kc = [next.confNames[next.conf[ko!.visitor]], next.confNames[next.conf[ko!.home]]];
  assert.ok(kc.includes('SEC') && kc.some((c) => ['ACC', 'Big Ten', 'Big 12'].includes(c)), `its conferences (${kc.join(' / ')})`);
  assert.ok(sc.games.some((g) => g.week === 1 && [g.visitor, g.home].sort().join() === [ko!.visitor, ko!.home].sort().join()));
  const per = new Map<number, number>();
  for (const g of sc.games) for (const t of [g.visitor, g.home]) per.set(t, (per.get(t) ?? 0) + 1);
  assert.ok([...per.values()].every((n) => n === 12), 'every team 12 games');
  assert.ok(finales.every((p) => inLast(p.a, p.b)), 'the finales in the last week');
  const cw = next.confWeeks!;
  const short = schools.filter((_, t) => next.conf[t] !== INDEPENDENT && ck.confGames[t] < cw.games[next.conf[t]] - 1);
  assert.equal(short.length, 0, `conference games (${short.slice(0, 3).join(', ')})`);
  assert.ok(Math.min(...ck.homeGames) >= 4 && Math.max(...ck.homeGames) <= 8, `home games ${Math.min(...ck.homeGames)}-${Math.max(...ck.homeGames)}`);
  // Conference games in the conference's weeks (the moved ones from a finale aside).
  const early = sc.games.filter((g) => next.conf[g.home] === next.conf[g.visitor] && next.conf[g.home] !== INDEPENDENT && g.week < cw.start[next.conf[g.home]]).length;
  // Editing: every team keeps one game a week.
  const ts = schools.indexOf('Texas State'), ut = schools.indexOf('Texas');
  let e = setOpponent(sc, 1, ts, ut);
  assert.deepEqual(teamSchedule(e, ts)[1]!.opp, ut);
  e = moveGame(e, ts, 1, 6);
  assert.equal(teamSchedule(e, ts)[6]!.opp, ut, 'the game moved');
  e = flipHome(e, 6, ts);
  assert.equal(checkSchedule(e, schools, next.conf).broken.length, 0, 'still one game a week');
  // The dynasty: edits after the download need a new ROM (roster version up); none once games are in.
  const o6 = { ...o5, seasons: o5.seasons.map((x, i) => (i === 1 ? { ...x, romDownloaded: true } : x)) };
  const ed = editSchedule(o6, (x) => setOpponent(x, 1, ts, ut));
  assert.ok(ed.seasons[1].lineupEdited && ed.seasons[1].rosterVersion === (next.rosterVersion ?? 1) + 1);
  assert.throws(() => editSchedule(d0, (x) => x), /first season/);
  const re = remakeSchedule(o5, 99);
  assert.equal(checkSchedule(re.seasons[1].schedule!, schools, next.conf).missing.length, 0);
  assert.notDeepEqual(re.seasons[1].schedule!.games, sc.games, 'a new schedule');
  // In the ROM: header +0x28 → "SCH1", weeks, per week count + visitor/home.
  const at = scheduleAddress(rom2)!;
  assert.ok(at, 'schedule set');
  let k = at + 4, back: SchedGame[] = [];
  const weeks = rom2[k++];
  for (let w = 0; w < weeks; w++) for (let c = rom2[k++]; c > 0; c--) { back.push({ week: w, visitor: rom2[k], home: rom2[k + 1] }); k += 2; }
  assert.deepEqual(back, sc.games, 'the ROM\'s schedule = the dynasty\'s');
  assert.equal(scheduleAddress(Off.seasonRom(d0, first, rom)), null, 'none for the first season');
  // Fine-ratings offsets in the ROM: header +0x24 → "FRC1" + the table, every slot's offsets as the season has them.
  const fa = fineAddress(rom2)!;
  assert.ok(fa, 'fine-ratings set');
  next.bw!.forEach((sl, t) => sl.forEach((b, slot) => {
    if (b) assert.deepEqual(readFineOffsets(rom2, t, slot, fa), GROUP_ATTRS[b.group].map((a) => b.offs[b.attrs.indexOf(a)]), `fine set team ${t} slot ${slot}`);
  }));
  { const tb = new Uint8Array(138 * 96); putFineOffsets(tb, 3, 7, next.bw![3][7]!); assert.deepEqual([...tb.subarray((3 * 32 + 7) * 3, (3 * 32 + 7) * 3 + 3)], [...rom2.subarray(fa + (3 * 32 + 7) * 3, fa + (3 * 32 + 7) * 3 + 3)]); }
  // The preseason pages show it before any import.
  const pv = seasonView(o5, next);
  assert.ok(pv.games.length === sc.games.length && pv.currentWeek === 0 && !pv.done);
  const fin = finales.map((p) => `${schools[p.a]}-${schools[p.b]}`);
  ok(`schedule: ${sc.games.length} games, ${pairs.length} protected rivalries, ${finales.length} finales in week 12 (e.g. ${fin.slice(0, 3).join(', ')}), ${ck.repeats.length} repeats, home games ${Math.min(...ck.homeGames)}-${Math.max(...ck.homeGames)}, ${early} conference games moved early; edits keep one game a week; in the ROM at 0x${at.toString(16).toUpperCase()}`);
}
// The new season doesn't take last season's save.
assert.throws(() => importSave(o5, srm), /the 2026 ROM, and the dynasty is in 2027/);
ok('a new season refuses the last season\'s save');

// ---- weekly stories: two imports a week apart give the week's stats (player of the week)
{
  // The save before the last week: its results cleared, its stats at 60% (fields the stories use).
  const lastWeek = Math.max(...save.season!.games.filter((g) => g.vs !== null).map((g) => g.week));
  const before = srm.slice();
  const win = editionOfSig(before[1]) !== null;
  const at = (o: number) => (win ? o : o >> 1); // window offset → file offset
  for (const g of save.season!.games) if (g.week === lastWeek) for (const k of [0, 2]) before[at(0xe01 + 2 * (0x200 + 4 * g.index + k))] = 0xff;
  const scaleWord = (o: number) => { const raw = (before[at(o)] << 8) | before[at(o + 2)]; const v = Math.trunc((((raw << 16) >> 16)) * 0.6) & 0xffff; before[at(o)] = v >> 8; before[at(o + 2)] = v & 255; };
  const scaleByte = (o: number) => { before[at(o)] = Math.floor(before[at(o)] * 0.6); };
  // Stats records: layout 1 0xB8 bytes with 4-byte defenders; layout 2 169 bytes with 3-byte packed defenders
  // (tackles below 256 here, so scaling the low byte and the sacks bits is enough).
  const lay2 = layoutOfSig(before[win ? 1 : 0]) === 2;
  for (let t = 0; t < 138; t++) {
    const base = 0x3951 + 2 * (lay2 ? 169 : 0xb8) * t, b = (j: number) => base + 2 * j;
    scaleWord(b(4)); scaleByte(b(6)); scaleByte(b(7));
    for (let k = 0; k < 4; k++) { scaleWord(b(8 + 8 * k)); scaleWord(b(8 + 8 * k + 2)); scaleByte(b(8 + 8 * k + 7)); }
    for (let k = 0; k < 9; k++) { scaleWord(b(40 + 8 * k)); scaleWord(b(40 + 8 * k + 2)); scaleByte(b(40 + 8 * k + 7)); }
    for (let k = 0; k < 15; k++) {
      if (lay2) {
        const o = b(124 + 3 * k);
        scaleByte(o);
        const x = before[at(o + 2)]; before[at(o + 2)] = (x & 0xc0) | Math.floor((x & 63) * 0.6);
        scaleByte(o + 4);
      } else { scaleWord(b(124 + 4 * k)); scaleByte(b(124 + 4 * k + 2)); scaleByte(b(124 + 4 * k + 3)); }
    }
  }
  const w1 = importSave(d0, before).dynasty;
  const w2 = importSave(w1, srm).dynasty;
  const st = stories(w2);
  const potw = st.filter((x) => x.kind === 'potw');
  assert.equal(potw.length, 2, 'offensive and defensive player of the week');
  assert.ok(potw.every((x) => / (win over|loss to|tie with) /.test(x.dek) && !/\d{4,}/.test(x.dek)), potw.map((x) => x.dek).join(' | '));
  // Each player of the week has his game: the result and his stat lines; the headline links to him.
  for (const x of potw) {
    assert.ok(x.player && x.box && x.box.lines.length > 0 && /(win over|loss to|tie with)/.test(x.box.result), JSON.stringify(x.box));
    assert.ok(x.box.lines.every((l) => l.cells.every(([k, v]) => typeof v === 'string' || v >= 0 || k === 'Yds')), 'no negative week stats');
  }
  assert.ok(st.filter((x) => x.kind === 'leader' || x.kind === 'milestone').every((x) => x.player), 'leaders and milestones link to the player');
  writeFileSync('/tmp/potw-before.srm', before); writeFileSync('/tmp/potw-after.srm', srm);
  // A gap of more than a week (no import in between): no week's stats, the season-total stories only.
  assert.equal(stories(importSave(d0, srm).dynasty).filter((x) => x.kind === 'potw').length, 0);
  const kinds = [...new Set(st.map((x) => x.kind))].join(', ');
  // Rivalries, conference races (late in the season), records broken (from the second season), commitments.
  assert.equal(rivalryOf('Auburn', 'Alabama'), 'the Iron Bowl');
  assert.equal(rivalryOf('Alabama', 'Texas State'), null);
  const v2 = seasonView(w2, w2.seasons[0]);
  const lastWk = Math.max(...v2.games.filter((g) => g.vs !== null).map((g) => g.week));
  const late = stories(w2, { ...v2, lastRegularWeek: lastWk + 2 }).filter((x) => x.kind === 'race');
  assert.ok(late.length > 0 && late.length <= 4, `conference races late in the season (${late.length})`);
  assert.equal(st.filter((x) => x.kind === 'race').length, 0, 'no races early');
  {
    // 2026 with the smaller save, then 2027 with the full one: the leaders pass the 2026 bests.
    const a1 = importSave(d0, before).dynasty;
    const o = Off.startOffseason(a1, { seed: 5, force: true });
    const n2 = Sim.simOffseason(o, Off.recruitTemplates(o));
    const ib2 = importSave(n2, stampSave(rawSrm, dynastyRomId('test'), 2, 1));
    assert.match(ib2.warning ?? '', /isn't the dynasty's 2027 schedule/, 'a save that played another schedule warns');
    const b2 = ib2.dynasty;
    const rec = stories(b2).filter((x) => x.kind === 'record');
    assert.ok(rec.length > 0 && rec.length <= RECORD_STATS.length && rec.every((x) => x.player && /sets the record/.test(x.headline)), `records broken (${rec.length})`);
    assert.equal(new Set(rec.map((x) => x.headline.replace(/^.* sets /, ''))).size, rec.length, 'one new holder per record');
    // The series across two seasons: a pair that met in both.
    const va = seasonView(b2, b2.seasons[0]), vb = seasonView(b2, b2.seasons[1]);
    const key = (g: { visitor: number | null; home: number | null }) => [g.visitor, g.home].sort().join('/');
    const met = new Set(va.games.filter((g) => g.vs !== null && g.vs !== g.hs).map(key));
    const again = vb.games.find((g) => g.vs !== null && g.vs !== g.hs && met.has(key(g)));
    if (again) {
      const all = meetings(b2, again.visitor!, again.home!, { year: vb.season.year, week: again.week });
      assert.ok(all.length >= 2 && all[0].year === va.season.year, 'meetings across seasons');
      const ss = seriesStory(b2, again.visitor!, again.home!, { year: vb.season.year, week: again.week }, (t) => b2.teams[t].school);
      assert.ok(/leads|Tied/.test(ss.record) && ss.last.length === all.length - 1, ss.record);
      ok(`series: ${ss.record}${ss.facts.length ? `; ${ss.facts.join('; ')}` : ''}`);
    }
    ok(`more stories: ${late.length} conference races late in the season, e.g. "${late[0].headline}"; ${rec.length} records broken, e.g. "${rec[0].headline}" (${rec[0].dek})`);
  }
  {
    // Season awards from the stats so far (seasonAwards waits for the season's end).
    const aw = awardsOf(v2);
    const [first, second] = aw.allAmerican;
    const spots = AWARD_SPOTS.reduce((a, x) => a + x.n, 0);
    assert.ok(first.length === spots && second.length === spots, `full All-American teams (${first.length}, ${second.length} of ${spots})`);
    assert.equal(new Set([...first, ...second].map((c) => c.player)).size, 2 * spots, 'nobody on both teams');
    for (const x of AWARD_SPOTS) assert.equal(first.filter((c) => x.roles.includes(c.role)).length, x.n, `${x.label} spots`);
    const qb = aw.position.find((x) => x.key === 'obrien')!.winner!;
    // Stats and OVR (user: "stats are very important … they aren't everything"): the winner is among the top 10 QBs
    // by stats and has the best 60/40 blend of them.
    const qbs = candidates(v2).filter((c) => c.role === 'QB' && c.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
    const bl = (c: { statPct: number; ovrPct: number }) => AWARD_STATS_WEIGHT * c.statPct + (1 - AWARD_STATS_WEIGHT) * c.ovrPct;
    assert.ok(qbs.some((c) => c.player === qb.player) && qbs.every((c) => bl(c) <= bl(qb) + 1e-9), 'best quarterback: top 10 by stats, best blend');
    const leader = qbs[0];
    {
      // How the blend changed the picks (stats alone vs stats and OVR), for the log.
      const all = candidates(v2), diffs: string[] = [];
      for (const pa of aw.position) {
        const na = POSITION_AWARDS.find((y) => y.key === pa.key)!;
        if (!Array.isArray(na.roles)) continue;
        const roles = na.roles;
        const top = all.filter((c) => roles.includes(c.role) && c.score > 0).sort((a, b) => b.score - a.score)[0];
        if (top && pa.winner && top.player !== pa.winner.player) diffs.push(`${pa.label}: ${playerName(w2.players[pa.winner.player - 1])} (${pa.winner.ovr} OVR) over stat leader ${playerName(w2.players[top.player - 1])} (${top.ovr} OVR)`);
      }
      ok(`blend changes: ${diffs.join('; ') || 'none'}`);
    }
    ok(`award blend: QB stat leader ${playerName(w2.players[leader.player - 1])} (${leader.ovr} OVR, ${bl(leader).toFixed(2)}), winner ${playerName(w2.players[qb.player - 1])} (${qb.ovr} OVR, ${bl(qb).toFixed(2)})`);
    assert.ok(first.some((c) => c.role === 'QB'), 'a first-team QB');
    const confs = Object.keys(aw.allConference).map(Number);
    assert.ok(confs.length > 5 && !confs.includes(INDEPENDENT) && confs.every((c) => aw.allConference[c].every((x) => w2.seasons[0].conf[x.team] === c)), 'All-Conference teams by conference');
    assert.equal(seasonAwards(w2, w2.seasons[0]), null, 'no awards before the season ends');
    // The real awards (user, 2026-11-27), each from its first year; the Outland to an OL or a DT.
    assert.deepEqual(aw.position.map((x) => x.key), POSITION_AWARDS.map((x) => x.key), 'every award in 2026');
    assert.ok(['OL', 'DT'].includes(aw.position.find((x) => x.key === 'outland')!.winner?.role ?? 'OL'), 'the Outland: an interior lineman');
    assert.equal(awardsIn(1994).some((x) => x.key === 'mackey' || x.key === 'guy' || x.key === 'bednarik'), false, 'no Mackey, Ray Guy or Bednarik in 1994');
    assert.ok(awardsIn(1994).some((x) => x.key === 'biletnikoff'), 'the Biletnikoff from 1994');
    assert.equal(aw.coach.length, 2, 'two coach of the year awards');
    {
      // Every trophy game's schools are in the 2026 edition; the real records add up.
      const schools = new Set(w2.teams.map((t) => t.school));
      for (const t of TROPHIES) {
        assert.ok(schools.has(t.a) && schools.has(t.b), `trophy schools: ${t.a} / ${t.b}`);
        assert.match(t.real.rec, /^\d+-\d+(-\d+)?$/, t.trophy);
        assert.ok(!t.real.last || /^20[0-2]\d /.test(t.real.last) && Number(t.real.last.slice(0, 4)) <= REAL_THROUGH, `no result after ${REAL_THROUGH}: ${t.real.last}`);
      }
      assert.equal(trophyOf('Southern Miss', 'Tulane')?.trophy, 'The Bell');
      // The 1994 edition's real series, to 1993: 44 trophy games, names as the 1994 ROM has them.
      const r94 = TROPHIES.filter((t) => t.real94);
      assert.equal(r94.length, 44, 'real94 for the 44 trophy games in the 1994 edition');
      for (const t of r94) {
        const r = t.real94!, sides = [t.a, t.b].map((x) => (x === 'Cal' ? 'California' : x));
        assert.match(r.rec, /^\d+-\d+(-\d+)?$/, t.trophy);
        assert.ok(r.last && /^1[89]\d\d /.test(r.last) && Number(r.last.slice(0, 4)) <= REAL94_THROUGH, `no result after ${REAL94_THROUGH}: ${r.last}`);
        assert.ok((!r.lead || sides.includes(r.lead)) && (!r.holder || sides.includes(r.holder)), `real94 names: ${t.trophy}`);
        assert.ok(!r.holder || t.since === null || t.since <= REAL94_THROUGH, `no holder before the trophy: ${t.trophy}`);
      }
      assert.equal(trophyOf('California', 'Stanford')?.trophy, 'Stanford Axe', 'the 1994 names find their trophy');
      assert.equal(realSeries(trophyOf('Indiana', 'Purdue')!, 1994)?.series.rec, '58-32-6');
      assert.equal(realSeries(trophyOf('Indiana', 'Purdue')!, 2026)?.through, REAL_THROUGH);
      assert.equal(realSeries(trophyOf('Indiana', 'Purdue')!, 1999), null, 'no real series for another start');
      // The user's teams per season, kept even when the user drops a team; the trophy room counts them.
      const r1 = rememberUser({ ...w2, userTeams: [5] });
      assert.deepEqual(r1.seasons[0].userTeams, [5]);
      const r2 = rememberUser({ ...r1, userTeams: [9] });
      assert.deepEqual(r2.seasons[0].userTeams, [5, 9], 'a dropped team stays in the season');
      assert.equal(rememberUser(r2), r2, 'nothing new: the same object');
      const room = trophyRoom(r2);
      assert.ok(room.stints.some((x) => x.team === 5) && room.stints.some((x) => x.team === 9), 'both teams in the trophy room');
      ok(`trophies: ${TROPHIES.length} rivalry trophies (${r94.length} with the real series to 1993); trophy room ${room.items.length} items for teams 5 and 9`);
    }
    const h = playerHonors(w2, qb.player, [aw]);
    // The teams lean more on stats (70/30) than the position awards (60/40), so the best QB can miss them; when he
    // makes a team, his page lists it too.
    assert.ok(h.some((x) => x.label === "Davey O'Brien Award"), `honors on the player page: ${h.map((x) => x.label).join(', ')}`);
    const onTeam = [...first, ...Object.values(aw.allConference).flat()].some((c) => c.player === qb.player);
    assert.equal(h.some((x) => x.label.startsWith('All-')), onTeam, 'his All- honors on the player page');
    ok(`awards: Heisman ${aw.heisman[0] ? playerName(w2.players[aw.heisman[0].player - 1]) : '-'}; best QB ${playerName(w2.players[qb.player - 1])} (${qb.line}); ${confs.length} All-Conference teams; honors ${h.map((x) => x.label).join(', ')}`);
  }
  {
    // The records book: career totals add up the seasons; a school's only count what was done there.
    const st = RECORD_STATS[2];
    const car = careerRecords(w2, st), one = seasonRecords(w2, st);
    assert.ok(car.length === 10 && car[0].value === one[0].value, 'one season: career leader = season leader');
    const tm = car[0].team, mineC = careerRecords(w2, st, tm);
    assert.ok(mineC.every((c) => c.team === tm) && mineC[0].player === car[0].player, 'per school');
    const tr = teamRecords(w2);
    const most = tr.find((x) => x.label === 'Most points in a game')!.list[0];
    const g = seasonView(w2, w2.seasons[0]).games.filter((x) => x.vs !== null).flatMap((x) => [x.vs!, x.hs!]);
    assert.equal(most.value, Math.max(...g), 'most points in a game');
    assert.equal(tr.find((x) => x.label.startsWith('Fewest'))!.list.length, 0, 'points allowed wait for the season to end');
    ok(`records book: career ${st.label.toLowerCase()} leader ${car[0].value}; ${tr.map((x) => `${x.label} ${x.list[0]?.value ?? '-'}${x.list[0] ? ` (${x.list[0].note})` : ''}`).join('; ')}`);
  }
  ok(`weekly stories: ${potw.map((x) => `"${x.headline}" (${x.dek}; ${x.box!.lines.map((l) => `${l.cat} ${l.cells.map(([k, v]) => `${k} ${v}`).join(' ')}`).join(', ')})`).join('; ')}; kinds ${kinds}`);
}

// ---- names and skin tones
{
  const black = (p: { skin: number }) => p.skin >= 2;
  assert.ok(d0.players.every((p) => p.skin >= 0 && p.skin <= 3));
  // Starting players: each position's share, given by name.
  const by = (ps: typeof d0.players) => {
    const m = new Map<string, [number, number]>();
    for (const p of ps) { const [b, n] = m.get(p.pos) ?? [0, 0]; m.set(p.pos, [b + (black(p) ? 1 : 0), n + 1]); }
    return m;
  };
  for (const [pos, [b, n]] of by(d0.players)) assert.ok(Math.abs(b / n - blackShare(pos)) <= 1 / n + 1e-9, `${pos} ${b}/${n}`);
  // Names that point one way mostly land that way.
  const named = (n: string) => d0.players.filter((p) => p.last === n);
  const wash = named('Washington'), okafor = named('Okafor');
  if (wash.length + okafor.length) assert.ok([...wash, ...okafor].filter(black).length / (wash.length + okafor.length) > 0.7);
  // Generated players: short names, never a real player's, shares near the position's.
  const recruits = o5.players.filter((p) => p.recruit);
  const real = new Set(d0.players.map((p) => `${p.first} ${p.last}`));
  assert.ok(recruits.length > 1000);
  assert.ok(recruits.every((p) => p.first.length <= MAX_FIRST && p.last.length <= MAX_LAST && /^[A-Za-z0-9'. -]+$/.test(`${p.first} ${p.last}`)));
  assert.ok(recruits.filter((p) => real.has(`${p.first} ${p.last}`)).length === 0);
  const rb = by(recruits).get('CB')!, rq = by(recruits).get('QB')!;
  assert.ok(rb[0] / rb[1] > 0.9 && rq[0] / rq[1] > 0.25 && rq[0] / rq[1] < 0.65, `CB ${rb} QB ${rq}`);
  const tones = [0, 1, 2, 3].map((t) => recruits.filter((p) => p.skin === t).length);
  assert.ok(tones.every((x) => x > recruits.length * 0.1), tones.join(' '));
  const sample = recruits.slice(0, 6).map((p) => `${p.first} ${p.last} (${p.pos}, ${SKIN_TONES[p.skin].label})`);
  ok(`names and skin tones: shares by position, names lean the tone; ${recruits.length} recruits, e.g. ${sample.join(', ')}`);
}

// ---- the game's ratings as the truth: steps, progress, development, editing, CSV
{
  assert.deepEqual([stepOf(0), stepOf(85.9), stepOf(90), stepOf(93), stepOf(100)], [0, 13, 14, 14, 15]);
  // After an offseason returning players sit anywhere between the steps.
  const grown = o5.players.filter((p) => p.status === 'active' && p.srcId !== undefined);
  const between = grown.filter((p) => Object.entries(p.ratings).some(([a, v]) => a !== 'Weight' && fineOf(v!) % 16 !== 0)).length;
  assert.ok(between / grown.length > 0.5, `${between} of ${grown.length} players between steps`);
  // The depth chart: every slot of every team, the starters at least as good as their backups (same position).
  for (const sl of next.slots) assert.ok(sl.every((x) => x !== null));
  // Editing before the first import: the season follows (ratings, team OVR, ROM out of date).
  const T = 5, qb = d0.seasons[0].slots[T][0]!;
  const e1 = applyEdits(d0, new Map([[qb, { ratings: { Awareness: 100, Quickness: 100 }, first: 'Edited' }]]));
  assert.equal(e1.players[qb - 1].first, 'Edited');
  assert.equal(e1.players[qb - 1].years!.length, 1);
  assert.equal(recordRatings(e1.players[qb - 1].years![0]).Awareness, 100, 'a preseason edit updates the season record');
  assert.equal(e1.seasons[0].bw![T][0]!.steps[e1.seasons[0].bw![T][0]!.attrs.indexOf('Awareness')], 15);
  assert.ok(e1.seasons[0].teamOvr![T].off >= d0.seasons[0].teamOvr![T].off && e1.seasons[0].lineupEdited);
  assert.throws(() => applyEdits(importSave(d0, srm).dynasty, new Map([[qb, { first: 'X' }]])), /offseason/);
  // Releasing a starter: the team's lineup is set again, every slot filled.
  const e2 = applyEdits(d0, new Map([[qb, { team: null }]]));
  assert.ok(!e2.seasons[0].slots[T].includes(qb) && e2.seasons[0].slots[T].every((x) => x !== null));
  // CSV: the export reads back without changes; edited rows change exactly what was edited; new rows add players.
  const csvText = playersCsv(d0);
  const same = readPlayersCsv(d0, csvText);
  assert.equal(same.problems.length, 0, same.problems.join(' '));
  assert.equal(same.changes.length, 0, same.changes.slice(0, 3).join(' | '));
  const lines = csvText.split(/\r?\n/);
  const hdr = lines[0].split(',');
  const row = lines[1].split(',');
  row[hdr.indexOf('Speed')] = '99';
  row[hdr.indexOf('Last Name')] = 'Csvman';
  const add = hdr.map((h) => ({ 'Team': d0.teams[3].school, 'First Name': 'New', 'Last Name': 'Guy', 'Position': 'CB', 'Speed': '90' } as Record<string, string>)[h] ?? '');
  const imp = readPlayersCsv(d0, [lines[0], row.join(','), add.join(',')].join('\n'));
  assert.equal(imp.problems.length, 0, imp.problems.join(' '));
  assert.equal(imp.changes.length, 2);
  const e3 = applyEdits(d0, imp.edits, imp.adds);
  const edited = e3.players[Number(row[0]) - 1];
  assert.equal(edited.last, 'Csvman'); assert.equal(edited.ratings.Speed, 99);
  assert.equal(e3.players.length, d0.players.length + 1);
  assert.ok(readPlayersCsv(d0, [lines[0], row.map((x, i) => (hdr[i] === 'Position' ? 'XX' : x)).join(',')].join('\n')).problems.length === 1);
  {
    // A new number the position can't wear in the game is replaced, with a warning.
    const te = d0.players.find((p) => p.pos === 'TE' && p.team === 3)!;
    const line = lines.find((l) => l.startsWith(`${te.id},`))!.split(',');
    line[hdr.indexOf('Jersey')] = '55';
    const guard = hdr.map((h) => ({ 'Team': d0.teams[3].school, 'First Name': 'New', 'Last Name': 'Guard', 'Position': 'LG', 'Jersey': '8' } as Record<string, string>)[h] ?? '');
    const fix = readPlayersCsv(d0, [lines[0], line.join(','), guard.join(',')].join('\n'));
    assert.equal(fix.problems.length, 0, fix.problems.join(' '));
    assert.equal(fix.warnings.length, 2, fix.warnings.join(' | '));
    const to = fix.edits.get(te.id)?.jersey ?? te.jersey;
    assert.ok(to !== 55 && Num.numberAllowed('TE', to));
    assert.ok(to === te.jersey || !d0.players.some((q) => q.status === 'active' && q.team === 3 && q.id !== te.id && Num.sideOf(q.pos) === 'O' && q.jersey === to));
    assert.ok(fix.adds[0].jersey >= 50 && fix.adds[0].jersey <= 79 && fix.adds[0].jersey % 10 === 8);
  }
  ok(`ratings: steps and progress, ${Math.round((between / grown.length) * 100)}% of returning players between steps after an offseason; editing and the players CSV (${lines.length - 1} rows)`);
}

// ---- the lineup editor
{
  // A team whose HBs, FB and first TE play their own positions, and the HB3 too.
  const pos = (t: number, slot: number, bench = false) => d0.players[(bench ? d0.seasons[0].bench![t][slot] : d0.seasons[0].slots[t][slot])! - 1]?.pos;
  const T = d0.teams.findIndex((_, t) => pos(t, 1) === 'HB' && pos(t, 2) === 'HB' && pos(t, 1, true) === 'HB' && pos(t, 3) === 'FB' && pos(t, 13) === 'TE');
  assert.ok(T >= 0);
  const L = { ...d0, userTeams: [T] };
  const labels = SPOTS.map(spotLabel);
  assert.equal(new Set(labels).size, 64);
  for (const x of ['QB2', 'HB3', 'HB4', 'FB2', 'SE2', 'WR5', 'WR6', 'TE3', 'LT2', 'DT3', 'LOLB2', 'MLB4', 'CB5', 'CB8', 'SS2', 'FS3', 'FS4', 'K2', 'P2']) assert.ok(labels.includes(x), x);
  assert.equal(backupLabel(1), 'HB3');
  const s = L.seasons[0];
  const at = (dd: typeof L, spot: number) => (spot >= 32 ? dd.seasons[0].bench![T][spot - 32] : dd.seasons[0].slots[T][spot]);
  // HB1 and HB2 swap, keeping their ratings.
  const hb1 = s.slots[T][1]!, hb2 = s.slots[T][2]!;
  const a1 = moveToSpot(L, T, hb2, 1);
  assert.equal(at(a1, 1), hb2); assert.equal(at(a1, 2), hb1);
  assert.deepEqual(a1.seasons[0].bw![T][1]!.steps, s.bw![T][2]!.steps);
  assert.equal(a1.seasons[0].bw![T][1]!.label, 'HB1');
  assert.equal(a1.seasons[0].lineupEdited, true);
  // A backup moves up: HB3 to HB2, the HB2 to HB3.
  const hb3 = s.bench![T][1]!;
  const a2 = moveToSpot(a1, T, hb3, 2);
  assert.equal(at(a2, 2), hb3); assert.equal(at(a2, 33), hb1);
  assert.deepEqual(a2.seasons[0].bw![T][2]!.steps, s.benchBw![T][1]!.steps);
  // Other teams are untouched.
  const o = T === 0 ? 1 : 0;
  assert.deepEqual(a2.seasons[0].slots[o], s.slots[o]); assert.deepEqual(a2.seasons[0].bw![o], s.bw![o]);
  // FB to HB1: a position change, rated again for the HB slot; the HB1 goes to FB.
  const fb = s.slots[T][3]!;
  const a3 = moveToSpot(a2, T, fb, 1);
  assert.equal(at(a3, 1), fb); assert.equal(at(a3, 3), hb2);
  assert.equal(a3.players[fb - 1].pos, 'HB'); assert.deepEqual(a3.players[fb - 1].posChange, { year: s.year, from: 'FB' });
  assert.equal(a3.players[hb2 - 1].pos, 'FB');
  assert.equal(a3.seasons[0].bw![T][1]!.group, 'RB');
  // He can still move around the HBs (and back to FB), but not on to TE this season.
  const fbNow = a3.players[fb - 1];
  const ok3 = spotsFor(a3, T, fbNow).map(spotLabel);
  assert.ok(ok3.includes('HB2') && ok3.includes('HB4') && ok3.includes('FB') && !ok3.includes('TE1'), ok3.join(' '));
  const a4 = moveToSpot(a3, T, fb, 2);
  assert.equal(a4.players[fb - 1].pos, 'HB');
  // A TE can't go straight to HB; a QB has nowhere else to go.
  const te = s.slots[T][13]!;
  assert.ok(!spotsFor(L, T, L.players[te - 1]).map(spotLabel).includes('HB1'));
  assert.throws(() => moveToSpot(L, T, te, 1), /can't play HB1/);
  assert.deepEqual(spotsFor(L, T, L.players[s.slots[T][0]! - 1]).map(spotLabel), ['QB', 'QB2']);
  // No CB to S, no DE to DT.
  assert.ok(!spotsFor(L, T, L.players[s.slots[T][24]! - 1]).map(spotLabel).some((x) => /^(SS|FS)/.test(x)));
  assert.ok(!spotsFor(L, T, L.players[s.slots[T][16]! - 1]).map(spotLabel).some((x) => /^DT/.test(x)));
  // Only your teams, and not once the season's results are in.
  assert.ok(lineupLock(d0, T));
  assert.throws(() => moveToSpot(d0, T, hb2, 1));
  const played = importSave(L, srm).dynasty;
  assert.match(lineupLock(played, T) ?? '', /set for this season/);
  // The ROM gets the new lineup.
  const romE = Off.seasonRom(a4, a4.seasons[0], rom);
  for (const def of teamLayout(stockRosters, T)) {
    const b = a4.seasons[0].bw![T][def.slot]!;
    assert.deepEqual(b.attrs.map((x) => getRating(areaRecord(romE, T, def.slot), def, x)), b.steps);
  }
  const ovrE = u32at(romE, DYN_AREA + 0x18);
  assert.deepEqual({ off: romE[ovrE + 4 + 2 * T], def: romE[ovrE + 5 + 2 * T] }, a4.seasons[0].teamOvr![T]);
  ok(`lineup editor: 64 spots (${labels.slice(32, 36).join(', ')} …), swaps, position changes once a season, locks, ROM`);
}

// ---- the dynasty area and the save's mark
assert.ok(hasDynastyHooks(rom) && dynastyAreaProblem(rom) === null);
{
  const id = dynastyRomId(d0.id);
  assert.ok(importSave(d0, stampSave(rawSrm, id, 1, 1)).warning === undefined);
  assert.match(importSave(d0, rawSrm).warning ?? '', /plain 2026 ROM/, 'the first season takes a save from the plain ROM, with a warning');
  assert.throws(() => importSave(g4, rawSrm), /wasn't started with a ROM from this app/, 'later seasons need the app\'s ROM');
  assert.throws(() => importSave(d0, stampSave(rawSrm, id ^ 1, 1, 1)), /another dynasty/);
  assert.throws(() => importSave(d0, stampSave(rawSrm, id, 2, 1)), /another season's ROM, and the dynasty is in 2026/);
  assert.match(importSave({ ...d0, seasons: [{ ...d0.seasons[0], rosterVersion: 2 }] }, srm).warning ?? '', /earlier 2026 ROM/);
  // H-037 (save layout 2): the last-played ID decides. Started on version 1 and played on 2: no warning when 2 is
  // the newest; played last on 1 while 3 is the newest: a warning that names version 1.
  if (layoutOfSig(srm[editionOfSig(srm[1]) ? 1 : 0]) === 2) {
    const lastPlayed = (file: Uint8Array, version: number) => {
      const f = file.slice(), win = editionOfSig(f[1]) !== null;
      const b = [0x44, 0x59, 0x4e, 0x31, id >>> 24, (id >>> 16) & 255, (id >>> 8) & 255, id & 255, 0, 1, version >> 8, version & 255, 0, 0, 0, 1];
      b.forEach((x, k) => { f[win ? 0xe01 + 2 * (0x1360 + k) : 0x700 + 0x1360 + k] = x; });
      return f;
    };
    const v2 = { ...d0, seasons: [{ ...d0.seasons[0], rosterVersion: 2 }] };
    assert.equal(importSave(v2, lastPlayed(srm, 2)).warning, undefined);
    const v3 = { ...d0, seasons: [{ ...d0.seasons[0], rosterVersion: 3 }] };
    assert.match(importSave(v3, lastPlayed(srm, 1)).warning ?? '', /last played on version 1 .*newest is 3/);
  }
  ok('save marks: this dynasty and season import, unmarked and other saves are refused, an older roster version warns (layout 2: by the last-played ID)');
}
{
  const out = Off.seasonRom(d0, d0.seasons[0], rom, 1_800_000_000_000);
  assert.ok(dynastyHeaderValid(out) && isRomOwn(out));
  assert.deepEqual(readStamp(out.subarray(DYN_AREA, DYN_AREA + 16)), { dynasty: dynastyRomId('test'), season: 1, rosterVersion: 1, time: 1_800_000_000 });
  const ovrT = u32at(out, DYN_AREA + 0x18), sims = u32at(out, DYN_AREA + 0x1c);
  assert.deepEqual([...out.subarray(ovrT, ovrT + 4)], [0x4f, 0x56, 0x52, 0x31]);
  for (let t = 0; t < 138; t++) {
    const r = readRating(rom, t);
    assert.deepEqual([out[ovrT + 4 + 2 * t], out[ovrT + 5 + 2 * t]], [r.off, r.def]);
    assert.deepEqual([(out[sims + 4 * t] << 8) | out[sims + 4 * t + 1], (out[sims + 4 * t + 2] << 8) | out[sims + 4 * t + 3]], [simFromOvr(r.off), simFromOvr(r.def)]);
  }
  // The names set (Team Rosters' names view, v2.0.1-test9 on): class, first and last name per slot.
  const nam = u32at(out, DYN_AREA + 0x20);
  assert.deepEqual([...out.subarray(nam, nam + 4)], [0x4e, 0x41, 0x4d, 0x31]);
  const readNames = (t: number) => {
    let a = u32at(out, nam + 8 + 4 * t);
    const recs: [number, string, string][] = [];
    const str = () => { let x = ''; while (out[a]) x += String.fromCharCode(out[a++]); a++; return x; };
    for (let k = 0; k < 32; k++) { const c = out[a++]; recs.push([c, str(), str()]); }
    return recs;
  };
  for (const t of [0, 77, 137]) {
    readNames(t).forEach(([c, f, l], slot) => {
      const id = d0.seasons[0].slots[t][slot];
      if (!id) return;
      const p = d0.players[id - 1];
      assert.deepEqual([c, f, l], [CLASSES.indexOf(p.cls), gameText(p.first, 23), gameText(p.last, 23)], `team ${t} slot ${slot}`);
    });
  }
  assert.equal(gameText('José Núñez-O’Brien Jr.', 23), 'Jose Nunez-OBrien Jr.');
  // A lineup change: a new roster version and the new records; written again over the last export.
  const T = d0.teams.findIndex((_, t) => d0.players[d0.seasons[0].slots[t][2]! - 1].pos === 'HB' && d0.players[d0.seasons[0].slots[t][1]! - 1].pos === 'HB');
  const L8 = moveToSpot({ ...d0, userTeams: [T] }, T, d0.seasons[0].slots[T][2]!, 1);
  const out2 = Off.seasonRom(L8, L8.seasons[0], out, 1_800_000_100_000);
  assert.equal(readStamp(out2.subarray(DYN_AREA, DYN_AREA + 16))!.rosterVersion, 2);
  const o = stockRosters.teams[T].rosterOffset;
  assert.deepEqual([...out2.subarray(u32at(out2, DYN_AREA + 0x14) + 128 * T + 4, u32at(out2, DYN_AREA + 0x14) + 128 * T + 8)], [...rom.subarray(o + 8, o + 12)]); // HB2's record now at HB1
  // Something else in the area, or a ROM without the dynasty support: refused.
  const busy = rom.slice(); busy[DYN_END - 16] = 0;
  assert.throws(() => Off.seasonRom(d0, d0.seasons[0], busy), /isn't free/);
  const noHooks = rom.slice(); noHooks[0x2b0000] = 0xff;
  assert.throws(() => createDynasty(noHooks, csv, { name: 'x', seed: 1 }), /dynasty support/);
  assert.throws(() => Off.seasonRom(d0, d0.seasons[0], noHooks), /dynasty support/);
  const t8 = rom.slice(); t8.fill(0xff, 0x2c0000, 0x2c0004); // no names table: a test8 ROM
  assert.throws(() => createDynasty(t8, csv, { name: 'x', seed: 1 }), /test9/);
  ok('dynasty area: header, ID block, season rosters, OVRs, sim words and names; 2026 data untouched; lineup changes; busy area and older ROMs refused');
}

// Uniforms (kit.ts; user, 2026-11-18: "full uniform editing", "all teams's unis editable"): the ROM's at the start, any
// team any time, written into season ROMs over the ROM's table; mid-season a change asks for the ROM again without a
// new roster version; the first season gets the user's ROM with only the uniform table changed.
if (hasKits(rom)) {
  const k0 = createDynasty(rom, csv, { name: 'My Dynasty!', seed: 5, userTeams: [0] });
  const romKits = readKits(rom);
  const romFlags = romKits.map((k) => k.whiteHome);
  assert.deepEqual(k0.whiteHome, romFlags);
  assert.deepEqual(k0.romUniforms?.kits, romKits);
  assert.equal(whiteHomeLock(k0, 1), null, 'any team');
  const k1 = setWhiteHome(k0, 1, !romFlags[1]);
  const helmet = [0x0eee, 0x0ccc, 0x0222];
  const k2 = setKit(k1, 3, { ...kitOf(k1, 3)!, helmets: [...romKits[3].helmets, helmet] });
  assert.equal(Object.keys(k2.kitEdits ?? {}).length, 1);
  assert.equal(k2.seasons[0].kitsEdited, true, 'the first season is played on the user\'s own ROM: it needs the change');
  assert.equal(k2.seasons[0].rosterVersion ?? 1, 1, 'uniforms are no new roster version');
  for (const out of [Off.seasonRom(k2, k2.seasons[0], rom), Off.uniformRom(k2, rom)]) {
    const after = readKits(out);
    assert.equal(after[1].whiteHome, !romFlags[1]);
    assert.deepEqual(after[3].helmets.at(-1), helmet);
    assert.deepEqual(after.map((k, t) => (t === 1 || t === 3 ? null : k)), romKits.map((k, t) => (t === 1 || t === 3 ? null : k)), 'other teams kept');
  }
  // The first season's ROM: the user's ROM with only the uniform table (and the checksums) changed.
  const u = Off.uniformRom(k2, rom);
  const diff = [...u].flatMap((x, i) => (x === rom[i] || (i >= ktabOf(rom).at && i < ktabOf(rom).at + ktabOf(rom).size) ? [] : [i]));
  assert.ok(diff.every((i) => i < 0x200 || (i >= 0x1e6400 && i < 0x1e6440)), `only the uniforms and checksums change: ${diff.slice(0, 5).map((i) => i.toString(16))}`);
  // A team's own uniform (behind a warning in the editor): written into season ROMs; back to the ROM's drops it.
  const own = ownOf(k2, 5)!;
  const o2 = setOwn(k2, 5, { home: own.home.map((c, i) => (i === 11 ? 0x0e00 : c)), away: own.away });
  assert.equal(ownUniforms(Off.seasonRom(o2, o2.seasons[0], rom), 5).home[11], 0x0e00);
  assert.equal(ownUniforms(Off.uniformRom(o2, rom), 5).home[11], 0x0e00);
  assert.equal(setOwn(o2, 5, own).ownEdits, undefined);
  assert.ok(k0.romUniforms?.sprite, 'the editor\'s player sprite is kept');
  // Back to the ROM's uniforms drops the edit.
  assert.equal(setKit(k2, 3, romKits[3]).kitEdits, undefined);
  // Too many extras are refused.
  assert.throws(() => setKit(k2, 3, { ...romKits[3], helmets: Array(8).fill(helmet) }), /at most 7/);
  // Mid-season (a later season's ROM downloaded, games played): allowed, asks for the ROM again, same roster version.
  const mid = { ...k0, seasons: [{ ...k0.seasons[0], index: 1, romDownloaded: true, rosterVersion: 2, imports: [{ played: 5 } as never] }] };
  const m2 = setWhiteHome(mid, 0, !romFlags[0]);
  assert.equal(m2.seasons[0].kitsEdited, true);
  assert.equal(m2.seasons[0].rosterVersion, 2);
  assert.equal(setWhiteHome({ ...mid, offseason: {} as never }, 0, !romFlags[0]).seasons[0].kitsEdited, undefined, 'the offseason: into the next season\'s ROM');
  // File names: the dynasty, the year and the season's ID.
  assert.equal(Off.seasonRomName(k0, { ...k0.seasons[0], romId: 'fxh834' }), `my_dynasty-${k0.seasons[0].year}-fxh834.md`);
  assert.match(Off.newRomId(), /^[a-z2-9]{6}$/);
  ok('uniforms: the ROM\'s at the start, any team any time, into season ROMs over the ROM\'s table, first season = own ROM + uniforms only, mid-season asks for the ROM again (same roster version), file names with the season ID');
}

// Weight gain (user, 2026-11-13): everyone but kickers puts on a few pounds each offseason, more with a bigger Strength program.
{
  const even = { strength: 25, speed: 25, technique: 25, knowledge: 25 }, heavy = { strength: 40, speed: 20, technique: 20, knowledge: 20 }, none = { strength: 0, speed: 40, technique: 30, knowledge: 30 };
  assert.equal(weightGain(RD, 'OL', 300, even, 1), 6);
  assert.equal(weightGain(RD, 'OL', 300, heavy, 1), 9);
  assert.equal(weightGain(RD, 'OL', 300, none, 1), 3);
  assert.equal(weightGain(RD, 'HB', 200, even, 1), 4);
  assert.equal(weightGain(RD, 'HB', 200, heavy, 1), 6);
  assert.equal(weightGain(RD, 'K', 200, heavy, 1), 0);
  assert.equal(weightGain(RD, 'OL', 300, even, 0), 0);
  const d0 = createDynasty(rom, csv, { name: 'w', seed: 9, userTeams: [] });
  const some = d0.players.filter((p) => p.team === 0 && !['K', 'P'].includes(p.pos)).slice(0, 30);
  const total = (t: typeof even, gain: number) => some.reduce((s, p, i) => s + (Off.develop(p, gain, rng(100 + i), RD, t).weight - p.weight), 0);
  assert.ok(total(heavy, 3) > total(even, 3) && total(even, 3) > total(none, 3), 'more Strength program, more pounds');
  assert.ok(total(even, 0) > 0, 'a player whose ratings stay put still gains weight');
  for (const p of some) { const q = Off.develop(p, 3, rng(7), RD, heavy); assert.ok(q.weight - p.weight >= 0 && q.weight - p.weight <= Math.round(p.weight * 0.03)); assert.equal((q.ratings.Weight ?? 0) - (p.ratings.Weight ?? 0), Math.min(380, (p.ratings.Weight ?? 0) + q.weight - p.weight) - (p.ratings.Weight ?? 0)); }
  ok('weight gain: a share of his weight, every position but K and P, scaled by the Strength program');
}

// The season sim settings (H-016): kept with the dynasty and written into its season ROMs; the defaults leave the ROM's own.
{
  const S = { weight: 12, chances: 9, roll: 1300 } as const;
  const plain = Off.seasonRom(d0, d0.seasons[0], rom);
  const withSim = Off.seasonRom(setSim(d0, S), d0.seasons[0], rom);
  if (readSimSettings(rom)) {
    assert.deepEqual(readSimSettings(plain), readSimSettings(rom));
    assert.deepEqual(readSimSettings(withSim), simForRom(rom, S));
    assert.equal(setSim(setSim(d0, S), SIM_DEFAULTS).sim, undefined, 'the defaults clear it');
    assert.throws(() => setSim(d0, { ...S, roll: 100 }), /must be/);
    assert.throws(() => setSim(d0, { ...S, roll: 900 }), /with 9 scoring chances/, 'H-018: 9 chances need 1300 or more');
    const older = { ...d0, sim: { weight: 12, chances: 9, roll: 900 } as SimSettings }; // saved before H-018
    assert.equal(simOf(older).roll, 1300);
    assert.equal(readSimSettings(Off.seasonRom(older, d0.seasons[0], rom))!.roll, 1300, 'an older dynasty\'s roll range is moved into range');
    ok('season sim: the dynasty\'s settings go into its season ROMs; the defaults leave the ROM\'s own');
  } else {
    assert.deepEqual(withSim.subarray(0x06f100, 0x06f130), plain.subarray(0x06f100, 0x06f130));
    ok('season sim: this ROM has no sim settings (before test33); a dynasty\'s settings are left out');
  }
}

// The sim stat multipliers (H-021): kept with the dynasty and written into its season ROMs; the defaults leave the ROM's own.
{
  const S = { passing: 150, rushing: 150, interceptions: 100, sacks: 80, tackles: 150 };
  const plain = Off.seasonRom(d0, d0.seasons[0], rom);
  const withStats = Off.seasonRom(setStats(d0, S), d0.seasons[0], rom);
  if (readSimStats(rom)) {
    assert.deepEqual(readSimStats(plain), readSimStats(rom));
    assert.deepEqual(readSimStats(withStats), S);
    assert.equal(setStats(setStats(d0, S), STATS_DEFAULTS).simStats, undefined, 'the defaults clear them');
    assert.throws(() => setStats(d0, { ...S, sacks: 20 }), /must be/);
    const older = { ...d0, simStats: { ...S, tdMatch: false } as typeof S }; // saved before test40 / test43
    const w = Off.seasonRom(older, d0.seasons[0], rom);
    assert.deepEqual([...w.subarray(0x2d640e, 0x2d6410)], [...rom.subarray(0x2d640e, 0x2d6410)], 'an older tdMatch is never written');
    ok('sim stats: the dynasty\'s multipliers go into its season ROMs; the defaults leave the ROM\'s own');
  } else {
    assert.deepEqual(withStats.subarray(0x2d6400, 0x2d6410), plain.subarray(0x2d6400, 0x2d6410));
    ok('sim stats: this ROM has no multipliers (before test39); a dynasty\'s are left out');
  }
}

{
  // Season ROM file names (user, 2026-11-23): the base ROM's name first; a season downloaded keeps its name.
  const base = 'Bill Walsh College Football 95 (USA) [Elevated 2026 Season v2.2.0-rc.3]';
  assert.equal(Off.romStem(`${base}.zip`), base);
  assert.equal(Off.romStem(`C:\\roms\\${base} (1).md`), base);
  const s0 = { year: 2026 } as any;
  const dn = { name: 'NDSU Dynasty', romFile: base } as any;
  assert.equal(Off.seasonRomName(dn, { ...s0, romId: 'eqqavz', romFile: base }), `${base} ndsu_dynasty-2026-eqqavz.md`);
  assert.equal(Off.seasonRomName(dn, s0), `${base} ndsu_dynasty-2026-xxxxxx.md`);
  assert.equal(Off.seasonRomName(dn, { ...s0, romId: 'eqqavz' }), 'ndsu_dynasty-2026-eqqavz.md');
  ok('season ROM names: the base ROM first, a downloaded season keeps its name');
}

console.log(`\n${passed} passed`);
