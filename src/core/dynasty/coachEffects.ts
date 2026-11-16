// What a head coach does to his team (spec "Effects", all subtle): his players develop a little faster or slower,
// his school's recruiting points go a little further, his players are a little less likely to transfer, and when
// he leaves, his players are likelier to transfer and to follow him (2026 only: the 1994 edition has no transfers
// in the spec's sense). The sim effect (OFF / DEF words) is not built (spec: later, after careful testing).
import type { DCoach } from './coaches';
import { coachOvr } from './coaches';
import type { Dynasty } from './model';
import { editionOf } from './edition';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The coach of a team now (the offseason's hiring included). */
export const headCoach = (d: Dynasty, team: number): DCoach | undefined => d.coaches?.find((c) => c.team === team && c.status === 'coach');

const OFFENSE_PASS = new Set(['QB', 'WR', 'TE']);
const OFFENSE_RUN = new Set(['HB', 'FB', 'LT', 'LG', 'C', 'RG', 'RT']);
const KICKERS = new Set(['K', 'P']);

/** 0.85 for a 1-star coach … 1.15 for a 5-star one (prestige amplifies his boosts). */
export const prestigeFactor = (c: DCoach) => 0.85 + 0.075 * (c.prestige - 1);

/**
 * A player's development boost from his head coach, about −10% … +10%: his rating for the position group plus
 * half his Development rating, centered on 70 (99 / 99 gives +10% before prestige; 40 / 40 −10%), × prestige.
 */
export function developmentBoost(c: DCoach | undefined, pos: string): number {
  if (!c) return 0;
  const group = OFFENSE_PASS.has(pos) ? c.ratings.passing : OFFENSE_RUN.has(pos) ? c.ratings.running : KICKERS.has(pos) ? c.ratings.development : c.ratings.defense;
  const lean = ((group - 70) + 0.5 * (c.ratings.development - 70)) / (1.5 * 29);
  return clamp(0.1 * lean * prestigeFactor(c), -0.12, 0.12);
}

/** Recruiting: his school's points cost a little less with a good recruiter (at most about 10% at 99, more at 40). */
export function recruitingDiscount(c: DCoach | undefined): number {
  if (!c) return 0;
  return clamp(0.1 * ((c.ratings.recruiting - 70) / 29) * prestigeFactor(c), -0.1, 0.12);
}

/** The random signing classes: a good recruiter lifts the school's standing a little (0-1 scale, ±0.05 at most). */
export function recruitingLift(c: DCoach | undefined): number {
  if (!c) return 0;
  return clamp(0.05 * ((c.ratings.recruiting - 70) / 29) * prestigeFactor(c), -0.05, 0.06);
}

/** Transfers only in the 2026 edition (spec: "no transfers in 1994"). */
export const coachTransfers = (d: Dynasty) => !!d.coaches && editionOf(d).id === '2026';

/**
 * His players' transfer chance: a good coach keeps them a little more (OVR 99: −15%, OVR 55: +8%), and in the
 * offseason after the coach of last season left, his former players are likelier to go, starters too (+10 points).
 */
export function transferFactor(d: Dynasty, team: number): { times: number; plus: number; followTo: number | null } {
  if (!coachTransfers(d)) return { times: 1, plus: 0, followTo: null };
  const now = headCoach(d, team);
  const was = d.seasons[d.seasons.length - 1]?.coach?.[team] ?? null;
  const times = now ? clamp(1 - 0.15 * ((coachOvr(now.ratings) - 70) / 29), 0.85, 1.1) : 1;
  if (was === null || now?.id === was) return { times, plus: 0, followTo: null };
  // The coach left: where he is now (another school's head coach), if anywhere.
  const gone = d.coaches![was];
  return { times, plus: 0.1, followTo: gone?.status === 'coach' && gone.team !== null && gone.team !== team ? gone.team : null };
}
