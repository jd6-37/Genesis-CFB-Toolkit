// Stories for the Dynasty's news homepage, written from the season's results with templates.
// Pure functions: the same season gives the same stories.

import { leaders, playerLines, playerName, seasonView, statValue, weekName, type SeasonView } from './derive';
import { fromBase64, type Dynasty, type OffseasonEvent } from './model';
import { readDynastySave, type DynastySave, type SaveGame } from './save';

export interface Story {
  id: string;
  headline: string;
  dek: string;
  /** Teams the story is about (the first one picks the art and colors). */
  teams: number[];
  week: number;
  /** Higher = more important (the top one leads). */
  weight: number;
  kind: 'champion' | 'upset' | 'topgame' | 'rout' | 'yours' | 'number1' | 'unbeaten' | 'leader' | 'cfp' | 'title' | 'potw' | 'milestone' | 'streak';
  /** The player a story is about (stat leaders, milestones, players of the week): the headline links to him. */
  player?: number;
  /**
   * A player of the week's game (user, 2026-11-12: "I have no idea how Hubert 'wrecked' the game … open a
   * modal that shows that player's stats from that game"): the result and his stat lines for the week.
   */
  box?: { result: string; lines: { cat: string; cells: [string, number | string][] }[] };
}

const rk = (r: number) => (r >= 1 && r <= 25 ? `No. ${r} ` : '');

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
        headline: pick(id, [`${name(w)} stuns ${rk(rl)}${name(l)}, ${ws}-${ls}`, `Upset: ${name(w)} knocks off ${rk(rl)}${name(l)} ${ws}-${ls}`, `${rk(rl)}${name(l)} falls to ${name(w)}, ${ws}-${ls}`]),
        dek: pick(id + 'd', [`${full(w)} took down ${rk(rl)}${name(l)} ${where} in ${wk}.`, `${full(w)} (${v.records[w].w}-${v.records[w].l}) pulled the upset ${where} in ${wk}.`, `${name(l)} drops to ${v.records[l].w}-${v.records[l].l} after the loss ${w === g.home ? 'on the road' : 'at home'}.`]),
      });
    } else if (rw && rl) {
      out.push({
        id: `${id}-top`, kind: 'topgame', week, weight: 50 + (52 - rw - rl) / 2, teams: [w, l],
        headline: pick(id, [`${rk(rw)}${name(w)} beats ${rk(rl)}${name(l)} ${ws}-${ls}`, `${rk(rw)}${name(w)} holds off ${rk(rl)}${name(l)}, ${ws}-${ls}`, `${rk(rw)}${name(w)} wins the Top 25 clash with ${name(l)}, ${ws}-${ls}`]),
        dek: pick(id + 'd', [`A Top 25 matchup in ${wk} goes to ${name(w)} ${where}.`, `${name(w)} improves to ${v.records[w].w}-${v.records[w].l} with the win ${where}.`, `${name(l)} had no answer ${w === g.home ? 'on the road' : 'at home'} in ${wk}.`]),
      });
    } else if (rw && ws - ls >= 35) {
      out.push({
        id: `${id}-rout`, kind: 'rout', week, weight: 30 + (26 - rw) / 2, teams: [w, l],
        headline: pick(id, [`${rk(rw)}${name(w)} routs ${name(l)} ${ws}-${ls}`, `${rk(rw)}${name(w)} rolls past ${name(l)}, ${ws}-${ls}`, `${rk(rw)}${name(w)} blows out ${name(l)} ${ws}-${ls}`]),
        dek: pick(id + 'd', [`${full(w)} won by ${ws - ls} points in ${wk}.`, `A ${ws - ls}-point win ${where} for ${name(w)}.`, `${name(w)} never looked back in ${wk}.`]),
      });
    }
    for (const u of d.userTeams) {
      if (u !== w && u !== l) continue;
      const won = u === w;
      out.push({
        id: `${id}-yours-${u}`, kind: 'yours', week, weight: 55, teams: [u, won ? l : w],
        headline: won
          ? pick(id, [`${name(u)} beats ${rk(rl)}${name(l)} ${ws}-${ls}`, `${name(u)} takes care of ${rk(rl)}${name(l)}, ${ws}-${ls}`, `${name(u)} gets past ${rk(rl)}${name(l)} ${ws}-${ls}`])
          : pick(id, [`${name(u)} falls to ${rk(rw)}${name(w)} ${ws}-${ls}`, `${rk(rw)}${name(w)} beats ${name(u)} ${ws}-${ls}`, `${name(u)} comes up short against ${rk(rw)}${name(w)}, ${ws}-${ls}`]),
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
        id, kind: 'upset', week, weight: 40 + gap, teams: [w, l],
        headline: pick(id, [`${name(w)} shocks ${rk(pre[l])}${name(l)}, ${ws}-${ls}`, `Underdog ${name(w)} beats ${rk(pre[l])}${name(l)} ${ws}-${ls}`, `${name(w)} pulls off a stunner against ${rk(pre[l])}${name(l)}`]),
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
      out.push({ id: `${id}-perfect`, kind: 'streak', week, weight: 32 + rec.w, teams: [w],
        headline: pick(id, [`${name(w)} improves to ${rec.w}-0`, `${name(w)} stays perfect at ${rec.w}-0`, `Still unbeaten: ${name(w)} moves to ${rec.w}-0`]),
        dek: `${full(w)} beat ${name(l)} in ${wk}.` });
    }
    const lostBefore = before(rw, false);
    if (lostBefore >= 5) out.push({ id: `${id}-ended`, kind: 'streak', week, weight: 30 + lostBefore, teams: [w, l],
      headline: pick(id, [`${name(w)} snaps a ${lostBefore}-game losing streak`, `${name(w)} wins for the first time in ${lostBefore + 1} games`]),
      dek: `${name(w)} beat ${name(l)} in ${wk}.` });
    const wonBefore = before(rl, true);
    if (wonBefore >= 6) out.push({ id: `${id}-snapped`, kind: 'streak', week, weight: 34 + wonBefore, teams: [w, l],
      headline: pick(id, [`${name(w)} ends ${rk(pre[l])}${name(l)}'s ${wonBefore}-game winning streak`, `${rk(pre[l])}${name(l)}'s ${wonBefore}-game run ends at ${name(w)}`]),
      dek: `${name(l)} drops to ${v.records[l].w}-${v.records[l].l}.` });
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
        ms.push({ id, kind: 'milestone', week, weight: 28 + marks.indexOf(mark) * 4 + (d.userTeams.includes(team) ? 10 : 0), teams: [team], player: p.id,
          headline: pick(id, [`${playerName(p)} passes ${mark.toLocaleString('en-US')} ${what}`, `${mark.toLocaleString('en-US')} ${what} and counting for ${name(team)}'s ${playerName(p)}`, `${name(team)}'s ${playerName(p)} reaches ${mark.toLocaleString('en-US')} ${what}`]),
          dek: `#${p.jersey} ${p.pos} ${playerName(p)} has ${b.toLocaleString('en-US')} ${what} after ${wk}.` });
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
          dek: `#${p.jersey} ${p.pos} ${playerName(p)} ${line}${result(team)}.` });
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
          dek: `#${p.jersey} ${p.pos} ${playerName(p)} had ${bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]}${result(team)}.` });
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
      id: `${year}-${week}-lead-${cat}`, kind: 'leader', week, weight: 25, teams: [top.team], player: p?.id,
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
