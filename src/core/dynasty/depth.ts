// Depth charts from the dynasty's own ratings (user, 2026-11-12): each team's 32 slots and their backups
// go to the players with the best OVR at the slot's role (ovr.ts formulas on the shown numbers), by
// position: first players of the slot's position, then of close positions, then anyone left.

import { rosterLayout, type SlotDef } from '../rosterLayouts';
import { starterOvr } from '../teamRatings';
import type { BwSlot, DPlayer, DSeason, Dynasty } from './model';
import { playerOvr, roleOfSlot } from './ovr';
import { bwSlotOf, ovrAt } from './ratings';
import { SLOTS } from './rosters';

const DEFS = rosterLayout('bw95', false, true, true);

/**
 * The 32 spots by slot number. The layout lists them in the order the game shows them, which is not the
 * slot order from the punter on (P is slot 31, DT2 slot 21, …): read a depth chart's entry through this,
 * never through the layout's position in its list.
 */
export const SLOT_DEF: SlotDef[] = DEFS.reduce((acc, def) => { acc[def.slot] = def; return acc; }, new Array<SlotDef>(SLOTS));

/** The position that plays a slot, by its label in the 138-team edition. */
export function slotPosition(label: string): string {
  const l = label.replace(/\d+$/, '');
  return ({ SE: 'WR', FL: 'WR', LDE: 'LE', RDE: 'RE' } as Record<string, string>)[l] ?? l;
}

/** Positions that stand in when a team has nobody left at a slot's own position. */
const FALLBACK: Record<string, string[]> = {
  QB: [], HB: ['FB', 'WR'], FB: ['HB', 'TE'], WR: ['TE', 'HB'], TE: ['WR', 'FB'], K: ['P'], P: ['K'],
  LT: ['RT', 'LG', 'RG', 'C'], RT: ['LT', 'RG', 'LG', 'C'], LG: ['RG', 'C', 'LT', 'RT'], RG: ['LG', 'C', 'RT', 'LT'], C: ['LG', 'RG', 'LT', 'RT'],
  LE: ['RE', 'DT'], RE: ['LE', 'DT'], DT: ['LE', 'RE'],
  LOLB: ['ROLB', 'MLB'], ROLB: ['LOLB', 'MLB'], MLB: ['LOLB', 'ROLB'], CB: ['FS', 'SS'], SS: ['FS', 'CB'], FS: ['SS', 'CB'],
};

/** The pounds the ROM adds to a lineman's shown weight (the OL weight tweak), from the season's ratings. */
export const olPlusOf = (s: DSeason | undefined) => s?.bw?.flat().find((b) => b?.group === 'OL')?.weightPlus ?? 0;

/**
 * One team's 32 and backups (player IDs per slot). With `open`, a spot takes only a player of its own
 * position, once; otherwise it stays empty (the projected depth chart; user, 2026-11-13: "I'd rather the
 * slot stay empty if there is no QB", and on a receiver at HB2: "don't let a WR stand in there. just show
 * open"). Without it every one of the 32 gets a player, as the game needs.
 */
export function teamDepth(players: DPlayer[], open = false): { slots: (number | null)[]; bench: (number | null)[] } {
  const slots = new Array<number | null>(SLOTS).fill(null);
  const bench = new Array<number | null>(SLOTS).fill(null);
  const used = new Set<number>();
  const at = (p: DPlayer, def: SlotDef) => ovrAt(p.ratings, roleOfSlot(def.slot)) + p.ovr / 1000; // ties: his own OVR
  const fill = (grid: (number | null)[], defs: SlotDef[], ok: (p: DPlayer, def: SlotDef) => boolean) => {
    for (const def of defs) {
      if (grid[def.slot] !== null) continue;
      const best = players.filter((p) => !used.has(p.id) && ok(p, def)).sort((a, b) => at(b, def) - at(a, def))[0];
      if (best) { grid[def.slot] = best.id; used.add(best.id); }
    }
  };
  // Each slot's own position: the Active Roster first, then the backups; then close positions; then anyone.
  const own = (p: DPlayer, def: SlotDef) => p.pos === slotPosition(def.label);
  const close = (p: DPlayer, def: SlotDef) => (FALLBACK[slotPosition(def.label)] ?? []).includes(p.pos);
  for (const ok of open ? [own] : [own, close]) { fill(slots, DEFS, ok); fill(bench, DEFS, ok); }
  if (open) return { slots, bench };
  fill(slots, DEFS, () => true);
  // A slot in the game must have a player: a kicker can also punt (and the other way round).
  for (const def of DEFS) {
    if (slots[def.slot] !== null) continue;
    const any = players.filter((p) => close(p, def) || own(p, def)).sort((a, b) => at(b, def) - at(a, def))[0] ?? players[0];
    if (any) slots[def.slot] = any.id;
  }
  fill(bench, DEFS, () => true);
  return { slots, bench };
}

/** Every team's depth chart for the next season, its game ratings and team OVRs (from the starters). */
export function depthChart(d: Dynasty): Pick<DSeason, 'slots' | 'bw' | 'bench' | 'benchBw' | 'teamOvr'> {
  const olPlus = olPlusOf(d.seasons[d.seasons.length - 1]);
  const byTeam = new Map<number, DPlayer[]>();
  for (const p of d.players) if (p.status === 'active' && p.team !== null) byTeam.set(p.team, [...(byTeam.get(p.team) ?? []), p]);
  const out = { slots: [] as (number | null)[][], bench: [] as (number | null)[][], bw: [] as (BwSlot | null)[][], benchBw: [] as (BwSlot | null)[][], teamOvr: [] as { off: number; def: number }[] };
  for (const t of d.teams) {
    const { slots, bench } = teamDepth(byTeam.get(t.index) ?? []);
    const rate = (grid: (number | null)[]) => DEFS.reduce((acc, def) => {
      const id = grid[def.slot];
      acc[def.slot] = id ? bwSlotOf(d.players[id - 1], def, olPlus) : null;
      return acc;
    }, new Array<BwSlot | null>(SLOTS).fill(null));
    const bw = rate(slots);
    out.slots.push(slots); out.bench.push(bench); out.bw.push(bw); out.benchBw.push(rate(bench));
    const o = starterOvr(slots.flatMap((id, slot) => (id && bw[slot] ? [{ pos: d.players[id - 1].pos, ovr: playerOvr(slot, bw[slot]!) }] : [])));
    out.teamOvr.push({ off: o.off, def: o.def });
  }
  return out;
}
