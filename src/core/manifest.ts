// The Elevated ROM manifest "ELV1" and the save's build stamp "ELVB" (H-033, ROM lane; spec in the claude.ai project
// notes: bw95-manifest-spec.md). 2026 test63 / 1994 test64 on. A ROM without a manifest is generation 0 with no build
// info; so is a save without ELVB. Readers ignore fields and entries they don't know.

/** Where the manifest's header is (fixed for good). */
export const MANIFEST_AT = 0x2dff00;

export interface ManifestEntry {
  /** Four-letter tag, e.g. "SAVE", "FINE". */
  tag: string;
  version: number;
  flags: number;
  /** 0 when the entry only gives a version. */
  address: number;
  size: number;
}

export interface Manifest {
  manifestVersion: number;
  /** 2026 or 1994. */
  editionYear: number;
  seasonTeams: number;
  /** Raised only at an edition break; 0 before the compatibility promise starts. */
  generation: number;
  /** vs the previous mainline: 1 mid-season safe, 2 between seasons, 3 edition / save layout break (a label). */
  releaseClass: number;
  /** major, minor, patch, test (display only). */
  buildNumber: [number, number, number, number];
  /** The oldest build serial a season can have been started on and still be continued on this build. */
  midSeasonFrom: number;
  /** e.g. "v2.0.1-test63". */
  name: string;
  /** +1 on every mainline build of an edition; all comparisons use it. */
  serial: number;
  /** 0 normal, 1 dynasty-test-data. */
  variant: number;
  setupTeams: number;
  entries: ManifestEntry[];
}

const u16 = (d: Uint8Array, a: number) => (d[a] << 8) | d[a + 1];
const u32 = (d: Uint8Array, a: number) => ((d[a] << 24) >>> 0) + (d[a + 1] << 16) + (d[a + 2] << 8) + d[a + 3];
const ascii = (d: Uint8Array, a: number, n: number) => String.fromCharCode(...d.subarray(a, a + n)).replace(/\0+$/, '');

/** The ROM's manifest, or null (no manifest: generation 0). */
export function readManifest(rom: Uint8Array): Manifest | null {
  const h = MANIFEST_AT;
  if (rom.length < h + 0x38 || ascii(rom, h, 4) !== 'ELV1') return null;
  const headerLen = u16(rom, h + 6);
  const count = headerLen >= 0x38 ? u16(rom, h + 0x30) : 0;
  const size = headerLen >= 0x38 ? u16(rom, h + 0x32) : 16;
  const table = headerLen >= 0x38 ? u32(rom, h + 0x34) : 0;
  const entries: ManifestEntry[] = [];
  if (size >= 16 && table && table + count * size <= rom.length) {
    for (let i = 0; i < count; i++) {
      const a = table + i * size;
      entries.push({ tag: ascii(rom, a, 4).trimEnd(), version: u16(rom, a + 4), flags: u16(rom, a + 6), address: u32(rom, a + 8), size: u32(rom, a + 12) });
    }
  }
  return {
    manifestVersion: u16(rom, h + 4),
    editionYear: u16(rom, h + 8),
    seasonTeams: u16(rom, h + 0x0a),
    generation: u16(rom, h + 0x0c),
    releaseClass: u16(rom, h + 0x0e),
    buildNumber: [rom[h + 0x10], rom[h + 0x11], rom[h + 0x12], rom[h + 0x13]],
    midSeasonFrom: u32(rom, h + 0x14),
    name: ascii(rom, h + 0x18, 16),
    serial: u32(rom, h + 0x28),
    variant: u16(rom, h + 0x2c),
    setupTeams: u16(rom, h + 0x2e),
    entries,
  };
}

/** An entry by tag, or null. */
export const entryOf = (m: Manifest | null, tag: string) => m?.entries.find((e) => e.tag === tag) ?? null;

/** The generation a ROM belongs to (0 without a manifest). */
export const generationOf = (rom: Uint8Array) => readManifest(rom)?.generation ?? 0;

/**
 * Entry versions this app knows, by generation (flags bit 0 = it must know the version to write a season ROM).
 * Generation 0 = 2026 test63 / 1994 test64 on (the promise hasn't started; the app writes what it writes today).
 */
export const KNOWN_ENTRIES: Record<number, Record<string, number[]>> = {
  0: {
    SAVE: [2], DHOK: [1], DHDR: [1], DYNA: [1], ROST: [1], ROSD: [1], OVRF: [1], SIMW: [1], SIMS: [1], SST1: [1],
    CTG1: [1], CONF: [1], KIT1: [1], JRSY: [1], NAM1: [1], FINE: [1], IMPK: [2], SCHD: [1], POLL: [1], POST: [1], WLSH: [1],
    OVRT: [1], DEF4: [1], TEAM: [1], ART: [1], NUMB: [1],
  },
};

/** Entries the ROM marks as required whose version (or generation) this app doesn't know; empty = fine. */
export function unknownRequired(m: Manifest | null): ManifestEntry[] {
  if (!m) return [];
  const known = KNOWN_ENTRIES[m.generation];
  return m.entries.filter((e) => e.flags & 1 && !(known?.[e.tag] ?? []).includes(e.version));
}

/** The message when a ROM is newer than this app (null when the app knows it). */
export function newerRomMessage(m: Manifest | null): string | null {
  if (!m) return null;
  if (!KNOWN_ENTRIES[m.generation]) return `This ROM (${m.name}) is from a newer edition than this version of the Dynasty app knows. Reload the page to get the latest app.`;
  const u = unknownRequired(m);
  return u.length ? `This ROM (${m.name}) is newer than this version of the Dynasty app (${u.map((e) => `${e.tag} ${e.version}`).join(', ')}). Reload the page to get the latest app.` : null;
}

/** The save's build stamp (season block +0x1340). */
export interface Elvb {
  startSerial: number;
  startBuild: [number, number, number, number];
  generation: number;
  manifestVersion: number;
  lastSerial: number;
  lastBuild: [number, number, number, number];
  saveLayout: number;
  editionYear: number;
  variant: number;
}

/** ELVB from its 32 bytes, or null (a ROM without a manifest wrote none). */
export function readElvb(b: Uint8Array | null): Elvb | null {
  if (!b || b.length < 0x20 || ascii(b, 0, 4) !== 'ELVB') return null;
  const n = (a: number): [number, number, number, number] => [b[a], b[a + 1], b[a + 2], b[a + 3]];
  return {
    startSerial: u32(b, 4), startBuild: n(8), generation: u16(b, 0x0c), manifestVersion: u16(b, 0x0e),
    lastSerial: u32(b, 0x10), lastBuild: n(0x14), saveLayout: u16(b, 0x18), editionYear: u16(b, 0x1a), variant: u16(b, 0x1c),
  };
}

/** A build number as text, e.g. "2.0.1 test 63". */
export const buildText = (n: readonly number[]) => `${n[0]}.${n[1]}.${n[2]}${n[3] ? ` test ${n[3]}` : ''}`;

/**
 * Releases the app knows, per edition: serial → mid-season-from. Used for the mid-season check when the user didn't
 * give the app the ROM the save was last written by. Add each mainline's line when it's delivered.
 */
export const KNOWN_BUILDS: Record<number, Record<number, { name: string; midSeasonFrom: number }>> = {
  2026: { 63: { name: 'v2.0.1-test63', midSeasonFrom: 63 } },
  1994: { 64: { name: 'v2.0.1-test64', midSeasonFrom: 64 } },
};

/**
 * The mid-season check (spec section 3): a season started on one build and saved last on another, when the start is
 * older than the later build's mid-season-from. Returns null when fine or unknown, else the message.
 * `last` is the manifest of the ROM that wrote the save last, when the app has it.
 */
export function midSeasonProblem(e: Elvb | null, last?: { serial: number; midSeasonFrom: number } | null): string | null {
  if (!e || e.lastSerial === e.startSerial) return null;
  const msf = last && last.serial === e.lastSerial ? last.midSeasonFrom : KNOWN_BUILDS[e.editionYear]?.[e.lastSerial]?.midSeasonFrom;
  if (msf === undefined || e.startSerial >= msf) return null;
  return `This season was started on Elevated ${buildText(e.startBuild)} and saved on ${buildText(e.lastBuild)}, which isn't safe to switch to in the middle of a season. Results may not count right; finish the season on ${buildText(e.startBuild)}, or start a New Season on the newer ROM.`;
}
