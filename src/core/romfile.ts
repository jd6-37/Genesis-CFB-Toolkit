// Opening ROM files: plain .md/.bin/.gen, or a .zip holding one. Identifies ROMs by SHA-1, and
// modded BW95 ROMs (Elevated betas, earlier edits, …) by their header.

import { rl, rw, sha1Hex } from './bytes';

export type RomKind = 'bw95' | 'cf97';

export interface KnownRom {
  kind: RomKind;
  label: string;
  rebalanced?: 'fixed' | 'none';
  /** A BW95 ROM recognized only by its header: a mod or an edit of the original. Team Swap checks
   *  that the code and ROM space it needs are still untouched (`swapProblems` in build.ts). */
  modded?: boolean;
  /** A BW95 ROM over 2 MB: the 138-team 2026 Season Edition (Elevated v2.0.0 on; layout in wide.ts).
   *  Rosters edits it; Team Swap, Season and Teams don't (yet). */
  wide?: boolean;
}

export const KNOWN: Record<string, KnownRom> = {
  '2ae000f45474b3cdedd08eeca7f5e195959ba689': { kind: 'bw95', label: 'Bill Walsh College Football 95 (USA)' },
  '9e8f79f431c47cd52008f6315a3cb9e1bdd6a37e': {
    kind: 'bw95',
    label: "Bill Walsh College Football '95 Rebalanced v1.0 (Fixed Fatigue)",
    rebalanced: 'fixed',
  },
  c012fbd0fb0db59648f2d9bff78acc29d9f63ea0: {
    kind: 'bw95',
    label: "Bill Walsh College Football '95 Rebalanced v1.0 (No Fatigue)",
    rebalanced: 'none',
  },
  '9b93035ecdc2b6f0815281764ef647f2de039e7b': { kind: 'cf97', label: 'College Football USA 97 (USA)' },
};

const ROM_EXT = /\.(md|bin|gen)$/i;

const BW95_TITLE = "Bill Walsh College Football '95";

/** The overseas name in the Genesis header (0x150-0x17F), with runs of spaces collapsed. */
export function headerTitle(d: Uint8Array): string {
  return d.length < 0x180 ? '' : String.fromCharCode(...d.subarray(0x150, 0x180)).replace(/\s+/g, ' ').trim();
}

/** True for a BW95 ROM over 2 MB: the 138-team 2026 Season Edition (see `KnownRom.wide`). */
export const isWideBw95 = (d: Uint8Array) => d.length > 0x200000 && headerTitle(d) === BW95_TITLE;

/** Why Team Swap doesn't take a wide ROM. */
export const WIDE_ROM_TEXT =
  'This is the 2026 Season Edition with all 138 FBS teams, so Team Swap (College Football USA 97 teams into the 36 ' +
  "original slots) doesn't take it. To swap in CF97 teams, start from the original game or the Elevated edition with the original 36 teams.";
/** What the other tabs do with a wide ROM so far. */
export const WIDE_TABS_TEXT =
  "Rosters edits all 138 teams' players and can bring in the built-in CFB 27 rosters. Season and Teams don't edit the 138-team edition yet.";

/** A known file by SHA-1, else any 2 MB ROM with BW95's header counts as a modded BW95 ROM, and a
 *  bigger one as the 138-team edition. */
export function identifyRom(data: Uint8Array, sha1: string): KnownRom | undefined {
  const known = KNOWN[sha1];
  if (known) return known;
  if (isWideBw95(data)) {
    return { kind: 'bw95', label: "Bill Walsh College Football '95: 2026 Season Edition (138 teams)", modded: true, wide: true };
  }
  if (data.length === 0x200000 && headerTitle(data) === BW95_TITLE) {
    return { kind: 'bw95', label: "Bill Walsh College Football '95 (modded)", modded: true };
  }
  return undefined;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const rw16le = (d: Uint8Array, a: number) => d[a] | (d[a + 1] << 8);
const rl32le = (d: Uint8Array, a: number) => (d[a] | (d[a + 1] << 8) | (d[a + 2] << 16) | (d[a + 3] << 24)) >>> 0;

/** Returns the first ROM-like entry of a zip archive (stored or deflated). */
export async function unzipRom(z: Uint8Array): Promise<{ name: string; data: Uint8Array }> {
  let eocd = -1;
  for (let i = z.length - 22; i >= Math.max(0, z.length - 65557); i--) {
    if (rl32le(z, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = rw16le(z, eocd + 10);
  let p = rl32le(z, eocd + 16);
  for (let k = 0; k < count; k++) {
    if (rl32le(z, p) !== 0x02014b50) throw new Error('Damaged zip file');
    const method = rw16le(z, p + 10);
    const csize = rl32le(z, p + 20);
    const nlen = rw16le(z, p + 28), xlen = rw16le(z, p + 30), clen = rw16le(z, p + 32);
    const local = rl32le(z, p + 42);
    const name = new TextDecoder().decode(z.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!ROM_EXT.test(name)) continue;
    const start = local + 30 + rw16le(z, local + 26) + rw16le(z, local + 28);
    const raw = z.subarray(start, start + csize);
    if (method === 0) return { name, data: raw.slice() };
    if (method === 8) return { name, data: await inflateRaw(raw) };
    throw new Error(`Zip entry ${name} uses an unsupported compression method`);
  }
  throw new Error('No .md, .bin or .gen file found in the zip');
}

export interface OpenedRom {
  name: string;
  data: Uint8Array;
  sha1: string;
  known?: KnownRom;
}

export async function openRom(fileName: string, bytes: Uint8Array): Promise<OpenedRom> {
  let name = fileName;
  let data = bytes;
  if (rl(bytes, 0) === 0x504b0304) ({ name, data } = await unzipRom(bytes));
  const sha1 = await sha1Hex(data);
  return { name, data, sha1, known: identifyRom(data, sha1) };
}

/** A short hint for ROMs that aren't recognized. */
export function describeUnknown(r: OpenedRom): string {
  if (r.data.length % 0x4000 === 512) return 'This looks like an .smd (interleaved) dump. Convert it to .md/.bin first.';
  const title = headerTitle(r.data);
  const sum = r.data.length > 0x190 ? rw(r.data, 0x18e).toString(16).toUpperCase() : '';
  return (
    `Not a ROM this app can use (header "${title}", ${r.data.length.toLocaleString()} bytes, checksum ${sum}, SHA-1 ${r.sha1}). ` +
    "It needs a Bill Walsh College Football 95 ROM (the original USA ROM, or one with a mod such as Elevated), " +
    'and College Football USA 97 (USA).'
  );
}
