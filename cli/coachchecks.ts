// Coach checks shared by the Dynasty tests (dynastytest.ts, dynasty94test.ts): a dynasty gets its edition's real
// coaches from public/data/coaches-YEAR.json, every team its head coach, and the coaches never touch the ROM.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CoachData } from '../src/core/dynasty/coachData';
import { COACH_RATINGS, coachOvr, coachRecord, dynastySeasons, headCoachField, withCoaches } from '../src/core/dynasty/coaches';
import type { Dynasty } from '../src/core/dynasty/model';
import { editionOf } from '../src/core/dynasty/edition';
import { autoSpend, finishCarousel, fireCoach, goalResults, goalsFor, hotSeat, openings, placeCoach, setManageXp, spendXp, tenure, xpCost } from '../src/core/dynasty/carousel';
import { rng } from '../src/core/dynasty/model';
import { cancelOffseason, startOffseason } from '../src/core/dynasty/offseason';
import { coachTransfers, developmentBoost, recruitingDiscount, transferFactor } from '../src/core/dynasty/coachEffects';
import { coachFromPlayer } from '../src/core/dynasty/carousel';
import { coachLook, coachLookChoices } from '../src/core/dynasty/coachLook';
import { drawHeadshot, HEAD_SIZE } from '../src/core/dynasty/headshot';
import { offseasonStories } from '../src/core/dynasty/news';

export function coachChecks(d: Dynasty, ok: (name: string) => void, opts: { seasonRom?: (d: Dynasty) => Uint8Array; offseason?: { at: Dynasty; finish: (d: Dynasty) => Dynasty } } = {}) {
  const data = JSON.parse(readFileSync(`public/data/coaches-${editionOf(d).id}.json`, 'utf8')) as CoachData;
  assert.equal(data.year, d.startYear);
  assert.ok(data.seasons.every((s) => s[1] < data.year), 'no real season from the edition\'s year or later (no-spoiler rule)');
  const c = withCoaches(d, data);
  const n = d.teams.length;
  const coaches = c.coaches!;
  assert.equal(coaches.length, data.coaches.length);
  assert.ok(coaches.every((x, i) => x.id === i), 'ids are the list order');
  const heads = coaches.filter((x) => x.team !== null);
  assert.equal(heads.length, n, 'one head coach per team');
  assert.equal(new Set(heads.map((x) => x.team)).size, n);
  assert.ok(c.seasons.every((s) => s.coach?.length === n && s.coach.every((id, t) => id !== null && coaches[id].team === t)), 'every season so far has the team\'s head coach');
  assert.ok(coaches.every((x) => COACH_RATINGS.every((k) => x.ratings[k] >= 30 && x.ratings[k] <= 99) && x.prestige >= 1 && x.prestige <= 5));
  assert.ok(coaches.every((x) => x.born > 1900 && d.startYear - x.born >= 20 && d.startYear - x.born <= 90), 'ages');
  const ovrs = heads.map((x) => coachOvr(x.ratings)).sort((a, b) => a - b);
  assert.ok(ovrs[0] >= 50 && ovrs[n - 1] <= 99 && ovrs[n - 1] - ovrs[0] >= 25, `a spread of OVRs (${ovrs[0]}-${ovrs[n - 1]})`);
  assert.ok(coaches.filter((x) => x.team === null).every((x) => x.status === 'pool' && x.poolNote), 'the rest are in the pool, with a note');
  const best = heads.reduce((a, x) => (coachOvr(x.ratings) > coachOvr(a.ratings) ? x : a));
  const f = headCoachField(c);
  assert.ok(COACH_RATINGS.every((k) => f.rank(best, k) >= 1 && f.rank(best, k) <= n));
  // A real head coach's record is his real seasons until the dynasty plays one (an imported season counts too).
  const r = coachRecord(c, best);
  assert.ok(r.w >= dynastySeasons(c, best.id).reduce((a, s) => a + s.w, 0));
  assert.equal(withCoaches(c, data), c, 'added once');
  if (opts.seasonRom) assert.deepEqual(opts.seasonRom(c), opts.seasonRom(d), 'the coaches don\'t change the season ROM');
  if (opts.offseason) {
    // An offseason in progress gets its coaches, then the next season starts: it has every team's head coach.
    const nx = opts.offseason.finish(withCoaches(opts.offseason.at, data));
    const last = nx.seasons.at(-1)!;
    assert.ok(nx.seasons.length >= 2 && last.coach?.every((id, t) => id !== null && nx.coaches![id].team === t), 'the next season has the head coaches');
  }
  carouselChecks(c, ok);
  ok(`coaches: ${heads.length} head coaches and ${coaches.length - heads.length} in the pool; OVR ${ovrs[0]}-${ovrs[n - 1]} (median ${ovrs[n >> 1]}); best ${best.name} ${coachOvr(best.ratings)}`);
  return c;
}

/** The carousel (part 2): goals, hot seat, XP, the step itself (offers, the user's changes, the hiring), undo. */
function carouselChecks(c: Dynasty, ok: (name: string) => void) {
  const n = c.teams.length;
  const si = c.seasons.length - 1;
  for (let t = 0; t < n; t++) {
    const g = goalsFor(c, si, t);
    assert.ok(g.length >= 2 && g.length <= 3 && g[0].kind === 'wins', `${c.teams[t].school}: goals`);
    assert.equal(goalResults(c, si, t).length, g.length);
  }
  for (const x of c.coaches!.filter((y) => y.team !== null)) {
    const h = hotSeat(c, x, si);
    assert.ok(h !== null && h >= 0 && h <= 100, `${x.name}: hot seat ${h}`);
    assert.ok(tenure(c, x, si) >= 1);
  }
  // XP: spending for him keeps the cost rule; the user's purchase needs Manage XP and enough XP.
  const best = c.coaches!.find((x) => x.team !== null)!;
  const s = autoSpend(best.ratings, 2000, rng(5));
  const gained = Object.keys(s.ratings).reduce((a, k) => a + s.ratings[k as keyof typeof s.ratings] - best.ratings[k as keyof typeof best.ratings], 0);
  assert.ok(gained > 0 && s.xp >= 0 && s.xp < 300, 'automatic spending uses the XP');
  assert.throws(() => spendXp(c, best.id, { passing: 1 }), /Manage XP/);
  const m = setManageXp(c, best.id, true);
  const rich = { ...m, coaches: m.coaches!.map((x) => (x.id === best.id ? { ...x, xp: xpCost(x.ratings.recruiting) } : x)) };
  assert.equal(spendXp(rich, best.id, { recruiting: 1 }).coaches![best.id].ratings.recruiting, best.ratings.recruiting + 1);
  assert.throws(() => spendXp(rich, best.id, { recruiting: 2 }), /Not enough XP/);
  // The carousel: the offseason's first step.
  const user = c.userTeams[0] ?? 0;
  const managed = setManageXp(c, c.coaches!.find((x) => x.team === user)!.id, true);
  const o = startOffseason(managed, { seed: 3, force: true });
  assert.equal(o.offseason!.step, 'carousel');
  assert.ok(o.coaches!.every((x) => x.status !== 'coach' || x.team !== null));
  assert.throws(() => placeCoach(c, 0, 0), /carousel/);
  // The user's changes: fire a coach, put a pool coach on another team.
  const target = (user + 1) % n;
  const pool = o.coaches!.find((x) => x.status === 'pool')!;
  let x = fireCoach(o, user);
  assert.ok(openings(x).includes(user));
  x = placeCoach(x, pool.id, target);
  assert.equal(x.coaches![pool.id].team, target);
  const done = finishCarousel(x);
  assert.equal(done.offseason!.step, 'depth');
  assert.equal(openings(done).length, 0, 'every opening filled');
  const heads = done.coaches!.filter((y) => y.team !== null);
  assert.equal(heads.length, n);
  assert.equal(new Set(heads.map((y) => y.team)).size, n, 'one coach per team');
  assert.ok(done.coaches!.every((y) => y.status !== 'retired' || y.team === null));
  assert.equal(done.coaches![pool.id].team, target, 'the user\'s pick stays');
  const back = cancelOffseason(done);
  assert.deepEqual(back.coaches, managed.coaches, 'starting the offseason over restores the coaches');
  const st = o.offseason!.carousel!;
  effectChecks(c, done, ok);
  ok(`coaching carousel: ${st.retired.length} retired, ${st.fired.length} fired, ${done.offseason!.carousel!.moves.length} hired; offers to the managed coach: ${(st.offers[managed.coaches!.find((y) => y.team === user)!.id] ?? []).length}; goals, hot seat, XP`);
}

/** Part 3: the coaches' effects, former players, headshots and stories. */
function effectChecks(c: Dynasty, done: Dynasty, ok: (name: string) => void) {
  const coach = c.coaches!.find((x) => x.team !== null)!;
  const top = { ...coach, ratings: { passing: 99, running: 99, defense: 99, recruiting: 99, development: 99 }, prestige: 5 };
  const low = { ...coach, ratings: { passing: 40, running: 40, defense: 40, recruiting: 40, development: 40 }, prestige: 1 };
  for (const pos of ['QB', 'HB', 'LT', 'CB', 'K']) {
    assert.ok(developmentBoost(top, pos) > 0.09 && developmentBoost(top, pos) <= 0.12, `boost ${pos}`);
    assert.ok(developmentBoost(low, pos) < -0.07 && developmentBoost(low, pos) >= -0.12);
  }
  assert.equal(developmentBoost(undefined, 'QB'), 0);
  assert.ok(recruitingDiscount(top) > 0.09 && recruitingDiscount(low) < 0);
  // Transfers: only in 2026; a team whose coach left in the carousel has its players' chance raised.
  if (coachTransfers(done)) {
    const left = done.offseason!.carousel!.moves.find((m) => m.from !== null);
    const changed = done.teams.find((t) => done.seasons.at(-1)!.coach![t.index] !== done.coaches!.find((x) => x.team === t.index)?.id);
    if (changed) assert.ok(transferFactor(done, changed.index).plus > 0, 'a coach who left raises the chance');
    if (left) assert.equal(transferFactor(done, left.from!).followTo, left.to, 'his players may follow him');
  } else assert.deepEqual(transferFactor(done, 0), { times: 1, plus: 0, followTo: null }, '1994: no transfer effect');
  // A former player as a coach: young, below an established coach.
  const p = done.players.find((x) => x.status === 'graduated' || x.status === 'pro') ?? done.players[0];
  const fc = coachFromPlayer({ ...p, leftYear: p.leftYear ?? done.offseason!.year }, 999, done.offseason!.year, true, rng(1));
  assert.ok(coachOvr(fc.ratings) <= 72 && fc.formerPlayer?.drafted && fc.poolNote === 'Former NFL player');
  // Headshots: every coach draws, the same every time; a user change sticks.
  for (const x of c.coaches!.slice(0, 40)) {
    const a = drawHeadshot(coachLook(x, c.startYear, ['#112233', '#ffffff']), '#112233', '#ffffff');
    assert.equal(a.length, HEAD_SIZE * HEAD_SIZE * 4);
    assert.deepEqual(a, drawHeadshot(coachLook(x, c.startYear, ['#112233', '#ffffff']), '#112233', '#ffffff'));
  }
  assert.equal(coachLookChoices({ ...coach, look: { hat: 'cap' } }, c.startYear).hat, 'cap');
  // Stories: firings, hirings and retirements make the news.
  const stories = offseasonStories(done, done.offseason!.events, done.offseason!.year);
  const coachy = stories.filter((x) => /fires|hires|retires|takes over|is out at|coaching career/.test(x.headline));
  assert.ok(coachy.length >= done.offseason!.carousel!.moves.filter((m) => m.kind !== 'yours').length, 'a story for each hire');
  ok(`coach effects: development ±${Math.round(developmentBoost(top, 'QB') * 100)}%, recruiting ${Math.round(recruitingDiscount(top) * 100)}% cheaper at the top; ${coachy.length} coach stories; headshots`);
}
