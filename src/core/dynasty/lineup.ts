// The lineup editor (user, 2026-11-12): a user team's 64 spots, the 32 on the Active Roster (the
// game's slots) and a backup for each (QB2, HB3, HB4 …). Choosing a spot for a player swaps him with
// the player there. A player may move within his position group, or change position to a related
// one (HB/FB, FB/TE, DE/OLB, OLB/MLB, K/P), once per season, so a TE needs a season at FB before he
// can play HB. Moves are only possible before the season's first results are imported (the game's
// stats belong to the slot) and outside the offseason; the next offseason sets the depth chart again.

import { bw95Role, scoreOf, type Column } from '../rosterCfb27';
import { GROUP_COLUMNS, rosterLayout } from '../rosterLayouts';
import { starterOvr } from '../teamRatings';
import type { BwSlot, DPlayer, DSeason, Dynasty } from './model';
import { cfbOvr } from './offseason';
import { playerOvr } from './ovr';
import { SLOTS } from './rosters';

/** The 138-team edition's 32 slots in the game's roster order (every team plays the 4-3). */
export const SLOT_DEFS = rosterLayout('bw95', false, true);
const DEF = new Map(SLOT_DEFS.map((x) => [x.slot, x]));
const defOf = (slot: number) => DEF.get(slot)!;

/** A spot: 0-31 the slot on the Active Roster, 32-63 the slot's backup. */
export const isBackup = (spot: number) => spot >= SLOTS;
export const slotOfSpot = (spot: number) => spot % SLOTS;

const base = (label: string) => label.replace(/\d+$/, '');
/** A backup's position name: QB2, HB3 and HB4 behind HB1 and HB2, FS3 and FS4 behind FS and FS2 … */
export function backupLabel(slot: number): string {
  const label = defOf(slot).label;
  const b = base(label);
  const n = SLOT_DEFS.filter((x) => base(x.label) === b).length;
  const k = Number(label.slice(b.length)) || 1;
  return `${b}${n + k}`;
}
export const spotLabel = (spot: number) => (isBackup(spot) ? backupLabel(slotOfSpot(spot)) : defOf(spot).label);
/** Every spot in the game's roster order: the Active Roster, then the backups. */
export const SPOTS = [...SLOT_DEFS.map((x) => x.slot), ...SLOT_DEFS.map((x) => x.slot + SLOTS)];

export type Kind = 'QB' | 'HB' | 'FB' | 'WR' | 'TE' | 'OL' | 'DE' | 'DT' | 'OLB' | 'MLB' | 'CB' | 'S' | 'K' | 'P';

const LABEL_KIND: Record<string, Kind> = {
  QB: 'QB', HB: 'HB', FB: 'FB', SE: 'WR', FL: 'WR', WR: 'WR', TE: 'TE', LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL',
  LDE: 'DE', RDE: 'DE', DT: 'DT', LOLB: 'OLB', ROLB: 'OLB', MLB: 'MLB', LCB: 'CB', RCB: 'CB', SS: 'S', FS: 'S', K: 'K', P: 'P',
};
export const slotKind = (slot: number): Kind => LABEL_KIND[base(defOf(slot).label)];

const POS_KIND: Record<string, Kind> = {
  QB: 'QB', HB: 'HB', FB: 'FB', WR: 'WR', TE: 'TE', LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL',
  LE: 'DE', RE: 'DE', DT: 'DT', LOLB: 'OLB', ROLB: 'OLB', MLB: 'MLB', CB: 'CB', FS: 'S', SS: 'S', K: 'K', P: 'P',
};
export const posKind = (pos: string): Kind | null => POS_KIND[pos] ?? null;

/** Position changes allowed (user, 2026-11-12): no CB/S or DE/DT, so nobody signs corners to play safety. */
export const MOVES: Record<Kind, Kind[]> = {
  QB: [], HB: ['FB'], FB: ['HB', 'TE'], WR: [], TE: ['FB'], OL: [], DE: ['OLB'], DT: [], OLB: ['MLB', 'DE'], MLB: ['OLB'],
  CB: [], S: [], K: ['P'], P: ['K'],
};

/** The CFB 27 position a player gets when he changes to a spot of another kind. */
function newPos(slot: number, kind: Kind): string {
  const label = defOf(slot).label;
  if (kind === 'DE') return label === 'RDE' ? 'RE' : 'LE';
  if (kind === 'OLB') return label === 'ROLB' ? 'ROLB' : 'LOLB';
  return kind;
}

const last = (d: Dynasty) => d.seasons[d.seasons.length - 1];

/** Why the team's lineup can't be changed now, or null when it can. */
export function lineupLock(d: Dynasty, team: number): string | null {
  const s = last(d);
  if (!d.userTeams.includes(team)) return 'Only your teams\' lineups can be changed.';
  if (d.offseason) return 'The lineup is set for the next season at the end of the offseason.';
  if (!s.bw || !s.bench || !s.benchBw) return 'Start this dynasty again to change lineups (it was made before the app kept backups).';
  if (s.imports.some((i) => i.played > 0)) return 'The lineup is set for this season: the game\'s stats belong to the spots. You can change it after the offseason.';
  return null;
}

const holder = (s: DSeason, team: number, spot: number) => (isBackup(spot) ? s.bench![team][slotOfSpot(spot)] : s.slots[team][spot]);
const ratingsAt = (s: DSeason, team: number, spot: number) => (isBackup(spot) ? s.benchBw![team][slotOfSpot(spot)] : s.bw![team][spot]);

/** The spots a player holds (a kicker's backup can also back up the punter). */
export const spotsOf = (s: DSeason, team: number, id: number) => SPOTS.filter((spot) => holder(s, team, spot) === id);

/** The kinds of spot a player may take now. */
function kindsFor(s: DSeason, team: number, p: DPlayer): Set<Kind> {
  const own = posKind(p.pos);
  const out = new Set<Kind>(spotsOf(s, team, p.id).map((spot) => slotKind(slotOfSpot(spot))));
  if (!own) return out;
  out.add(own);
  if (p.posChange?.year === s.year) {
    const from = posKind(p.posChange.from); // he changed this season: only back to where he was
    if (from) out.add(from);
  } else {
    for (const k of MOVES[own]) out.add(k);
  }
  return out;
}

/** The spots a player can be moved to, in the game's order (his own included). */
export function spotsFor(d: Dynasty, team: number, p: DPlayer): number[] {
  const s = last(d);
  const kinds = kindsFor(s, team, p);
  return SPOTS.filter((spot) => kinds.has(slotKind(slotOfSpot(spot))));
}

/** A player's values by CFB 27 column (Weight is his weight in pounds). */
const valuesOf = (d: Dynasty, p: DPlayer) => (c: Column) => {
  if (c === 'Weight') return p.weight;
  const i = d.attrKeys.indexOf(c);
  return i >= 0 ? p.attrs[i] ?? 0 : 0;
};

/**
 * A player's game ratings at a slot of another role: for each rating, the step of the Active Roster
 * player of that role (every team) whose CFB 27 score is closest below his, as the Rosters tool rates
 * the backups (rateAgainst).
 */
function rateAt(d: Dynasty, s: DSeason, p: DPlayer, slot: number): BwSlot {
  const def = defOf(slot);
  const role = bw95Role(slot, false, true);
  const attrs = GROUP_COLUMNS[def.group];
  const lists = attrs.map(() => [] as [number, number][]);
  s.slots.forEach((sl, t) => sl.forEach((id, k) => {
    const b = s.bw![t][k];
    if (!id || !b || bw95Role(k, false, true) !== role) return;
    const v = valuesOf(d, d.players[id - 1]);
    attrs.forEach((a, i) => {
      const j = b.attrs.indexOf(a);
      if (j >= 0) lists[i].push([scoreOf(def.group, v, a), b.steps[j]]);
    });
  }));
  const v = valuesOf(d, p);
  const steps = attrs.map((a, i) => {
    const list = lists[i].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const mine = scoreOf(def.group, v, a);
    let lo = 0, hi = list.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (list[m][0] <= mine) lo = m + 1; else hi = m; }
    return lo > 0 ? list[lo - 1][1] : list.length ? list[0][1] : 0;
  });
  const olPlus = s.bw!.flat().find((b) => b?.group === 'OL')?.weightPlus ?? 0;
  return { label: def.label, group: def.group, attrs, steps, weightPlus: def.group === 'OL' ? olPlus : 0 };
}

const teamStarters = (d: Dynasty, slots: (number | null)[], bw: (BwSlot | null)[]) => starterOvr(slots.flatMap((id, slot) => {
  const p = id ? d.players[id - 1] : undefined;
  const b = bw[slot];
  return p && b ? [{ pos: p.pos, ovr: playerOvr(slot, b) }] : [];
}));

/**
 * Moves a player to a spot; the player there takes the spot(s) he leaves. Returns the new dynasty.
 * Throws when the move isn't allowed (lineupLock, spotsFor) or would leave the Active Roster short.
 */
export function moveToSpot(d: Dynasty, team: number, id: number, spot: number): Dynasty {
  const lock = lineupLock(d, team);
  if (lock) throw new Error(lock);
  const s = last(d);
  const p = d.players[id - 1];
  if (!p || p.team !== team) throw new Error('He isn\'t on this team.');
  if (!spotsFor(d, team, p).includes(spot)) throw new Error(`${p.first} ${p.last} can't play ${spotLabel(spot)}.`);
  const from = spotsOf(s, team, id);
  if (from.includes(spot)) return d;
  const other = holder(s, team, spot);
  if (other === null && from.some((x) => !isBackup(x))) throw new Error(`Nobody would be left at ${spotLabel(from.find((x) => !isBackup(x))!)}.`);
  // The player there takes his spot, so it must be one he can play too.
  if (other !== null) {
    const q = d.players[other - 1];
    const kinds = kindsFor(s, team, q);
    const bad = from.find((x) => !kinds.has(slotKind(slotOfSpot(x))));
    if (bad !== undefined) throw new Error(`${q.first} ${q.last} (${spotLabel(spot)}) would take ${spotLabel(bad)}, and he can't play it.`);
  }

  const slots = s.slots.map((x, t) => (t === team ? x.slice() : x));
  const bench = s.bench!.map((x, t) => (t === team ? x.slice() : x));
  const bw = s.bw!.map((x, t) => (t === team ? x.slice() : x));
  const benchBw = s.benchBw!.map((x, t) => (t === team ? x.slice() : x));
  const players = d.players.slice();

  // Who goes where, and the ratings each had before.
  const moves: [number, number | null][] = [[spot, id], ...from.map((x): [number, number | null] => [x, other])];
  const before = new Map<number, { slot: number; b: BwSlot }>();
  for (const [x, pid] of [[from[0], id], [spot, other]] as [number | undefined, number | null][]) {
    if (x === undefined || pid === null) continue;
    const b = ratingsAt(s, team, x);
    if (b) before.set(pid, { slot: slotOfSpot(x), b });
  }

  // A move to another kind of spot changes his position (and his CFB 27-style OVR); moving back undoes it.
  for (const [x, pid] of moves) {
    if (pid === null) continue;
    const q = players[pid - 1];
    const kind = slotKind(slotOfSpot(x));
    if (posKind(q.pos) === kind) continue;
    if (spotsOf(s, team, pid).some((y) => slotKind(slotOfSpot(y)) === kind)) continue; // already plays it
    const back = q.posChange?.year === s.year && posKind(q.posChange.from) === kind;
    const pos = back ? q.posChange!.from : newPos(slotOfSpot(x), kind);
    players[pid - 1] = { ...q, pos, ovr: cfbOvr(d, pos, q.attrs) || q.ovr, posChange: back ? undefined : { year: s.year, from: q.pos } };
  }

  const next = { ...d, players };
  for (const [x, pid] of moves) {
    const slot = slotOfSpot(x);
    const prev = pid === null ? undefined : before.get(pid);
    const def = defOf(slot);
    const b = pid === null ? null
      : prev && prev.b.group === def.group && bw95Role(prev.slot, false, true) === bw95Role(slot, false, true)
        ? { ...prev.b, label: def.label }
        : rateAt(next, s, players[pid - 1], slot);
    if (isBackup(x)) { bench[team][slot] = pid; benchBw[team][slot] = b; } else { slots[team][slot] = pid; bw[team][slot] = b; }
  }

  // Team OVRs move by the change in the starters' OVR (the season's values may be the ROM's own).
  let teamOvr = s.teamOvr;
  if (teamOvr) {
    const old = teamStarters(d, s.slots[team], s.bw![team]);
    const now = teamStarters(next, slots[team], bw[team]);
    const clamp = (n: number) => Math.max(0, Math.min(99, n));
    teamOvr = teamOvr.map((o, t) => (t === team ? { off: clamp(o.off + now.off - old.off), def: clamp(o.def + now.def - old.def) } : o));
  }
  const season: DSeason = { ...s, slots, bench, bw, benchBw, teamOvr, lineupEdited: true };
  return { ...next, seasons: [...d.seasons.slice(0, -1), season] };
}
