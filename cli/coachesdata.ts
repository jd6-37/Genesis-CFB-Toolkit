// Builds public/data/coaches-1994.json and coaches-2026.json, the real coaches a dynasty starts with (user,
// 2026-11-16: "IRL coaches 1994/2026"), from the Rosters lane's CSVs (claude.ai project notes: H-020; the owner's
// Mac folder coaches/: coaches_YEAR.csv and coach_seasons_YEAR.csv).
//
//   npx tsx cli/coachesdata.ts DIR [OUTDIR]
//
// One file per edition. Schools are the ROM's names (four 1994 names differ from the lists'). Seasons are the
// coach's real seasons before the edition's year (1993 / 2025 at the latest: no 2026 results, the owner's rule).
// Sources are Wikipedia pages, kept as the part after /wiki/.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../src/core/rosterSheet';
import type { CoachData } from '../src/core/dynasty/coachData';

const dir = process.argv[2];
const outDir = process.argv[3] ?? 'public/data';
if (!dir) { console.error('usage: tsx cli/coachesdata.ts DIR [OUTDIR]'); process.exit(1); }

const SCHOOL_1994: Record<string, string> = {
  'Mississippi State': 'Mississippi St.', 'Northern Illinois': 'N. Illinois', 'Northeast Louisiana': 'NE Louisiana', 'Southwestern Louisiana': 'SW Louisiana',
};
const WIKI = 'https://en.wikipedia.org/wiki/';
const wiki = (url: string) => (url.startsWith(WIKI) ? decodeURIComponent(url.slice(WIKI.length)) : url);

function rows(file: string) {
  const s = parseCsv(readFileSync(join(dir, file), 'utf8'));
  return s.rows.map((r) => Object.fromEntries(s.headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

for (const year of [1994, 2026] as const) {
  const school = (s: string) => (year === 1994 ? SCHOOL_1994[s] ?? s : s);
  const coaches = rows(`coaches_${year}.csv`);
  const seasons = rows(`coach_seasons_${year}.csv`);
  const ix = new Map(coaches.map((c, i) => [c.id, i]));
  const last = year - 1;
  const data: CoachData = {
    year,
    coaches: coaches.map((c) => ({
      key: c.id,
      name: c.name,
      born: c.birth_year ? +c.birth_year : undefined,
      hometown: c.hometown || undefined,
      alma: c.alma_mater || undefined,
      role: (['HC', 'OC', 'DC'].includes(c.season_role) ? c.season_role : 'none') as 'HC' | 'OC' | 'DC' | 'none',
      school: c.season_school ? school(c.season_school) : undefined,
      tags: c.tags ? c.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : undefined,
      note: c.note || undefined,
      wiki: c.sources ? wiki(c.sources.split(/\s+/)[0]) : undefined,
    })),
    seasons: [],
  };
  let dropped = 0;
  for (const s of seasons) {
    const c = ix.get(s.coach_id);
    if (c === undefined) throw new Error(`${year}: season of unknown coach ${s.coach_id}`);
    if (+s.year > last) { dropped++; continue; }
    const num = (v: string) => (v === '' ? undefined : +v);
    data.seasons.push([c, +s.year, school(s.school), s.role, num(s.w), num(s.l), num(s.t), s.conf_title === 'Y' ? 1 : 0, s.postseason || '', s.source ? wiki(s.source) : '']);
  }
  const heads = data.coaches.filter((c) => c.role === 'HC');
  const out = join(outDir, `coaches-${year}.json`);
  writeFileSync(out, JSON.stringify(data));
  console.log(`${out}: ${data.coaches.length} coaches (${heads.length} head coaches), ${data.seasons.length} seasons${dropped ? `, ${dropped} past ${last} left out` : ''}`);
}
