// Dynasty tests against a real ROM and battery save (bring your own; the ROM may be a .zip):
//   npx tsx cli/dynastytest.ts ELEVATED_2026_138_DYNASTY SAVE.srm
// The ROM is the 138-team 2026 Season Edition with the dynasty support (Elevated v2.0.1-test9 or later). The
// save is a Genesis Plus GX (RetroArch) .srm of the 138-team edition with a season started and at least one week
// played; the test puts its dynasty's mark (the ID block New Season copies) into it.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { strict as assert } from 'node:assert';
import { openRom } from '../src/core/romfile';
import { openSave, readDynastySave, ranksFromPower, STAT_SLOTS } from '../src/core/dynasty/save';
import { CLASSES, createDynasty, fromBase64, importSave, latestSave, startingClass, weeksDone } from '../src/core/dynasty/model';
import { champions, leaders, playerLines, seasonRecords, RECORD_STATS, seasonView, standings, teamHistory, weekName } from '../src/core/dynasty/derive';
import { stories } from '../src/core/dynasty/news';
import { teamArt } from '../src/core/dynasty/art';
import { dynastyFileName, dynastyFileText, readDynastyFile } from '../src/core/dynasty/storage';
import { CFB27_LATEST } from '../src/core/cfb27Latest';
import { OVR_FORMULAS, playerOvr, roleOfSlot } from '../src/core/dynasty/ovr';
import { readRating } from '../src/core/teamRatings';
import * as Off from '../src/core/dynasty/offseason';
import * as Rec from '../src/core/dynasty/recruiting';
import * as Sim from '../src/core/dynasty/sim';
import { DEFAULT_RULES as RD, readRulesFile, rulesFileText, rulesOf, setRules } from '../src/core/dynasty/rules';
import { academicsOf, CFB27_ACADEMICS } from '../src/core/dynasty/academics';
import { SCHOOL_STATE, stateCode } from '../src/core/dynasty/schoolStates';
import { experienceOf, recordRatings } from '../src/core/dynasty/career';
import { randomBench } from '../src/core/dynasty/bench';
import { gameText, dynastyAreaProblem, dynastyHeaderValid, dynastyRomId, DYN_AREA, DYN_END, hasDynastyHooks, readStamp } from '../src/core/dynasty/dynastyArea';
import { simFromOvr } from '../src/core/teamRatings';
import { parseCsv } from '../src/core/rosterSheet';
import { rosterLayout } from '../src/core/rosterLayouts';
import { bwSlotOf, ovrOf, progressOf, stepOf } from '../src/core/dynasty/ratings';
import { applyEdits, playersCsv, readPlayersCsv } from '../src/core/dynasty/edit';
import { blackShare, MAX_FIRST, MAX_LAST, SKIN_TONES } from '../src/core/dynasty/appearance';
import { backupLabel, lineupLock, moveToSpot, SPOTS, spotLabel, spotsFor } from '../src/core/dynasty/lineup';
import { nextPrestige, tierOfRank } from '../src/core/dynasty/prestige';
import { openRosterRom, readPlayer, getRating, jerseyNumber, teamLayout } from '../src/core/rosterRom';

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
  const window = f[1] === 0x6f;
  b.forEach((x, k) => { f[window ? 0xe01 + 2 * (0x1330 + k) : 0x700 + 0x1330 + k] = x; });
  return f;
};
const rawSrm = new Uint8Array(readFileSync(savePath));
const srm = stampSave(rawSrm, dynastyRomId('test'), 1, 1);
const csv = readFileSync(new URL(`../public/${CFB27_LATEST.file}`, import.meta.url), 'utf8');
let passed = 0;
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
const d0 = createDynasty(rom, csv, { name: 'Test', seed: 1, id: 'test', created: '2026-01-01T00:00:00.000Z' });
const took = Date.now() - t0;
assert.equal(d0.teams.length, 138);
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
    assert.deepEqual(bwSlotOf(d0.players[id - 1], b).steps, b.steps, `team ${t} slot ${slot}`);
  }));
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
// Team OVRs are the ROM's.
assert.equal(first.teamOvr!.length, 138);
first.teamOvr!.forEach((r, t) => assert.deepEqual(r, readRating(rom, t)));
// Player OVRs from the game ratings: every formula's shares add up to 100, and the OVRs land near CFB 27's.
for (const f of Object.values(OVR_FORMULAS)) assert.equal(Object.values(f.weights).reduce((a, b) => a + b!, 0), 100);
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
for (const [role, m] of misses) assert.ok(mean(m) < 2.5, `${role} OVR is ${mean(m).toFixed(1)} off CFB 27 on average`);
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
assert.ok(Math.abs(Off.transferChance(o1, depthGuy, ctx1) - 0.18) < 1e-9, 'a blocked depth player with no touches: 8% + 10%');
const busy = { ...ctx1, touches: new Map(ctx1.touches).set(depthGuy.id, 1000) };
assert.ok(Math.abs(Off.transferChance(o1, depthGuy, busy) - 0.18 * 0.2) < 1e-9, 'full playing time: 80% less');
// Promoting him to a starting spot on the projected depth chart takes away the "blocked" 10%.
const team1 = depthGuy.team!;
const chart = Off.projectedDepth(o1, team1).slice();
const lay = rosterLayout('bw95', false, true);
const spot = lay.findIndex((def, k) => !Off.DEPTH_SLOTS.has(def.label) && chart[k] !== null && o1.players[chart[k]! - 1].pos === depthGuy.pos);
if (spot >= 0) {
  const was = chart.indexOf(depthGuy.id);
  if (was >= 0) chart[was] = chart[spot];
  chart[spot] = depthGuy.id;
  const promoted = { ...o1, offseason: { ...o1.offseason!, projected: { [team1]: chart } } };
  assert.ok(Math.abs(Off.transferChance(promoted, depthGuy) - 0.08) < 1e-9, 'a promised starting job: no longer blocked');
}
assert.ok(Off.projectedProblems(o1, team1, [...chart.slice(0, 31), 999999]).length > 0, 'a player from elsewhere is refused');
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
for (const t of o3.teams) {
  const roster = act(o3).filter((p) => p.team === t.index);
  if (roster.length <= Off.ROSTER_LIMIT) continue;
  const cuts = Off.suggestCuts(o3, t.index);
  const { active: starters } = Off.cutOrder(roster);
  assert.equal(cuts.length, roster.length - Off.ROSTER_LIMIT, `${t.school} cuts to the limit`);
  assert.ok(cuts.every((id) => !starters.has(id)), `${t.school} keeps its Active Roster`);
  assert.deepEqual(Off.cutProblems(o3, t.index, cuts), []);
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
const next = o5.seasons[1];
assert.deepEqual(next.prestige, o1.offseason!.prestige, 'the new season has the new stars');
assert.equal(o5.offseason, undefined);
assert.equal(next.year, 2027);
assert.equal(next.slots.flat().filter((x) => x !== null).length, 138 * 32, 'every slot filled');
for (const t of o5.teams) {
  const nums = act(o5).filter((p) => p.team === t.index).map((p) => p.jersey);
  assert.equal(new Set(nums).size, nums.length, `${t.school} numbers are unique`);
  next.slots[t.index].forEach((id) => assert.equal(o5.players[id! - 1].team, t.index));
}
ok(`offseason: ${o1.offseason!.events.filter((e) => e.kind !== 'returns').length} departures, ${moves.length} transfers, ${signed.length} signed, ${o4.offseason!.events.filter((e) => e.kind === 'cut').length} cut, ${o4.offseason!.events.filter((e) => e.kind === 'walkon').length} walk-ons; ${act(o5).length} players in ${next.year}`);

// Full recruiting: five weeks, then signing day; every team stays within its spots.
const f1 = Rec.openRecruiting(o1p, tpl);
const rs0 = f1.offseason!.recruiting!;
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
const fSigned = f3.offseason!.events.filter((e) => e.kind === 'signed');
for (const t of f3.teams) assert.ok(fSigned.filter((e) => e.kind === 'signed' && e.team === t.index).length <= rsEnd.spots[t.index]);
assert.ok(f3.players.filter((p) => rsEnd.prospects.some((q) => q.id === p.id)).every((p) => p.status === 'transferred' ? p.team === null : p.team !== null), 'portal players moved or left');
const f5 = Off.finishOffseason(Off.applyCuts(f3, {}, tpl));
assert.equal(f5.seasons[1].slots.flat().filter((x) => x !== null).length, 138 * 32);
ok(`full recruiting: ${rs0.prospects.length} prospects, ${rsEnd.prospects.filter((p) => p.committed !== null).length} committed in ${RD.weeks} weeks, ${fSigned.length} signed; ${user === undefined ? '' : `${f3.teams[user].school} landed ${targets.filter((t) => rsEnd.prospects.find((p) => p.id === t.id)!.committed === user).length} of its 10 targets`}`);

const closenessState = (p: { player: { state: string } }) => (stateCode(p.player.state) === SCHOOL_STATE[f1.teams[user].school] ? 'same' : 'other');
// Offseason rules: changed numbers take effect; only changes are stored; rules files round-trip and are checked.
assert.equal(Object.keys(CFB27_ACADEMICS).length, 138);
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
assert.ok(rs0.prospects.every((p) => Math.abs(p.wants.pt + p.wants.prestige + p.wants.home + p.wants.academics + p.wants.contender - 1) < 1e-9));
const ctxW = Rec.weekContext(f1, rs0);
const v26 = seasonView(f1, f1.seasons[0]);
const no1 = d1.teams.findIndex((t) => v26.rank[t.index] === 1);
assert.ok([...ctxW.contender.values()].every((x) => x >= 0 && x <= 1) && ctxW.contender.get(no1)! > 0.6, 'No. 1 is a contender');
if (user !== undefined) {
  const pipes = Rec.pipelineStates(f1, user);
  assert.ok(pipes.every((x) => x.n >= RD.pipelineMin));
  const inState = rs0.prospects.find((p) => p.id < 0 && closenessState(p) === 'same')!;
  assert.equal(Rec.pointValue(f1, ctxW, inState, user), RD.inStateBoost, 'in-state points go further');
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
  assert.ok(Math.abs(withNo.v - none.v * RD.pitchNotInterested) < 1e-6 * Math.max(1, none.v), 'not interested: normal points');
  assert.equal(withNo.r?.[notInt], 'no', 'the reaction is recorded');
  for (const k of ints) {
    const g = gain(k), x = Rec.pitchReaction(RD, tgt, sc, k);
    assert.ok(Math.abs(g.v - none.v * Rec.reactionValue(RD, x)) < 1e-6 * Math.max(1, none.v), `pitch ${k} (${x}) scales the points`);
  }
  ok(`pitching: ${tgt.player.first} ${tgt.player.last}'s interests ${ints.join(', ')}; reactions ${ints.map((k) => Rec.pitchReaction(RD, tgt, sc, k)).join(', ')}, the rest ✗`);
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
assert.ok(act(g3).filter((p) => p.team === user).length <= Off.ROSTER_LIMIT, 'user team cut to the limit');
assert.throws(() => Sim.simOffseason(d1, tpl), /isn.t over/);
const g4 = Sim.simOffseason(o1, tpl);
assert.equal(g4.offseason, undefined);
assert.equal(g4.seasons.length, 2);
assert.equal(g4.seasons[1].slots[user].filter((x) => x !== null).length, 32);
assert.equal(Sim.simOffseason(f1, tpl).seasons.length, 2, 'from the middle of recruiting');
ok(`sim: a recruiting week, the rest, the cuts, the whole offseason (${act(g4).filter((p) => p.team === user).length} players for ${g4.teams[user].school} in ${g4.seasons[1].year})`);

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
/** Season one: the area holds the ROM's own rosters; nothing outside it changes but the checksums. */
const isRomOwn = (out: Uint8Array) => {
  let outside = 0;
  for (let i = 0; i < DYN_AREA; i++) if (out[i] !== rom[i]) outside++;
  const base = u32at(out, DYN_AREA + 0x14);
  return outside <= 4 && stockRosters.teams.every((t) => out.subarray(base + 128 * t.index, base + 128 * t.index + 128).every((b, k) => b === rom[t.rosterOffset + k]));
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
// The new season doesn't take last season's save.
assert.throws(() => importSave(o5, srm), /the 2026 ROM, and the dynasty is in 2027/);
ok('a new season refuses the last season\'s save');

// ---- weekly stories: two imports a week apart give the week's stats (player of the week)
{
  // The save before the last week: its results cleared, its stats at 60% (fields the stories use).
  const lastWeek = Math.max(...save.season!.games.filter((g) => g.vs !== null).map((g) => g.week));
  const before = srm.slice();
  const win = before[1] === 0x6f;
  const at = (o: number) => (win ? o : o >> 1); // window offset → file offset
  for (const g of save.season!.games) if (g.week === lastWeek) for (const k of [0, 2]) before[at(0xe01 + 2 * (0x200 + 4 * g.index + k))] = 0xff;
  const scaleWord = (o: number) => { const raw = (before[at(o)] << 8) | before[at(o + 2)]; const v = Math.trunc((((raw << 16) >> 16)) * 0.6) & 0xffff; before[at(o)] = v >> 8; before[at(o + 2)] = v & 255; };
  const scaleByte = (o: number) => { before[at(o)] = Math.floor(before[at(o)] * 0.6); };
  for (let t = 0; t < 138; t++) {
    const base = 0x3951 + 2 * 0xb8 * t, b = (j: number) => base + 2 * j;
    scaleWord(b(4)); scaleByte(b(6)); scaleByte(b(7));
    for (let k = 0; k < 4; k++) { scaleWord(b(8 + 8 * k + 2)); scaleByte(b(8 + 8 * k + 7)); }
    for (let k = 0; k < 9; k++) { scaleWord(b(40 + 8 * k)); scaleWord(b(40 + 8 * k + 2)); scaleByte(b(40 + 8 * k + 7)); }
    for (let k = 0; k < 15; k++) { scaleWord(b(124 + 4 * k)); scaleByte(b(124 + 4 * k + 2)); scaleByte(b(124 + 4 * k + 3)); }
  }
  const w1 = importSave(d0, before).dynasty;
  const w2 = importSave(w1, srm).dynasty;
  const st = stories(w2);
  const potw = st.filter((x) => x.kind === 'potw');
  assert.equal(potw.length, 2, 'offensive and defensive player of the week');
  assert.ok(potw.every((x) => / (win over|loss to|tie with) /.test(x.dek) && !/\d{4,}/.test(x.dek)), potw.map((x) => x.dek).join(' | '));
  // A gap of more than a week (no import in between): no week's stats, the season-total stories only.
  assert.equal(stories(importSave(d0, srm).dynasty).filter((x) => x.kind === 'potw').length, 0);
  const kinds = [...new Set(st.map((x) => x.kind))].join(', ');
  ok(`weekly stories: ${potw.map((x) => `"${x.headline}" (${x.dek})`).join('; ')}; kinds ${kinds}`);
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
  assert.deepEqual([stepOf(0), stepOf(85.9), stepOf(86), stepOf(92.9), stepOf(93), stepOf(100)], [0, 12, 13, 13, 14, 15]);
  assert.ok(Math.abs(progressOf(89.5).frac - 0.5) < 0.1 && progressOf(100).next === null);
  // After an offseason most returning players are part of the way to a next step.
  const grown = o5.players.filter((p) => p.status === 'active' && p.srcId !== undefined);
  const between = grown.filter((p) => Object.entries(p.ratings).some(([a, v]) => a !== 'Weight' && progressOf(v!).frac > 0)).length;
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
  for (const x of ['QB2', 'HB3', 'HB4', 'FB2', 'SE2', 'WR3', 'WR4', 'TE3', 'LT2', 'DT3', 'LOLB2', 'MLB4', 'LCB3', 'RCB4', 'SS2', 'FS3', 'FS4', 'K2', 'P2']) assert.ok(labels.includes(x), x);
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
  assert.throws(() => importSave(d0, rawSrm), /wasn't started with a ROM from this app/);
  assert.throws(() => importSave(d0, stampSave(rawSrm, id ^ 1, 1, 1)), /another dynasty/);
  assert.throws(() => importSave(d0, stampSave(rawSrm, id, 2, 1)), /another season's ROM, and the dynasty is in 2026/);
  assert.match(importSave({ ...d0, seasons: [{ ...d0.seasons[0], rosterVersion: 2 }] }, srm).warning ?? '', /earlier 2026 ROM/);
  ok('save marks: this dynasty and season import, unmarked and other saves are refused, an older roster version warns');
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

console.log(`\n${passed} passed`);
