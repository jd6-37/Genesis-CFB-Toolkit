// Minimal spreadsheet reader: CSV (comma, semicolon or tab) and XLSX (first worksheet).
// No dependencies; XLSX is unzipped with DecompressionStream('deflate-raw').

export interface Sheet {
  headers: string[];
  /** Data rows, each the same length as headers (missing cells are ''). */
  rows: string[][];
}

export async function readSheet(fileName: string, bytes: Uint8Array): Promise<Sheet> {
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
  if (isZip) return parseXlsx(bytes);
  if (/\.xls$/i.test(fileName) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) {
    throw new Error('Old .xls files aren’t supported. Save the sheet as .xlsx or .csv.');
  }
  return parseCsv(decodeText(bytes));
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes); // Excel "CSV" on Windows
  }
}

function tidy(table: string[][]): Sheet {
  const nonEmpty = (r: string[]) => r.some((c) => c.trim() !== '');
  const rows = table.filter(nonEmpty);
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const width = headers.length;
  return {
    headers,
    rows: rows.slice(1).map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim())),
  };
}

export function parseCsv(text: string): Sheet {
  let lines = text;
  // Excel's "sep=;" hint line
  const sepHint = /^sep=(.)\r?\n/i.exec(lines);
  let delim: string;
  if (sepHint) {
    delim = sepHint[1];
    lines = lines.slice(sepHint[0].length);
  } else {
    const first = lines.split(/\r?\n/, 1)[0] ?? '';
    const count = (c: string) => first.split(c).length - 1;
    delim = [',', ';', '\t'].reduce((a, b) => (count(b) > count(a) ? b : a), ',');
  }
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < lines.length; i++) {
    const ch = lines[i];
    if (quoted) {
      if (ch === '"') {
        if (lines[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && lines[i + 1] === '\n') i++;
      row.push(cell); out.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return tidy(out);
}

// ---- XLSX ----

interface ZipEntry { name: string; method: number; offset: number; csize: number }

function zipEntries(b: Uint8Array): ZipEntry[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx file.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Not a valid .xlsx file.');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(local + 26, true), lxlen = dv.getUint16(local + 28, true);
    out.push({ name, method, csize, offset: local + 30 + lnlen + lxlen });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zipText(b: Uint8Array, entries: ZipEntry[], name: string): Promise<string | null> {
  const e = entries.find((x) => x.name.replace(/^\//, '').toLowerCase() === name.toLowerCase());
  if (!e) return null;
  const raw = b.subarray(e.offset, e.offset + e.csize);
  const data = e.method === 0 ? raw : e.method === 8 ? await inflate(raw) : null;
  if (!data) throw new Error('Unsupported compression in .xlsx file.');
  return new TextDecoder().decode(data);
}

const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    return String.fromCodePoint(k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });

const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? unescapeXml(m[1]) : null;
};

/** Text of <t> runs, skipping phonetic <rPh> runs. */
const runsText = (xml: string) =>
  Array.from(xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g),
    (m) => unescapeXml(m[1])).join('');

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function parseXlsx(bytes: Uint8Array): Promise<Sheet> {
  const entries = zipEntries(bytes);
  const workbook = await zipText(bytes, entries, 'xl/workbook.xml');
  if (!workbook) throw new Error('Not an Excel workbook (.xlsx).');
  const firstSheet = /<sheet\b[^>]*>/.exec(workbook)?.[0];
  const rid = firstSheet ? attr(firstSheet, 'r:id') : null;
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const rels = await zipText(bytes, entries, 'xl/_rels/workbook.xml.rels');
  if (rid && rels) {
    for (const rel of rels.match(/<Relationship\b[^>]*>/g) ?? []) {
      if (attr(rel, 'Id') === rid) {
        const target = attr(rel, 'Target') ?? '';
        sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      }
    }
  }
  const shared: string[] = [];
  const sst = await zipText(bytes, entries, 'xl/sharedStrings.xml');
  if (sst) for (const si of sst.match(/<si>[\s\S]*?<\/si>|<si\/>/g) ?? []) shared.push(runsText(si));
  const sheetXml = await zipText(bytes, entries, sheetPath);
  if (!sheetXml) throw new Error('The workbook has no readable worksheet.');

  const table: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rAttr = attr(`<row${rowMatch[1] ?? rowMatch[3]}>`, 'r');
    const rowIdx = rAttr ? parseInt(rAttr, 10) - 1 : table.length;
    const cells: string[] = [];
    let next = 0;
    for (const c of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const open = `<c${c[1]}>`;
      const ref = attr(open, 'r');
      const ci = ref ? colIndex(ref) : next;
      next = ci + 1;
      const t = attr(open, 't');
      const body = c[2] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let text = '';
      if (t === 's') text = v !== undefined ? shared[parseInt(v, 10)] ?? '' : '';
      else if (t === 'inlineStr') text = runsText(body);
      else if (t === 'b') text = v === '1' ? 'TRUE' : 'FALSE';
      else if (t === 'e') text = '';
      else text = v !== undefined ? unescapeXml(v) : '';
      cells[ci] = text;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    table[rowIdx] = cells;
  }
  for (let i = 0; i < table.length; i++) if (!table[i]) table[i] = [];
  return tidy(table);
}

// ---- CSV writing ----

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const q = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}

/** Number from a cell: accepts "71", "71.0", "71,0" (decimal comma). NaN when empty or not a number. */
export function cellNumber(s: string | undefined): number {
  if (s === undefined) return NaN;
  const t = s.trim();
  if (t === '') return NaN;
  const n = Number(/^-?\d+,\d+$/.test(t) ? t.replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
}
