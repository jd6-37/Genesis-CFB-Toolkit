// Offseason rules (user, 2026-11-12: "give users total control over how cpu offseason logic works … adjust
// nearly every threshold and percentage chance … this will also help me understand how to debug and refine
// the logic"). Every number the offseason uses, with its default; a dynasty keeps only the ones the user
// changed (`Dynasty.rules`), so new defaults reach old dynasties. Rules files move them between dynasties.

import type { Dynasty } from './model';

/** Stars 0 (walk-on) to 5, for the by-stars lists. */
export type ByStars = [number, number, number, number, number, number];

export interface OffseasonRules {
  // Departures
  /** Seniors go pro with chance (OVR − base) / scale, at most max. */
  proSeniorBase: number; proSeniorScale: number; proSeniorMax: number;
  /** A senior who doesn't go pro comes back as SR+ with this chance (else he graduates). */
  srPlusReturn: number;
  /** Juniors go pro with chance (OVR − base) / scale, at most max. */
  proJuniorBase: number; proJuniorScale: number; proJuniorMax: number;
  // Development
  /** Share of the room to his potential a player closes in an offseason, by the class he's leaving. */
  growthFR: number; growthSO: number; growthJR: number; growthSR: number; growthSRPlus: number;
  /** Random spread of a year's growth (× from min to max). */
  growthMin: number; growthMax: number;
  /** Extra OVR for players on last season's Active Roster. */
  starterBonus: number;
  /** How fast each rating grows compared with the others (user, 2026-11-12: "SPD shouldn't be able to progress as much as AWR"). A year's OVR gain is spread by these. */
  speedPace: number; paceQuickness: number; paceRange: number; pacePower: number; paceTechnique: number; paceAwareness: number;
  /** Training focus (training.ts): the most points in one area, and how much the cap speeds an area up (and 0 slows it down). */
  trainingMax: number; trainingEffect: number;
  /** Most weight gained in an offseason, as a share of the player's weight (not K, P). */
  weightGainPct: number;
  /** How much the Strength program moves the weight gain (0.5: half at 0 points, 1.5× at the most). */
  weightTrainingEffect: number;
  /** The most a rating can move in one offseason, in rating points (Awareness; Speed; Quickness and Range; the others). */
  capAwareness: number; capSpeed: number; capQuickRange: number; capOther: number;
  // Transfers
  transferStarter: number; transferDepth: number; transferBackup: number;
  /** Added when next season's (projected) depth chart has him out of a starting spot. */
  transferBlocked: number;
  /** Added for seniors. */
  transferSenior: number;
  /** How much full playing time cuts the chance (0.8 = 80% less). */
  playingTimeCut: number;
  /** Full playing time = this share of a typical starter's touches at his position. */
  playingTimeShare: number;
  /** Most transfers one team takes (random classes). */
  transfersPerTeam: number;
  // Recruiting
  weeks: number;
  userPoints: number; cpuPoints: number;
  maxPerProspect: number; boardSize: number;
  scoutOvr: number; scoutRatings: number;
  /** Offers a team may have out at one time, beyond its open spots (to prospects who haven't committed). */
  offerExtra: number;
  /** Interest × this with an offer, × noOffer without. */
  offerBoost: number; noOffer: number;
  /** Interest a prospect needs from a school to commit, by stars. */
  commitThreshold: ByStars;
  /** The first week he may commit, by stars. */
  firstWeek: ByStars;
  /** Portal players need this share of the threshold (and decide a week sooner). */
  portalThreshold: number;
  /** The leader's interest must be this many times the second's. */
  commitLead: number;
  /** A committed prospect flips to a school with this many times his school's interest … */
  flipMargin: number;
  /** … with this chance a week. */
  flipChance: number;
  /** Starting interest of his five top schools, as a share of his threshold. */
  topStart: [number, number, number, number, number];
  /** Prospects in the pool per open roster spot in the country. */
  poolPerSpot: number;
  /** Points count this many times for an in-state prospect (cheaper to recruit) … */
  inStateCost: number;
  /** … and this many for one from a pipeline state (pipelineMin players from there on the roster). */
  pipelineCost: number; pipelineMin: number;
  /** Most players a team signs in a class. */
  classMax: number;
  // Pitches: how much each matters, by stars (multiplied into a random draw, then scaled to add up to 1)
  pitchHome: ByStars; pitchPrestige: ByStars; pitchAcademics: ByStars; pitchContender: ByStars;
  /** Portal players care at least this much about playing time (plus chance). */
  portalPlayingTime: number;
  /** Championship Contender: the weight of last season's final poll (the rest is the roster as it stands). */
  contenderLastSeason: number;
  /** Pitching: how many of a prospect's top pitches count as his interests. */
  pitchInterests: number;
  /** A school is strong at a pitch from this score (0-1) and weak below the next. */
  pitchStrongAt: number; pitchWeakBelow: number;
  /** Points count (×) after a pitch: his interest and you're strong, middling, weak; not his interest. */
  pitchGood: number; pitchOk: number; pitchBad: number; pitchNotInterested: number;
  /** The same for his minor interests (every interest after his main one). */
  pitchMinorGood: number; pitchMinorOk: number; pitchMinorBad: number;

  // New players
  /** How far below the player he's modeled on a freshman starts (OVR points). */
  freshmanGapMin: number; freshmanGapMax: number;
  /** A walk-on with a top recruit's potential. */
  diamondChance: number; diamondPotMin: number; diamondPotMax: number;
  // Rosters (cuts never go below these)
  minQB: number; minRB: number; minWR: number; minTE: number; minOL: number; minDL: number; minLB: number; minCB: number; minS: number; minKP: number;
  // Prestige: final poll places for 6, 5, 4, 3 and 2 stars
  tier6: number; tier5: number; tier4: number; tier3: number; tier2: number;
}

export const DEFAULT_RULES: OffseasonRules = {
  proSeniorBase: 80, proSeniorScale: 14, proSeniorMax: 0.85, srPlusReturn: 0.3, proJuniorBase: 84, proJuniorScale: 12, proJuniorMax: 0.7,
  growthFR: 0.45, growthSO: 0.4, growthJR: 0.35, growthSR: 0.3, growthSRPlus: 0.25, growthMin: 0.5, growthMax: 1.5, starterBonus: 1, speedPace: 0.5, paceQuickness: 0.7, paceRange: 0.8, pacePower: 1, paceTechnique: 1.2, paceAwareness: 1.4, trainingMax: 40, trainingEffect: 0.2, weightGainPct: 0.02, weightTrainingEffect: 0.5, capAwareness: 18, capSpeed: 6, capQuickRange: 10, capOther: 14,
  transferStarter: 0.01, transferDepth: 0.08, transferBackup: 0.12, transferBlocked: 0.1, transferSenior: 0.05, playingTimeCut: 0.8, playingTimeShare: 0.5, transfersPerTeam: 4,
  weeks: 5, userPoints: 1000, cpuPoints: 1000, maxPerProspect: 60, boardSize: 35, scoutOvr: 10, scoutRatings: 20, offerExtra: 5, offerBoost: 1.2, noOffer: 0.6,
  commitThreshold: [40, 60, 100, 160, 230, 320], firstWeek: [1, 1, 2, 2, 3, 4], portalThreshold: 0.7, commitLead: 1.25, flipMargin: 1.5, flipChance: 0.5,
  topStart: [0.5, 0.45, 0.4, 0.35, 0.3], poolPerSpot: 1.4, inStateCost: 0.8, pipelineCost: 0.9, pipelineMin: 4, classMax: 25,
  pitchHome: [1.6, 1.6, 1.5, 1.3, 0.8, 0.6], pitchPrestige: [0.6, 0.6, 0.7, 0.9, 1.4, 1.7],
  pitchAcademics: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7], pitchContender: [0.4, 0.4, 0.5, 0.7, 1.1, 1.4],
  portalPlayingTime: 0.5, contenderLastSeason: 0.5,
  pitchInterests: 2, pitchStrongAt: 0.65, pitchWeakBelow: 0.4, pitchGood: 1.6, pitchOk: 1.15, pitchBad: 0.6, pitchMinorGood: 1.2, pitchMinorOk: 1.05, pitchMinorBad: 0.9, pitchNotInterested: 0.9,
  freshmanGapMin: 7, freshmanGapMax: 13, diamondChance: 0.03, diamondPotMin: 84, diamondPotMax: 96,
  minQB: 2, minRB: 4, minWR: 5, minTE: 3, minOL: 7, minDL: 5, minLB: 5, minCB: 5, minS: 4, minKP: 2,
  tier6: 10, tier5: 20, tier4: 35, tier3: 70, tier2: 100,
};

/** The rules a dynasty plays by: the defaults with its changes. */
export function rulesOf(d: Pick<Dynasty, 'rules'> | undefined): OffseasonRules {
  const own = (d?.rules ?? {}) as Partial<OffseasonRules> & { inStateBoost?: number; pipelineBoost?: number };
  const R = { ...DEFAULT_RULES, ...own };
  // Dynasties saved before 2026-11-13 had "points count ×" for in-state and pipeline prospects; the
  // same strength as a cost (1.25 → 80%).
  if (own.inStateCost === undefined && own.inStateBoost) R.inStateCost = Math.min(1, 1 / own.inStateBoost);
  if (own.pipelineCost === undefined && own.pipelineBoost) R.pipelineCost = Math.min(1, 1 / own.pipelineBoost);
  return R;
}

/** The growth rate for the class a player is leaving. */
export const growthRate = (R: OffseasonRules, cls: string) =>
  ({ FR: R.growthFR, SO: R.growthSO, JR: R.growthJR, SR: R.growthSR, 'SR+': R.growthSRPlus } as Record<string, number>)[cls] ?? 0;

// ---- the settings page: what each number is

export type RuleKind = 'pct' | 'num' | 'int';
export interface RuleField {
  key: keyof OffseasonRules;
  label: string;
  help: string;
  kind: RuleKind;
  min: number;
  max: number;
  /** For lists: a label per item. */
  items?: string[];
}
export interface RuleSection { title: string; intro: string; fields: RuleField[] }

const STARS = ['Walk-on', '1★', '2★', '3★', '4★', '5★'];

export const RULE_SECTIONS: RuleSection[] = [
  {
    title: 'Departures',
    intro: 'Who leaves after the season. SR+ players always graduate.',
    fields: [
      { key: 'proSeniorBase', label: 'Seniors: OVR where going pro starts', help: 'Seniors go pro with chance (OVR − this) ÷ the scale below.', kind: 'int', min: 50, max: 99 },
      { key: 'proSeniorScale', label: 'Seniors: OVR points per 100%', help: 'Smaller means more seniors go pro.', kind: 'num', min: 1, max: 50 },
      { key: 'proSeniorMax', label: 'Seniors: most likely to go pro', help: 'The chance never goes above this.', kind: 'pct', min: 0, max: 1 },
      { key: 'srPlusReturn', label: 'Seniors back as SR+', help: 'Chance a senior who stays in school comes back for a fifth year.', kind: 'pct', min: 0, max: 1 },
      { key: 'proJuniorBase', label: 'Juniors: OVR where going pro starts', help: 'Juniors go pro with chance (OVR − this) ÷ the scale below.', kind: 'int', min: 50, max: 99 },
      { key: 'proJuniorScale', label: 'Juniors: OVR points per 100%', help: 'Smaller means more juniors go pro.', kind: 'num', min: 1, max: 50 },
      { key: 'proJuniorMax', label: 'Juniors: most likely to go pro', help: 'The chance never goes above this.', kind: 'pct', min: 0, max: 1 },
    ],
  },
  {
    title: 'Development',
    intro: 'Each offseason a player closes a share of the gap to his hidden potential.',
    fields: [
      { key: 'growthFR', label: 'Share of the gap closed after FR', help: 'By the class he is leaving.', kind: 'pct', min: 0, max: 1 },
      { key: 'growthSO', label: 'After SO', help: '', kind: 'pct', min: 0, max: 1 },
      { key: 'growthJR', label: 'After JR', help: '', kind: 'pct', min: 0, max: 1 },
      { key: 'growthSR', label: 'After SR', help: '', kind: 'pct', min: 0, max: 1 },
      { key: 'growthSRPlus', label: 'After SR+', help: '', kind: 'pct', min: 0, max: 1 },
      { key: 'growthMin', label: 'Worst year (× the usual growth)', help: 'Each year is random between this and the next number.', kind: 'num', min: 0, max: 3 },
      { key: 'growthMax', label: 'Best year (× the usual growth)', help: '', kind: 'num', min: 0, max: 3 },
      { key: 'starterBonus', label: 'Extra OVR for Active Roster players', help: 'Playing time helps development.', kind: 'num', min: 0, max: 10 },
      { key: 'paceAwareness', label: 'Awareness grows at', help: 'How a year\'s gain is shared out: a rating at 1.4 grows twice as fast as one at 0.7. The year\'s total OVR gain stays the same.', kind: 'num', min: 0, max: 3 },
      { key: 'paceTechnique', label: 'Hands, Blocking, Tackling and Accuracy grow at', help: 'Technique.', kind: 'num', min: 0, max: 3 },
      { key: 'pacePower', label: 'Power grows at', help: 'Strength program.', kind: 'num', min: 0, max: 3 },
      { key: 'paceRange', label: 'Range grows at', help: 'QB arm, kicking range.', kind: 'num', min: 0, max: 3 },
      { key: 'paceQuickness', label: 'Quickness grows at', help: 'Also kick distance for kickers and punters.', kind: 'num', min: 0, max: 3 },
      { key: 'speedPace', label: 'Speed grows at', help: 'Speed is hard to add.', kind: 'num', min: 0, max: 3 },
      { key: 'capAwareness', label: 'Most Awareness gained in a year', help: 'Rating points (a step of the game\'s 15 is about 7). Growth past a cap goes to his other ratings; what none can take is lost. Training focus moves the caps like the paces.', kind: 'num', min: 0, max: 100 },
      { key: 'capSpeed', label: 'Most Speed gained in a year', help: '', kind: 'num', min: 0, max: 100 },
      { key: 'capQuickRange', label: 'Most Quickness or Range gained in a year', help: 'Quickness is kick distance for kickers and punters.', kind: 'num', min: 0, max: 100 },
      { key: 'capOther', label: 'Most Power, Hands, Blocking, Tackling or Accuracy gained in a year', help: '', kind: 'num', min: 0, max: 100 },
      { key: 'trainingMax', label: 'Training focus: most points in one area', help: 'Your teams split 100 points over Strength program (Power, Range, and how much weight players put on), Speed development (Speed, Quickness), Technique (Hands, Blocking, Tackling, Accuracy) and Game knowledge (Awareness); 25 each is the paces above. Computer teams use 25 each.', kind: 'int', min: 25, max: 100 },
      { key: 'trainingEffect', label: 'Training focus: effect at the most points', help: 'At the most points an area grows this much faster; at 0 points this much slower. The year\'s total OVR gain doesn\'t change.', kind: 'pct', min: 0, max: 1 },
      { key: 'weightGainPct', label: 'Most weight gained in a year', help: 'Every player but kickers and punters puts on a random share of his weight each offseason, from 0 to this (at 25 Strength program points). 2% is up to 6 lb for a 300 lb lineman and up to 4 lb for a 200 lb back.', kind: 'pct', min: 0, max: 0.2 },
      { key: 'weightTrainingEffect', label: 'Strength program: effect on weight gain', help: 'At the most Strength program points players gain this much more weight; at 0 points this much less.', kind: 'pct', min: 0, max: 1 },
    ],
  },
  {
    title: 'Transfers',
    intro: 'Who enters the transfer portal, by his role last season. Playing time makes players content.',
    fields: [
      { key: 'transferStarter', label: 'Starters', help: 'Base chance.', kind: 'pct', min: 0, max: 1 },
      { key: 'transferDepth', label: 'Depth spots (HB2, 3rd and 4th WRs, TE2, DT2, MLB2, 3rd and 4th CBs, FS2)', help: 'Base chance.', kind: 'pct', min: 0, max: 1 },
      { key: 'transferBackup', label: 'Backups', help: 'Base chance.', kind: 'pct', min: 0, max: 1 },
      { key: 'transferBlocked', label: 'Added when he isn\'t a starter on the projected depth chart', help: '', kind: 'pct', min: 0, max: 1 },
      { key: 'transferSenior', label: 'Added for seniors', help: '', kind: 'pct', min: 0, max: 1 },
      { key: 'playingTimeCut', label: 'Less with full playing time', help: '0.8 means 80% less for a player who got the ball enough.', kind: 'pct', min: 0, max: 1 },
      { key: 'playingTimeShare', label: 'Full playing time = this share of a starter\'s touches', help: 'Carries and catches, or tackles, sacks and interceptions.', kind: 'pct', min: 0.01, max: 2 },
      { key: 'transfersPerTeam', label: 'Most transfers a team takes (random classes)', help: '', kind: 'int', min: 0, max: 25 },
    ],
  },
  {
    title: 'Recruiting',
    intro: 'Five weeks of points and offers, then signing day.',
    fields: [
      { key: 'weeks', label: 'Weeks', help: '', kind: 'int', min: 1, max: 12 },
      { key: 'userPoints', label: 'Your points a week', help: '', kind: 'int', min: 0, max: 10000 },
      { key: 'cpuPoints', label: 'Computer teams\' points a week', help: '', kind: 'int', min: 0, max: 10000 },
      { key: 'maxPerProspect', label: 'Most points on one prospect a week', help: 'Before the in-state and pipeline discounts.', kind: 'int', min: 1, max: 1000 },
      { key: 'boardSize', label: 'Prospects on your board', help: '', kind: 'int', min: 1, max: 200 },
      { key: 'scoutOvr', label: 'Scouting: OVR', help: 'Points.', kind: 'int', min: 0, max: 500 },
      { key: 'scoutRatings', label: 'Scouting: all ratings (after the OVR)', help: 'Points.', kind: 'int', min: 0, max: 500 },
      { key: 'offerExtra', label: 'Offers beyond open spots', help: 'A team may have its open spots plus this many offers out at one time. Offers to prospects who have committed anywhere don\'t count.', kind: 'int', min: 0, max: 200 },
      { key: 'offerBoost', label: 'Interest with an offer (×)', help: '', kind: 'num', min: 0, max: 5 },
      { key: 'noOffer', label: 'Interest without an offer (×)', help: '', kind: 'num', min: 0, max: 5 },
      { key: 'commitThreshold', label: 'Interest needed to commit', help: 'By stars.', kind: 'int', min: 1, max: 5000, items: STARS },
      { key: 'firstWeek', label: 'First week he may commit', help: 'By stars.', kind: 'int', min: 1, max: 12, items: STARS },
      { key: 'portalThreshold', label: 'Portal players need (× the threshold)', help: 'They also decide a week sooner.', kind: 'pct', min: 0.05, max: 2 },
      { key: 'commitLead', label: 'Lead needed to commit (× the second school)', help: '', kind: 'num', min: 1, max: 5 },
      { key: 'flipMargin', label: 'A flip needs (× his school\'s interest)', help: 'Only from a school two prestige stars higher.', kind: 'num', min: 1, max: 10 },
      { key: 'flipChance', label: 'Chance a flip happens that week', help: '', kind: 'pct', min: 0, max: 1 },
      { key: 'topStart', label: 'Top schools\' starting interest (× the threshold)', help: 'His five top schools, best first.', kind: 'pct', min: 0, max: 2, items: ['1st', '2nd', '3rd', '4th', '5th'] },
      { key: 'poolPerSpot', label: 'Prospects per open roster spot', help: 'The size of the high-school pool.', kind: 'num', min: 0.5, max: 5 },
      { key: 'inStateCost', label: 'In-state prospects cost (× the points)', help: '80% means in-state prospects cost a fifth less.', kind: 'pct', min: 0.1, max: 1 },
      { key: 'pipelineCost', label: 'Prospects from pipeline states cost (× the points)', help: 'A state the roster has enough players from.', kind: 'pct', min: 0.1, max: 1 },
      { key: 'pipelineMin', label: 'Players from a state for a pipeline', help: 'Counting the current roster.', kind: 'int', min: 1, max: 30 },
      { key: 'classMax', label: 'Most signings a team makes', help: '', kind: 'int', min: 1, max: 64 },
    ],
  },
  {
    title: 'Pitches',
    intro: 'What a prospect cares about: a random draw for each pitch, multiplied by these, then scaled to add up to 100%. Playing time is 1 for everyone. His top pitches are his interests, the first his main interest and the others minor ones: pitching one gets a reaction, and the page says which kind it is. Computer teams learn them the way you do, from the reactions.',
    fields: [
      { key: 'pitchHome', label: 'Being close to home', help: '', kind: 'num', min: 0, max: 5, items: STARS },
      { key: 'pitchPrestige', label: 'Program prestige', help: '', kind: 'num', min: 0, max: 5, items: STARS },
      { key: 'pitchAcademics', label: 'Academics', help: 'College Football 27\'s academic grades.', kind: 'num', min: 0, max: 5, items: STARS },
      { key: 'pitchContender', label: 'Championship contender', help: '', kind: 'num', min: 0, max: 5, items: STARS },
      { key: 'portalPlayingTime', label: 'Portal players: playing time at least', help: 'Before scaling.', kind: 'num', min: 0, max: 5 },
      { key: 'contenderLastSeason', label: 'Contender: weight of last season\'s final poll', help: 'The rest is the roster as it stands, commitments included.', kind: 'pct', min: 0, max: 1 },
      { key: 'pitchInterests', label: 'His interests: his top … pitches', help: 'Pitching one of these gets a reaction (+, ~ or −).', kind: 'int', min: 1, max: 5 },
      { key: 'pitchStrongAt', label: 'Your school is strong at a pitch from', help: 'School scores are 0-1 (an A+ academic school is 1, F 0.1).', kind: 'pct', min: 0, max: 1 },
      { key: 'pitchWeakBelow', label: 'Your school is weak at a pitch below', help: '', kind: 'pct', min: 0, max: 1 },
      { key: 'pitchGood', label: 'Main interest: points count after a good pitch (+)', help: 'You\'re strong at it.', kind: 'num', min: 0, max: 5 },
      { key: 'pitchOk', label: 'Main interest: after a middling pitch (~)', help: 'You\'re in between.', kind: 'num', min: 0, max: 5 },
      { key: 'pitchBad', label: 'Main interest: after a bad pitch (−)', help: 'You\'re weak at it: less than no pitch.', kind: 'num', min: 0, max: 5 },
      { key: 'pitchMinorGood', label: 'Minor interest: after a good pitch (+)', help: '', kind: 'num', min: 0, max: 5 },
      { key: 'pitchMinorOk', label: 'Minor interest: after a middling pitch (~)', help: '', kind: 'num', min: 0, max: 5 },
      { key: 'pitchMinorBad', label: 'Minor interest: after a bad pitch (−)', help: '', kind: 'num', min: 0, max: 5 },
      { key: 'pitchNotInterested', label: 'After a pitch he doesn\'t care about (✗)', help: 'Below 1, a wrong guess costs something; no pitch counts 1.', kind: 'num', min: 0, max: 5 },
    ],
  },
  {
    title: 'New players',
    intro: 'Recruits are modeled on the league\'s players of their position.',
    fields: [
      { key: 'freshmanGapMin', label: 'Freshmen start this many OVR below their model (least)', help: '', kind: 'num', min: 0, max: 40 },
      { key: 'freshmanGapMax', label: '(most)', help: '', kind: 'num', min: 0, max: 40 },
      { key: 'diamondChance', label: 'Walk-ons who are diamonds in the rough', help: 'A top recruit\'s potential.', kind: 'pct', min: 0, max: 1 },
      { key: 'diamondPotMin', label: 'Their potential (lowest)', help: '', kind: 'int', min: 40, max: 99 },
      { key: 'diamondPotMax', label: 'Their potential (highest)', help: '', kind: 'int', min: 40, max: 99 },
    ],
  },
  {
    title: 'Roster minimums',
    intro: 'Cuts never go below these, and walk-ons fill a group below them.',
    fields: [
      { key: 'minQB', label: 'QBs', help: '', kind: 'int', min: 1, max: 10 },
      { key: 'minRB', label: 'HBs and FBs', help: '', kind: 'int', min: 3, max: 15 },
      { key: 'minWR', label: 'WRs', help: '', kind: 'int', min: 4, max: 15 },
      { key: 'minTE', label: 'TEs', help: '', kind: 'int', min: 2, max: 10 },
      { key: 'minOL', label: 'Offensive linemen', help: '', kind: 'int', min: 5, max: 20 },
      { key: 'minDL', label: 'Defensive linemen', help: '', kind: 'int', min: 4, max: 15 },
      { key: 'minLB', label: 'Linebackers', help: '', kind: 'int', min: 4, max: 15 },
      { key: 'minCB', label: 'CBs', help: '', kind: 'int', min: 4, max: 15 },
      { key: 'minS', label: 'Safeties', help: '', kind: 'int', min: 3, max: 10 },
      { key: 'minKP', label: 'Kickers and punters', help: '', kind: 'int', min: 1, max: 5 },
    ],
  },
  {
    title: 'Prestige',
    intro: 'After each season a school moves one star toward the tier of its final poll place.',
    fields: [
      { key: 'tier6', label: '6 stars: top', help: 'Final poll places.', kind: 'int', min: 1, max: 138 },
      { key: 'tier5', label: '5 stars: top', help: '', kind: 'int', min: 1, max: 138 },
      { key: 'tier4', label: '4 stars: top', help: '', kind: 'int', min: 1, max: 138 },
      { key: 'tier3', label: '3 stars: top', help: '', kind: 'int', min: 1, max: 138 },
      { key: 'tier2', label: '2 stars: top', help: 'The rest have 1 star.', kind: 'int', min: 1, max: 138 },
    ],
  },
];

/** Problems with a set of changed rules (empty when fine). */
export function ruleProblems(changes: Partial<OffseasonRules>): string[] {
  const out: string[] = [];
  const fields = new Map(RULE_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f]));
  for (const [k, v] of Object.entries(changes)) {
    const f = fields.get(k as keyof OffseasonRules);
    if (!f) { out.push(`Unknown rule "${k}".`); continue; }
    const vals = Array.isArray(v) ? v : [v];
    const def = DEFAULT_RULES[f.key];
    if (Array.isArray(def) && (!Array.isArray(v) || v.length !== def.length)) { out.push(`${f.label}: needs ${def.length} numbers.`); continue; }
    if (vals.some((x) => typeof x !== 'number' || !Number.isFinite(x) || x < f.min || x > f.max)) out.push(`${f.label}: between ${f.min} and ${f.max}.`);
  }
  const R = { ...DEFAULT_RULES, ...changes };
  if (R.growthMin > R.growthMax) out.push('Development: the worst year can\'t be better than the best.');
  if (R.freshmanGapMin > R.freshmanGapMax) out.push('New players: the least gap can\'t be more than the most.');
  if (R.pitchWeakBelow > R.pitchStrongAt) out.push('Pitches: weak must start below strong.');
  if (R.diamondPotMin > R.diamondPotMax) out.push('New players: the lowest potential can\'t be above the highest.');
  if (!(R.tier6 <= R.tier5 && R.tier5 <= R.tier4 && R.tier4 <= R.tier3 && R.tier3 <= R.tier2)) out.push('Prestige: each tier must reach at least as far as the one above.');
  return out;
}

/** Only the rules that differ from the defaults (what a dynasty stores). */
export function changedRules(R: Partial<OffseasonRules>): Partial<OffseasonRules> {
  const out: Partial<OffseasonRules> = {};
  for (const [k, v] of Object.entries(R) as [keyof OffseasonRules, unknown][]) {
    if (JSON.stringify(v) !== JSON.stringify(DEFAULT_RULES[k])) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ---- rules files (user: "an export offseason settings option so the user can import those settings into another dynasty")

export const RULES_FILE = { app: 'genesis-cfb-toolkit', tool: 'dynasty-rules', version: 1 } as const;

export function rulesFileText(d: Pick<Dynasty, 'rules' | 'name'>): string {
  return JSON.stringify({ ...RULES_FILE, from: d.name, rules: changedRules(d.rules ?? {}) }, null, 2);
}

export function readRulesFile(text: string): Partial<OffseasonRules> {
  let j: { app?: string; tool?: string; version?: number; rules?: Partial<OffseasonRules> };
  try { j = JSON.parse(text); } catch { throw new Error('That file isn\'t a rules file (not JSON).'); }
  if (j.app !== RULES_FILE.app || j.tool !== RULES_FILE.tool) throw new Error('That file isn\'t an offseason rules file of this app.');
  if ((j.version ?? 0) > RULES_FILE.version) throw new Error('That rules file was saved by a newer version of the app.');
  const rules = j.rules ?? {};
  const bad = ruleProblems(rules);
  if (bad.length) throw new Error(bad.join(' '));
  return changedRules(rules);
}

/** The dynasty with new rules (only the changes are stored). */
export function setRules(d: Dynasty, rules: Partial<OffseasonRules>): Dynasty {
  const bad = ruleProblems(rules);
  if (bad.length) throw new Error(bad.join(' '));
  const changed = changedRules(rules);
  return { ...d, rules: Object.keys(changed).length ? changed : undefined };
}
