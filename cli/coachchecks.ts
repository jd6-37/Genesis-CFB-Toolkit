// Coach checks shared by the Dynasty tests (dynastytest.ts, dynasty94test.ts): a dynasty gets its edition's real
// coaches from public/data/coaches-YEAR.json, every team its head coach, and the coaches never touch the ROM.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CoachData } from '../src/core/dynasty/coachData';
import { COACH_RATINGS, coachOvr, coachRecord, dynastySeasons, headCoachField, withCoaches } from '../src/core/dynasty/coaches';
import type { Dynasty } from '../src/core/dynasty/model';
import { editionOf } from '../src/core/dynasty/edition';

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
  ok(`coaches: ${heads.length} head coaches and ${coaches.length - heads.length} in the pool; OVR ${ovrs[0]}-${ovrs[n - 1]} (median ${ovrs[n >> 1]}); best ${best.name} ${coachOvr(best.ratings)}`);
  return c;
}
