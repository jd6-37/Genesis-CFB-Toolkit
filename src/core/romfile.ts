// Opening ROM files: plain .md/.bin/.gen, or a .zip holding one. Identifies ROMs by SHA-1.

import { rl, rw, sha1Hex } from './bytes';

export type RomKind = 'bw95' | 'cf97';

export interface KnownRom {
  kind: RomKind;
  label: string;
  rebalanced?: 'fixed' | 'none';
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
  return { name, data, sha1, known: KNOWN[sha1] };
}

/** A short hint for ROMs that aren't recognized. */
export function describeUnknown(r: OpenedRom): string {
  if (r.data.length % 0x4000 === 512) return 'This looks like an .smd (interleaved) dump. Convert it to .md/.bin first.';
  const title = String.fromCharCode(...r.data.subarray(0x150, 0x180)).replace(/\s+/g, ' ').trim();
  const sum = r.data.length > 0x190 ? rw(r.data, 0x18e).toString(16).toUpperCase() : '';
  return (
    `Not a ROM this app can use (header "${title}", ${r.data.length.toLocaleString()} bytes, checksum ${sum}, SHA-1 ${r.sha1}). ` +
    "It needs Bill Walsh College Football 95 (USA) or a Rebalanced v1.0 ROM, and College Football USA 97 (USA)."
  );
}
