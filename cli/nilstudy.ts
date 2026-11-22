// A study of NIL over long dynasties (not a test): the same seeds with NIL on and off, every team run by the computer,
// seasons made up from team strength (cli/dynastysim.ts).
//   npx tsx cli/nilstudy.ts ROM_2026 [SEEDS=3] [SEASONS=20] [OUT.json]
import { writeFileSync } from 'node:fs';
import { loadRom, newDynasty, playSeason, runOffseason, strengths } from './dynastysim';
import { seasonView } from '../src/core/dynasty/derive';
import { enableNil, marketValue, payroll, payRates } from '../src/core/dynasty/nil';
import { seasonPrestige } from '../src/core/dynasty/prestige';
import { STAR_POINTS } from '../src/core/dynasty/offseason';
import type { Dynasty } from '../src/core/dynasty/model';

const [romPath, seedsArg = '3', seasonsArg = '20', outPath] = process.argv.slice(2);
const rom = await loadRom(romPath);
const P4 = new Set(['SEC', 'Big Ten', 'ACC', 'Big 12']);
const BB = new Set(['Alabama', 'Georgia', 'Ohio State', 'Texas', 'Michigan', 'Notre Dame', 'Oregon', 'LSU', 'Clemson', 'USC', 'Oklahoma', 'Penn State']);
const GRP: Record<string, string> = { QB: 'QB', HB: 'RB', FB: 'RB', WR: 'WR', TE: 'TE', LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL', LE: 'DL', RE: 'DL', DT: 'DL', LOLB: 'LB', MLB: 'LB', ROLB: 'LB', CB: 'DB', FS: 'DB', SS: 'DB', K: 'K', P: 'K' };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const q = (xs: number[], f: number) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(f * (s.length - 1))]; };
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

type Row = Record<string, number | string>;

function measure(d: Dynasty, before: Dynasty | null, tag: string, seed: number): Row {
  const s = d.seasons[d.seasons.length - 1]; // the season about to be played
  const prev = d.seasons[d.seasons.length - 2];
  const conf = (t: number) => s.confNames[s.conf[t]];
  const tier = (t: number) => (P4.has(conf(t)) ? 'P4' : conf(t) === 'Independents' ? 'IND' : 'G5');
  const str = strengths(d, rom);
  const n = d.teams.length;
  const teams = d.teams.map((t) => t.index);
  const p4 = teams.filter((t) => tier(t) === 'P4'), g5 = teams.filter((t) => tier(t) === 'G5');
  const row: Row = { tag, seed, year: s.year };
  row.strP4 = +mean(p4.map((t) => str[t])).toFixed(1);
  row.strG5 = +mean(g5.map((t) => str[t])).toFixed(1);
  row.strSd = +sd(str).toFixed(2);
  const sorted = teams.slice().sort((a, b) => str[b] - str[a]);
  row.top10 = +mean(sorted.slice(0, 10).map((t) => str[t])).toFixed(1);
  row.g5InTop25Str = sorted.slice(0, 25).filter((t) => tier(t) === 'G5').length;
  const pres = seasonPrestige(d, s);
  row.six = pres.filter((x) => x === 6).length;
  row.g5Pres = +mean(g5.map((t) => pres[t])).toFixed(2);
  // Last season's results (the one just played) and the offseason that followed.
  if (prev) {
    const v = seasonView({ ...d, seasons: d.seasons.slice(0, -1) }, prev);
    row.champ = d.teams[v.champion ?? 0]?.school ?? '';
    row.champG5 = v.champion !== null && tier(v.champion) === 'G5' ? 1 : 0;
    const dn = prev.nil?.donor;
    row.donors = dn ? dn.filter((x) => x > 0).length : 0;
    row.donorBest = dn && dn.some((x) => x > 0) ? Math.min(...dn.map((x, t) => (x > 0 ? v.rank[t] : 999))) : 0;
    if (dn) dn.forEach((x, t) => { if (x > 0) donorLog.push(`${prev.year} ${d.teams[t].school} left ${x} rank ${v.rank[t]}${v.champion === t ? ' CHAMPION' : ''}`); });
    row.g5Top25 = v.order.slice(0, 25).filter((t) => tier(t) === 'G5').length;
    row.g5Top12 = v.order.slice(0, 12).filter((t) => tier(t) === 'G5').length;
    row.bb10 = v.order.slice(0, 10).filter((t) => BB.has(d.teams[t].school)).length;
    row.top5Str = +mean(teams.slice().sort((a, b) => str[b] - str[a]).slice(0, 5).map((t) => str[t])).toFixed(1);
    const ev = s.events ?? [];
    const tr = ev.filter((e) => e.kind === 'transfer') as { from: number; to: number; ovr: number }[];
    row.transfers = tr.length;
    row.g5ToP4 = tr.filter((e) => tier(e.from) === 'G5' && tier(e.to) === 'P4').length;
    row.p4ToG5 = tr.filter((e) => tier(e.from) === 'P4' && tier(e.to) === 'G5').length;
    row.g5StartersOut = tr.filter((e) => tier(e.from) === 'G5' && e.ovr >= 80).length;
    const signed = ev.filter((e) => e.kind === 'signed') as { team: number; stars: number }[];
    row.blueChipG5 = signed.filter((e) => e.stars >= 4 && tier(e.team) === 'G5').length;
    row.fiveP4 = signed.filter((e) => e.stars === 5 && tier(e.team) === 'P4').length;
    const cls = (ts: number[]) => mean(ts.map((t) => signed.filter((e) => e.team === t).reduce((a, e) => a + STAR_POINTS[e.stars], 0)));
    row.classP4 = Math.round(cls(p4));
    row.classG5 = Math.round(cls(g5));
    row.walkons = ev.filter((e) => e.kind === 'walkon').length;
  }
  if (s.nil && d.nil) {
    const b = s.nil.budget;
    const byConf: Record<string, number[]> = {};
    for (const t of teams) (byConf[conf(t)] ??= []).push(b[t]);
    for (const [c, xs] of Object.entries(byConf)) row[`b_${c}`] = +(mean(xs) / 1e6).toFixed(1);
    row.scale = +(s.nil.market.scale ?? 1).toFixed(2);
    row.bMax = +(Math.max(...b) / 1e6).toFixed(1);
    row.bMaxTeam = d.teams[b.indexOf(Math.max(...b))].school;
    row.bG5Max = +(Math.max(...g5.map((t) => b[t])) / 1e6).toFixed(1);
    const pay = teams.map((t) => payroll(d.players, t));
    row.payBudP4 = +mean(p4.map((t) => pay[t] / b[t])).toFixed(2);
    row.payBudG5 = +mean(g5.map((t) => pay[t] / b[t])).toFixed(2);
    row.overBudget = teams.filter((t) => pay[t] > b[t] * 1.02).length;
    const rates = payRates(d.players, b, s.nil.market);
    row.rateP4 = +mean(p4.map((t) => rates[t])).toFixed(2);
    row.rateG5 = +mean(g5.map((t) => rates[t])).toFixed(2);
    // Median pay by group and tier, against the real 2026 medians (QB $295,550 P4 / $32,570 non-P4).
    for (const g of ['QB', 'OL', 'WR']) {
      for (const [tn, ts] of [['P4', p4], ['G5', g5]] as const) {
        const set = new Set(ts);
        const xs = d.players.filter((p) => p.status === 'active' && p.team !== null && set.has(p.team) && GRP[p.pos] === g).map((p) => p.nil ?? 0);
        row[`med${g}${tn}`] = Math.round(q(xs, 0.5) / 1000);
      }
    }
    const qb = d.players.filter((p) => p.status === 'active' && p.team !== null && tier(p.team) === 'P4' && p.pos === 'QB').map((p) => p.nil ?? 0);
    row.p90QBP4 = Math.round(q(qb, 0.9) / 1000);
    row.topPay = Math.round(Math.max(...d.players.filter((p) => p.status === 'active').map((p) => p.nil ?? 0)) / 1000);
    row.unpaid = d.players.filter((p) => p.status === 'active' && p.team !== null && !p.nil).length;
    void marketValue; void before; void n;
  }
  return row;
}

const rows: Row[] = [];
const donorLog: string[] = [];
const seeds = +seedsArg, seasons = +seasonsArg;
for (let seed = 1; seed <= seeds; seed++) {
  for (const mode of (process.env.MODES ?? 'off,nil').split(',') as ('off' | 'nil')[]) {
    const t0 = Date.now();
    let d = newDynasty(rom, seed);
    if (mode === 'nil') d = enableNil(d);
    rows.push(measure(d, null, mode, seed));
    for (let y = 0; y < seasons; y++) {
      d = playSeason(d, rom, seed * 1000 + y);
      d = runOffseason(d, seed * 7919 + y);
      rows.push(measure(d, null, mode, seed));
    }
    console.error(`seed ${seed} ${mode}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
if (outPath) writeFileSync(outPath, JSON.stringify(rows));
if (donorLog.length) console.log(donorLog.join('\n'));
// Summary: by mode, averaged over seeds, by period.
const keys = Object.keys(rows.find((r) => r.tag === 'nil' && r.transfers !== undefined) ?? rows[0]).filter((k) => typeof rows.find((r) => r[k] !== undefined)![k] === 'number' && !['seed', 'year'].includes(k));
const periods = [[0, 0], [1, 5], [6, 10], [11, 15], [16, 30]].filter(([a]) => a <= seasons);
for (const k of keys) {
  const line = [k.padEnd(14)];
  for (const mode of ['off', 'nil']) {
    for (const [a, b] of periods) {
      const xs = rows.filter((r) => r.tag === mode && typeof r[k] === 'number' && +r.year - 2026 >= a && +r.year - 2026 <= b).map((r) => r[k] as number);
      line.push(xs.length ? mean(xs).toFixed(xs.some((x) => Math.abs(x) < 10 && x % 1) ? 2 : 1).padStart(8) : '       -');
    }
  }
  console.log(line.join(''));
}
console.log(''.padEnd(14) + ['off y0', 'off 1-5', 'off 6-10', 'off 11-15', 'off 16+', 'nil y0', 'nil 1-5', 'nil 6-10', 'nil 11-15', 'nil 16+'].map((x) => x.padStart(8)).join(''));
for (const mode of ['off', 'nil']) {
  const ch = rows.filter((r) => r.tag === mode && r.champ).map((r) => r.champ as string);
  const c: Record<string, number> = {};
  for (const x of ch) c[x] = (c[x] ?? 0) + 1;
  console.log(mode, 'champions:', Object.entries(c).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b}`).join(', '));
}
