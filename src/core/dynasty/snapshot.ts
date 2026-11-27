// A dynasty snapshot's file: the dynasty as it is at one moment, plus its team logos, helmets and wordmarks
// (user, 2026-11-17: "yes include logos and helmets"), gzip-compressed. Read-only for whoever opens the link.
// The snapshots' delete keys never go in (they stay in the owner's dynasty).

import { DYNASTY_FILE, type Dynasty } from './model';
import type { TeamArt } from './storage';
import type { Picture } from '../render';

export const SNAPSHOT_FILE = { app: 'genesis-cfb-toolkit', tool: 'dynasty-snapshot', version: 1 } as const;

/** One of the owner's shared snapshots, kept in the dynasty (and its file) so it can be deleted later. */
export interface DSnapshot {
  id: string;
  /** The secret that deletes it (the id is made from it). */
  key: string;
  /** The user team it follows (the masthead's team when it was shared). */
  team: number;
  /** "2026, after Week 2". */
  label: string;
  /** ISO time. */
  sharedAt: string;
}

export interface Snapshot {
  dynasty: Dynasty;
  team: number;
  label: string;
  sharedAt: string;
  art: TeamArt[] | null;
}

// ---- pictures: a palette and one byte per pixel (the art has a few colors), base64

interface PackedPicture { w: number; h: number; p: number[]; d: string }
type PackedArt = { logo: PackedPicture | null; helmet: PackedPicture | null; word: PackedPicture | null };

const toB64 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function packPicture(pic: Picture | null): PackedPicture | null {
  if (!pic) return null;
  const n = pic.width * pic.height;
  const palette: number[] = [];
  const index = new Map<number, number>();
  const px = new Uint8Array(n);
  const view = new DataView(pic.data.buffer, pic.data.byteOffset, pic.data.byteLength);
  for (let i = 0; i < n; i++) {
    const c = view.getUint32(i * 4);
    let k = index.get(c);
    if (k === undefined) {
      if (palette.length === 256) throw new Error('A picture has more than 256 colors.');
      k = palette.length;
      palette.push(c);
      index.set(c, k);
    }
    px[i] = k;
  }
  return { w: pic.width, h: pic.height, p: palette, d: toB64(px) };
}

export function unpackPicture(p: PackedPicture | null): Picture | null {
  if (!p) return null;
  const px = fromB64(p.d);
  const data = new Uint8ClampedArray(p.w * p.h * 4);
  const view = new DataView(data.buffer);
  for (let i = 0; i < px.length; i++) view.setUint32(i * 4, p.p[px[i]] >>> 0);
  return { width: p.w, height: p.h, data };
}

// ---- gzip (browsers and Node 18+)

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

// ---- the file

/** The snapshot's file for a dynasty at this moment, following one of its user teams. */
export async function makeSnapshot(d: Dynasty, team: number, label: string, art: TeamArt[] | null, now = new Date()): Promise<Uint8Array> {
  const { snapshots: _keys, ...whole } = d;
  // Kept save files (keptSaves.ts) stay private: a shared snapshot doesn't need them.
  const dynasty = { ...whole, seasons: whole.seasons.map((s) => ({ ...s, ...(s.imports ? { imports: s.imports.map(({ file: _f, fileName: _n, ...i }) => i) } : {}) })) };
  const file = {
    ...SNAPSHOT_FILE,
    sharedAt: now.toISOString(),
    team,
    label,
    dynasty: { ...dynasty, ...DYNASTY_FILE },
    // Logos and helmets; the wordmarks aren't shown on the Dynasty pages, so they stay out (smaller files).
    art: art ? art.map((a): PackedArt => ({ logo: packPicture(a.logo), helmet: packPicture(a.helmet), word: null })) : null,
  };
  return gzip(JSON.stringify(file));
}

/** Reads a snapshot's file. A snapshot made by an older version of the app still opens. */
export async function readSnapshot(bytes: Uint8Array): Promise<Snapshot> {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(await gunzip(bytes));
  } catch {
    throw new Error("This snapshot can't be read.");
  }
  if (json.app !== SNAPSHOT_FILE.app || json.tool !== SNAPSHOT_FILE.tool) throw new Error("This isn't a dynasty snapshot.");
  if (typeof json.version !== 'number' || json.version > SNAPSHOT_FILE.version) throw new Error('This snapshot was made by a newer version of the app. Reload the page.');
  const d = json.dynasty as Dynasty;
  if (!d || !Array.isArray(d.teams) || !Array.isArray(d.players) || !Array.isArray(d.seasons) || !d.seasons.length) throw new Error('This snapshot is damaged.');
  const art = Array.isArray(json.art)
    ? (json.art as PackedArt[]).map((a) => ({ logo: unpackPicture(a.logo), helmet: unpackPicture(a.helmet), word: unpackPicture(a.word) }))
    : null;
  return { dynasty: d, team: Number(json.team), label: String(json.label ?? ''), sharedAt: String(json.sharedAt ?? ''), art };
}

/** A short name for the moment a snapshot shows: "2026, after Week 2", "2026 offseason", "2026 season, final". */
export function snapshotLabel(year: number, state: { offseason: boolean; done: boolean; week: string | null }): string {
  if (state.offseason) return `${year} offseason`;
  if (state.done) return `${year} season, final`;
  return state.week ? `${year}, after ${state.week}` : `${year}, preseason`;
}
