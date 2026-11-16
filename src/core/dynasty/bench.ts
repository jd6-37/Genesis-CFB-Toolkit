// A random bench for the first season (user, 2026-11-12): instead of the next-best real CFB 27
// players, one generated backup for each of a team's 32 slots, made like signing-class recruits
// (stars by the program's prestige, a mix of classes). A 1994 dynasty's bench is made the same way, with
// real 1994 players' names, numbers, classes and sizes where the lists have one for the slot (create1994.ts).

import { rng, type ClassYear, type DPlayer, type Dynasty } from './model';
import { develop, drawStars, makeRecruit, prestige, recruitTemplates } from './offseason';
import { SLOTS } from './rosters';
import { olPlusOf, slotPosition } from './depth';
import { bwSlotOf } from './ratings';
import { rosterLayout } from '../rosterLayouts';

export { slotPosition };
const DEFS = rosterLayout('bw95', false, true, true);

/** Whether the bench can still be replaced: the first season, before the offseason. */
export const canReplaceBench = (d: Dynasty) => d.seasons.length === 1 && !d.offseason;

/** A real player to put on the bench in a slot (his ratings are still generated). */
export interface BenchIdentity {
  first: string; last: string; jersey: number; heightIn: number; weight: number; cls?: ClassYear; hometown: string; state: string; srcId: number;
}

/**
 * The dynasty with a generated bench in place of the first season's (the 32 in the game stay as they are).
 * `ident` may give a slot's backup a real player's identity (called in slot order, team by team).
 */
export function randomBench(d: Dynasty, seed = Date.now() >>> 0, ident?: (team: number, slot: number, pos: string, r: () => number) => BenchIdentity | null): Dynasty {
  if (!canReplaceBench(d)) throw new Error('The bench can only be replaced in the first season.');
  const r = rng(seed);
  const s = d.seasons[0];
  // Keep only the 32 per team (new IDs in the same order).
  const keep = d.players.filter((p) => s.slots.some((sl) => sl.includes(p.id)));
  const newId = new Map(keep.map((p, i) => [p.id, i + 1]));
  const players: DPlayer[] = keep.map((p, i) => ({ ...p, id: i + 1 }));
  const slots = s.slots.map((sl) => sl.map((id) => (id === null ? null : newId.get(id) ?? null)));
  const base: Dynasty = { ...d, players };
  const tpl = recruitTemplates(d);
  // One backup per slot.
  const bench: DPlayer[] = [];
  const classes: [ClassYear, number][] = [['FR', 0.3], ['SO', 0.3], ['JR', 0.25], ['SR', 0.15]];
  for (const t of d.teams) {
    const pres = prestige(d, t.index);
    for (let slot = 0; slot < SLOTS; slot++) {
      const label = s.bw?.[t.index]?.[slot]?.label;
      if (!label) continue;
      const who = ident?.(t.index, slot, slotPosition(label), r) ?? null;
      let x = r(), cls: ClassYear = 'FR';
      for (const [c, w] of classes) if ((x -= w) <= 0) { cls = c; break; }
      if (who?.cls) cls = who.cls;
      const years = Math.min(3, ['FR', 'SO', 'JR', 'SR', 'SR+'].indexOf(cls));
      let p = makeRecruit(base, tpl, r, players.length + bench.length + 1, t.index, slotPosition(label), drawStars(r, pres * 0.7), s.year - years);
      for (let k = 0; k < years; k++) p = develop(p, Math.max(0, ((p.pot ?? p.ovr) - p.ovr) * 0.4), r);
      if (who) {
        const w = who.weight || p.weight;
        p = { ...p, first: who.first, last: who.last, jersey: who.jersey, heightIn: who.heightIn || p.heightIn, weight: w, weight0: w,
          hometown: who.hometown || p.hometown, state: who.state || p.state, srcId: who.srcId, ratings: { ...p.ratings, Weight: who.weight || p.ratings.Weight } };
      }
      bench.push({ ...p, cls, recruit: undefined });
    }
  }
  const all = [...players, ...bench];
  // Each backup behind his slot.
  const olPlus = olPlusOf(s);
  const benchIds = d.teams.map(() => new Array<number | null>(SLOTS).fill(null));
  const benchBw = d.teams.map(() => new Array<ReturnType<typeof bwSlotOf> | null>(SLOTS).fill(null));
  let k = 0;
  for (const t of d.teams) {
    for (let slot = 0; slot < SLOTS; slot++) {
      if (!s.bw?.[t.index]?.[slot]?.label) continue;
      const p = bench[k++];
      benchIds[t.index][slot] = p.id;
      benchBw[t.index][slot] = bwSlotOf(p, DEFS.find((x) => x.slot === slot)!, olPlus);
    }
  }
  return { ...d, players: all, seasons: [{ ...s, slots, bench: benchIds, benchBw }] };
}
