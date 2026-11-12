// Roster editing (user, 2026-11-12: "full capabilities like we have in the mod toolkit"): any player of any
// team, his details and his Bill Walsh '95 ratings as the numbers the game shows (0-100), moving him to
// another team or releasing him, adding players, and the same through a CSV (export, edit in a
// spreadsheet, import with a preview). Only in the offseason and before a season's first results are
// imported (the game's stats belong to the slots). In the preseason the season's lineups and ratings
// follow at once (download the ROM again); in the offseason the depth charts come at its end.

import { parseCsv, toCsv } from '../rosterSheet';
import type { Attr } from '../rosterLayouts';
import { CLASSES, type ClassYear, type DPlayer, type DSeason, type Dynasty } from './model';
import { starterOvr } from '../teamRatings';
import { playerOvr } from './ovr';
import { bwSlotOf, ovrOf, RATINGS, type Ratings } from './ratings';
import { olPlusOf, teamDepth } from './depth';
import { SLOT_DEFS } from './lineup';
import { blackShare, nameScore } from './appearance';
import { POSITIONS } from './offseason';
import { recordYear } from './career';

const DEFS_SLOTS = 32;
const logit = (p: number) => Math.log(p / (1 - p));
/** A skin tone for a player added by hand: his name and position decide (appearance.ts), the shade from his ID. */
export function newSkin(p: Pick<DPlayer, 'first' | 'last' | 'pos' | 'id'>): number {
  const black = nameScore(p.first, p.last) + logit(Math.min(0.99, Math.max(0.01, blackShare(p.pos)))) > 0;
  return (black ? 2 : 0) + ((p.first.length + p.last.length) % 2);
}

/** Why players can't be edited now, or null when they can. */
export function editLock(d: Dynasty): string | null {
  if (d.offseason) return null;
  const s = d.seasons[d.seasons.length - 1];
  if (s.imports.some((i) => i.played > 0)) return 'Players can be edited in the offseason and before a season\'s first results are imported (the game\'s stats belong to the slots).';
  return null;
}

/** A change to one player; team null releases him. */
export interface PlayerEdit {
  first?: string; last?: string; pos?: string; cls?: ClassYear; jersey?: number; heightIn?: number; weight?: number;
  hometown?: string; state?: string; pot?: number; team?: number | null; ratings?: Ratings;
}

/** Problems with an edit (empty when it can be used). */
export function editProblems(d: Dynasty, p: DPlayer | null, e: PlayerEdit): string[] {
  const out: string[] = [];
  const name = p ? `${p.first} ${p.last}` : `${e.first ?? ''} ${e.last ?? ''}`.trim() || 'New player';
  if (e.first !== undefined && !e.first.trim()) out.push(`${name}: a first name is needed.`);
  if (e.last !== undefined && !e.last.trim()) out.push(`${name}: a last name is needed.`);
  if (e.pos !== undefined && !POSITIONS.includes(e.pos)) out.push(`${name}: "${e.pos}" isn't a position (${POSITIONS.join(', ')}).`);
  if (e.cls !== undefined && !CLASSES.includes(e.cls)) out.push(`${name}: "${e.cls}" isn't a class (${CLASSES.join(', ')}).`);
  if (e.jersey !== undefined && !(Number.isInteger(e.jersey) && e.jersey >= 0 && e.jersey <= 99)) out.push(`${name}: the number must be 0-99.`);
  if (e.team !== undefined && e.team !== null && !d.teams[e.team]) out.push(`${name}: no such team.`);
  for (const [a, v] of Object.entries(e.ratings ?? {}) as [Attr, number][]) {
    if (!Number.isFinite(v)) out.push(`${name}: ${a} must be a number.`);
    else if (a === 'Weight' ? v < 140 || v > 380 : v < 0 || v > 100) out.push(`${name}: ${a} must be ${a === 'Weight' ? '140-380 lb' : '0-100'}.`);
  }
  if (e.pot !== undefined && !(e.pot >= 0 && e.pot <= 99)) out.push(`${name}: potential must be 0-99.`);
  return out;
}

const changed = (p: DPlayer, e: PlayerEdit) => Object.keys(e).length > 0 && (Object.entries(e) as [keyof PlayerEdit, unknown][])
  .some(([k, v]) => (k === 'ratings' ? Object.entries(v as Ratings).some(([a, x]) => p.ratings[a as Attr] !== x) : (p as unknown as Record<string, unknown>)[k] !== v));

/**
 * Applies edits (by player ID) and new players. In the preseason the season follows: the lineups of
 * teams whose players came or went are set again (depth.ts), the others keep their lineups with the new
 * ratings; team OVRs move by the starters' change; the ROM needs downloading again.
 */
export function applyEdits(d: Dynasty, edits: Map<number, PlayerEdit>, adds: DPlayer[] = []): Dynasty {
  const lock = editLock(d);
  if (lock) throw new Error(lock);
  const problems = [...edits].flatMap(([id, e]) => editProblems(d, d.players[id - 1] ?? null, e));
  if (problems.length) throw new Error(problems.join(' '));
  const year = d.seasons[d.seasons.length - 1].year;
  const touched = new Set<number>(); // teams whose ratings changed
  const moved = new Set<number>(); // teams whose players came or went
  const players = d.players.map((p) => {
    const e = edits.get(p.id);
    if (!e || !changed(p, e)) return p;
    if (p.team !== null) touched.add(p.team);
    const { team, ratings, ...rest } = e;
    let q: DPlayer = { ...p, ...rest, ratings: { ...p.ratings, ...ratings } };
    if (team !== undefined && team !== p.team) {
      if (p.team !== null) moved.add(p.team);
      if (team === null) q = { ...q, team: null, status: 'cut', leftYear: year };
      else { q = { ...q, team, status: 'active' }; moved.add(team); }
    }
    return { ...q, ovr: ovrOf(q) };
  });
  let nextId = players.reduce((a, p) => Math.max(a, p.id), 0) + 1;
  for (const a of adds) {
    const p = { ...a, id: nextId++ };
    players.push({ ...p, ovr: ovrOf(p) });
    if (p.team !== null) moved.add(p.team);
  }
  const next: Dynasty = { ...d, players };
  if (d.offseason || (!touched.size && !moved.size)) return next;
  const s = d.seasons[d.seasons.length - 1];
  return { ...next, players: recordYear(players, s.year), seasons: [...d.seasons.slice(0, -1), followSeason(next, s, touched, moved)] };
}

/** The preseason's lineups and ratings after edits (see applyEdits). */
function followSeason(d: Dynasty, s: DSeason, touched: Set<number>, moved: Set<number>): DSeason {
  const olPlus = olPlusOf(s);
  const slots = s.slots.slice(), bench = (s.bench ?? []).slice(), bw = (s.bw ?? []).slice(), benchBw = (s.benchBw ?? []).slice();
  let teamOvr = s.teamOvr?.slice();
  const ovrOfTeam = (sl: (number | null)[], rated: (ReturnType<typeof bwSlotOf> | null)[]) =>
    starterOvr(sl.flatMap((id, slot) => (id && rated[slot] ? [{ pos: d.players[id - 1].pos, ovr: playerOvr(slot, rated[slot]!) }] : [])));
  for (const t of new Set([...touched, ...moved])) {
    const before = ovrOfTeam(s.slots[t], s.bw?.[t] ?? []);
    if (moved.has(t)) {
      const depth = teamDepth(d.players.filter((p) => p.team === t && p.status === 'active'));
      slots[t] = depth.slots;
      bench[t] = depth.bench;
    }
    const rate = (grid: (number | null)[]) => Array.from({ length: DEFS_SLOTS }, (_, slot) => {
      const id = grid[slot], def = SLOT_DEFS.find((x) => x.slot === slot);
      return id && def ? bwSlotOf(d.players[id - 1], def, olPlus) : null;
    });
    bw[t] = rate(slots[t]);
    benchBw[t] = rate(bench[t] ?? []);
    if (teamOvr) {
      const after = ovrOfTeam(slots[t], bw[t]);
      const clamp = (n: number) => Math.max(0, Math.min(99, n));
      teamOvr[t] = { off: clamp(teamOvr[t].off + after.off - before.off), def: clamp(teamOvr[t].def + after.def - before.def) };
    }
  }
  return { ...s, slots, bench, bw, benchBw, teamOvr, lineupEdited: true, rosterVersion: s.lineupEdited ? s.rosterVersion ?? 1 : (s.rosterVersion ?? 1) + 1 };
}

// ---- CSV

const RATING_COLS = RATINGS.map((a) => (a === 'Weight' ? 'Game Weight' : a));
export const CSV_HEADERS = ['ID', 'Team', 'First Name', 'Last Name', 'Position', 'Class', 'Jersey', 'Height (in)', 'Weight (lb)', 'Hometown', 'Home State', 'OVR', 'Potential', ...RATING_COLS];

/** Every active player (or one team's) as a CSV: the ratings as the game shows them (0-100), Game Weight in pounds. */
export function playersCsv(d: Dynasty, team?: number): string {
  const rows = d.players
    .filter((p) => p.status === 'active' && p.team !== null && (team === undefined || p.team === team))
    .sort((a, b) => a.team! - b.team! || POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos) || b.ovr - a.ovr)
    .map((p) => [p.id, d.teams[p.team!].school, p.first, p.last, p.pos, p.cls, p.jersey, p.heightIn, p.weight, p.hometown, p.state, p.ovr, p.pot ?? '',
      ...RATINGS.map((a) => (p.ratings[a] === undefined ? '' : Math.round(p.ratings[a]! * 10) / 10))]);
  return toCsv(CSV_HEADERS, rows);
}

export interface CsvImport {
  edits: Map<number, PlayerEdit>;
  adds: DPlayer[];
  /** What would change, one line per player. */
  changes: string[];
  problems: string[];
}

/**
 * Reads an edited players CSV: rows with a dynasty ID change that player (only the columns given and
 * different), rows without one add a player, players of the dynasty missing from the file stay as they are
 * (release a player by clearing his Team). Nothing changes until applyEdits.
 */
export function readPlayersCsv(d: Dynasty, text: string): CsvImport {
  const sheet = parseCsv(text);
  const col = (h: string) => sheet.headers.findIndex((x) => x.replace(/^﻿/, '').trim().toLowerCase() === h.toLowerCase());
  const out: CsvImport = { edits: new Map(), adds: [], changes: [], problems: [] };
  if (col('First Name') < 0 || col('Last Name') < 0) { out.problems.push('The file needs at least the columns First Name and Last Name (export one to see them all).'); return out; }
  const teamOf = new Map(d.teams.map((t) => [t.school.toLowerCase(), t.index]));
  sheet.rows.forEach((r, k) => {
    const cell = (h: string) => { const c = col(h); return c < 0 ? undefined : (r[c] ?? '').trim(); };
    const num = (h: string) => { const v = cell(h); return v === undefined || v === '' ? undefined : Number(v); };
    if (r.every((x) => !x?.trim())) return;
    const e: PlayerEdit = {};
    const set = <K extends keyof PlayerEdit>(key: K, v: PlayerEdit[K] | undefined) => { if (v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))) e[key] = v; };
    set('first', cell('First Name')); set('last', cell('Last Name')); set('pos', cell('Position')?.toUpperCase()); set('cls', cell('Class')?.toUpperCase() as ClassYear);
    set('jersey', num('Jersey')); set('heightIn', num('Height (in)')); set('weight', num('Weight (lb)')); set('hometown', cell('Hometown')); set('state', cell('Home State')); set('pot', num('Potential'));
    const team = cell('Team');
    if (team !== undefined) {
      if (team === '') e.team = null;
      else if (teamOf.has(team.toLowerCase())) e.team = teamOf.get(team.toLowerCase())!;
      else out.problems.push(`Row ${k + 2}: no team "${team}".`);
    }
    const ratings: Ratings = {};
    RATINGS.forEach((a, i) => { const v = num(RATING_COLS[i]); if (v !== undefined) ratings[a] = v; });
    if (Object.keys(ratings).length) e.ratings = ratings;
    const id = num('ID');
    const p = id !== undefined ? d.players[id - 1] : undefined;
    out.problems.push(...editProblems(d, p ?? null, e).map((m) => `Row ${k + 2}: ${m}`));
    if (p) {
      // Only what differs.
      const diff: PlayerEdit = {};
      const fields: string[] = [];
      for (const [key, v] of Object.entries(e) as [keyof PlayerEdit, unknown][]) {
        if (key === 'ratings') {
          const rd: Ratings = {};
          for (const [a, x] of Object.entries(v as Ratings) as [Attr, number][]) if (Math.abs((p.ratings[a] ?? -1) - x) > 0.05) { rd[a] = x; fields.push(`${a} ${Math.round(p.ratings[a] ?? 0)} → ${x}`); }
          if (Object.keys(rd).length) diff.ratings = rd;
        } else if ((p as unknown as Record<string, unknown>)[key] !== v) {
          (diff as Record<string, unknown>)[key] = v;
          fields.push(key === 'team' ? (v === null ? 'released' : `to ${d.teams[v as number].school}`) : `${key} ${String((p as unknown as Record<string, unknown>)[key])} → ${String(v)}`);
        }
      }
      if (fields.length) { out.edits.set(p.id, diff); out.changes.push(`${p.first} ${p.last} (${p.team !== null ? d.teams[p.team].school : 'no team'}): ${fields.join(', ')}`); }
    } else if (id !== undefined) {
      out.problems.push(`Row ${k + 2}: no player with ID ${id} (leave the ID empty to add a player).`);
    } else {
      if (e.team === undefined || e.team === null || !e.pos) { out.problems.push(`Row ${k + 2}: a new player needs a Team and a Position.`); return; }
      const np: DPlayer = {
        id: 0, first: e.first ?? '', last: e.last ?? '', pos: e.pos, team: e.team, cls: e.cls ?? 'FR', jersey: e.jersey ?? 0, heightIn: e.heightIn ?? 72, weight: e.weight ?? 200,
        hometown: e.hometown ?? '', state: e.state ?? '', ovr: 0, ratings: { Weight: 140 + 16 * 4, ...e.ratings }, skin: 0, status: 'active', pot: e.pot,
      };
      np.skin = newSkin(np);
      out.adds.push(np);
      out.changes.push(`New: ${np.pos} ${np.first} ${np.last} (${d.teams[e.team].school})`);
    }
  });
  return out;
}
