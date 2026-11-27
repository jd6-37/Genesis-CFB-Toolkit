// Stories for the Dynasty's news homepage, written from the season's results with templates.
// Pure functions: the same season gives the same stories.

import { kickoffOf } from './schedule';
import { fcsLabel } from './fcs';
import { hasNil, money, NIL } from './nil';
import { bowlOf, bowlWeek, INDEPENDENT, leaders, playerLabel, playerLines, playerName, RECORD_STATS, seasonView, standings, statValue, weekName, type SeasonView } from './derive';
import { preseasonPoll } from './poll';
import { rivalryOf } from './rivalries';
import { fromBase64, type Dynasty, type OffseasonEvent } from './model';
import { readDynastySave, type DynastySave, type SaveGame } from './save';
import { goalsFor, hotSeat, regularRecord, tenure } from './carousel';

export interface Story {
  id: string;
  headline: string;
  dek: string;
  /** Teams the story is about (the first one picks the art and colors). */
  teams: number[];
  week: number;
  /** Higher = more important (the top one leads). */
  weight: number;
  kind: 'champion' | 'upset' | 'topgame' | 'rout' | 'yours' | 'number1' | 'unbeaten' | 'leader' | 'cfp' | 'title' | 'potw' | 'milestone' | 'streak' | 'rivalry' | 'race' | 'record' | 'commit';
  /** The player a story is about (stat leaders, milestones, players of the week): the headline links to him. */
  player?: number;
  /**
   * A player of the week's game (user, 2026-11-12: "I have no idea how Hubert 'wrecked' the game … open a
   * modal that shows that player's stats from that game"): the result and his stat lines for the week.
   */
  box?: { result: string; lines: { cat: string; cells: [string, number | string][] }[] };
  /** The game the story is about (its index in the season's games): its headline opens the game's window (user, 2026-11-26). */
  game?: number;
  /** The stat a leader, milestone or record story is about: its window shows that stat's top five. */
  stat?: { cat: 'passing' | 'rushing' | 'receiving' | 'defense'; key: string; label: string };
  /** The conference a race story is about: its window shows the standings. */
  conf?: number;
}

// A ranked team's rank before its name, "#8 Oregon" (user, 2026-11-18: both teams' ranks when both are ranked).
const rk = (r: number) => (r >= 1 && r <= 25 ? `#${r} ` : '');

/** One of a story's wordings, picked by its ID (the same story always reads the same). */
function pick<T>(id: string, list: T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

/** The season's import before the latest, if any. */
function previousSave(v: SeasonView): { save: DynastySave; weeksDone: number } | null {
  const imps = v.season.imports;
  if (imps.length < 2) return null;
  const prev = imps[imps.length - 2];
  return { save: readDynastySave(fromBase64(prev.data)), weeksDone: prev.weeksDone };
}

type Totals = Map<string, Record<string, number>>;
/** Every slot's season totals (sums only), keyed "team/category/slot". */
function totals(save: DynastySave): Totals {
  const out: Totals = new Map();
  save.stats.forEach((ts, team) => {
    for (const cat of ['passing', 'rushing', 'receiving', 'defense'] as const) {
      for (const e of ts[cat]) out.set(`${team}/${cat}/${e.slot}`, e.s as unknown as Record<string, number>);
    }
  });
  return out;
}

export function stories(d: Dynasty, v: SeasonView = seasonView(d, d.seasons[d.seasons.length - 1])): Story[] {
  const out: Story[] = [];
  const s = v.save?.season;
  if (!s) return out;
  const name = (t: number) => d.teams[t].school;
  const full = (t: number) => `${d.teams[t].school} ${d.teams[t].nickname}`;
  const year = v.season.year;

  // The last week with results.
  let week = -1;
  for (const g of v.games) if (g.vs !== null && g.week > week) week = g.week;
  if (week < 0) return out;
  const weekGames = v.games.filter((g) => g.week === week && g.vs !== null && g.visitor !== null && g.home !== null);
  // Ranks going into the week, the ones the game had at kickoff (user, 2026-11-18: "the rankings at the time of the
  // game, not the new rankings after"): the save's ranks as of last week; before the first poll of the season, the
  // preseason poll (the ROM's for the first season, the app's after); the current ranks only when neither is known.
  const nextStarted = v.games.some((g) => g.week === week + 1 && g.vs !== null);
  const preseason = s.lastRanks.some((r) => r > 0) ? null : preseasonPoll(d, v.season);
  const pollRank = preseason ? (() => { const r = new Array<number>(d.teams.length).fill(0); for (const e of preseason) r[e.team] = e.rank; return r; })() : null;
  const pre = nextStarted ? v.rank : s.lastRanks.map((r, t) => r || pollRank?.[t] || v.rank[t]);
  const wk = weekName(v, week);
  const post = week > v.lastRegularWeek;

  for (const g of weekGames as (SaveGame & { visitor: number; home: number; vs: number; hs: number })[]) {
    if (g.vs === g.hs) continue;
    const [w, l, ws, ls] = g.vs > g.hs ? [g.visitor, g.home, g.vs, g.hs] : [g.home, g.visitor, g.hs, g.vs];
    const rw = pre[w] <= 25 ? pre[w] : 0;
    const rl = pre[l] <= 25 ? pre[l] : 0;
    const where = w === g.home ? 'at home' : 'on the road';
    const id = `${year}-${week}-${g.index}`;
    if (v.bowls && bowlOf(v, g)) {
      // 1994: each bowl's result (the champion comes from the final poll, below; the SEC title game is a title story).
      const bowl = bowlOf(v, g)!;
      out.push({
        id: `${id}-bowl`, kind: 'title', week, game: g.index, weight: 36 + (26 - Math.min(26, rw || 26)) + (26 - Math.min(26, rl || 26)) / 2, teams: [w, l],
        headline: pick(id, [`${rk(rw)}${name(w)} wins the ${bowl}`, `${rk(rw)}${name(w)} takes the ${bowl} over ${rk(rl)}${name(l)}`]),
        dek: `${rk(rw)}${name(w)} beat ${rk(rl)}${name(l)} ${ws}-${ls} to finish ${v.records[w].w}-${v.records[w].l}.`,
      });
      continue;
    }
    if (v.champion === w && week === v.weeks - 1) {
      out.push({
        id: `${id}-champ`, kind: 'champion', week, game: g.index, weight: 100, teams: [w, l],
        headline: `${rk(rw)}${name(w)} wins the ${year} national championship`,
        dek: `${full(w)} beat ${rk(rl)}${name(l)} ${ws}-${ls} to finish ${v.records[w].w}-${v.records[w].l}.`,
      });
      continue;
    }
    if (post && week === v.lastRegularWeek + 1) {
      out.push({
        id: `${id}-title`, kind: 'title', week, game: g.index, weight: 45 + (25 - Math.min(25, rw || 25)), teams: [w, l],
        headline: `${name(w)} claims the ${v.season.confNames[v.season.conf[w]] ?? 'conference'} title`,
        dek: `${rk(rw)}${name(w)} beat ${rk(rl)}${name(l)} ${ws}-${ls} in the conference championship game.`,
      });
      continue;
    }
    // The named opening game has its own story (below), not an upset / top game / rout one.
    const named = !!kickoffOf(v.season, g);
    if (named) { /* its own story */ } else if (rl && (!rw || rw > rl + 10)) {
      out.push({
        id: `${id}-upset`, kind: 'upset', week, game: g.index, weight: 60 + (26 - rl), teams: [w, l],
        headline: pick(id, [`${rk(rw)}${name(w)} stuns ${rk(rl)}${name(l)}, ${ws}-${ls}`, `Upset: ${rk(rw)}${name(w)} knocks off ${rk(rl)}${name(l)} ${ws}-${ls}`, `${rk(rl)}${name(l)} falls to ${rk(rw)}${name(w)}, ${ws}-${ls}`]),
        dek: pick(id + 'd', [`${full(w)} took down ${rk(rl)}${name(l)} ${where} in ${wk}.`, `${full(w)} (${v.records[w].w}-${v.records[w].l}) pulled the upset ${where} in ${wk}.`, `${name(l)} drops to ${v.records[l].w}-${v.records[l].l} after the loss ${w === g.home ? 'on the road' : 'at home'}.`]),
      });
    } else if (rw && rl) {
      // "Holds off" only for a close game, "rolls past" only for a big win (user, 2026-11-26).
      const m = ws - ls;
      out.push({
        id: `${id}-top`, kind: 'topgame', week, game: g.index, weight: 50 + (52 - rw - rl) / 2, teams: [w, l],
        headline: pick(id, m <= 7
          ? [`${rk(rw)}${name(w)} holds off ${rk(rl)}${name(l)}, ${ws}-${ls}`, `${rk(rw)}${name(w)} edges ${rk(rl)}${name(l)} ${ws}-${ls}`, `${rk(rw)}${name(w)} wins the Top 25 clash with ${rk(rl)}${name(l)}, ${ws}-${ls}`]
          : m >= 21
            ? [`${rk(rw)}${name(w)} rolls past ${rk(rl)}${name(l)}, ${ws}-${ls}`, `${rk(rw)}${name(w)} routs ${rk(rl)}${name(l)} ${ws}-${ls}`, `${rk(rw)}${name(w)} dominates the Top 25 clash with ${rk(rl)}${name(l)}, ${ws}-${ls}`]
            : [`${rk(rw)}${name(w)} beats ${rk(rl)}${name(l)} ${ws}-${ls}`, `${rk(rw)}${name(w)} takes down ${rk(rl)}${name(l)}, ${ws}-${ls}`, `${rk(rw)}${name(w)} wins the Top 25 clash with ${rk(rl)}${name(l)}, ${ws}-${ls}`]),
        dek: pick(id + 'd', [`A Top 25 matchup in ${wk} goes to ${name(w)} ${where}.`, `${name(w)} improves to ${v.records[w].w}-${v.records[w].l} with the win ${where}.`, `${name(l)} had no answer ${w === g.home ? 'on the road' : 'at home'} in ${wk}.`]),
      });
    } else if (rw && ws - ls >= 35) {
      out.push({
        id: `${id}-rout`, kind: 'rout', week, game: g.index, weight: 30 + (26 - rw) / 2, teams: [w, l],
        headline: pick(id, [`${rk(rw)}${name(w)} routs ${name(l)} ${ws}-${ls}`, `${rk(rw)}${name(w)} rolls past ${name(l)}, ${ws}-${ls}`, `${rk(rw)}${name(w)} blows out ${name(l)} ${ws}-${ls}`]),
        dek: pick(id + 'd', [`${full(w)} won by ${ws - ls} points in ${wk}.`, `A ${ws - ls}-point win ${where} for ${name(w)}.`, `${name(w)} never looked back in ${wk}.`]),
      });
    }
    // A user team's game; not when it's a rivalry or the named opening game, which have their own story (user, 2026-11-26).
    const ownStory = named || !!rivalryOf(name(g.visitor), name(g.home));
    for (const u of d.userTeams) {
      if (ownStory || (u !== w && u !== l)) continue;
      const won = u === w;
      out.push({
        id: `${id}-yours-${u}`, kind: 'yours', week, game: g.index, weight: 55, teams: [u, won ? l : w],
        headline: won
          ? pick(id, [`${rk(rw)}${name(u)} beats ${rk(rl)}${name(l)} ${ws}-${ls}`, `${rk(rw)}${name(u)} takes care of ${rk(rl)}${name(l)}, ${ws}-${ls}`, `${rk(rw)}${name(u)} gets past ${rk(rl)}${name(l)} ${ws}-${ls}`])
          : pick(id, [`${rk(rl)}${name(u)} falls to ${rk(rw)}${name(w)} ${ws}-${ls}`, `${rk(rw)}${name(w)} beats ${rk(rl)}${name(u)} ${ws}-${ls}`, `${rk(rl)}${name(u)} comes up short against ${rk(rw)}${name(w)}, ${ws}-${ls}`]),
        dek: `${name(u)} is ${v.records[u].w}-${v.records[u].l} after ${wk}.`,
      });
    }
  }

  // Rankings: a new No. 1, unbeaten teams.
  const one = v.order[0];
  const wasOne = pre.indexOf(1);
  if (!post && one !== undefined && wasOne >= 0 && one !== wasOne) {
    out.push({
      id: `${year}-${week}-no1`, kind: 'number1', week, weight: 58, teams: [one],
      headline: `${name(one)} takes over No. 1`,
      dek: `${full(one)} (${v.records[one].w}-${v.records[one].l}) moves past ${name(wasOne)} at the top of the poll.`,
    });
  }
  // Your teams in and out of the Top 25 (user, 2026-11-27: "a news headline for when a user controlled team breaks into
  // (or falls out of) the top 25"): the rank going into the week against the new one; unknown before the first save.
  if (!post && !nextStarted) {
    for (const u of d.userTeams) {
      const was = s.lastRanks[u] || (pollRank ? pollRank[u] || 99 : 0), now = v.rank[u];
      if (!was || !now || (was <= 25) === (now <= 25)) continue;
      const g = weekGames.find((x) => x.visitor === u || x.home === u);
      const res = g && g.vs !== null && g.hs !== null ? (() => {
        const mine = g.visitor === u ? g.vs : g.hs, theirs = g.visitor === u ? g.hs : g.vs, opp = g.visitor === u ? g.home! : g.visitor!;
        return `${mine > theirs ? 'beat' : mine < theirs ? 'lost to' : 'tied'} ${name(opp)} ${Math.max(mine, theirs)}-${Math.min(mine, theirs)}`;
      })() : null;
      const rec = `${v.records[u].w}-${v.records[u].l}`;
      const id = `${year}-${week}-top25-${u}`;
      out.push(now <= 25
        ? { id, kind: 'yours', week, weight: 64, teams: [u],
            headline: pick(id, [`${name(u)} breaks into the Top 25 at No. ${now}`, `${name(u)} is ranked: No. ${now}`, `${name(u)} cracks the Top 25`]),
            dek: `${full(u)} (${rec})${res ? ` ${res} in ${wk}` : ''} and moves into the poll at No. ${now}.` }
        : { id, kind: 'yours', week, weight: 60, teams: [u],
            headline: pick(id, [`${name(u)} falls out of the Top 25`, `${name(u)} drops out of the poll`, `${name(u)} loses its spot in the Top 25`]),
            dek: `${full(u)} (${rec})${res ? ` ${res} in ${wk}` : ''} and drops from No. ${was} out of the poll.` });
    }
  }

  const unbeaten = v.records.filter((r) => r.l === 0 && r.w > 0);
  if (!post && week >= 3 && unbeaten.length > 0 && unbeaten.length <= 8) {
    const list = unbeaten.sort((a, b) => v.rank[a.team] - v.rank[b.team]);
    out.push({
      id: `${year}-${week}-unbeaten`, kind: 'unbeaten', week, weight: 35, teams: list.map((r) => r.team),
      headline: unbeaten.length === 1 ? `${name(list[0].team)} is the last unbeaten team` : `${unbeaten.length} unbeaten teams left`,
      dek: list.map((r) => `${name(r.team)} ${r.w}-0`).join(', ') + '.',
    });
  }

  // 1994: the bowl lineup once the game has set it, and the champion of the final poll.
  if (v.bowls) {
    const bw = v.games.filter((g) => g.week === bowlWeek(v) && g.visitor !== null && g.home !== null);
    if (bw.length) {
      const top = bw.slice(0, 5).map((g) => `${bowlOf(v, g)}: ${name(g.home!)} vs. ${name(g.visitor!)}`);
      const first = bw[0];
      out.push({
        id: `${year}-bowls`, kind: 'cfp', week: bowlWeek(v), weight: v.champion === null && !bw.some((g) => g.vs !== null) ? 70 : 20,
        teams: [first.home!, first.visitor!],
        headline: `Bowl lineup set: ${name(first.home!)} and ${name(first.visitor!)} in the ${bowlOf(v, first)}`,
        dek: `${bw.length} bowl games. ${top.join('; ')}.`,
      });
    }
    if (v.champion !== null) {
      const c = v.champion;
      const g = bw.find((x) => x.vs !== null && (x.visitor === c || x.home === c));
      const won = g && ((g.home === c) === (g.hs! > g.vs!));
      const opp = g ? (g.home === c ? g.visitor! : g.home!) : null;
      out.push({
        id: `${year}-champ`, kind: 'champion', week: v.weeks - 1, weight: 100, teams: opp === null ? [c] : [c, opp],
        headline: `${name(c)} finishes No. 1: the ${year} national champion`,
        dek: g && won && opp !== null
          ? `${full(c)} beat ${name(opp)} ${Math.max(g.vs!, g.hs!)}-${Math.min(g.vs!, g.hs!)} in the ${bowlOf(v, g)} and finish ${v.records[c].w}-${v.records[c].l}, first in the final poll.`
          : `${full(c)} finish ${v.records[c].w}-${v.records[c].l} and first in the final poll.`,
      });
    }
  }

  // Playoff field.
  if (s.seeds.length) {
    const t = s.seeds[0];
    out.push({
      id: `${year}-cfp`, kind: 'cfp', week: v.lastRegularWeek + 1, weight: v.champion === null ? 70 : 20, teams: s.seeds.slice(0, 4),
      headline: `Playoff field set: ${name(t)} is the No. 1 seed`,
      dek: `The ${s.seeds.length}-team field: ${s.seeds.map((x, i) => `${i + 1}. ${name(x)}`).join(', ')}.`,
    });
  }

  // Upsets by rating: a much lower-rated team wins (not already a ranked upset).
  const rating = (t: number) => { const o = v.season.teamOvr?.[t]; return o ? (o.off + o.def) / 2 : null; };
  const told = new Set(out.filter((x) => x.kind === 'upset').map((x) => x.teams.join('/')));
  weekGames
    .flatMap((g) => {
      if (g.vs === null || g.hs === null || g.vs === g.hs) return [];
      const [w, l, ws, ls] = g.vs > g.hs ? [g.visitor!, g.home!, g.vs, g.hs] : [g.home!, g.visitor!, g.hs, g.vs];
      const rw = rating(w), rl = rating(l);
      return rw !== null && rl !== null && rl - rw >= 8 && !told.has(`${w}/${l}`) ? [{ g, w, l, ws, ls, gap: rl - rw }] : [];
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 2)
    .forEach(({ g, w, l, ws, ls, gap }) => {
      const id = `${year}-${week}-${g.index}-rated`;
      out.push({
        id, kind: 'upset', week, game: g.index, weight: 40 + gap, teams: [w, l],
        headline: pick(id, [`${rk(pre[w])}${name(w)} shocks ${rk(pre[l])}${name(l)}, ${ws}-${ls}`, `Underdog ${rk(pre[w])}${name(w)} beats ${rk(pre[l])}${name(l)} ${ws}-${ls}`, `${rk(pre[w])}${name(w)} pulls off a stunner against ${rk(pre[l])}${name(l)}`]),
        dek: pick(id + 'd', [`${name(w)} came in rated ${Math.round(gap)} points lower than ${name(l)}.`, `On paper it was ${name(l)}'s game: ${name(w)} was rated ${Math.round(gap)} points lower.`]),
      });
    });

  // Streaks: a perfect start, a long losing streak ended, a long winning streak snapped.
  const results = (t: number) => v.games
    .filter((g) => g.vs !== null && g.hs !== null && g.vs !== g.hs && (g.visitor === t || g.home === t) && g.week <= week)
    .sort((a, b) => a.week - b.week)
    .map((g) => (g.visitor === t) === (g.vs! > g.hs!));
  for (const g of weekGames) {
    if (g.vs === null || g.hs === null || g.vs === g.hs) continue;
    const [w, l] = g.vs > g.hs ? [g.visitor!, g.home!] : [g.home!, g.visitor!];
    const id = `${year}-${week}-${g.index}-streak`;
    const rw = results(w), rl = results(l);
    const before = (r: boolean[], win: boolean) => { let n = 0; for (let i = r.length - 2; i >= 0 && r[i] === win; i--) n++; return n; };
    const rec = v.records[w];
    if (!post && rec.l === 0 && [5, 8, 10, 12].includes(rec.w)) {
      out.push({ id: `${id}-perfect`, kind: 'streak', week, game: g.index, weight: 32 + rec.w, teams: [w, l],
        headline: pick(id, [`${name(w)} improves to ${rec.w}-0`, `${name(w)} stays perfect at ${rec.w}-0`, `Still unbeaten: ${name(w)} moves to ${rec.w}-0`]),
        dek: `${full(w)} beat ${name(l)} in ${wk}.` });
    }
    const lostBefore = before(rw, false);
    if (lostBefore >= 5) out.push({ id: `${id}-ended`, kind: 'streak', week, game: g.index, weight: 30 + lostBefore, teams: [w, l],
      headline: pick(id, [`${name(w)} snaps a ${lostBefore}-game losing streak`, `${name(w)} wins for the first time in ${lostBefore + 1} games`]),
      dek: `${name(w)} beat ${name(l)} in ${wk}.` });
    const wonBefore = before(rl, true);
    if (wonBefore >= 6) out.push({ id: `${id}-snapped`, kind: 'streak', week, game: g.index, weight: 34 + wonBefore, teams: [w, l],
      headline: pick(id, [`${rk(pre[w])}${name(w)} ends ${rk(pre[l])}${name(l)}'s ${wonBefore}-game winning streak`, `${rk(pre[l])}${name(l)}'s ${wonBefore}-game run ends at ${rk(pre[w])}${name(w)}`]),
      dek: `${name(l)} drops to ${v.records[l].w}-${v.records[l].l}.` });
  }

  // Rivalry games of the week (rivalries.ts; user, 2026-11-12: more stories).
  for (const g of weekGames as (SaveGame & { visitor: number; home: number; vs: number; hs: number })[]) {
    if (g.vs === g.hs) continue;
    const rivalry = rivalryOf(name(g.visitor), name(g.home));
    if (!rivalry) continue;
    const [w, l, ws, ls] = g.vs > g.hs ? [g.visitor, g.home, g.vs, g.hs] : [g.home, g.visitor, g.hs, g.vs];
    const id = `${year}-${week}-${g.index}-rivalry`;
    const mine = d.userTeams.includes(w) || d.userTeams.includes(l);
    out.push({ id, kind: 'rivalry', week, game: g.index, weight: 44 + (mine ? 14 : 0) + (pre[w] <= 25 || pre[l] <= 25 ? 6 : 0), teams: [w, l],
      headline: pick(id, [`${name(w)} takes ${rivalry}, ${ws}-${ls}`, `${rivalry[0].toUpperCase()}${rivalry.slice(1)} goes to ${name(w)}`, `${name(w)} beats ${name(l)} in ${rivalry}`]),
      dek: `${full(w)} ${ws}, ${full(l)} ${ls}. ${name(w)} is ${v.records[w].w}-${v.records[w].l}, ${name(l)} ${v.records[l].w}-${v.records[l].l}.` });
  }

  // The season's named opening game (user, 2026-11-26: "highlight these kickoff games in the headlines … Call them by
  // name"): the Kickoff Classic (1994, Week 0) or the Aflac Kickoff Game (2026, Week 1).
  for (const g of weekGames as (SaveGame & { visitor: number; home: number; vs: number; hs: number })[]) {
    const k = kickoffOf(v.season, g);
    if (!k || g.vs === g.hs) continue;
    const [w, l, ws, ls] = g.vs > g.hs ? [g.visitor, g.home, g.vs, g.hs] : [g.home, g.visitor, g.hs, g.vs];
    const id = `${year}-${week}-${g.index}-kickoff`;
    const close = ws - ls <= 7, big = ws - ls >= 21;
    const rw = pre[w] <= 25 ? pre[w] : 0, rl = pre[l] <= 25 ? pre[l] : 0;
    const W = `${rk(rw)}${name(w)}`, L = `${rk(rl)}${name(l)}`;
    out.push({ id, kind: 'topgame', week, game: g.index, weight: 88, teams: [w, l], // the week's lead story
      headline: pick(id, close
        ? [`${W} edges ${L} in the ${k.name}, ${ws}-${ls}`, `${W} holds off ${L} in the ${k.name}`]
        : big ? [`${W} routs ${L} in the ${k.name}, ${ws}-${ls}`, `${W} rolls past ${L} in the ${k.name}`]
          : [`${W} beats ${L} in the ${k.name}, ${ws}-${ls}`, `${W} opens with a win over ${L} in the ${k.name}`]),
      dek: `The season's ${k.week === 0 ? 'first big game' : 'opening-weekend showcase'}: ${full(w)} ${ws}, ${full(l)} ${ls}.` });
  }

  // Conference races over the last three regular-season weeks: a clinched title, a shared lead, or a lead.
  if (!post && week >= v.lastRegularWeek - 2) {
    const races: Story[] = [];
    const confs = [...new Set(v.season.conf)].filter((c) => c !== INDEPENDENT);
    for (const c of confs) {
      const st = standings(v, c);
      if (st.length < 2) continue;
      const left = (t: number) => v.games.filter((g) => g.week <= v.lastRegularWeek && g.vs === null && g.visitor !== null && g.home !== null &&
        (g.visitor === t || g.home === t) && v.season.conf[g.visitor === t ? g.home : g.visitor] === c).length;
      const [a, b] = st;
      const cname = v.season.confNames[c] ?? 'conference';
      const id = `${year}-${week}-race-${c}`;
      const mine = st.some((r) => d.userTeams.includes(r.team));
      const weight = 33 + (mine ? 15 : 0) + (v.rank[a.team] <= 10 ? 6 : v.rank[a.team] <= 25 ? 3 : 0);
      const others = Math.max(...st.slice(1).map((r) => r.cw + left(r.team)));
      if (a.cw > others) {
        races.push({ id, kind: 'race', week, conf: c, weight: weight + 4, teams: [a.team],
          headline: pick(id, [`${name(a.team)} clinches first place in the ${cname}`, `${name(a.team)} locks up the top of the ${cname}`]),
          dek: `${full(a.team)} is ${a.cw}-${a.cl} in the ${cname}; nobody can catch them.` });
      } else if (a.cw === b.cw && a.cl === b.cl) {
        races.push({ id, kind: 'race', week, conf: c, weight, teams: [a.team, b.team],
          headline: pick(id, [`${name(a.team)} and ${name(b.team)} share the ${cname} lead`, `A two-way tie atop the ${cname}`]),
          dek: `${name(a.team)} and ${name(b.team)} are both ${a.cw}-${a.cl} in conference play with ${left(a.team)} and ${left(b.team)} conference games left.` });
      } else {
        const gb = ((a.cw - a.cl) - (b.cw - b.cl)) / 2;
        races.push({ id, kind: 'race', week, conf: c, weight: weight - 3, teams: [a.team, b.team],
          headline: pick(id, [`${name(a.team)} leads the ${cname} race`, `${name(a.team)} holds a ${gb === 1 ? 'one-game' : `${gb}-game`} lead in the ${cname}`]),
          dek: `${name(a.team)} is ${a.cw}-${a.cl} in the ${cname}, ${name(b.team)} ${b.cw}-${b.cl}, with ${left(a.team)} conference ${left(a.team) === 1 ? 'game' : 'games'} left for ${name(a.team)}.` });
      }
    }
    out.push(...races.sort((x, y) => y.weight - x.weight).slice(0, 4));
  }

  // Single-season records broken since the last import (against every earlier season of the dynasty).
  {
    const earlier = d.seasons.filter((x) => x.year < year);
    if (earlier.length) {
      const prevSave = previousSave(v);
      const before = prevSave ? totals(prevSave.save) : null;
      const now = totals(v.save!);
      const earlierLines = earlier.map((es) => ({ year: es.year, lines: playerLines(seasonView(d, es)) }));
      for (const stat of RECORD_STATS) {
        if (!['passing', 'rushing', 'receiving', 'defense'].includes(stat.cat)) continue;
        let best = 0, holder: number | null = null, holderYear = 0;
        for (const es of earlierLines) for (const l of es.lines) {
          if (l.cat === stat.cat && statValue(l, stat.key) > best) { best = statValue(l, stat.key); holder = l.player; holderYear = es.year; }
        }
        if (best <= 0) continue;
        // Only the new record holder: the season's top mark, if it passed the old record since the last import.
        let topKey: string | null = null, topVal = 0;
        for (const [key, s1] of now) if (key.split('/')[1] === stat.cat && (s1[stat.key] ?? 0) > topVal) { topVal = s1[stat.key] ?? 0; topKey = key; }
        for (const [key, s1] of now) {
          const [team, , slot] = key.split('/');
          if (key !== topKey || topVal <= best) continue;
          if (before && [...before].some(([k, b1]) => k.split('/')[1] === stat.cat && (b1[stat.key] ?? 0) > best)) continue; // broken before
          const pid = v.season.slots[Number(team)]?.[Number(slot)];
          const p = pid ? d.players[pid - 1] : undefined;
          if (!p) continue;
          const old = holder ? d.players[holder - 1] : undefined;
          const id = `${year}-record-${stat.cat}-${stat.key}-${p.id}`;
          out.push({ id, kind: 'record', week, weight: 62, teams: [Number(team)], player: p.id, stat: { cat: stat.cat as 'passing', key: stat.key, label: stat.label },
            headline: `${playerName(p)} sets the record for ${stat.label.toLowerCase()} in a season`,
            dek: `${name(Number(team))}'s ${p.pos} has ${(s1[stat.key]).toLocaleString('en-US')} after ${wk}, past ${old?.id === p.id ? 'his own' : old ? `${playerName(old)}'s` : 'the'} ${best.toLocaleString('en-US')} (${holderYear}).` });
        }
      }
    }
  }

  // Since the last import: milestones; and with saves exactly a week apart, the players of the week.
  const prev = previousSave(v);
  const latest = v.season.imports[v.season.imports.length - 1];
  if (prev && v.save) {
    const now = totals(v.save), then = totals(prev.save);
    const playerOfSlot = (key: string) => { const [t, , slot] = key.split('/').map(Number); return v.season.slots[t]?.[slot] ?? null; };
    const who = (key: string) => { const id = playerOfSlot(key); const p = id ? d.players[id - 1] : undefined; return { p, team: Number(key.split('/')[0]) }; };
    const MILESTONES: [string, string, number[], string][] = [
      ['passing', 'yds', [2000, 3000, 4000], 'passing yards'], ['passing', 'td', [20, 30, 40], 'touchdown passes'],
      ['rushing', 'yds', [1000, 1500, 2000], 'rushing yards'], ['receiving', 'yds', [1000, 1500], 'receiving yards'],
      ['rushing', 'td', [15, 20, 25], 'rushing touchdowns'], ['defense', 'sacks', [10, 15], 'sacks'], ['defense', 'int', [6, 9], 'interceptions'],
    ];
    const ms: Story[] = [];
    for (const [key, s1] of now) {
      const cat = key.split('/')[1];
      for (const [c, field, marks, what] of MILESTONES) {
        if (c !== cat) continue;
        const a = then.get(key)?.[field] ?? 0, b = s1[field] ?? 0;
        const mark = [...marks].reverse().find((m) => a < m && b >= m);
        if (!mark) continue;
        const { p, team } = who(key);
        if (!p) continue;
        const id = `${year}-${week}-ms-${p.id}-${field}-${mark}`;
        ms.push({ id, kind: 'milestone', week, stat: { cat: c as 'passing', key: field, label: what[0].toUpperCase() + what.slice(1) }, weight: 28 + marks.indexOf(mark) * 4 + (d.userTeams.includes(team) ? 10 : 0), teams: [team], player: p.id,
          headline: pick(id, [`${playerName(p)} passes ${mark.toLocaleString('en-US')} ${what}`, `${mark.toLocaleString('en-US')} ${what} and counting for ${name(team)}'s ${playerName(p)}`, `${name(team)}'s ${playerName(p)} reaches ${mark.toLocaleString('en-US')} ${what}`]),
          dek: `${playerLabel(p)} has ${b.toLocaleString('en-US')} ${what} after ${wk}.` });
      }
    }
    out.push(...ms.sort((x, y) => y.weight - x.weight).slice(0, 4));

    // A week's stats only when this import is exactly one week after the last (the game keeps season totals).
    const weekly = latest && prev.weeksDone === latest.weeksDone - 1 && latest.weeksDone === week + 1 &&
      !(prev.save.season?.games ?? []).some((g) => g.week === week && g.vs !== null);
    if (weekly) {
      const diff = (key: string, field: string) => (now.get(key)?.[field] ?? 0) - (then.get(key)?.[field] ?? 0);
      const off = new Map<string, { pts: number; parts: string[] }>();
      for (const key of now.keys()) {
        const cat = key.split('/')[1];
        const id = playerOfSlot(key);
        if (!id) continue;
        const pk = `${key.split('/')[0]}/${id}`;
        const e = off.get(pk) ?? { pts: 0, parts: [] };
        if (cat === 'passing' && diff(key, 'yds') > 0) { e.pts += diff(key, 'yds') / 20 + 4 * diff(key, 'td') - 2 * diff(key, 'int'); e.parts.push(`threw for ${diff(key, 'yds')} yards${diff(key, 'td') ? ` and ${diff(key, 'td')} ${diff(key, 'td') === 1 ? 'touchdown' : 'touchdowns'}` : ''}`); }
        if (cat === 'rushing' && diff(key, 'yds') > 0) { e.pts += diff(key, 'yds') / 10 + 6 * diff(key, 'td'); e.parts.push(`ran for ${diff(key, 'yds')} yards${diff(key, 'td') ? ` and ${diff(key, 'td')} ${diff(key, 'td') === 1 ? 'score' : 'scores'}` : ''}`); }
        if (cat === 'receiving' && diff(key, 'yds') > 0) { e.pts += diff(key, 'yds') / 10 + 6 * diff(key, 'td'); e.parts.push(`caught ${diff(key, 'rec')} ${diff(key, 'rec') === 1 ? 'pass' : 'passes'} for ${diff(key, 'yds')} yards${diff(key, 'td') ? ` and ${diff(key, 'td')} ${diff(key, 'td') === 1 ? 'touchdown' : 'touchdowns'}` : ''}`); }
        off.set(pk, e);
      }
      const gameOf = (team: number) => weekGames.find((g) => g.visitor === team || g.home === team);
      const result = (team: number) => {
        const g = gameOf(team);
        if (!g || g.vs === null || g.hs === null) return '';
        const us = g.visitor === team ? g.vs : g.hs, them = g.visitor === team ? g.hs : g.vs;
        const opp = g.visitor === team ? g.home! : g.visitor!;
        return us > them ? ` in the ${us}-${them} win over ${name(opp)}` : us < them ? ` in the ${them}-${us} loss to ${name(opp)}` : ` in the ${us}-${them} tie with ${name(opp)}`;
      };
      // A player's lines for the week (season totals now minus at the last import; "long" can't be split by week).
      const boxFor = (team: number, pid: number): NonNullable<Story['box']> => {
        const lines: NonNullable<Story['box']>['lines'] = [];
        for (const key of now.keys()) {
          if (Number(key.split('/')[0]) !== team || playerOfSlot(key) !== pid) continue;
          const cat = key.split('/')[1];
          const f = (x: string) => diff(key, x);
          if (cat === 'passing' && (f('att') > 0 || f('yds') !== 0 || f('td') > 0)) lines.push({ cat: 'Passing', cells: [['Comp', f('comp')], ['Att', f('att')], ['Yds', f('yds')], ['TD', f('td')], ['Int', f('int')]] });
          if (cat === 'rushing' && (f('att') > 0 || f('yds') !== 0 || f('td') > 0)) lines.push({ cat: 'Rushing', cells: [['Att', f('att')], ['Yds', f('yds')], ['Avg', f('att') > 0 ? (f('yds') / f('att')).toFixed(1) : '–'], ['TD', f('td')], ['Fum', f('fum')]] });
          if (cat === 'receiving' && (f('rec') > 0 || f('yds') !== 0 || f('td') > 0)) lines.push({ cat: 'Receiving', cells: [['Rec', f('rec')], ['Yds', f('yds')], ['Avg', f('rec') > 0 ? (f('yds') / f('rec')).toFixed(1) : '–'], ['TD', f('td')]] });
          if (cat === 'defense' && f('tkl') + f('sacks') + f('int') > 0) lines.push({ cat: 'Defense', cells: [['Tkl', f('tkl')], ['Sacks', f('sacks')], ['Int', f('int')]] });
        }
        const order = ['Passing', 'Rushing', 'Receiving', 'Defense'];
        lines.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
        return { result: result(team).replace(/^ in the /, '').replace(/^./, (c) => c.toUpperCase()), lines };
      };
      const best = [...off].filter(([, e]) => e.pts > 0).sort((a, b) => b[1].pts - a[1].pts)[0];
      if (best) {
        const [team, pid] = best[0].split('/').map(Number);
        const p = d.players[pid - 1];
        const id = `${year}-${week}-potw-${pid}`;
        const parts = best[1].parts;
        const line = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
        out.push({ id, kind: 'potw', week, weight: 48, teams: [team], player: pid, box: boxFor(team, pid),
          headline: pick(id, [`${playerName(p)} is the player of the week`, `${name(team)}'s ${playerName(p)} leads the way in ${wk}`, `Big day for ${name(team)}'s ${playerName(p)}`]),
          dek: `${playerLabel(p)} ${line}${result(team)}.` });
      }
      // The defensive player of the week: tackles + 3 per sack + 4 per interception.
      const def = [...now.keys()].filter((k) => k.split('/')[1] === 'defense')
        .map((k) => ({ k, tkl: diff(k, 'tkl'), sk: diff(k, 'sacks'), it: diff(k, 'int') }))
        .map((x) => ({ ...x, pts: x.tkl + 3 * x.sk + 4 * x.it }))
        .filter((x) => x.pts > 0 && playerOfSlot(x.k))
        .sort((a, b) => b.pts - a.pts)[0];
      if (def) {
        const team = Number(def.k.split('/')[0]);
        const p = d.players[playerOfSlot(def.k)! - 1];
        const bits = [def.tkl ? `${def.tkl} ${def.tkl === 1 ? 'tackle' : 'tackles'}` : '', def.sk ? `${def.sk} ${def.sk === 1 ? 'sack' : 'sacks'}` : '', def.it ? `${def.it} ${def.it === 1 ? 'interception' : 'interceptions'}` : ''].filter(Boolean);
        const id = `${year}-${week}-dpotw-${p.id}`;
        out.push({ id, kind: 'potw', week, weight: 42, teams: [team], player: p.id, box: boxFor(team, p.id),
          headline: pick(id, [`${playerName(p)} is the defensive player of the week`, `${name(team)}'s ${playerName(p)} wrecks the game in ${wk}`, `${playerName(p)} leads ${name(team)}'s defense`]),
          dek: `${playerLabel(p)} had ${bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]}${result(team)}.` });
      }
    }
  }

  // Stat leaders.
  const lines = playerLines(v);
  for (const [cat, key, what] of [['passing', 'yds', 'passing yards'], ['rushing', 'yds', 'rushing yards'], ['receiving', 'yds', 'receiving yards']] as const) {
    const top = leaders(lines, cat, key, 1)[0];
    if (!top) continue;
    const p = d.players.find((x) => x.id === top.player);
    out.push({
      id: `${year}-${week}-lead-${cat}`, kind: 'leader', week, weight: 25, teams: [top.team], player: p?.id, stat: { cat, key, label: what[0].toUpperCase() + what.slice(1) },
      headline: `${playerName(p)} leads the nation with ${statValue(top, key).toLocaleString('en-US')} ${what}`,
      dek: `${name(top.team)}'s ${p?.pos ?? ''} ${p ? `#${p.jersey}` : ''} after ${wk}.`.replace(/\s+/g, ' '),
    });
  }

  out.push(...hotSeatStories(d, v, week, wk));

  return out.sort((a, b) => b.weight - a.weight || b.week - a.week);
}

/**
 * Coaches on the hot seat during the regular season: a coach who can be fired after this season (his third
 * season or later at the school), whose seat was warm or worse last season, and who is two wins or more behind his
 * win goal's pace. At most three a week, the user's teams first.
 */
export function hotSeatStories(d: Dynasty, v: SeasonView, week: number, wk: string): Story[] {
  const si = d.seasons.indexOf(v.season);
  if (si < 1 || !d.coaches || !v.season.coach || week > v.lastRegularWeek || week < 3) return [];
  const R = v.lastRegularWeek + 1;
  const found: { team: number; behind: number; heat: number; story: Story }[] = [];
  v.season.coach.forEach((cid, team) => {
    const c = cid === null ? undefined : d.coaches![cid];
    if (!c || tenure(d, c, si) < 3) return;
    const heat = hotSeat(d, c, si - 1);
    if (heat === null || heat < 40) return;
    const goal = goalsFor(d, si, team).find((g) => g.kind === 'wins')?.n ?? 0;
    const rec = regularRecord(v, team);
    const played = rec.w + rec.l;
    if (played < 3) return;
    const behind = Math.round(goal * played / R - rec.w);
    if (behind < 2) return;
    const name = d.teams[team].school;
    const id = `${v.season.year}-${week}-hotseat-${cid}`;
    const mine = d.userTeams.includes(team);
    found.push({ team, behind, heat, story: {
      id, kind: mine ? 'yours' : 'race', week, weight: (mine ? 66 : 40) + Math.min(10, behind * 2) + (heat - 40) / 5, teams: [team],
      headline: pick(id, [`${c.name}'s seat gets hotter at ${name}`, `Pressure mounts on ${c.name} at ${name}`, `Is ${c.name}'s time at ${name} running out?`]),
      dek: `${name} is ${rec.w}-${rec.l} after ${wk}, behind the ${goal} wins ${name} expects this season.`,
    } });
  });
  return found.sort((a, b) => Number(d.userTeams.includes(b.team)) - Number(d.userTeams.includes(a.team)) || b.behind - a.behind || b.heat - a.heat).slice(0, 3).map((x) => x.story);
}

// ---- offseason stories (departures, transfers, signing day)

const STAR = (n: number) => `${n}-star`;

/** Stories from an offseason's events (the one in progress, or the one before a season). */
export function offseasonStories(d: Dynasty, events: OffseasonEvent[], year: number): Story[] {
  const out: Story[] = [];
  const name = (t: number) => d.teams[t].school;
  const pl = (id: number) => d.players[id - 1];
  const who = (id: number) => `${pl(id).pos} ${pl(id).first} ${pl(id).last}`;
  // Recruiting: the latest week's commitments and flips (user, 2026-11-12: "more stories … commitments").
  const rs = d.offseason?.year === year ? d.offseason.recruiting : undefined;
  if (rs && rs.week > 0) {
    const latest = rs.log.filter((e) => e.week === rs.week);
    const pros = new Map(rs.prospects.map((q) => [q.id, q]));
    const big = latest
      .map((e) => ({ e, q: pros.get(e.prospect)! }))
      .filter(({ e, q }) => q && (q.stars >= 4 || d.userTeams.includes(e.team) || (e.flipFrom !== undefined && d.userTeams.includes(e.flipFrom))))
      .sort((a, b) => b.q.stars - a.q.stars || b.q.player.ovr - a.q.player.ovr)
      .slice(0, 6);
    big.forEach(({ e, q }, i) => {
      const p = q.player;
      const mine = d.userTeams.includes(e.team);
      const lost = e.flipFrom !== undefined && d.userTeams.includes(e.flipFrom);
      const id = `${year}-commit-${rs.week}-${q.id}`;
      const what = `${q.from !== null ? 'transfer ' : ''}${q.stars ? STAR(q.stars) : ''} ${p.pos} ${p.first} ${p.last}`.replace(/\s+/g, ' ').trim();
      out.push({ id, kind: 'commit', week: 0, weight: 74 - i * 3 + (mine || lost ? 12 : 0), teams: e.flipFrom !== undefined ? [e.team, e.flipFrom] : [e.team],
        headline: e.flipFrom !== undefined ? `${what} flips from ${name(e.flipFrom)} to ${name(e.team)}` : pick(id, [`${what} commits to ${name(e.team)}`, `${name(e.team)} lands ${what}`]),
        dek: `${q.from !== null ? `He leaves ${name(q.from)} after the season.` : `From ${p.hometown}${p.state && p.state !== 'Non-US' ? `, ${p.state}` : ''}.`} Week ${rs.week} of recruiting.` });
    });
  }
  const classes = events.filter((e): e is Extract<OffseasonEvent, { kind: 'class' }> => e.kind === 'class').sort((a, b) => a.rank - b.rank);
  const signed = events.filter((e): e is Extract<OffseasonEvent, { kind: 'signed' }> => e.kind === 'signed');
  if (classes[0]) {
    const c = classes[0];
    const mine = signed.filter((s) => s.team === c.team);
    out.push({
      id: `${year}-class-1`, kind: 'champion', week: 0, weight: 90, teams: [c.team, ...(classes[1] ? [classes[1].team] : [])],
      headline: `${name(c.team)} signs the No. 1 class`,
      dek: `${c.signed} signees, ${mine.filter((s) => s.stars === 5).length} of them 5-star and ${mine.filter((s) => s.stars === 4).length} 4-star. ${classes[1] ? `${name(classes[1].team)} is second.` : ''}`.trim(),
    });
  }
  const top = signed.slice().sort((a, b) => b.stars - a.stars || b.ovr - a.ovr).slice(0, 3);
  top.forEach((s, i) => out.push({
    id: `${year}-recruit-${s.player}`, kind: 'leader', week: 0, weight: 70 - i * 5, teams: [s.team],
    headline: `${STAR(s.stars)} ${who(s.player)} signs with ${name(s.team)}`,
    dek: `From ${pl(s.player).hometown}${pl(s.player).state && pl(s.player).state !== 'Non-US' ? `, ${pl(s.player).state}` : ''}, one of the top recruits of the ${year + 1} class.`,
  }));
  const pros = events.filter((e): e is Extract<OffseasonEvent, { kind: 'graduated' | 'pro' | 'returns' }> => e.kind === 'pro').sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  pros.forEach((e, i) => out.push({
    id: `${year}-pro-${e.player}`, kind: 'upset', week: 0, weight: 66 - i * 5, teams: [e.team],
    headline: `${who(e.player)} leaves ${name(e.team)} for the pros`,
    dek: `${pl(e.player).first} ${pl(e.player).last} (${e.ovr} OVR) gives up his last ${pl(e.player).cls === 'JR' ? 'two seasons' : 'season'} of eligibility.`,
  }));
  const moves = events.filter((e): e is Extract<OffseasonEvent, { kind: 'transfer' }> => e.kind === 'transfer' && e.to !== null).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  moves.forEach((e, i) => out.push({
    id: `${year}-transfer-${e.player}`, kind: 'topgame', week: 0, weight: 62 - i * 5, teams: [e.to!, e.from],
    headline: `${who(e.player)} transfers from ${name(e.from)} to ${name(e.to!)}`,
    dek: `A ${e.ovr} OVR ${pl(e.player).pos} moves through the portal.`,
  }));
  const pres = events.filter((e): e is Extract<OffseasonEvent, { kind: 'prestige' }> => e.kind === 'prestige');
  for (const e of pres.filter((x) => x.to === 6 && x.from < 6)) out.push({
    id: `${year}-elite-${e.team}`, kind: 'number1', week: 0, weight: 64, teams: [e.team],
    headline: `${name(e.team)} joins the elite: 6-star prestige`,
    dek: `A No. ${e.finalRank} finish in ${year} lifts the program to the top tier.`,
  });
  for (const e of pres.filter((x) => d.userTeams.includes(x.team))) out.push({
    id: `${year}-yours-prestige-${e.team}`, kind: 'yours', week: 0, weight: 78, teams: [e.team],
    headline: `${name(e.team)} ${e.to > e.from ? 'rises' : 'drops'} to ${e.to}-star prestige`,
    dek: `${name(e.team)} finished No. ${e.finalRank} in ${year}${e.to > e.from ? ', and recruits will notice' : ''}.`,
  });
  // Coaches (carousel.ts): firings, hirings, retirements, and former players back as coaches.
  const coach = (id: number) => d.coaches?.[id];
  // Job offers to the coaches the user manages, while the carousel is open.
  const car = d.offseason?.year === year ? d.offseason.carousel : undefined;
  if (car && !car.done) {
    for (const [cid, schools] of Object.entries(car.offers)) {
      const c = coach(Number(cid));
      if (!c || !schools.length) continue;
      const list = schools.map(name);
      const id = `${year}-offers-${cid}`;
      out.push({
        id, kind: 'yours', week: 0, weight: 86, teams: c.team !== null ? [schools[0], c.team] : [schools[0]],
        headline: schools.length === 1 ? `${list[0]} wants ${c.name}` : pick(id, [`${c.name} draws interest from ${schools.length} schools`, `${schools.length} schools call ${c.name}`]),
        dek: `${schools.length === 1 ? `${list[0]} has` : `${list.slice(0, -1).join(', ')} and ${list.at(-1)} have`} offered ${c.name} their head coaching job${schools.length === 1 ? '' : 's'}${c.team !== null ? `. He can stay at ${name(c.team)}` : ''}.`,
      });
    }
  }
  const fired = events.filter((e): e is Extract<OffseasonEvent, { kind: 'coachFired' }> => e.kind === 'coachFired');
  fired.forEach((e, i) => { const c = coach(e.coach); if (c) out.push({
    id: `${year}-fired-${e.coach}`, kind: d.userTeams.includes(e.team) ? 'yours' : 'upset', week: 0, weight: (d.userTeams.includes(e.team) ? 84 : 68) - i * 2, teams: [e.team],
    headline: pick(`${year}-fired-${e.coach}`, [`${name(e.team)} fires ${c.name}`, `${c.name} is out at ${name(e.team)}`]),
    dek: `The hot seat reached ${e.heat}. ${name(e.team)} looks for a new head coach in the coaching carousel.`,
  }); });
  const hired = events.filter((e): e is Extract<OffseasonEvent, { kind: 'coachHired' }> => e.kind === 'coachHired');
  hired.forEach((e, i) => { const c = coach(e.coach); if (c) out.push({
    id: `${year}-hired-${e.coach}-${e.team}`, kind: d.userTeams.includes(e.team) || (e.from !== null && d.userTeams.includes(e.from)) ? 'yours' : 'topgame', week: 0,
    weight: (d.userTeams.includes(e.team) || (e.from !== null && d.userTeams.includes(e.from)) ? 82 : 60) - Math.min(10, i), teams: e.from !== null ? [e.team, e.from] : [e.team],
    headline: e.from !== null ? `${name(e.team)} hires ${c.name} away from ${name(e.from)}` : pick(`${year}-hired-${e.coach}`, [`${name(e.team)} hires ${c.name}`, `${c.name} takes over at ${name(e.team)}`]),
    dek: `${c.formerPlayer ? `The ${c.formerPlayer.drafted ? 'former NFL player' : 'former player'} gets his first head coaching job. ` : ''}${c.prestige}-star coach, ${Math.round((c.ratings.passing + c.ratings.running + c.ratings.defense + 1.25 * c.ratings.recruiting + 1.25 * c.ratings.development) / 5.5)} OVR.`,
  }); });
  const retired = events.filter((e): e is Extract<OffseasonEvent, { kind: 'coachRetired' }> => e.kind === 'coachRetired');
  retired.forEach((e, i) => { const c = coach(e.coach); if (c) out.push({
    id: `${year}-retired-${e.coach}`, kind: d.userTeams.includes(e.team) ? 'yours' : 'record', week: 0, weight: (d.userTeams.includes(e.team) ? 80 : 58) - i * 2, teams: [e.team],
    headline: `${c.name} retires from ${name(e.team)}`,
    dek: `He steps down at ${year + 1 - c.born}. ${name(e.team)} hires his successor in the coaching carousel.`,
  }); });
  for (const e of events.filter((x): x is Extract<OffseasonEvent, { kind: 'coachFormer' }> => x.kind === 'coachFormer')) {
    const c = coach(e.coach), p = pl(e.player);
    if (!c || !p) continue;
    const school = p.years?.at(-1)?.team;
    out.push({
      id: `${year}-former-${e.coach}`, kind: 'leader', week: 0, weight: 52, teams: school !== undefined ? [school] : [],
      headline: `Former ${school !== undefined ? `${name(school)} ` : ''}${p.pos} ${c.name} starts a coaching career`,
      dek: e.drafted ? 'After his years in the NFL he joins the pool of coaches.' : 'He joins the pool of coaches right out of school.',
    });
  }
  // The portal and NIL (user, 2026-11-22: headlines for them). Who entered the portal, while it's open.
  const st = d.offseason?.year === year ? d.offseason : undefined;
  if (st?.portal?.length && !events.some((e) => e.kind === 'class')) {
    st.portal.map(pl).filter((p) => p && p.team !== null).sort((a, b) => b.ovr - a.ovr).slice(0, 3).forEach((p, i) => out.push({
      id: `${year}-portal-${p.id}`, kind: d.userTeams.includes(p.team!) ? 'yours' : 'upset', week: 0, weight: (d.userTeams.includes(p.team!) ? 80 : 63) - i * 4, teams: [p.team!],
      headline: pick(`${year}-portal-${p.id}`, [`${name(p.team!)} ${p.pos} ${p.first} ${p.last} enters the transfer portal`, `${who(p.id)} hits the portal`]),
      dek: `A ${p.ovr} OVR ${p.cls} from ${name(p.team!)}. Recruiting decides where he lands.`,
    }));
  }
  // Up from FCS schools: the best two.
  events.filter((e): e is Extract<OffseasonEvent, { kind: 'fcs' }> => e.kind === 'fcs').sort((a, b) => b.ovr - a.ovr).slice(0, 2).forEach((e, i) => out.push({
    id: `${year}-fcs-${e.player}`, kind: d.userTeams.includes(e.to) ? 'yours' : 'leader', week: 0, weight: (d.userTeams.includes(e.to) ? 76 : 56) - i * 4, teams: [e.to],
    headline: `${who(e.player)} moves up from ${fcsLabel(e.school)} to ${name(e.to)}`,
    dek: `A ${e.ovr} OVR ${pl(e.player).cls} who starred at ${e.school}.`,
  }));
  const tclasses = events.filter((e): e is Extract<OffseasonEvent, { kind: 'transferClass' }> => e.kind === 'transferClass').sort((a, b) => a.rank - b.rank);
  if (tclasses[0]) out.push({
    id: `${year}-tclass-1`, kind: 'topgame', week: 0, weight: 67, teams: [tclasses[0].team],
    headline: `${name(tclasses[0].team)} lands the No. 1 transfer class`,
    dek: `${tclasses[0].signed} transfers.${tclasses[1] ? ` ${name(tclasses[1].team)} is second.` : ''}`,
  });
  if (hasNil(d)) {
    // The biggest new deal of the year.
    const deals = events.filter((e): e is Extract<OffseasonEvent, { kind: 'signed' | 'transfer' | 'fcs' }> => e.kind === 'signed' || e.kind === 'fcs' || (e.kind === 'transfer' && e.to !== null))
      .map((e) => ({ e, pay: pl(e.player)?.nil ?? 0 })).sort((a, b) => b.pay - a.pay);
    const top = deals[0];
    if (top && top.pay > 0) {
      const to = top.e.kind === 'signed' ? top.e.team : top.e.to!;
      out.push({
        id: `${year}-nil-top`, kind: 'record', week: 0, weight: 64, teams: [to],
        headline: `${top.e.kind === 'signed' ? `${STAR(top.e.stars)} ` : ''}${who(top.e.player)} gets the year's biggest NIL deal: ${money(top.pay)} at ${name(to)}`,
        dek: top.e.kind === 'signed' ? 'The richest deal of the signing class.' : `The richest deal of the transfer portal${top.e.kind === 'fcs' ? `, for a player up from ${fcsLabel(top.e.school)}` : ''}.`,
      });
    }
    // Big donors (nil.ts): a new one in the budgets for next season.
    const nil = st?.nil ?? (d.seasons.find((x) => x.year === year + 1)?.nil);
    nil?.donor?.forEach((left, t) => { if (left === NIL.donorSeasons) out.push({
      id: `${year}-donor-${t}`, kind: d.userTeams.includes(t) ? 'yours' : 'number1', week: 0, weight: d.userTeams.includes(t) ? 88 : 70, teams: [t],
      headline: pick(`${year}-donor-${t}`, [`A big donor backs ${name(t)}`, `${name(t)}'s new booster opens the checkbook`]),
      dek: `${name(t)}'s NIL budget jumps to ${money(nil.budget[t])} a year. Recruits and the portal will notice.`,
    }); });
  }
  for (const u of d.userTeams) {
    const c = classes.find((x) => x.team === u);
    const left = events.filter((e) => (e.kind === 'graduated' || e.kind === 'pro') && e.team === u).length;
    const back = events.filter((e) => e.kind === 'returns' && e.team === u).length;
    if (c) out.push({
      id: `${year}-yours-class-${u}`, kind: 'yours', week: 0, weight: 80, teams: [u],
      headline: `${name(u)} signs the No. ${c.rank} class`,
      dek: `${c.signed} signees for ${year + 1}. ${left} players left${back ? `, ${back} seniors are back for a fifth year` : ''}.`,
    });
    else if (left) out.push({
      id: `${year}-yours-left-${u}`, kind: 'yours', week: 0, weight: 80, teams: [u],
      headline: `${name(u)} loses ${left} players`,
      dek: `${back ? `${back} seniors come back for a fifth year. ` : ''}The transfer portal and signing day are next.`,
    });
  }
  return out.sort((a, b) => b.weight - a.weight);
}
