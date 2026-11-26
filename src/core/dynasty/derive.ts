// Views of a dynasty season computed from its latest import: week names, results, standings,
// rankings, player stats, champions, and records across seasons. Pure functions.

import { ranksFromPower, type DynastySave, type SaveGame, type TeamSaveStats } from './save';
import { latestSave, type DPlayer, type DSeason, type Dynasty } from './model';
import { editionOf } from './edition';
import { weeksOf } from './schedule';

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
  /** The 1994 Season Edition: bowls after the regular season, the No. 1 team in the final poll is the champion. */
  bowls: boolean;
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
  // Before the first import of a season with a dynasty schedule, its games (unplayed).
  const games: SaveGame[] = s?.games ?? (season.schedule?.games ?? []).map((g, index) => ({ index, week: g.week, visitor: g.visitor, home: g.home, vs: null, hs: null, hold: false }));
  const weeks = s?.weeks ?? (season.schedule ? weeksOf(season.schedule) : 0);
  const bowls = editionOf(d).postseason === 'bowls';
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
  const done = !!s && games.length > 0 && games.every((g) => g.vs !== null);
  // 1994: the final poll names the champion (there was no title game); 2026: the last game's winner.
  const champion = bowls
    ? (done ? order[0] ?? null : null)
    : final.length === 1 && final[0].vs !== null && final[0].hs !== null
      ? (final[0].vs > final[0].hs ? final[0].visitor : final[0].home)
      : null;
  return {
    season, save, games, weeks, lastRegularWeek: s?.lastRegularWeek ?? (season.schedule ? weeksOf(season.schedule) - 1 : 0), currentWeek, rank, order, records, champion,
    done, bowls,
  };
}

/** The name of a week as the game shows it. */
export function weekName(v: SeasonView, week: number): string {
  const s = v.save?.season;
  // Week 0 first, always (user, 2026-11-26: "Let's use week 0 everywhere"), as the real calendar and, from the ROM
  // lane's H-061 build, the game's every schedule.
  if (!s) return `Week ${week}`;
  if (week <= s.lastRegularWeek) return `Week ${week}`;
  // 1994: the bowl week last; before it (test31 on) the title game week: the ROM's name for it is "SEC Championship"
  // when the SEC's is the only title game (the default), else conference title games (test33's switches, H-011).
  if (v.bowls) {
    if (week !== s.lastRegularWeek + 1 || week >= v.weeks - 1) return 'Bowl Games';
    const on = (v.season.titleGames ?? [3]).map((f, c) => (c < INDEPENDENT && f & 1 ? c : -1)).filter((c) => c >= 0);
    return on.length === 1 && on[0] === 0 ? 'SEC Championship' : 'Conference Championships';
  }
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

/**
 * The 19 bowls of the 1994 season in the order the 1994 ROM lists the bowl week's games (its Week Schedule
 * rows; claude.ai project notes: bw95-1994-107-teams-rom-plan.md, bowls94.py).
 */
export const BOWLS_1994 = [
  'Rose Bowl', 'Orange Bowl', 'Sugar Bowl', 'Cotton Bowl', 'Fiesta Bowl', 'Florida Citrus Bowl', 'Holiday Bowl', 'Gator Bowl', 'Peach Bowl',
  'Sun Bowl', 'Hall of Fame Bowl', 'Freedom Bowl', 'Alamo Bowl', 'Copper Bowl', 'Aloha Bowl', 'Carquest Bowl', 'Liberty Bowl', 'Independence Bowl',
  'Las Vegas Bowl',
];

/** The 1994 bowl week (the season's last week, after the regular season), or -1. */
export const bowlWeek = (v: SeasonView) => (v.bowls && v.save?.season?.postseason && v.weeks - 1 > v.lastRegularWeek ? v.weeks - 1 : -1);

/** A 1994 bowl game's name (null for any other game, the SEC Championship Game included). */
export function bowlOf(v: SeasonView, g: SaveGame): string | null {
  if (g.week !== bowlWeek(v)) return null;
  const k = v.games.filter((x) => x.week === g.week).indexOf(g);
  return BOWLS_1994[k] ?? null;
}

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

/**
 * A player's name. A 1994 player the ROM has no name for (user, 2026-11-15: "keep names blank") goes by his
 * position and number until the user names him (Edit player).
 */
export const playerName = (p: Pick<DPlayer, 'first' | 'last' | 'pos' | 'jersey'> | undefined) =>
  (!p ? 'Unknown player' : p.first || p.last ? `${p.first} ${p.last}`.trim() : p.jersey >= 0 ? `${p.pos} #${p.jersey}` : `Unnamed ${p.pos}`);
/** "#23 HB Name", or "#23 HB" for a player without a name. */
export const playerLabel = (p: Pick<DPlayer, 'first' | 'last' | 'pos' | 'jersey'>) =>
  `${p.jersey >= 0 ? `#${p.jersey} ` : ''}${p.pos}${p.first || p.last ? ` ${p.first} ${p.last}`.trimEnd() : ''}`;

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
