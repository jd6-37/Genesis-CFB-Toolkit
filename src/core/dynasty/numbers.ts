// Jersey numbers (user, 2026-11-13). Who gets which number when the offseason ends:
//   - A returning player keeps his number. Two players may share one only as real teams do, one on offense and
//     one on defense; a second holder on the same side (the weaker one) gets a new number.
//   - New players (the signing class, walk-ons, transfers) pick in order of OVR, best first. A transfer keeps his
//     old number if nobody at the new school wears it; otherwise he usually stays on the same last digit (7 → 17).
//   - Single digits go first: while one is free, a new back, receiver or defensive back takes it half the time
//     (a linebacker or end less often), so the best new players end up with them.
//   - A new number is drawn from where the position's players wear theirs in College Football 27 (SHARE below:
//     the share per ten numbers, from the 10,938 players of the 2026 Week 9 rosters), and never one a teammate has.
//   - 0 is a number. NO_NUMBER marks a player who doesn't have one yet.
//   - Computer teams only, and rarely: when a single digit is free, one veteran starter may move to it.
//     On a user's team nobody changes his number unless the user does it (Edit player).
import type { DPlayer } from './model';

export const NO_NUMBER = -1;

type Group = 'QB' | 'HB' | 'FB' | 'WR' | 'TE' | 'OL' | 'DE' | 'DT' | 'LB' | 'CB' | 'S' | 'K' | 'P';
const GROUP: Record<string, Group> = {
  QB: 'QB', HB: 'HB', FB: 'FB', WR: 'WR', TE: 'TE', LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL',
  LE: 'DE', RE: 'DE', DT: 'DT', LOLB: 'LB', MLB: 'LB', ROLB: 'LB', CB: 'CB', FS: 'S', SS: 'S', K: 'K', P: 'P',
};
/** Share (%) of a position's players in 0-9, 10-19 … 90-99. Shares of 1% and stray entries are left out. */
const SHARE: Record<Group, number[]> = {
  QB: [41, 57, 0, 0, 0, 0, 0, 0, 0, 0],
  HB: [34, 6, 53, 6, 1, 0, 0, 0, 0, 0],
  FB: [5, 0, 5, 30, 55, 5, 0, 0, 0, 0],
  WR: [42, 34, 5, 0, 0, 0, 0, 0, 17, 0],
  TE: [9, 13, 2, 4, 16, 3, 0, 0, 51, 0],
  OL: [0, 0, 0, 0, 0, 31, 23, 45, 0, 0],
  DE: [16, 21, 6, 8, 15, 10, 0, 0, 3, 21],
  DT: [7, 6, 2, 2, 6, 16, 1, 2, 5, 53],
  LB: [19, 22, 16, 19, 17, 6, 0, 0, 0, 0],
  CB: [36, 26, 32, 6, 0, 0, 0, 0, 0, 0],
  S: [30, 26, 30, 11, 2, 0, 0, 0, 0, 0],
  K: [1, 7, 8, 27, 17, 0, 0, 0, 6, 34],
  P: [2, 7, 8, 32, 20, 0, 0, 0, 6, 24],
};
const OFFENSE = new Set<Group>(['QB', 'HB', 'FB', 'WR', 'TE', 'OL', 'K', 'P']);
const groupOf = (pos: string): Group => GROUP[pos] ?? 'LB';
/** Offense (with the kickers) or defense: a number may be worn once on each. */
export const sideOf = (pos: string): 'O' | 'D' => (OFFENSE.has(groupOf(pos)) ? 'O' : 'D');
const weightOf = (pos: string, n: number) => SHARE[groupOf(pos)][Math.floor(n / 10)];
/** When the position's own numbers are all taken: linemen stay in 50-79, the players who may catch a pass stay out of it. */
const allowed = (pos: string, n: number) => {
  const g = groupOf(pos);
  if (g === 'OL') return n >= 50 && n <= 79;
  return OFFENSE.has(g) && g !== 'K' && g !== 'P' ? n < 50 || n > 79 : true;
};
const ALL = Array.from({ length: 100 }, (_, n) => n);

/** May a player of this position wear the number in the game? (0-99; linemen 50-79, passers, backs and receivers not.) */
export const numberAllowed = (pos: string, n: number) => Number.isInteger(n) && n >= 0 && n <= 99 && allowed(pos, n);

/**
 * The number an imported player gets in place of one his position can't wear (user, 2026-11-13). No dice, so an
 * import always gives the same result: the same last digit if it can be kept, in the tens his position wears
 * most (SHARE), then the nearest one; never a number in `taken`.
 */
export function replacementNumber(pos: string, n: number, taken: ReadonlySet<number>): number | null {
  const near = Number.isFinite(n) ? n : 0;
  const digit = ((Math.round(near) % 10) + 10) % 10;
  const free = ALL.filter((c) => allowed(pos, c) && !taken.has(c));
  if (!free.length) return null;
  const key = (c: number) => [c % 10 === digit ? 0 : 1, -weightOf(pos, c), Math.abs(c - near), c];
  return free.sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; })[0];
}

/**
 * For a whole imported roster: the new number of every player whose number his position can't wear, by his
 * place in `roster`. A new number is one nobody on his side of the ball wears.
 */
export function fixNumbers(roster: { pos: string; jersey: number }[]): Map<number, number> {
  const taken = { O: new Set<number>(), D: new Set<number>() };
  for (const p of roster) if (numberAllowed(p.pos, p.jersey)) taken[sideOf(p.pos)].add(p.jersey);
  const out = new Map<number, number>();
  roster.forEach((p, i) => {
    if (!Number.isFinite(p.jersey) || numberAllowed(p.pos, p.jersey)) return; // no number in the file: not this function's job
    const to = replacementNumber(p.pos, p.jersey, taken[sideOf(p.pos)]);
    if (to === null) return;
    taken[sideOf(p.pos)].add(to);
    out.set(i, to);
  });
  return out;
}

type Rand = () => number;
function weighted(r: Rand, nums: number[], w: (n: number) => number): number | null {
  const total = nums.reduce((a, n) => a + w(n), 0);
  if (total <= 0) return null;
  let x = r() * total;
  for (const n of nums) { x -= w(n); if (x < 0) return n; }
  return nums[nums.length - 1];
}
/** A free number for the position; with `like`, usually one with the same last digit. */
function draw(r: Rand, pos: string, free: number[], like: number | null): number {
  if (like !== null && r() < 0.7) {
    const same = weighted(r, free.filter((n) => n % 10 === like % 10), (n) => weightOf(pos, n));
    if (same !== null) return same;
  }
  return weighted(r, free, (n) => weightOf(pos, n))
    ?? weighted(r, free.filter((n) => allowed(pos, n)), () => 1)
    ?? weighted(r, free, () => 1)
    ?? 0;
}

/** Positions whose best players often wear a single digit (15% or more do), and how often a new one takes a free one. */
const WANTS_SINGLE: Partial<Record<Group, number>> = { QB: 0.5, HB: 0.5, WR: 0.5, CB: 0.5, S: 0.5, LB: 0.3, DE: 0.3 };
const SINGLE_OFTEN = new Set(Object.keys(WANTS_SINGLE) as Group[]);
/** Chance that a computer team with a free single digit hands it to a veteran this offseason. */
export const UPGRADE_CHANCE = 0.15;
/** About a third of players would take a single digit; the others keep their number for good (decided by his ID). */
const wouldSwitch = (p: DPlayer) => ((p.id * 2654435761) >>> 0) % 100 < 35;

export interface NumberChange { player: number; team: number; from: number; to: number; why: 'new' | 'taken' | 'shared' | 'upgrade' }

/**
 * Settles every team's numbers at the end of an offseason. `year` is the season that just ended (transfers and the
 * signing class is the next year's); `userTeams` never get an upgrade.
 */
export function assignNumbers(all: DPlayer[], year: number, userTeams: number[], r: Rand): { players: DPlayer[]; changes: NumberChange[] } {
  const out = all.slice();
  const changes: NumberChange[] = [];
  const teams = new Map<number, number[]>();
  out.forEach((p, i) => { if (p.status === 'active' && p.team !== null) teams.set(p.team, [...(teams.get(p.team) ?? []), i]); });
  const moved = (p: DPlayer) => { const t = p.transfers?.[p.transfers.length - 1]; return !!t && t.year === year && t.to === p.team; };
  /** No number yet: a new player, or one of a class signed before NO_NUMBER existed (they all had 0). */
  const none = (p: DPlayer) => p.jersey < 0 || p.jersey > 99 || (p.recruit?.year === year + 1 && p.jersey === 0 && !moved(p));
  const isNew = (p: DPlayer) => none(p) || moved(p);
  const set = (i: number, to: number, why: NumberChange['why']) => {
    const p = out[i];
    changes.push({ player: p.id, team: p.team!, from: p.jersey, to, why });
    out[i] = { ...p, jersey: to };
  };
  for (const [team, idx] of [...teams.entries()].sort((a, b) => a[0] - b[0])) {
    const byOvr = (a: number, b: number) => out[b].ovr - out[a].ovr || out[a].id - out[b].id;
    const back = idx.filter((i) => !isNew(out[i])).sort(byOvr);
    const fresh = idx.filter((i) => isNew(out[i])).sort(byOvr);
    // 1. Returning players keep their numbers: one holder on offense and one on defense.
    const held = new Map<number, Set<string>>();
    const waiting: { i: number; like: number | null; why: NumberChange['why'] }[] = [];
    for (const i of back) {
      const p = out[i], sides = held.get(p.jersey) ?? new Set<string>();
      if (p.jersey >= 0 && p.jersey <= 99 && !sides.has(sideOf(p.pos))) { sides.add(sideOf(p.pos)); held.set(p.jersey, sides); }
      else waiting.push({ i, like: p.jersey >= 0 ? p.jersey : null, why: 'shared' });
    }
    const free = () => ALL.filter((n) => !held.has(n));
    const take = (n: number, pos: string) => held.set(n, new Set([sideOf(pos)]));
    // 2. A computer team's veteran may move to a free single digit: rarely, and one a year at most.
    const singles = free().filter((n) => n < 10);
    if (!userTeams.includes(team) && singles.length && r() < UPGRADE_CHANCE) {
      const rankAtPos = (i: number) => back.filter((j) => out[j].pos === out[i].pos && byOvr(j, i) < 0).length;
      const who = back.find((i) => {
        const p = out[i];
        return p.jersey >= 10 && SINGLE_OFTEN.has(groupOf(p.pos)) && (p.cls === 'JR' || p.cls === 'SR' || p.cls === 'SR+')
          && rankAtPos(i) < 2 && wouldSwitch(p) && !waiting.some((w) => w.i === i);
      });
      if (who !== undefined) {
        const p = out[who];
        const n = singles.includes(p.jersey % 10) && r() < 0.6 ? p.jersey % 10 : singles[Math.floor(r() * singles.length)];
        const sides = held.get(p.jersey)!; sides.delete(sideOf(p.pos)); if (!sides.size) held.delete(p.jersey);
        take(n, p.pos);
        set(who, n, 'upgrade');
      }
    }
    // 3. Everybody who needs a number: a returning player who lost a shared one, then the new players, best first.
    for (const i of fresh) waiting.push({ i, like: none(out[i]) ? null : out[i].jersey, why: 'new' });
    for (const w of waiting) {
      const p = out[w.i];
      if (w.why === 'new' && w.like !== null && !held.has(w.like)) { take(w.like, p.pos); continue; } // a transfer keeps his number
      const open = free(), singles = open.filter((x) => x < 10);
      const n = w.why === 'new' && singles.length && r() < (WANTS_SINGLE[groupOf(p.pos)] ?? 0)
        ? singles[Math.floor(r() * singles.length)]
        : draw(r, p.pos, open, w.like);
      take(n, p.pos);
      set(w.i, n, w.why === 'new' && w.like !== null ? 'taken' : w.why);
    }
  }
  return { players: out, changes };
}
