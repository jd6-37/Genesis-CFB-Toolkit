// The website's roster data (public/data/rosters/<edition>.json), made by `npm run site:rosters` from the ROMs.

export type EditionId = '2026' | '1994' | 'original' | 'historic';
export type GroupId = 'QB' | 'RB' | 'REC' | 'OL' | 'KP' | 'DL' | 'LB' | 'DB';
/** Rating keys: speed, quickness, intelligence (the game's INTEL), hands, power, range, accuracy, tackling, blocking, weight. */
export type RatingKey = 'spd' | 'qck' | 'int' | 'hnd' | 'pwr' | 'rng' | 'acc' | 'tck' | 'blk' | 'wt';

/**
 * One roster spot as Team Rosters shows it: the spot's label, jersey number (null: none), first and last name (empty
 * when the ROM has none), class (FR … SR+, or empty), OVR, weight in pounds, the ratings of the spot's group (0-99;
 * weight in pounds) and the group.
 */
export type RosterPlayer = [label: string, no: number | null, first: string, last: string, cls: string, ovr: number, wt: number, r: Partial<Record<RatingKey, number>>, group: GroupId];

export interface TeamSummary {
  /** Address part: /rosters/<edition>/<id>. */
  id: string;
  /** School as the game names it (a historic team's includes its year, "Alabama '78"). */
  school: string;
  nickname: string;
  city: string;
  /** Two-letter state, or empty. */
  state: string;
  /** Conference, or empty. */
  conf: string;
  off: number;
  def: number;
  /** The team color (title) and the secondary color (stripe; light gray when it would be white), as #rrggbb. */
  color: string;
  stripe: string;
  /** The logo's cell (x, y) in the edition's logo sheet, or null. */
  logo: [number, number] | null;
}

export interface TeamRoster extends TeamSummary {
  players: RosterPlayer[];
}

export interface EditionData {
  edition: EditionId;
  /** The ROM the rosters come from, e.g. "v2.0.1-test69", or "the original game". */
  build: string;
  /** Logo sheet: /media/rosters/logos-<edition>.png, its size, and one logo cell's size. */
  sheet: { width: number; height: number; cell: [number, number] };
  teams: TeamRoster[];
}
