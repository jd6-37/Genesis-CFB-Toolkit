// Each player's ratings year by year (user, 2026-11-12: "save a player's yearly progression/ratings every
// year. That way we can add later a way to display the progression over their career"). A record is kept
// for every player on a team when a season is set up (the dynasty's start, each finished offseason) and
// updated when that season's roster is edited before it's played (editor, CSV, lineup moves).

import type { ClassYear, DPlayer } from './model';
import { RATINGS } from './ratings';

/** One season of a player's career: as he started it (after any preseason edits). */
export interface YearRecord {
  year: number;
  team: number;
  pos: string;
  cls: ClassYear;
  ovr: number;
  /** The ratings in RATINGS order (ratings.ts), one decimal (progress between the game's steps). */
  r: number[];
}

/** A record's ratings by name. */
export const recordRatings = (y: YearRecord) => Object.fromEntries(RATINGS.map((a, i) => [a, y.r[i]]));

/** Every player on a team gets (or replaces) his record for the year; others are left as they are. */
export function recordYear(players: DPlayer[], year: number): DPlayer[] {
  return players.map((p) => {
    if (p.status !== 'active' || p.team === null) return p;
    const rec: YearRecord = {
      year, team: p.team, pos: p.pos, cls: p.cls, ovr: p.ovr,
      r: RATINGS.map((a) => Math.round((p.ratings[a] ?? 0) * 10) / 10),
    };
    const years = (p.years ?? []).filter((y) => y.year !== year);
    return { ...p, years: [...years, rec].sort((a, b) => a.year - b.year) };
  });
}
