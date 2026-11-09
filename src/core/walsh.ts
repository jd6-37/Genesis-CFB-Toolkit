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
// Where versions of the app before the Walsh Report editor moved the text when very long names didn't
// fit in place. The text is read from there and put back; nothing is written there any more.
export const WALSH_RELOC = 0x1f8000;

/** Where the text is: WALSH_BASE, or WALSH_RELOC after an older swap that had to move it. */
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

// ---- Each team's report: offense + defense ----

/** The most characters a team's report (offense and defense together) may have once reports are
 *  edited. 36 × 650 plus the intro lines and line breaks (195 bytes in EA's text) leaves room in the
 *  text's own space for longer names from a team swap. */
export const REPORT_LIMIT = 650;

export interface Report {
  offense: string;
  defense: string;
}

export const reportParas = (slot: number): [number, number] => [6 + 2 * slot, 7 + 2 * slot];
export const reportLength = (r: Report) => r.offense.length + r.defense.length;

/** Where each sentence of a paragraph ends (before the spaces that follow), apart from the last. */
function sentenceEnds(p: string): number[] {
  const end = p.trimEnd().length;
  const out: number[] = [];
  for (const m of p.matchAll(/[.!?]+["'\xd3\xd5)]*(?=\s)/g)) {
    const at = m.index! + m[0].length;
    if (at < end) out.push(at);
  }
  return out;
}

/** The paragraph without its last sentence; null if it has only one. */
function dropLastSentence(p: string): string | null {
  const ends = sentenceEnds(p);
  return ends.length ? p.slice(0, ends[ends.length - 1]) : null;
}

/** Shortens a report to `limit` characters by dropping last sentences (a paragraph keeps at least its
 *  first sentence). Each step drops the last sentence of the longer paragraph, unless dropping one
 *  from either paragraph already fits: then the drop that keeps the most text. Only a report whose
 *  paragraphs are single sentences that are still too long is cut at a word and ended with a period. */
export function trimReport(r: Report, limit = REPORT_LIMIT): Report {
  let cur: Report = { offense: r.offense, defense: r.defense };
  while (reportLength(cur) > limit) {
    const o = dropLastSentence(cur.offense);
    const d = dropLastSentence(cur.defense);
    const options: Report[] = [];
    if (o !== null) options.push({ offense: o, defense: cur.defense });
    if (d !== null) options.push({ offense: cur.offense, defense: d });
    const fits = options.filter((x) => reportLength(x) <= limit).sort((x, y) => reportLength(y) - reportLength(x));
    if (fits.length) {
      cur = fits[0];
    } else if (options.length) {
      const longer = cur.offense.length >= cur.defense.length ? 'offense' : 'defense';
      cur = options.find((x) => x[longer] !== cur[longer]) ?? options[0];
    } else {
      const longer = cur.offense.length >= cur.defense.length ? 'offense' : 'defense';
      const keep = limit - (longer === 'offense' ? cur.defense.length : cur.offense.length) - 1;
      const p = cur[longer];
      const at = p.lastIndexOf(' ', keep);
      cur = { ...cur, [longer]: p.slice(0, at > 0 ? at : Math.max(keep, 0)).replace(/[\s,;:-]+$/, '') + '.' };
    }
  }
  return cur;
}

const readReportAt = (paras: string[], slot: number): Report => {
  const [o, d] = reportParas(slot);
  return { offense: paras[o], defense: paras[d] };
};

/** Rewrites the Walsh text: the swapped teams' paragraphs get their new names, and teams in `reports`
 *  get the given text. Once any report is set, every other report longer than REPORT_LIMIT is trimmed
 *  (trimReport), so all of them fit. The text always stays in its own space: if it's longer than
 *  before, sentence gaps of two spaces become one (changed paragraphs first, then the rest); if it
 *  still doesn't fit, the longest reports lose their last sentences. If it's shorter, the bytes after
 *  the last CR are filled with spaces (never read). A text that an older version of the app moved to
 *  WALSH_RELOC is read from there, put back in place and its copy freed. */
export function rewriteWalsh(
  rom: Uint8Array,
  changes: NameChange[],
  reports: Map<number, Report> = new Map(),
): 'unchanged' | 'in place' | 'trimmed' {
  if (!changes.length && !reports.size) return 'unchanged';
  const at = walshAt(rom);
  const paras = readWalsh(rom);
  const join = () => paras.map((p) => p + '\r').join('');
  const oldSize = join().length;
  // The space in place: the original text's. An earlier swap that shortened the text left the rest
  // as spaces; a moved text left the original where it was.
  const spacesAfter = rom.subarray(WALSH_BASE + oldSize, WALSH_END).every((b) => b === 0x20);
  const room = at !== WALSH_BASE ? WALSH_END - WALSH_BASE : spacesAfter ? Math.max(oldSize, WALSH_END - WALSH_BASE) : oldSize;
  const changed = new Set<number>();
  const setReport = (slot: number, r: Report) => {
    const [o, d] = reportParas(slot);
    paras[o] = r.offense;
    paras[d] = r.defense;
    changed.add(o).add(d);
  };
  for (const ch of changes) {
    if (reports.has(ch.slot)) continue;
    for (const p of reportParas(ch.slot)) {
      paras[p] = renameInText(paras[p], ch);
      changed.add(p);
    }
  }
  for (const [slot, r] of reports) setReport(slot, r);
  if (reports.size) {
    for (let slot = 0; 7 + 2 * slot < WALSH_PARAS; slot++) {
      const r = readReportAt(paras, slot);
      if (!reports.has(slot) && reportLength(r) > REPORT_LIMIT) setReport(slot, trimReport(r));
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
  let trimmed = false;
  while (excess > 0) {
    // Only very long made-up names get here: drop a sentence from the longest report.
    let slot = -1;
    for (let s = 0; 7 + 2 * s < WALSH_PARAS; s++) {
      if (slot < 0 || reportLength(readReportAt(paras, s)) > reportLength(readReportAt(paras, slot))) slot = s;
    }
    const r = readReportAt(paras, slot);
    const short = trimReport(r, reportLength(r) - 1);
    setReport(slot, short);
    excess -= reportLength(r) - reportLength(short);
    trimmed = true;
  }
  const text = join();
  for (let i = 0; i < text.length; i++) rom[WALSH_BASE + i] = text.charCodeAt(i) & 0xff;
  rom.fill(0x20, WALSH_BASE + text.length, WALSH_BASE + room);
  if (at === WALSH_RELOC) {
    rom.fill(0xff, WALSH_RELOC, WALSH_RELOC + oldSize); // the moved copy isn't needed any more
    wl(rom, WALSH_PTR, WALSH_BASE);
  }
  return trimmed ? 'trimmed' : 'in place';
}
