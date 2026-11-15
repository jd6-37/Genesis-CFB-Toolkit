// Builds public/data/rosters-1994.csv, the real 1994 rosters a 1994 Season Edition dynasty takes its backups
// from (user, 2026-11-15: "We actually have full IRL rosters for most of the 94 teams. Let's use that for
// creating the backups"), from the Rosters lane's lists (claude.ai project notes: bw95-1994-expansion-plan.md;
// the files are in the owner's Mac folder, rosters-1994/rost94/*_rosters.csv: magazine previews R*, StatMuse T*,
// U1, U2).
//
//   npx tsx cli/rosters1994data.ts DIR [OUT]
//
// One row per player and school: the same name in several lists is one player, each field from the first list
// that has it (number, class, height and weight StatMuse first, as the Rosters lane decided; position and
// hometown from the magazines first, which are more specific). School names are the ROM's.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../src/core/rosterSheet';

const dir = process.argv[2];
const out = process.argv[3] ?? 'public/data/rosters-1994.csv';
if (!dir) { console.error('usage: tsx cli/rosters1994data.ts DIR [OUT]'); process.exit(1); }

const SCHOOL: Record<string, string> = {
  'Mississippi State': 'Mississippi St.', 'Northeast Louisiana': 'NE Louisiana', 'Northern Illinois': 'N. Illinois', 'Southwestern Louisiana': 'SW Louisiana',
};
// Positions as the lists print them → a short set the app matches roster slots with.
const POS: Record<string, string> = {
  QB: 'QB', RB: 'HB', TB: 'HB', HB: 'HB', B: 'HB', AB: 'HB', BB: 'FB', FB: 'FB',
  WR: 'WR', SE: 'WR', FL: 'WR', FLK: 'WR', SB: 'WR', R: 'WR', TE: 'TE',
  OL: 'OL', OT: 'OL', OG: 'OL', G: 'OL', T: 'OL', L: 'OL', LT: 'OL', RT: 'OL', LG: 'OL', RG: 'OL', LS: 'OL', SN: 'OL', C: 'C',
  DL: 'DL', DE: 'DE', DRE: 'DE', DT: 'DT', DRT: 'DT', NG: 'DT', NT: 'DT', MG: 'DT', N: 'DT', DG: 'DT',
  LB: 'LB', ILB: 'LB', MLB: 'LB', OLB: 'OLB', SLB: 'OLB', WLB: 'OLB', RLB: 'OLB', DLB: 'LB',
  DB: 'DB', CB: 'CB', BN: 'CB', S: 'S', FS: 'S', SS: 'S', DS: 'S', ROV: 'S',
  K: 'K', PK: 'K', P: 'P', 'K/P': 'K', 'P-K': 'P', 'P-PK': 'P',
};
const RANK: Record<string, number> = { U2: 0, U1: 1, T1: 2, T2: 2, T3: 2, T4: 2, R1a: 3, R1b: 3, R2a: 3, R2b: 3, R3: 3, R4: 3, R5: 3 };
const magazine = (src: string) => src.startsWith('R');

const key = (first: string, last: string) => `${first} ${last}`.toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z]/g, '');
const cls = (s: string) => (/^(fr|so|jr|sr)/i.exec(s.trim())?.[1].toUpperCase() ?? '');
const inches = (s: string) => {
  const m = /^([4-7])['-](\d{1,2})/.exec(s.trim());
  return m ? 12 * +m[1] + +m[2] : 0;
};
const pounds = (s: string) => (/^\d{3}$/.test(s.trim()) && +s >= 150 && +s <= 360 ? +s : 0);
// Hometowns as the app keeps them (town, two-letter state; 'Non-US' abroad): the magazines add the high school in
// parentheses or after a slash and spell some states out.
const US = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' '));
const STATE: Record<string, string> = {
  'Miss.': 'MS', 'Ark.': 'AR', Ark: 'AR', Texas: 'TX', 'Tex.': 'TX', 'Fla.': 'FL', 'Ga.': 'GA', 'Ala.': 'AL', Ohio: 'OH', 'Tenn.': 'TN',
  'La.': 'LA', 'Calif.': 'CA', 'S.C.': 'SC', 'Ill.': 'IL', 'Mo.': 'MO', 'Okla.': 'OK', 'Ind.': 'IN', 'N.Y.': 'NY', 'Pa.': 'PA', 'D.C.': 'DC',
  'Minn.': 'MN', 'N.C.': 'NC', 'Colo.': 'CO', 'Conn.': 'CT', Kansas: 'KS', 'Md.': 'MD',
};
const ABROAD = new Set(['ON', 'PQ', 'SK', 'MB', 'Ontario', 'Canada', 'Tonga', 'NZ', 'Switz.']);
function home(h: string): [string, string] {
  const k = h.lastIndexOf(',');
  if (k < 0) return ['', ''];
  const town = h.slice(0, k).replace(/\s*\(.*$/, '').trim();
  const raw = h.slice(k + 1).replace(/\s*\(.*$/, '').split('/')[0].trim();
  const st = US.has(raw) ? raw : STATE[raw] ?? (ABROAD.has(raw) ? 'Non-US' : '');
  return town && st ? [town, st] : ['', ''];
}

interface Row { school: string; number: string; first: string; last: string; pos: string; ht: number; wt: number; cls: string; town: string; state: string; src: string }
const rows: Row[] = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('_rosters.csv')).sort()) {
  const src = f.replace('_rosters.csv', '');
  if (!(src in RANK)) throw new Error(`unknown list ${f}`);
  const sheet = parseCsv(readFileSync(join(dir, f), 'utf8'));
  const c = (name: string) => sheet.headers.indexOf(name);
  for (const r of sheet.rows) {
    const first = r[c('first')].trim(), last = r[c('last')].trim();
    if (!first && !last) continue;
    const [town, state] = home(r[c('hometown')].trim());
    const num = r[c('number')].trim();
    rows.push({
      school: SCHOOL[r[c('school')].trim()] ?? r[c('school')].trim(), number: /^\d{1,2}$/.test(num) ? String(+num) : '',
      first, last, pos: POS[r[c('pos')].trim().toUpperCase()] ?? '', ht: inches(r[c('ht')]), wt: pounds(r[c('wt')]), cls: cls(r[c('cl')]), town, state, src,
    });
  }
}

// Merge each school's rows by name, the best list first per field.
rows.sort((a, b) => RANK[a.src] - RANK[b.src]);
const merged = new Map<string, Row>();
const first = <K extends keyof Row>(r: Row, k: K, v: Row[K]) => { if (!r[k] && v) r[k] = v; };
for (const r of rows) {
  const id = `${r.school}|${key(r.first, r.last)}`;
  const m = merged.get(id);
  if (!m) { merged.set(id, { ...r, pos: magazine(r.src) ? r.pos : r.pos, town: magazine(r.src) ? r.town : '', state: magazine(r.src) ? r.state : '' }); continue; }
  first(m, 'number', r.number); first(m, 'cls', r.cls); first(m, 'ht', r.ht); first(m, 'wt', r.wt);
  // Position and hometown: a magazine's (more specific) over a StatMuse one.
  if (magazine(r.src) && r.pos && !magazine(m.src)) m.pos = r.pos; else first(m, 'pos', r.pos);
  if (magazine(r.src)) { first(m, 'town', r.town); first(m, 'state', r.state); }
}
const list = [...merged.values()].sort((a, b) => a.school.localeCompare(b.school) || a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
const q = (s: string | number) => (/[",]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const lines = ['school,number,first,last,pos,height_in,weight,class,hometown,state', ...list.map((r) => [r.school, r.number, r.first, r.last, r.pos, r.ht || '', r.wt || '', r.cls, r.town, r.state].map(q).join(','))];
writeFileSync(out, lines.join('\n') + '\n');
const bySchool = new Map<string, number>();
for (const r of list) bySchool.set(r.school, (bySchool.get(r.school) ?? 0) + 1);
console.log(`${rows.length} rows → ${list.length} players at ${bySchool.size} schools (fewest: ${[...bySchool].sort((a, b) => a[1] - b[1]).slice(0, 5).map(([s, n]) => `${s} ${n}`).join(', ')}) → ${out}`);
