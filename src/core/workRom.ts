// The working ROM that the Season, Styles and Rosters tabs edit together. Pure helpers, no DOM.
//
// The three tabs write different bytes (Season: conference names and words, the schedule template
// and its tables; Styles: the CPU's team set table and the 3-4 roster flags; Rosters: roster
// records and the OL display tweak), so all edit the same buffer in place. Team Swap keeps every
// roster and ratings group per slot, so edits can be carried from one ROM to another of the same
// game: a new Team Swap result, or another build.

import { detectGame, openRosterRom } from './rosterRom';
import { installOlPatch, olPatchState, OL_PATCH } from './rosterOlPatch';
import { dealMode, LOCK_TABLE_SIZE, readSeason, SEASON_AREAS, SLOTS, WEEKS, writeSeason } from './season';
import { readStyle, STYLE_RANGES, styleChanges, styleProblems, writeStyle } from './styles';
import { rl, rw } from './bytes';
import type { Game } from './rosterLayouts';

export interface CarryResult {
  rosters: number;
  olTweak: boolean;
  season: boolean;
  /** Teams whose style was carried. */
  styles: number;
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
  styles: boolean;
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
  if (!any) return { season: false, styles: false, rosters: false, any };
  const rom = openRosterRom(base);
  const len = rom.info.players * rom.info.stride;
  const rosterRanges: [number, number][] = rom.teams.map((t) => [t.rosterOffset, t.rosterOffset + len]);
  if (game === 'bw95') rosterRanges.push([OL_PATCH.site, OL_PATCH.site + 8], [OL_PATCH.hook, OL_PATCH.hook + OL_PATCH.hookCode.length]);
  return {
    season: game === 'bw95' && differs(base, data, seasonRanges(base)),
    styles: game === 'bw95' && differs(base, data, STYLE_RANGES),
    rosters: differs(base, data, rosterRanges),
    any,
  };
}

/** Download name: the ROM's name with a tag for each tool whose changes it holds. */
export function workFileName(name: string, edits: { season: boolean; styles?: boolean; rosters: boolean }): string {
  let stem = name.replace(/\.(md|bin|gen|zip)$/i, '');
  while (/\s*\[(Season|Styles|Rosters)\]$/i.test(stem)) stem = stem.replace(/\s*\[(Season|Styles|Rosters)\]$/i, '');
  stem = stem.replace(/[^A-Za-z0-9 &'.()[\]-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tags = [edits.season && '[Season]', edits.styles && '[Styles]', edits.rosters && '[Rosters]'].filter(Boolean);
  if (!tags.length) tags.push('[Rosters]'); // only a repaired checksum check
  return `${stem} ${tags.join(' ')}.md`;
}

/** Whether edits from one ROM can be carried into another (same game, same teams). */
export function canCarry(from: Uint8Array, to: Uint8Array): boolean {
  const g = detectGame(from);
  return !!g && g === detectGame(to);
}

/**
 * Puts the Season, Styles and Rosters edits of `from` into `to` (in place): every team's roster by
 * slot, the OL display tweak, and (BW95) the conferences and schedules and the team styles. Team
 * Swap keeps rosters and conferences per slot, so a swapped team gets the edits made for its slot.
 * Team Swap can set styles itself, so with `fromBase` (the bytes `from` was loaded with) only the
 * styles changed since then are carried; without it, every style that differs.
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
  const res: CarryResult = { rosters: a.teams.length, olTweak: false, season: false, styles: 0, skipped: [] };
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
  if (!styleProblems(from).length) {
    const teams = fromBase ? styleChanges(fromBase, from) : styleChanges(to, from);
    if (teams.length) {
      const p = styleProblems(to);
      if (p.length) res.skipped.push(`Styles: ${p.join('; ')}`);
      else {
        for (const t of teams) writeStyle(to, t, readStyle(from, t));
        res.styles = teams.length;
      }
    }
  }
  return res;
}
