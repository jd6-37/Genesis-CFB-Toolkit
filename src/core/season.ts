// Season tool: Bill Walsh '95's conferences and season schedules.
//
// How the game builds a season (found in the stock ROM; Elevated leaves all of it unchanged):
// - Four conferences. A team's conference is the word at +6 of its 4-word ratings group (team
//   block + header word [3]). Names: four length-prefixed 22-character strings from 0x0DF6E8.
// - The schedule is a template of 16 weeks × 18 games between 36 *slots* (0x0E0004, 36 bytes a
//   week, games as (visitor, home) pairs). Every slot plays every week.
// - When a season is set up, the deal at 0x071824 puts each team in a random empty slot of its
//   conference's range ({first slot, count} per conference at 0x0718DC), with the season's saved
//   random seed, so a saved season always gets the same deal again.
//
// What this tool writes:
// - Conference names (in place) and each team's conference word (in place).
// - The template (in place), relabeled so each conference's random slots are one range.
// - Locked teams: the deal loop body (0x07182A, 40 bytes, in place) reads a per-team
//   {first slot, count} byte table at 0x1EFF40 instead of the conference table. A locked team gets
//   {its slot, 1}; the others get their conference's random range. Only written when at least one
//   team is locked; otherwise the stock loop and the 0xFF padding there are restored. The
//   conference table keeps the random ranges either way (locked places come after them).
// - The one mention of a conference in the Walsh Report text, when it fits.

import { rl, rw, ww } from './bytes';
import { NAME_CHARS } from './defaults';

export const WEEKS = 16;
export const SLOTS = 36;
export const CONFERENCES = 4;
export const NAME_LEN = 22;

export const SEASON_AREAS = {
  template: 0x0e0004,
  dealTable: 0x0718dc,
  dealLoop: 0x07182a,
  lockTable: 0x1eff40,
  names: [0x0df6e8, 0x0df700, 0x0df718, 0x0df730], // length words; the list starts with "All Conferences" at 0x0DF6D0
  walshPtr: 0x078fc0,
  teamTable: 0x0028dc,
};
export const LOCK_TABLE_SIZE = 2 * SLOTS;

const RANDOM = 0x0704e2;
const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => parseInt(b, 16)));
const STOCK_LOOP = hex('2260d2e9000632290006e54143f9000718dc303110026100eca0d07110004a3200006aee15820000');
const LOCK_LOOP = (() => {
  const a = SEASON_AREAS.dealLoop;
  const t = SEASON_AREAS.lockTable;
  const bsrDisp = (RANDOM - (a + 0x12)) & 0xffff; // bsr.w at +0x10, PC = +0x12
  const w = (v: number) => [(v >> 8) & 0xff, v & 0xff];
  return Uint8Array.from([
    0x32, 0x02, // move.w d2,d1          team
    0xd2, 0x41, // add.w d1,d1           × 2
    0x43, 0xf9, ...w(t >>> 16), ...w(t), // lea LOCKS.l,a1
    0x70, 0x00, // moveq #0,d0           (+0x0A)
    0x10, 0x31, 0x10, 0x01, // move.b 1(a1,d1.w),d0   count
    0x61, 0x00, ...w(bsrDisp), // bsr.w $704E2   random 0..count-1
    0xd0, 0x31, 0x10, 0x00, // add.b (a1,d1.w),d0     + first slot
    0x4a, 0x32, 0x00, 0x00, // tst.b (a2,d0.w)        slot taken?
    0x6a, 0xec, // bpl.s +0x0A
    0x15, 0x82, 0x00, 0x00, // move.b d2,(a2,d0.w)
    0x4e, 0x71, 0x4e, 0x71, 0x4e, 0x71, // nop × 3; the stock dbra follows at 0x071852
  ]);
})();
if (LOCK_LOOP.length !== STOCK_LOOP.length) throw new Error('lock loop size');

const STOCK_NAMES = ['Southern Conference', 'Mid Western Conference', 'Far Western Conference', 'Eastern Conference'];

/** Everything the Season tool edits. Slots are the template's own numbering. */
export interface Season {
  names: string[];
  /** Conference (0-3) of each team. */
  conf: number[];
  /** The team locked into each slot, or null for a slot that's dealt at random. */
  slotTeam: (number | null)[];
  /** For random slots: the conference whose teams are dealt into it. */
  slotConf: number[];
  /** WEEKS × SLOTS slot numbers; each week is 18 (visitor, home) pairs. */
  weeks: number[][];
}

export type Opponent = { team: number } | { conf: number };
export interface Game {
  week: number;
  opponent: Opponent;
  home: boolean;
}

const same = (a: Uint8Array, at: number, b: Uint8Array) => b.every((v, i) => a[at + i] === v);

function groupWord(d: Uint8Array, team: number): number {
  const block = rl(d, SEASON_AREAS.teamTable + 4 * team);
  return block + rw(d, block + 6) + 6;
}

function readName(d: Uint8Array, at: number): string {
  if (rw(d, at) !== NAME_LEN + 2) throw new Error('The conference names in this ROM have been changed by another tool.');
  let s = '';
  for (let i = 0; i < NAME_LEN; i++) s += String.fromCharCode(d[at + 2 + i]);
  return s.trim();
}

/** The lock state of the deal loop: stock, ours (with the lock table), or something else. */
export function dealMode(d: Uint8Array): 'stock' | 'locks' | 'unknown' {
  if (same(d, SEASON_AREAS.dealLoop, STOCK_LOOP)) return 'stock';
  if (same(d, SEASON_AREAS.dealLoop, LOCK_LOOP)) return 'locks';
  return 'unknown';
}

/** Reads the season setup of a BW95 ROM. Throws with a readable message if anything is unexpected. */
export function readSeason(d: Uint8Array): Season {
  const names = SEASON_AREAS.names.map((a) => readName(d, a));
  const conf = Array.from({ length: SLOTS }, (_, t) => rw(d, groupWord(d, t)));
  if (conf.some((c) => c >= CONFERENCES)) throw new Error('A team has a conference number other than 0-3.');
  const weeks: number[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const row = Array.from(d.subarray(SEASON_AREAS.template + SLOTS * w, SEASON_AREAS.template + SLOTS * (w + 1)));
    if ([...row].sort((a, b) => a - b).some((v, i) => v !== i)) {
      throw new Error(`Week ${w + 1} of the schedule template isn't a full set of games.`);
    }
    weeks.push(row);
  }
  const slotTeam: (number | null)[] = new Array(SLOTS).fill(null);
  const slotConf: number[] = new Array(SLOTS).fill(-1);
  const mode = dealMode(d);
  if (mode === 'unknown') throw new Error("The season code in this ROM has been changed by another tool, so the Season tab can't edit it.");
  if (mode === 'stock') {
    for (let c = 0; c < CONFERENCES; c++) {
      const first = rw(d, SEASON_AREAS.dealTable + 4 * c);
      const count = rw(d, SEASON_AREAS.dealTable + 4 * c + 2);
      if (count !== conf.filter((x) => x === c).length) throw new Error(`Conference ${c + 1} has ${count} places but a different number of teams.`);
      for (let s = first; s < first + count; s++) {
        if (s >= SLOTS || slotConf[s] >= 0) throw new Error('The conference slot table is invalid.');
        slotConf[s] = c;
      }
    }
  } else {
    // The conference table isn't read by the game in this mode; it still holds each conference's random
    // range, which tells a conference's only random team ({slot, 1} in its range) from a locked team.
    const inRange = (c: number, k: number) => {
      const first = rw(d, SEASON_AREAS.dealTable + 4 * c);
      return k >= first && k < first + rw(d, SEASON_AREAS.dealTable + 4 * c + 2);
    };
    for (let t = 0; t < SLOTS; t++) {
      const first = d[SEASON_AREAS.lockTable + 2 * t];
      const count = d[SEASON_AREAS.lockTable + 2 * t + 1];
      if (count < 1 || first + count > SLOTS) throw new Error('The locked-team table is invalid.');
      if (count === 1 && !inRange(conf[t], first)) {
        if (slotConf[first] >= 0) throw new Error('Two teams are locked into the same place.');
        slotTeam[first] = t;
        slotConf[first] = conf[t];
      } else {
        for (let s = first; s < first + count; s++) {
          if (slotConf[s] >= 0 && (slotTeam[s] !== null || slotConf[s] !== conf[t])) throw new Error('The locked-team table is invalid.');
          slotConf[s] = conf[t];
        }
      }
    }
  }
  if (slotConf.some((c) => c < 0)) throw new Error('The conference slot table leaves places empty.');
  const season: Season = { names, conf, slotTeam, slotConf, weeks };
  const problem = seasonProblems(season)[0];
  if (problem) throw new Error(problem);
  return season;
}

/** What's wrong with a season setup (empty if it can be written). */
export function seasonProblems(s: Season): string[] {
  const out: string[] = [];
  for (let c = 0; c < CONFERENCES; c++) {
    const n = s.names[c];
    if (!n.trim()) out.push(`Conference ${c + 1} needs a name.`);
    if (n.length > NAME_LEN) out.push(`${n}: at most ${NAME_LEN} characters.`);
    if (!NAME_CHARS.test(n)) out.push(`${n}: only letters, digits, spaces and . , & ' - work in the game's font.`);
    const teams = s.conf.filter((x) => x === c).length;
    if (teams < 2) out.push(`${n || `Conference ${c + 1}`} needs at least 2 teams (each conference sends its best team to a bowl).`);
    const random = s.conf.filter((x, t) => x === c && slotOf(s, t) < 0).length;
    const places = s.slotConf.filter((x, k) => x === c && s.slotTeam[k] === null).length;
    if (random !== places) out.push(`${n}: ${random} random teams but ${places} random places (internal error).`);
  }
  const seen = new Set<number>();
  for (const t of s.slotTeam) {
    if (t === null) continue;
    if (seen.has(t)) out.push('A team is locked twice (internal error).');
    seen.add(t);
  }
  return out;
}

export const slotOf = (s: Season, team: number) => s.slotTeam.indexOf(team);
export const isLocked = (s: Season, team: number) => slotOf(s, team) >= 0;

const clone = (s: Season): Season => ({
  names: [...s.names],
  conf: [...s.conf],
  slotTeam: [...s.slotTeam],
  slotConf: [...s.slotConf],
  weeks: s.weeks.map((w) => [...w]),
});

/** The opponent in a slot: its locked team, or any team of the slot's conference. */
function opponentIn(s: Season, slot: number): Opponent {
  const t = s.slotTeam[slot];
  return t === null ? { conf: s.slotConf[slot] } : { team: t };
}

/** A locked team's 16 games. */
export function teamGames(s: Season, team: number): Game[] {
  const a = slotOf(s, team);
  if (a < 0) return [];
  return s.weeks.map((row, w) => {
    const i = row.indexOf(a);
    return { week: w, opponent: opponentIn(s, row[i ^ 1]), home: (i & 1) === 1 };
  });
}

/** Random places of a conference, in slot order. */
const poolSlots = (s: Season, c: number) =>
  s.slotTeam.map((t, k) => (t === null && s.slotConf[k] === c ? k : -1)).filter((k) => k >= 0);

export interface EditResult {
  season: Season;
  /** Other locked teams whose games changed, as readable lines. */
  alsoChanged: string[];
}

function lockInto(s: Season, team: number, slot: number) {
  s.slotTeam[slot] = team;
  s.slotConf[slot] = s.conf[team];
}

/** How many games locked teams play against a random place (they'd all become games against
 *  whichever team is locked into it). */
function facing(s: Season, slot: number): number {
  let n = 0;
  for (const row of s.weeks) if (s.slotTeam[row[row.indexOf(slot) ^ 1]] !== null) n++;
  return n;
}

/** The random place of a conference that locking a team into disturbs least (preferring `prefer`). */
function bestPlace(s: Season, c: number, prefer = -1): number {
  const pool = poolSlots(s, c);
  let best = pool[0];
  let score = Infinity;
  for (const k of pool) {
    const f = facing(s, k) - (k === prefer ? 0.5 : 0);
    if (f < score) [best, score] = [k, f];
  }
  return best;
}

/** Locks a team: it gets a fixed place, and its games are those of that place. */
export function lockTeam(s0: Season, team: number): Season {
  if (isLocked(s0, team)) return s0;
  const s = clone(s0);
  lockInto(s, team, bestPlace(s, s.conf[team]));
  return s;
}

export function unlockTeam(s0: Season, team: number): Season {
  const a = slotOf(s0, team);
  if (a < 0) return s0;
  const s = clone(s0);
  s.slotTeam[a] = null;
  s.slotConf[a] = s.conf[team];
  return s;
}

export function lockAll(s0: Season): Season {
  let s = s0;
  for (let t = 0; t < SLOTS; t++) s = lockTeam(s, t);
  return s;
}

export function unlockAll(s0: Season): Season {
  let s = s0;
  for (let t = 0; t < SLOTS; t++) s = unlockTeam(s, t);
  return s;
}

export function setConference(s0: Season, team: number, c: number): Season {
  const old = s0.conf[team];
  if (old === c) return s0;
  if (s0.conf.filter((x) => x === old).length <= 2) throw new Error(`${s0.names[old]} needs at least 2 teams.`);
  const s = clone(s0);
  s.conf[team] = c;
  const a = slotOf(s, team);
  if (a >= 0) s.slotConf[a] = c;
  else {
    const pool = poolSlots(s, old);
    s.slotConf[pool[pool.length - 1]] = c;
  }
  return s;
}

export function setName(s0: Season, c: number, name: string): Season {
  const s = clone(s0);
  s.names[c] = name;
  return s;
}

const describe = (s: Season, o: Opponent, teamNames: string[]) =>
  'team' in o ? teamNames[o.team] : `any ${s.names[o.conf]} team`;

/** Pairs slot a with slot b in week w. a keeps its home/visitor side; their old opponents play each other. */
function pair(s: Season, w: number, a: number, b: number) {
  const row = s.weeks[w];
  const ia = row.indexOf(a);
  const ib = row.indexOf(b);
  const pa = ia ^ 1;
  if (pa === ib) return;
  [row[pa], row[ib]] = [row[ib], row[pa]];
}

/** Lists the locked teams' games that differ between two setups, except the edit itself
 *  (week w of the teams in `edited`) and teams that weren't locked before. */
function changesIn(before: Season, after: Season, w: number, edited: number[], teamNames: string[]): string[] {
  const out: string[] = [];
  for (let t = 0; t < SLOTS; t++) {
    if (!isLocked(after, t) || !isLocked(before, t)) continue;
    const g0 = teamGames(before, t);
    const g1 = teamGames(after, t);
    for (let k = 0; k < WEEKS; k++) {
      if (k === w && edited.includes(t)) continue;
      if (JSON.stringify(g0[k]) === JSON.stringify(g1[k])) continue;
      out.push(
        `Week ${k + 1}: ${teamNames[t]} now ${g1[k].home ? 'hosts' : 'plays at'} ${describe(after, g1[k].opponent, teamNames)}` +
          ` (was ${g0[k].home ? 'home vs' : 'at'} ${describe(before, g0[k].opponent, teamNames)})`,
      );
    }
  }
  return out;
}

/**
 * Sets a locked (or to-be-locked) team's opponent in one week: a team, which gets locked too, or
 * any team of a conference. The two teams' old opponents that week play each other instead.
 */
export function setGame(s0: Season, team: number, w: number, opp: Opponent, teamNames: string[]): EditResult {
  let s = lockTeam(s0, team);
  const before = s;
  s = clone(s);
  const a = slotOf(s, team);
  const row = s.weeks[w];
  const cur = row[row.indexOf(a) ^ 1];
  const lockedFree = (k: number) => s.slotTeam[row[row.indexOf(k) ^ 1]] === null; // k's opponent is a random place
  if ('team' in opp) {
    const y = opp.team;
    if (y === team) throw new Error("A team can't play itself.");
    let b = slotOf(s, y);
    if (b < 0) {
      // The place that the fewest locked games face; the one the team already plays that week if it ties.
      b = bestPlace(s, s.conf[y], cur);
      lockInto(s, y, b);
    }
    pair(s, w, a, b);
    return { season: s, alsoChanged: changesIn(before, s, w, [team, y], teamNames) };
  }
  const c = opp.conf;
  if (s.slotTeam[cur] === null && s.slotConf[cur] === c) return { season: s, alsoChanged: [] };
  const pool = poolSlots(s, c);
  if (!pool.length) throw new Error(`Every ${s.names[c]} team is locked, so there's no random ${s.names[c]} team left.`);
  const p = pool.find(lockedFree) ?? pool[0];
  pair(s, w, a, p);
  return { season: s, alsoChanged: changesIn(before, s, w, [team], teamNames) };
}

/** Puts a locked team at home (or away) in one week; its opponent gets the other side. */
export function setHome(s0: Season, team: number, w: number, home: boolean): Season {
  const a = slotOf(s0, team);
  if (a < 0) return s0;
  const i = s0.weeks[w].indexOf(a);
  if (((i & 1) === 1) === home) return s0;
  const s = clone(s0);
  const row = s.weeks[w];
  [row[i], row[i ^ 1]] = [row[i ^ 1], row[i]];
  return s;
}

/** Conference games per locked team over the first n weeks (for the summary). */
export function conferenceGames(s: Season, team: number, n = WEEKS): number {
  return teamGames(s, team)
    .slice(0, n)
    .filter((g) => ('team' in g.opponent ? s.conf[g.opponent.team] : g.opponent.conf) === s.conf[team]).length;
}

function centered(name: string): string {
  const pad = NAME_LEN - name.length;
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + name + ' '.repeat(pad - left);
}

/** Renames conferences in the Walsh Report text (stock: one mention), when the new name fits. */
function renameInWalsh(d: Uint8Array, from: string[], to: string[]): string[] {
  const base = rl(d, SEASON_AREAS.walshPtr);
  if (base < 0x200 || base >= d.length) return [];
  const skipped: string[] = [];
  let a = base;
  for (let p = 0; p < 78 && a < d.length; p++) {
    let end = a;
    while (end < d.length && d[end] !== 0x0d) end++;
    let text = String.fromCharCode(...d.subarray(a, end));
    const len = text.length;
    for (let c = 0; c < CONFERENCES; c++) {
      if (from[c] === to[c] || !from[c]) continue;
      const re = new RegExp(`(?<![A-Za-z])${from[c].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'g');
      if (!re.test(text)) continue;
      const next = text.replace(re, to[c]).replace(/ +$/, '');
      if (next.length > len) {
        skipped.push(from[c]);
        continue;
      }
      text = next.padEnd(len, ' ');
    }
    for (let i = 0; i < len; i++) d[a + i] = text.charCodeAt(i);
    a = end + 1;
  }
  return skipped;
}

export interface WriteResult {
  locked: number;
  /** Walsh Report mentions that weren't renamed because the new name is longer. */
  walshSkipped: string[];
}

/** Checks that the ROM's season areas are as this tool expects before writing. */
export function seasonWriteProblems(d: Uint8Array, withLocks: boolean): string[] {
  const out: string[] = [];
  const mode = dealMode(d);
  if (mode === 'unknown') out.push('the season code at 0x07182A has been changed by another tool');
  if (withLocks && mode === 'stock' && d.subarray(SEASON_AREAS.lockTable, SEASON_AREAS.lockTable + LOCK_TABLE_SIZE).some((b) => b !== 0xff)) {
    out.push('0x1EFF40-0x1EFF87, which locked teams need, is already in use');
  }
  return out;
}

/** Writes a season setup into a BW95 ROM (checksums not included). */
export function writeSeason(d: Uint8Array, s: Season): WriteResult {
  const withLocks = s.slotTeam.some((t) => t !== null);
  const wasLocks = dealMode(d) === 'locks';
  const problems = [...seasonWriteProblems(d, withLocks), ...seasonProblems(s)];
  if (problems.length) throw new Error(`Can't write the season: ${problems.join('; ')}.`);
  const oldNames = SEASON_AREAS.names.map((a) => readName(d, a));

  // Relabel the slots: each conference's random places as one range (conference order), then locked places.
  const order: number[] = [];
  const first: number[] = [];
  const count: number[] = [];
  for (let c = 0; c < CONFERENCES; c++) {
    const pool = poolSlots(s, c);
    first.push(order.length);
    count.push(pool.length);
    order.push(...pool);
  }
  const locked = s.slotTeam.map((t, k) => (t === null ? -1 : k)).filter((k) => k >= 0);
  order.push(...locked);
  const index = new Array<number>(SLOTS);
  order.forEach((slot, i) => (index[slot] = i));

  for (let w = 0; w < WEEKS; w++) {
    for (let i = 0; i < SLOTS; i++) d[SEASON_AREAS.template + SLOTS * w + i] = index[s.weeks[w][i]];
  }
  for (let c = 0; c < CONFERENCES; c++) {
    ww(d, SEASON_AREAS.dealTable + 4 * c, first[c]);
    ww(d, SEASON_AREAS.dealTable + 4 * c + 2, count[c]);
  }
  if (locked.length) {
    d.set(LOCK_LOOP, SEASON_AREAS.dealLoop);
    for (let t = 0; t < SLOTS; t++) {
      const a = slotOf(s, t);
      const c = s.conf[t];
      d[SEASON_AREAS.lockTable + 2 * t] = a >= 0 ? index[a] : first[c];
      d[SEASON_AREAS.lockTable + 2 * t + 1] = a >= 0 ? 1 : count[c];
    }
  } else if (wasLocks) {
    // Nothing locked any more: the stock loop again, and the lock table back to free space.
    d.set(STOCK_LOOP, SEASON_AREAS.dealLoop);
    d.fill(0xff, SEASON_AREAS.lockTable, SEASON_AREAS.lockTable + LOCK_TABLE_SIZE);
  }
  for (let t = 0; t < SLOTS; t++) ww(d, groupWord(d, t), s.conf[t]);
  const walshSkipped = renameInWalsh(d, oldNames, s.names);
  s.names.forEach((n, c) => {
    const text = centered(n);
    for (let i = 0; i < NAME_LEN; i++) d[SEASON_AREAS.names[c] + 2 + i] = text.charCodeAt(i);
  });
  return { locked: locked.length, walshSkipped };
}

export const STOCK_CONFERENCE_NAMES = STOCK_NAMES;

/** Season file: the whole setup, so it can be put into another copy of the ROM (e.g. after a new
 *  Team Swap). Teams are stored by slot; `teams` is only for the record. */
export interface SeasonFile {
  app: 'genesis-cfb-toolkit';
  tool: 'season';
  version: 1;
  teams: string[];
  season: Season;
}

export function seasonFile(s: Season, teams: string[]): SeasonFile {
  return { app: 'genesis-cfb-toolkit', tool: 'season', version: 1, teams, season: s };
}

const isInt = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;

/** Reads a season file; throws with a readable message if it isn't one or doesn't hold together. */
export function seasonFromFile(x: unknown): { season: Season; teams: string[] } {
  const f = x as Partial<SeasonFile> | null;
  if (!f || f.app !== 'genesis-cfb-toolkit' || f.tool !== 'season') throw new Error('Not a season file from this app.');
  if (f.version !== 1) throw new Error(`Season file version ${String(f.version)} isn't supported by this version of the app.`);
  const s = f.season as Season | undefined;
  const ok =
    !!s &&
    Array.isArray(s.names) && s.names.length === CONFERENCES && s.names.every((n) => typeof n === 'string') &&
    Array.isArray(s.conf) && s.conf.length === SLOTS && s.conf.every((c) => isInt(c, 0, CONFERENCES - 1)) &&
    Array.isArray(s.slotTeam) && s.slotTeam.length === SLOTS && s.slotTeam.every((t) => t === null || isInt(t, 0, SLOTS - 1)) &&
    Array.isArray(s.slotConf) && s.slotConf.length === SLOTS && s.slotConf.every((c) => isInt(c, 0, CONFERENCES - 1)) &&
    Array.isArray(s.weeks) && s.weeks.length === WEEKS &&
    s.weeks.every((w) => Array.isArray(w) && w.length === SLOTS && [...w].sort((a, b) => a - b).every((v, i) => v === i));
  if (!ok) throw new Error('This season file is damaged.');
  const season = clone(s!);
  for (let k = 0; k < SLOTS; k++) {
    const t = season.slotTeam[k];
    if (t !== null) season.slotConf[k] = season.conf[t];
  }
  const problems = seasonProblems(season);
  if (problems.length) throw new Error(`This season file doesn't hold together: ${problems[0]}`);
  const teams = Array.isArray(f.teams) ? f.teams.map(String) : [];
  return { season, teams };
}
