// Rivalry trophies (user, 2026-11-27: "rivalry trophies on team page too. Show IRL and dynasty history, like we do
// with coaches' W-L records"). The trophy games among the dynasty's schools, with the real series up to the 2025
// season: the 2026 edition's dynasty starts in 2026, so nothing past 2025 (no spoilers). Researched 2026-11-27 from
// Wikipedia (the rivalry articles and "List of most-played college football series in NCAA Division I"), with the
// 2015-2026 results from the CollegeFootballData API (github.com/matthewrichey3317/cfb-data) for the last meetings
// and to take any 2026 game back out of a record. The 1994 edition has no real history yet (it would need the
// series up to 1993).
//
// `art` picks the app's pixel art (public/media/trophies/<art>.png); the user can replace any trophy's picture
// (Manage → Trophy art).

export interface RivalryTrophy {
  /** The schools, as the dynasty names them (the ROM's names). */
  a: string;
  b: string;
  trophy: string;
  /** The game's name. */
  game: string;
  art: string;
  /** First meeting. */
  first: number;
  /** First played for the trophy, when known: in a dynasty that starts earlier the trophy waits for that year. */
  since: number | null;
  /** The real series up to the 2025 season: the leader (null = tied), W-L(-T) from the leader's side, the holder
   * after the last meeting, and that meeting ("2025 Texas 23-6"). */
  real: { lead: string | null; rec: string; holder: string | null; last: string | null };
}

export const TROPHIES: RivalryTrophy[] = [
  { a: "Texas", b: "Oklahoma", trophy: "Golden Hat", game: "Red River Rivalry", art: 'hat', first: 1900, since: 1941, real: { lead: "Texas", rec: '65-51-5', holder: "Texas", last: "2025 Texas 23-6" } },
  { a: "Ole Miss", b: "Mississippi St.", trophy: "Golden Egg", game: "Egg Bowl", art: 'egg', first: 1901, since: 1927, real: { lead: "Ole Miss", rec: '67-46-6', holder: "Ole Miss", last: "2025 Ole Miss 38-19" } },
  { a: "Washington", b: "Washington State", trophy: "Apple Cup", game: "Apple Cup", art: 'cup', first: 1900, since: 1962, real: { lead: "Washington", rec: '77-34-6', holder: "Washington", last: "2025 Washington 59-24" } },
  { a: "Oklahoma", b: "Oklahoma State", trophy: "Bedlam Bell", game: "Bedlam", art: 'bell', first: 1904, since: null, real: { lead: "Oklahoma", rec: '91-20-7', holder: "Oklahoma State", last: "2023 Oklahoma State 27-24" } },
  { a: "Indiana", b: "Purdue", trophy: "Old Oaken Bucket", game: "Old Oaken Bucket game", art: 'bucket', first: 1891, since: 1925, real: { lead: "Purdue", rec: '77-44-6', holder: "Indiana", last: "2025 Indiana 56-3" } },
  { a: "Minnesota", b: "Wisconsin", trophy: "Paul Bunyan's Axe", game: "Paul Bunyan's Axe game", art: 'axe', first: 1890, since: 1948, real: { lead: "Minnesota", rec: '64-63-8', holder: "Minnesota", last: "2025 Minnesota 17-7" } },
  { a: "Arizona", b: "Arizona State", trophy: "Territorial Cup", game: "Duel in the Desert", art: 'cup', first: 1899, since: 2001, real: { lead: "Arizona", rec: '52-45-1', holder: "Arizona", last: "2025 Arizona 23-7" } },
  { a: "Cal", b: "Stanford", trophy: "Stanford Axe", game: "Big Game", art: 'axe', first: 1892, since: 1933, real: { lead: "Stanford", rec: '66-51-11', holder: "Stanford", last: "2025 Stanford 31-10" } },
  { a: "USC", b: "UCLA", trophy: "Victory Bell", game: "Victory Bell game", art: 'bell', first: 1929, since: 1942, real: { lead: "USC", rec: '52-34-7', holder: "USC", last: "2025 USC 29-10" } },
  { a: "Georgia", b: "Georgia Tech", trophy: "Governor's Cup", game: "Clean, Old-Fashioned Hate", art: 'cup', first: 1893, since: null, real: { lead: "Georgia", rec: '73-41-5', holder: "Georgia", last: "2025 Georgia 16-9" } },
  { a: "Clemson", b: "South Carolina", trophy: "Palmetto Trophy", game: "Palmetto Bowl", art: 'cup', first: 1896, since: null, real: { lead: "Clemson", rec: '74-44-4', holder: "Clemson", last: "2025 Clemson 28-14" } },
  { a: "Virginia", b: "Virginia Tech", trophy: "Commonwealth Cup", game: "Commonwealth Clash", art: 'cup', first: 1895, since: null, real: { lead: "Virginia Tech", rec: '62-39-5', holder: "Virginia", last: "2025 Virginia 27-7" } },
  { a: "Kentucky", b: "Louisville", trophy: "Governor's Cup", game: "Governor's Cup", art: 'cup', first: 1912, since: 1994, real: { lead: "Kentucky", rec: '19-17', holder: "Louisville", last: "2025 Louisville 41-0" } },
  { a: "Florida", b: "Georgia", trophy: "Okefenokee Oar", game: "Florida-Georgia game", art: 'oar', first: 1915, since: null, real: { lead: "Georgia", rec: '57-44-2', holder: "Georgia", last: "2025 Georgia 24-20" } },
  { a: "Michigan", b: "Michigan State", trophy: "Paul Bunyan Trophy", game: "Paul Bunyan Trophy game", art: 'cup', first: 1898, since: 1953, real: { lead: "Michigan", rec: '75-38-5', holder: "Michigan", last: "2025 Michigan 31-20" } },
  { a: "Notre Dame", b: "USC", trophy: "Jeweled Shillelagh", game: "Notre Dame-USC game", art: 'shillelagh', first: 1926, since: 1952, real: { lead: "Notre Dame", rec: '51-37-5', holder: "Notre Dame", last: "2025 Notre Dame 34-24" } },
  { a: "Iowa", b: "Iowa State", trophy: "Cy-Hawk Trophy", game: "Cy-Hawk game", art: 'cup', first: 1894, since: null, real: { lead: "Iowa", rec: '46-25', holder: "Iowa State", last: "2025 Iowa State 16-13" } },
  { a: "Kansas", b: "Kansas State", trophy: "Governor's Cup", game: "Sunflower Showdown", art: 'cup', first: 1902, since: null, real: { lead: "Kansas", rec: '64-54-5', holder: "Kansas State", last: "2025 Kansas State 42-17" } },
  { a: "Nebraska", b: "Iowa", trophy: "Heroes Trophy", game: "Heroes Game", art: 'cup', first: 1891, since: 2011, real: { lead: "Nebraska", rec: '30-23-3', holder: "Iowa", last: "2025 Iowa 40-16" } },
  { a: "Duke", b: "North Carolina", trophy: "Victory Bell", game: "Victory Bell rivalry", art: 'bell', first: 1888, since: 1948, real: { lead: "North Carolina", rec: '64-42-4', holder: "Duke", last: "2025 Duke 32-25" } },
  { a: "LSU", b: "Ole Miss", trophy: "Magnolia Bowl Trophy", game: "Magnolia Bowl", art: 'cup', first: 1894, since: 2008, real: { lead: "LSU", rec: '64-43-4', holder: "Ole Miss", last: "2025 Ole Miss 24-19" } },
  { a: "Arkansas", b: "LSU", trophy: "Golden Boot", game: "Battle for the Golden Boot", art: 'boot', first: 1901, since: 1996, real: { lead: "LSU", rec: '44-23-2', holder: "LSU", last: "2025 LSU 23-22" } },
  { a: "Texas Tech", b: "TCU", trophy: "Saddle Trophy", game: "West Texas Championship", art: 'saddle', first: 1926, since: 2017, real: { lead: "Texas Tech", rec: '33-31-3', holder: "TCU", last: "2024 TCU 35-34" } },
  { a: "SMU", b: "TCU", trophy: "Iron Skillet", game: "Iron Skillet", art: 'skillet', first: 1915, since: 1946, real: { lead: "TCU", rec: '54-43-7', holder: "TCU", last: "2025 TCU 35-24" } },
  { a: "Boise State", b: "Fresno State", trophy: "Milk Can", game: "Milk Can game", art: 'can', first: 1977, since: 2005, real: { lead: "Boise State", rec: '17-10', holder: "Fresno State", last: "2025 Fresno State 30-7" } },
  { a: "Colorado", b: "Colorado State", trophy: "Centennial Cup", game: "Rocky Mountain Showdown", art: 'cup', first: 1893, since: null, real: { lead: "Colorado", rec: '69-22-2', holder: "Colorado", last: "2024 Colorado 28-9" } },
  { a: "Wyoming", b: "Colorado State", trophy: "Bronze Boot", game: "Border War", art: 'boot', first: 1899, since: 1968, real: { lead: "Colorado State", rec: '60-52-5', holder: "Wyoming", last: "2025 Wyoming 28-0" } },
  { a: "New Mexico", b: "New Mexico State", trophy: "Maloof Trophy", game: "Rio Grande Rivalry", art: 'cup', first: 1894, since: null, real: { lead: "New Mexico", rec: '75-35-5', holder: "New Mexico", last: "2025 New Mexico 38-20" } },
  { a: "Nevada", b: "UNLV", trophy: "Fremont Cannon", game: "Battle for Nevada", art: 'cannon', first: 1969, since: 1970, real: { lead: "Nevada", rec: '29-22', holder: "UNLV", last: "2025 UNLV 42-17" } },
  { a: "Hawaii", b: "Wyoming", trophy: "Paniolo Trophy", game: "Paniolo Trophy game", art: 'saddle', first: 1978, since: null, real: { lead: "Wyoming", rec: '17-12', holder: "Hawaii", last: "2025 Hawaii 27-7" } },
  { a: "Cincinnati", b: "Louisville", trophy: "Keg of Nails", game: "Keg of Nails", art: 'keg', first: 1929, since: null, real: { lead: "Cincinnati", rec: '30-23-1', holder: "Louisville", last: "2022 Louisville 24-7" } },
  { a: "Toledo", b: "Bowling Green", trophy: "Battle of I-75 Trophy", game: "Battle of I-75", art: 'cup', first: 1919, since: 1980, real: { lead: null, rec: '43-43-4', holder: "Bowling Green", last: "2025 Bowling Green 28-23" } },
  { a: "Marshall", b: "Ohio", trophy: "The Bell", game: "Battle for the Bell", art: 'bell', first: 1905, since: null, real: { lead: "Ohio", rec: '33-21-6', holder: "Marshall", last: "2019 Marshall 33-31" } },
  { a: "Troy", b: "South Alabama", trophy: "The Belt", game: "Battle for the Belt", art: 'belt', first: 2012, since: 2015, real: { lead: "Troy", rec: '10-4', holder: "Troy", last: "2025 Troy 31-24" } },
  { a: "Rice", b: "Houston", trophy: "Bayou Bucket", game: "Bayou Bucket", art: 'bucket', first: 1971, since: null, real: { lead: "Houston", rec: '35-12', holder: "Houston", last: "2025 Houston 35-9" } },
  { a: "Tulane", b: "Southern Miss", trophy: "The Bell", game: "Battle for the Bell", art: 'bell', first: 1979, since: 1999, real: { lead: "Southern Miss", rec: '24-10', holder: "Tulane", last: "2023 Tulane 21-3" } },
  { a: "Tulane", b: "LSU", trophy: "Victory Flag", game: "Battle for the Rag", art: 'flag', first: 1893, since: null, real: { lead: "LSU", rec: '69-22-7', holder: "LSU", last: "2009 LSU 42-0" } },
  { a: "Northwestern", b: "Illinois", trophy: "Land of Lincoln Trophy", game: "Land of Lincoln Trophy game", art: 'hat', first: 1892, since: 2009, real: { lead: "Illinois", rec: '59-55-5', holder: "Illinois", last: "2025 Illinois 20-13" } },
  { a: "Purdue", b: "Illinois", trophy: "Purdue Cannon", game: "Purdue Cannon game", art: 'cannon', first: 1890, since: 1943, real: { lead: "Purdue", rec: '48-47-6', holder: "Illinois", last: "2025 Illinois 43-27" } },
  { a: "Michigan State", b: "Penn State", trophy: "Land Grant Trophy", game: "Land Grant Trophy game", art: 'cup', first: 1914, since: 1993, real: { lead: "Penn State", rec: '20-18-1', holder: "Penn State", last: "2025 Penn State 28-10" } },
  { a: "Wisconsin", b: "Iowa", trophy: "Heartland Trophy", game: "Heartland Trophy game", art: 'cup', first: 1894, since: 2004, real: { lead: "Wisconsin", rec: '49-48-2', holder: "Iowa", last: "2025 Iowa 37-0" } },
  { a: "Minnesota", b: "Iowa", trophy: "Floyd of Rosedale", game: "Floyd of Rosedale game", art: 'cup', first: 1891, since: 1935, real: { lead: "Minnesota", rec: '63-54-2', holder: "Iowa", last: "2025 Iowa 41-3" } },
  { a: "Michigan", b: "Minnesota", trophy: "Little Brown Jug", game: "Little Brown Jug", art: 'jug', first: 1892, since: 1903, real: { lead: "Michigan", rec: '78-25-3', holder: "Michigan", last: "2024 Michigan 27-24" } },
  { a: "San Diego State", b: "Fresno State", trophy: "Old Oil Can", game: "Old Oil Can", art: 'can', first: 1923, since: 2011, real: { lead: "San Diego State", rec: '32-27-4', holder: "San Diego State", last: "2025 San Diego State 23-0" } },
  { a: "San Jose State", b: "Fresno State", trophy: "Valley Trophy", game: "Battle for the Valley", art: 'cup', first: 1921, since: 2013, real: { lead: "Fresno State", rec: '46-39-3', holder: "Fresno State", last: "2025 Fresno State 41-14" } },
  { a: "Central Michigan", b: "Western Michigan", trophy: "Victory Cannon", game: "Victory Cannon game", art: 'cannon', first: 1907, since: 2008, real: { lead: "Western Michigan", rec: '54-40-2', holder: "Western Michigan", last: "2025 Western Michigan 24-21" } },
  { a: "Akron", b: "Kent State", trophy: "Wagon Wheel", game: "Wagon Wheel", art: 'wheel', first: 1923, since: 1946, real: { lead: "Akron", rec: '37-29-2', holder: "Kent State", last: "2025 Kent State 42-35" } },
  { a: "FIU", b: "Florida Atlantic", trophy: "Don Shula Award", game: "Shula Bowl", art: 'cup', first: 2002, since: 2002, real: { lead: "Florida Atlantic", rec: '17-5', holder: "FIU", last: "2025 FIU 38-28" } },
];

/** The real history applies to dynasties that start after the 2025 season (the 2026 edition). */
export const REAL_THROUGH = 2025;

const key = (a: string, b: string) => [a, b].sort().join('|');
const BY_PAIR = new Map(TROPHIES.map((t) => [key(t.a, t.b), t]));

/** The trophy two schools play for, if any (by the dynasty's school names). */
export const trophyOf = (a: string, b: string): RivalryTrophy | null => BY_PAIR.get(key(a, b)) ?? null;

/** A school's trophy games. */
export const trophiesOf = (school: string): RivalryTrophy[] => TROPHIES.filter((t) => t.a === school || t.b === school);
