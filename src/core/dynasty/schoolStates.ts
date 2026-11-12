// Each school's state (two-letter code) by the ROM's school name, for recruiting distance.
export const SCHOOL_STATE: Record<string, string> = {
  'Air Force': 'CO', Akron: 'OH', Alabama: 'AL', 'App State': 'NC', Arizona: 'AZ', 'Arizona State': 'AZ', Arkansas: 'AR',
  'Arkansas State': 'AR', Army: 'NY', Auburn: 'AL', 'Ball State': 'IN', Baylor: 'TX', 'Boise State': 'ID', 'Boston College': 'MA',
  'Bowling Green': 'OH', Buffalo: 'NY', BYU: 'UT', Cal: 'CA', 'Central Michigan': 'MI', Charlotte: 'NC', Cincinnati: 'OH',
  Clemson: 'SC', Coastal: 'SC', Colorado: 'CO', 'Colorado State': 'CO', Delaware: 'DE', Duke: 'NC', 'East Carolina': 'NC',
  'Eastern Michigan': 'MI', FIU: 'FL', Florida: 'FL', 'Florida Atlantic': 'FL', 'Florida State': 'FL', 'Fresno State': 'CA',
  Georgia: 'GA', 'Georgia Southern': 'GA', 'Georgia State': 'GA', 'Georgia Tech': 'GA', Hawaii: 'HI', Houston: 'TX', Illinois: 'IL',
  Indiana: 'IN', Iowa: 'IA', 'Iowa State': 'IA', 'James Madison': 'VA', 'Jax State': 'AL', Kansas: 'KS', 'Kansas State': 'KS',
  'Kennesaw State': 'GA', 'Kent State': 'OH', Kentucky: 'KY', Liberty: 'VA', Louisiana: 'LA', 'Louisiana Tech': 'LA',
  Louisville: 'KY', LSU: 'LA', Marshall: 'WV', Maryland: 'MD', Memphis: 'TN', Miami: 'FL', 'Miami of Ohio': 'OH', Michigan: 'MI',
  'Michigan State': 'MI', 'Middle Tennessee': 'TN', Minnesota: 'MN', 'Mississippi St.': 'MS', Missouri: 'MO', 'Missouri State': 'MO',
  Navy: 'MD', 'NC State': 'NC', Nebraska: 'NE', Nevada: 'NV', 'New Mexico': 'NM', 'New Mexico State': 'NM', NIU: 'IL',
  'North Carolina': 'NC', 'North Dakota St.': 'ND', 'North Texas': 'TX', Northwestern: 'IL', 'Notre Dame': 'IN', Ohio: 'OH',
  'Ohio State': 'OH', Oklahoma: 'OK', 'Oklahoma State': 'OK', 'Old Dominion': 'VA', 'Ole Miss': 'MS', Oregon: 'OR',
  'Oregon State': 'OR', 'Penn State': 'PA', Pitt: 'PA', Purdue: 'IN', Rice: 'TX', Rutgers: 'NJ', 'Sacramento State': 'CA',
  'Sam Houston': 'TX', 'San Diego State': 'CA', 'San Jose State': 'CA', SMU: 'TX', 'South Alabama': 'AL', 'South Carolina': 'SC',
  'South Florida': 'FL', 'Southern Miss': 'MS', Stanford: 'CA', Syracuse: 'NY', TCU: 'TX', Temple: 'PA', Tennessee: 'TN',
  Texas: 'TX', 'Texas A&M': 'TX', 'Texas State': 'TX', 'Texas Tech': 'TX', Toledo: 'OH', Troy: 'AL', Tulane: 'LA', Tulsa: 'OK',
  UAB: 'AL', UCF: 'FL', UCLA: 'CA', 'UL Monroe': 'LA', UConn: 'CT', UMass: 'MA', UNLV: 'NV', USC: 'CA', Utah: 'UT',
  'Utah State': 'UT', UTEP: 'TX', UTSA: 'TX', Vanderbilt: 'TN', Virginia: 'VA', 'Virginia Tech': 'VA', 'Wake Forest': 'NC',
  Washington: 'WA', 'Washington State': 'WA', 'West Virginia': 'WV', 'Western Kentucky': 'KY', 'Western Michigan': 'MI',
  Wisconsin: 'WI', Wyoming: 'WY',
};

/** US regions for "close to home" (a recruit's state and the school's). */
const REGION: Record<string, string> = Object.fromEntries(Object.entries({
  Northeast: 'ME NH VT MA RI CT NY NJ PA DE MD DC',
  Southeast: 'VA WV NC SC GA FL AL MS TN KY',
  Midwest: 'OH MI IN IL WI MN IA MO ND SD NE KS',
  South: 'TX OK AR LA',
  Mountain: 'CO UT WY MT ID NV AZ NM',
  Pacific: 'CA OR WA AK HI',
}).flatMap(([r, states]) => states.split(' ').map((s) => [s, r])));

/** CFB 27 writes full state names; the codes for them. */
const CODES: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
  Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};
export const stateCode = (s: string) => CODES[s.trim()] ?? (s.trim().length === 2 ? s.trim().toUpperCase() : '');

/** How close to home a school is for a player from a state: 1 same state, 0.6 same region, 0.25 farther. */
export function closeness(playerState: string, school: string): number {
  const a = stateCode(playerState), b = SCHOOL_STATE[school];
  if (!a || !b) return 0.25;
  if (a === b) return 1;
  return REGION[a] && REGION[a] === REGION[b] ? 0.6 : 0.25;
}
