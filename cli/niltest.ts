// NIL in a dynasty (src/core/dynasty/nil.ts, recruiting.ts): turning it on and off, the CPU managing a user team's
// offers (Dynasty.nil.auto), the room check, pay on signing day.
//   npm run test:nil -- ELEVATED_2026_138
import assert from 'node:assert/strict';
import { loadRom, newDynasty, playSeason, runOffseason } from './dynastysim';
import { disableNil, enableNil, hasNil, money, payroll } from '../src/core/dynasty/nil';
import * as Rec from '../src/core/dynasty/recruiting';

const path = process.argv[2];
if (!path) { console.error('usage: npm run test:nil -- ELEVATED_2026_138'); process.exit(2); }
const rom = await loadRom(path);
let pass = 0;
const ok = (m: string) => { pass++; console.log(`ok - ${m}`); };

const plain = newDynasty(rom, 7);
const on = enableNil(plain);
assert.ok(hasNil(on) && !hasNil(plain));
const s0 = on.seasons.at(-1)!.nil!;
assert.ok(s0.budget.every((b) => b > 0), 'every school has a budget');
assert.ok(on.players.some((p) => (p.nil ?? 0) > 0), 'players are paid');
const off = disableNil(on);
assert.ok(!hasNil(off) && !off.players.some((p) => p.nil !== undefined) && !off.seasons.some((s) => s.nil));
ok(`on: ${on.teams.length} budgets (${money(Math.min(...s0.budget))} to ${money(Math.max(...s0.budget))}), players paid; off again: nothing left`);

// One season, then the offseason with a user team whose NIL the CPU manages: its offers get amounts within the room.
const T = on.userTeams[0] ?? 0;
let d = playSeason({ ...on, userTeams: [T], nil: { on: true, auto: true } }, rom, 11);
let checked = false;
d = runOffseason(d, 11, {
  userPlans: (x) => {
    const rs = x.offseason!.recruiting!;
    const open = rs.prospects.filter((p) => p.committed === null && !p.offers.includes(T)).sort((a, b) => b.stars - a.stars).slice(0, 3);
    const plan: Rec.TeamPlan = { points: Object.fromEntries(open.map((p) => [p.id, 50])), offers: open.map((p) => p.id) };
    if (!checked && rs.nil) {
      const auto = Rec.withAutoNil(rs, T, plan);
      for (const id of plan.offers) assert.ok((auto.nil?.[id] ?? -1) >= 0, 'an amount on every new offer');
      assert.ok(Object.values(auto.nil!).reduce((a, x) => a + x, 0) <= Rec.nilRoom(rs, T), 'within the room');
      const p0 = open[0];
      assert.equal(auto.nil![p0.id] <= Rec.nilSuggest(rs, T, p0), true);
      // Over the room: refused.
      const big = { ...plan, nil: { [p0.id]: Rec.nilRoom(rs, T) + 1e6 } };
      assert.throws(() => Rec.runRecruitingWeek({ ...x, nil: { on: true } }, rs, { [T]: big }, 1), /NIL room/);
      checked = true;
    }
    return { [T]: plan };
  },
});
assert.ok(checked, 'recruiting had NIL');
const paid = d.players.filter((p) => p.team === T && (p.nil ?? 0) > 0).length;
assert.ok(payroll(d.players, T) > 0);
ok(`CPU-managed offers: amounts on every new offer, within the room; an offer over the room is refused; payroll after signing day ${money(payroll(d.players, T))} (${paid} paid players)`);
console.log(`\n${pass} passed`);
