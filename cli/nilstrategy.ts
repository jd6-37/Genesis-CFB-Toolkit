// Can money be gamed? (not a test) One school follows a strategy, every other team is the computer; compares how
// the school does over the seasons with the same school run by the computer (same seeds).
//   npx tsx cli/nilstrategy.ts ROM_2026 SCHOOL STRATEGY [SEEDS=2] [SEASONS=8]
// Strategies: cpu (baseline), whale (all its room on 4-5 star prospects, 2.6× their value, nothing for the rest),
// splurge (1.6× on every offer while room lasts), cheap (no dollars on offers, everyone kept at his old pay),
// keep (normal offers, everyone kept at his old pay).
import { loadRom, newDynasty, playSeason, runOffseason, strengths } from './dynastysim';
import { enableNil, payroll } from '../src/core/dynasty/nil';
import { nilRoom, valueOf } from '../src/core/dynasty/recruiting';
import { STAR_POINTS } from '../src/core/dynasty/offseason';
import type { Dynasty } from '../src/core/dynasty/model';

const [romPath, school, strategy, seedsArg = '2', seasonsArg = '8'] = process.argv.slice(2);
const rom = await loadRom(romPath);

function spend(x: Dynasty, T: number): Dynasty {
  const rs = x.offseason?.recruiting;
  if (!rs?.nil || strategy === 'cpu' || strategy === 'keep') return x;
  const n = rs.nil;
  const mine: Record<number, number> = {};
  const mineOffers = rs.prospects.filter((p) => p.offers.includes(T) && (p.committed === null || p.committed === T));
  let free = n.room[T];
  const order = mineOffers.slice().sort((a, b) => b.stars - a.stars || b.player.ovr - a.player.ovr);
  if (strategy === 'smart') {
    // The computer's own offers, plus its three best open targets at 2.6× their value while the room lasts.
    let room = nilRoom(rs, T);
    const out2: Record<number, number> = {};
    for (const p of order.filter((q) => q.committed === null).slice(0, 3)) {
      const now = n.offers[T]?.[p.id] ?? 0, want = Math.round(valueOf(p, n.market) * 2.6);
      const add = Math.max(0, Math.min(want - now, room));
      if (add > 0) { out2[p.id] = now + add; room -= add; }
    }
    return { ...x, offseason: { ...x.offseason!, recruiting: { ...rs, nil: { ...n, offers: { ...n.offers, [T]: { ...(n.offers[T] ?? {}), ...out2 } } } } } };
  }
  for (const p of order) {
    const v = valueOf(p, n.market);
    const want = strategy === 'whale' ? (p.stars >= 4 ? v * 2.6 : 0) : strategy === 'splurge' ? v * n.rate[T] * 1.6 : 0;
    const dollars = Math.max(0, Math.min(Math.round(want), free));
    mine[p.id] = dollars;
    free -= dollars;
  }
  return { ...x, offseason: { ...x.offseason!, recruiting: { ...rs, nil: { ...n, offers: { ...n.offers, [T]: { ...(n.offers[T] ?? {}), ...mine } } } } } };
}

const out: Record<string, number[]>[] = [];
for (let seed = 1; seed <= +seedsArg; seed++) {
  let d = enableNil(newDynasty(rom, seed));
  const T = d.teams.find((t) => t.school === school)!.index;
  const rec: Record<string, number[]> = { str: [], rank: [], cls: [], blue: [], trIn: [], trOut: [], payB: [], budget: [] };
  for (let y = 0; y < +seasonsArg; y++) {
    d = playSeason(d, rom, seed * 1000 + y);
    const prev = d.seasons.at(-1)!;
    d = runOffseason(d, seed * 7919 + y, {
      beforeDepth: (x) => (strategy === 'cheap' || strategy === 'keep') && x.offseason?.nil
        ? { ...x, offseason: { ...x.offseason, nil: { ...x.offseason.nil, keep: x.players.filter((p) => p.team === T && p.status === 'active').map((p) => p.id) } } }
        : x,
      beforeRecruiting: (x) => spend(x, T),
      afterWeek: (x) => spend(x, T),
    });
    void prev;
    const s = d.seasons.at(-1)!;
    const str = strengths(d, rom);
    const ev = s.events ?? [];
    rec.str.push(str[T]);
    rec.rank.push(d.teams.map((t) => t.index).sort((a, b) => str[b] - str[a]).indexOf(T) + 1);
    const signed = ev.filter((e) => e.kind === 'signed' && e.team === T) as { stars: number }[];
    rec.cls.push(signed.reduce((a, e) => a + STAR_POINTS[e.stars], 0));
    rec.blue.push(signed.filter((e) => e.stars >= 4).length);
    rec.trIn.push(ev.filter((e) => (e.kind === 'transfer' && e.to === T) || (e.kind === 'fcs' && e.to === T)).length);
    rec.trOut.push(ev.filter((e) => e.kind === 'transfer' && e.from === T).length);
    rec.payB.push(+(payroll(d.players, T) / s.nil!.budget[T]).toFixed(2));
    rec.budget.push(+(s.nil!.budget[T] / 1e6).toFixed(1));
  }
  out.push(rec);
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const avg = (k: string, a: number, b: number) => mean(out.flatMap((r) => r[k].slice(a, b)));
const fmt = (k: string) => `${k} ${avg(k, 0, 4).toFixed(1)} → ${avg(k, 4, 99).toFixed(1)}`;
console.log(`${school.padEnd(10)} ${strategy.padEnd(8)} ${['str', 'rank', 'cls', 'blue', 'trIn', 'trOut', 'payB', 'budget'].map(fmt).join(' | ')}`);
