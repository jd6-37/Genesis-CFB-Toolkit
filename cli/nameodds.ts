// Builds src/core/dynasty/nameOdds.json: for every first and last name in the built-in CFB 27 ratings, how
// likely a player with that name is Black (0-1). The dynasty uses it to pair names and skin tones
// (src/core/dynasty/appearance.ts). Sources (both free to use):
//   - US Census Bureau, 2010 surnames (public domain): share of each race and Hispanic origin per surname
//   - Tzioumis (2018), "Demographic aspects of first names", Harvard Dataverse (CC0): the same per first name
// Both as CSVs with columns name,white,black,api,native,multiple,hispanic (the copies in the surgeo package
// on PyPI: surgeo/data/prob_race_given_surname_2010.csv and prob_race_given_first_name_harvard.csv).
//   npx tsx cli/nameodds.ts SURNAMES.csv FIRST_NAMES.csv
// Names the tables don't have (modern first names, hyphenated or rare surnames) are estimated from the
// other half of the names and the positions of the CFB 27 players who have them (BLACK_SHARE), pulled
// toward the average when few do.

import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '../src/core/rosterSheet';
import { CFB27_LATEST } from '../src/core/cfb27Latest';
import { BLACK_SHARE } from '../src/core/dynasty/appearance';

const [surPath, firstPath] = process.argv.slice(2);
if (!surPath || !firstPath) {
  console.error('usage: tsx cli/nameodds.ts SURNAMES.csv FIRST_NAMES.csv');
  process.exit(2);
}

const BASE = 0.13; // share of Black Americans, roughly; only the ranking of names matters
const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clampP = (p: number) => Math.min(0.99, Math.max(0.01, p));

function table(path: string): Map<string, number> {
  const s = parseCsv(readFileSync(path, 'utf8'));
  const [cName, cBlack] = [s.headers.indexOf('name'), s.headers.indexOf('black')];
  return new Map(s.rows.map((r) => [r[cName].toUpperCase(), Number(r[cBlack])]));
}
const surnames = table(surPath), firsts = table(firstPath);

/** A name's key in the tables: letters only, without Jr./Sr./II-V. */
const key = (n: string) => n.replace(/\b(Jr|Sr)\.?$|\s+(II|III|IV|V)$/i, '').trim().toUpperCase().replace(/[^A-Z]/g, '');
/** Known share for a name: the whole name, else the average of its parts (Coleman-Williams). */
function known(n: string, t: Map<string, number>): number | null {
  const whole = t.get(key(n));
  if (whole !== undefined) return whole;
  const parts = n.replace(/\b(Jr|Sr)\.?$|\s+(II|III|IV|V)$/i, '').split(/[-\s]+/).map((x) => t.get(key(x))).filter((x): x is number => x !== undefined);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

const csv = parseCsv(readFileSync(new URL(`../public/${CFB27_LATEST.file}`, import.meta.url), 'utf8'));
const cF = csv.headers.findIndex((h) => h.replace(/^\uFEFF/, '') === 'First Name'), cL = csv.headers.indexOf('Last Name');
const cP = csv.headers.indexOf('Position');
const posKey = (p: string) => p.trim().replace(/^LEDG$/, 'LE').replace(/^REDG$/, 'RE');
const players = csv.rows.map((r) => ({ f: r[cF].trim(), l: r[cL].trim(), pos: posKey(r[cP]) })).filter((p) => p.f && p.l);
// Position as evidence too: the share of Black players at his position against the average share.
const meanShare = players.reduce((a, p) => a + (BLACK_SHARE[p.pos] ?? 0.5), 0) / players.length;
const posEvidence = (pos: string) => logit(clampP(BLACK_SHARE[pos] ?? 0.5)) - logit(meanShare);

const first = new Map<string, number | null>(), last = new Map<string, number | null>();
for (const p of players) {
  if (!first.has(p.f)) first.set(p.f, known(p.f, firsts));
  if (!last.has(p.l)) last.set(p.l, known(p.l, surnames));
}
// Unknown names from the known other half of their players' names (evidence against BASE), shrunk by 2.
function estimate(own: Map<string, number | null>, other: Map<string, number | null>, side: 'f' | 'l') {
  const sum = new Map<string, [number, number]>();
  for (const p of players) {
    const mine = side === 'f' ? p.f : p.l, theirs = side === 'f' ? p.l : p.f;
    if (own.get(mine) !== null) continue;
    const o = other.get(theirs);
    const e = (o === null || o === undefined ? 0 : logit(clampP(o)) - logit(BASE)) + posEvidence(p.pos);
    const [s, n] = sum.get(mine) ?? [0, 0];
    sum.set(mine, [s + e, n + 1]);
  }
  const out = new Map<string, number>();
  for (const [name, p] of own) out.set(name, p !== null ? p : (() => { const [s, n] = sum.get(name) ?? [0, 0]; return sigmoid(logit(BASE) + s / (n + 2)); })());
  return out;
}
const firstOut = estimate(first, last, 'f'), lastOut = estimate(last, first, 'l');

const round = (m: Map<string, number>) => Object.fromEntries([...m].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
writeFileSync(new URL('../src/core/dynasty/nameOdds.json', import.meta.url), JSON.stringify({ first: round(firstOut), last: round(lastOut) }) + '\n');
const share = (m: Map<string, number | null>) => [...m.values()].filter((x) => x !== null).length;
console.log(`first names: ${first.size} (${share(first)} in the table), last names: ${last.size} (${share(last)} in the table)`);
