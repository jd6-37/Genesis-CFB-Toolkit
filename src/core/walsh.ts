// Bill Walsh Report text: one CR-separated block at 0x05B2E0 (78 paragraphs, each ending in CR).
// Paragraphs 0-5 are intro lines; then offense = 6 + 2*team, defense = 7 + 2*team.
// The only reference to the block is `lea $5B2E0.l,a1` at 0x078FBE (long operand at 0x078FC0),
// and paragraphs are found by counting CRs from there, so a rewritten block can live anywhere.

import { rl, wl } from './bytes';
import { WALSH_ALIASES } from './defaults';

export const WALSH_BASE = 0x05b2e0;
export const WALSH_PARAS = 78;
export const WALSH_PTR = 0x078fc0;
// End of the text's own space in the ROM (the byte after the last CR of the original text).
export const WALSH_END = 0x061067;
// Only used when the renamed text no longer fits in place. Free 0xFF padding in the stock ROM and in
// Rebalanced v1.0 and v1.1. Paragraph offsets are signed words, so the block must stay under 32 KB.
export const WALSH_RELOC = 0x1f8000;
export const WALSH_RELOC_END = 0x200000;

/** Where the text is: WALSH_BASE, or WALSH_RELOC after a swap that had to move it. */
export function walshAt(rom: Uint8Array): number {
  return rl(rom, WALSH_PTR);
}

export function readWalsh(rom: Uint8Array): string[] {
  const paras: string[] = [];
  let cur = '';
  for (let a = walshAt(rom); paras.length < WALSH_PARAS; a++) {
    const c = rom[a];
    if (c === 0x0d) {
      paras.push(cur);
      cur = '';
    } else cur += String.fromCharCode(c);
  }
  return paras;
}

export function singular(n: string): string {
  const w = n.split(' ');
  let last = w[w.length - 1];
  if (/ies$/.test(last)) last = last.slice(0, -3) + 'y';
  else if (/[^s]s$/.test(last)) last = last.slice(0, -1);
  w[w.length - 1] = last;
  return w.join(' ');
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface NameChange {
  slot: number;
  oldSchool: string;
  oldNickname: string;
  newSchool: string;
  newNickname: string;
}

export function renameInText(text: string, ch: NameChange): string {
  const pairs: [string, string][] = [[ch.oldSchool, ch.newSchool]];
  for (const a of WALSH_ALIASES[ch.oldSchool] ?? []) pairs.push([a, ch.newSchool]);
  pairs.push([ch.oldNickname, ch.newNickname], [singular(ch.oldNickname), singular(ch.newNickname)]);
  const words = ch.oldNickname.split(' ');
  if (words.length > 1) {
    const last = words[words.length - 1];
    pairs.push([last, ch.newNickname], [singular(last), singular(ch.newNickname)]);
  }
  const map = new Map<string, string>();
  for (const [f, t] of pairs) if (f && !map.has(f)) map.set(f, t);
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![A-Za-z])(?:${keys.map(esc).join('|')})(?![A-Za-z])`, 'g');
  return text.replace(re, (m) => map.get(m) ?? m);
}

/** Rewrites the swapped teams' paragraphs. Keeps the block in place when it fits: if the new text
 *  is longer, sentence gaps of two spaces become one (the swapped teams' paragraphs first, then the
 *  rest); if it's shorter, the leftover bytes after the last CR are filled with spaces (never read).
 *  Only if that still doesn't fit is the block moved to WALSH_RELOC. On a ROM swapped before, the
 *  text is read from wherever that swap left it, and its old copy at WALSH_RELOC is reused or freed. */
export function rewriteWalsh(rom: Uint8Array, changes: NameChange[]): 'unchanged' | 'in place' | 'moved' {
  if (!changes.length) return 'unchanged';
  const at = walshAt(rom);
  const paras = readWalsh(rom);
  const join = () => paras.map((p) => p + '\r').join('');
  const oldSize = join().length;
  // The space in place: the original text's. An earlier swap that shortened the text left the rest
  // as spaces; a moved text left the original where it was.
  const spacesAfter = rom.subarray(WALSH_BASE + oldSize, WALSH_END).every((b) => b === 0x20);
  const room = at !== WALSH_BASE ? WALSH_END - WALSH_BASE : spacesAfter ? Math.max(oldSize, WALSH_END - WALSH_BASE) : oldSize;
  const changed = new Set<number>();
  for (const ch of changes) {
    for (const p of [6 + 2 * ch.slot, 7 + 2 * ch.slot]) {
      paras[p] = renameInText(paras[p], ch);
      changed.add(p);
    }
  }
  let excess = join().length - room;
  const gap = /([.!?])  (?=\S)/;
  // Paragraph order (not swap order) so the same swaps always give the same bytes.
  for (const i of [...[...changed].sort((a, b) => a - b), ...paras.keys()]) {
    while (excess > 0 && gap.test(paras[i])) {
      paras[i] = paras[i].replace(gap, '$1 ');
      excess--;
    }
    if (excess <= 0) break;
  }
  const text = join();
  const put = (to: number) => {
    for (let i = 0; i < text.length; i++) rom[to + i] = text.charCodeAt(i) & 0xff;
  };
  if (text.length <= room) {
    put(WALSH_BASE);
    rom.fill(0x20, WALSH_BASE + text.length, WALSH_BASE + room);
    if (at === WALSH_RELOC) {
      rom.fill(0xff, WALSH_RELOC, WALSH_RELOC + oldSize); // the moved copy isn't needed any more
      wl(rom, WALSH_PTR, WALSH_BASE);
    }
    return 'in place';
  }
  if (text.length > WALSH_RELOC_END - WALSH_RELOC || text.length > 0x7fff) {
    throw new Error('Walsh Report text is too long after renaming');
  }
  const own = at === WALSH_RELOC ? oldSize : 0; // bytes at WALSH_RELOC that already hold the text
  for (let a = WALSH_RELOC + own; a < WALSH_RELOC + text.length; a++) {
    if (rom[a] !== 0xff) throw new Error('The ROM has no free space for the longer Walsh Report text');
  }
  put(WALSH_RELOC);
  if (own > text.length) rom.fill(0xff, WALSH_RELOC + text.length, WALSH_RELOC + own);
  wl(rom, WALSH_PTR, WALSH_RELOC);
  return 'moved';
}
