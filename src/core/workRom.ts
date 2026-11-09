// The working ROM that the Season, Teams and Rosters tabs edit together. Pure helpers, no DOM.
//
// The three tabs write different bytes (Season: conference names and words, the schedule template
// and its tables; Teams: the CPU's team set table and the 3-4 roster flags, each team's ratings and
// home weather (group +0 to +5), Elevated's OVR table and the Walsh Report text; Rosters: roster records
// and the OL display tweak; a CFB 27 conversion can set ratings too), so all edit the same buffer in place. Team Swap keeps every
// roster and ratings group per slot, so edits can be carried from one ROM to another of the same
// game: a new Team Swap result, or another build.

import { detectGame, openRosterRom } from './rosterRom';
import { installOlPatch, olPatchState, OL_PATCH } from './rosterOlPatch';
import { dealMode, LOCK_TABLE_SIZE, readSeason, SEASON_AREAS, SLOTS, WEEKS, writeSeason } from './season';
import { readStyle, STYLE_RANGES, styleChanges, styleProblems, writeStyle } from './styles';
import { ratingChanges, ratingProblems, ratingRanges, readRating, readWeather, writeRating, writeWeather } from './teamRatings';
import { rl, rw } from './bytes';
import { parseBw95 } from './bw95';
import { editedReports, readReport, reportLength, REPORT_LIMIT, writeReports, type Report } from './walshReports';
import type { Game } from './rosterLayouts';

export interface CarryResult {
  rosters: number;
  olTweak: boolean;
  season: boolean;
  /** Teams whose style, ratings, home weather or Walsh Report was carried. */
  teams: number;
  /** Things that couldn't be carried, as readable lines. */
  skipped: string[];
}

/** Season bytes that the Season tab writes, as [start, end) ranges (team conference words included). */
function seasonRanges(d: Uint8Array): [number, number][] {
  const r: [number, number][] = [
    [SEASON_AREAS.names[0], SEASON_AREAS.names[3] + 24],
    [SEASON_AREAS.template, SEASON_AREAS.template + WEEKS * SLOTS],
    [SEASON_AREAS.dealTable, SEASON_AREAS.dealTable + 16],
    [SEASON_AREAS.dealLoop, SEASON_AREAS.dealLoop + 40],
    [SEASON_AREAS.lockTable, SEASON_AREAS.lockTable + LOCK_TABLE_SIZE],
  ];
  for (let t = 0; t < SLOTS; t++) {
    const block = rl(d, SEASON_AREAS.teamTable + 4 * t);
    const w = block + rw(d, block + 6) + 6;
    r.push([w, w + 2]);
  }
  return r;
}

const differs = (a: Uint8Array, b: Uint8Array, ranges: [number, number][]) =>
  ranges.some(([s, e]) => {
    for (let k = s; k < e; k++) if (a[k] !== b[k]) return true;
    return false;
  });

export interface Edits {
  season: boolean;
  /** The Teams tab's bytes: styles, ratings, home weather, Walsh Reports. */
  teams: boolean;
  rosters: boolean;
  any: boolean;
}

/** Which tools changed a ROM since it was loaded. */
export function editsSince(base: Uint8Array, data: Uint8Array, game: Game): Edits {
  let any = false;
  for (let k = 0; k < data.length; k++) {
    if (data[k] !== base[k]) {
      any = true;
      break;
    }
  }
  if (!any) return { season: false, teams: false, rosters: false, any };
  const rom = openRosterRom(base);
  const len = rom.info.players * rom.info.stride;
  const rosterRanges: [number, number][] = rom.teams.map((t) => [t.rosterOffset, t.rosterOffset + len]);
  if (game === 'bw95') rosterRanges.push([OL_PATCH.site, OL_PATCH.site + 8], [OL_PATCH.hook, OL_PATCH.hook + OL_PATCH.hookCode.length]);
  return {
    season: game === 'bw95' && differs(base, data, seasonRanges(base)),
    teams:
      game === 'bw95' &&
      (differs(base, data, STYLE_RANGES) ||
        (!ratingProblems(base).length && differs(base, data, ratingRanges(base))) ||
        reportsDiffer(base, data)),
    rosters: differs(base, data, rosterRanges),
    any,
  };
}

/** Whether a Walsh Report changed (a renamed conference's mention doesn't count: that's the Season tab's). */
function reportsDiffer(base: Uint8Array, data: Uint8Array): boolean {
  try {
    return editedReports(base, data).length > 0 || longTrimmed(base, data);
  } catch {
    return false;
  }
}

/** The trim the first edit makes to every long report, when that's all that changed. */
function longTrimmed(base: Uint8Array, data: Uint8Array): boolean {
  for (let s = 0; s < 36; s++) {
    if (reportLength(readReport(base, s)) > REPORT_LIMIT && reportLength(readReport(data, s)) <= REPORT_LIMIT) return true;
  }
  return false;
}

/** Download name: the ROM's name with a tag for each tool whose changes it holds. */
export function workFileName(name: string, edits: { season: boolean; teams?: boolean; rosters: boolean }): string {
  let stem = name.replace(/\.(md|bin|gen|zip)$/i, '');
  // [Styles] is what the Teams tab's tag was called before it took ratings and weather too.
  while (/\s*\[(Season|Styles|Teams|Rosters)\]$/i.test(stem)) stem = stem.replace(/\s*\[(Season|Styles|Teams|Rosters)\]$/i, '');
  stem = stem.replace(/[^A-Za-z0-9 &'.()[\]-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tags = [edits.season && '[Season]', edits.teams && '[Teams]', edits.rosters && '[Rosters]'].filter(Boolean);
  if (!tags.length) tags.push('[Rosters]'); // only a repaired checksum check
  return `${stem} ${tags.join(' ')}.md`;
}

/** Whether edits from one ROM can be carried into another (same game, same teams). */
export function canCarry(from: Uint8Array, to: Uint8Array): boolean {
  const g = detectGame(from);
  return !!g && g === detectGame(to);
}

/**
 * Puts the Season, Teams and Rosters edits of `from` into `to` (in place): every team's roster by
 * slot, the OL display tweak, and (BW95) the conferences and schedules and each team's styles,
 * ratings and home weather. Team Swap keeps rosters and conferences per slot, so a swapped team gets
 * the edits made for its slot. Team Swap sets styles, ratings and weather itself, so with `fromBase`
 * (the bytes `from` was loaded with) only those changed since then are carried; without it, every
 * one that differs.
 */
export function carryEdits(from: Uint8Array, to: Uint8Array, fromBase?: Uint8Array): CarryResult {
  if (!canCarry(from, to)) throw new Error("The edits can't be carried: the two ROMs aren't the same game.");
  const a = openRosterRom(from);
  const b = openRosterRom(to);
  const len = a.info.players * a.info.stride;
  for (let i = 0; i < a.teams.length; i++) {
    const s = a.teams[i].rosterOffset;
    to.set(from.subarray(s, s + len), b.teams[i].rosterOffset);
  }
  const res: CarryResult = { rosters: a.teams.length, olTweak: false, season: false, teams: 0, skipped: [] };
  if (a.game !== 'bw95') return res;
  if (olPatchState(from) === 'installed' && olPatchState(to) !== 'installed') {
    try {
      installOlPatch(to);
      res.olTweak = true;
    } catch (e) {
      res.skipped.push(`OL weight tweak: ${(e as Error).message}`);
    }
  }
  if (dealMode(from) !== 'unknown') {
    try {
      writeSeason(to, readSeason(from));
      res.season = true;
    } catch (e) {
      res.skipped.push(`Season: ${(e as Error).message}`);
    }
  }
  const carried = new Set<number>();
  if (!styleProblems(from).length) {
    const teams = fromBase ? styleChanges(fromBase, from) : styleChanges(to, from);
    if (teams.length) {
      const p = styleProblems(to);
      if (p.length) res.skipped.push(`Styles: ${p.join('; ')}`);
      else {
        for (const t of teams) writeStyle(to, t, readStyle(from, t));
        teams.forEach((t) => carried.add(t));
      }
    }
  }
  if (!ratingProblems(from).length) {
    const teams = fromBase ? ratingChanges(fromBase, from) : ratingChanges(to, from);
    if (teams.length) {
      const p = ratingProblems(to);
      if (p.length) res.skipped.push(`Ratings and weather: ${p.join('; ')}`);
      else {
        for (const t of teams) {
          writeRating(to, t, readRating(from, t));
          writeWeather(to, t, readWeather(from, t));
        }
        teams.forEach((t) => carried.add(t));
      }
    }
  }
  // Walsh Reports edited since loading, for slots that still hold the same team (a report is about its team).
  try {
    const base = fromBase ?? to;
    const edited = editedReports(base, from);
    if (edited.length) {
      const fromNames = parseBw95(from).map((t) => t.school);
      const toNames = parseBw95(to).map((t) => t.school);
      const reports = new Map<number, Report>();
      for (const t of edited) {
        if (fromNames[t] === toNames[t]) reports.set(t, readReport(from, t));
        else res.skipped.push(`Walsh Report of ${fromNames[t]}: its slot now holds ${toNames[t]}`);
      }
      if (reports.size) {
        writeReports(to, reports);
        reports.forEach((_, t) => carried.add(t));
      }
    }
  } catch (e) {
    res.skipped.push(`Walsh Reports: ${(e as Error).message}`);
  }
  res.teams = carried.size;
  return res;
}
