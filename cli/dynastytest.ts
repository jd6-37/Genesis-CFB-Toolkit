// Dynasty tests against a real ROM and battery save (bring your own; the ROM may be a .zip):
//   npx tsx cli/dynastytest.ts ELEVATED_2026_138 SAVE.srm
// The ROM is the 138-team 2026 Season Edition (Elevated v2.0.0 or later). The save is a Genesis Plus GX
// (RetroArch) .srm of that ROM with a season started and at least one week played.
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
import { randomBench } from '../src/core/dynasty/bench';
import { nextPrestige, tierOfRank } from '../src/core/dynasty/prestige';
import { openRosterRom, readPlayer, getRating, teamLayout } from '../src/core/rosterRom';

const [romPath, savePath] = process.argv.slice(2);
if (!romPath || !savePath) {
  console.error('usage: tsx cli/dynastytest.ts ELEVATED_2026_138 SAVE.srm');
  process.exit(2);
}
const rom = (await openRom(basename(romPath), new Uint8Array(readFileSync(romPath)))).data;
const srm = new Uint8Array(readFileSync(savePath));
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
assert.equal(d0.attrKeys[0], 'Speed');
assert.ok(d0.players.every((p) => p.attrs.length === d0.attrKeys.length && CLASSES.includes(p.cls) && p.skin >= 0 && p.skin < 5));
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
first.slots.forEach((sl, t) => sl.forEach((id, slot) => {
  if (id === null) return;
  const o = playerOvr(slot, first.bw![t][slot]!);
  assert.ok(o >= 0 && o <= 99);
  const role = roleOfSlot(slot);
  misses.set(role, [...(misses.get(role) ?? []), Math.abs(o - d0.players[id - 1].ovr)]);
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
assert.deepEqual([1, 10, 11, 20, 21, 35, 36, 70, 71, 100, 101].map(tierOfRank), [6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1]);
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
const o2 = Off.runPortal(o1);
const moves = o2.offseason!.events.filter((e) => e.kind === 'transfer');
assert.equal(moves.length, 0, 'nobody transfers after one season on the bench');
for (const m of moves) if (m.kind === 'transfer') assert.equal(o2.players[m.player - 1].team, m.to);
const tpl = Off.recruitTemplates(o2, csv);
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
const o4 = Off.applyCuts(o3, {}, tpl);
for (const t of o4.teams) {
  const roster = act(o4).filter((p) => p.team === t.index);
  assert.ok(roster.length >= Off.ROSTER_MIN && roster.length <= Off.ROSTER_LIMIT, `${t.school} has ${roster.length}`);
  for (const pos of Off.POSITIONS) assert.ok(roster.filter((p) => p.pos === pos).length >= Off.POS_MIN[pos], `${t.school} ${pos}`);
}
const o5 = Off.finishOffseason(o4, rom);
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
const f1 = Rec.openRecruiting(o1, tpl);
const rs0 = f1.offseason!.recruiting!;
assert.equal(f1.offseason!.step, 'recruiting');
assert.ok(rs0.prospects.some((p) => p.id < 0) && !rs0.prospects.some((p) => p.id > 0), 'high-school prospects; no portal players after one season');
const targets = rs0.prospects.filter((p) => p.id < 0 && p.stars <= 3).slice(0, 10);
const plan = { points: Object.fromEntries(targets.map((p) => [p.id, 60])), offers: targets.map((p) => p.id) };
assert.deepEqual(Rec.planProblems(plan), []);
assert.ok(Rec.planProblems({ points: { [targets[0].id]: 61 }, offers: [] }).length > 0, 'at most 60 a prospect');
assert.ok(Rec.planProblems({ points: Object.fromEntries(rs0.prospects.slice(0, 20).map((p) => [p.id, 60])), offers: [] }).length > 0, 'at most 1,000 a week');
let f2 = f1;
for (let w = 0; w < Rec.WEEKS; w++) f2 = Rec.recruitingWeek(f2, { [user]: w === 0 ? plan : { points: plan.points, offers: [] } });
assert.throws(() => Rec.recruitingWeek(f2, {}), /signing day/);
const rsEnd = f2.offseason!.recruiting!;
for (const t of f2.teams) assert.ok(rsEnd.prospects.filter((p) => p.committed === t.index).length <= rsEnd.spots[t.index]);
const f3 = Rec.finishRecruiting(f2, tpl);
const fSigned = f3.offseason!.events.filter((e) => e.kind === 'signed');
for (const t of f3.teams) assert.ok(fSigned.filter((e) => e.kind === 'signed' && e.team === t.index).length <= rsEnd.spots[t.index]);
assert.ok(f3.players.filter((p) => rsEnd.prospects.some((q) => q.id === p.id)).every((p) => p.status === 'transferred' ? p.team === null : p.team !== null), 'portal players moved or left');
const f5 = Off.finishOffseason(Off.applyCuts(f3, {}, tpl), rom);
assert.equal(f5.seasons[1].slots.flat().filter((x) => x !== null).length, 138 * 32);
ok(`full recruiting: ${rs0.prospects.length} prospects, ${rsEnd.prospects.filter((p) => p.committed !== null).length} committed in ${Rec.WEEKS} weeks, ${fSigned.length} signed; ${user === undefined ? '' : `${f3.teams[user].school} landed ${targets.filter((t) => rsEnd.prospects.find((p) => p.id === t.id)!.committed === user).length} of its 10 targets`}`);

// A second offseason: only players with two seasons on the bench may transfer.
const y1 = Off.runPortal(Off.startOffseason(o5, { seed: 4, force: true }));
const benched = Off.benchSeasons(o5);
const y1moves = y1.offseason!.events.filter((e) => e.kind === 'transfer');
assert.ok(y1moves.length > 0);
assert.ok(y1moves.every((e) => e.kind === 'transfer' && (benched.get(e.player) ?? 0) >= 2 && !next.slots.some((sl) => sl.includes(e.player))));
ok(`second offseason: ${y1moves.length} transfers, all after two seasons on the bench`);

// A random bench for the first season: the 32 stay (the ROM is unchanged), every slot gets a backup.
const rb = randomBench(d0, rom, tpl, 5);
assert.ok(Off.seasonRom(rb, rb.seasons[0], rom).every((b, i) => b === rom[i]));
assert.equal(rb.seasons[0].bench!.flat().filter((x) => x !== null).length, 138 * 32);
assert.deepEqual(rb.seasons[0].slots.map((sl) => sl.map((id) => (id ? rb.players[id - 1].srcId : null))), first.slots.map((sl) => sl.map((id) => (id ? d0.players[id - 1].srcId : null))));
assert.throws(() => randomBench(o5, rom, tpl), /first season/);
ok('random bench for the first season');

// The season's rosters in the ROM: the first season gives the ROM back unchanged; the next one reads back.
assert.ok(Off.seasonRom(d0, first, rom).every((b, i) => b === rom[i]), 'season 1 written = the ROM');
const rom2 = Off.seasonRom(o5, next, rom);
const rr = openRosterRom(rom2);
for (let t = 0; t < 138; t++) {
  for (const def of teamLayout(rr, t)) {
    const b = next.bw![t][def.slot]!;
    const pl = readPlayer(rr, t, def.slot);
    assert.deepEqual(b.attrs.map((a) => getRating(pl, def, a)), b.steps);
  }
  assert.deepEqual(readRating(rom2, t), next.teamOvr![t]);
}
ok('season rosters written to the ROM and read back');
// The new season doesn't take last season's save.
assert.throws(() => importSave(o5, srm), /2026 season's save/);
ok('a new season refuses the last season\'s save');

console.log(`\n${passed} passed`);
