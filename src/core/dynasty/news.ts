// Stories for the Dynasty's news homepage, written from the season's results with templates.
// Pure functions: the same season gives the same stories.

import { leaders, playerLines, playerName, seasonView, statValue, weekName, type SeasonView } from './derive';
import type { Dynasty, OffseasonEvent } from './model';
import type { SaveGame } from './save';

export interface Story {
  id: string;
  headline: string;
  dek: string;
  /** Teams the story is about (the first one picks the art and colors). */
  teams: number[];
  week: number;
  /** Higher = more important (the top one leads). */
  weight: number;
  kind: 'champion' | 'upset' | 'topgame' | 'rout' | 'yours' | 'number1' | 'unbeaten' | 'leader' | 'cfp' | 'title';
}

const rk = (r: number) => (r >= 1 && r <= 25 ? `No. ${r} ` : '');

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
  // Ranks before the week: the game keeps last week's ranks until the next week's first result.
  const nextStarted = v.games.some((g) => g.week === week + 1 && g.vs !== null);
  const pre = nextStarted ? v.rank : s.lastRanks.map((r, t) => r || v.rank[t]);
  const wk = weekName(v, week);
  const post = week > v.lastRegularWeek;

  for (const g of weekGames as (SaveGame & { visitor: number; home: number; vs: number; hs: number })[]) {
    if (g.vs === g.hs) continue;
    const [w, l, ws, ls] = g.vs > g.hs ? [g.visitor, g.home, g.vs, g.hs] : [g.home, g.visitor, g.hs, g.vs];
    const rw = pre[w] <= 25 ? pre[w] : 0;
    const rl = pre[l] <= 25 ? pre[l] : 0;
    const where = w === g.home ? 'at home' : 'on the road';
    const id = `${year}-${week}-${g.index}`;
    if (v.champion === w && week === v.weeks - 1) {
      out.push({
        id: `${id}-champ`, kind: 'champion', week, weight: 100, teams: [w, l],
        headline: `${name(w)} wins the ${year} national championship`,
        dek: `${full(w)} beat ${name(l)} ${ws}-${ls} to finish ${v.records[w].w}-${v.records[w].l}.`,
      });
      continue;
    }
    if (post && week === v.lastRegularWeek + 1) {
      out.push({
        id: `${id}-title`, kind: 'title', week, weight: 45 + (25 - Math.min(25, rw || 25)), teams: [w, l],
        headline: `${name(w)} claims the ${v.season.confNames[v.season.conf[w]] ?? 'conference'} title`,
        dek: `${rk(rw)}${name(w)} beat ${rk(rl)}${name(l)} ${ws}-${ls} in the conference championship game.`,
      });
      continue;
    }
    if (rl && (!rw || rw > rl + 10)) {
      out.push({
        id: `${id}-upset`, kind: 'upset', week, weight: 60 + (26 - rl), teams: [w, l],
        headline: `${name(w)} stuns ${rk(rl)}${name(l)}, ${ws}-${ls}`,
        dek: `${full(w)} took down ${rk(rl)}${name(l)} ${where} in ${wk}.`,
      });
    } else if (rw && rl) {
      out.push({
        id: `${id}-top`, kind: 'topgame', week, weight: 50 + (52 - rw - rl) / 2, teams: [w, l],
        headline: `${rk(rw)}${name(w)} beats ${rk(rl)}${name(l)} ${ws}-${ls}`,
        dek: `A Top 25 matchup in ${wk} goes to ${name(w)} ${where}.`,
      });
    } else if (rw && ws - ls >= 35) {
      out.push({
        id: `${id}-rout`, kind: 'rout', week, weight: 30 + (26 - rw) / 2, teams: [w, l],
        headline: `${rk(rw)}${name(w)} routs ${name(l)} ${ws}-${ls}`,
        dek: `${full(w)} won by ${ws - ls} points in ${wk}.`,
      });
    }
    for (const u of d.userTeams) {
      if (u !== w && u !== l) continue;
      const won = u === w;
      out.push({
        id: `${id}-yours-${u}`, kind: 'yours', week, weight: 55, teams: [u, won ? l : w],
        headline: won ? `${name(u)} beats ${rk(rl)}${name(l)} ${ws}-${ls}` : `${name(u)} falls to ${rk(rw)}${name(w)} ${ws}-${ls}`,
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
  const unbeaten = v.records.filter((r) => r.l === 0 && r.w > 0);
  if (!post && week >= 3 && unbeaten.length > 0 && unbeaten.length <= 8) {
    const list = unbeaten.sort((a, b) => v.rank[a.team] - v.rank[b.team]);
    out.push({
      id: `${year}-${week}-unbeaten`, kind: 'unbeaten', week, weight: 35, teams: list.map((r) => r.team),
      headline: unbeaten.length === 1 ? `${name(list[0].team)} is the last unbeaten team` : `${unbeaten.length} unbeaten teams left`,
      dek: list.map((r) => `${name(r.team)} ${r.w}-0`).join(', ') + '.',
    });
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

  // Stat leaders.
  const lines = playerLines(v);
  for (const [cat, key, what] of [['passing', 'yds', 'passing yards'], ['rushing', 'yds', 'rushing yards'], ['receiving', 'yds', 'receiving yards']] as const) {
    const top = leaders(lines, cat, key, 1)[0];
    if (!top) continue;
    const p = d.players.find((x) => x.id === top.player);
    out.push({
      id: `${year}-${week}-lead-${cat}`, kind: 'leader', week, weight: 25, teams: [top.team],
      headline: `${playerName(p)} leads the nation with ${statValue(top, key).toLocaleString('en-US')} ${what}`,
      dek: `${name(top.team)}'s ${p?.pos ?? ''} ${p ? `#${p.jersey}` : ''} after ${wk}.`.replace(/\s+/g, ' '),
    });
  }

  return out.sort((a, b) => b.weight - a.weight || b.week - a.week);
}

// ---- offseason stories (departures, transfers, signing day)

const STAR = (n: number) => `${n}-star`;

/** Stories from an offseason's events (the one in progress, or the one before a season). */
export function offseasonStories(d: Dynasty, events: OffseasonEvent[], year: number): Story[] {
  const out: Story[] = [];
  const name = (t: number) => d.teams[t].school;
  const pl = (id: number) => d.players[id - 1];
  const who = (id: number) => `${pl(id).pos} ${pl(id).first} ${pl(id).last}`;
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
