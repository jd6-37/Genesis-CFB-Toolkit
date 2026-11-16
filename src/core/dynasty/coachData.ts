// The real coaches built into the app (public/data/coaches-YEAR.json; cli/coachesdata.ts makes them from the
// Rosters lane's lists, H-020): each edition's head coaches, coordinators and recently unemployed head coaches,
// with their real seasons before the edition's year (Wikipedia).
import type { EditionId } from './edition';

export interface CoachDataEntry {
  /** The lists' id ("kirby-smart-2026"). */
  key: string;
  name: string;
  born?: number;
  hometown?: string;
  alma?: string;
  /** His job in the edition's year: head coach, coordinator, or none (out of a job, or coaching elsewhere). */
  role: 'HC' | 'OC' | 'DC' | 'none';
  /** The school of that job (the ROM's name). */
  school?: string;
  tags?: string[];
  /** What the lists say about him (for a coach without a job: his last job). */
  note?: string;
  /** His Wikipedia page (the part after /wiki/). */
  wiki?: string;
}

/** A real season: coach (index in `coaches`), year, school, role, W, L, T, conference title (1), postseason, Wikipedia page. */
export type CoachDataSeason = [number, number, string, string, number | undefined, number | undefined, number | undefined, 0 | 1, string, string];

export interface CoachData {
  /** The edition's year: seasons end the year before. */
  year: number;
  coaches: CoachDataEntry[];
  seasons: CoachDataSeason[];
}

export const coachDataFile = (edition: EditionId) => `data/coaches-${edition}.json`;

/** Served from public/data/, fetched when a dynasty gets its coaches. */
export async function fetchCoachData(edition: EditionId, base = '/'): Promise<CoachData> {
  let res: Response;
  try {
    res = await fetch(base + coachDataFile(edition));
  } catch {
    throw new Error('The coaches file could not be loaded. Check your connection and try again.');
  }
  if (!res.ok) throw new Error(`The coaches file could not be loaded (${res.status}).`);
  return (await res.json()) as CoachData;
}
