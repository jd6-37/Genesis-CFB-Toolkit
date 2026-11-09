// End-of-season celebration for swapped teams: one generic "GO TEAM!" card stunt, recolored
// per team at run time by the CELEBRATION helper.
//
// BW95's celebrations: a per-team pointer table at 0x034A68 -> blobs. A blob is a word offset
// to its image container (from the blob start), script words, then the container (uncompressed
// tiles, one palette line, a sprite map with one group per animation frame). Played by 0x079EAC.
//
// The generic card stunt is a copy of Pitt's ("GO PITT!": 7 cards, words of 2 + 5) with cards
// 3-6 re-lettered T, E, A, M. The letters are copied from existing cards: T from Pitt's own,
// E, A and M from Texas A&M's ("HUMP IT AGGIES!"). Cards are 6x7 px: border and background
// palette index 9, letter pixels index 1 (a 5-wide letter such as M uses the right border column).
// Card-stunt palette: 9 cards, 10 skirts and pom-poms, 13 tops; 1 is the white of the letters.

import { rl, rw } from './bytes';
import { toLevels } from './colors';
import { readGroups, Sprite, spriteH, spriteW } from './sprites';

export const CELEB_TABLE = 0x034a68;
export const CELEB_ADDR = 0x1eef00; // container at +0x42 = 0x1EEF42, which the helper checks for
export const CELEB_CONTAINER_OFF = 0x42;
const TEMPLATE = 25; // Pitt
const LETTERS_FROM = 29; // Texas A&M
const PITT_LEN = 4120;

export interface CelebBlob {
  start: number; // offset in its byte array
  bytes: Uint8Array; // the blob alone
  container: number; // offsets within bytes
  tiles: number;
  ntiles: number;
  palette: number[];
  groups: Sprite[][];
}

export function readBlob(rom: Uint8Array, team: number): CelebBlob {
  const p = rl(rom, CELEB_TABLE + 4 * team);
  const c = p + rw(rom, p);
  const map = c + rl(rom, c + 4);
  const n = rw(rom, map) / 2;
  const end = map + rw(rom, map + 2 * (n - 1));
  const bytes = rom.slice(p, end);
  return parseBlob(bytes, p);
}

function parseBlob(bytes: Uint8Array, start: number): CelebBlob {
  const c = rw(bytes, 0);
  const pal = c + rl(bytes, c);
  return {
    start,
    bytes,
    container: c,
    tiles: c + 10,
    ntiles: rw(bytes, c + 8),
    palette: Array.from({ length: 16 }, (_, i) => rw(bytes, pal + 2 * i)),
    groups: readGroups(bytes, c + rl(bytes, c + 4)),
  };
}

/** Pixel access to one animation frame, mapped back to the tile bytes. */
class Frame {
  x0 = Infinity;
  y0 = Infinity;
  w = 0;
  h = 0;
  private cells = new Map<number, [number, boolean]>(); // (y*1024+x) -> [byte offset, high nibble]
  constructor(private b: CelebBlob, group: Sprite[]) {
    let x1 = -Infinity, y1 = -Infinity;
    for (const s of group) {
      this.x0 = Math.min(this.x0, s.x);
      this.y0 = Math.min(this.y0, s.y);
      x1 = Math.max(x1, s.x + 8 * spriteW(s));
      y1 = Math.max(y1, s.y + 8 * spriteH(s));
    }
    this.w = x1 - this.x0;
    this.h = y1 - this.y0;
    for (const s of group) {
      const sw = spriteW(s), sh = spriteH(s);
      for (let cx = 0; cx < sw; cx++)
        for (let cy = 0; cy < sh; cy++) {
          const t = (s.tile & 0x7ff) + cx * sh + cy;
          for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++) {
              const X = s.x - this.x0 + 8 * cx + x, Y = s.y - this.y0 + 8 * cy + y;
              this.cells.set(Y * 1024 + X, [b.tiles + 32 * t + 4 * y + (x >> 1), (x & 1) === 0]);
            }
        }
    }
  }
  get(x: number, y: number): number {
    const c = this.cells.get(y * 1024 + x);
    if (!c) return -1;
    const v = this.b.bytes[c[0]];
    return c[1] ? v >> 4 : v & 15;
  }
  set(x: number, y: number, v: number): void {
    const c = this.cells.get(y * 1024 + x);
    if (!c) throw new Error('card pixel outside the frame');
    const o = this.b.bytes[c[0]];
    this.b.bytes[c[0]] = c[1] ? (o & 0x0f) | (v << 4) : (o & 0xf0) | v;
  }
  /** Cards left to right: 6x7 boxes, top/bottom rows and left column index 9, the rest 9 or 1. */
  cards(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let x = 0; x + 6 <= this.w; x++)
      for (let y = 0; y + 7 <= this.h; y++) {
        let ok = true;
        for (let i = 0; i < 6 && ok; i++) ok = this.get(x + i, y) === 9 && this.get(x + i, y + 6) === 9;
        for (let j = 1; j < 6 && ok; j++) ok = this.get(x, y + j) === 9;
        for (let j = 1; j < 6 && ok; j++)
          for (let i = 1; i < 6 && ok; i++) ok = this.get(x + i, y + j) === 9 || this.get(x + i, y + j) === 1;
        if (ok && !out.some((c) => Math.abs(c.x - x) < 6 && Math.abs(c.y - y) < 7)) out.push({ x, y });
      }
    return out.sort((a, b) => a.x - b.x);
  }
  letter(card: { x: number; y: number }): boolean[] {
    const m: boolean[] = [];
    for (let j = 1; j < 6; j++) for (let i = 1; i < 6; i++) m.push(this.get(card.x + i, card.y + j) === 1);
    return m;
  }
  drawLetter(card: { x: number; y: number }, m: boolean[]): void {
    let k = 0;
    for (let j = 1; j < 6; j++) for (let i = 1; i < 6; i++) this.set(card.x + i, card.y + j, m[k++] ? 1 : 9);
  }
}

/** Builds the "GO TEAM!" blob from the user's ROM (stock or Rebalanced: both have the stock blobs). */
export function buildGenericCelebration(rom: Uint8Array): CelebBlob {
  const pitt = readBlob(rom, TEMPLATE);
  const tamu = readBlob(rom, LETTERS_FROM);
  if (pitt.bytes.length !== PITT_LEN || pitt.container !== CELEB_CONTAINER_OFF) {
    throw new Error('Unexpected celebration data in this ROM');
  }
  const findFrame = (b: CelebBlob, n: number) => {
    for (const g of b.groups) {
      const f = new Frame(b, g);
      const cs = f.cards();
      if (cs.length === n) return { f, cs };
    }
    throw new Error('Card stunt cards not found');
  };
  const p = findFrame(pitt, 7);
  const t = findFrame(tamu, 13); // H U M P I T A G G I E S !
  const letters = [p.f.letter(p.cs[4]), t.f.letter(t.cs[10]), t.f.letter(t.cs[6]), t.f.letter(t.cs[2])]; // T E A M

  const out = parseBlob(pitt.bytes.slice(), CELEB_ADDR);
  let frames = 0;
  for (const g of out.groups) {
    const f = new Frame(out, g);
    const cs = f.cards();
    if (cs.length === 0) continue;
    if (cs.length !== 7) throw new Error('Unexpected card layout in the template');
    for (let k = 0; k < 4; k++) f.drawLetter(cs[2 + k], letters[k]);
    frames++;
  }
  if (frames !== 3) throw new Error('Unexpected number of card-stunt frames');
  return out;
}

/** The card stunt to show: the one an earlier swap put in the ROM, or a new one from its stock blobs
 *  (which an earlier swap may have replaced, so they aren't read again then). */
export function genericCelebration(rom: Uint8Array): CelebBlob {
  if (rw(rom, CELEB_ADDR) === CELEB_CONTAINER_OFF) return parseBlob(rom.slice(CELEB_ADDR, CELEB_ADDR + PITT_LEN), CELEB_ADDR);
  return buildGenericCelebration(rom);
}

const luma = (c: number) => {
  const [r, g, b] = toLevels(c);
  return 0.3 * r + 0.59 * g + 0.11 * b;
};

/** Default celebration colors [cards, skirts and pom-poms, tops] from a home uniform. Cards
 *  need to be dark enough for the white letters; skirts and tops skip near-black shades and
 *  colors already used, so a black-and-gold team gets gold rather than more black. */
export function defaultCelebration(home: number[]): [number, number, number] {
  const cards = [home[12], home[11], home[3], home[9], home[7]].find((c) => luma(c) <= 3.5) ?? 0x0000;
  const visible = (c: number, not: number[]) => luma(c) > 1.5 && !not.includes(c);
  const skirts = [home[10], home[11], home[5], home[3], home[9]].find((c) => visible(c, [cards])) ?? home[10];
  const tops = [home[7], home[5], home[9], home[3], home[10]].find((c) => visible(c, [cards, skirts])) ?? home[7];
  return [cards, skirts, tops];
}

/** Index of the frame showing all cards level (for previews). */
export const PREVIEW_FRAME = 3;
