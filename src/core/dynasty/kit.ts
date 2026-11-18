// Uniforms in a dynasty (handoff H-004; user, 2026-11-18: "Let's do the uniform thing. full uniform editing", "all
// teams's unis editable"): each team's extra helmets, jerseys and pants for the picker on the controller screen and
// its "wears white at home" flag (the ROM's alternate-uniforms table, kits.ts). Any team, any time, mid-season too:
// the save keeps no uniform (the picker's choice lasts one game), so a season continues on a ROM whose only change
// is uniforms. A change after the season's ROM was downloaded asks for the ROM again, without a new roster version.
//
// What the dynasty keeps: the ROM's own uniforms as a snapshot for the editor and the pages (`romUniforms`, read
// when the dynasty is made or the first time the editor gets the ROM), the flags (`whiteHome`), and only the teams
// the user changed (`kitEdits`). Season ROMs get the ROM's table with those teams put in.
import { hasKits, kitIssues, ownUniforms, readKits, readKitSprite, writeKits, writeOwnUniforms, type KitSprite, type OwnUniforms, type TeamKit } from '../kits';
import { fromBase64, toBase64, type DSeason, type Dynasty } from './model';

export interface RomUniforms {
  /** Each team's own home and away uniform palettes (16 Genesis colors each): the picker's first choices. */
  own: { home: number[]; away: number[] }[];
  /** The ROM's table: each team's extras. */
  kits: TeamKit[];
  /** The player the editor shows each piece on (the picker's sprite; tiles in base64). Absent on older snapshots. */
  sprite?: { sprites: KitSprite['sprites']; tiles: string };
}

/** The flags a new dynasty starts with (undefined on a ROM without the uniform picker). */
export const whiteHomeOf = (rom: Uint8Array): boolean[] | undefined => (hasKits(rom) ? readKits(rom).map((k) => k.whiteHome) : undefined);

/** The ROM's uniforms for the editor (undefined on a ROM without the uniform picker). */
export function romUniformsOf(rom: Uint8Array, teams: number): RomUniforms | undefined {
  if (!hasKits(rom)) return undefined;
  const kits = readKits(rom);
  if (kits.length !== teams) return undefined;
  const sp = readKitSprite(rom);
  return { own: kits.map((_, t) => ownUniforms(rom, t)), kits, ...(sp && { sprite: { sprites: sp.sprites, tiles: toBase64(sp.tiles) } }) };
}

/** The editor's player sprite, or null. */
export const kitSpriteOf = (d: Dynasty): KitSprite | null => (d.romUniforms?.sprite ? { sprites: d.romUniforms.sprite.sprites, tiles: fromBase64(d.romUniforms.sprite.tiles) } : null);

/** A team's own home and away uniforms now: the user's change, else the ROM's. */
export const ownOf = (d: Dynasty, team: number): OwnUniforms | null => d.ownEdits?.[team] ?? d.romUniforms?.own[team] ?? null;

/** Sets a team's own home and away uniforms (the uniform places only; the editor warns first). */
export function setOwn(d: Dynasty, team: number, own: OwnUniforms): Dynasty {
  const lock = kitLock(d);
  if (lock) throw new Error(lock);
  if (!d.romUniforms) throw new Error('Choose your ROM first: the editor starts from its uniforms.');
  const rom = d.romUniforms.own[team];
  const edits = { ...(d.ownEdits ?? {}) };
  if (JSON.stringify(own) === JSON.stringify(rom)) delete edits[team];
  else edits[team] = { home: own.home.slice(), away: own.away.slice() };
  return { ...d, ownEdits: Object.keys(edits).length ? edits : undefined, seasons: romOutdated(d) };
}

/** Why a team's uniforms can't be changed, or null. */
export function kitLock(d: Dynasty): string | null {
  if (!d.whiteHome) return 'This dynasty\'s ROM has no alternate uniforms.';
  return null;
}
/** Kept for the home jersey menu. */
export const whiteHomeLock = (d: Dynasty, _team?: number): string | null => kitLock(d);

/** A team's uniforms now: the user's change, else the ROM's; the flag from `whiteHome`. Null without the snapshot. */
export function kitOf(d: Dynasty, team: number): TeamKit | null {
  const k = d.kitEdits?.[team] ?? d.romUniforms?.kits[team];
  if (!k) return null;
  return { ...k, whiteHome: !!d.whiteHome?.[team] };
}

/**
 * The season's ROM needs downloading again: the current season once its ROM was downloaded, and the first season
 * always (it's played on the user's own ROM, which doesn't have the change). Never in the offseason (the next
 * season's ROM comes at its end).
 */
function romOutdated(d: Dynasty): DSeason[] {
  const s = d.seasons[d.seasons.length - 1];
  if (d.offseason || s.kitsEdited || (!s.romDownloaded && s.index > 0)) return d.seasons;
  return [...d.seasons.slice(0, -1), { ...s, kitsEdited: true }];
}

/** Sets whether a team wears white at home. */
export function setWhiteHome(d: Dynasty, team: number, on: boolean): Dynasty {
  const lock = kitLock(d);
  if (lock) throw new Error(lock);
  if (d.whiteHome![team] === on) return d;
  const whiteHome = d.whiteHome!.slice(); whiteHome[team] = on;
  return { ...d, whiteHome, seasons: romOutdated(d) };
}

/** Sets a team's extra helmets, jerseys and pants (its flag stays `whiteHome`'s). Throws when the table won't fit. */
export function setKit(d: Dynasty, team: number, kit: TeamKit, names?: string[]): Dynasty {
  const lock = kitLock(d);
  if (lock) throw new Error(lock);
  if (!d.romUniforms) throw new Error('Choose your ROM first: the editor starts from its uniforms.');
  const strip = (k: TeamKit): TeamKit => ({ helmets: k.helmets, dark: k.dark, white: k.white, pants: k.pants, whiteHome: false });
  const next = strip(kit);
  const all = d.romUniforms.kits.map((k, t) => strip(t === team ? next : d.kitEdits?.[t] ?? k));
  const issues = kitIssues(all, names);
  if (issues.length) throw new Error(issues[0]);
  const edits = { ...(d.kitEdits ?? {}) };
  if (JSON.stringify(next) === JSON.stringify(strip(d.romUniforms.kits[team]))) delete edits[team];
  else edits[team] = next;
  return { ...d, kitEdits: Object.keys(edits).length ? edits : undefined, seasons: romOutdated(d) };
}

/** Writes the dynasty's uniforms into a ROM's table: the user's teams over the ROM's own, every flag (nothing on a ROM without one). */
export function applyKits(rom: Uint8Array, d: Dynasty): void {
  if (!d.whiteHome || !hasKits(rom)) return;
  const kits = readKits(rom).map((k, t) => {
    const e = d.kitEdits?.[t];
    return { ...(e ?? k), whiteHome: !!d.whiteHome![t] };
  });
  writeKits(rom, kits);
  for (const [t, own] of Object.entries(d.ownEdits ?? {})) writeOwnUniforms(rom, Number(t), own);
}
/** Kept for older callers. */
export const applyWhiteHome = applyKits;
