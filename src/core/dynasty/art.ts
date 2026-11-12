// Team art for the Dynasty pages, drawn from the user's own ROM (kept in the browser, never exported).

import { parseBw95 } from '../bw95';
import { renderSprites } from '../render';
import { teamsOf } from '../wide';
import type { TeamArt } from './storage';

export function teamArt(rom: Uint8Array): TeamArt[] {
  return parseBw95(rom, teamsOf(rom)).map((t) => {
    const pal = t.mascot.palette;
    const pic = (tiles: Uint8Array, groups: (typeof t.mascot.groups)[number] | undefined) => {
      if (!pal || !groups || !groups.length) return null;
      try {
        return renderSprites(tiles, pal, [groups]);
      } catch {
        return null;
      }
    };
    return {
      logo: pic(t.mascot.tiles, t.mascot.groups[1]),
      helmet: pic(t.helmet.tiles, t.helmet.groups[0]),
      word: pic(t.mascot.tiles, t.mascot.groups[2]),
    };
  });
}
