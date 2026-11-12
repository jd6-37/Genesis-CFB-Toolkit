// Academic Prestige per school (user, 2026-11-12: "We might want to add academics data now (See if you can
// find what CFB27 uses)"): College Football 27's dynasty grade for each of the 138 schools, read from a
// public CFB 27 team grades table on 2026-11-12. A recruit who cares about academics favors high grades.

export const CFB27_ACADEMICS: Record<string, string> = {
  'Air Force': 'A', Akron: 'F', Alabama: 'D+', 'App State': 'D', Arizona: 'C', 'Arizona State': 'C', Arkansas: 'D+',
  'Arkansas State': 'F', Army: 'A+', Auburn: 'C+', BYU: 'C', 'Ball State': 'D', Baylor: 'C+', 'Boise State': 'D-',
  'Boston College': 'B+', 'Bowling Green': 'D-', Buffalo: 'B-', Cal: 'A', 'Central Michigan': 'D-', Charlotte: 'D+',
  Cincinnati: 'D+', Clemson: 'B-', Coastal: 'F', Colorado: 'C+', 'Colorado State': 'C-', Delaware: 'B-', Duke: 'A+',
  'East Carolina': 'D+', 'Eastern Michigan': 'F', FIU: 'C+', Florida: 'B+', 'Florida Atlantic': 'D',
  'Florida State': 'B', 'Fresno State': 'D+', Georgia: 'B+', 'Georgia Southern': 'F', 'Georgia State': 'D',
  'Georgia Tech': 'B+', Hawaii: 'D+', Houston: 'C-', Illinois: 'B+', Indiana: 'B-', Iowa: 'C+', 'Iowa State': 'C',
  'James Madison': 'C-', 'Jax State': 'F', Kansas: 'C-', 'Kansas State': 'D+', 'Kennesaw State': 'F',
  'Kent State': 'D', Kentucky: 'C-', LSU: 'D+', Liberty: 'F', Louisiana: 'F', 'Louisiana Tech': 'D-',
  Louisville: 'D+', Marshall: 'F', Maryland: 'B+', Memphis: 'D-', Miami: 'B-', 'Miami of Ohio': 'C-', Michigan: 'A-',
  'Michigan State': 'B-', 'Middle Tennessee': 'D-', Minnesota: 'B', 'Mississippi St.': 'D', Missouri: 'C',
  'Missouri State': 'F', 'NC State': 'B', NIU: 'D-', Navy: 'A+', Nebraska: 'C-', Nevada: 'D', 'New Mexico': 'D',
  'New Mexico State': 'D-', 'North Carolina': 'A-', 'North Dakota St.': 'C', 'North Texas': 'D', Northwestern: 'A+',
  'Notre Dame': 'A', Ohio: 'D+', 'Ohio State': 'B+', Oklahoma: 'C', 'Oklahoma State': 'D', 'Old Dominion': 'D-',
  'Ole Miss': 'D+', Oregon: 'C+', 'Oregon State': 'C-', 'Penn State': 'B', Pitt: 'B-', Purdue: 'B', Rice: 'A',
  Rutgers: 'B+', SMU: 'C+', 'Sacramento State': 'C', 'Sam Houston': 'D', 'San Diego State': 'C',
  'San Jose State': 'D+', 'South Alabama': 'F', 'South Carolina': 'C', 'South Florida': 'B-', 'Southern Miss': 'F',
  Stanford: 'A+', Syracuse: 'B-', TCU: 'C+', Temple: 'C+', Tennessee: 'C', Texas: 'B+', 'Texas A&M': 'B',
  'Texas State': 'D-', 'Texas Tech': 'D', Toledo: 'D-', Troy: 'F', Tulane: 'B-', Tulsa: 'D+', UAB: 'C-', UCF: 'C',
  UCLA: 'A', UConn: 'B-', 'UL Monroe': 'F', UMass: 'B', UNLV: 'D-', USC: 'A-', UTEP: 'D-', UTSA: 'D', Utah: 'C-',
  'Utah State': 'D-', Vanderbilt: 'A', Virginia: 'A-', 'Virginia Tech': 'B', 'Wake Forest': 'B', Washington: 'B',
  'Washington State': 'D+', 'West Virginia': 'D', 'Western Kentucky': 'F', 'Western Michigan': 'D-', Wisconsin: 'B+',
  Wyoming: 'D',
};

const GRADE_VALUE: Record<string, number> = {
  'A+': 1, A: 0.93, 'A-': 0.86, 'B+': 0.79, B: 0.72, 'B-': 0.65, 'C+': 0.58, C: 0.51, 'C-': 0.44,
  'D+': 0.37, D: 0.3, 'D-': 0.23, F: 0.1,
};

/** A school's academics, 0-1 (A+ = 1, F = 0.1; unknown = C). */
export const academicsOf = (school: string) => GRADE_VALUE[CFB27_ACADEMICS[school] ?? 'C'];
/** Its letter grade (or "C" when unknown). */
export const academicGrade = (school: string) => CFB27_ACADEMICS[school] ?? 'C';

/** A 0-1 score as a letter grade on the same scale (the highest grade it reaches). */
export function gradeOf(score: number): string {
  const order = Object.entries(GRADE_VALUE).sort((a, b) => b[1] - a[1]);
  return order.find(([, v]) => score >= v - 0.035)?.[0] ?? 'F';
}
