// Long-run dynasty simulation for studies (not a test): plays seasons without the game. Each season's results are
// made up from the teams' OFF / DEF ratings and written as a battery save the app reads like a real one, then the
// whole offseason runs as the computer would run it for every team. Used by cli/nilstudy.ts.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { createDynasty, rng, toBase64, type Dynasty, type DSeason } from '../src/core/dynasty/model';
import { CFB27_LATEST } from '../src/core/cfb27Latest';
import { readRealSchedule } from '../src/core/dynasty/schedule';
import { readRating } from '../src/core/teamRatings';
import { editionOf } from '../src/core/dynasty/edition';
import * as Off from '../src/core/dynasty/offseason';
import * as Rec from '../src/core/dynasty/recruiting';

export async function loadRom(path: string): Promise<Uint8Array> {
  return (await openRom(basename(path), new Uint8Array(readFileSync(path)))).data;
}

export function newDynasty(rom: Uint8Array, seed: number): Dynasty {
  const csv = readFileSync(new URL(`../public/${CFB27_LATEST.file}`, import.meta.url), 'utf8');
  return createDynasty(rom, csv, { name: 'Study', seed, id: `study${seed}`, created: '2026-01-01T00:00:00.000Z' });
}

const last = (d: Dynasty) => d.seasons[d.seasons.length - 1];

/** A team's strength this season: the mean of its OFF and DEF (the numbers the game's sim reads). */
export function strengths(d: Dynasty, rom: Uint8Array): number[] {
  const s = last(d);
  return d.teams.map((t) => { const o = s.teamOvr?.[t.index] ?? readRating(rom, t.index); return (o.off + o.def) / 2; });
}

/**
 * Makes up a season: every game decided by the strength gap (logistic, 4.5 points of home edge in OVR terms), a
 * 12-team playoff of the best records, the final poll by record and strength. Returns the save's bytes (packed,
 * layout 2), which the app parses as it would a real one.
 */
export function fakeSeasonSave(d: Dynasty, rom: Uint8Array, seed: number, spread = 5): Uint8Array {
  const r = rng(seed >>> 0);
  const s = last(d);
  const n = d.teams.length;
  const str = strengths(d, rom);
  const sched = s.schedule ?? readRealSchedule(rom, n);
  if (!sched) throw new Error('No schedule.');
  const weeks0 = Math.max(...sched.games.map((g) => g.week)) + 1;
  const games: { week: number; v: number; h: number; vs: number; hs: number }[] = [];
  const wins = new Array(n).fill(0), losses = new Array(n).fill(0);
  const play = (week: number, v: number, h: number, neutral = false) => {
    const edge = str[h] - str[v] + (neutral ? 0 : 1.5);
    const pHome = 1 / (1 + Math.exp(-edge / spread));
    const homeWins = r() < pHome;
    const lo = 3 + Math.floor(r() * 25), hi = lo + 1 + Math.floor(r() * 24);
    const [hs, vs] = homeWins ? [hi, lo] : [lo, hi];
    games.push({ week, v, h, vs, hs });
    if (homeWins) { wins[h]++; losses[v]++; } else { wins[v]++; losses[h]++; }
    return homeWins ? h : v;
  };
  for (const g of sched.games.slice().sort((a, b) => a.week - b.week)) if (g.visitor !== null && g.home !== null) play(g.week, g.visitor, g.home);
  // Poll before the playoff: record first, strength second.
  const score = (t: number) => (wins[t] / Math.max(1, wins[t] + losses[t])) * 100 + str[t] * 0.6 + r() * 3;
  let order = d.teams.map((t) => t.index).sort((a, b) => score(b) - score(a));
  // 12-team playoff: 5-12, 6-11, 7-10, 8-9; then the top four.
  let week = weeks0;
  const seeds = order.slice(0, 12);
  const firstRound = [[4, 11], [5, 10], [6, 9], [7, 8]].map(([a, b]) => play(week, seeds[b], seeds[a]));
  week++;
  let round = [0, 1, 2, 3].map((i) => play(week, firstRound[i], seeds[i], true));
  week++;
  const semis = [play(week, round[3], round[0], true), play(week, round[2], round[1], true)];
  week++;
  const champ = play(week, semis[1], semis[0], true);
  week++;
  // Final poll: champion first, the runner-up second, then the rest as before (playoff teams' wins counted).
  const runner = semis.find((t) => t !== champ)!;
  order = [champ, runner, ...d.teams.map((t) => t.index).filter((t) => t !== champ && t !== runner).sort((a, b) => score(b) - score(a))];
  const power = new Array(n).fill(0);
  order.forEach((t, i) => { power[t] = 2000 - i * 10; });

  // The save: packed data bytes, layout 2.
  const ST = 0x3951 >> 1, LEN = 169;
  const file = new Uint8Array(ST + n * LEN).fill(0xff);
  file[0] = editionOf(d).saveSigV2;
  file[1] = 0;
  file.fill(0, ST);
  const SB = 0xe01 >> 1;
  const sb = new Uint8Array(0x1370).fill(0);
  sb[0] = 0x5a; sb[1] = weeks0 - 1; sb[2] = week; sb[3] = 1 | 4;
  games.sort((a, b) => a.week - b.week);
  let gi = 0;
  for (let w = 0; w <= week; w++) {
    while (gi < games.length && games[gi].week < w) gi++;
    sb[8 + 2 * w] = gi >> 8; sb[9 + 2 * w] = gi & 255;
  }
  games.forEach((g, i) => { const a = 0x200 + 4 * i; sb[a] = g.vs; sb[a + 1] = g.v; sb[a + 2] = g.hs; sb[a + 3] = g.h; });
  for (let t = 0; t < n; t++) { sb[0x50 + 2 * t] = power[t] >> 8; sb[0x51 + 2 * t] = power[t] & 255; sb[0x164 + t] = order.indexOf(t) + 1 <= 25 ? order.indexOf(t) + 1 : 0; }
  sb.fill(0xff, 0x34, 0x34 + 24);
  file.set(sb, SB);
  return file;
}

/** Puts a made-up season's save into the dynasty, as an import would. */
export function playSeason(d: Dynasty, rom: Uint8Array, seed: number): Dynasty {
  const data = fakeSeasonSave(d, rom, seed);
  const s = last(d);
  const season: DSeason = { ...s, imports: [...s.imports, { at: '2026-01-01T00:00:00.000Z', played: 0, weeksDone: 0, data: toBase64(data) }] };
  return { ...d, seasons: [...d.seasons.slice(0, -1), season] };
}

/** The whole offseason as the computer runs it for every team (full recruiting). `hooks` run between the steps. */
export function runOffseason(d: Dynasty, seed: number, hooks: { beforeDepth?: (d: Dynasty) => Dynasty; beforeRecruiting?: (d: Dynasty) => Dynasty; beforeSigning?: (d: Dynasty) => void; afterWeek?: (d: Dynasty) => Dynasty; userPlans?: (d: Dynasty) => Record<number, Rec.TeamPlan> } = {}): Dynasty {
  let x = Off.startOffseason(d, { seed, force: true });
  if (x.offseason!.step === 'carousel') throw new Error('Coaches are off in the study.');
  if (hooks.beforeDepth) x = hooks.beforeDepth(x);
  x = Off.confirmDepth(x);
  if (hooks.beforeRecruiting) x = hooks.beforeRecruiting(x);
  const tpl = Off.recruitTemplates(x);
  x = Rec.openRecruiting(x, tpl);
  const W = x.offseason!.recruiting ? 99 : 0;
  if (hooks.userPlans) {
    while (x.offseason!.recruiting && x.offseason!.recruiting!.week < W) {
      try { x = Rec.recruitingWeek(x, hooks.userPlans(x)); } catch (e) { if (String(e).includes('signing day')) break; throw e; }
    }
  } else if (hooks.afterWeek) {
    while (true) {
      try { x = Rec.recruitingWeek(x, {}); } catch { break; }
      x = hooks.afterWeek(x);
    }
  } else {
    x = Rec.simRecruiting(x);
    while (x.offseason!.recruiting!.week < 99) {
      try { x = Rec.recruitingWeek(x, {}); } catch { break; }
    }
  }
  hooks.beforeSigning?.(x);
  x = Rec.finishRecruiting(x, tpl);
  x = Off.applyCuts(x, {}, tpl);
  return Off.finishOffseason(x);
}
