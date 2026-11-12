// Training focus (user, 2026-11-12): before the offseason each user team splits 100 points over four
// areas, at most 40 in one; 25 each gives the normal development paces. More points in an area make its
// ratings grow up to 20% faster, fewer up to 20% slower. A year's OVR gain stays the same (develop()
// normalizes), so the focus shapes the kind of player, not how good he gets. The page doesn't say which
// ratings an area touches ("to keep a little mystery"); the Offseason rules page does. Computer teams
// stay at 25 each (user: "cpu stays at 25 each for now").

import type { Dynasty } from './model';
import type { OffseasonRules } from './rules';

export type TrainingArea = 'strength' | 'speed' | 'technique' | 'knowledge';
export type Training = Record<TrainingArea, number>;

export const TRAINING_AREAS: { key: TrainingArea; label: string }[] = [
  { key: 'strength', label: 'Strength program' },
  { key: 'speed', label: 'Speed development' },
  { key: 'technique', label: 'Technique' },
  { key: 'knowledge', label: 'Game knowledge' },
];

export const TRAINING_POINTS = 100;
export const EVEN_TRAINING: Training = { strength: 25, speed: 25, technique: 25, knowledge: 25 };

/** The area a rating trains under. */
export function areaOf(rating: string): TrainingArea | null {
  switch (rating) {
    case 'Power': case 'Range': return 'strength';
    case 'Speed': case 'Quickness': return 'speed';
    case 'Hands': case 'Blocking': case 'Tackling': case 'Accuracy': return 'technique';
    case 'Awareness': return 'knowledge';
    default: return null;
  }
}

/** What's wrong with a split (empty = fine). */
export function trainingProblems(R: OffseasonRules, t: Training): string[] {
  const out: string[] = [];
  const total = TRAINING_AREAS.reduce((s, a) => s + t[a.key], 0);
  if (total !== TRAINING_POINTS) out.push(`Use exactly ${TRAINING_POINTS} points (now ${total}).`);
  for (const a of TRAINING_AREAS) {
    const v = t[a.key];
    if (!Number.isInteger(v) || v < 0 || v > R.trainingMax) out.push(`${a.label}: 0 to ${R.trainingMax} points.`);
  }
  return out;
}

/** A team's split for this offseason: the user's (when valid), else even. */
export function trainingOf(d: Dynasty, R: OffseasonRules, team: number): Training {
  const t = d.userTeams.includes(team) ? d.training?.[team] : undefined;
  return t && !trainingProblems(R, t).length ? t : EVEN_TRAINING;
}

/**
 * The pace factor for an area's points: 25 = 1; at the cap (40) 1 + effect; at 0, 1 − effect (straight
 * lines in between, so the step up and the step down both reach ±effect).
 */
export function trainingFactor(R: OffseasonRules, points: number): number {
  const even = TRAINING_POINTS / TRAINING_AREAS.length;
  if (points >= even) return 1 + (R.trainingEffect * (points - even)) / Math.max(1, R.trainingMax - even);
  return 1 - (R.trainingEffect * (even - points)) / even;
}
