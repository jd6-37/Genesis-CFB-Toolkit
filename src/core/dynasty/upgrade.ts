// Moving a dynasty to a newer Elevated version (user, 2026-11-20: "I'd like to be able to upgrade midseason, if
// possible"; keep the original game for it; mockups approved). Every season ROM is the dynasty's kept base ROM plus the
// dynasty, so an upgrade replaces the kept ROM and builds the season's ROM again (same file name, so the save stays
// with it). Between seasons that's always safe; in a running season only when the new build can continue a season
// started on the old one (its manifest's mid-season-from). The upgrade counts as done when a save from the new ROM is
// imported (the save's ELVB names the build that saved it last; H-033).
import { findRelease, offered, type Patch, type PatchList } from '../patches';
import { KNOWN_BUILDS, newerRomMessage, readManifest } from '../manifest';
import { editionOf, editionOfRom, type EditionId } from './edition';
import { dynastyAreaProblem } from './dynastyArea';
import { romBuildOf, type Dynasty, type DSeason, type RomBuild } from './model';

/** The release patch that makes each edition (Elevated repo, patches.json content ids). From v2.1.0 on, "elevated" is
 * the 1994 Season Edition (before, the 36-team edition, which can't hold a dynasty). */
export const PATCH_CONTENT: Record<EditionId, string> = { '2026': 'elevated-2026', '1994': 'elevated' };

/** A newer release for a dynasty's kept ROM. */
export interface UpgradeOffer {
  /** The release's version, e.g. "v2.1.1". */
  version: string;
  /** The patch that makes the edition (the same fatigue choice as the kept ROM). */
  patch: Patch;
  /** The release's build, when the app knows it (KNOWN_BUILDS), for the mid-season check before patching. */
  build?: { serial: number; midSeasonFrom: number };
}

/**
 * The current release, if the kept ROM is an older release of the same edition (by its SHA-1 in the list). A test
 * build or the current release gets no offer (an upgrade from a file is still possible in Manage).
 */
export function findUpgrade(list: PatchList, keptSha1: string, edition: EditionId): UpgradeOffer | null {
  const found = findRelease(list, keptSha1);
  if (!found || found.current || found.patch.content !== PATCH_CONTENT[edition]) return null;
  const ps = offered(list).filter((p) => p.content === PATCH_CONTENT[edition]);
  const patch = ps.find((p) => p.fatigue === found.patch.fatigue) ?? ps.find((p) => p.fatigue === 'fixed') ?? ps[0];
  if (!patch) return null;
  const version = list.releases[0].version;
  const known = Object.entries(KNOWN_BUILDS[Number(edition)] ?? {}).find(([, b]) => b.name === version);
  return { version, patch, ...(known ? { build: { serial: Number(known[0]), midSeasonFrom: known[1].midSeasonFrom } } : {}) };
}

/** The season a ROM change would affect: the newest one, unless the dynasty is in its offseason. */
const running = (d: Dynasty): DSeason | null => (d.offseason ? null : d.seasons[d.seasons.length - 1]);

/** Whether the newest season may have been started in the game (then a ROM change happens mid-season). */
export function seasonStarted(d: Dynasty): boolean {
  const s = running(d);
  return !!s && ((s.index === 0 && !d.seasonOneRom) || !!s.romDownloaded || s.imports.length > 0);
}

/** The build the running season was started on: from the last import's ELVB, else the ROM it was downloaded from. */
export function seasonStartSerial(d: Dynasty): number | undefined {
  const s = running(d);
  if (!s) return undefined;
  return s.imports[s.imports.length - 1]?.elvb?.startSerial ?? s.romBuild?.serial;
}

/**
 * Whether a build can take over now: "free" (no season running in the game), "safe" (it continues the running
 * season), "later" (it can't: the offseason builds the next season on it), or "unknown" (the build isn't known yet:
 * checked once the ROM is in hand).
 */
export function upgradeTiming(d: Dynasty, build?: { midSeasonFrom: number }): 'free' | 'safe' | 'later' | 'unknown' {
  if (!seasonStarted(d)) return 'free';
  if (!build) return 'unknown';
  const start = seasonStartSerial(d);
  return start !== undefined && start >= build.midSeasonFrom ? 'safe' : 'later';
}

/** Why a ROM can't be the dynasty's new base ROM (null if it can). `kept` is the dynasty's ROM now. */
export function upgradeRomProblem(d: Dynasty, kept: Uint8Array | null, next: Uint8Array): string | null {
  const ed = editionOf(d);
  if (editionOfRom(next)?.id !== ed.id) return `This isn't the ${ed.name}. Load a newer version of it, or the original game.`;
  const m = readManifest(next);
  if (!m) return "This ROM doesn't say which Elevated version it is: use v2.1.0 or later.";
  const newer = newerRomMessage(m);
  if (newer) return newer;
  const area = dynastyAreaProblem(next);
  if (area) return area;
  const now = kept ? readManifest(kept) : null;
  if (now && m.serial < now.serial) return `This is ${m.name}, older than the ${now.name} your dynasty plays on.`;
  if (now && m.serial === now.serial) return `Your dynasty already plays on ${m.name}.`;
  const t = upgradeTiming(d, m);
  if (t === 'later') {
    const s = d.seasons[d.seasons.length - 1];
    return `${m.name} can't continue a season started on an earlier version. Finish the ${s.year} season: the offseason's last step builds the ${s.year + 1} ROM on ${m.name}.`;
  }
  return null;
}

/**
 * The dynasty after its base ROM was replaced by `next`: in a running season, the season waits for a save from the new
 * ROM (`upgrade`), and its ROM must be downloaded again; between seasons nothing waits.
 */
export function applyUpgrade(d: Dynasty, kept: Uint8Array | null, next: Uint8Array): Dynasty {
  const to = romBuildOf(next);
  if (!to) throw new Error("This ROM doesn't say which Elevated version it is.");
  const { upgradeLater: _, ...rest } = d;
  const s = running(d);
  if (!s || !seasonStarted(d)) {
    return s ? { ...rest, seasons: [...d.seasons.slice(0, -1), { ...s, romBuild: to, ...(s.index > 0 || d.seasonOneRom ? { romDownloaded: false } : {}) }] } : rest;
  }
  const from = s.upgrade?.from ?? (kept ? romBuildOf(kept) : undefined) ?? s.romBuild;
  const next2: DSeason = { ...s, romBuild: to, ...(from ? { upgrade: { from, to } } : {}) };
  return { ...rest, seasons: [...d.seasons.slice(0, -1), next2] };
}

/** An upgrade waiting for its first save from the new ROM, or null. */
export const pendingUpgrade = (d: Dynasty) => running(d)?.upgrade ?? null;

/** Version text for a build, e.g. "v2.1.1". */
export const versionOf = (b?: Pick<RomBuild, 'name'> | null) => b?.name ?? 'an earlier version';
