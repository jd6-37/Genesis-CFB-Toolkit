// College Football USA 97 team records.
// Pointer table at 0x002CEA: 112 records (111 teams + a "Division 1AA" placeholder).
// Record header words: [1] -> names (school, stadium, nickname), [2] -> the 4-word group BW95 has too
// (+0 home weather, +2 offense, +4 defense), [3] -> image container.
// Image container: {long pal_off, long map_off, word 0x8000 | ntiles}, then compressed tiles.
// Palette: 3 lines (logo, home uniform, away uniform). Sprite map groups: logo, wordmark, helmet.

import { rl, rw } from './bytes';
import { decompress } from './cfdecomp';
import { readGroups, Sprite } from './sprites';

export const CF97_TABLE = 0x002cea;
export const CF97_RECORDS = 112;

export interface CfTeam {
  index: number;
  school: string;
  stadium: string;
  nickname: string;
  tiles: Uint8Array;
  logoPalette: number[];
  home: number[];
  away: number[];
  logo: Sprite[];
  wordmark: Sprite[];
  helmet: Sprite[];
  /** The record's group: home weather word, offense and defense (0-100, CF97's own 1996 ratings). */
  weather: number;
  offense: number;
  defense: number;
}

export function readString(d: Uint8Array, a: number): { s: string; next: number } {
  const n = rw(d, a);
  let s = '';
  for (let i = a + 2; i < a + n && d[i] !== 0; i++) s += String.fromCharCode(d[i]);
  return { s, next: a + n };
}

const line = (d: Uint8Array, a: number): number[] => Array.from({ length: 16 }, (_, i) => rw(d, a + 2 * i));

export function parseCf97(d: Uint8Array): CfTeam[] {
  const teams: CfTeam[] = [];
  for (let i = 0; i < CF97_RECORDS; i++) {
    const r = rl(d, CF97_TABLE + 4 * i);
    let a = r + rw(d, r + 2);
    const names: string[] = [];
    for (let k = 0; k < 3; k++) {
      const { s, next } = readString(d, a);
      names.push(s);
      a = next;
    }
    if (names[0] === 'Division 1AA') continue;
    const grp = r + rw(d, r + 4);
    const c = r + rw(d, r + 6);
    const pal = c + rl(d, c);
    const map = c + rl(d, c + 4);
    const nt = rw(d, c + 8);
    if (!(nt & 0x8000)) throw new Error(`CF97 team ${names[0]}: expected compressed tiles`);
    const { data } = decompress(d, c + 10);
    if (data.length !== 32 * (nt & 0x7fff)) throw new Error(`CF97 team ${names[0]}: tile count mismatch`);
    const g = readGroups(d, map);
    if (g.length !== 3) throw new Error(`CF97 team ${names[0]}: expected 3 sprite groups`);
    teams.push({
      index: i,
      school: names[0],
      stadium: names[1],
      nickname: names[2],
      tiles: data,
      logoPalette: line(d, pal),
      home: line(d, pal + 32),
      away: line(d, pal + 64),
      logo: g[0],
      wordmark: g[1],
      helmet: g[2],
      weather: rw(d, grp),
      offense: rw(d, grp + 2),
      defense: rw(d, grp + 4),
    });
  }
  return teams;
}
