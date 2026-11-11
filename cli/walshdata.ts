// Builds public/data/walsh-reports-2026-week9.json: the 2026 Walsh Reports the Rosters tab can add with
// the built-in CFB 27 rosters. They're read from the 138-team 2026 Season Edition (Elevated v2.0.0 on),
// which holds the final text for every team, and keyed by the team names of the built-in CFB 27 CSV.
//
// usage: npx tsx cli/walshdata.ts --rom "Elevated 2026 Season v2.0.0.md|.zip" [--out FILE] [--source "name"]

import { readFileSync, writeFileSync } from 'node:fs';
import { rl, rw } from '../src/core/bytes';
import { CFB27_LATEST } from '../src/core/cfb27Latest';
import { openRom, isWideBw95 } from '../src/core/romfile';
import { reportProblems, showText } from '../src/core/walshReports';
import { WALSH_DATA, type WalshData } from '../src/core/walsh2026';

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const romPath = arg('--rom');
if (!romPath) throw new Error('usage: npx tsx cli/walshdata.ts --rom 2026-v2.md [--out FILE] [--source "name"]');
const out = arg('--out') ?? `public/${WALSH_DATA.file}`;
const source = arg('--source') ?? "Bill Walsh College Football '95 Elevated: 2026 Season Edition v2.0.0";

/** ROM school names that differ from the CSV's. */
const CSV_NAMES: Record<string, string> = {
  'App State': 'Appalachian State',
  Coastal: 'Coastal Carolina',
  'Florida Atlantic': 'FAU',
  'Jax State': 'Jacksonville State',
  'Miami of Ohio': 'Miami (Ohio)',
  'Middle Tennessee': 'Middle Tennessee State',
  'Mississippi St.': 'Mississippi State',
  NIU: 'Northern Illinois',
  'North Dakota St.': 'North Dakota State',
  Pitt: 'Pittsburgh',
  'South Florida': 'USF',
  UConn: 'Connecticut',
};

const { data: d } = await openRom(romPath, new Uint8Array(readFileSync(romPath)));
if (!isWideBw95(d)) throw new Error('Not the 138-team 2026 Season Edition (a BW95 ROM over 2 MB).');

// The team table (0x28DC) has a pointer per team; the Walsh paragraph table starts with a pointer to the
// intro line "Welcome to {c}." and has 6 intro lines, then offense and defense for each team.
let teams = 0;
while (teams < 256 && rl(d, 0x28dc + 4 * teams) < d.length && rl(d, 0x28dc + 4 * teams) >= 0x200) teams++;
const intro = Buffer.from(d).indexOf(Buffer.from('Welcome to {c}.\r', 'latin1'), 0x200000);
if (intro < 0) throw new Error("Can't find the Walsh text.");
let table = -1;
for (let a = 0x200000; a + 4 <= d.length; a += 2) {
  if (rl(d, a) !== intro) continue;
  let ok = true;
  for (let k = 1; k < 6 + 2 * teams && ok; k++) ok = rl(d, a + 4 * k) > rl(d, a + 4 * (k - 1)) && rl(d, a + 4 * k) < d.length;
  if (ok) {
    table = a;
    break;
  }
}
if (table < 0) throw new Error("Can't find the Walsh paragraph table.");

const para = (k: number) => {
  let a = rl(d, table + 4 * k);
  let s = '';
  while (d[a] !== 0x0d) s += String.fromCharCode(d[a++]);
  return showText(s).trim();
};
function names(t: number): string[] {
  const b = rl(d, 0x28dc + 4 * t);
  let a = b + rw(d, b + 4);
  const out: string[] = [];
  for (let k = 0; k < 3; k++) {
    const n = rw(d, a) - 2;
    out.push(String.fromCharCode(...d.subarray(a + 2, a + 2 + n)).replace(/\0/g, ''));
    a += 2 + ((n + 1) & ~1);
  }
  return out;
}

const csv = readFileSync(`public/${CFB27_LATEST.file}`, 'utf8');
const csvTeams = new Set(
  csv
    .split(/\r?\n/)
    .slice(1)
    .map((l) => (l.startsWith('"') ? l.slice(1, l.indexOf('"', 1)) : l.split(',')[0]))
    .filter(Boolean),
);

const reports: WalshData['reports'] = {};
const problems: string[] = [];
for (let t = 0; t < teams; t++) {
  const school = names(t)[0];
  const team = CSV_NAMES[school] ?? school;
  if (!csvTeams.has(team)) problems.push(`${school}: no team "${team}" in the CSV`);
  if (reports[team]) problems.push(`${team}: two reports`);
  const r = { offense: para(6 + 2 * t), defense: para(7 + 2 * t) };
  const p = reportProblems(r);
  if (p.length) problems.push(`${team}: ${p.join(' ')}`);
  reports[team] = r;
}
for (const t of csvTeams) if (!reports[t]) problems.push(`${t}: no report in the ROM`);
if (problems.length) throw new Error(problems.join('\n'));

const sorted = Object.fromEntries(Object.entries(reports).sort(([a], [b]) => a.localeCompare(b)));
const data: WalshData = {
  app: 'genesis-cfb-toolkit',
  tool: 'walsh-reports',
  version: 1,
  season: CFB27_LATEST.season,
  week: CFB27_LATEST.week,
  source,
  reports: sorted,
};
writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
const lens = Object.values(sorted).map((r) => r.offense.length + r.defense.length);
console.log(JSON.stringify({ out, teams: lens.length, shortest: Math.min(...lens), longest: Math.max(...lens) }));
