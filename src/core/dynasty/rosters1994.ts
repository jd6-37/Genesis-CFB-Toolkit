// The real 1994 rosters built into the app (public/data/rosters-1994.csv; cli/rosters1994data.ts makes it from the
// Rosters lane's lists): a 1994 Season Edition dynasty takes the 32 per team from the ROM and each slot's backup
// from these lists (user, 2026-11-15: "We actually have full IRL rosters for most of the 94 teams. Let's use that
// for creating the backups"), and the heights and hometowns of the ROM's named players.
import { parseCsv } from '../rosterSheet';

export const ROSTERS_1994 = {
  /** Served from public/data/, so the app fetches it only when a 1994 dynasty is made. */
  file: 'data/rosters-1994.csv',
  label: '1994 rosters (magazine previews and StatMuse)',
} as const;

export interface Roster1994Row {
  /** Row in the file (a stable ID for the player). */
  row: number;
  /** The ROM's school name. */
  school: string;
  number: number | null;
  first: string;
  last: string;
  /** QB HB FB WR TE OL C DL DE DT LB OLB DB CB S K P, or '' when the list has none. */
  pos: string;
  heightIn: number;
  weight: number;
  /** FR SO JR SR or ''. */
  cls: string;
  hometown: string;
  state: string;
}

/** The file's rows. */
export function parseRosters1994(text: string): Roster1994Row[] {
  const s = parseCsv(text);
  const c = (h: string) => { const k = s.headers.indexOf(h); if (k < 0) throw new Error(`The 1994 rosters file has no "${h}" column.`); return k; };
  const [school, number, first, last, pos, ht, wt, cls, town, state] = ['school', 'number', 'first', 'last', 'pos', 'height_in', 'weight', 'class', 'hometown', 'state'].map(c);
  return s.rows.map((r, row) => ({
    row, school: r[school].trim(), number: /^\d{1,2}$/.test(r[number].trim()) ? +r[number] : null, first: r[first].trim(), last: r[last].trim(),
    pos: r[pos].trim(), heightIn: +r[ht] || 0, weight: +r[wt] || 0, cls: r[cls].trim(), hometown: r[town].trim(), state: r[state].trim(),
  }));
}

/** A name for matching across lists and the ROM: letters only, lower case, no Jr. / II / III. */
export const nameKey = (first: string, last: string) => `${first} ${last}`.toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z]/g, '');

/** Fetches the built-in file's text. */
export async function fetchRosters1994(base = '/'): Promise<string> {
  let res: Response;
  try {
    res = await fetch(base + ROSTERS_1994.file);
  } catch {
    throw new Error("Couldn't load the built-in 1994 rosters. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`Couldn't load the built-in 1994 rosters (${res.status}).`);
  return res.text();
}
