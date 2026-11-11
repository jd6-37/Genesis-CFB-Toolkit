// College Football 27 team schemes, for the Teams tab's reference table: each FBS team's offensive
// style and its default defensive playbook (as of November 2026), and the Bill Walsh '95 styles
// recommended for them. No ROM data. Mapping and name matching: docs/styles.md.
import { DEFENSE, OFFENSE, type TeamStyle } from './styles';

/** [school, conference, CFB 27 offense style, CFB 27 defensive playbook] */
export const CFB27_TEAMS: readonly (readonly [string, string, string, string])[] = [
  ['Air Force', 'Mountain West', 'Option', '3-4 Zone'],
  ['Akron', 'MAC', 'Spread', 'Multiple'],
  ['Alabama', 'SEC', 'Multiple', '3-4 Zone'],
  ['Appalachian State', 'Sun Belt', 'Spread', '4-2-5 Man'],
  ['Arizona', 'Big 12', 'Multiple', '3-3-5 Man'],
  ['Arizona State', 'Big 12', 'Multiple', '4-2-5 Zone Pressure'],
  ['Arkansas', 'SEC', 'Spread', '3-3-5 Zone Pressure'],
  ['Arkansas State', 'Sun Belt', 'Power Spread', '4-2-5'],
  ['Army', 'American', 'Option', 'Multiple'],
  ['Auburn', 'SEC', 'Veer & Shoot', '3-3-5 Tite'],
  ['Ball State', 'MAC', 'Spread', 'Multiple'],
  ['Baylor', 'Big 12', 'Air Raid', '3-3-5 Shell'],
  ['Boise State', 'PAC 12', 'Multiple', '4-2-5 Man'],
  ['Boston College', 'ACC', 'Multiple', '4-3'],
  ['Bowling Green', 'MAC', 'Spread', '4-2-5 Man'],
  ['Buffalo', 'MAC', 'Spread', '4-2-5 Man Pressure'],
  ['BYU', 'Big 12', 'Power Spread', '4-3 Man Pressure'],
  ['California', 'ACC', 'Multiple', '3-4 Multiple'],
  ['Central Michigan', 'MAC', 'Spread Option', '3-4 Zone'],
  ['Charlotte', 'American', 'Spread', '4-2-5 Zone'],
  ['Cincinnati', 'Big 12', 'Pistol', 'Multiple'],
  ['Clemson', 'ACC', 'Power Spread', 'Multiple'],
  ['Coastal Carolina', 'Sun Belt', 'Spread', '4-2-5 Shell'],
  ['Colorado', 'Big 12', 'Power Spread', '4-2-5 Man Pressure'],
  ['Colorado State', 'PAC 12', 'Spread', '3-3-5 Tite'],
  ['Delaware', 'C-USA', 'Spread', '3-3-5 Three High'],
  ['Duke', 'ACC', 'Veer & Shoot', '4-2-5 Man'],
  ['East Carolina', 'American', 'Air Raid', '3-3-5 Three High'],
  ['Eastern Michigan', 'MAC', 'Spread', '4-3 Man'],
  ['Florida', 'SEC', 'Power Spread', '3-4 Multiple'],
  ['Florida Atlantic', 'American', 'Air Raid', '3-3-5 Tite'],
  ['Florida International', 'C-USA', 'Power Spread', 'Multiple'],
  ['Florida State', 'ACC', 'Spread', '3-3-5 Zone'],
  ['Fresno State', 'PAC 12', 'Spread', '4-2-5 Zone'],
  ['Georgia', 'SEC', 'Multiple', '3-3-5 Tite'],
  ['Georgia Southern', 'Sun Belt', 'Spread', '3-4'],
  ['Georgia State', 'Sun Belt', 'Spread', '3-3-5'],
  ['Georgia Tech', 'ACC', 'Power Spread', '3-3-5 Zone Pressure'],
  ['Hawaii', 'Mountain West', 'Run & Shoot', '3-4 Man Pressure'],
  ['Houston', 'Big 12', 'Power Spread', '3-3-5 Zone Pressure'],
  ['Illinois', 'Big Ten', 'Multiple', '3-4 Man'],
  ['Indiana', 'Big Ten', 'Power Spread', '4-3 Zone Pressure'],
  ['Iowa', 'Big Ten', 'Pro Style', '4-3 Shell'],
  ['Iowa State', 'Big 12', 'Multiple', '4-2-5 Zone'],
  ['Jacksonville State', 'C-USA', 'Spread', '3-3-5 Zone Pressure'],
  ['James Madison', 'Sun Belt', 'Pistol', '3-3-5 Zone Pressure'],
  ['Kansas', 'Big 12', 'Spread Option', '3-4 Zone'],
  ['Kansas State', 'Big 12', 'Multiple', '4-2-5 Zone Pressure'],
  ['Kennesaw State', 'C-USA', 'Veer & Shoot', '3-3-5 Shell'],
  ['Kent State', 'MAC', 'Spread', 'Multiple'],
  ['Kentucky', 'SEC', 'Spread', '4-2-5 Zone Pressure'],
  ['Liberty', 'C-USA', 'Spread Option', '3-4 Zone'],
  ['Louisiana', 'Sun Belt', 'Power Spread', '4-3'],
  ['Louisiana Tech', 'Sun Belt', 'Air Raid', '3-3-5 Man Pressure'],
  ['Louisville', 'ACC', 'Multiple', '4-2-5 Zone'],
  ['LSU', 'SEC', 'Veer & Shoot', 'Multiple'],
  ['Marshall', 'Sun Belt', 'Power Spread', '3-3-5'],
  ['Maryland', 'Big Ten', 'Spread', '3-4 Man Pressure'],
  ['Memphis', 'American', 'Veer & Shoot', '4-2-5 Man Pressure'],
  ['Miami FL', 'ACC', 'Air Raid', '4-2-5 Zone Pressure'],
  ['Miami OH', 'MAC', 'Spread', '4-3 Zone'],
  ['Michigan', 'Big Ten', 'Power Spread', '4-3 Man Pressure'],
  ['Michigan State', 'Big Ten', 'Multiple', '4-2-5 Zone Pressure'],
  ['Middle Tennessee', 'C-USA', 'Spread', '3-4 Man'],
  ['Minnesota', 'Big Ten', 'Multiple', '4-2-5 Man Pressure'],
  ['Mississippi State', 'SEC', 'Veer & Shoot', '3-3-5'],
  ['Missouri', 'SEC', 'Power Spread', '4-2-5 Zone'],
  ['Missouri State', 'C-USA', 'Spread', '3-3-5 Tite'],
  ['Navy', 'American', 'Option', '3-3-5 Zone Pressure'],
  ['NC State', 'ACC', 'Power Spread', '3-4 Shell'],
  ['Nebraska', 'Big Ten', 'Multiple', '4-2-5 Man Pressure'],
  ['Nevada', 'Mountain West', 'Spread', 'Multiple'],
  ['New Mexico', 'Mountain West', 'Multiple', '4-3 Zone'],
  ['New Mexico State', 'C-USA', 'Power Spread', '3-3-5 Shell'],
  ['North Carolina', 'ACC', 'Spread', '3-4 Multiple'],
  ['North Dakota State', 'Mountain West', 'Multiple', '4-3'],
  ['North Texas', 'American', 'Spread', '3-3-5 Shell'],
  ['Northern Illinois', 'Mountain West', 'Spread', '4-2-5 Shell'],
  ['Northwestern', 'Big Ten', 'Spread', '4-2-5 Shell'],
  ['Notre Dame', 'Independent', 'Power Spread', 'Multiple'],
  ['Ohio', 'MAC', 'Pistol', '4-2-5 Zone Pressure'],
  ['Ohio State', 'Big Ten', 'Multiple', '4-2-5 Man Pressure'],
  ['Oklahoma', 'SEC', 'Spread', '4-2-5 Man Pressure'],
  ['Oklahoma State', 'Big 12', 'Air Raid', 'Multiple'],
  ['Old Dominion', 'Sun Belt', 'Veer & Shoot', '3-2-6'],
  ['Ole Miss', 'SEC', 'Veer & Shoot', '4-2-5'],
  ['Oregon', 'Big Ten', 'Spread', '3-4 Shell'],
  ['Oregon State', 'PAC 12', 'Multiple', '3-4 Zone'],
  ['Penn State', 'Big Ten', 'Power Spread', '3-4 Man'],
  ['Pittsburgh', 'ACC', 'Spread', '4-3 Press Quarters'],
  ['Purdue', 'Big Ten', 'Air Raid', 'Multiple'],
  ['Rice', 'American', 'Spread Option', '3-4 Man Pressure'],
  ['Rutgers', 'Big Ten', 'Spread', '4-2-5 Shell'],
  ['Sacramento State', 'MAC', 'Spread', '4-2-5 Zone'],
  ['Sam Houston', 'C-USA', 'Air Raid', '3-3-5 Man'],
  ['San Diego State', 'PAC 12', 'Spread', '4-2-5 Man'],
  ['San Jose State', 'Mountain West', 'Run & Shoot', '4-3 Multiple'],
  ['SMU', 'ACC', 'Spread', '4-2-5 Man Pressure'],
  ['South Alabama', 'Sun Belt', 'Spread', '4-2-5 Zone Pressure'],
  ['South Carolina', 'SEC', 'Air Raid', '4-2-5 Man'],
  ['Southern Miss', 'Sun Belt', 'Power Spread', '3-3-5 Zone Pressure'],
  ['Stanford', 'ACC', 'Power Spread', '4-3 Zone'],
  ['Syracuse', 'ACC', 'Spread', '4-2-5'],
  ['TCU', 'Big 12', 'Spread', '3-3-5 Zone'],
  ['Temple', 'American', 'Spread', '3-4 Zone'],
  ['Tennessee', 'SEC', 'Veer & Shoot', '4-2-5 Shell'],
  ['Texas', 'SEC', 'Spread', '3-3-5 Tite'],
  ['Texas A&M', 'SEC', 'Power Spread', '4-2-5 Zone Pressure'],
  ['Texas State', 'PAC 12', 'Veer & Shoot', 'Multiple'],
  ['Texas Tech', 'Big 12', 'Veer & Shoot', '3-4 Shell'],
  ['Toledo', 'MAC', 'Spread', '4-2-5 Shell'],
  ['Troy', 'Sun Belt', 'Veer & Shoot', '3-3-5 Three High'],
  ['Tulane', 'American', 'Power Spread', '3-3-5 Tite'],
  ['Tulsa', 'American', 'Spread', '3-3-5 Shell'],
  ['UAB', 'American', 'Power Spread', '3-4 Man Pressure'],
  ['UCF', 'Big 12', 'Spread', '4-3 Multiple'],
  ['UCLA', 'Big Ten', 'Spread', '4-2-5 Man Pressure'],
  ['UConn', 'Independent', 'Spread', '4-3 Press Quarters'],
  ['UL Monroe', 'Sun Belt', 'Spread', '3-3-5 Three High'],
  ['UMass', 'MAC', 'Spread', '4-2-5 Man'],
  ['UNLV', 'Mountain West', 'Spread', '4-2-5 Man Pressure'],
  ['USC', 'Big Ten', 'Air Raid', '4-2-5 Shell'],
  ['USF', 'American', 'Spread', '3-3-5 Tite'],
  ['Utah', 'Big 12', 'Spread', '4-3 Man Pressure'],
  ['Utah State', 'PAC 12', 'Power Spread', 'Multiple'],
  ['UTEP', 'Mountain West', 'Spread', '3-3-5 Three High'],
  ['UTSA', 'American', 'Spread', 'Multiple'],
  ['Vanderbilt', 'SEC', 'Pistol', '4-2-5 Zone Pressure'],
  ['Virginia', 'ACC', 'Power Spread', '4-2-5'],
  ['Virginia Tech', 'ACC', 'Power Spread', 'Multiple'],
  ['Wake Forest', 'ACC', 'Spread', '4-2-5 Zone Pressure'],
  ['Washington', 'Big Ten', 'Multiple', '3-4 Man Pressure'],
  ['Washington State', 'PAC 12', 'Multiple', 'Multiple'],
  ['West Virginia', 'Big 12', 'Spread Option', '3-3-5'],
  ['Western Kentucky', 'C-USA', 'Air Raid', '3-3-5 Zone Pressure'],
  ['Western Michigan', 'MAC', 'Spread', '4-2-5 Zone Pressure'],
  ['Wisconsin', 'Big Ten', 'Power Spread', '4-3 Multiple'],
  ['Wyoming', 'Mountain West', 'Multiple', '4-2-5 Man'],
];

/** CFB 27 offense style → BW95 offense. BW95 has no true spread offense: its Shotgun style is the
 *  closest to the spread and pass-first styles, Multiple (Pro Style plus Shotgun and Trap runs) to the
 *  shotgun power-run styles, Pro Style to CFB 27's balanced Multiple offenses. Only the service
 *  academies run Option. */
export const OFFENSE_FOR: Record<string, (typeof OFFENSE)[number]> = {
  Option: 'Option',
  'Pro Style': 'Pro Style',
  Multiple: 'Pro Style',
  'Power Spread': 'Multiple',
  'Spread Option': 'Multiple',
  Spread: 'Shotgun',
  'Air Raid': 'Shotgun',
  'Run & Shoot': 'Shotgun',
  'Veer & Shoot': 'Shotgun',
  Pistol: 'Power',
};

/** CFB 27 defensive playbook → BW95 defense, by its number of down linemen: three (3-4, 3-3-5,
 *  3-2-6) → 3-4, four (4-3, 4-2-5) → 4-3; the Multiple playbook → Multiple. */
export function defenseFor(playbook: string): (typeof DEFENSE)[number] {
  if (playbook === 'Multiple') return 'Multiple';
  if (playbook.startsWith('3-')) return '3-4';
  if (playbook.startsWith('4-')) return '4-3';
  throw new Error(`unknown CFB 27 defensive playbook "${playbook}"`);
}

export interface Cfb27Team {
  school: string;
  conference: string;
  offense: string;
  defense: string;
  /** Recommended BW95 styles (indexes in OFFENSE / DEFENSE). */
  recommended: TeamStyle;
}

export const CFB27: readonly Cfb27Team[] = CFB27_TEAMS.map(([school, conference, offense, defense]) => {
  const o = OFFENSE_FOR[offense];
  if (!o) throw new Error(`unknown CFB 27 offense style "${offense}"`);
  return {
    school,
    conference,
    offense,
    defense,
    recommended: { offense: OFFENSE.indexOf(o), defense: DEFENSE.indexOf(defenseFor(defense)) },
  };
});

/** School names in Bill Walsh '95 and College Football USA 97 that CFB 27 spells differently. */
const ALIASES: Record<string, string> = {
  usma: 'Army',
  'brigham young': 'BYU',
  'central florida': 'UCF',
  cmu: 'Central Michigan',
  emu: 'Eastern Michigan',
  kent: 'Kent State',
  miami: 'Miami FL',
  'miami of ohio': 'Miami OH',
  'mississippi st': 'Mississippi State',
  'new mexico st': 'New Mexico State',
  niu: 'Northern Illinois',
  'nc state': 'NC State',
  'northeast la': 'UL Monroe',
  pitt: 'Pittsburgh',
  usl: 'Louisiana',
  'washington st': 'Washington State',
  wmu: 'Western Michigan',
  cal: 'California',
  // The 138-team 2026 Season Edition's names.
  'south florida': 'USF',
  'app state': 'Appalachian State',
  coastal: 'Coastal Carolina',
  fiu: 'Florida International',
  'jax state': 'Jacksonville State',
  'north dakota st': 'North Dakota State',
};

const key = (s: string) => s.toLowerCase().replace(/[.']/g, '').replace(/\s+/g, ' ').trim();
const BY_KEY = new Map(CFB27.map((t) => [key(t.school), t]));

/** The CFB 27 team for a school name as a BW95 ROM has it (original, CF97 or edited), if any. */
export function findCfb27(school: string): Cfb27Team | undefined {
  const k = key(school);
  return BY_KEY.get(k) ?? (ALIASES[k] ? BY_KEY.get(key(ALIASES[k])) : undefined);
}
