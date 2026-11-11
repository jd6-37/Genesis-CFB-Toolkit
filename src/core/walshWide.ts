// Walsh Report text of the 138-team 2026 Season Edition. Unlike the 36-team game (one CR-separated block
// found by counting CRs, src/core/walsh.ts), it has a table of paragraph addresses at WIDE.walshTable:
// 6 intro lines, then offense = 6 + 2*team and defense = 7 + 2*team, each paragraph ending in CR. The
// printer (0x078FBE → 0x2100DC / 0x210108) takes a paragraph's address from the table, so paragraphs
// can be anywhere; the build packs them from WIDE.walsh, and the team blocks start at WIDE.blocks.
//
// A write packs every paragraph again from WIDE.walsh. It may grow into the 0xFF bytes after the text
// (checked free first) up to WIDE.blocks; bytes the text no longer uses go back to 0xFF.

import { rl, wl } from './bytes';
import { teamsOf, WIDE } from './wide';

/** Number of paragraphs: 6 intro lines and two per team. */
export const wideParaCount = (d: Uint8Array) => 6 + 2 * teamsOf(d);

/** One past the last CR of the text. */
function textEnd(d: Uint8Array): number {
  let end: number = WIDE.walsh;
  for (let i = 0; i < wideParaCount(d); i++) {
    let a = rl(d, WIDE.walshTable + 4 * i);
    while (d[a] !== 0x0d) a++;
    end = Math.max(end, a + 1);
  }
  return end;
}

/** The end of the space the text may use: its own bytes and the 0xFF bytes after them, up to the blocks. */
export function wideWalshLimit(d: Uint8Array): number {
  let a = textEnd(d);
  while (a < WIDE.blocks && d[a] === 0xff) a++;
  return a;
}

export function readWideWalsh(d: Uint8Array): string[] {
  const out: string[] = [];
  for (let i = 0; i < wideParaCount(d); i++) {
    let a = rl(d, WIDE.walshTable + 4 * i);
    let s = '';
    while (d[a] !== 0x0d) s += String.fromCharCode(d[a++]);
    out.push(s);
  }
  return out;
}

/** Writes every paragraph (raw text, no CRs) packed from WIDE.walsh and points the table at them. */
export function writeWideWalsh(d: Uint8Array, paras: string[]): void {
  const n = wideParaCount(d);
  if (paras.length !== n) throw new Error(`expected ${n} Walsh paragraphs, got ${paras.length}`);
  const old = textEnd(d);
  const limit = wideWalshLimit(d);
  const size = paras.reduce((s, p) => s + p.length + 1, 0);
  if (WIDE.walsh + size > limit) {
    throw new Error(`The Walsh Reports need ${size} bytes; this ROM has room for ${limit - WIDE.walsh}.`);
  }
  let a: number = WIDE.walsh;
  paras.forEach((p, i) => {
    if (p.includes('\r')) throw new Error('a Walsh paragraph has a line break');
    wl(d, WIDE.walshTable + 4 * i, a);
    for (let k = 0; k < p.length; k++) d[a++] = p.charCodeAt(k) & 0xff;
    d[a++] = 0x0d;
  });
  if (a < old) d.fill(0xff, a, old);
}

/** The bytes a Walsh edit can change, as [start, end) ranges. */
export const wideWalshRanges = (d: Uint8Array): [number, number][] => [
  [WIDE.walshTable, WIDE.walshTable + 4 * wideParaCount(d)],
  [WIDE.walsh, WIDE.blocks],
];
