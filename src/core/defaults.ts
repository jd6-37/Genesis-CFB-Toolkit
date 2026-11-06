// Default text and color choices for CF97 teams. CF97 stores each team's stadium, not its
// city, so the city BW95 shows ("Welcome to ...") comes from this table. Everything here is
// only a starting value; the user can edit all of it.

export const CITY: Record<string, string> = {
  'Air Force': 'Colorado Springs', Akron: 'Akron', Alabama: 'Tuscaloosa', UAB: 'Birmingham',
  Arizona: 'Tucson', 'Arizona State': 'Tempe', Arkansas: 'Fayetteville', 'Arkansas State': 'Jonesboro',
  USMA: 'West Point', Auburn: 'Auburn', 'Ball State': 'Muncie', Baylor: 'Waco', 'Boise State': 'Boise',
  'Boston College': 'Chestnut Hill', 'Bowling Green': 'Bowling Green', 'Brigham Young': 'Provo',
  California: 'Berkeley', 'Central Florida': 'Orlando', CMU: 'Mt. Pleasant', Cincinnati: 'Cincinnati',
  Clemson: 'Clemson', Colorado: 'Boulder', 'Colorado State': 'Fort Collins', Duke: 'Durham',
  'East Carolina': 'Greenville', EMU: 'Ypsilanti', Florida: 'Gainesville', 'Florida State': 'Tallahassee',
  'Fresno State': 'Fresno', Georgia: 'Athens', 'Georgia Tech': 'Atlanta', Hawaii: 'Honolulu',
  Houston: 'Houston', Idaho: 'Moscow', Illinois: 'Champaign', Indiana: 'Bloomington', Iowa: 'Iowa City',
  'Iowa State': 'Ames', Kansas: 'Lawrence', 'Kansas State': 'Manhattan', Kent: 'Kent', Kentucky: 'Lexington',
  'Louisiana Tech': 'Ruston', Louisville: 'Louisville', LSU: 'Baton Rouge', Maryland: 'College Park',
  Memphis: 'Memphis', Miami: 'Miami', 'Miami of Ohio': 'Oxford', Michigan: 'Ann Arbor',
  'Michigan State': 'East Lansing', Minnesota: 'Minneapolis', 'Ole Miss': 'Oxford',
  'Mississippi St.': 'Starkville', Missouri: 'Columbia', Navy: 'Annapolis', Nebraska: 'Lincoln',
  Nevada: 'Reno', 'New Mexico': 'Albuquerque', 'New Mexico St.': 'Las Cruces', NIU: 'DeKalb',
  'North Carolina': 'Chapel Hill', 'N.C. State': 'Raleigh', 'North Texas': 'Denton',
  'Northeast LA.': 'Monroe', Northwestern: 'Evanston', 'Notre Dame': 'Notre Dame, IN', Ohio: 'Athens',
  'Ohio State': 'Columbus', Oklahoma: 'Norman', 'Oklahoma State': 'Stillwater', Oregon: 'Eugene',
  'Oregon State': 'Corvallis', 'Penn State': 'University Park', Pitt: 'Pittsburgh', Purdue: 'West Lafayette',
  Rice: 'Houston', Rutgers: 'New Brunswick', 'San Diego State': 'San Diego', 'San Jose State': 'San Jose',
  SMU: 'Dallas', 'South Carolina': 'Columbia', 'Southern Miss': 'Hattiesburg', Stanford: 'Palo Alto',
  Syracuse: 'Syracuse', TCU: 'Fort Worth', Temple: 'Philadelphia', Tennessee: 'Knoxville', Texas: 'Austin',
  'Texas A&M': 'College Station', 'Texas Tech': 'Lubbock', Toledo: 'Toledo', Tulane: 'New Orleans',
  Tulsa: 'Tulsa', UCLA: 'Los Angeles', UNLV: 'Las Vegas', USC: 'Los Angeles', USL: 'Lafayette',
  Utah: 'Salt Lake City', 'Utah State': 'Logan', UTEP: 'El Paso', Vanderbilt: 'Nashville',
  Virginia: 'Charlottesville', 'Virginia Tech': 'Blacksburg', 'Wake Forest': 'Winston-Salem',
  Washington: 'Seattle', 'Washington St.': 'Pullman', 'West Virginia': 'Morgantown', Wisconsin: 'Madison',
  WMU: 'Kalamazoo', Wyoming: 'Laramie',
};

/** CF97 nickname entries that are placeholders or cut short. */
export const NICKNAME_FIX: Record<string, string> = {
  'North Texas': 'Mean Green',
  'West Virginia': 'Mountaineers',
};

/** Longest strings among BW95's own teams; longer names may not fit on its screens. */
export const MAX_LEN = { school: 16, city: 15, nickname: 15 };

/** Uniform corrections: CF96/97 show Tulane in blue; these are the greens picked for the
 *  private Tulane build. Indices are BW95 uniform slots. */
export const UNIFORM_FIX: Record<string, { home: Record<number, number>; away: Record<number, number>; endZone?: number }> = {
  Tulane: {
    home: { 3: 0x0220, 5: 0x0eee, 6: 0x0ccc, 7: 0x0c82, 9: 0x0eee, 10: 0x0460, 11: 0x0240, 12: 0x0220, 13: 0x0eee, 14: 0x0aaa, 15: 0x0666 },
    away: { 3: 0x0220, 5: 0x0eee, 6: 0x0ccc, 7: 0x0c82, 9: 0x0240, 10: 0x0eee, 11: 0x0ccc, 12: 0x0888, 13: 0x0eee, 14: 0x0aaa, 15: 0x0666 },
    endZone: 0x0460,
  },
};

/** Other names the BW95 Walsh Report text uses for some teams. */
export const WALSH_ALIASES: Record<string, string[]> = {
  California: ['Cal'],
  'Florida State': ['FSU'],
};

export const NAME_CHARS = /^[A-Za-z0-9 .,&'-]*$/;
