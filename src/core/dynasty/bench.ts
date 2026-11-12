// A random bench for the first season (user, 2026-11-12): instead of the next-best real CFB 27
// players, one generated backup for each of a team's 32 slots, made like signing-class recruits
// (stars by the program's prestige, a mix of classes).

import { rng, type ClassYear, type DPlayer, type Dynasty } from './model';
import { develop, drawStars, makeRecruit, prestige, rosterSheet, type RecruitTemplates } from './offseason';
import { benchFor, SLOTS } from './rosters';
import { openRosterRom } from '../rosterRom';

/** The position a slot's backup plays, by the slot's label in the 138-team edition. */
export function slotPosition(label: string): string {
  const l = label.replace(/\d+$/, '');
  return ({ HB: 'HB', SE: 'WR', FL: 'WR', WR: 'WR', TE: 'TE', LDE: 'LE', RDE: 'RE', DT: 'DT', MLB: 'MLB', LCB: 'CB', RCB: 'CB', FS: 'FS' } as Record<string, string>)[l] ?? l;
}

/** Whether the bench can still be replaced: the first season, before the offseason. */
export const canReplaceBench = (d: Dynasty) => d.seasons.length === 1 && !d.offseason;

/** The dynasty with a generated bench in place of the first season's (the 32 in the game stay as they are). */
export function randomBench(d: Dynasty, rom: Uint8Array, tpl: RecruitTemplates, seed = Date.now() >>> 0): Dynasty {
  if (!canReplaceBench(d)) throw new Error('The bench can only be replaced in the first season.');
  const r = rng(seed);
  const s = d.seasons[0];
  // Keep only the 32 per team (new IDs in the same order).
  const keep = d.players.filter((p) => s.slots.some((sl) => sl.includes(p.id)));
  const newId = new Map(keep.map((p, i) => [p.id, i + 1]));
  const players: DPlayer[] = keep.map((p, i) => ({ ...p, id: i + 1 }));
  const slots = s.slots.map((sl) => sl.map((id) => (id === null ? null : newId.get(id) ?? null)));
  const base: Dynasty = { ...d, players };
  // One backup per slot.
  const bench: DPlayer[] = [];
  const classes: [ClassYear, number][] = [['FR', 0.3], ['SO', 0.3], ['JR', 0.25], ['SR', 0.15]];
  for (const t of d.teams) {
    const pres = prestige(d, t.index);
    for (let slot = 0; slot < SLOTS; slot++) {
      const label = s.bw?.[t.index]?.[slot]?.label;
      if (!label) continue;
      let x = r(), cls: ClassYear = 'FR';
      for (const [c, w] of classes) if ((x -= w) <= 0) { cls = c; break; }
      const years = ['FR', 'SO', 'JR', 'SR'].indexOf(cls);
      let p = makeRecruit(base, tpl, r, players.length + bench.length + 1, t.index, slotPosition(label), drawStars(r, pres * 0.7), s.year - years);
      for (let k = 0; k < years; k++) p = develop(base, p, Math.max(0, ((p.pot ?? p.ovr) - p.ovr) * 0.4), r);
      bench.push({ ...p, cls, recruit: undefined });
    }
  }
  const all = [...players, ...bench];
  const next: Dynasty = { ...d, players: all };
  const roster = openRosterRom(rom);
  const starters = rosterSheet(next, players);
  const backups = rosterSheet(next, bench);
  const b = benchFor(roster, starters.sheet, backups.sheet);
  const benchIds = b.bench.map((sl) => sl.map((row) => (row === null ? null : backups.ids[row])));
  return { ...next, seasons: [{ ...s, slots, bench: benchIds, benchBw: b.benchBw }] };
}
