// 1994 Season Edition: team OFF / DEF OVRs from the rosters, as the ROM lane's ovrfit94.py made them for 1994
// test36 (H-016; claude.ai project notes: claude/tools/ovrfit94.py, unitz.py).
//
// A unit's strength is the mean z score of its players' five non-weight ratings (fine values: 16 × step + offset),
// z per slot and rating over all teams; offense = slots 0-14, defense = slots 16-30. Each side's OVR then keeps the
// reference OVRs' mean and spread: OVR = mean + sd × (z − mean z) / sd(z), rounded, 63-99. In a dynasty the
// reference is the season before, so the scale stays where the ROM put it. (The 2026 edition's OVRs come from the
// starters' CFB 27-style overall instead: teamRatings.ts, starterOvr.)

import type { BwSlot } from './model';
import type { TeamRating } from '../teamRatings';

const OFF_SLOTS = Array.from({ length: 15 }, (_, s) => s);
const DEF_SLOTS = Array.from({ length: 15 }, (_, s) => 16 + s);

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v: number[]) => { const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); };

/** Every team's mean z over the given slots (NaN for a team with no rated player there). */
export function unitZ(bw: (BwSlot | null)[][], slots: number[]): number[] {
  const z: number[][] = bw.map(() => []);
  for (const s of slots) {
    for (let k = 0; k < 6; k++) {
      const cells = bw.map((team) => team[s]).map((b) => (b && b.attrs[k] && b.attrs[k] !== 'Weight' ? 16 * b.steps[k] + (b.offs?.[k] ?? 0) : null));
      const v = cells.filter((x): x is number => x !== null);
      if (v.length < 2) continue;
      const m = mean(v);
      const d = sd(v);
      if (d < 1) continue;
      cells.forEach((x, t) => { if (x !== null) z[t].push((x - m) / d); });
    }
  }
  return z.map((v) => (v.length ? mean(v) : NaN));
}

const side = (z: number[], ref: number[]) => {
  const ok = z.filter((x) => !Number.isNaN(x));
  const zm = mean(ok);
  const zs = sd(ok) || 1;
  const m = mean(ref);
  const s = sd(ref);
  return z.map((x, t) => (Number.isNaN(x) ? ref[t] : Math.max(63, Math.min(99, Math.round(m + (s * (x - zm)) / zs)))));
};

/** Every team's OFF / DEF from its slots' game ratings, on the scale of `ref` (the season before, same team order). */
export function teamOvrs1994(bw: (BwSlot | null)[][], ref: TeamRating[]): TeamRating[] {
  const off = side(unitZ(bw, OFF_SLOTS), ref.map((r) => r.off));
  const def = side(unitZ(bw, DEF_SLOTS), ref.map((r) => r.def));
  return off.map((o, t) => ({ off: o, def: def[t] }));
}

/**
 * After lineup changes: the given teams' OVRs move by the change the 1994 method sees between the two grids
 * (the season's values may be the ROM's own, so they move rather than being replaced); other teams keep theirs.
 */
export function shiftTeamOvrs1994(before: (BwSlot | null)[][], after: (BwSlot | null)[][], cur: TeamRating[], teams: Iterable<number>): TeamRating[] {
  const a = teamOvrs1994(before, cur);
  const b = teamOvrs1994(after, cur);
  const clamp = (n: number) => Math.max(63, Math.min(99, n));
  const out = cur.slice();
  for (const t of teams) out[t] = { off: clamp(cur[t].off + b[t].off - a[t].off), def: clamp(cur[t].def + b[t].def - a[t].def) };
  return out;
}
