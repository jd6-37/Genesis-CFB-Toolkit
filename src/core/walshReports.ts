// Walsh Report editor: each team's scouting report (offense and defense paragraphs) as the editor
// shows and checks it. The text itself lives in src/core/walsh.ts.
//
// The game prints a report word by word in a box 20 characters wide and 6 lines high, scrolling as it
// goes (0x078FA4), so a paragraph can be any length but a word can't be longer than a line. Its font
// draws letters, digits and some punctuation; other characters show symbols or blanks. EA's text uses
// the bytes D2/D3 for curly double quotes and D4/D5 for apostrophes; the printer shows them as " and '.

import { readSeason } from './season';
import { readWalsh, reportLength, reportParas, rewriteWalsh, REPORT_LIMIT, trimReport, WALSH_BASE, WALSH_END, WALSH_PTR, type Report } from './walsh';

export { REPORT_LIMIT, reportLength, trimReport, type Report };

export const TEAMS = 36;
/** The report box is 20 characters wide; a longer word doesn't fit on a line. */
export const REPORT_WORD = 20;
/** What the report font draws, for the editor's hint. */
export const REPORT_CHARS = `letters, numbers, spaces and . , ! ? ' " - & ( ) / : ; % + = #`;
const ALLOWED = /[A-Za-z0-9 .,!?'"\-&()/:;%+=#]/;

/** A paragraph as the editor shows it: the game's curly quote bytes as plain quotes. */
export const showText = (raw: string) => raw.replace(/[\xd2\xd3]/g, '"').replace(/[\xd4\xd5]/g, "'");

/** Typed text with the same length: curly quotes, dashes and line breaks become their plain versions. */
export const cleanText = (s: string) =>
  s
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[\r\n\t]/g, ' ');

export function readReport(rom: Uint8Array, slot: number): Report {
  const paras = readWalsh(rom);
  const [o, d] = reportParas(slot);
  return { offense: paras[o], defense: paras[d] };
}

export function readReports(rom: Uint8Array): Report[] {
  const paras = readWalsh(rom);
  return Array.from({ length: TEAMS }, (_, s) => {
    const [o, d] = reportParas(s);
    return { offense: paras[o], defense: paras[d] };
  });
}

export const showReport = (r: Report): Report => ({ offense: showText(r.offense), defense: showText(r.defense) });
const same = (a: Report, b: Report) => a.offense === b.offense && a.defense === b.defense;

/** Why a report can't go into the game; empty if it can. */
export function reportProblems(r: Report): string[] {
  const out: string[] = [];
  if (!r.offense.trim() || !r.defense.trim()) out.push('Write something for both the offense and the defense.');
  const n = reportLength(r);
  if (n > REPORT_LIMIT) out.push(`The report is ${n} characters; the most is ${REPORT_LIMIT}.`);
  const bad = [...new Set([...r.offense + r.defense].filter((c) => !ALLOWED.test(c)))];
  if (bad.length) out.push(`The game can't show ${bad.map((c) => (c === ' ' ? 'this space' : c)).join(' ')}. Use ${REPORT_CHARS}.`);
  const long = [...new Set((r.offense + ' ' + r.defense).split(/\s+/).filter((w) => w.length > REPORT_WORD))];
  if (long.length) out.push(`Words can have at most ${REPORT_WORD} characters, the width of the report box: ${long.join(', ')}.`);
  return out;
}

/** The lines the game shows: words wrapped at 20 characters, as the printer does. */
export function wrapLines(text: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = w;
    else if (line.length + 1 + w.length <= REPORT_WORD) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Teams whose report is longer than REPORT_LIMIT: the first edit trims them. */
export function longReports(rom: Uint8Array): number[] {
  return readReports(rom).flatMap((r, s) => (reportLength(r) > REPORT_LIMIT ? [s] : []));
}

/** Sets team reports in the ROM (raw text). Every other report longer than REPORT_LIMIT is trimmed at a
 *  sentence end, and the text stays in its own space. Returns the teams that were trimmed. */
export function writeReports(rom: Uint8Array, reports: Map<number, Report>): number[] {
  for (const [slot, r] of reports) {
    const p = reportProblems(showReport(r));
    if (p.length) throw new Error(`Walsh Report ${slot + 1}: ${p.join(' ')}`);
  }
  const long = longReports(rom).filter((s) => !reports.has(s));
  rewriteWalsh(rom, [], reports);
  return long;
}

/** Conference names written back as they were in `base`, so a renamed conference (the Season tab
 *  renames its mention in the Walsh Report and pads the paragraph with spaces) doesn't count as a
 *  changed report. */
function seasonNamesBack(base: Uint8Array, data: Uint8Array): (s: string) => string {
  try {
    const from = readSeason(data).names;
    const to = readSeason(base).names;
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (s) =>
      from
        .reduce((t, n, i) => (n && n !== to[i] ? t.replace(new RegExp(`(?<![A-Za-z])${esc(n)}(?![A-Za-z])`, 'g'), to[i]) : t), s)
        .trimEnd();
  } catch {
    return (s) => s.trimEnd();
  }
}

/** Teams whose report was edited since `base`: it differs from the loaded report and from that report
 *  trimmed to REPORT_LIMIT (the trim an edit makes to every long report doesn't count). */
export function editedReports(base: Uint8Array, data: Uint8Array): number[] {
  const back = seasonNamesBack(base, data);
  const was = readReports(base);
  const end = (r: Report): Report => ({ offense: r.offense.trimEnd(), defense: r.defense.trimEnd() });
  return readReports(data).flatMap((r, s) => {
    const now = { offense: back(r.offense), defense: back(r.defense) };
    return same(now, end(was[s])) || same(now, end(trimReport(was[s]))) ? [] : [s];
  });
}

/** Puts a team's loaded report back. If the ROM's long reports were trimmed (an edit was made), the
 *  loaded report is trimmed too, as Reset in the editor does. */
export function restoreReport(data: Uint8Array, base: Uint8Array, slot: number): void {
  const was = readReport(base, slot);
  const trimmedRom = readReports(base).some(
    (r, s) => s !== slot && reportLength(r) > REPORT_LIMIT && reportLength(readReport(data, s)) <= REPORT_LIMIT,
  );
  const r = trimmedRom ? trimReport(was) : was;
  if (!same(readReport(data, slot), r)) rewriteWalsh(data, [], new Map([[slot, r]]));
}

/** Puts the whole Walsh text back as `base` has it (undo of every report change, the trims too). */
export function restoreAllReports(data: Uint8Array, base: Uint8Array): void {
  data.set(base.subarray(WALSH_BASE, WALSH_END), WALSH_BASE);
  data.set(base.subarray(WALSH_PTR, WALSH_PTR + 4), WALSH_PTR);
}
