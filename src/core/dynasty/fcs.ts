// FCS schools (user, 2026-11-22): portal players come up from them and players nobody signs transfer down to them.
// Shown as "Harvard (FCS)"; no logos. The weight is how often a school sends or takes players: the top programs
// (national contenders of recent seasons) 6, solid ones 3, the rest 1. Schools that are FBS in a dynasty's
// season are left out (fcsSchools), so a school that moved up never shows as FCS.

import type { ClassYear, DPlayer } from './model';
import type { DefenseStats, KickingStats, PassingStats, PuntingStats, ReceivingStats, RushingStats } from './save';

type Rand = () => number;

const TOP = [
  'Montana State', 'Montana', 'South Dakota State', 'North Dakota', 'South Dakota', 'Idaho', 'UC Davis', 'Illinois State',
  'Villanova', 'Tarleton State', 'Abilene Christian', 'Incarnate Word', 'Mercer', 'Furman', 'Chattanooga',
  'Rhode Island', 'Southern Illinois', 'Northern Iowa', 'Youngstown State', 'Central Arkansas', 'Eastern Washington',
  'Richmond', 'William & Mary', 'Weber State', 'Lehigh', 'Harvard', 'Jackson State', 'Tennessee Tech', 'Stephen F. Austin',
];
const SOLID = [
  'Southern Utah', 'Utah Tech', 'Northern Arizona', 'Idaho State', 'Cal Poly', 'Portland State', 'Northern Colorado',
  'Elon', 'Monmouth', 'Stony Brook', 'New Hampshire', 'Maine', 'Albany', 'Towson', 'Campbell', 'Hampton',
  'North Carolina A&T', 'Samford', 'East Tennessee State', 'Wofford', 'Western Carolina', 'The Citadel', 'VMI',
  'UT Martin', 'Tennessee State', 'Southeast Missouri State', 'Eastern Illinois', 'Lindenwood', 'Austin Peay',
  'Eastern Kentucky', 'North Alabama', 'Lamar', 'McNeese', 'Nicholls', 'Southeastern Louisiana', 'Holy Cross',
  'Yale', 'Princeton', 'Penn', 'Dartmouth', 'Fordham', 'Lafayette', 'Florida A&M', 'Southern', 'Alcorn State',
  'Prairie View A&M', 'Western Illinois', 'Indiana State', 'Murray State', 'St. Thomas', 'Duquesne', 'UTRGV',
];
const REST = [
  'Northwestern State', 'Houston Christian', 'East Texas A&M', 'Brown', 'Columbia', 'Cornell', 'Bucknell', 'Colgate',
  'Georgetown', 'Saint Francis', 'Robert Morris', 'Central Connecticut', 'Wagner', 'Merrimack', 'Stonehill', 'LIU',
  'Bryant', 'Grambling State', 'Alabama A&M', 'Alabama State', 'Bethune-Cookman', 'Mississippi Valley State',
  'Arkansas-Pine Bluff', 'Texas Southern', 'South Carolina State', 'Howard', 'Morgan State', 'Norfolk State',
  'Delaware State', 'North Carolina Central', 'Gardner-Webb', 'Charleston Southern', 'Presbyterian', 'Morehead State',
  'Stetson', 'Valparaiso', 'Butler', 'Drake', 'San Diego', 'Davidson', 'Dayton', 'Marist', 'Mercyhurst', 'West Georgia',
];

export interface FcsSchool { name: string; weight: number; tier: 1 | 2 | 3 }

export const FCS_SCHOOLS: FcsSchool[] = [
  ...TOP.map((name) => ({ name, weight: 6, tier: 1 as const })),
  ...SOLID.map((name) => ({ name, weight: 3, tier: 2 as const })),
  ...REST.map((name) => ({ name, weight: 1, tier: 3 as const })),
];

/** The FCS schools of a dynasty: the list less any school that is FBS in it. */
export function fcsSchools(fbs: string[]): FcsSchool[] {
  const taken = new Set(fbs.map((s) => s.toLowerCase()));
  return FCS_SCHOOLS.filter((s) => !taken.has(s.name.toLowerCase()));
}

/** One school, by weight (the top programs more often); `better` > 1 leans further toward them (good players). */
export function pickFcs(list: FcsSchool[], r: Rand, better = 1): FcsSchool {
  const w = list.map((s) => s.weight ** better);
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((x -= w[i]) <= 0) return list[i];
  return list[list.length - 1];
}

/** Star odds (2★, 3★, 4★) of a player coming up from an FCS school, by the school's tier (1 = top programs). */
export const FCS_STARS: Record<1 | 2 | 3, number[]> = { 1: [0.45, 0.5, 0.05], 2: [0.6, 0.38, 0.02], 3: [0.8, 0.2, 0] };

/** How a school shows: "Harvard (FCS)". */
export const fcsLabel = (name: string) => `${name} (FCS)`;

// ---- seasons at the FCS school (user, 2026-11-22: "generate random season stats for their years at the FCS
// school to show in their career stats. They should be good numbers as their success in FCS allowed them to
// transfer to FBS. FCS stats do not count towards FBS all time career records.")


/** One season at an FCS school, in the game's stat lines. */
export interface FcsSeason {
  year: number;
  cls: ClassYear;
  stats: { passing?: PassingStats; rushing?: RushingStats; receiving?: ReceivingStats; kicking?: KickingStats; punting?: PuntingStats; defense?: DefenseStats };
}

const CLASSES: ClassYear[] = ['FR', 'SO', 'JR', 'SR'];
const between = (r: Rand, lo: number, hi: number) => lo + (hi - lo) * r();
const int = (x: number) => Math.max(0, Math.round(x));

/**
 * His FCS seasons: `years` of them, the last in `lastYear`, growing into a starring role (a freshman plays a
 * part, the last season is his best). Numbers of a good FCS starter at his position, a bit better with a higher OVR.
 */
export function fcsSeasons(p: Pick<DPlayer, 'pos' | 'ovr'>, years: number, lastYear: number, r: Rand): FcsSeason[] {
  const out: FcsSeason[] = [];
  const level = 0.85 + Math.max(0, Math.min(0.35, (p.ovr - 65) / 60)); // OVR 65 → 0.85, 86+ → 1.2
  for (let k = 0; k < years; k++) {
    const year = lastYear - (years - 1 - k);
    const role = [0.35, 0.7, 1][Math.min(2, years - 1 - k === 0 ? 2 : k === 0 && years === 3 ? 0 : 1)] * level * between(r, 0.85, 1.1);
    out.push({ year, cls: CLASSES[k], stats: seasonStats(p.pos, role, r) });
  }
  return out;
}

function seasonStats(pos: string, f: number, r: Rand): FcsSeason['stats'] {
  const rush = (att: number, ypc: number, tdPer: number): RushingStats => {
    const a = int(att * f), yds = int(a * ypc * between(r, 0.9, 1.1));
    return { att: a, yds, long: a ? int(Math.min(yds, between(r, 25, 80))) : 0, short: 0, fum: int(a / between(r, 60, 140)), td: int(a / tdPer) };
  };
  const rec = (n: number, ypr: number, tdPer: number): ReceivingStats => {
    const c = int(n * f), yds = int(c * ypr * between(r, 0.9, 1.1));
    return { rec: c, yds, long: c ? int(Math.min(yds, between(r, 35, 85))) : 0, drops: int(c / between(r, 15, 30)), fum: int(c / between(r, 50, 120)), td: int(c / tdPer) };
  };
  const def = (tkl: number, sacks: number, ints: number): DefenseStats => ({ tkl: int(tkl * f * between(r, 0.85, 1.15)), sacks: int(sacks * f * between(r, 0.6, 1.4)), int: int(ints * f * between(r, 0.5, 1.5)) });
  switch (pos) {
    case 'QB': {
      const att = int(between(r, 300, 420) * f), comp = int(att * between(r, 0.62, 0.69));
      return { passing: { att, comp, yds: int(att * between(r, 7.8, 9.3)), td: int(att / between(r, 11, 16)), int: int(att / between(r, 45, 80)) }, rushing: rush(between(r, 50, 110), between(r, 3.5, 6.5), between(r, 12, 25)) };
    }
    case 'HB': return { rushing: rush(between(r, 180, 260), between(r, 5.2, 6.6), between(r, 13, 18)), receiving: rec(between(r, 15, 32), between(r, 8, 11), between(r, 12, 25)) };
    case 'FB': return { rushing: rush(between(r, 40, 80), between(r, 4.2, 5.2), between(r, 8, 14)), receiving: rec(between(r, 8, 18), between(r, 7, 10), between(r, 8, 15)) };
    case 'WR': return { receiving: rec(between(r, 55, 85), between(r, 13, 16.5), between(r, 6, 9)) };
    case 'TE': return { receiving: rec(between(r, 30, 52), between(r, 10.5, 13.5), between(r, 6, 9)) };
    case 'LE': case 'RE': case 'DE': return { defense: def(between(r, 40, 60), between(r, 7, 12), between(r, 0, 1)) };
    case 'DT': return { defense: def(between(r, 35, 55), between(r, 4, 8), 0) };
    case 'LOLB': case 'ROLB': case 'OLB': return { defense: def(between(r, 65, 95), between(r, 4, 8), between(r, 0.5, 2)) };
    case 'MLB': case 'LB': return { defense: def(between(r, 90, 125), between(r, 2, 5), between(r, 0.5, 2.5)) };
    case 'CB': return { defense: def(between(r, 40, 60), between(r, 0, 1), between(r, 3, 6)) };
    case 'FS': case 'SS': case 'S': return { defense: def(between(r, 60, 90), between(r, 0, 1.5), between(r, 2.5, 5)) };
    case 'K': {
      const fga = int(between(r, 16, 25) * Math.min(1, f)), xpa = int(between(r, 40, 58) * Math.min(1, f));
      return { kicking: { fga, fgm: int(fga * between(r, 0.8, 0.92)), long: int(between(r, 44, 55)), blocked: int(r() * 1.4), xpa, xpm: int(xpa * between(r, 0.96, 1)) } };
    }
    case 'P': {
      const punts = int(between(r, 45, 65) * Math.min(1, f));
      return { punting: { punts, yds: int(punts * between(r, 42, 46.5)), long: int(between(r, 56, 68)), in10: int(punts * between(r, 0.2, 0.32)) } };
    }
    default: return {}; // linemen: no stats
  }
}
