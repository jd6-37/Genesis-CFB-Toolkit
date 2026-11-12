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

/**
 * Experience at his current school (user, 2026-11-12), as college rosters show it: letters earned there,
 * one per completed season on the team ("2L"); "TR" for a transfer who hasn't played a season there yet,
 * "HS" for a first-year player out of high school. `lastDone` is the last completed season's year. The
 * starting players' seasons before the dynasty count by their starting class (FR 0 … SR+ 4: CFB 27 has no
 * earlier history, so they're taken as having been at their school all along). `from`: the school he
 * transferred from, if he did.
 */
export function experienceOf(p: DPlayer, lastDone: number, startYear: number): { letters: number; label: string; from: number | null } {
  if (p.team === null) return { letters: 0, label: '', from: null };
  const years = p.years ?? [];
  let letters = years.filter((y) => y.team === p.team && y.year <= lastDone).length;
  const first = years[0];
  if (p.srcId !== undefined && first && first.year === startYear && first.team === p.team) letters += CLASS_INDEX[first.cls];
  const into = (p.transfers ?? []).filter((x) => x.to === p.team).at(-1);
  const from = into ? into.from : null;
  return { letters, label: letters > 0 ? `${letters}L` : from !== null ? 'TR' : 'HS', from };
}

const CLASS_INDEX: Record<ClassYear, number> = { FR: 0, SO: 1, JR: 2, SR: 3, 'SR+': 4 };
