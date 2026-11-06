// EA image containers and sprite maps, shared by BW95 and CF96/97.
// Sprite map: word group offsets (n + 1, last = end), then 8-byte entries {x, y, tile, size}.
// size = (w - 1) << 2 | (h - 1); a sprite's tiles are consecutive, column-major.

import { rw, s16, ww } from './bytes';

export interface Sprite {
  x: number;
  y: number;
  tile: number; // index into the container's tiles (no flip/palette bits are used by these games)
  size: number;
}

export const spriteW = (s: Sprite): number => ((s.size >> 2) & 3) + 1;
export const spriteH = (s: Sprite): number => (s.size & 3) + 1;
export const spriteTiles = (s: Sprite): number => spriteW(s) * spriteH(s);

export function readGroups(d: Uint8Array, map: number): Sprite[][] {
  const n = rw(d, map) / 2;
  const offs: number[] = [];
  for (let i = 0; i < n; i++) offs.push(rw(d, map + 2 * i));
  const groups: Sprite[][] = [];
  for (let g = 0; g < n - 1; g++) {
    const es: Sprite[] = [];
    for (let a = map + offs[g]; a < map + offs[g + 1]; a += 8) {
      es.push({ x: s16(rw(d, a)), y: s16(rw(d, a + 2)), tile: rw(d, a + 4), size: rw(d, a + 6) });
    }
    groups.push(es);
  }
  return groups;
}

export function writeGroups(groups: Sprite[][]): Uint8Array {
  const n = groups.length + 1;
  const total = 2 * n + 8 * groups.reduce((s, g) => s + g.length, 0);
  const out = new Uint8Array(total);
  let off = 2 * n;
  groups.forEach((g, i) => {
    ww(out, 2 * i, off);
    off += 8 * g.length;
  });
  ww(out, 2 * groups.length, off);
  let a = 2 * n;
  for (const g of groups) {
    for (const s of g) {
      ww(out, a, s.x & 0xffff);
      ww(out, a + 2, s.y & 0xffff);
      ww(out, a + 4, s.tile);
      ww(out, a + 6, s.size);
      a += 8;
    }
  }
  return out;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function bbox(g: Sprite[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of g) {
    x0 = Math.min(x0, s.x);
    y0 = Math.min(y0, s.y);
    x1 = Math.max(x1, s.x + 8 * spriteW(s));
    y1 = Math.max(y1, s.y + 8 * spriteH(s));
  }
  return { x0, y0, x1, y1 };
}

/** Copy the tiles a set of groups uses into a new tile block and renumber the sprites. */
export function packTiles(tiles: Uint8Array, groups: Sprite[][]): { tiles: Uint8Array; groups: Sprite[][] } {
  const runs = new Map<string, number>();
  const chunks: Uint8Array[] = [];
  let next = 0;
  const out = groups.map((g) =>
    g.map((s) => {
      const n = spriteTiles(s);
      const key = `${s.tile}:${n}`;
      let base = runs.get(key);
      if (base === undefined) {
        base = next;
        runs.set(key, base);
        chunks.push(tiles.subarray(32 * s.tile, 32 * (s.tile + n)));
        next += n;
      }
      return { ...s, tile: base };
    }),
  );
  const packed = new Uint8Array(32 * next);
  let o = 0;
  for (const c of chunks) {
    packed.set(c, o);
    o += c.length;
  }
  return { tiles: packed, groups: out };
}
