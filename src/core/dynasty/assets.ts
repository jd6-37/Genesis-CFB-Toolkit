// The dynasty's copy of the ROM's art and colors (user, 2026-11-20: v2.1.1 brings new team logos; "whenever the Dynasty
// app detects a new version of the ROM, automatically update the assets", and a way to update them from a ROM the
// user changed). What the dynasty copies from the ROM when it's made: each team's colors (`DTeam.colors`: story art,
// team pages) and the uniforms snapshot the uniform editor starts from (`romUniforms`). The logos and helmets are
// kept beside the dynasty in the browser (storage.ts `saveArt`, drawn by art.ts `teamArt`). An upgrade
// (Upgrade.tsx) and Manage's "Update logos and uniforms from a ROM" read them again; the user's own uniform changes
// (`kitEdits`, `ownEdits`) and white-at-home flags stay on top.

import { parseBw95 } from '../bw95';
import { teamsOf } from '../wide';
import { romUniformsOf } from './kit';
import { romBuildOf, type Dynasty } from './model';

/** Each team's colors as the dynasty keeps them: team color, helmet, jersey, pants (home uniform). */
export function teamColorsOf(rom: Uint8Array, count = teamsOf(rom)): number[][] {
  return parseBw95(rom, count).map((b) => [b.home[3], b.home[5], b.home[11], b.home[14]]);
}

/** The dynasty with the colors and uniforms snapshot of this ROM (the user's own uniform changes kept). */
export function refreshRomAssets(d: Dynasty, rom: Uint8Array): Dynasty {
  const n = d.teams.length;
  if (teamsOf(rom) !== n) throw new Error(`This ROM has ${teamsOf(rom)} teams; the dynasty has ${n}.`);
  const colors = teamColorsOf(rom, n);
  const uniforms = romUniformsOf(rom, n);
  return { ...d, teams: d.teams.map((t, i) => ({ ...t, colors: colors[i] })), ...(uniforms ? { romUniforms: uniforms } : {}) };
}

/**
 * Why this ROM can't be the dynasty's ROM for its art (Manage's update): another number of teams, or another Elevated
 * version than the dynasty's own (that is an upgrade: it changes how seasons are built). The same version changed by
 * the user (new logos, say) is fine. Null when it can be used.
 */
export function assetRomProblem(d: Dynasty, kept: Uint8Array | null, rom: Uint8Array): string | null {
  if (teamsOf(rom) !== d.teams.length) return `This ROM has ${teamsOf(rom)} teams; the dynasty has ${d.teams.length}.`;
  const now = romBuildOf(rom), was = kept ? romBuildOf(kept) : d.seasons[d.seasons.length - 1].romBuild;
  if (was && now && now.serial !== was.serial) {
    return `This ROM is ${now.name}, and your dynasty plays ${was.name}. To move the dynasty to another version, use Upgrade on this page.`;
  }
  return null;
}
