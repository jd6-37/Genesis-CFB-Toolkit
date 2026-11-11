// The Dynasty: a multi-season record kept by the app (the app owns the players; the ROM and the save
// only show them). Creation from the user's 138-team ROM and the built-in College Football 27 ratings,
// and importing battery saves into seasons. Pure functions, no DOM. Spec: claude.ai project notes
// bw95-dynasty-spec.md (also Bill-Walsh-95-Modding/dynasty/).

import { openRosterRom } from '../rosterRom';
import { parseCsv, type Sheet } from '../rosterSheet';
import { convertCfb27 } from '../rosterCfb27';
import { readWideSeason, wideSeasonProblems } from '../seasonWide';
import { parseBw95 } from '../bw95';
import { teamsOf } from '../wide';
import { readDynastySave, type DynastySave } from './save';

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
  /** Imports of this season's save, oldest first; one per number of completed weeks (the newest kept). */
  imports: SaveImport[];
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
  const cTeam = H('Team'), cFirst = H('First Name'), cLast = H('Last Name'), cPos = H('Position'), cJersey = H('Jersey Number');
  const cHeight = H('Height (in)'), cWeight = H('Weight'), cOvr = H('Overall'), cClass = H('Class'), cRs = H('Redshirt Status');
  const cTown = H('Hometown'), cState = H('Home State'), cId = H('EA Player ID');
  const first = H('Speed');
  const attrKeys = sheet.headers.slice(first);

  // Which ROM team each sheet team is (the roster conversion's own matching), and the season's slots.
  const plan = convertCfb27(roster, sheet);
  const teamOfSheet = new Map(plan.teams.map((t) => [t.sheetTeam, t.team]));
  const random = rng(opt.seed ?? Date.now());
  const players: DPlayer[] = [];
  const idOfRow = new Map<number, number>();
  sheet.rows.forEach((r, row) => {
    const team = teamOfSheet.get(r[cTeam]);
    if (team === undefined) return;
    const id = players.length + 1;
    idOfRow.set(row, id);
    players.push({
      id,
      first: r[cFirst].trim(),
      last: r[cLast].trim(),
      pos: r[cPos].trim().replace(/^LEDG$/, 'LE').replace(/^REDG$/, 'RE'),
      team,
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
  });
  const slots: (number | null)[][] = Array.from({ length: n }, () => new Array<number | null>(32).fill(null));
  for (const t of plan.teams) for (const f of t.fills) slots[t.team][f.slot] = idOfRow.get(f.player.row) ?? null;

  const season = readWideSeason(rom);
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
    seasons: [{ index: 0, year: startYear, conf: season.conf, confNames: season.names, slots, imports: [] }],
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
  const played = playedOf(save);
  const last = season.imports[season.imports.length - 1];
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
