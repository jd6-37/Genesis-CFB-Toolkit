// Draws sprite groups from 4bpp tiles into RGBA pixels (for previews).

import { LEVELS, toLevels } from './colors';
import { bbox, Sprite, spriteH, spriteW } from './sprites';

export interface Picture {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function renderSprites(tiles: Uint8Array, palette: number[], groups: Sprite[][]): Picture {
  const all = groups.flat();
  if (!all.length) return { width: 1, height: 1, data: new Uint8ClampedArray(4) };
  const b = bbox(all);
  const width = b.x1 - b.x0, height = b.y1 - b.y0;
  const data = new Uint8ClampedArray(width * height * 4);
  const rgb = palette.map((c) => toLevels(c).map((v) => LEVELS[v]));
  for (const s of all) {
    const sw = spriteW(s), sh = spriteH(s);
    for (let cx = 0; cx < sw; cx++) {
      for (let cy = 0; cy < sh; cy++) {
        const t = s.tile + cx * sh + cy;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const byte = tiles[t * 32 + y * 4 + (x >> 1)];
            const v = x & 1 ? byte & 15 : byte >> 4;
            if (!v || byte === undefined) continue;
            const X = s.x - b.x0 + 8 * cx + x, Y = s.y - b.y0 + 8 * cy + y;
            const o = (Y * width + X) * 4;
            const [r, g, bl] = rgb[v];
            data[o] = r;
            data[o + 1] = g;
            data[o + 2] = bl;
            data[o + 3] = 255;
          }
        }
      }
    }
  }
  return { width, height, data };
}
