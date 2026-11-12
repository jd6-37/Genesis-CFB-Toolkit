// The Dynasty: a multi-season record kept by the app (the app owns the players; the ROM and the save
// only show them). Creation from the user's 138-team ROM and the built-in College Football 27 ratings,
// and importing battery saves into seasons. Pure functions, no DOM. Spec: claude.ai project notes
// bw95-dynasty-spec.md (also Bill-Walsh-95-Modding/dynasty/).

import { openRosterRom } from '../rosterRom';
import { parseCsv, type Sheet } from '../rosterSheet';
import { readWideSeason, wideSeasonProblems } from '../seasonWide';
import { parseBw95 } from '../bw95';
import { teamsOf } from '../wide';
import type { Attr, Group } from '../rosterLayouts';
import { ratingProblems, readRating, type TeamRating } from '../teamRatings';
import { readDynastySave, type DynastySave } from './save';
import { startingPrestige } from './prestige';
import { buildRosters } from './rosters';
import { dynastyRomId, readStamp } from './dynastyArea';

export const DYNASTY_FILE = { app: 'genesis-cfb-toolkit', tool: 'dynasty', version: 1 } as const;

export const CLASSES = ['FR', 'SO', 'JR', 'SR', 'SR+'] as const;
export type ClassYear = (typeof CLASSES)[number];

export interface DTeam {
  /** The ROM's team number (index in the team table). */
  index: number;
  school: string;
  nickname: string;
  city: string;
  /** Home uniform colors from the ROM (Genesis color words): team color, helmet, jersey, pants. */
  colors: number[];
}

export interface DPlayer {
  id: number;
  first: string;
  last: string;
  pos: string;
  /** Current team (null once he has left). */
  team: number | null;
  cls: ClassYear;
  jersey: number;
  heightIn: number;
  weight: number;
  hometown: string;
  state: string;
  ovr: number;
  /** Values in the order of Dynasty.attrKeys (0-99). */
  attrs: number[];
  /** Skin tone 0-4, for the app's portraits only (the game uses one tone). */
  skin: number;
  status: 'active' | 'graduated' | 'pro' | 'transferred' | 'cut';
  /** The CFB 27 player ID for the starting players. */
  srcId?: number;
  /** Hidden ceiling of his OVR (CFB 27 scale), set at the first offseason or when he signs. */
  pot?: number;
  /** Signed in a dynasty signing class (stars 1-5; 0 = walk-on), and the year he signed. */
  recruit?: { stars: number; year: number };
  /** Year he left (graduated, went pro, transferred out, cut). */
  leftYear?: number;
  /** Moves through the transfer portal. */
  transfers?: { year: number; from: number; to: number | null }[];
  /** His last position change in the lineup editor: the season's year and the position he had. */
  posChange?: { year: number; from: string };
}

export interface SaveImport {
  /** ISO time of the import. */
  at: string;
  /** Games with a result in this save. */
  played: number;
  /** Completed weeks (every game with a result). */
  weeksDone: number;
  /** The save's data bytes (packed), base64. */
  data: string;
}

export interface DSeason {
  /** 0 = the first dynasty season. */
  index: number;
  year: number;
  /** Conference of each team this season (0-9, 10 Independents) and the conference names. */
  conf: number[];
  confNames: string[];
  /** Per team, the dynasty player in each of the 32 roster slots (null = nobody known). */
  slots: (number | null)[][];
  /** Per team and slot, the Bill Walsh '95 ratings the slot's player has in the game this season. */
  bw?: (BwSlot | null)[][];
  /** Per team and slot, the slot's backup on the bench and his ratings on the game's scale (not in the ROM). */
  bench?: (number | null)[][];
  benchBw?: (BwSlot | null)[][];
  /** Each team's prestige this season, 1-6 stars (prestige.ts). */
  prestige?: number[];
  /** Each team's offense and defense OVR in the ROM this season (what Game Setup shows). */
  teamOvr?: TeamRating[];
  /** Imports of this season's save, oldest first; one per number of completed weeks (the newest kept). */
  imports: SaveImport[];
  /** What happened in the offseason before this season (departures, transfers, signings …), for the news. */
  events?: OffseasonEvent[];
  /** A user changed a team's lineup after the ROM was last written (download it again). */
  lineupEdited?: boolean;
  /** Roster version in the season ROM's ID block: 1, then one more for each lineup change after a download. */
  rosterVersion?: number;
}

export type OffseasonEvent =
  | { kind: 'graduated' | 'pro' | 'returns'; player: number; team: number; ovr: number }
  | { kind: 'transfer'; player: number; from: number; to: number | null; ovr: number }
  | { kind: 'signed'; player: number; team: number; stars: number; ovr: number }
  | { kind: 'cut'; player: number; team: number; ovr: number }
  | { kind: 'walkon'; player: number; team: number; ovr: number }
  | { kind: 'class'; team: number; rank: number; signed: number; points: number }
  | { kind: 'prestige'; team: number; from: number; to: number; finalRank: number };

/** A roster slot's ratings in the game: 0-15 steps, in the roster screen's column order. */
export interface BwSlot {
  /** The slot's label on the game's roster screen (QB, HB1, LT, LDE …). */
  label: string;
  group: Group;
  attrs: Attr[];
  steps: number[];
  /** Pounds the ROM adds to the shown weight (the OL weight tweak). */
  weightPlus: number;
}

export interface Dynasty {
  app: typeof DYNASTY_FILE.app;
  tool: typeof DYNASTY_FILE.tool;
  version: number;
  id: string;
  name: string;
  created: string;
  startYear: number;
  userTeams: number[];
  teams: DTeam[];
  attrKeys: string[];
  players: DPlayer[];
  seasons: DSeason[];
  /** The offseason in progress (after the last season, before the next one). */
  offseason?: import('./offseason').OffseasonState;
}

// ---- small helpers

/** A seeded random generator (mulberry32), so creation is the same for the same inputs. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const CLASS_OF: Record<string, number> = { freshman: 0, sophomore: 1, junior: 2, senior: 3 };

/** CFB 27's class, one year up when redshirted (user's rule: RS FR → SO … RS SR → SR+). */
export function startingClass(cls: string, redshirt: string): ClassYear {
  const k = CLASS_OF[cls.trim().toLowerCase()] ?? 0;
  return CLASSES[Math.min(4, k + (/^redshirted$/i.test(redshirt.trim()) ? 1 : 0))];
}

// ---- creation

export interface CreateOptions {
  name: string;
  startYear?: number;
  userTeams?: number[];
  /** Seed for the parts that are random (skin tones); default from the time. */
  seed?: number;
  id?: string;
  created?: string;
}

/** A new dynasty from the user's 138-team ROM and the CFB 27 ratings CSV (the built-in Week 9 file). */
export function createDynasty(rom: Uint8Array, csvText: string, opt: CreateOptions): Dynasty {
  const roster = openRosterRom(rom);
  if (!roster.wide) throw new Error("A dynasty needs the 138-team 2026 Season Edition (Bill Walsh '95 Elevated v2.0.0 or later).");
  const p = wideSeasonProblems(rom);
  if (p.length) throw new Error(`This ROM's season settings can't be read: ${p.join('; ')}.`);
  const n = teamsOf(rom);
  const blocks = parseBw95(rom, n);
  const teams: DTeam[] = roster.teams.map((t, i) => ({
    index: i,
    school: t.school,
    nickname: t.nickname,
    city: t.other,
    colors: [blocks[i].home[3], blocks[i].home[5], blocks[i].home[11], blocks[i].home[14]],
  }));

  const sheet: Sheet = parseCsv(csvText);
  const H = (name: string) => {
    const k = sheet.headers.indexOf(name);
    if (k < 0) throw new Error(`The ratings file has no "${name}" column.`);
    return k;
  };
  const cFirst = H('First Name'), cLast = H('Last Name'), cPos = H('Position'), cJersey = H('Jersey Number');
  const cHeight = H('Height (in)'), cWeight = H('Weight'), cOvr = H('Overall'), cClass = H('Class'), cRs = H('Redshirt Status');
  const cTown = H('Hometown'), cState = H('Home State'), cId = H('EA Player ID');
  const first = H('Speed');
  const attrKeys = sheet.headers.slice(first);

  // The 32 in the game and the bench (one backup per slot), both from the Rosters tool's conversion;
  // the dynasty keeps only these players.
  const build = buildRosters(roster, sheet);
  const random = rng(opt.seed ?? Date.now());
  const teamOfRow = new Map<number, number>();
  build.slots.forEach((sl, t) => sl.forEach((row) => row !== null && teamOfRow.set(row, t)));
  build.bench.forEach((sl, t) => sl.forEach((row) => row !== null && teamOfRow.set(row, t)));
  const players: DPlayer[] = [];
  const idOfRow = new Map<number, number>();
  for (const row of [...teamOfRow.keys()].sort((x, y) => x - y)) {
    const r = sheet.rows[row];
    const id = players.length + 1;
    idOfRow.set(row, id);
    players.push({
      id,
      first: r[cFirst].trim(),
      last: r[cLast].trim(),
      pos: r[cPos].trim().replace(/^LEDG$/, 'LE').replace(/^REDG$/, 'RE'),
      team: teamOfRow.get(row)!,
      cls: startingClass(r[cClass], r[cRs]),
      jersey: Number(r[cJersey]) || 0,
      heightIn: Number(r[cHeight]) || 0,
      weight: Number(r[cWeight]) || 0,
      hometown: r[cTown].trim(),
      state: r[cState].trim(),
      ovr: Number(r[cOvr]) || 0,
      attrs: attrKeys.map((_, k) => Number(r[first + k]) || 0),
      skin: Math.floor(random() * 5),
      status: 'active',
      srcId: Number(r[cId]) || undefined,
    });
  }
  const ids = (grid: (number | null)[][]) => grid.map((sl) => sl.map((row) => (row === null ? null : idOfRow.get(row) ?? null)));
  const slots = ids(build.slots);
  const bench = ids(build.bench);
  const bw = build.bw;
  const benchBw = build.benchBw;

  const season = readWideSeason(rom);
  const teamOvr = ratingProblems(rom).length ? undefined : Array.from({ length: n }, (_, t) => readRating(rom, t));
  const startYear = opt.startYear ?? 2026;
  return {
    ...DYNASTY_FILE,
    id: opt.id ?? `d${Date.now().toString(36)}${Math.floor(random() * 1e6).toString(36)}`,
    name: opt.name.trim() || 'My Dynasty',
    created: opt.created ?? new Date().toISOString(),
    startYear,
    userTeams: opt.userTeams ?? [],
    teams,
    attrKeys,
    players,
    seasons: [{ index: 0, year: startYear, conf: season.conf, confNames: season.names, slots, bw, bench, benchBw, teamOvr, prestige: startingPrestige(teams.map((t) => t.school), teamOvr), imports: [] }],
  };
}

// ---- importing a save

export interface ImportResult {
  dynasty: Dynasty;
  season: DSeason;
  /** What changed, for a message. */
  played: number;
  newGames: number;
  /** Teams the save marks as the user's that the dynasty didn't have yet. */
  newUserTeams: number[];
  /** Something to tell the user about the save (an out-of-date ROM). */
  warning?: string;
}

const packed = (file: Uint8Array, save: DynastySave): Uint8Array => {
  if (save.format === 'packed') return file.slice();
  const out = new Uint8Array(file.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = file[2 * i + 1];
  return out;
};

const playedOf = (s: DynastySave) => s.season?.games.filter((g) => g.vs !== null).length ?? 0;

/** Weeks whose games all have results. */
export function weeksDone(s: DynastySave): number {
  if (!s.season) return 0;
  let w = 0;
  while (w < s.season.weeks && s.season.games.filter((g) => g.week === w).every((g) => g.vs !== null)) w++;
  return w;
}

/**
 * Adds a save to the dynasty's current season (a new dynasty object; the input is left as it is).
 * Refuses a save without a season, one whose teams or games don't fit, and one that is older than the
 * season's last import (fewer results), unless `allowOlder`.
 */
export function importSave(d: Dynasty, file: Uint8Array, opt: { at?: string; allowOlder?: boolean } = {}): ImportResult {
  const save = readDynastySave(file);
  if (!save.season) throw new Error('This save has no season yet: start a New Season in the game and play at least one week.');
  const season = d.seasons[d.seasons.length - 1];
  if (save.season.games.some((g) => (g.visitor !== null && g.visitor >= d.teams.length) || (g.home !== null && g.home >= d.teams.length))) {
    throw new Error("This save's games use teams this dynasty doesn't have.");
  }
  // A season started with a ROM the app wrote (Elevated v2.0.1 on) carries the dynasty's ID block.
  const stamp = readStamp(save.stamp);
  let warning: string | undefined;
  if (stamp) {
    if (stamp.dynasty !== dynastyRomId(d.id)) throw new Error("This save's season was started with a ROM of another dynasty.");
    if (stamp.season !== season.index + 1) {
      const year = d.seasons[stamp.season - 1]?.year;
      throw new Error(`This save's season was started with the ${year ?? 'another season\'s'} ROM, and the dynasty is in ${season.year}.${year !== undefined && year < season.year ? ` Start a New Season in the game with the ${season.year} ROM.` : ''}`);
    }
    if (stamp.rosterVersion !== (season.rosterVersion ?? 1)) {
      warning = `This season was started with an earlier ${season.year} ROM, from before your last lineup change: its stats are counted for the lineup the app has now.`;
    }
  }
  const played = playedOf(save);
  const last = season.imports[season.imports.length - 1];
  // A new season's first import: not the save of the season before (its results would all be there).
  const prevSeason = d.seasons[d.seasons.length - 2];
  const prevLast = prevSeason?.imports[prevSeason.imports.length - 1];
  if (!last && prevLast && !opt.allowOlder) {
    const prev = readDynastySave(fromBase64(prevLast.data));
    const same = prev.season && prev.season.games.length === save.season.games.length && prev.season.games.some((g) => g.vs !== null) &&
      prev.season.games.every((g, i) => g.vs === null || (g.vs === save.season!.games[i].vs && g.hs === save.season!.games[i].hs && g.visitor === save.season!.games[i].visitor));
    if (same) throw new Error(`This is the ${prevSeason.year} season's save. Start a New Season in the game with the ${season.year} ROM, play, then import.`);
  }
  if (last && !opt.allowOlder) {
    const prev = readDynastySave(fromBase64(last.data));
    if (played < last.played) {
      throw new Error(`This save has ${played} results, the last import of ${season.year} had ${last.played}. Is it an older save, or a new season? Start the next season in the app first.`);
    }
    // Same season: every game the last import had must still be there with the same teams.
    const same = prev.season && prev.season.games.length === save.season.games.length &&
      prev.season.games.every((g, i) => {
        const h = save.season!.games[i];
        return (g.visitor === null || g.visitor === h.visitor) && (g.home === null || g.home === h.home) && (g.vs === null || (g.vs === h.vs && g.hs === h.hs));
      });
    if (!same) throw new Error(`This save's season isn't the one imported for ${season.year} so far (its games differ).`);
  }
  const imp: SaveImport = { at: opt.at ?? new Date().toISOString(), played, weeksDone: weeksDone(save), data: toBase64(packed(file, save)) };
  const imports = season.imports.filter((i) => i.weeksDone !== imp.weeksDone);
  imports.push(imp);
  imports.sort((a, b) => a.played - b.played);
  const newSeason: DSeason = { ...season, imports };
  const newUserTeams = save.season.userTeams.filter((t) => !d.userTeams.includes(t));
  return {
    dynasty: { ...d, userTeams: [...d.userTeams, ...newUserTeams], seasons: [...d.seasons.slice(0, -1), newSeason] },
    season: newSeason,
    played,
    newGames: played - (last?.played ?? 0),
    newUserTeams,
    warning,
  };
}

/** The season's latest save, parsed (null before the first import). */
export function latestSave(season: DSeason): DynastySave | null {
  const last = season.imports[season.imports.length - 1];
  return last ? readDynastySave(fromBase64(last.data)) : null;
}

/** Checks a parsed dynasty file; returns the dynasty or throws. */
export function dynastyFromFile(json: unknown): Dynasty {
  const d = json as Dynasty;
  if (!d || d.app !== DYNASTY_FILE.app || d.tool !== DYNASTY_FILE.tool) throw new Error("This isn't a dynasty file of this app.");
  if (d.version > DYNASTY_FILE.version) throw new Error('This dynasty file was saved by a newer version of the app.');
  if (!Array.isArray(d.teams) || !Array.isArray(d.players) || !Array.isArray(d.seasons) || !d.seasons.length) {
    throw new Error('This dynasty file is damaged.');
  }
  return d;
}
