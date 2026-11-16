// Conferences in the offseason (user, 2026-11-16: "We can edit conferences/conf alignment in dynasty offseason like
// we can in toolkit, right? If not, build that (for 94 and 26)").
//
// The new season's conference names, members and conference weeks, edited as the Toolkit's Season tab edits them
// (seasonWide.ts), before the season starts. Moving a team or changing a conference's games makes a new schedule
// (the dynasty's schedule follows the conferences); a new name doesn't. The season ROM gets the conferences
// (seasonRom → writeConferences), so the game's standings, title games and, in the 1994 edition, bowl invitations
// follow them. Each season keeps its own conferences, so earlier seasons' standings stay as they were.

import { readWideSeason, wideSeasonIssues, wideSeasonProblems, writeWideSeason, type WideSeason } from '../seasonWide';
export { SEC_EAST_1994 } from '../seasonWide';
import { editionOf } from './edition';
import type { DSeason, Dynasty } from './model';
import { lastGames, makeSchedule, RELEASE_CONF_WEEKS } from './schedule';

/**
 * A season's conferences: names (11, the last the Independents), each team's conference, the conference weeks and
 * the title game switches (H-011: per conference a title game, and the 1994 SEC divisions for it).
 */
export type ConfSetup = WideSeason & { titleGames: number[] };

/**
 * Where the 1994 edition's bowls take each conference's champion (bowls94.py: by the conference's place in the list,
 * not its name). The Coalition's hosts are the Orange, Sugar and Cotton; its pool the ACC and Big East champions.
 */
export const BOWL_TIES_1994 = ['Sugar Bowl', 'Rose Bowl', 'Bowl Coalition', 'Orange Bowl', 'Cotton Bowl', 'Rose Bowl', 'Bowl Coalition', 'Holiday Bowl', 'Las Vegas Bowl', 'Las Vegas Bowl'];

/** A season's conferences as the editor shows them (title game switches: the season's, else the edition's defaults). */
export function confSetupOf(d: Dynasty, s: DSeason): ConfSetup {
  const w = s.confWeeks ?? RELEASE_CONF_WEEKS;
  return {
    names: s.confNames.slice(), conf: s.conf.slice(), start: w.start.slice(), games: w.games.slice(),
    titleGames: (s.titleGames ?? editionOf(d).titleGames).slice(),
  };
}

const same = (a: readonly (number | string)[], b: readonly (number | string)[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Teams or conference weeks differ (a new schedule is needed); names and title games don't. */
export const alignmentChanged = (a: WideSeason, b: WideSeason) => !same(a.conf, b.conf) || !same(a.start, b.start) || !same(a.games, b.games);

/** Anything differs (names compared as saved: trimmed; switches only when both have them). */
export const confChanged = (a: WideSeason, b: WideSeason) =>
  alignmentChanged(a, b) || !same(a.names.map((n) => n.trim()), b.names.map((n) => n.trim())) ||
  (!!a.titleGames && !!b.titleGames && !same(a.titleGames, b.titleGames));

/** Why the newest season's conferences can't be changed now, or null. */
export function confLock(d: Dynasty): string | null {
  const s = d.seasons[d.seasons.length - 1];
  if (s.index === 0) return "The first season's conferences are the ROM's. They can be changed in the offseason, before the next season.";
  if (s.imports.length) return `The ${s.year} season has started: its conferences are set. They can be changed in the next offseason.`;
  return null;
}

/** Why these conferences can't be used in this dynasty; empty if they can. */
export function confIssues(d: Dynasty, s: ConfSetup): string[] {
  if (s.conf.length !== d.teams.length) return ['The conference list has the wrong number of teams.'];
  return wideSeasonIssues(s, editionOf(d).confRules);
}

/**
 * Sets the newest season's conferences. A change of teams or conference weeks makes a new schedule (the same seed;
 * changes made to the old schedule are gone). After a ROM download, the ROM has to be written again.
 */
export function setConferences(d: Dynasty, next: ConfSetup): Dynasty {
  const lock = confLock(d);
  if (lock) throw new Error(lock);
  const issues = confIssues(d, next);
  if (issues.length) throw new Error(issues[0]);
  const s = d.seasons[d.seasons.length - 1];
  const cur = confSetupOf(d, s);
  if (!confChanged(cur, next)) return d;
  const confWeeks = { start: next.start.slice(), games: next.games.slice() };
  const season: DSeason = {
    ...s,
    conf: next.conf.slice(),
    confNames: next.names.map((n) => n.trim()),
    confWeeks,
    titleGames: next.titleGames.slice(),
    ...(s.romDownloaded ? { lineupEdited: true, rosterVersion: s.lineupEdited ? s.rosterVersion ?? 1 : (s.rosterVersion ?? 1) + 1 } : {}),
  };
  if (s.schedule && alignmentChanged(cur, next)) {
    const prev = d.seasons[d.seasons.length - 2];
    season.schedule = makeSchedule({
      schools: d.teams.map((t) => t.school),
      conf: season.conf,
      confWeeks,
      last: prev ? lastGames(d, prev) : undefined,
      seed: s.schedule.seed,
      weeks: editionOf(d).regWeeks,
      edition: editionOf(d).id,
    });
  }
  return { ...d, seasons: [...d.seasons.slice(0, -1), season] };
}

/**
 * Writes a season's conferences into its ROM (seasonRom) where they differ from the ROM's own, so a ROM whose
 * conferences the dynasty never changed keeps its bytes.
 */
export function writeConferences(rom: Uint8Array, d: Dynasty, s: DSeason): void {
  let want: WideSeason = confSetupOf(d, s);
  const problems = wideSeasonProblems(rom);
  if (problems.length) {
    // A ROM whose conference tables can't be read: fine as long as the dynasty kept the first season's conferences.
    if (!confChanged(want, confSetupOf(d, d.seasons[0]))) return;
    throw new Error(`This ROM's conferences can't be changed (${problems.join('; ')}), and the ${s.year} season has its own.`);
  }
  const has = readWideSeason(rom);
  if (!has.titleGames) {
    // A ROM from before the switches plays the edition's default title games.
    if (!same(want.titleGames!, editionOf(d).titleGames)) {
      throw new Error(`The ${s.year} season has its own title games, and this ROM can't change them: use the ${editionOf(d).name}'s ${editionOf(d).id === '1994' ? 'test33' : 'test31'} or later.`);
    }
    want = { ...want, titleGames: undefined };
  }
  if (!confChanged(want, has)) return;
  writeWideSeason(rom, want, editionOf(d).confRules);
}
