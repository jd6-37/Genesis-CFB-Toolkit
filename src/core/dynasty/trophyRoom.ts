// The user's trophy room (user, 2026-11-27: "a user trophy room showing all awards, titles, bowls, etc. This should
// carry through dynasties, meaning I might play 10 seasons with Tulane, win a champ, remove them from my user
// controlled teams, and then control another team for a few years"). Everything a team won in the seasons the user
// controlled it (DSeason.userTeams), and the coach awards of the coaches the user managed (DSeason.userCoaches).
import { bowlOf, bowlWeek, INDEPENDENT, seasonView, standings, weekName, type SeasonView } from './derive';
import { userCoachesOf, userTeamsOf, type DSeason, type Dynasty } from './model';
import { HEISMAN, POSITION_AWARDS, COACH_AWARDS, seasonAwards } from './awards';
import { trophyOf } from './trophies';

export type TrophyKind = 'national' | 'conference' | 'postseason' | 'rivalry' | 'player' | 'coach';
export interface TrophyItem {
  kind: TrophyKind;
  year: number;
  team: number;
  title: string;
  note: string;
  /** The art key (public/media/trophies/<art>.png, or the user's picture). */
  art: string;
  player?: number;
  coach?: number | null;
}
export interface Stint { team: number; from: number; to: number; w: number; l: number; national: number; conference: number }
export interface TrophyRoom { stints: Stint[]; items: TrophyItem[] }

/** A conference's champion: its title game's winner, else (once the regular season is over) its standings leader. */
export function confChampion(v: SeasonView, conf: number): number | null {
  if (conf === INDEPENDENT) return null;
  const s = v.save?.season;
  if (!s) return null;
  const tw = s.lastRegularWeek + 1;
  if (!v.bowls || tw !== bowlWeek(v)) {
    const g = v.games.find((x) => x.week === tw && x.vs !== null && x.hs !== null && x.visitor !== null && x.home !== null
      && v.season.conf[x.visitor] === conf && v.season.conf[x.home] === conf);
    if (g) return g.vs! > g.hs! ? g.visitor : g.hs! > g.vs! ? g.home : null;
  }
  const regularDone = v.games.filter((g) => g.week <= s.lastRegularWeek).every((g) => g.vs !== null || g.visitor === null || g.home === null);
  return regularDone ? standings(v, conf)[0]?.team ?? null : null;
}

const won = (g: { vs: number | null; hs: number | null; visitor: number | null; home: number | null }, t: number) =>
  g.vs !== null && g.hs !== null && g.vs !== g.hs && ((g.visitor === t && g.vs > g.hs) || (g.home === t && g.hs > g.vs));

export function trophyRoom(d: Dynasty): TrophyRoom {
  const items: TrophyItem[] = [];
  const perSeason: { s: DSeason; v: SeasonView; users: number[] }[] = d.seasons.map((s) => ({ s, v: seasonView(d, s), users: userTeamsOf(d, s) }));
  for (const { s, v, users } of perSeason) {
    const year = s.year;
    const school = (t: number) => d.teams[t].school;
    for (const t of users) {
      const rec = v.records[t];
      if (v.done && v.champion === t) items.push({ kind: 'national', year, team: t, title: 'National champions', note: `${rec.w}-${rec.l}`, art: 'national' });
      const c = s.conf[t];
      if (confChampion(v, c) === t && (v.done || v.games.some((g) => g.week > (v.save?.season?.lastRegularWeek ?? 99) && g.vs !== null))) {
        items.push({ kind: 'conference', year, team: t, title: `${s.confNames[c]} champions`, note: `${rec.w}-${rec.l}`, art: 'conference' });
      }
      for (const g of v.games) {
        if (g.visitor === null || g.home === null || !won(g, t)) continue;
        const opp = g.visitor === t ? g.home : g.visitor;
        const score = `${Math.max(g.vs!, g.hs!)}-${Math.min(g.vs!, g.hs!)}`;
        // Bowls (1994) and playoff wins short of the title game (the title is its own trophy).
        const bowl = v.bowls ? bowlOf(v, g) : null;
        const lastWeek = Math.max(...v.games.map((x) => x.week));
        if (bowl) items.push({ kind: 'postseason', year, team: t, title: bowl, note: `beat ${school(opp)} ${score}`, art: 'bowl' });
        else if (!v.bowls && g.week > (v.save?.season?.lastRegularWeek ?? 99) + 1 && g.week < lastWeek) {
          items.push({ kind: 'postseason', year, team: t, title: `Playoff ${weekName(v, g.week).toLowerCase().replace(/s$/, '')} win`, note: `beat ${school(opp)} ${score}`, art: 'playoff' });
        }
        const tr = trophyOf(school(t), school(opp));
        if (tr && (tr.since === null || tr.since <= year)) items.push({ kind: 'rivalry', year, team: t, title: tr.trophy, note: `beat ${school(opp)} ${score}`, art: tr.art });
      }
    }
    const aw = seasonAwards(d, s);
    if (!aw) continue;
    const h = aw.heisman[0];
    if (h && users.includes(h.team)) items.push({ kind: 'player', year, team: h.team, title: HEISMAN.name, note: '', art: HEISMAN.art, player: h.player });
    for (const p of aw.position) {
      if (!p.winner || !users.includes(p.winner.team)) continue;
      items.push({ kind: 'player', year, team: p.winner.team, title: p.label, note: '', art: POSITION_AWARDS.find((x) => x.key === p.key)?.art ?? 'poy', player: p.winner.player });
    }
    const mine = userCoachesOf(d, s);
    for (const c of aw.coach) {
      if (c.team < 0 || !(users.includes(c.team) || (c.coach !== null && mine.includes(c.coach)))) continue;
      const r = v.records[c.team];
      items.push({ kind: 'coach', year, team: c.team, title: c.label, note: `${r.w}-${r.l} at ${school(c.team)}`, art: COACH_AWARDS.find((x) => x.key === c.key)!.art, coach: c.coach });
    }
  }
  // Stints: the runs of seasons each team was the user's.
  const stints: Stint[] = [];
  const teams = [...new Set(perSeason.flatMap((x) => x.users))];
  for (const t of teams) {
    let cur: Stint | null = null;
    for (const { s, v, users } of perSeason) {
      if (!users.includes(t)) { if (cur) { stints.push(cur); cur = null; } continue; }
      cur ??= { team: t, from: s.year, to: s.year, w: 0, l: 0, national: 0, conference: 0 };
      cur.to = s.year;
      cur.w += v.records[t].w; cur.l += v.records[t].l;
    }
    if (cur) stints.push(cur);
  }
  for (const st of stints) {
    const mine = items.filter((i) => i.team === st.team && i.year >= st.from && i.year <= st.to);
    st.national = mine.filter((i) => i.kind === 'national').length;
    st.conference = mine.filter((i) => i.kind === 'conference').length;
  }
  stints.sort((a, b) => a.from - b.from || a.team - b.team);
  items.sort((a, b) => a.year - b.year);
  return { stints, items };
}
