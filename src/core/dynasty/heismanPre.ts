// Preseason Heisman favorites (user, 2026-11-18: "Could we make a pre-season list of Heisman favorites? Based on
// OVR, last year's performance, weighted towards the positions that typically win the heisman." and "yes, team
// boost is okay"). Shown on Home in place of the Heisman watch until the season's first games are in; the Walsh
// Reports may call the top five early Heisman favorites (H-035).
//
// Every starter at QB, HB1, WR1-3, TE1 and on defense is scored:
//   fit   = 0.55 × OVR + 0.30 × last season's Heisman points + 0.15 × team (each 0-1)
//   score = fit × the position's weight (QB 1, HB 0.85, WR 0.7, TE 0.5, defense 0.45)
// - OVR: the player's OVR for the new season, 60 → 0 and 100 → 1.
// - Last season: his Heisman watch points (heismanWatch: passing / rushing / receiving yards and TDs, team wins)
//   against the season's leader; a defender's tackles, sacks and interceptions against the best defender. Players
//   without last season's stats (the first season, freshmen) get 0 there.
// - Team: the preseason poll, No. 1 → 1 down to No. 25 → 0.04, unranked 0.
// In the first season (no stats yet) OVR and team share the weight (0.8 / 0.2).
import { playerLines, seasonView, statValue } from './derive';
import type { DSeason, Dynasty } from './model';
import { heismanWatch } from './outlook';
import { playerOvr, roleOfSlot } from './ovr';
import { preseasonPoll } from './poll';

/** The starters who can be on the list: QB, HB1, WR1-3, TE1, the front seven and the four DBs. */
const SLOTS = [0, 1, 9, 10, 11, 13, 16, 17, 18, 21, 19, 20, 22, 24, 26, 28, 29];
const POS_WEIGHT: Record<string, number> = { QB: 1, HB: 0.85, WR: 0.7, TE: 0.5, DE: 0.45, DT: 0.45, LB: 0.45, CB: 0.45, S: 0.45 };

export interface HeismanFavorite {
  player: number;
  team: number;
  slot: number;
  role: string;
  ovr: number;
  score: number;
  /** Last season's line for this player ("3,412 passing yards, 31 TD"), or null. */
  last: string | null;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const n = (x: number) => x.toLocaleString('en-US');

export function preseasonHeisman(d: Dynasty, season: DSeason, count = 10): HeismanFavorite[] {
  const i = d.seasons.indexOf(season);
  const prev = i > 0 ? d.seasons[i - 1] : null;
  const vPrev = prev && prev.imports.length ? seasonView(d, prev) : null;

  // Last season: offense from the Heisman watch, defense from tackles, sacks and interceptions.
  const offPts = new Map<number, number>(), defPts = new Map<number, number>(), lines = new Map<number, string>();
  if (vPrev) {
    for (const e of heismanWatch(vPrev, 100000)) {
      offPts.set(e.player, e.score);
      const best = [...e.lines].sort((a, b) => statValue(b, 'yds') - statValue(a, 'yds'))[0];
      if (best) lines.set(e.player, `${n(statValue(best, 'yds'))} ${best.cat} yards, ${statValue(best, 'td')} TD`);
    }
    const def = new Map<number, { tkl: number; sacks: number; int: number }>();
    for (const l of playerLines(vPrev)) {
      if (l.player === null || l.cat !== 'defense') continue;
      const s = def.get(l.player) ?? { tkl: 0, sacks: 0, int: 0 };
      s.tkl += statValue(l, 'tkl'); s.sacks += statValue(l, 'sacks'); s.int += statValue(l, 'int');
      def.set(l.player, s);
    }
    for (const [p, s] of def) {
      defPts.set(p, s.tkl + 3 * s.sacks + 5 * s.int);
      if (!lines.has(p)) lines.set(p, `${s.tkl} tackles, ${s.sacks} sacks, ${s.int} INT`);
    }
  }
  const maxOff = Math.max(1, ...offPts.values());
  const maxDef = Math.max(1, ...defPts.values());

  const poll = preseasonPoll(d, season);
  const rankOf = new Map((poll ?? []).map((e) => [e.team, e.rank]));
  const w = vPrev ? { ovr: 0.55, last: 0.3, team: 0.15 } : { ovr: 0.8, last: 0, team: 0.2 };

  const out: HeismanFavorite[] = [];
  season.slots.forEach((ids, team) => {
    for (const slot of SLOTS) {
      const player = ids[slot];
      const bw = season.bw?.[team]?.[slot];
      if (!player || !bw) continue;
      const role = roleOfSlot(slot);
      const pw = POS_WEIGHT[role];
      if (!pw) continue;
      const ovr = playerOvr(slot, bw);
      const defense = !['QB', 'HB', 'WR', 'TE'].includes(role);
      const last = defense ? (defPts.get(player) ?? 0) / maxDef : (offPts.get(player) ?? 0) / maxOff;
      const rank = rankOf.get(team) ?? 99;
      const teamPart = rank <= 25 ? (26 - rank) / 25 : 0;
      const fit = w.ovr * clamp01((ovr - 60) / 40) + w.last * clamp01(last) + w.team * teamPart;
      out.push({ player, team, slot, role, ovr, score: pw * fit, last: lines.get(player) ?? null });
    }
  });
  return out.sort((a, b) => b.score - a.score || b.ovr - a.ovr).slice(0, count);
}
