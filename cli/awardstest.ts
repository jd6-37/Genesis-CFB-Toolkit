// Awards handed out after the conference championships (awards.ts: awardsWeek, freezeAwards, heismanVotes): a season's
// saves imported in order; the awards are kept at the first save with the title games played and don't change after;
// the Heisman vote names the award's winner first, every voter gives 6 points.
// Usage: npx tsx cli/awardstest.ts ROM SAVE... (one season's saves, in week order)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRom, newDynasty } from './dynastysim';
import { importSave, type Dynasty } from '../src/core/dynasty/model';
import { seasonView } from '../src/core/dynasty/derive';
import { awardsWeek, freezeAwards, HEISMAN_VOTERS, seasonAwards } from '../src/core/dynasty/awards';
import { createDynasty1994 } from '../src/core/dynasty/create1994';
import { ROSTERS_1994 } from '../src/core/dynasty/rosters1994';
const rom = await loadRom(process.argv[2]);
const is94 = rom.length > 3_000_000 && process.argv[2].includes('94');
const fresh = (): Dynasty => is94
  ? createDynasty1994(rom, readFileSync(new URL(`../public/${ROSTERS_1994.file}`, import.meta.url), 'utf8'), { name: 't', seed: 7, id: 't', created: '2026-11-28T00:00:00Z' })
  : newDynasty(rom, 1);
let d = fresh();
let kept: string | null = null;
let at = -1;
for (const f of process.argv.slice(3)) {
  d = importSave(d, new Uint8Array(readFileSync(f)), { at: `2026-11-28T00:00:${String(at + 1).padStart(2, '0')}Z` }).dynasty;
  at++;
  const r = freezeAwards(d);
  d = r.dynasty;
  const s = d.seasons[d.seasons.length - 1];
  const v = seasonView(d, s);
  const w = awardsWeek(v);
  const name = f.split('/').pop();
  if (!s.awards) { assert.equal(w, null, `${name}: the awards week is in but no awards`); console.log(name, 'not yet'); continue; }
  const json = JSON.stringify(s.awards);
  if (kept === null) {
    kept = json;
    const a = s.awards;
    assert.ok(a.votes && a.votes.length >= 4, 'at least four finalists');
    assert.equal(a.votes![0].player, a.heisman[0].player, 'the vote names the Heisman winner first');
    assert.ok(a.votes!.every((x, i, l) => i === 0 || l[i - 1].points >= x.points), 'by points');
    assert.equal(a.votes!.reduce((n, x) => n + x.points, 0), HEISMAN_VOTERS * 6, 'every voter gives 6 points');
    assert.equal(a.votes!.reduce((n, x) => n + x.first, 0), HEISMAN_VOTERS, 'every voter one first place');
    assert.ok(a.watch && a.watch.heisman.length && a.coachWatch, 'the final watches');
    assert.equal(seasonAwards(d, s), a, 'seasonAwards reads the kept awards');
    const p = (i: number) => d.players[a.votes![i].player - 1];
    console.log(name, `awards handed out (week ${a.week}): Heisman ${p(0).first} ${p(0).last} ${a.votes![0].points} pts, then ${a.votes!.slice(1, 5).map((x) => x.points).join(' / ')}`);
  } else {
    assert.equal(json, kept, `${name}: the awards changed after they were handed out`);
    console.log(name, 'awards unchanged');
  }
}
assert.ok(kept, 'the awards were never handed out');
console.log('passed');
