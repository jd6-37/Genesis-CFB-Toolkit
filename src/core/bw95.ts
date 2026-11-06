// Bill Walsh College Football '95 team blocks.
// Team pointer table at 0x0028DC: 36 longwords (alphabetical; Pitt = 25).
// Block header words (offsets from the block start):
//   [0] roster (always the last 0x80 bytes)  [1] uniforms (+0x14, home then away, 16 words each)
//   [2] names (school, city, nickname)       [3] 4-word ratings/conference group (+0x0C)
//   [4] mascot container (+0x54)              [5] helmet container
// Mascot container groups: g0 big mascot, g1 small mascot, g2 wordmark. Helmet: 1 group,
// no palette of its own (uses the mascot palette).

import { rl, rw } from './bytes';
import { readString } from './cf97';
import { readGroups, Sprite } from './sprites';

export const BW_TABLE = 0x0028dc;
export const BW_TEAMS = 36;

export interface BwImage {
  at: number;
  palette: number[] | null;
  tiles: Uint8Array;
  groups: Sprite[][];
}

export interface BwTeam {
  index: number;
  block: number;
  header: number[];
  school: string;
  city: string;
  nickname: string;
  home: number[];
  away: number[];
  rosterOff: number;
  mascot: BwImage;
  helmet: BwImage;
}

function readImage(d: Uint8Array, c: number): BwImage {
  const palOff = rl(d, c);
  const map = c + rl(d, c + 4);
  const nt = rw(d, c + 8);
  return {
    at: c,
    palette: palOff === 0xffffffff ? null : Array.from({ length: 16 }, (_, i) => rw(d, c + palOff + 2 * i)),
    tiles: d.slice(c + 10, c + 10 + 32 * nt),
    groups: readGroups(d, map),
  };
}

export function parseBw95(d: Uint8Array): BwTeam[] {
  const out: BwTeam[] = [];
  for (let i = 0; i < BW_TEAMS; i++) {
    const b = rl(d, BW_TABLE + 4 * i);
    const h = Array.from({ length: 6 }, (_, k) => rw(d, b + 2 * k));
    let a = b + h[2];
    const names: string[] = [];
    for (let k = 0; k < 3; k++) {
      const { s, next } = readString(d, a);
      names.push(s);
      a = next;
    }
    out.push({
      index: i,
      block: b,
      header: h,
      school: names[0],
      city: names[1],
      nickname: names[2],
      home: Array.from({ length: 16 }, (_, k) => rw(d, b + h[1] + 2 * k)),
      away: Array.from({ length: 16 }, (_, k) => rw(d, b + h[1] + 32 + 2 * k)),
      rosterOff: h[0],
      mascot: readImage(d, b + h[4]),
      helmet: readImage(d, b + h[5]),
    });
  }
  return out;
}
