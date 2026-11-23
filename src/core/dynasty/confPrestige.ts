// Conference prestige, a recruiting pitch (user, 2026-11-21: "i do think conference prestige should matter"; mockups
// approved; like College Football 27's "Conference Prestige" grade). A conference's prestige is the average prestige
// stars (1-6) of its schools this offseason; the pitch is that average against the best conference's, so the top
// conference is 1. It moves as schools' stars move and when teams change conferences. Independents have no
// conference to sell: they pitch their own stars here (user).

import type { Dynasty } from './model';
import { prestigeStars } from './offseason';
import { INDEPENDENT } from '../seasonWide';

export interface ConfPrestige { conf: number; name: string; teams: number; mean: number; value: number }

/** The season the offseason works on: its conferences (the Conferences step edits it). */
const seasonOf = (d: Dynasty) => d.seasons[d.seasons.length - 1];

/** Every conference with teams (the independents left out), best first. */
export function conferencePrestige(d: Dynasty): ConfPrestige[] {
  const s = seasonOf(d);
  const names = s.confNames ?? [];
  const sums = new Map<number, { n: number; sum: number }>();
  d.teams.forEach((t) => {
    const c = s.conf[t.index];
    if (c === undefined || c === INDEPENDENT || /^independent/i.test(names[c] ?? '')) return;
    const x = sums.get(c) ?? { n: 0, sum: 0 };
    x.n++; x.sum += prestigeStars(d, t.index);
    sums.set(c, x);
  });
  const rows = [...sums].map(([conf, x]) => ({ conf, name: names[conf] ?? `Conference ${conf + 1}`, teams: x.n, mean: x.sum / x.n, value: 0 }));
  const top = Math.max(1, ...rows.map((r) => r.mean));
  return rows.map((r) => ({ ...r, value: r.mean / top })).sort((a, b) => b.mean - a.mean || a.conf - b.conf);
}

/** Each team's conference pitch, 0-1 (an independent: its own stars against the best conference). */
export function conferencePitch(d: Dynasty): Map<number, number> {
  const s = seasonOf(d);
  const rows = conferencePrestige(d);
  const by = new Map(rows.map((r) => [r.conf, r.value]));
  const top = rows[0]?.mean ?? 6;
  return new Map(d.teams.map((t) => [t.index, by.get(s.conf[t.index]) ?? Math.min(1, prestigeStars(d, t.index) / top)]));
}
