// School prestige, 1-6 stars (user's scale, 2026-11-12): where a school finishes in the final poll
// sets its tier (top 10: 6, top 20: 5, top 35: 4, top 70: 3, top 100: 2, the rest: 1), and each year
// a school moves at most one star toward the tier it finished in.
//
// The starting stars come from College Football 27's own prestige (0-5 in half stars, by the ROM's
// school name): schools are ranked by it (ties by the team's OVR in the ROM) and given the stars of
// that place on the same scale, so the start fits the scale the dynasty then uses.

import type { DSeason, Dynasty } from './model';

/** College Football 27's prestige at launch (half stars), by the ROM's school name. */
export const CFB27_PRESTIGE: Record<string, number> = {
  'Air Force': 1, Akron: 0, Alabama: 5, 'App State': 1, Arizona: 2.5, 'Arizona State': 3, Arkansas: 3, 'Arkansas State': 1,
  Army: 2.5, Auburn: 3.5, 'Ball State': 0.5, Baylor: 2.5, 'Boise State': 2.5, 'Boston College': 2.5, 'Bowling Green': 0.5,
  Buffalo: 0, BYU: 4, Cal: 3, 'Central Michigan': 1, Charlotte: 0.5, Cincinnati: 2.5, Clemson: 4, Coastal: 1, Colorado: 3,
  'Colorado State': 1.5, Delaware: 1, Duke: 3, 'East Carolina': 2, 'Eastern Michigan': 0.5, FIU: 1, Florida: 3.5,
  'Florida Atlantic': 1, 'Florida State': 3.5, 'Fresno State': 1.5, 'Georgia Southern': 1, Georgia: 5, 'Georgia State': 0,
  'Georgia Tech': 3.5, Hawaii: 1.5, Houston: 3, Illinois: 3.5, Indiana: 4.5, Iowa: 3.5, 'Iowa State': 2.5, 'James Madison': 1.5,
  'Jax State': 1, Kansas: 2.5, 'Kansas State': 2.5, 'Kennesaw State': 1, 'Kent State': 0, Kentucky: 3, Liberty: 1, Louisiana: 1,
  'Louisiana Tech': 1, Louisville: 3, LSU: 4.5, Marshall: 1, Maryland: 2.5, Memphis: 2, Miami: 4.5, 'Miami of Ohio': 1,
  Michigan: 4.5, 'Michigan State': 3.5, 'Middle Tennessee': 0.5, Minnesota: 3.5, 'Mississippi St.': 2.5, Missouri: 3,
  'Missouri State': 0.5, Navy: 2.5, 'NC State': 3, 'North Dakota St.': 1.5, Nebraska: 4, Nevada: 1, 'New Mexico': 1,
  'New Mexico State': 1, NIU: 1, 'North Carolina': 2.5, 'North Texas': 1.5, Northwestern: 2.5, 'Notre Dame': 4.5, Ohio: 1,
  'Ohio State': 5, Oklahoma: 4.5, 'Oklahoma State': 3, 'Old Dominion': 1, 'Ole Miss': 4.5, Oregon: 4.5, 'Oregon State': 2,
  'Penn State': 4, Pitt: 3, Purdue: 2, Rice: 1.5, Rutgers: 2, 'Sacramento State': 1, 'Sam Houston': 0.5, 'San Diego State': 1,
  'San Jose State': 1.5, SMU: 3, 'South Alabama': 0.5, 'South Carolina': 3, 'Southern Miss': 0.5, Stanford: 3, Syracuse: 3,
  TCU: 3.5, Temple: 1, Tennessee: 4, Texas: 4.5, 'Texas A&M': 4.5, 'Texas State': 1, 'Texas Tech': 3.5, Toledo: 1, Troy: 1,
  Tulane: 2.5, Tulsa: 1.5, UAB: 1, UCF: 2.5, UCLA: 3.5, UConn: 1.5, 'UL Monroe': 0.5, UMass: 0.5, UNLV: 1.5, USC: 4.5,
  'South Florida': 1.5, Utah: 3.5, 'Utah State': 1.5, UTEP: 0.5, UTSA: 1.5, Vanderbilt: 2.5, Virginia: 3, 'Virginia Tech': 3,
  'Wake Forest': 2, Washington: 4, 'Washington State': 2, 'West Virginia': 2.5, 'Western Kentucky': 1.5, 'Western Michigan': 1,
  Wisconsin: 3, Wyoming: 1,
};

export const MAX_PRESTIGE = 6;

/** The prestige tier of a final poll place (1 = No. 1). */
export function tierOfRank(rank: number): number {
  return rank <= 10 ? 6 : rank <= 20 ? 5 : rank <= 35 ? 4 : rank <= 70 ? 3 : rank <= 100 ? 2 : 1;
}

/** Next year's stars: one star toward the tier the school finished in, at most. */
export const nextPrestige = (stars: number, finalRank: number) => stars + Math.sign(tierOfRank(finalRank) - stars);

/** Starting stars: schools ranked by CFB 27's prestige (then team OVR), each given the tier of its place. */
export function startingPrestige(schools: string[], teamOvr: { off: number; def: number }[] | undefined): number[] {
  const order = schools
    .map((s, t) => ({ t, p: CFB27_PRESTIGE[s] ?? 0, o: teamOvr ? teamOvr[t].off + teamOvr[t].def : 0 }))
    .sort((a, b) => b.p - a.p || b.o - a.o || a.t - b.t);
  const out = new Array<number>(schools.length).fill(1);
  order.forEach((x, i) => (out[x.t] = tierOfRank(i + 1)));
  return out;
}

/** A season's stars per team (computed from CFB 27 for a dynasty made before prestige was kept). */
export function seasonPrestige(d: Dynasty, season: DSeason): number[] {
  return season.prestige ?? startingPrestige(d.teams.map((t) => t.school), d.seasons[0].teamOvr);
}
