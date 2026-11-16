// The two editions a dynasty can be played in (user, 2026-11-15: "Make it compatible with our latest 1994 rom").
// Both are 4 MB ROMs on the same season engine and dynasty support (claude.ai project notes:
// bw95-1994-107-teams-rom-plan.md); they differ in teams, rosters, the season's length and the postseason.
//
// 2026 Season Edition: 138 teams, save mark 0x6F, dynasty header format 0x0001008A, 12 weeks, title games and
//   the CFP; rosters from College Football 27 (the built-in CSV builds the first season's 64 per team).
// 1994 Season Edition (v2.0.1-test29 on): 107 teams, save mark 0x94, format 0x0001006B, 11 weeks, the 19 bowls
//   of 1994 (the No. 1 team in the final poll is the champion); rosters straight from the ROM, backups generated.

import { RULES_2026, type ConfRules } from '../seasonWide';
import { teamsOf } from '../wide';

export type EditionId = '2026' | '1994';

export interface Edition {
  id: EditionId;
  /** As the app names it. */
  name: string;
  teams: number;
  /** The first season of a new dynasty. */
  startYear: number;
  /** The battery save's signature byte ($200001). */
  saveSig: number;
  /** Regular-season weeks of a Random schedule. */
  regWeeks: number;
  postseason: 'cfp' | 'bowls';
  /** What the season engine needs of the conferences (seasonWide.ts): the weeks, and which conferences play a title game. */
  confRules: ConfRules;
}

export const EDITIONS: Record<EditionId, Edition> = {
  '2026': { id: '2026', name: '2026 Season Edition', teams: 138, startYear: 2026, saveSig: 0x6f, regWeeks: 12, postseason: 'cfp', confRules: RULES_2026 },
  '1994': { id: '1994', name: '1994 Season Edition', teams: 107, startYear: 1994, saveSig: 0x94, regWeeks: 11, postseason: 'bowls', confRules: { weeks: 11, titleGames: [0] } },
};

/** The edition of a ROM by its team count, or null (not a dynasty edition). */
export function editionOfRom(d: Uint8Array): Edition | null {
  const n = teamsOf(d);
  return Object.values(EDITIONS).find((e) => e.teams === n) ?? null;
}

/** The edition of a battery save by its signature byte, or null. */
export const editionOfSig = (sig: number): Edition | null => Object.values(EDITIONS).find((e) => e.saveSig === sig) ?? null;

/** A dynasty's edition (dynasties made before the 1994 edition are 2026 ones). */
export const editionOf = (d: { edition?: EditionId }): Edition => EDITIONS[d.edition ?? '2026'];

/** The dynasty header's format word and team count (+0x10). */
export const dynastyFormat = (teams: number) => (0x10000 | teams) >>> 0;
