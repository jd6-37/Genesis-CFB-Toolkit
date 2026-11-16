// The preseason poll (user, 2026-11-16: "let's make rankings in the app"): from a dynasty's second season the app
// ranks every team before the season, and the season ROM carries the poll so the game starts from it (ROM side:
// the ROM lane's handoff H-017; dynastyArea.ts, header +0x30).
//
// A team's preseason score, from z scores over all teams:
//   0.50 × team OVR (OFF and DEF averaged; the depth chart after the offseason, so recruits and transfers count)
// + 0.25 × last season's final poll (points for places 1-25, 26 = 0, the rest below by their place)
// + 0.15 × returning starters (of last season's Active Roster, how many start again for the team)
// + 0.10 × prestige.
// The game's 62 voters each rank the teams by score + their own noise (sd 0.12), 25 points for first … 1 for 25th,
// as the game's own poll does; the order is by points, then by score. Seeded by the dynasty and season, so the same
// season gives the same poll every time (it is worked out, not stored, so preseason edits show in it).

import type { Dynasty, DSeason } from './model';
import { rng } from './model';
import { seasonView } from './derive';
import { seasonPrestige, AP_1994_PRESEASON } from './prestige';
import { canonicalSchool } from './rivalries';

export const VOTERS = 62;
export const POLL_WEIGHTS = { ovr: 0.5, last: 0.25, returning: 0.15, prestige: 0.1 } as const;
const VOTER_NOISE = 0.12;

export interface PollEntry {
  team: number;
  /** 1 = No. 1. Every team has a place (the game ranks all of them); the poll shows 25. */
  rank: number;
  points: number;
  firstVotes: number;
  /** The team's score and what went into it (for the app's "why" lines and the Walsh Reports). */
  score: number;
  ovr: number;
  lastRank: number | null;
  returning: number;
  prestige: number;
  /** The real preseason AP poll of the dynasty's first year (the ROM sets it; no points or votes are known). */
  real?: boolean;
}

/**
 * The real 2026 preseason AP poll (Aug. 17, 2026: the Top 25, then the others receiving votes), the order the 2026
 * ROM starts a first season from since test35 (the ROM lane's prepoll.py, AP26; H-017). Names as the ROM has them.
 */
export const AP_2026_PRESEASON = [
  'Ohio State', 'Oregon', 'Georgia', 'Notre Dame', 'Texas', 'Indiana', 'Miami', 'Texas A&M', 'Ole Miss', 'Oklahoma', 'LSU',
  'Texas Tech', 'Alabama', 'BYU', 'USC', 'Michigan', 'Washington', 'Penn State', 'SMU', 'Tennessee', 'Utah', 'Iowa', 'Houston',
  'Louisville', 'Missouri', 'Clemson', 'Florida', 'Boise State', 'Arizona', 'TCU', 'Navy', 'South Carolina', 'Illinois',
  'Oklahoma State', 'Vanderbilt', 'Pitt', 'Virginia Tech', 'Minnesota', 'UNLV', 'New Mexico', 'Georgia Tech', 'James Madison',
  'Auburn', 'Memphis', 'Cal', 'Liberty', 'Western Michigan', 'Tulane', 'Virginia',
];

/** The team index of each school of a list, in its order (a school the dynasty doesn't have is left out). */
function teamsOf(d: Dynasty, schools: string[]): number[] {
  const at = new Map<string, number>();
  d.teams.forEach((t, i) => { at.set(t.school, i); at.set(canonicalSchool(t.school), i); });
  return schools.map((s) => at.get(s) ?? at.get(canonicalSchool(s))).filter((t): t is number => t !== undefined);
}

/**
 * A dynasty's first season: the real preseason AP poll of its year, as the ROM sets it (2026: AP_2026_PRESEASON since
 * test35; 1994: AP_1994_PRESEASON), then the other teams by OVR. Points and votes are 0 (not known).
 */
function firstSeasonPoll(d: Dynasty, season: DSeason): PollEntry[] {
  const ap = teamsOf(d, d.edition === '1994' ? AP_1994_PRESEASON : AP_2026_PRESEASON);
  const ovr = d.teams.map((_, t) => season.teamOvr ? (season.teamOvr[t].off + season.teamOvr[t].def) / 2 : 0);
  const pres = season.prestige ?? seasonPrestige(d, season);
  const rest = d.teams.map((_, t) => t).filter((t) => !ap.includes(t)).sort((a, b) => ovr[b] - ovr[a] || a - b);
  return [...ap, ...rest].map((t, k) => ({
    team: t, rank: k + 1, points: 0, firstVotes: 0, score: 0, ovr: ovr[t], lastRank: null, returning: 0, prestige: pres[t], real: true,
  }));
}

const z = (v: number[]) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
  return v.map((x) => (x - m) / s);
};

/** How many of a team's starters this season started for it last season too (the 32 slots). */
export function returningStarters(prev: DSeason, season: DSeason, team: number): number {
  const before = new Set(prev.slots[team].filter((id): id is number => id !== null));
  return season.slots[team].filter((id) => id !== null && before.has(id)).length;
}

const seedOf = (d: Dynasty, season: DSeason) => {
  let h = season.index * 7919;
  for (const c of d.id) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return h >>> 0;
};

/** A season's preseason poll: the first season's is the real AP poll the ROM sets (firstSeasonPoll); later ones the app's. */
export function preseasonPoll(d: Dynasty, season: DSeason): PollEntry[] | null {
  const i = d.seasons.indexOf(season);
  if (i === 0) return firstSeasonPoll(d, season);
  if (i < 1 || !season.teamOvr) return null;
  const prev = d.seasons[i - 1];
  const n = d.teams.length;
  const lastRank = seasonView(d, prev).rank;
  const imported = prev.imports.length > 0;
  const ovr = season.teamOvr.map((o) => (o.off + o.def) / 2);
  const last = lastRank.map((r) => (!imported || !r ? 0 : r <= 25 ? 26 - r : -(r - 25) / 25));
  const ret = d.teams.map((_, t) => returningStarters(prev, season, t));
  const pres = season.prestige ?? seasonPrestige(d, season);
  const [zo, zl, zr, zp] = [z(ovr), z(last), z(ret), z(pres)];
  const W = POLL_WEIGHTS;
  const score = d.teams.map((_, t) => W.ovr * zo[t] + W.last * zl[t] + W.returning * zr[t] + W.prestige * zp[t]);

  // The voters: each ranks by score + noise; 25 … 1 points, first-place votes.
  const r = rng(seedOf(d, season));
  const gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
  const points = new Array(n).fill(0);
  const firsts = new Array(n).fill(0);
  const byScore = d.teams.map((_, t) => t).sort((a, b) => score[b] - score[a]);
  const pool = byScore.slice(0, Math.min(n, 40)); // nobody past 40 by score gets a vote
  for (let v = 0; v < VOTERS; v++) {
    const ballot = pool.map((t) => ({ t, s: score[t] + VOTER_NOISE * gauss() })).sort((a, b) => b.s - a.s).slice(0, 25);
    ballot.forEach((x, k) => { points[x.t] += 25 - k; });
    firsts[ballot[0].t]++;
  }
  const order = d.teams.map((_, t) => t).sort((a, b) => points[b] - points[a] || score[b] - score[a] || a - b);
  return order.map((t, k) => ({
    team: t, rank: k + 1, points: points[t], firstVotes: firsts[t], score: score[t],
    ovr: ovr[t], lastRank: imported ? lastRank[t] : null, returning: ret[t], prestige: pres[t],
  }));
}

/** The poll as the season ROM carries it (dynastyArea.ts "PRE1"): place order, with points and first-place votes. */
export const pollSet = (poll: PollEntry[]) => poll.map((p) => ({ team: p.team, points: p.points, firstVotes: p.firstVotes }));
