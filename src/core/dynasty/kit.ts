// Home jerseys in a dynasty (handoff H-004; user, 2026-11-12: "I can also add ability to change that during the
// offseason in the Dynasty app"): each team's "wears white at home" flag of the ROM's alternate-uniforms table
// (kits.ts). Read from the ROM when the dynasty is created, changed for the user's teams between seasons, and
// written back into every season ROM. The teams' extra uniforms stay as the ROM has them (the Toolkit edits those).
import { hasKits, readKits, writeKits } from '../kits';
import type { DSeason, Dynasty } from './model';

/** The flags a new dynasty starts with (undefined on a ROM without the uniform picker). */
export const whiteHomeOf = (rom: Uint8Array): boolean[] | undefined => (hasKits(rom) ? readKits(rom).map((k) => k.whiteHome) : undefined);

/** Why a team's home jersey can't be changed now, or null. */
export function whiteHomeLock(d: Dynasty, team: number): string | null {
  if (!d.whiteHome) return 'This dynasty\'s ROM has no alternate uniforms.';
  if (!d.userTeams.includes(team)) return 'You can change the home jersey of your own teams.';
  const s = d.seasons[d.seasons.length - 1];
  if (!d.offseason && s.imports.length) return 'The home jersey can be changed in the offseason, before the next season starts.';
  return null;
}

/** Sets whether a user team wears white at home; after a ROM download the ROM has to be written again. */
export function setWhiteHome(d: Dynasty, team: number, on: boolean): Dynasty {
  const lock = whiteHomeLock(d, team);
  if (lock) throw new Error(lock);
  if (d.whiteHome![team] === on) return d;
  const whiteHome = d.whiteHome!.slice(); whiteHome[team] = on;
  const s = d.seasons[d.seasons.length - 1];
  const season: DSeason = s.romDownloaded && !d.offseason
    ? { ...s, lineupEdited: true, rosterVersion: s.lineupEdited ? s.rosterVersion ?? 1 : (s.rosterVersion ?? 1) + 1 }
    : s;
  return { ...d, whiteHome, seasons: [...d.seasons.slice(0, -1), season] };
}

/** Writes the dynasty's flags into a season ROM's uniforms table (nothing on a ROM without one). */
export function applyWhiteHome(rom: Uint8Array, d: Dynasty): void {
  if (!d.whiteHome || !hasKits(rom)) return;
  const kits = readKits(rom);
  kits.forEach((k, t) => { k.whiteHome = !!d.whiteHome![t]; });
  writeKits(rom, kits);
}
