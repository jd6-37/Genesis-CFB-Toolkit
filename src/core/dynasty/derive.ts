// Views of a dynasty season computed from its latest import: week names, results, standings,
// rankings, player stats, champions, and records across seasons. Pure functions.

import { ranksFromPower, type DynastySave, type SaveGame, type TeamSaveStats } from './save';
import { latestSave, type DPlayer, type DSeason, type Dynasty } from './model';

export const INDEPENDENT = 10;

/** A parsed season with everything the screens need. */
export interface SeasonView {
  season: DSeason;
  save: DynastySave | null;
  games: SaveGame[];
  weeks: number;
  lastRegularWeek: number;
  /** The first week with a game still to play (weeks if none). */
  currentWeek: number;
  rank: number[];
  order: number[];
  records: TeamRecord[];
  champion: number | null;
  done: boolean;
}

export interface TeamRecord {
  team: number;
  w: number;
  l: number;
  cw: number;
  cl: number;
  pf: number;
  pa: number;
  /** Current streak: positive = wins, negative = losses. */
  streak: number;
}

export function seasonView(d: Dynasty, season: DSeason): SeasonView {
  const save = latestSave(season);
  const s = save?.season ?? null;
  const games = s?.games ?? [];
  const weeks = s?.weeks ?? 0;
  const n = d.teams.length;
  const { order, rank } = s ? ranksFromPower(s.power) : { order: d.teams.map((t) => t.index), rank: d.teams.map(() => 0) };
  let currentWeek = weeks;
  for (const g of games) if (g.vs === null && g.week < currentWeek) currentWeek = g.week;
  const records: TeamRecord[] = Array.from({ length: n }, (_, team) => ({ team, w: 0, l: 0, cw: 0, cl: 0, pf: 0, pa: 0, streak: 0 }));
  for (const g of games) {
    if (g.vs === null || g.visitor === null || g.home === null || g.hs === null) continue;
    const v = records[g.visitor], h = records[g.home];
    v.pf += g.vs; v.pa += g.hs; h.pf += g.hs; h.pa += g.vs;
    if (g.vs === g.hs) continue;
    const [win, loss] = g.vs > g.hs ? [v, h] : [h, v];
    win.w++; loss.l++;
    win.streak = win.streak > 0 ? win.streak + 1 : 1;
    loss.streak = loss.streak < 0 ? loss.streak - 1 : -1;
    const regular = g.week <= (s?.lastRegularWeek ?? 99);
    const c = season.conf[win.team];
    if (regular && c !== INDEPENDENT && c === season.conf[loss.team]) { win.cw++; loss.cl++; }
  }
  const final = s?.postseason ? games.filter((g) => g.week === weeks - 1) : [];
  const champion = final.length === 1 && final[0].vs !== null && final[0].hs !== null
    ? (final[0].vs > final[0].hs ? final[0].visitor : final[0].home)
    : null;
  return {
    season, save, games, weeks, lastRegularWeek: s?.lastRegularWeek ?? 0, currentWeek, rank, order, records, champion,
    done: !!s && games.length > 0 && games.every((g) => g.vs !== null),
  };
}

/** The name of a week as the game shows it. */
export function weekName(v: SeasonView, week: number): string {
  const s = v.save?.season;
  if (!s) return `Week ${week + 1}`;
  if (week <= s.lastRegularWeek) return `Week ${s.realSchedule ? week : week + 1}`;
  const rounds = v.weeks - 1 - s.lastRegularWeek; // title games + playoff rounds
  const k = week - s.lastRegularWeek; // 1 = title games
  if (k === 1 && rounds >= 1) return 'Conference Championships';
  // Playoff rounds after the title games: 1 (BCS 2), 2 (CFP 4), 4 (CFP 12) or 5 (CFP 24).
  const names = [[], ['National Championship'], ['Semifinals', 'National Championship'], ['Quarterfinals', 'Semifinals', 'National Championship'],
    ['First Round', 'Quarterfinals', 'Semifinals', 'National Championship'],
    ['First Round', 'Second Round', 'Quarterfinals', 'Semifinals', 'National Championship']][rounds - 1] ?? [];
  return names[k - 2] ?? 'Postseason';
}

export const isPostseason = (v: SeasonView, week: number) => week > v.lastRegularWeek;

/** Teams of a conference ordered as the game's standings: conference record, then record, then rank. */
export function standings(v: SeasonView, conf: number): TeamRecord[] {
  return v.records
    .filter((r) => v.season.conf[r.team] === conf)
    .sort((a, b) => (b.cw - b.cl) - (a.cw - a.cl) || (b.w - b.l) - (a.w - a.l) || v.rank[a.team] - v.rank[b.team]);
}

// ---- player stats

export type StatCategory = keyof TeamSaveStats;
export interface PlayerLine<K extends StatCategory = StatCategory> {
  player: number | null;
  team: number;
  slot: number;
  cat: K;
  s: TeamSaveStats[K][number]['s'];
}

/** Every slot's stats of the season, with the dynasty player who had the slot. */
export function playerLines(v: SeasonView): PlayerLine[] {
  const out: PlayerLine[] = [];
  if (!v.save) return out;
  v.save.stats.forEach((ts, team) => {
    for (const cat of Object.keys(ts) as StatCategory[]) {
      for (const e of ts[cat]) out.push({ player: v.season.slots[team]?.[e.slot] ?? null, team, slot: e.slot, cat, s: e.s });
    }
  });
  return out;
}

/** Leaders of one stat (the lines of a category with that number, highest first). */
export function leaders(lines: PlayerLine[], cat: StatCategory, key: string, n = 10): PlayerLine[] {
  const val = (l: PlayerLine) => (l.s as unknown as Record<string, number>)[key] ?? 0;
  return lines.filter((l) => l.cat === cat && val(l) > 0).sort((a, b) => val(b) - val(a)).slice(0, n);
}

export const statValue = (l: PlayerLine, key: string) => (l.s as unknown as Record<string, number>)[key] ?? 0;

export const playerName = (p: DPlayer | undefined) => (p ? `${p.first} ${p.last}` : 'Unknown player');

// ---- across seasons

export interface ChampionEntry { year: number; team: number; record: TeamRecord }

export function champions(d: Dynasty): ChampionEntry[] {
  const out: ChampionEntry[] = [];
  for (const s of d.seasons) {
    const v = seasonView(d, s);
    if (v.champion !== null) out.push({ year: s.year, team: v.champion, record: v.records[v.champion] });
  }
  return out;
}

export interface RecordEntry { label: string; value: number; player: number | null; team: number; year: number }

/** Single-season records for the main stats, best first (all seasons). */
export const RECORD_STATS: { label: string; cat: StatCategory; key: string }[] = [
  { label: 'Passing yards', cat: 'passing', key: 'yds' },
  { label: 'Passing touchdowns', cat: 'passing', key: 'td' },
  { label: 'Rushing yards', cat: 'rushing', key: 'yds' },
  { label: 'Rushing touchdowns', cat: 'rushing', key: 'td' },
  { label: 'Receptions', cat: 'receiving', key: 'rec' },
  { label: 'Receiving yards', cat: 'receiving', key: 'yds' },
  { label: 'Receiving touchdowns', cat: 'receiving', key: 'td' },
  { label: 'Tackles', cat: 'defense', key: 'tkl' },
  { label: 'Sacks', cat: 'defense', key: 'sacks' },
  { label: 'Interceptions', cat: 'defense', key: 'int' },
  { label: 'Field goals', cat: 'kicking', key: 'fgm' },
];

/** The top single-season marks of a stat across the dynasty (optionally one school's). */
export function seasonRecords(d: Dynasty, stat: (typeof RECORD_STATS)[number], team?: number, n = 10): RecordEntry[] {
  const out: RecordEntry[] = [];
  for (const s of d.seasons) {
    const v = seasonView(d, s);
    for (const l of playerLines(v)) {
      if (l.cat !== stat.cat || (team !== undefined && l.team !== team)) continue;
      const value = statValue(l, stat.key);
      if (value > 0) out.push({ label: stat.label, value, player: l.player, team: l.team, year: s.year });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, n);
}

/** A school's seasons: record, final rank, title. */
export function teamHistory(d: Dynasty, team: number) {
  return d.seasons.map((s) => {
    const v = seasonView(d, s);
    return { year: s.year, record: v.records[team], rank: v.rank[team], champion: v.champion === team, imported: !!v.save };
  });
}
